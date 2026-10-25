"use server";

import Link from "next/link";
import { getTrips, getCollectionStadiums } from "@/db/public-archive";
import { TripList } from "@/components/trip-list";
import { ArchiveLinkStatus } from "@/components/archive-link-status";
import { formatLocation } from "@/lib/geography";
import { mapDetailHref } from "@/lib/map-navigation";
import { PAGE_SIZE, pageOffset } from "@/lib/pagination";
import { validId } from "./reference-input";
import type { ListChunk } from "@/components/load-more";

export async function loadTrips(stadiumId: string | undefined, page: number): Promise<ListChunk> {
  if (stadiumId !== undefined) validId(stadiumId);
  const trips = await getTrips(stadiumId, { limit: PAGE_SIZE + 1, offset: pageOffset(page) });
  return { content: trips.length ? <TripList trips={trips.slice(0, PAGE_SIZE)} onMap /> : <p>{page === 1 ? "Todavía no hay viajes publicados." : "No hay más viajes publicados."}</p>, hasMore: trips.length > PAGE_SIZE };
}

export async function loadStadiums(state: "all" | "visited" | "pending", page: number): Promise<ListChunk> {
  if (!["all", "visited", "pending"].includes(state)) throw new Error("Filtro de colección no válido.");
  const offset = pageOffset(page);
  const stadiums = await getCollectionStadiums({ limit: PAGE_SIZE + 1, offset }, state);
  return { content: stadiums.length ? <ul className="explorer-stadiums">{stadiums.slice(0, PAGE_SIZE).map((stadium) => <li key={stadium.slug} className="trip-card">
    <h3><Link prefetch={false} href={mapDetailHref("stadium", stadium.slug)} scroll={false}>{stadium.name}<ArchiveLinkStatus /></Link></h3>
    <p>{formatLocation(stadium.city, stadium.provinceCode)}</p><p className="collection-state">{stadium.visits ? `✓ Visitado · ${stadium.visits} ${stadium.visits === 1 ? "visita" : "visitas"}` : "○ Pendiente de visitar"}</p>
    {(stadium.latitude === null || stadium.longitude === null) && <p>Sin coordenadas</p>}
  </li>)}</ul> : <p>No hay estadios para este filtro.</p>, hasMore: stadiums.length > PAGE_SIZE };
}
