import { getAuth } from "@/server/auth";
import { NextRequest } from "next/server";

// Complete the native OAuth verifier exchange on the account landing page.
// Every admin read/action still performs independent owner authorization.
export default async function proxy(request: NextRequest) {
  // SDK 0.6's cache-miss path mints session_data but drops upstream token
  // renewal cookies. Use its uncached path where response cookies can be set.
  const url = request.nextUrl.clone();
  url.searchParams.set("disableCookieCache", "true");
  url.searchParams.delete("disableRefresh");
  const response = await getAuth().middleware({ loginUrl: "/auth/sign-in" })(new NextRequest(url, request));
  // These parameters control only the internal session lookup, not navigation.
  const location = response.headers.get("location");
  if (location) {
    const redirect = new URL(location);
    for (const name of ["disableCookieCache", "disableRefresh"]) {
      redirect.searchParams.delete(name);
      for (const value of request.nextUrl.searchParams.getAll(name)) redirect.searchParams.append(name, value);
    }
    response.headers.set("location", redirect.toString());
  }
  return response;
}

export const config = { matcher: ["/admin/:path*", "/auth/account"] };
