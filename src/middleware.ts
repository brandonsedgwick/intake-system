import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    // Add any additional middleware logic here
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/clients/:path*",
    "/inbox/:path*",
    "/outreach/:path*",
    "/scheduling/:path*",
    "/referrals/:path*",
    "/clinicians/:path*",
    "/templates/:path*",
    "/settings/:path*",
    "/api/clients/:path*",
    "/api/emails/:path*",
    "/api/clinicians/:path*",
    "/api/scheduling/:path*",
  ],
};
