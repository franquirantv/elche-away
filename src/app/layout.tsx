import type { Metadata } from "next";
import Link from "next/link";
import { Navigation } from "@/components/navigation";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Elche Away · Donde tú vayas.", template: "%s · Elche Away" },
  description: "Un archivo personal de viajes, estadios y recuerdos siguiendo al Elche CF. Donde tú vayas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <a href="#main-content" className="skip-link">Saltar al contenido</a>
        <header className="site-header">
          <div className="site-container header-inner">
            <Link href="/" className="brand" aria-label="Elche Away, inicio">
              <span className="brand-symbol" aria-hidden="true">ea<span>.</span></span>
              <span>Elche Away</span>
            </Link>
            <Navigation />
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="site-container">{children}</main>
        <footer className="site-footer">
          <div className="site-container footer-inner">
            <p>Elche Away <span aria-hidden="true">/</span> Donde tú vayas.</p>
            <p>Archivo personal de un aficionado. Sin vinculación oficial con el Elche CF. <Link href="/auth/sign-in" className="inline-link">Acceso del propietario</Link></p>
          </div>
        </footer>
      </body>
    </html>
  );
}
