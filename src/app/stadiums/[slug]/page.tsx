import { redirect } from "next/navigation";
import { mapDetailHref } from "@/lib/map-navigation";

export default async function ArchiveDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(mapDetailHref("stadium", slug));
}
