import { api, array, object } from "./http";
import { requireCondition } from "./policy";

// Deployment authorization is checked on the required resources, not team billing.
export async function verifyVercelProject(vercel: ReturnType<typeof api>, projectId: string, repo: string) {
  const project = object(await vercel("project.read", `/v9/projects/${projectId}`));
  const link = object(project.link);
  requireCondition(project.id === projectId && link.type === "github" && link.productionBranch === "main"
    && link.org === repo.split("/")[0] && link.repo === repo.split("/")[1], "VERCEL_PROJECT_BINDING");
  requireCondition(/^\d+$/.test(String(link.repoId)), "VERCEL_REPOSITORY_ID");
  requireCondition(project.buildCommand === "npm run release:check && npm run build", "VERCEL_BUILD_COMMAND");
  const active = object(await vercel("deployments.list", `/v6/deployments?projectId=${projectId}&target=production&limit=100`));
  requireCondition(array(active.deployments).map(object).every((deployment) =>
    ["READY", "ERROR", "CANCELED"].includes(String(deployment.state ?? deployment.readyState))), "REMOTE_DEPLOYMENT_ACTIVE");
  return project;
}
