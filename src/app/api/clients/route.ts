import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { clientsApi, auditLogApi } from "@/lib/api/google-sheets";
import { Client } from "@/types/client";
import { google } from "googleapis";

// GET /api/clients - Get all clients or filter by status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as Client["status"] | null;
    const followUpsDue = searchParams.get("followUpsDue") === "true";

    let clients: Client[];

    if (followUpsDue) {
      clients = await clientsApi.getFollowUpsDue(session.accessToken);
    } else if (status) {
      clients = await clientsApi.getByStatus(session.accessToken, status);
    } else {
      clients = await clientsApi.getAll(session.accessToken);
    }

    return NextResponse.json(clients);
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}

// POST /api/clients - Create a new client
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.firstName || !body.lastName || !body.email) {
      return NextResponse.json(
        { error: "Missing required fields: firstName, lastName, email" },
        { status: 400 }
      );
    }

    const client = await clientsApi.create(session.accessToken, {
      status: body.status || "new",
      source: body.source || "manual",
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      age: body.age,
      paymentType: body.paymentType,
      insuranceProvider: body.insuranceProvider,
      insuranceMemberId: body.insuranceMemberId,
      preferredTimes: body.preferredTimes,
      requestedClinician: body.requestedClinician,
      presentingConcerns: body.presentingConcerns,
      suicideAttemptRecent: body.suicideAttemptRecent,
      psychiatricHospitalization: body.psychiatricHospitalization,
      additionalInfo: body.additionalInfo,
      paperworkComplete: false,
    });

    // Log the action
    await auditLogApi.log(session.accessToken, {
      userId: session.user?.email || "unknown",
      userEmail: session.user?.email || "unknown",
      action: "create",
      entityType: "client",
      entityId: client.id,
      newValue: JSON.stringify(client),
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    );
  }
}

// DELETE /api/clients - Clear all clients (for testing/reset purposes)
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    // Get spreadsheet to find the Clients sheet ID
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const clientsSheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === "Clients"
    );

    if (!clientsSheet?.properties?.sheetId) {
      return NextResponse.json(
        { error: "Clients sheet not found" },
        { status: 404 }
      );
    }

    const sheetId = clientsSheet.properties.sheetId;

    // Get current data to count rows
    const currentData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Clients!A:A",
    });

    const rowCount = currentData.data.values?.length || 0;
    const deletedCount = rowCount > 1 ? rowCount - 1 : 0;

    if (deletedCount > 0) {
      // Delete all data rows (keep header row 0, delete from row 1 onwards)
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: sheetId,
                  dimension: "ROWS",
                  startIndex: 1, // Start after header (0-indexed)
                  endIndex: rowCount, // Delete up to and including the last row
                },
              },
            },
          ],
        },
      });

      // Log the action
      await auditLogApi.log(session.accessToken, {
        userId: session.user?.email || "unknown",
        userEmail: session.user?.email || "unknown",
        action: "delete_all",
        entityType: "client",
        entityId: "all",
        previousValue: `${deletedCount} clients`,
        newValue: "0 clients",
      });
    }

    return NextResponse.json({
      message: `Cleared ${deletedCount} client${deletedCount === 1 ? "" : "s"}`,
      deletedCount,
    });
  } catch (error) {
    console.error("Error clearing clients:", error);
    return NextResponse.json(
      { error: "Failed to clear clients" },
      { status: 500 }
    );
  }
}
