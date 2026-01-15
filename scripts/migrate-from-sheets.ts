/**
 * Migration Script: Google Sheets to SQLite
 *
 * This script migrates data from Google Sheets to the local SQLite database.
 * Run once after setting up the Prisma schema.
 *
 * Prerequisites:
 * 1. Valid Google OAuth access token (run the app and get it from session)
 * 2. GOOGLE_SHEETS_SPREADSHEET_ID in .env.local
 * 3. SQLite database created via `prisma db push`
 *
 * Usage:
 *   npx ts-node --project tsconfig.json scripts/migrate-from-sheets.ts <access_token>
 *
 * Or use the interactive mode that prompts for the token:
 *   npx ts-node --project tsconfig.json scripts/migrate-from-sheets.ts
 */

import { google, sheets_v4 } from "googleapis";
import { PrismaClient } from "@prisma/client";
import * as readline from "readline";

const prisma = new PrismaClient();

// Sheet names from google-sheets.ts
const SHEETS = {
  CLINICIANS: "Clinicians",
  AVAILABILITY: "Availability",
  EMAIL_TEMPLATES: "EmailTemplates",
  AUDIT_LOG: "AuditLog",
  EVALUATION_CRITERIA: "EvaluationCriteria",
  TEXT_EVALUATION_RULES: "TextEvaluationRules",
  REFERRAL_CLINICS: "ReferralClinics",
  REFERRAL_CLINICS_CONFIG: "ReferralClinicsConfig",
  SETTINGS: "Settings",
  // IntakeFields may not exist yet - will skip if not present
  INTAKE_FIELDS: "IntakeFields",
  COMMUNICATIONS: "Communications",
} as const;

const MAX_COLUMN = "AZ";

function getGoogleSheetsClient(accessToken: string): sheets_v4.Sheets {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: "v4", auth });
}

