import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { google } from "googleapis";
import { clientsDbApi } from "@/lib/api/prisma-db";
import { Client } from "@/types/client";

// Form field to Client field mapping
// Maps Google Form column headers to our Client properties
// Uses case-insensitive partial matching to handle variations
const FORM_FIELD_PATTERNS: Array<{ patterns: string[]; clientField: keyof Client }> = [
  { patterns: ["timestamp"], clientField: "formTimestamp" },
  { patterns: ["first name", "firstname", "first"], clientField: "firstName" },
  { patterns: ["last name", "lastname", "last"], clientField: "lastName" },
  { patterns: ["email", "e-mail"], clientField: "email" },
  { patterns: ["phone", "telephone", "mobile"], clientField: "phone" },
  { patterns: ["age"], clientField: "age" },
  { patterns: ["payment", "payment type", "pay"], clientField: "paymentType" },
  { patterns: ["preferred therapist", "therapist", "clinician"], clientField: "requestedClinician" },
  { patterns: ["address in therapy", "presenting", "concerns", "what would you like"], clientField: "presentingConcerns" },
  { patterns: ["suicide", "attempted suicide"], clientField: "suicideAttemptRecent" },
  { patterns: ["hospitalized", "psychiatric", "hospital"], clientField: "psychiatricHospitalization" },
  { patterns: ["else", "additional", "share", "other"], clientField: "additionalInfo" },
];

// Match a header to a client field using fuzzy matching
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

// The sheet name containing form responses
const FORM_RESPONSES_SHEET = "Form Responses 1";

interface SyncResult {
  newClients: number;
  duplicates: number;
  errors: string[];
  syncedIds: string[];
}

// GET /api/sync/form-responses - Get sync status
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken || !session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    // Get form responses from Google Sheets
    let formResponsesCount = 0;
    let formTimestamps: string[] = [];
    try {
      const formResponses = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${FORM_RESPONSES_SHEET}'!A:Z`,
      });
      const rows = formResponses.data.values || [];
      if (rows.length > 1) {
        formResponsesCount = rows.length - 1;
        // Timestamp is always in column A for Google Forms
        formTimestamps = rows.slice(1)
          .map((row: string[]) => row[0]?.trim())
          .filter(Boolean);
      }
    } catch {
      // Sheet might not exist
    }

    // Get existing clients from SQLite to check what's already synced
    const existingClients = await clientsDbApi.getAll();
    const clientsCount = existingClients.length;
    const existingTimestamps = new Set<string>(
      existingClients
        .filter((c) => c.formTimestamp)
        .map((c) => c.formTimestamp!)
    );

    // Count how many form responses are NOT yet synced (by timestamp - the unique identifier)
    let pendingSync = 0;
    for (const timestamp of formTimestamps) {
      if (!existingTimestamps.has(timestamp)) {
        pendingSync++;
      }
    }

    return NextResponse.json({
      formResponsesCount,
      clientsCount,
      syncedCount: clientsCount,
      pendingSync,
      lastSyncCheck: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error checking sync status:", error);
    return NextResponse.json(
      { error: "Failed to check sync status" },
      { status: 500 }
    );
  }
}

// POST /api/sync/form-responses - Sync new form responses to clients
export async function POST() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken || !session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    const result: SyncResult = {
      newClients: 0,
      duplicates: 0,
      errors: [],
      syncedIds: [],
    };

    // Get form responses from Google Sheets
    let formResponses: string[][];
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${FORM_RESPONSES_SHEET}'!A:Z`,
      });
      formResponses = response.data.values || [];
    } catch {
      return NextResponse.json(
        { error: `Form responses sheet "${FORM_RESPONSES_SHEET}" not found` },
        { status: 404 }
      );
    }

    if (formResponses.length < 2) {
      return NextResponse.json({
        ...result,
        message: "No form responses to sync",
      });
    }

    const formHeaders = formResponses[0];
    const formDataRows = formResponses.slice(1);

    // Build header mapping - which form column maps to which client field
    const headerMapping: Map<number, keyof Client> = new Map();
    formHeaders.forEach((header, index) => {
      const clientField = matchHeaderToField(header);
      if (clientField) {
        headerMapping.set(index, clientField);
      }
    });

    // Log the mapping for debugging
    console.log("Header mapping:", Object.fromEntries(headerMapping));

    // Get existing clients from SQLite to check for already synced entries
    const existingClients = await clientsDbApi.getAll();
    const existingTimestamps = new Set<string>(
      existingClients
        .filter((c) => c.formTimestamp)
        .map((c) => c.formTimestamp!)
    );

    // Process each form response
    for (let rowIndex = 0; rowIndex < formDataRows.length; rowIndex++) {
      const formRow = formDataRows[rowIndex];

      // Google Forms ALWAYS puts timestamp in column A - this is our unique identifier
      const formTimestamp = formRow[0]?.trim();

      if (!formTimestamp) {
        result.errors.push(`Row ${rowIndex + 2}: Missing timestamp`);
        continue;
      }

      // Skip if this timestamp already exists in Clients - already synced
      if (existingTimestamps.has(formTimestamp)) {
        continue;
      }

      // Map form fields to client fields using our header mapping
      const clientData: Partial<Client> = {
        status: "new",
        source: "google_form",
        formResponseId: `row-${rowIndex + 2}`,
      };

      // Map each form column to client field using the header mapping
      headerMapping.forEach((clientField, colIndex) => {
        const value = formRow[colIndex]?.trim();
        if (value) {
          (clientData as Record<string, unknown>)[clientField] = value;
        }
      });

      // Validate required fields
      if (!clientData.firstName || !clientData.lastName || !clientData.email) {
        result.errors.push(
          `Row ${rowIndex + 2}: Missing required fields (firstName: ${clientData.firstName || 'missing'}, lastName: ${clientData.lastName || 'missing'}, email: ${clientData.email || 'missing'})`
        );
        continue;
      }

      // Create the client in SQLite
      try {
        await clientsDbApi.create({
          status: clientData.status as Client["status"],
          source: clientData.source as Client["source"],
          formResponseId: clientData.formResponseId,
          formTimestamp: clientData.formTimestamp,
          firstName: clientData.firstName,
          lastName: clientData.lastName,
          email: clientData.email,
          phone: clientData.phone,
          age: clientData.age,
          paymentType: clientData.paymentType,
          requestedClinician: clientData.requestedClinician,
          presentingConcerns: clientData.presentingConcerns,
          suicideAttemptRecent: clientData.suicideAttemptRecent,
          psychiatricHospitalization: clientData.psychiatricHospitalization,
          additionalInfo: clientData.additionalInfo,
        });

        result.newClients++;
        existingTimestamps.add(formTimestamp);
        result.syncedIds.push(formTimestamp);
      } catch (err) {
        result.errors.push(`Row ${rowIndex + 2}: Failed to create client - ${err}`);
      }
    }

    return NextResponse.json({
      ...result,
      message: result.newClients > 0
        ? `Synced ${result.newClients} new client${result.newClients === 1 ? "" : "s"}`
        : "All form responses already synced",
    });
  } catch (error) {
    console.error("Error syncing form responses:", error);
    return NextResponse.json(
      { error: "Failed to sync form responses", details: String(error) },
      { status: 500 }
    );
  }
}
