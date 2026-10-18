import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Mapa" };

export default function MapPage() {
  return <EmptyState eyebrow="03 / Las chinchetas" title="Mapa" description="Del mapa de corcho a los lugares donde seguimos al Elche." message="El mapa de los estadios visitados llegará más adelante. Por ahora, las chinchetas siguen en el corcho." />;
}
