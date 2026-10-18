export class AccessDenied extends Error {
  constructor() { super("No tienes permiso para administrar este archivo."); }
}

// Called only with identity obtained from a verified Neon Auth session.
// No bootstrap-by-first-login, email matching, roles or client-supplied identity.
export function assertAdminIdentity(userId: string | null | undefined, configuredId: string | undefined) {
  if (!userId || !configuredId?.trim() || userId !== configuredId.trim()) throw new AccessDenied();
}
