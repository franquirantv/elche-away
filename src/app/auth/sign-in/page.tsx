import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { AuthButton } from "@/components/auth-buttons";
import { getVerifiedSession } from "@/server/auth";
import { assertAdminIdentity } from "@/server/admin-policy";

export const metadata: Metadata = { title: "Acceso del propietario" };

export default async function SignInPage() {
  await connection();
  const session = await getVerifiedSession();
  if (session?.user) {
    let authorized = false;
    try { assertAdminIdentity(session.user.id, process.env.ADMIN_USER_ID); authorized = true; } catch { /* Authentication does not grant admin access. */ }
    redirect(authorized ? "/admin" : "/auth/account");
  }
  return <div className="page-content page-heading">
    <p className="eyebrow">Área privada</p><h1>Acceso del propietario</h1>
    <p className="lead">Inicia sesión con Google. Tener una sesión no concede permiso para administrar el archivo.</p>
    <AuthButton />
  </div>;
}
