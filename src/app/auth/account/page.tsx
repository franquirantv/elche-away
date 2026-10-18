import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AuthButton } from "@/components/auth-buttons";
import { getVerifiedSession } from "@/server/auth";
import { assertAdminIdentity } from "@/server/admin-policy";

export const metadata: Metadata = { title: "Mi sesión", robots: { index: false, follow: false } };

export default async function AccountPage() {
  await connection();
  const session = await getVerifiedSession();
  if (!session?.user) return <div className="page-content page-heading"><h1>No has iniciado sesión</h1><Link className="text-link" href="/auth/sign-in">Iniciar sesión con Google</Link></div>;
  let authorized = false;
  try { assertAdminIdentity(session.user.id, process.env.ADMIN_USER_ID); authorized = true; } catch { /* No automatic enrollment. */ }
  return <div className="page-content page-heading">
    <p className="eyebrow">Mi sesión</p><h1>Sesión iniciada</h1>
    <p className="lead">{authorized ? "Tu identidad está autorizada para administrar el archivo." : "Tu sesión es válida, pero no tienes acceso de administrador."}</p>
    <dl className="detail-grid"><div><dt>Identificador de tu usuario en este entorno</dt><dd><code>{session.user.id}</code></dd></div></dl>
    {!authorized && <p className="account-help">Si eres el propietario, configura este identificador como ADMIN_USER_ID en el entorno local, según README. Ningún usuario recibe permisos automáticamente.</p>}
    {authorized && <Link href="/admin" className="text-link">Ir a administración</Link>}
    <AuthButton signOut />
  </div>;
}
