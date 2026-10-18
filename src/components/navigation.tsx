"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/trips", label: "Viajes" },
  { href: "/stadiums", label: "Estadios" },
  { href: "/map", label: "Mapa" },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegación principal" className="main-nav">
      {links.map(({ href, label }) => {
        const active = href === "/" ? pathname === href : pathname.startsWith(href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
