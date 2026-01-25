import { withAuth } from "next-auth/middleware";
import { NextRequest, NextResponse } from "next/server";

// Paths that should be excluded from auth (called from Puppeteer popup in Simple Practice domain)
const publicApiPaths = [
  /^\/api\/clients\/[^/]+\/simple-practice-id$/,
  /^\/api\/clients\/[^/]+\/upload-screener$/,
];

function isPublicApiPath(pathname: string): boolean {
  return publicApiPaths.some(pattern => pattern.test(pathname));
}

export default withAuth(
  function middleware(req) {
    // Add any additional middleware logic here
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Allow public API paths without auth
        if (isPublicApiPath(req.nextUrl.pathname)) {
          return true;
        }
        return !!token;
      },
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
