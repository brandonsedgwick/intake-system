import { google, sheets_v4 } from "googleapis";
import { Client } from "@/types/client";

// Sheet names - Only Clients remain in Google Sheets
const SHEETS = {
  CLIENTS: "Clients",
} as const;

// Initialize the Sheets API client
function getGoogleSheetsClient(accessToken: string): sheets_v4.Sheets {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  return google.sheets({ version: "v4", auth });
}

// Maximum column range to support all fields (A-AZ = 52 columns)
const MAX_COLUMN = "AZ";

// Generic function to get all rows from a sheet
async function getSheetData(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string
): Promise<string[][]> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:${MAX_COLUMN}`,
  });

  return response.data.values || [];
}

// Generic function to append a row to a sheet
async function appendRow(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
  values: (string | number | boolean | null)[]
): Promise<void> {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:${MAX_COLUMN}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [values.map((v) => (v === null ? "" : String(v)))],
    },
  });
}

// Generic function to update a specific row
async function updateRow(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number,
  values: (string | number | boolean | null)[]
): Promise<void> {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A${rowIndex}:${MAX_COLUMN}${rowIndex}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [values.map((v) => (v === null ? "" : String(v)))],
    },
  });
}

// Convert row data to Client object
function rowToClient(headers: string[], row: string[]): Client {
  const data: Record<string, string> = {};
  headers.forEach((header, index) => {
    data[header] = row[index] || "";
  });

  return {
    id: data.id,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    status: data.status as Client["status"],
    source: data.source as Client["source"],
    formResponseId: data.formResponseId || undefined,
    formTimestamp: data.formTimestamp || undefined,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone || undefined,
    age: data.age || undefined,
    paymentType: data.paymentType || undefined,
    insuranceProvider: data.insuranceProvider || undefined,
    insuranceMemberId: data.insuranceMemberId || undefined,
    requestedClinician: data.requestedClinician || undefined,
    assignedClinician: data.assignedClinician || undefined,
    presentingConcerns: data.presentingConcerns || undefined,
    suicideAttemptRecent: data.suicideAttemptRecent || undefined,
    psychiatricHospitalization: data.psychiatricHospitalization || undefined,
    additionalInfo: data.additionalInfo || undefined,
    evaluationScore: data.evaluationScore
      ? parseInt(data.evaluationScore)
      : undefined,
    evaluationNotes: data.evaluationNotes || undefined,
    referralReason: data.referralReason || undefined,
    isDuplicate: data.isDuplicate === "true",
    duplicateOfClientId: data.duplicateOfClientId || undefined,
    initialOutreachDate: data.initialOutreachDate || undefined,
    followUp1Date: data.followUp1Date || undefined,
    followUp2Date: data.followUp2Date || undefined,
    nextFollowUpDue: data.nextFollowUpDue || undefined,
    scheduledDate: data.scheduledDate || undefined,
    simplePracticeId: data.simplePracticeId || undefined,
    paperworkComplete: data.paperworkComplete === "true",
    closedDate: data.closedDate || undefined,
    closedReason: data.closedReason || undefined,
  };
}

// Convert Client object to row data
// Must match the column order in SHEET_CONFIGS.Clients from setup/sheets/route.ts
function clientToRow(client: Client): (string | null)[] {
  return [
    client.id,
    client.createdAt,
    client.updatedAt,
    client.status,
    client.source,
    client.formResponseId || null,
    client.formTimestamp || null,
    client.firstName,
    client.lastName,
    client.email,
    client.phone || null,
    client.age || null,
    client.paymentType || null,
    client.insuranceProvider || null,
    client.insuranceMemberId || null,
    client.requestedClinician || null,
    client.assignedClinician || null,
    client.presentingConcerns || null,
    client.suicideAttemptRecent || null,
    client.psychiatricHospitalization || null,
    client.additionalInfo || null,
    client.evaluationScore?.toString() || null,
    client.evaluationNotes || null,
    client.referralReason || null,
    client.isDuplicate ? "true" : "false",
    client.duplicateOfClientId || null,
    client.initialOutreachDate || null,
    client.followUp1Date || null,
    client.followUp2Date || null,
    client.nextFollowUpDue || null,
    client.scheduledDate || null,
    client.simplePracticeId || null,
    client.paperworkComplete ? "true" : "false",
    client.closedDate || null,
    client.closedReason || null,
  ];
}

// Client API - Only entity still stored in Google Sheets (for Google Forms integration)
export const clientsApi = {
  async getAll(accessToken: string): Promise<Client[]> {
    const sheets = getGoogleSheetsClient(accessToken);
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    const data = await getSheetData(sheets, spreadsheetId, SHEETS.CLIENTS);
    if (data.length < 2) return [];

    const headers = data[0];
    return data.slice(1).map((row) => rowToClient(headers, row));
  },

  async getById(accessToken: string, id: string): Promise<Client | null> {
    const clients = await this.getAll(accessToken);
    return clients.find((c) => c.id === id) || null;
  },

  async create(
    accessToken: string,
    client: Omit<Client, "id" | "createdAt" | "updatedAt">
  ): Promise<Client> {
    const sheets = getGoogleSheetsClient(accessToken);
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    const now = new Date().toISOString();
    const newClient: Client = {
      ...client,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    await appendRow(sheets, spreadsheetId, SHEETS.CLIENTS, clientToRow(newClient));

    return newClient;
  },

  async update(
    accessToken: string,
    id: string,
    updates: Partial<Client>
  ): Promise<Client | null> {
    const sheets = getGoogleSheetsClient(accessToken);
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    const data = await getSheetData(sheets, spreadsheetId, SHEETS.CLIENTS);
    if (data.length < 2) return null;

    const headers = data[0];
    const rowIndex = data.findIndex((row, i) => i > 0 && row[0] === id);

    if (rowIndex === -1) return null;

    const existingClient = rowToClient(headers, data[rowIndex]);
    const updatedClient: Client = {
      ...existingClient,
      ...updates,
      id: existingClient.id, // Prevent ID from being changed
      createdAt: existingClient.createdAt, // Prevent createdAt from being changed
      updatedAt: new Date().toISOString(),
    };

    await updateRow(
      sheets,
      spreadsheetId,
      SHEETS.CLIENTS,
      rowIndex + 1,
      clientToRow(updatedClient)
    );

    return updatedClient;
  },

  async getByStatus(accessToken: string, status: Client["status"]): Promise<Client[]> {
    const clients = await this.getAll(accessToken);
    return clients.filter((c) => c.status === status);
  },

  async getFollowUpsDue(accessToken: string): Promise<Client[]> {
    const clients = await this.getAll(accessToken);
    const today = new Date().toISOString().split("T")[0];

    return clients.filter((c) => {
      if (!c.nextFollowUpDue) return false;
      return (
        c.nextFollowUpDue <= today &&
        ["outreach_sent", "follow_up_1", "follow_up_2"].includes(c.status)
      );
    });
  },
};
