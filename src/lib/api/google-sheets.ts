import { google, sheets_v4 } from "googleapis";
import { Client, Clinician, Communication, EmailTemplate, EvaluationCriteria, TextEvaluationRule, ReferralClinic, ReferralClinicCustomField, ReferralClinicsConfig } from "@/types/client";

// Sheet names
const SHEETS = {
  CLIENTS: "Clients",
  COMMUNICATIONS: "Communications",
  CLINICIANS: "Clinicians",
  AVAILABILITY: "Availability",
  EMAIL_TEMPLATES: "EmailTemplates",
  AUDIT_LOG: "AuditLog",
  EVALUATION_CRITERIA: "EvaluationCriteria",
  TEXT_EVALUATION_RULES: "TextEvaluationRules",
  REFERRAL_CLINICS: "ReferralClinics",
  REFERRAL_CLINICS_CONFIG: "ReferralClinicsConfig",
  SETTINGS: "Settings",
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

// Client API
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

// Communications API
export const communicationsApi = {
  async getByClientId(
    accessToken: string,
    clientId: string
  ): Promise<Communication[]> {
    const sheets = getGoogleSheetsClient(accessToken);
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    const data = await getSheetData(sheets, spreadsheetId, SHEETS.COMMUNICATIONS);
    if (data.length < 2) return [];

    const headers = data[0];
    return data
      .slice(1)
      .filter((row) => row[1] === clientId) // clientId is in column B (index 1)
      .map((row) => {
        const comm: Record<string, string> = {};
        headers.forEach((header, index) => {
          comm[header] = row[index] || "";
        });
        return comm as unknown as Communication;
      })
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
  },

  async create(
    accessToken: string,
    communication: Omit<Communication, "id">
  ): Promise<Communication> {
    const sheets = getGoogleSheetsClient(accessToken);
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    const newComm: Communication = {
      ...communication,
      id: crypto.randomUUID(),
    };

    await appendRow(sheets, spreadsheetId, SHEETS.COMMUNICATIONS, [
      newComm.id,
      newComm.clientId,
      newComm.timestamp,
      newComm.direction,
      newComm.type,
      newComm.gmailMessageId || null,
      newComm.gmailThreadId || null,
      newComm.subject,
      newComm.bodyPreview,
      newComm.fullBody || null,
      newComm.sentBy || null,
    ]);

    return newComm;
  },
};

// Clinicians API
export const cliniciansApi = {
  async getAll(accessToken: string): Promise<Clinician[]> {
    const sheets = getGoogleSheetsClient(accessToken);
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    const data = await getSheetData(sheets, spreadsheetId, SHEETS.CLINICIANS);
    if (data.length < 2) return [];

    const headers = data[0];
    return data.slice(1).map((row) => {
      const clin: Record<string, string> = {};
      headers.forEach((header, index) => {
        clin[header] = row[index] || "";
      });

      return {
        id: clin.id,
        firstName: clin.firstName,
        lastName: clin.lastName,
        email: clin.email,
        calendarId: clin.calendarId || undefined,
        simplePracticeId: clin.simplePracticeId || undefined,
        insurancePanels: clin.insurancePanels
          ? JSON.parse(clin.insurancePanels)
          : [],
        specialties: clin.specialties ? JSON.parse(clin.specialties) : [],
        newClientCapacity: parseInt(clin.newClientCapacity) || 0,
        isAcceptingNew: clin.isAcceptingNew === "true",
        defaultSessionLength: parseInt(clin.defaultSessionLength) || 50,
      } as Clinician;
    });
  },

  async getById(accessToken: string, id: string): Promise<Clinician | null> {
    const clinicians = await this.getAll(accessToken);
    return clinicians.find((c) => c.id === id) || null;
  },

  async getAcceptingNew(accessToken: string): Promise<Clinician[]> {
    const clinicians = await this.getAll(accessToken);
    return clinicians.filter((c) => c.isAcceptingNew && c.newClientCapacity > 0);
  },

  async getByInsurance(
    accessToken: string,
    insuranceProvider: string
  ): Promise<Clinician[]> {
    const clinicians = await this.getAcceptingNew(accessToken);
    return clinicians.filter((c) =>
      c.insurancePanels.some(
        (panel) => panel.toLowerCase() === insuranceProvider.toLowerCase()
      )
    );
  },
};

// Email Templates API
export const templatesApi = {
  async getAll(accessToken: string): Promise<EmailTemplate[]> {
    const sheets = getGoogleSheetsClient(accessToken);
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    const data = await getSheetData(sheets, spreadsheetId, SHEETS.EMAIL_TEMPLATES);
    if (data.length < 2) return [];

    const headers = data[0];
    return data.slice(1).map((row) => {
      const template: Record<string, string> = {};
      headers.forEach((header, index) => {
        template[header] = row[index] || "";
      });

      return {
        id: template.id,
        name: template.name,
        type: template.type as EmailTemplate["type"],
        subject: template.subject,
        body: template.body,
        isActive: template.isActive === "true",
        updatedAt: template.updatedAt,
        updatedBy: template.updatedBy || undefined,
      } as EmailTemplate;
    });
  },

  async getByType(
    accessToken: string,
    type: EmailTemplate["type"]
  ): Promise<EmailTemplate | null> {
    const templates = await this.getAll(accessToken);
    return templates.find((t) => t.type === type && t.isActive) || null;
  },
};

// Audit Log API
export const auditLogApi = {
  async log(
    accessToken: string,
    entry: Omit<import("@/types/client").AuditLogEntry, "id" | "timestamp">
  ): Promise<void> {
    const sheets = getGoogleSheetsClient(accessToken);
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    await appendRow(sheets, spreadsheetId, SHEETS.AUDIT_LOG, [
      crypto.randomUUID(),
      new Date().toISOString(),
      entry.userId,
      entry.userEmail,
      entry.action,
      entry.entityType,
      entry.entityId,
      entry.previousValue || null,
      entry.newValue || null,
      entry.ipAddress || null,
    ]);
  },
};

// Evaluation Criteria API
export const evaluationCriteriaApi = {
  async getAll(accessToken: string): Promise<EvaluationCriteria[]> {
    const sheets = getGoogleSheetsClient(accessToken);
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    const data = await getSheetData(sheets, spreadsheetId, SHEETS.EVALUATION_CRITERIA);
    if (data.length < 2) return [];

    const headers = data[0];
    return data.slice(1).map((row) => {
      const criteria: Record<string, string> = {};
      headers.forEach((header, index) => {
        criteria[header] = row[index] || "";
      });

      return {
        id: criteria.id,
        name: criteria.name,
        description: criteria.description || undefined,
        field: criteria.field as keyof Client,
        operator: criteria.operator as EvaluationCriteria["operator"],
        value: criteria.value,
        action: criteria.action as EvaluationCriteria["action"],
        priority: parseInt(criteria.priority) || 0,
        isActive: criteria.isActive === "true",
        createdAt: criteria.createdAt,
        updatedAt: criteria.updatedAt,
      } as EvaluationCriteria;
    }).sort((a, b) => a.priority - b.priority);
  },

  async create(
    accessToken: string,
    criteria: Omit<EvaluationCriteria, "id" | "createdAt" | "updatedAt">
  ): Promise<EvaluationCriteria> {
    const sheets = getGoogleSheetsClient(accessToken);
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    const now = new Date().toISOString();
    const newCriteria: EvaluationCriteria = {
      ...criteria,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    await appendRow(sheets, spreadsheetId, SHEETS.EVALUATION_CRITERIA, [
      newCriteria.id,
      newCriteria.name,
      newCriteria.description || null,
      newCriteria.field,
      newCriteria.operator,
      newCriteria.value,
      newCriteria.action,
      newCriteria.priority.toString(),
      newCriteria.isActive ? "true" : "false",
      newCriteria.createdAt,
      newCriteria.updatedAt,
    ]);

    return newCriteria;
  },

  async update(
    accessToken: string,
    id: string,
    updates: Partial<EvaluationCriteria>
  ): Promise<EvaluationCriteria | null> {
    const sheets = getGoogleSheetsClient(accessToken);
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    const data = await getSheetData(sheets, spreadsheetId, SHEETS.EVALUATION_CRITERIA);
    if (data.length < 2) return null;

    const headers = data[0];
    const rowIndex = data.findIndex((row, i) => i > 0 && row[0] === id);

    if (rowIndex === -1) return null;

    const existing: Record<string, string> = {};
    headers.forEach((header, index) => {
      existing[header] = data[rowIndex][index] || "";
    });

    const existingCriteria: EvaluationCriteria = {
      id: existing.id,
      name: existing.name,
      description: existing.description || undefined,
      field: existing.field as keyof Client,
      operator: existing.operator as EvaluationCriteria["operator"],
      value: existing.value,
      action: existing.action as EvaluationCriteria["action"],
      priority: parseInt(existing.priority) || 0,
      isActive: existing.isActive === "true",
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    };

    const updatedCriteria: EvaluationCriteria = {
      ...existingCriteria,
      ...updates,
      id: existingCriteria.id,
      createdAt: existingCriteria.createdAt,
      updatedAt: new Date().toISOString(),
    };

    await updateRow(
      sheets,
      spreadsheetId,
      SHEETS.EVALUATION_CRITERIA,
      rowIndex + 1,
      [
        updatedCriteria.id,
        updatedCriteria.name,
        updatedCriteria.description || null,
        updatedCriteria.field,
        updatedCriteria.operator,
        updatedCriteria.value,
        updatedCriteria.action,
        updatedCriteria.priority.toString(),
        updatedCriteria.isActive ? "true" : "false",
        updatedCriteria.createdAt,
        updatedCriteria.updatedAt,
      ]
    );

    return updatedCriteria;
  },

  async delete(accessToken: string, id: string): Promise<boolean> {
    const sheets = getGoogleSheetsClient(accessToken);
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    const data = await getSheetData(sheets, spreadsheetId, SHEETS.EVALUATION_CRITERIA);
    if (data.length < 2) return false;

    const rowIndex = data.findIndex((row, i) => i > 0 && row[0] === id);
    if (rowIndex === -1) return false;

    // Get the sheet ID for batch update
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === SHEETS.EVALUATION_CRITERIA
    );

    if (!sheet?.properties?.sheetId) return false;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheet.properties.sheetId,
                dimension: "ROWS",
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });

    return true;
  },

  async getActive(accessToken: string): Promise<EvaluationCriteria[]> {
    const all = await this.getAll(accessToken);
    return all.filter((c) => c.isActive);
  },
};

