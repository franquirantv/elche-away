// Intentionally does not load .env.local. Only the production Actions job may run this.
import { appendFile, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { Pool, type PoolClient } from "pg";
import { api, array, number, object, string, waitFor, type JsonObject } from "./cd/http";
import { migrateProduction, validateMigrationPolicy, verifyHistory } from "./cd/migrations";
import { CdError, directProductionUrl, recoveryDeletions, releaseInOrder, requireCondition, type RecoveryRecord } from "./cd/policy";
import { smoke } from "./cd/smoke";
import { assertFreeUsage, assertRecoveryCapacity } from "./cd/budget";

function env(key: string) {
  const value = process.env[key];
  requireCondition(value, `CONFIG_${key}`);
  return value;
}

async function main() {
  requireCondition(process.env.GITHUB_ACTIONS === "true" && process.env.GITHUB_EVENT_NAME === "workflow_run", "ACTIONS_ONLY");
  const sha = env("VERIFIED_SHA");
  requireCondition(/^[a-f0-9]{40}$/.test(sha), "SHA_FORMAT");
  requireCondition(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() === sha, "CHECKOUT_SHA");
  const repo = env("GITHUB_REPOSITORY");
  requireCondition(repo === "franquirantv/elche-away", "REPOSITORY");
  const runId = env("GITHUB_RUN_ID");
  requireCondition(/^\d+$/.test(runId) && /^\d+$/.test(env("CI_RUN_ID")), "RUN_ID");
  const projectId = env("NEON_PROJECT_ID");
  const parentId = env("NEON_PRODUCTION_BRANCH_ID");
  requireCondition(/^[a-z0-9-]+$/.test(projectId) && /^br-[a-z0-9-]+$/.test(parentId), "NEON_IDS");
  const productionUrl = directProductionUrl(env("PRODUCTION_DATABASE_URL_UNPOOLED"), env("PRODUCTION_DATABASE_HOST"), env("PRODUCTION_DATABASE_NAME"));
  const publicOrigin = new URL(env("PRODUCTION_URL")).origin;
  requireCondition(publicOrigin === env("PRODUCTION_URL") && publicOrigin.startsWith("https://"), "PUBLIC_ORIGIN");
  const teamId = env("VERCEL_TEAM_ID");
  const vercelProjectId = env("VERCEL_PROJECT_ID");
  requireCondition(/^team_[a-zA-Z0-9]+$/.test(teamId) && /^prj_[a-zA-Z0-9]+$/.test(vercelProjectId), "VERCEL_IDS");
  const github = api(`https://api.github.com/repos/${repo}`, env("GITHUB_TOKEN"));
  const neon = api(`https://console.neon.tech/api/v2/projects/${projectId}`, env("NEON_API_KEY"));
  const vercel = api("https://api.vercel.com", env("VERCEL_TOKEN"), `teamId=${teamId}`);
  const summary = async (message: string) => {
    console.log(message);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${message}\n\n`);
  };
  const registryEnvironment = "production-cd";
  let registryId: number | undefined;
  let stage = "preflight";
  let deploymentUrl = "";
  let vercelProject: JsonObject;
  let successfulShas = new Set<string>();
  const pool = new Pool({ connectionString: productionUrl.toString(), max: 1, connectionTimeoutMillis: 10_000 });
  pool.on("error", () => console.error("CD database connection interrupted."));
  const status = async (state: string) => {
    requireCondition(registryId !== undefined, "REGISTRY_MISSING");
    await github(`/deployments/${registryId}/statuses`, "POST", {
      state, auto_inactive: false, environment: registryEnvironment,
      log_url: `https://github.com/${repo}/actions/runs/${runId}`,
      description: `Automatic release: ${stage}`,
      ...(deploymentUrl ? { environment_url: deploymentUrl } : {}),
    });
  };
  const branches = async () => {
    const response = object(await neon("/branches?limit=100"));
    requireCondition(!object(response.pagination ?? {}).cursor, "NEON_PAGINATION_UNEXPECTED");
    return array(response.branches).map(object);
  };
  const branchReady = (id: string) => waitFor(async () => object(object(await neon(`/branches/${id}`)).branch), (branch) => {
    requireCondition(!["broken", "deleting"].includes(String(branch.current_state)), "BRANCH_FAILED");
    return branch.current_state === "ready" && !branch.pending_state;
  });
  const deleteBranch = async (id: string) => {
    requireCondition(id !== parentId, "PRODUCTION_DELETE_FORBIDDEN");
    await neon(`/branches/${id}`, "DELETE");
    await waitFor(branches, (items) => !items.some((item) => item.id === id));
  };
  let client: PoolClient | undefined;
  try {
    await releaseInOrder({
      preflight: async () => {
        const ci = object(await github(`/actions/runs/${env("CI_RUN_ID")}`));
        requireCondition(ci.event === "push" && ci.head_branch === "main" && ci.head_sha === sha
          && ci.conclusion === "success" && ci.path === ".github/workflows/ci.yml"
          && object(ci.head_repository).full_name === repo, "CI_PROVENANCE");
        const tip = object(object(await github("/git/ref/heads/main")).object);
        if (tip.sha !== sha) { await summary("Skipped superseded commit."); return false; }
        const configuration = object(JSON.parse(await readFile("vercel.json", "utf8")));
        requireCondition(object(object(configuration.git).deploymentEnabled).main === false, "GIT_AUTODEPLOY_ENABLED");
        const team = object(await vercel(`/v2/teams/${teamId}`));
        requireCondition(object(team.billing).plan === "hobby", "VERCEL_NOT_FREE");
        vercelProject = object(await vercel(`/v9/projects/${vercelProjectId}`));
        const link = object(vercelProject.link);
        requireCondition(vercelProject.id === vercelProjectId && link.type === "github" && link.productionBranch === "main"
          && link.org === repo.split("/")[0] && link.repo === repo.split("/")[1], "VERCEL_PROJECT_BINDING");
        requireCondition(/^\d+$/.test(String(link.repoId)), "VERCEL_REPOSITORY_ID");
        requireCondition(vercelProject.buildCommand === "npm run release:check && npm run build", "VERCEL_BUILD_COMMAND");
        const active = object(await vercel(`/v6/deployments?projectId=${vercelProjectId}&target=production&limit=100`));
        requireCondition(array(active.deployments).map(object).every((deployment) =>
          ["READY", "ERROR", "CANCELED"].includes(String(deployment.state ?? deployment.readyState))), "REMOTE_DEPLOYMENT_ACTIVE");
        const project = object(object(await neon("")).project);
        assertFreeUsage(project);
        const endpoints = array(object(await neon("/endpoints")).endpoints).map(object);
        requireCondition(endpoints.some((endpoint) => endpoint.branch_id === parentId
          && endpoint.host === productionUrl.hostname && endpoint.type === "read_write"), "NEON_DATABASE_BINDING");
        // Persisted GitHub deployment payloads are the recovery registry, never logs/artifacts with rows.
        const records: RecoveryRecord[] = [];
        const allDeployments: JsonObject[] = [];
        for (let page = 1; ; page++) {
          requireCondition(page <= 100, "REGISTRY_TOO_LARGE");
          const batch = array(await github(`/deployments?environment=${registryEnvironment}&per_page=100&page=${page}`)).map(object);
          allDeployments.push(...batch);
          if (batch.length < 100) break;
        }
        successfulShas = new Set();
        for (const deployment of allDeployments) {
          const payload = object(deployment.payload);
          if (payload.owner !== "elche-away-cd-v1" || payload.projectId !== projectId || payload.parentId !== parentId) continue;
          const statuses = array(await github(`/deployments/${number(deployment.id)}/statuses?per_page=1`)).map(object);
          const state = statuses.length ? string(statuses[0].state) : "unknown";
          // A killed runner may have left a remote mutation active. Do not overlap it.
          requireCondition(["success", "failure", "error"].includes(state), "UNFINISHED_RELEASE_RECONCILE");
          if (deployment.sha === sha) {
            requireCondition(state === "success", "RELEASE_ALREADY_ATTEMPTED_RECONCILE");
            await summary("Skipped already successful SHA."); return false;
          }
          if (state === "success") successfulShas.add(string(deployment.sha));
          records.push({ id: string(payload.recoveryId), parentId, name: string(payload.recoveryName),
            createdAt: string(deployment.created_at), state });
        }
        const currentBranches = await branches();
        for (const record of recoveryDeletions(records, parentId, Date.now())) {
          const branch = currentBranches.find((item) => item.id === record.id);
          if (!branch) continue;
          requireCondition(branch.parent_id === parentId && branch.name === record.name && !branch.default, "CLEANUP_BINDING");
          requireCondition(!currentBranches.some((item) => item.parent_id === record.id), "RECOVERY_HAS_CHILDREN");
          await deleteBranch(record.id);
        }
        const remaining = await branches();
        assertRecoveryCapacity(project, remaining, parentId);
        client = await pool.connect();
        const lock = await client.query<{ locked: boolean }>("select pg_try_advisory_lock(172943, 1) as locked");
        requireCondition(lock.rows[0].locked, "RELEASE_LOCKED");
        await validateMigrationPolicy(client, successfulShas);
        return true;
      },
      recovery: async () => {
        stage = "recovery";
        const recoveryName = `recovery/${runId}-${sha}`;
        const result = object(await neon("/branches", "POST", { branch: { name: recoveryName, parent_id: parentId } }));
        const recoveryId = string(object(result.branch).id);
        const recovery = await branchReady(recoveryId);
        requireCondition(recovery.parent_id === parentId && recovery.name === recoveryName
          && /^[A-Fa-f0-9]+\/[A-Fa-f0-9]+$/.test(string(recovery.parent_lsn)), "RECOVERY_INVALID");
        await summary(`Recovery ${recoveryId}; parent ${parentId}; LSN ${string(recovery.parent_lsn)}; SHA ${sha}.`);
        const deployment = object(await github("/deployments", "POST", {
          ref: sha, environment: registryEnvironment, auto_merge: false, required_contexts: [], production_environment: true,
          payload: { owner: "elche-away-cd-v1", projectId, parentId, recoveryId, recoveryName, runId },
        }));
        registryId = number(deployment.id);
        await status("in_progress");
        // Restore rehearsal: a disposable child proves the recovery can be opened and upgraded.
        const trial = object(await neon("/branches", "POST", {
          branch: { name: `rehearsal/${runId}-${sha}`, parent_id: recoveryId },
          endpoints: [{ type: "read_write", autoscaling_limit_min_cu: 0.25, autoscaling_limit_max_cu: 0.25 }],
        }));
        const trialId = string(object(trial.branch).id);
        await branchReady(trialId);
        const endpoint = object(array(trial.endpoints)[0]);
        requireCondition(endpoint.branch_id === trialId, "REHEARSAL_ENDPOINT_BINDING");
        const trialUrl = new URL(productionUrl);
        trialUrl.hostname = string(endpoint.host);
        requireCondition(trialUrl.hostname.endsWith(".neon.tech") && trialUrl.hostname !== productionUrl.hostname, "REHEARSAL_HOST");
        const trialPool = new Pool({ connectionString: trialUrl.toString(), max: 1, connectionTimeoutMillis: 10_000 });
        trialPool.on("error", () => console.error("CD rehearsal connection interrupted."));
        try {
          const trialClient = await trialPool.connect();
          try {
            await verifyHistory(trialClient);
            await migrateProduction(trialClient);
            await trialClient.query("select count(*) from attendance");
          } finally { trialClient.release(); }
        } finally { await trialPool.end(); }
        // Only delete a confirmed child of our own recovery; recovery itself remains untouched.
        const trialBranch = await branchReady(trialId);
        requireCondition(trialBranch.parent_id === recoveryId, "REHEARSAL_PARENT");
        await deleteBranch(trialId);
        await summary("Recovery read and migration rehearsal passed; recovery has no compute and remains unchanged.");
      },
      migrate: async () => {
        stage = "migration";
        requireCondition(client, "DATABASE_SESSION");
        await migrateProduction(client);
        await summary(`Migration completed for ${sha}. No seed/reset was executed.`);
      },
      deploy: async () => {
        stage = "deploy";
        const link = object(vercelProject.link);
        const created = object(await vercel("/v13/deployments", "POST", {
          name: string(vercelProject.name), project: vercelProjectId, target: "production",
          gitSource: { type: "github", repoId: String(link.repoId), ref: sha, sha },
          meta: { releaseSha: sha, releaseRunId: runId },
        }));
        const deploymentId = string(created.id);
        await summary(`Vercel deployment ${deploymentId}; SHA ${sha}.`);
        const ready = await waitFor(async () => object(await vercel(`/v13/deployments/${deploymentId}`)), (value) => {
          requireCondition(!["ERROR", "CANCELED"].includes(String(value.readyState)), "DEPLOY_FAILED");
          return value.readyState === "READY";
        }, 900_000);
        requireCondition(ready.target === "production" && object(ready.gitSource).sha === sha, "DEPLOY_SHA_MISMATCH");
        deploymentUrl = `https://${string(ready.url)}`;
        requireCondition(new URL(deploymentUrl).hostname.endsWith(".vercel.app"), "DEPLOYMENT_HOST");
      },
      smoke: async () => {
        stage = "smoke";
        await smoke(deploymentUrl, process.env.VERCEL_AUTOMATION_BYPASS_SECRET);
        // The public domain must also point at this exact deployment, not a healthy old release.
        const alias = object(await vercel(`/v4/aliases/${encodeURIComponent(new URL(publicOrigin).hostname)}`));
        requireCondition(alias.projectId === vercelProjectId, "PUBLIC_PROJECT_MISMATCH");
        const publicDeployment = object(await vercel(`/v13/deployments/${string(alias.deploymentId)}`));
        requireCondition(object(publicDeployment.gitSource).sha === sha, "PUBLIC_SHA_MISMATCH");
        await smoke(publicOrigin);
      },
      success: async () => {
        stage = "complete";
        await status("success");
        await summary(`Release successful: ${sha}, ${deploymentUrl}, ${publicOrigin}.`);
      },
    });
  } catch (error) {
    if (registryId !== undefined) {
      try { await status("failure"); } catch { /* Unknown registry status also prevents deletion. */ }
    }
    const code = error instanceof CdError && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "UNCLASSIFIED";
    await summary(`Release stopped at ${stage} [${code}]. No automatic SQL rollback. Preserve recovery and reconcile before retry.`);
    throw new Error("RELEASE_STOPPED");
  } finally {
    try {
      if (client) {
        try { await client.query("select pg_advisory_unlock(172943, 1)"); } finally { client.release(); }
      }
    } finally { await pool.end(); }
  }
}

main().catch((error: unknown) => {
  // Suppress raw database/provider/parser errors: they may include secrets or rows.
  const code = error instanceof CdError && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "RELEASE_STOPPED";
  console.error(`Production CD failed [${code}]. Review docs/CD.md; no credentials were logged.`);
  process.exitCode = 1;
});
