"use client";

import { createAuthClient } from "@neondatabase/auth/next";
import { useState } from "react";
import { useRouter } from "next/navigation";

const authClient = createAuthClient();

export function AuthButton({ signOut = false }: { signOut?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function handleClick() {
    setPending(true);
    setError("");
    try {
      if (signOut) {
        const result = await authClient.signOut();
        if (result.error) throw new Error();
        router.replace("/auth/sign-in");
        router.refresh();
      } else {
        const result = await authClient.signIn.social({ provider: "google", callbackURL: `${window.location.origin}/auth/account` });
        if (result.error) throw new Error();
      }
    } catch {
      setError(signOut ? "No se pudo cerrar la sesión. Vuelve a intentarlo." : "No se pudo iniciar sesión con Google. Vuelve a intentarlo.");
      setPending(false);
    }
  }
  return <div><button type="button" className="button-link" onClick={handleClick} disabled={pending}>{pending ? "Un momento…" : signOut ? "Cerrar sesión" : "Continuar con Google"}</button>{error && <p role="alert" className="form-error">{error}</p>}</div>;
}