// Settings API
export const settingsApi = {
  async getAll(accessToken: string): Promise<Record<string, string>> {
    const sheets = getGoogleSheetsClient(accessToken);
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    try {
      const data = await getSheetData(sheets, spreadsheetId, SHEETS.SETTINGS);
      if (data.length < 2) return {};

      // Convert rows to key-value object
      const settings: Record<string, string> = {};
      for (let i = 1; i < data.length; i++) {
        const [key, value] = data[i];
        if (key) {
          settings[key] = value || "";
        }
      }

      return settings;
    } catch {
      // Settings sheet might not exist yet
      return {};
    }
  },

  async get(accessToken: string, key: string): Promise<string | undefined> {
    const settings = await this.getAll(accessToken);
    return settings[key];
  },

  async getLLMSettings(accessToken: string): Promise<{
    textEvaluationLLMEnabled?: string;
    textEvaluationLLMThreshold?: string;
    googleCloudProject?: string;
    vertexAILocation?: string;
  }> {
    const settings = await this.getAll(accessToken);
    return {
      textEvaluationLLMEnabled: settings.textEvaluationLLMEnabled,
      textEvaluationLLMThreshold: settings.textEvaluationLLMThreshold,
      googleCloudProject: settings.googleCloudProject,
      vertexAILocation: settings.vertexAILocation,
    };
  },
};

