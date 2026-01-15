import { Session, getServerSession } from "next-auth";
import { authOptions } from "./auth-options";

// Extend Session type to include accessToken
interface SessionWithToken extends Session {
  accessToken?: string;
}

// Admin emails are stored in environment variable as comma-separated list
// Example: ADMIN_EMAILS=admin@practice.com,owner@practice.com
function getAdminEmails(): string[] {
  const adminEmails = process.env.ADMIN_EMAILS || "";
  return adminEmails
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const adminEmails = getAdminEmails();
  // If no admin emails are configured, allow all authenticated users (development mode)
  if (adminEmails.length === 0) return true;
  return adminEmails.includes(email.toLowerCase());
}

type AdminCheckResult =
  | { isAdmin: true; session: SessionWithToken; error?: undefined }
  | { isAdmin: false; session: SessionWithToken | null; error: string };

export async function checkAdminAccess(): Promise<AdminCheckResult> {
  const session = await getServerSession(authOptions) as SessionWithToken | null;

  if (!session?.accessToken) {
    return { isAdmin: false, session: null, error: "Unauthorized" };
  }

  const email = session.user?.email;
  if (!isAdminEmail(email)) {
    return { isAdmin: false, session, error: "Admin access required" };
  }

  return { isAdmin: true, session };
}
