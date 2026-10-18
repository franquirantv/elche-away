import { getAuth } from "@/server/auth";
import type { NextRequest } from "next/server";

// Session redirect only; every admin read/action performs owner authorization.
export default function proxy(request: NextRequest) {
  return getAuth().middleware({ loginUrl: "/auth/sign-in" })(request);
}

export const config = { matcher: ["/admin/:path*"] };
