import "server-only";
import { resolveMapConfig } from "@/lib/map-config";

export function mapConfig() {
  return resolveMapConfig(process.env);
}