async function getSheetData(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string
): Promise<string[][]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:${MAX_COLUMN}`,
    });
    return response.data.values || [];
  } catch (error: unknown) {
    const err = error as { code?: number; message?: string };
    if (err.code === 400 || err.message?.includes("Unable to parse range")) {
      console.log(`  ⚠️  Sheet "${sheetName}" not found, skipping...`);
      return [];
    }
    throw error;
  }
}

function parseJsonSafe<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function promptForToken(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log("\n📋 To get your access token:");
    console.log("   1. Open the app in your browser");
    console.log("   2. Open Developer Tools (F12)");
    console.log("   3. Go to Application > Cookies");
    console.log("   4. Find the session cookie and decode it, or");
    console.log("   5. Make an API call and inspect the network request\n");

    rl.question("Enter your Google OAuth access token: ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function migrateClinicians(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<number> {
  console.log("\n📋 Migrating Clinicians...");
  const data = await getSheetData(sheets, spreadsheetId, SHEETS.CLINICIANS);
  if (data.length < 2) {
    console.log("  No data found");
    return 0;
  }

  const headers = data[0];
  let count = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] || "";
    });

    if (!record.id) continue;

    try {
      await prisma.clinician.upsert({
        where: { id: record.id },
        update: {
          firstName: record.firstName || "",
          lastName: record.lastName || "",
          email: record.email || "",
          calendarId: record.calendarId || null,
          simplePracticeId: record.simplePracticeId || null,
          insurancePanels: record.insurancePanels || "[]",
          specialties: record.specialties || "[]",
          newClientCapacity: parseInt(record.newClientCapacity) || 0,
          isAcceptingNew: record.isAcceptingNew === "true",
          defaultSessionLength: parseInt(record.defaultSessionLength) || 50,
        },
        create: {
          id: record.id,
          firstName: record.firstName || "",
          lastName: record.lastName || "",
          email: record.email || "",
          calendarId: record.calendarId || null,
          simplePracticeId: record.simplePracticeId || null,
          insurancePanels: record.insurancePanels || "[]",
          specialties: record.specialties || "[]",
          newClientCapacity: parseInt(record.newClientCapacity) || 0,
          isAcceptingNew: record.isAcceptingNew === "true",
          defaultSessionLength: parseInt(record.defaultSessionLength) || 50,
        },
      });
      count++;
    } catch (error) {
      console.error(`  ❌ Failed to migrate clinician ${record.id}:`, error);
    }
  }

  console.log(`  ✅ Migrated ${count} clinicians`);
  return count;
}

async function migrateAvailability(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<number> {
  console.log("\n📅 Migrating Availability...");
  const data = await getSheetData(sheets, spreadsheetId, SHEETS.AVAILABILITY);
  if (data.length < 2) {
    console.log("  No data found");
    return 0;
  }

  const headers = data[0];
  let count = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] || "";
    });

    if (!record.id) continue;

    try {
      await prisma.availability.upsert({
        where: { id: record.id },
        update: {
          clinicianId: record.clinicianId,
          dayOfWeek: parseInt(record.dayOfWeek) || 0,
          startTime: record.startTime || "",
          endTime: record.endTime || "",
          isRecurring: record.isRecurring === "true",
          specificDate: record.specificDate || null,
          isBooked: record.isBooked === "true",
          bookedClientId: record.bookedClientId || null,
        },
        create: {
          id: record.id,
          clinicianId: record.clinicianId,
          dayOfWeek: parseInt(record.dayOfWeek) || 0,
          startTime: record.startTime || "",
          endTime: record.endTime || "",
          isRecurring: record.isRecurring === "true",
          specificDate: record.specificDate || null,
          isBooked: record.isBooked === "true",
          bookedClientId: record.bookedClientId || null,
        },
      });
      count++;
    } catch (error) {
      console.error(`  ❌ Failed to migrate availability ${record.id}:`, error);
    }
  }

  console.log(`  ✅ Migrated ${count} availability slots`);
  return count;
}

async function migrateEmailTemplates(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<number> {
  console.log("\n📧 Migrating Email Templates...");
  const data = await getSheetData(sheets, spreadsheetId, SHEETS.EMAIL_TEMPLATES);
  if (data.length < 2) {
    console.log("  No data found");
    return 0;
  }

  const headers = data[0];
  let count = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] || "";
    });

    if (!record.id) continue;

    try {
      await prisma.emailTemplate.upsert({
        where: { id: record.id },
        update: {
          name: record.name || "",
          type: record.type || "initial_outreach",
          subject: record.subject || "",
          body: record.body || "",
          isActive: record.isActive === "true",
          updatedBy: record.updatedBy || null,
        },
        create: {
          id: record.id,
          name: record.name || "",
          type: record.type || "initial_outreach",
          subject: record.subject || "",
          body: record.body || "",
          isActive: record.isActive === "true",
          updatedBy: record.updatedBy || null,
        },
      });
      count++;
    } catch (error) {
      console.error(`  ❌ Failed to migrate template ${record.id}:`, error);
    }
  }

  console.log(`  ✅ Migrated ${count} email templates`);
  return count;
}

async function migrateAuditLog(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<number> {
  console.log("\n📝 Migrating Audit Log...");
  const data = await getSheetData(sheets, spreadsheetId, SHEETS.AUDIT_LOG);
  if (data.length < 2) {
    console.log("  No data found");
    return 0;
  }

  const headers = data[0];
  let count = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] || "";
    });

    if (!record.id) continue;

    try {
      await prisma.auditLog.upsert({
        where: { id: record.id },
        update: {
          timestamp: record.timestamp ? new Date(record.timestamp) : new Date(),
          userId: record.userId || "",
          userEmail: record.userEmail || "",
          action: record.action || "",
          entityType: record.entityType || "client",
          entityId: record.entityId || "",
          previousValue: record.previousValue || null,
          newValue: record.newValue || null,
          ipAddress: record.ipAddress || null,
        },
        create: {
          id: record.id,
          timestamp: record.timestamp ? new Date(record.timestamp) : new Date(),
          userId: record.userId || "",
          userEmail: record.userEmail || "",
          action: record.action || "",
          entityType: record.entityType || "client",
          entityId: record.entityId || "",
          previousValue: record.previousValue || null,
          newValue: record.newValue || null,
          ipAddress: record.ipAddress || null,
        },
      });
      count++;
    } catch (error) {
      console.error(`  ❌ Failed to migrate audit log ${record.id}:`, error);
    }
  }

  console.log(`  ✅ Migrated ${count} audit log entries`);
  return count;
}

async function migrateEvaluationCriteria(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<number> {
  console.log("\n🔍 Migrating Evaluation Criteria...");
  const data = await getSheetData(sheets, spreadsheetId, SHEETS.EVALUATION_CRITERIA);
  if (data.length < 2) {
    console.log("  No data found");
    return 0;
  }

  const headers = data[0];
  let count = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] || "";
    });

    if (!record.id) continue;

    try {
      await prisma.evaluationCriteria.upsert({
        where: { id: record.id },
        update: {
          name: record.name || "",
          description: record.description || null,
          field: record.field || "",
          operator: record.operator || "equals",
          value: record.value || "",
          action: record.action || "flag",
          priority: parseInt(record.priority) || 0,
          isActive: record.isActive === "true",
        },
        create: {
          id: record.id,
          name: record.name || "",
          description: record.description || null,
          field: record.field || "",
          operator: record.operator || "equals",
          value: record.value || "",
          action: record.action || "flag",
          priority: parseInt(record.priority) || 0,
          isActive: record.isActive === "true",
        },
      });
      count++;
    } catch (error) {
      console.error(`  ❌ Failed to migrate criteria ${record.id}:`, error);
    }
  }

  console.log(`  ✅ Migrated ${count} evaluation criteria`);
  return count;
}

async function migrateTextEvaluationRules(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<number> {
  console.log("\n📜 Migrating Text Evaluation Rules...");
  const data = await getSheetData(sheets, spreadsheetId, SHEETS.TEXT_EVALUATION_RULES);
  if (data.length < 2) {
    console.log("  No data found");
    return 0;
  }

  const headers = data[0];
  let count = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] || "";
    });

    if (!record.id) continue;

    try {
      await prisma.textEvaluationRule.upsert({
        where: { id: record.id },
        update: {
          name: record.name || "",
          category: record.category || "custom",
          severity: record.severity || "medium",
          patterns: record.patterns || "[]",
          isRegex: record.isRegex === "true",
          negationWords: record.negationWords || "[]",
          negationWindow: parseInt(record.negationWindow) || 5,
          requiresLLM: record.requiresLLM === "true",
          isActive: record.isActive === "true",
        },
        create: {
          id: record.id,
          name: record.name || "",
          category: record.category || "custom",
          severity: record.severity || "medium",
          patterns: record.patterns || "[]",
          isRegex: record.isRegex === "true",
          negationWords: record.negationWords || "[]",
          negationWindow: parseInt(record.negationWindow) || 5,
          requiresLLM: record.requiresLLM === "true",
          isActive: record.isActive === "true",
        },
      });
      count++;
    } catch (error) {
      console.error(`  ❌ Failed to migrate rule ${record.id}:`, error);
    }
  }

  console.log(`  ✅ Migrated ${count} text evaluation rules`);
  return count;
}

async function migrateReferralClinics(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<number> {
  console.log("\n🏥 Migrating Referral Clinics...");
  const data = await getSheetData(sheets, spreadsheetId, SHEETS.REFERRAL_CLINICS);
  if (data.length < 2) {
    console.log("  No data found");
    return 0;
  }

  const headers = data[0];
  let count = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] || "";
    });

    if (!record.id) continue;

    // Handle specialties - might be JSON array or comma-separated
    let specialties = "[]";
    if (record.specialties) {
      try {
        JSON.parse(record.specialties);
        specialties = record.specialties;
      } catch {
        // Convert comma-separated to JSON array
        const arr = record.specialties.split(",").map(s => s.trim()).filter(Boolean);
        specialties = JSON.stringify(arr);
      }
    }

    try {
      await prisma.referralClinic.upsert({
        where: { id: record.id },
        update: {
          practiceName: record.practiceName || "",
          address: record.address || null,
          phone: record.phone || null,
          email: record.email || null,
          specialties,
          notes: record.notes || null,
          customFields: record.customFields || null,
          isActive: record.isActive?.toLowerCase() === "true",
        },
        create: {
          id: record.id,
          practiceName: record.practiceName || "",
          address: record.address || null,
          phone: record.phone || null,
          email: record.email || null,
          specialties,
          notes: record.notes || null,
          customFields: record.customFields || null,
          isActive: record.isActive?.toLowerCase() === "true",
        },
      });
      count++;
    } catch (error) {
      console.error(`  ❌ Failed to migrate clinic ${record.id}:`, error);
    }
  }

  console.log(`  ✅ Migrated ${count} referral clinics`);
  return count;
}

async function migrateReferralClinicsConfig(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<number> {
  console.log("\n⚙️  Migrating Referral Clinics Config...");
  const data = await getSheetData(sheets, spreadsheetId, SHEETS.REFERRAL_CLINICS_CONFIG);
  if (data.length < 2) {
    console.log("  No data found");
    return 0;
  }

  // Config sheet has key-value pairs
  const config: Record<string, string> = {};
  for (let i = 1; i < data.length; i++) {
    const [key, value] = data[i];
    if (key) {
      config[key] = value || "";
    }
  }

  if (!config.customFields) {
    console.log("  No custom fields config found");
    return 0;
  }

  try {
    // Check if config already exists
    const existing = await prisma.referralClinicsConfig.findFirst();
    if (existing) {
      await prisma.referralClinicsConfig.update({
        where: { id: existing.id },
        data: {
          customFields: config.customFields,
        },
      });
    } else {
      await prisma.referralClinicsConfig.create({
        data: {
          customFields: config.customFields,
        },
      });
    }
    console.log(`  ✅ Migrated referral clinics config`);
    return 1;
  } catch (error) {
    console.error(`  ❌ Failed to migrate config:`, error);
    return 0;
  }
}

async function migrateSettings(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<number> {
  console.log("\n⚙️  Migrating Settings...");
  const data = await getSheetData(sheets, spreadsheetId, SHEETS.SETTINGS);
  if (data.length < 2) {
    console.log("  No data found");
    return 0;
  }

  let count = 0;

  for (let i = 1; i < data.length; i++) {
    const [key, value] = data[i];
    if (!key) continue;

    try {
      await prisma.setting.upsert({
        where: { key },
        update: { value: value || "" },
        create: { key, value: value || "" },
      });
      count++;
    } catch (error) {
      console.error(`  ❌ Failed to migrate setting ${key}:`, error);
    }
  }

  console.log(`  ✅ Migrated ${count} settings`);
  return count;
}

async function migrateIntakeFields(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<number> {
  console.log("\n📝 Migrating Intake Fields...");
  const data = await getSheetData(sheets, spreadsheetId, SHEETS.INTAKE_FIELDS);
  if (data.length < 2) {
    console.log("  No data found (sheet may not exist yet)");
    return 0;
  }

  const headers = data[0];
  let count = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] || "";
    });

    if (!record.id) continue;

    try {
      await prisma.intakeField.upsert({
        where: { id: record.id },
        update: {
          field: record.field || "",
          label: record.label || "",
          description: record.description || null,
          type: record.type || "text",
          googleFormField: record.googleFormField || null,
          isRequired: record.isRequired === "true",
          isActive: record.isActive === "true",
          order: parseInt(record.order) || 0,
        },
        create: {
          id: record.id,
          field: record.field || "",
          label: record.label || "",
          description: record.description || null,
          type: record.type || "text",
          googleFormField: record.googleFormField || null,
          isRequired: record.isRequired === "true",
          isActive: record.isActive === "true",
          order: parseInt(record.order) || 0,
        },
      });
      count++;
    } catch (error) {
      console.error(`  ❌ Failed to migrate intake field ${record.id}:`, error);
    }
  }

  console.log(`  ✅ Migrated ${count} intake fields`);
  return count;
}

async function migrateCommunications(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<number> {
  console.log("\n💬 Migrating Communications...");
  const data = await getSheetData(sheets, spreadsheetId, SHEETS.COMMUNICATIONS);
  if (data.length < 2) {
    console.log("  No data found");
    return 0;
  }

  const headers = data[0];
  let count = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] || "";
    });

    if (!record.id) continue;

    try {
      await prisma.communication.upsert({
        where: { id: record.id },
        update: {
          clientId: record.clientId || "",
          timestamp: record.timestamp ? new Date(record.timestamp) : new Date(),
          direction: record.direction || "out",
          type: record.type || "email",
          gmailMessageId: record.gmailMessageId || null,
          gmailThreadId: record.gmailThreadId || null,
          subject: record.subject || "",
          bodyPreview: record.bodyPreview || "",
          fullBody: record.fullBody || null,
          sentBy: record.sentBy || null,
        },
        create: {
          id: record.id,
          clientId: record.clientId || "",
          timestamp: record.timestamp ? new Date(record.timestamp) : new Date(),
          direction: record.direction || "out",
          type: record.type || "email",
          gmailMessageId: record.gmailMessageId || null,
          gmailThreadId: record.gmailThreadId || null,
          subject: record.subject || "",
          bodyPreview: record.bodyPreview || "",
          fullBody: record.fullBody || null,
          sentBy: record.sentBy || null,
        },
      });
      count++;
    } catch (error) {
      console.error(`  ❌ Failed to migrate communication ${record.id}:`, error);
    }
  }

  console.log(`  ✅ Migrated ${count} communications`);
  return count;
}

async function main() {
  console.log("🚀 Google Sheets to SQLite Migration\n");
  console.log("=" .repeat(50));

  // Get access token from command line or prompt
  let accessToken = process.argv[2];
  if (!accessToken) {
    accessToken = await promptForToken();
  }

  if (!accessToken) {
    console.error("\n❌ No access token provided. Exiting.");
    process.exit(1);
  }

  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    console.error("\n❌ GOOGLE_SHEETS_SPREADSHEET_ID not found in environment.");
    console.error("   Make sure .env.local is loaded or set the variable.");
    process.exit(1);
  }

  console.log(`\n📊 Spreadsheet ID: ${spreadsheetId}`);

  const sheets = getGoogleSheetsClient(accessToken);

  const totals: Record<string, number> = {};

  try {
    totals.clinicians = await migrateClinicians(sheets, spreadsheetId);
    totals.availability = await migrateAvailability(sheets, spreadsheetId);
    totals.emailTemplates = await migrateEmailTemplates(sheets, spreadsheetId);
    totals.auditLog = await migrateAuditLog(sheets, spreadsheetId);
    totals.evaluationCriteria = await migrateEvaluationCriteria(sheets, spreadsheetId);
    totals.textEvaluationRules = await migrateTextEvaluationRules(sheets, spreadsheetId);
    totals.referralClinics = await migrateReferralClinics(sheets, spreadsheetId);
    totals.referralClinicsConfig = await migrateReferralClinicsConfig(sheets, spreadsheetId);
    totals.settings = await migrateSettings(sheets, spreadsheetId);
    totals.intakeFields = await migrateIntakeFields(sheets, spreadsheetId);
    totals.communications = await migrateCommunications(sheets, spreadsheetId);

    console.log("\n" + "=".repeat(50));
    console.log("📊 Migration Summary:");
    console.log("=".repeat(50));

    let total = 0;
    for (const [key, count] of Object.entries(totals)) {
      console.log(`  ${key}: ${count}`);
      total += count;
    }

    console.log("  " + "-".repeat(30));
    console.log(`  Total records: ${total}`);
    console.log("\n✅ Migration complete!");

  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
