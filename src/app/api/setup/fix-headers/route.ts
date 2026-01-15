import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { google } from "googleapis";

// The correct headers for the Clients sheet
const CORRECT_CLIENTS_HEADERS = [
  "id",
  "createdAt",
  "updatedAt",
  "status",
  "source",
  "formResponseId",
  "formTimestamp",
  "firstName",
  "lastName",
  "email",
  "phone",
  "age",
  "paymentType",
  "insuranceProvider",
  "insuranceMemberId",
  "requestedClinician",
  "assignedClinician",
  "presentingConcerns",
  "suicideAttemptRecent",
  "psychiatricHospitalization",
  "additionalInfo",
  "evaluationScore",
  "evaluationNotes",
  "referralReason",
  "isDuplicate",
  "duplicateOfClientId",
  "initialOutreachDate",
  "followUp1Date",
  "followUp2Date",
  "nextFollowUpDue",
  "scheduledDate",
  "simplePracticeId",
  "paperworkComplete",
  "closedDate",
  "closedReason",
];

// POST /api/setup/fix-headers - Fix the Clients sheet headers
export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    // Get current headers
    const currentData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Clients!A1:AZ1",
    });
    const currentHeaders = currentData.data.values?.[0] || [];

    // Check if headers need fixing
    const headersMatch = CORRECT_CLIENTS_HEADERS.every(
      (header, index) => currentHeaders[index] === header
    );

    if (headersMatch) {
      return NextResponse.json({
        message: "Headers are already correct",
        currentHeaders,
      });
    }

    // Get the sheet ID for Clients
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
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

    // Check if there's data (more than just headers)
    const rowCount = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Clients!A:A",
    });
    const hasData = (rowCount.data.values?.length || 0) > 1;

    if (hasData) {
      // There's existing data - we need to clear it first since the columns don't match
      const dataRowCount = rowCount.data.values?.length || 1;

      // Delete all data rows
      if (dataRowCount > 1) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                deleteDimension: {
                  range: {
                    sheetId: sheetId,
                    dimension: "ROWS",
                    startIndex: 1,
                    endIndex: dataRowCount,
                  },
                },
              },
            ],
          },
        });
      }
    }

    // Update the header row with correct headers
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "Clients!A1",
      valueInputOption: "RAW",
      requestBody: {
        values: [CORRECT_CLIENTS_HEADERS],
      },
    });

    return NextResponse.json({
      message: "Headers fixed successfully. All existing client data was cleared because the column structure was incompatible.",
      previousHeaders: currentHeaders,
      newHeaders: CORRECT_CLIENTS_HEADERS,
      dataCleared: hasData,
    });
  } catch (error) {
    console.error("Error fixing headers:", error);
    return NextResponse.json(
      { error: "Failed to fix headers", details: String(error) },
      { status: 500 }
    );
  }
}

// GET /api/setup/fix-headers - Check if headers need fixing
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

    // Get current headers
    const currentData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Clients!A1:AZ1",
    });
    const currentHeaders = currentData.data.values?.[0] || [];

    // Find mismatches
    const mismatches: Array<{ index: number; current: string; expected: string }> = [];
    CORRECT_CLIENTS_HEADERS.forEach((expected, index) => {
      const current = currentHeaders[index] || "(missing)";
      if (current !== expected) {
        mismatches.push({ index, current, expected });
      }
    });

    return NextResponse.json({
      needsFix: mismatches.length > 0,
      currentHeaderCount: currentHeaders.length,
      expectedHeaderCount: CORRECT_CLIENTS_HEADERS.length,
      mismatches,
      currentHeaders,
      expectedHeaders: CORRECT_CLIENTS_HEADERS,
    });
  } catch (error) {
    console.error("Error checking headers:", error);
    return NextResponse.json(
      { error: "Failed to check headers", details: String(error) },
      { status: 500 }
    );
  }
}
