"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const links = [
  { href: "/", label: "Mapa", key: "map" },
  { href: "/?view=trips", label: "Viajes", key: "trips" },
  { href: "/?view=stadiums", label: "Estadios", key: "stadiums" },
  { href: "/?view=summary", label: "Resumen", key: "summary" },
];

function NavigationLinks({ active }: { active: string | null }) {
  return <nav aria-label="Navegación principal" className="main-nav">{links.map(({ href, label, key }) => <Link key={key} href={href} scroll={false} aria-current={active === key ? "page" : undefined}>{label}</Link>)}</nav>;
}

export function NavigationFallback() { return <NavigationLinks active={null} />; }

export function Navigation() {
  const pathname = usePathname();
  const search = useSearchParams();
  let active: string | null = null;
  if (pathname === "/" || pathname === "/map") active = search.has("trip") || search.get("view") === "trips" ? "trips" : search.has("stadium") || search.get("view") === "stadiums" ? "stadiums" : search.get("view") === "summary" ? "summary" : "map";
  else if (pathname.startsWith("/trips")) active = "trips";
  else if (pathname.startsWith("/stadiums")) active = "stadiums";
  return <NavigationLinks active={active} />;
}
