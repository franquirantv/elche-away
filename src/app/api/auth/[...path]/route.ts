import type { NextRequest } from "next/server";
import { getAuth } from "@/server/auth";

// Use the native SDK proxy, including OAuth verifier/callback handling.
export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return getAuth().handler().GET(request, context);
}
export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return getAuth().handler().POST(request, context);
}
