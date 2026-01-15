import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { google } from "googleapis";
import { Client } from "@/types/client";

// Copy of the pattern matching logic from sync route for debugging
const FORM_FIELD_PATTERNS: Array<{ patterns: string[]; clientField: keyof Client }> = [
  { patterns: ["timestamp"], clientField: "formTimestamp" },
  { patterns: ["first name", "firstname"], clientField: "firstName" },
  { patterns: ["last name", "lastname"], clientField: "lastName" },
  { patterns: ["email", "e-mail"], clientField: "email" },
  { patterns: ["phone", "telephone", "mobile"], clientField: "phone" },
  { patterns: ["age"], clientField: "age" },
  { patterns: ["payment", "payment type"], clientField: "paymentType" },
  { patterns: ["preferred therapist", "therapist", "clinician"], clientField: "requestedClinician" },
  { patterns: ["address in therapy", "presenting", "concerns"], clientField: "presentingConcerns" },
  { patterns: ["suicide", "attempted suicide"], clientField: "suicideAttemptRecent" },
  { patterns: ["hospitalized", "psychiatric", "hospital"], clientField: "psychiatricHospitalization" },
  { patterns: ["else", "additional", "share"], clientField: "additionalInfo" },
];

function matchHeaderToField(header: string): keyof Client | null {
  const headerLower = header.toLowerCase().trim();
  for (const { patterns, clientField } of FORM_FIELD_PATTERNS) {
    for (const pattern of patterns) {
      if (headerLower.includes(pattern)) {
        return clientField;
      }
    }
  }
  return null;
}

// GET /api/debug/sheets - Debug endpoint to see sheet data
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

    // Get Form Responses sheet
    let formResponsesData = null;
    try {
      const formResponses = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "'Form Responses 1'!A1:Z5", // First 5 rows for debugging
      });
      const headers = formResponses.data.values?.[0] || [];

      // Show what each header maps to
      const headerMapping: Record<string, string | null> = {};
      headers.forEach((header: string, index: number) => {
        headerMapping[`col${index}_${header}`] = matchHeaderToField(header);
      });

      formResponsesData = {
        headers: headers,
        headerMapping: headerMapping,
        rows: formResponses.data.values?.slice(1) || [],
        totalRows: formResponses.data.values?.length || 0,
      };
    } catch (e) {
      formResponsesData = { error: String(e) };
    }

    // Get Clients sheet
    let clientsData = null;
    try {
      const clients = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Clients!A1:Z10", // First 10 rows for debugging
      });

      const headers = clients.data.values?.[0] || [];
      const rows = clients.data.values?.slice(1) || [];

      // Parse each row using headers to show what the API would return
      const parsedClients = rows.map((row: string[], index: number) => {
        const parsed: Record<string, string> = {};
        headers.forEach((header: string, colIndex: number) => {
          parsed[header] = row[colIndex] || "(empty)";
        });
        return {
          rowNumber: index + 2,
          rawRow: row.slice(0, 15), // First 15 columns
          parsed: {
            id: parsed.id,
            formResponseId: parsed.formResponseId,
            formTimestamp: parsed.formTimestamp,
            firstName: parsed.firstName,
            lastName: parsed.lastName,
            email: parsed.email,
          }
        };
      });

      clientsData = {
        headers: headers,
        headerCount: headers.length,
        expectedHeaders: [
          "id", "createdAt", "updatedAt", "status", "source",
          "formResponseId", "formTimestamp", "firstName", "lastName", "email"
        ],
        rows: rows.map((r: string[]) => r.slice(0, 15)),
        parsedClients: parsedClients,
        totalRows: clients.data.values?.length || 0,
      };
    } catch (e) {
      clientsData = { error: String(e) };
    }

    return NextResponse.json({
      formResponses: formResponsesData,
      clients: clientsData,
    });
  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json(
      { error: "Debug failed", details: String(error) },
      { status: 500 }
    );
  }
}