// Text Evaluation Rules API
export const textEvaluationRulesApi = {
  async getAll(accessToken: string): Promise<TextEvaluationRule[]> {
    const sheets = getGoogleSheetsClient(accessToken);
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    try {
      const data = await getSheetData(sheets, spreadsheetId, SHEETS.TEXT_EVALUATION_RULES);
      if (data.length < 2) return [];

      const headers = data[0];
      return data.slice(1).map((row) => {
        const rule: Record<string, string> = {};
        headers.forEach((header, index) => {
          rule[header] = row[index] || "";
        });

        return {
          id: rule.id,
          name: rule.name,
          category: rule.category as TextEvaluationRule["category"],
          severity: rule.severity as TextEvaluationRule["severity"],
          patterns: rule.patterns ? JSON.parse(rule.patterns) : [],
          isRegex: rule.isRegex === "true",
          negationWords: rule.negationWords ? JSON.parse(rule.negationWords) : [],
          negationWindow: parseInt(rule.negationWindow) || 5,
          requiresLLM: rule.requiresLLM === "true",
          isActive: rule.isActive === "true",
          createdAt: rule.createdAt,
          updatedAt: rule.updatedAt,
        } as TextEvaluationRule;
      });
    } catch {
      // Sheet might not exist yet
      return [];
    }
  },

  async getActive(accessToken: string): Promise<TextEvaluationRule[]> {
    const all = await this.getAll(accessToken);
    return all.filter((r) => r.isActive);
  },

  async create(
    accessToken: string,
    rule: Omit<TextEvaluationRule, "id" | "createdAt" | "updatedAt">
  ): Promise<TextEvaluationRule> {
    const sheets = getGoogleSheetsClient(accessToken);
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    const now = new Date().toISOString();
    const newRule: TextEvaluationRule = {
      ...rule,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    await appendRow(sheets, spreadsheetId, SHEETS.TEXT_EVALUATION_RULES, [
      newRule.id,
      newRule.name,
      newRule.category,
      newRule.severity,
      JSON.stringify(newRule.patterns),
      newRule.isRegex ? "true" : "false",
      JSON.stringify(newRule.negationWords),
      newRule.negationWindow.toString(),
      newRule.requiresLLM ? "true" : "false",
      newRule.isActive ? "true" : "false",
      newRule.createdAt,
      newRule.updatedAt,
    ]);

    return newRule;
  },

  async update(
    accessToken: string,
    id: string,
    updates: Partial<TextEvaluationRule>
  ): Promise<TextEvaluationRule | null> {
    const sheets = getGoogleSheetsClient(accessToken);
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    const data = await getSheetData(sheets, spreadsheetId, SHEETS.TEXT_EVALUATION_RULES);
    if (data.length < 2) return null;

    const headers = data[0];
    const rowIndex = data.findIndex((row, i) => i > 0 && row[0] === id);

    if (rowIndex === -1) return null;

    const existing: Record<string, string> = {};
    headers.forEach((header, index) => {
      existing[header] = data[rowIndex][index] || "";
    });

    const existingRule: TextEvaluationRule = {
      id: existing.id,
      name: existing.name,
      category: existing.category as TextEvaluationRule["category"],
      severity: existing.severity as TextEvaluationRule["severity"],
      patterns: existing.patterns ? JSON.parse(existing.patterns) : [],
      isRegex: existing.isRegex === "true",
      negationWords: existing.negationWords ? JSON.parse(existing.negationWords) : [],
      negationWindow: parseInt(existing.negationWindow) || 5,
      requiresLLM: existing.requiresLLM === "true",
      isActive: existing.isActive === "true",
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    };

    const updatedRule: TextEvaluationRule = {
      ...existingRule,
      ...updates,
      id: existingRule.id,
      createdAt: existingRule.createdAt,
      updatedAt: new Date().toISOString(),
    };

    await updateRow(
      sheets,
      spreadsheetId,
      SHEETS.TEXT_EVALUATION_RULES,
      rowIndex + 1,
      [
        updatedRule.id,
        updatedRule.name,
        updatedRule.category,
        updatedRule.severity,
        JSON.stringify(updatedRule.patterns),
        updatedRule.isRegex ? "true" : "false",
        JSON.stringify(updatedRule.negationWords),
        updatedRule.negationWindow.toString(),
        updatedRule.requiresLLM ? "true" : "false",
        updatedRule.isActive ? "true" : "false",
        updatedRule.createdAt,
        updatedRule.updatedAt,
      ]
    );

    return updatedRule;
  },

  async delete(accessToken: string, id: string): Promise<boolean> {
    const sheets = getGoogleSheetsClient(accessToken);
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    const data = await getSheetData(sheets, spreadsheetId, SHEETS.TEXT_EVALUATION_RULES);
    if (data.length < 2) return false;

    const rowIndex = data.findIndex((row, i) => i > 0 && row[0] === id);
    if (rowIndex === -1) return false;

    // Get the sheet ID for batch update
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === SHEETS.TEXT_EVALUATION_RULES
    );

    if (!sheet?.properties?.sheetId) return false;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheet.properties.sheetId,
                dimension: "ROWS",
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });

    return true;
  },
};

