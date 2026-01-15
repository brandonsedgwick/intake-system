import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { google } from "googleapis";

// GET /api/activity - Get recent activity from audit log
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "AuditLog!A:J",
      });

      const rows = response.data.values || [];
      if (rows.length < 2) {
        return NextResponse.json([]);
      }

      const headers = rows[0];
      const activities = rows
        .slice(1)
        .map((row) => {
          const entry: Record<string, string> = {};
          headers.forEach((header, index) => {
            entry[header] = row[index] || "";
          });
          return {
            id: entry.id,
            timestamp: entry.timestamp,
            userId: entry.userId,
            userEmail: entry.userEmail,
            action: entry.action,
            entityType: entry.entityType,
            entityId: entry.entityId,
            previousValue: entry.previousValue || undefined,
            newValue: entry.newValue || undefined,
          };
        })
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
        .slice(0, 20); // Return last 20 activities

      return NextResponse.json(activities);
    } catch {
      // AuditLog sheet might not exist yet
      return NextResponse.json([]);
    }
  } catch (error) {
    console.error("Error fetching activity:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}
