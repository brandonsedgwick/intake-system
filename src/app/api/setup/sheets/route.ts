import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { google } from "googleapis";

// Sheet configurations with headers
const SHEET_CONFIGS = {
  Clients: [
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
  ],
  Communications: [
    "id",
    "clientId",
    "timestamp",
    "direction",
    "type",
    "gmailMessageId",
    "gmailThreadId",
    "subject",
    "bodyPreview",
    "fullBody",
    "sentBy",
  ],
  Clinicians: [
    "id",
    "firstName",
    "lastName",
    "email",
    "calendarId",
    "simplePracticeId",
    "insurancePanels",
    "specialties",
    "newClientCapacity",
    "isAcceptingNew",
    "defaultSessionLength",
  ],
  Availability: [
    "id",
    "clinicianId",
    "dayOfWeek",
    "startTime",
    "endTime",
    "isRecurring",
    "specificDate",
    "isBooked",
    "bookedClientId",
  ],
  EmailTemplates: [
    "id",
    "name",
    "type",
    "subject",
    "body",
    "isActive",
    "updatedAt",
    "updatedBy",
  ],
  AuditLog: [
    "id",
    "timestamp",
    "userId",
    "userEmail",
    "action",
    "entityType",
    "entityId",
    "previousValue",
    "newValue",
    "ipAddress",
  ],
  EvaluationCriteria: [
    "id",
    "name",
    "type",
    "field",
    "operator",
    "value",
    "action",
    "weight",
    "isActive",
  ],
  Settings: ["key", "value", "updatedAt", "updatedBy"],
  IntakeFields: [
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
  ],
  ReferralClinics: [
    "id",
    "practiceName",
    "address",
    "phone",
    "email",
    "specialties",
    "notes",
    "customFields",
    "isActive",
    "createdAt",
    "updatedAt",
  ],
  ReferralClinicsConfig: ["key", "value"],
};

// Default email templates
const DEFAULT_TEMPLATES = [
  {
    id: crypto.randomUUID(),
    name: "Initial Outreach",
    type: "initial_outreach",
    subject: "Appointment Availability at {{practiceName}}",
    body: `Dear {{clientFirstName}},

Thank you for reaching out to {{practiceName}}. We received your intake form and would love to help you get started with therapy.

Based on your preferences, {{clinicianName}} has the following availability:

{{availabilitySlots}}

Please let us know which time works best for you, or if you'd like to see additional options.

We look forward to hearing from you.

Warm regards,
{{practiceName}} Intake Team`,
    isActive: "true",
    updatedAt: new Date().toISOString(),
    updatedBy: "system",
  },
  {
    id: crypto.randomUUID(),
    name: "Follow-Up 1",
    type: "follow_up_1",
    subject: "Following Up - Appointment at {{practiceName}}",
    body: `Dear {{clientFirstName}},

We wanted to follow up on our previous message regarding scheduling your first appointment at {{practiceName}}.

We still have availability with {{clinicianName}} if you're interested in moving forward:

{{availabilitySlots}}

Please let us know if you have any questions or if there's anything else we can help with.

Best regards,
{{practiceName}} Intake Team`,
    isActive: "true",
    updatedAt: new Date().toISOString(),
    updatedBy: "system",
  },
  {
    id: crypto.randomUUID(),
    name: "Follow-Up 2",
    type: "follow_up_2",
    subject: "One More Check-In - {{practiceName}}",
    body: `Dear {{clientFirstName}},

We're reaching out one more time to see if you're still interested in scheduling an appointment at {{practiceName}}.

If your needs have changed or you've found care elsewhere, no worries at all - we just wanted to make sure you have the support you need.

If you'd still like to schedule, please reply to this email and we'll be happy to assist.

Take care,
{{practiceName}} Intake Team`,
    isActive: "true",
    updatedAt: new Date().toISOString(),
    updatedBy: "system",
  },
  {
    id: crypto.randomUUID(),
    name: "Referral - Insurance",
    type: "referral_insurance",
    subject: "Resources for Therapy Services",
    body: `Dear {{clientFirstName}},

Thank you for reaching out to {{practiceName}}. Unfortunately, we are not currently in-network with {{insuranceProvider}}.

Here are some resources that may help you find a provider who accepts your insurance:

- Psychology Today: https://www.psychologytoday.com
- Your insurance provider's website
- Open Path Collective (sliding scale): https://openpathcollective.org

We're sorry we couldn't be of more help, and we wish you the best in your search for care.

Warm regards,
{{practiceName}} Intake Team`,
    isActive: "true",
    updatedAt: new Date().toISOString(),
    updatedBy: "system",
  },
];

