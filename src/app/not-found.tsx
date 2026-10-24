import Link from "next/link";
import { MapExplorer } from "@/components/map-explorer";
import { mapConfig } from "@/server/map-config";

export default function NotFound() {
  return <MapExplorer stadiums={[]} config={mapConfig()} selectedSlug={null} panelKey="not-found" title="No encontramos esta página" information={<p>Este enlace no corresponde a un recurso público del archivo.</p>}>
    <p>Puede que el enlace no sea correcto o que el viaje no esté publicado. El camino continúa desde el mapa.</p>
    <Link href="/" className="button-link">Volver al inicio</Link>
  </MapExplorer>;
}
