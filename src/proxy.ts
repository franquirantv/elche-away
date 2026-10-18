import { getAuth } from "@/server/auth";
import type { NextRequest } from "next/server";

// Complete the native OAuth verifier exchange on the account landing page.
// Every admin read/action still performs independent owner authorization.
export default function proxy(request: NextRequest) {
  return getAuth().middleware({ loginUrl: "/auth/sign-in" })(request);
}

export const config = { matcher: ["/admin/:path*", "/auth/account"] };