// Referral Clinics API
export const referralClinicsApi = {
  async getAll(accessToken: string): Promise<ReferralClinic[]> {
    const sheets = getGoogleSheetsClient(accessToken);
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    try {
      const data = await getSheetData(sheets, spreadsheetId, SHEETS.REFERRAL_CLINICS);
      if (data.length < 2) return [];

      const headers = data[0];
      return data.slice(1).map((row) => {
        const clinic: Record<string, string> = {};
        headers.forEach((header, index) => {
          clinic[header] = row[index] || "";
        });

        return {
          id: clinic.id,
          practiceName: clinic.practiceName,
          address: clinic.address || undefined,
          phone: clinic.phone || undefined,
          email: clinic.email || undefined,
          specialties: clinic.specialties ? JSON.parse(clinic.specialties) : [],
          notes: clinic.notes || undefined,
          customFields: clinic.customFields ? JSON.parse(clinic.customFields) : undefined,
          isActive: clinic.isActive === "true",
          createdAt: clinic.createdAt,
          updatedAt: clinic.updatedAt,
        } as ReferralClinic;
      });
    } catch {
      // Sheet might not exist yet
      return [];
    }
  },

  async getActive(accessToken: string): Promise<ReferralClinic[]> {
    const all = await this.getAll(accessToken);
    return all.filter((c) => c.isActive);
  },

  async getById(accessToken: string, id: string): Promise<ReferralClinic | null> {
    const clinics = await this.getAll(accessToken);
    return clinics.find((c) => c.id === id) || null;
  },

  async create(
    accessToken: string,
    clinic: Omit<ReferralClinic, "id" | "createdAt" | "updatedAt">
  ): Promise<ReferralClinic> {
    const sheets = getGoogleSheetsClient(accessToken);
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    const now = new Date().toISOString();
    const newClinic: ReferralClinic = {
      ...clinic,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    await appendRow(sheets, spreadsheetId, SHEETS.REFERRAL_CLINICS, [
      newClinic.id,
      newClinic.practiceName,
      newClinic.address || null,
      newClinic.phone || null,
      newClinic.email || null,
      JSON.stringify(newClinic.specialties),
      newClinic.notes || null,
      newClinic.customFields ? JSON.stringify(newClinic.customFields) : null,
      newClinic.isActive ? "true" : "false",
      newClinic.createdAt,
      newClinic.updatedAt,
    ]);

    return newClinic;
  },

  async update(
    accessToken: string,
    id: string,
    updates: Partial<ReferralClinic>
  ): Promise<ReferralClinic | null> {
    const sheets = getGoogleSheetsClient(accessToken);
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    const data = await getSheetData(sheets, spreadsheetId, SHEETS.REFERRAL_CLINICS);
    if (data.length < 2) return null;

    const headers = data[0];
    const rowIndex = data.findIndex((row, i) => i > 0 && row[0] === id);

    if (rowIndex === -1) return null;

    const existing: Record<string, string> = {};
    headers.forEach((header, index) => {
      existing[header] = data[rowIndex][index] || "";
    });

    const existingClinic: ReferralClinic = {
      id: existing.id,
      practiceName: existing.practiceName,
      address: existing.address || undefined,
      phone: existing.phone || undefined,
      email: existing.email || undefined,
      specialties: existing.specialties ? JSON.parse(existing.specialties) : [],
      notes: existing.notes || undefined,
      customFields: existing.customFields ? JSON.parse(existing.customFields) : undefined,
      isActive: existing.isActive === "true",
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    };

    const updatedClinic: ReferralClinic = {
      ...existingClinic,
      ...updates,
      id: existingClinic.id,
      createdAt: existingClinic.createdAt,
      updatedAt: new Date().toISOString(),
    };

    await updateRow(
      sheets,
      spreadsheetId,
      SHEETS.REFERRAL_CLINICS,
      rowIndex + 1,
      [
        updatedClinic.id,
        updatedClinic.practiceName,
        updatedClinic.address || null,
        updatedClinic.phone || null,
        updatedClinic.email || null,
        JSON.stringify(updatedClinic.specialties),
        updatedClinic.notes || null,
        updatedClinic.customFields ? JSON.stringify(updatedClinic.customFields) : null,
        updatedClinic.isActive ? "true" : "false",
        updatedClinic.createdAt,
        updatedClinic.updatedAt,
      ]
    );

    return updatedClinic;
  },

  async delete(accessToken: string, id: string): Promise<boolean> {
    const sheets = getGoogleSheetsClient(accessToken);
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    const data = await getSheetData(sheets, spreadsheetId, SHEETS.REFERRAL_CLINICS);
    if (data.length < 2) return false;

    const rowIndex = data.findIndex((row, i) => i > 0 && row[0] === id);
    if (rowIndex === -1) return false;

    // Get the sheet ID for batch update
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === SHEETS.REFERRAL_CLINICS
    );

    if (!sheet?.properties?.sheetId) return false;

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheet.properties.sheetId,
                dimension: "ROWS",
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });

    return true;
  },
};

