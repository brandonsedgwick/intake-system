import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { google } from "googleapis";

export interface IntakeField {
  id: string;
  name: string;
  label: string;
  type: "text" | "email" | "phone" | "date" | "select" | "multiselect" | "textarea" | "checkbox";
  required: boolean;
  options?: string[]; // For select/multiselect
  mappedColumn: string; // Column in Clients sheet
  formFieldName?: string; // Field name in Google Form (for mapping)
  order: number;
  isActive: boolean;
}

// Default intake fields that map to the Clients sheet
const DEFAULT_INTAKE_FIELDS: IntakeField[] = [
  {
    id: "firstName",
    name: "firstName",
    label: "First Name",
    type: "text",
    required: true,
    mappedColumn: "firstName",
    order: 1,
    isActive: true,
  },
  {
    id: "lastName",
    name: "lastName",
    label: "Last Name",
    type: "text",
    required: true,
    mappedColumn: "lastName",
    order: 2,
    isActive: true,
  },
  {
    id: "email",
    name: "email",
    label: "Email Address",
    type: "email",
    required: true,
    mappedColumn: "email",
    order: 3,
    isActive: true,
  },
  {
    id: "phone",
    name: "phone",
    label: "Phone Number",
    type: "phone",
    required: false,
    mappedColumn: "phone",
    order: 4,
    isActive: true,
  },
  {
    id: "dateOfBirth",
    name: "dateOfBirth",
    label: "Date of Birth",
    type: "date",
    required: false,
    mappedColumn: "dateOfBirth",
    order: 5,
    isActive: true,
  },
  {
    id: "insuranceProvider",
    name: "insuranceProvider",
    label: "Insurance Provider",
    type: "text",
    required: false,
    mappedColumn: "insuranceProvider",
    order: 6,
    isActive: true,
  },
  {
    id: "insuranceMemberId",
    name: "insuranceMemberId",
    label: "Insurance Member ID",
    type: "text",
    required: false,
    mappedColumn: "insuranceMemberId",
    order: 7,
    isActive: true,
  },
  {
    id: "preferredTimes",
    name: "preferredTimes",
    label: "Preferred Appointment Times",
    type: "multiselect",
    required: false,
    options: ["Mornings", "Afternoons", "Evenings", "Weekends"],
    mappedColumn: "preferredTimes",
    order: 8,
    isActive: true,
  },
  {
    id: "presentingConcerns",
    name: "presentingConcerns",
    label: "What brings you to therapy?",
    type: "textarea",
    required: false,
    mappedColumn: "presentingConcerns",
    order: 9,
    isActive: true,
  },
];

// GET /api/settings/intake-fields - Get intake field configuration
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
        range: "IntakeFields!A:K",
      });

      const rows = response.data.values || [];
      if (rows.length < 2) {
        // Return default fields if none configured
        return NextResponse.json(DEFAULT_INTAKE_FIELDS);
      }

      const headers = rows[0];
      const fields: IntakeField[] = rows.slice(1).map((row) => {
        const field: Record<string, unknown> = {};
        headers.forEach((header, index) => {
          let value: unknown = row[index] || "";

          // Parse JSON fields
          if (header === "options" && value) {
            try {
              value = JSON.parse(value as string);
            } catch {
              value = [];
            }
          }

          // Parse boolean fields
          if (header === "required" || header === "isActive") {
            value = value === "true";
          }

          // Parse number fields
          if (header === "order") {
            value = parseInt(value as string) || 0;
          }

          field[header] = value;
        });
        return field as unknown as IntakeField;
      });

      return NextResponse.json(fields);
    } catch {
      // IntakeFields sheet might not exist yet
      return NextResponse.json(DEFAULT_INTAKE_FIELDS);
    }
  } catch (error) {
    console.error("Error fetching intake fields:", error);
    return NextResponse.json(
      { error: "Failed to fetch intake fields" },
      { status: 500 }
    );
  }
}

// POST /api/settings/intake-fields - Save intake field configuration
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fields: IntakeField[] = await request.json();

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    // Check if IntakeFields sheet exists
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheets = spreadsheet.data.sheets?.map((s) => s.properties?.title) || [];

    if (!existingSheets.includes("IntakeFields")) {
      // Create the sheet
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: { title: "IntakeFields" },
              },
            },
          ],
        },
      });
    }

    // Clear existing data and write new
    const headers = [
      "id",
      "name",
      "label",
      "type",
      "required",
      "options",
      "mappedColumn",
      "formFieldName",
      "order",
      "isActive",
    ];

    const rows = [
      headers,
      ...fields.map((field) => [
        field.id,
        field.name,
        field.label,
        field.type,
        field.required ? "true" : "false",
        field.options ? JSON.stringify(field.options) : "",
        field.mappedColumn,
        field.formFieldName || "",
        field.order.toString(),
        field.isActive ? "true" : "false",
      ]),
    ];

    // Clear and update
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: "IntakeFields!A:K",
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "IntakeFields!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: rows },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving intake fields:", error);
    return NextResponse.json(
      { error: "Failed to save intake fields" },
      { status: 500 }
    );
  }
}
