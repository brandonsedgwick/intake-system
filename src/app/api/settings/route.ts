import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { google } from "googleapis";

// GET /api/settings - Get all settings
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
        range: "Settings!A:D",
      });

      const rows = response.data.values || [];
      if (rows.length < 2) {
        return NextResponse.json({});
      }

      // Convert rows to key-value object
      const settings: Record<string, string> = {};
      for (let i = 1; i < rows.length; i++) {
        const [key, value] = rows[i];
        if (key) {
          settings[key] = value || "";
        }
      }

      return NextResponse.json(settings);
    } catch (error) {
      // Settings sheet might not exist yet
      return NextResponse.json({});
    }
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

// PATCH /api/settings - Update settings
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    // Get existing settings
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Settings!A:D",
    });

    const rows = response.data.values || [];
    const now = new Date().toISOString();
    const updatedBy = session.user?.email || "unknown";

    // Update or add each setting
    for (const [key, value] of Object.entries(body)) {
      const rowIndex = rows.findIndex((row) => row[0] === key);

      if (rowIndex > 0) {
        // Update existing row
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `Settings!A${rowIndex + 1}:D${rowIndex + 1}`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[key, value, now, updatedBy]],
          },
        });
      } else {
        // Append new row
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: "Settings!A:D",
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[key, value, now, updatedBy]],
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
