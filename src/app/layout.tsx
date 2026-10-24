import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Elche Away · Donde tú vayas.", template: "%s · Elche Away" },
  description: "Un archivo personal de viajes, estadios y recuerdos siguiendo al Elche CF. Donde tú vayas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
