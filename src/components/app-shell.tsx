"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Navigation, NavigationFallback } from "./navigation";

// Presentation only. Every private operation still authorizes on the server.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const management = pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/auth" || pathname.startsWith("/auth/");
  return <>
    <a href="#main-content" className="skip-link">Saltar al contenido</a>
    {management && <header className="site-header"><div className="site-container header-inner">
      <Link href="/" className="brand" aria-label="Elche Away, inicio"><span className="brand-symbol" aria-hidden="true">ea<span>.</span></span><span>Elche Away</span></Link>
      <Suspense fallback={<NavigationFallback />}><Navigation /></Suspense>
    </div></header>}
    <main id="main-content" tabIndex={-1} className={management ? "site-container" : "map-app"}>{children}</main>
    {management && <footer className="site-footer"><div className="site-container footer-inner"><p>Elche Away <span aria-hidden="true">/</span> Donde tú vayas.</p><p>Archivo personal de un aficionado. Sin vinculación oficial con el Elche CF. <Link href="/admin" prefetch={false} className="inline-link">Acceso del propietario</Link></p></div></footer>}
  </>;
}
