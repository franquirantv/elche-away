import type { Metadata } from "next";
import { AuthButton } from "@/components/auth-buttons";

export const metadata: Metadata = { title: "Acceso del propietario" };

export default function SignInPage() {
  return <div className="page-content page-heading">
    <p className="eyebrow">Área privada</p><h1>Acceso del propietario</h1>
    <p className="lead">Inicia sesión con Google. Tener una sesión no concede permiso para administrar el archivo.</p>
    <AuthButton />
  </div>;
}