// Referral Clinics Config API (for custom fields)
export const referralClinicsConfigApi = {
  async getConfig(accessToken: string): Promise<ReferralClinicsConfig> {
    const sheets = getGoogleSheetsClient(accessToken);
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    try {
      const data = await getSheetData(sheets, spreadsheetId, SHEETS.REFERRAL_CLINICS_CONFIG);
      if (data.length < 2) {
        return { customFields: [], updatedAt: new Date().toISOString() };
      }

      // Config sheet has 2 columns: key and value (JSON)
      const config: Record<string, string> = {};
      for (let i = 1; i < data.length; i++) {
        const [key, value] = data[i];
        if (key) {
          config[key] = value || "";
        }
      }

      return {
        customFields: config.customFields ? JSON.parse(config.customFields) : [],
        updatedAt: config.updatedAt || new Date().toISOString(),
      };
    } catch {
      return { customFields: [], updatedAt: new Date().toISOString() };
    }
  },

  async saveCustomFields(
    accessToken: string,
    customFields: ReferralClinicCustomField[]
  ): Promise<ReferralClinicsConfig> {
    const sheets = getGoogleSheetsClient(accessToken);
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    const now = new Date().toISOString();

    // Clear existing data and write new config
    const data = await getSheetData(sheets, spreadsheetId, SHEETS.REFERRAL_CLINICS_CONFIG);

    if (data.length < 2) {
      // Append new rows
      await appendRow(sheets, spreadsheetId, SHEETS.REFERRAL_CLINICS_CONFIG, [
        "customFields",
        JSON.stringify(customFields),
      ]);
      await appendRow(sheets, spreadsheetId, SHEETS.REFERRAL_CLINICS_CONFIG, [
        "updatedAt",
        now,
      ]);
    } else {
      // Update existing rows
      await updateRow(sheets, spreadsheetId, SHEETS.REFERRAL_CLINICS_CONFIG, 2, [
        "customFields",
        JSON.stringify(customFields),
      ]);

      if (data.length >= 3) {
        await updateRow(sheets, spreadsheetId, SHEETS.REFERRAL_CLINICS_CONFIG, 3, [
          "updatedAt",
          now,
        ]);
      } else {
        await appendRow(sheets, spreadsheetId, SHEETS.REFERRAL_CLINICS_CONFIG, [
          "updatedAt",
          now,
        ]);
      }
    }

    return { customFields, updatedAt: now };
  },
};