// Default settings
const DEFAULT_SETTINGS = [
  {
    key: "followUp1Days",
    value: "3",
    updatedAt: new Date().toISOString(),
    updatedBy: "system",
  },
  {
    key: "followUp2Days",
    value: "5",
    updatedAt: new Date().toISOString(),
    updatedBy: "system",
  },
  {
    key: "autoCloseDays",
    value: "7",
    updatedAt: new Date().toISOString(),
    updatedBy: "system",
  },
  {
    key: "practiceName",
    value: "Therapy Practice",
    updatedAt: new Date().toISOString(),
    updatedBy: "system",
  },
  {
    key: "practiceEmail",
    value: "intake@therapypractice.com",
    updatedAt: new Date().toISOString(),
    updatedBy: "system",
  },
];

// POST /api/setup/sheets - Initialize all sheets with headers
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

    // Get existing sheets
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheets =
      spreadsheet.data.sheets?.map((s) => s.properties?.title) || [];

    const results: Record<string, string> = {};

    // Create or update each sheet
    for (const [sheetName, headers] of Object.entries(SHEET_CONFIGS)) {
      try {
        if (!existingSheets.includes(sheetName)) {
          // Create the sheet
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
              requests: [
                {
                  addSheet: {
                    properties: { title: sheetName },
                  },
                },
              ],
            },
          });
          results[sheetName] = "created";
        }

        // Check if headers exist
        const headerCheck = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A1:Z1`,
        });

        if (!headerCheck.data.values || headerCheck.data.values.length === 0) {
          // Add headers
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: "RAW",
            requestBody: { values: [headers] },
          });
          results[sheetName] = results[sheetName] === "created" ? "created with headers" : "headers added";
        } else {
          results[sheetName] = results[sheetName] || "already exists";
        }
      } catch (sheetError) {
        console.error(`Error setting up ${sheetName}:`, sheetError);
        results[sheetName] = "error";
      }
    }

    // Add default email templates if EmailTemplates is empty
    const templatesCheck = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "EmailTemplates!A2:A",
    });

    if (!templatesCheck.data.values || templatesCheck.data.values.length === 0) {
      const templateRows = DEFAULT_TEMPLATES.map((t) => [
        t.id,
        t.name,
        t.type,
        t.subject,
        t.body,
        t.isActive,
        t.updatedAt,
        t.updatedBy,
      ]);

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "EmailTemplates!A:H",
        valueInputOption: "RAW",
        requestBody: { values: templateRows },
      });
      results["EmailTemplates"] += " + default templates added";
    }

    // Add default settings if Settings is empty
    const settingsCheck = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Settings!A2:A",
    });

    if (!settingsCheck.data.values || settingsCheck.data.values.length === 0) {
      const settingsRows = DEFAULT_SETTINGS.map((s) => [
        s.key,
        s.value,
        s.updatedAt,
        s.updatedBy,
      ]);

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Settings!A:D",
        valueInputOption: "RAW",
        requestBody: { values: settingsRows },
      });
      results["Settings"] += " + default settings added";
    }

    return NextResponse.json({
      message: "Sheets setup complete",
      results,
    });
  } catch (error) {
    console.error("Error setting up sheets:", error);
    return NextResponse.json(
      { error: "Failed to set up sheets", details: String(error) },
      { status: 500 }
    );
  }
}

// GET /api/setup/sheets - Check current sheet status
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

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheets =
      spreadsheet.data.sheets?.map((s) => ({
        name: s.properties?.title,
        rowCount: s.properties?.gridProperties?.rowCount,
      })) || [];

    const requiredSheets = Object.keys(SHEET_CONFIGS);
    const missingSheets = requiredSheets.filter(
      (name) => !existingSheets.find((s) => s.name === name)
    );

    return NextResponse.json({
      spreadsheetId,
      existingSheets,
      requiredSheets,
      missingSheets,
      isComplete: missingSheets.length === 0,
    });
  } catch (error) {
    console.error("Error checking sheets:", error);
    return NextResponse.json(
      { error: "Failed to check sheets", details: String(error) },
      { status: 500 }
    );
  }
}
