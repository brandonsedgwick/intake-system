import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { google } from "googleapis";

// External availability spreadsheet ID
const AVAILABILITY_SPREADSHEET_ID = "1KYrqQxZQpsfuA3vlGbSbQ78GaT6aW6Mqkj3EDfmEulE";
const AVAILABILITY_SHEET_NAME = "Availability_BySlot";
const INSURANCE_SHEET_NAME = "Insurance"; // Sheet with clinician insurance info

export interface SheetAvailabilitySlot {
  id: string;
  day: string;
  time: string;
  clinicians: string[];
  insurance: string;
}

// Helper to build clinician -> insurance mapping from insurance sheet
// Sheet format: Column headers are insurance company names, rows contain clinician names under each insurance
async function fetchClinicianInsuranceMap(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string
): Promise<Map<string, string[]>> {
  const clinicianInsuranceMap = new Map<string, string[]>();

  try {
    const insuranceResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${INSURANCE_SHEET_NAME}!A:Z`,
    });

    const insuranceRows = insuranceResponse.data.values;
    if (!insuranceRows || insuranceRows.length < 2) {
      return clinicianInsuranceMap;
    }

    // First row is headers - these are the insurance company names
    const insuranceHeaders = insuranceRows[0].map((h: string) => (h || "").trim());

    // For each column (insurance type), go through all rows and collect clinician names
    for (let colIdx = 0; colIdx < insuranceHeaders.length; colIdx++) {
      const insuranceName = insuranceHeaders[colIdx];
      if (!insuranceName) continue;

      // Go through each row (starting from row 1, skipping header)
      for (let rowIdx = 1; rowIdx < insuranceRows.length; rowIdx++) {
        const row = insuranceRows[rowIdx];
        const clinicianName = row[colIdx]?.trim();

        if (!clinicianName) continue;

        // Add this insurance to this clinician's list
        const clinicianKey = clinicianName.toLowerCase();
        const existingInsurances = clinicianInsuranceMap.get(clinicianKey) || [];
        if (!existingInsurances.includes(insuranceName)) {
          existingInsurances.push(insuranceName);
          clinicianInsuranceMap.set(clinicianKey, existingInsurances);
        }
      }
    }
  } catch (error) {
    console.error("Error fetching insurance sheet:", error);
    // Continue without insurance data rather than failing entirely
  }

  return clinicianInsuranceMap;
}

// GET - Fetch all availability slots from external Google Sheet
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Initialize Google Sheets client
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });
    const sheets = google.sheets({ version: "v4", auth });

    // Fetch clinician insurance mapping first
    const clinicianInsuranceMap = await fetchClinicianInsuranceMap(
      sheets,
      AVAILABILITY_SPREADSHEET_ID
    );

    // Fetch data from the Availability_BySlot sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: AVAILABILITY_SPREADSHEET_ID,
      range: `${AVAILABILITY_SHEET_NAME}!A:Z`,
    });

    const rows = response.data.values;

    if (!rows || rows.length < 2) {
      return NextResponse.json({ slots: [] });
    }

    // First row is headers
    const headers = rows[0].map((h: string) => h.toLowerCase().trim());
    const dayIndex = headers.findIndex((h: string) => h === "day" || h === "days");
    const timeIndex = headers.findIndex((h: string) => h === "time" || h === "times");
    const cliniciansIndex = headers.findIndex((h: string) =>
      h === "clinicians" || h === "clinician" || h === "provider" || h === "providers"
    );
    const insuranceIndex = headers.findIndex((h: string) =>
      h === "insurance" || h === "insurances" || h === "insurance type"
    );

    // Validate required columns exist
    if (dayIndex === -1 || timeIndex === -1 || cliniciansIndex === -1) {
      return NextResponse.json(
        {
          error: "Missing required columns. Expected: Day, Time, Clinicians",
          foundHeaders: headers
        },
        { status: 400 }
      );
    }

    // Parse data rows
    const slots: SheetAvailabilitySlot[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      const day = row[dayIndex]?.trim() || "";
      const time = row[timeIndex]?.trim() || "";
      const cliniciansRaw = row[cliniciansIndex]?.trim() || "";
      let insurance = insuranceIndex !== -1 ? (row[insuranceIndex]?.trim() || "") : "";

      // Skip empty rows
      if (!day || !time || !cliniciansRaw) {
        continue;
      }

      // Parse clinicians (comma-separated full names)
      const clinicians = cliniciansRaw
        .split(",")
        .map((c: string) => c.trim())
        .filter((c: string) => c.length > 0);

      // If no insurance in availability sheet, look up from clinician insurance map
      if (!insurance && clinicianInsuranceMap.size > 0) {
        // Collect all insurances from all clinicians in this slot
        const slotInsurances = new Set<string>();
        for (const clinician of clinicians) {
          const clinicianInsurances = clinicianInsuranceMap.get(clinician.toLowerCase());
          if (clinicianInsurances) {
            clinicianInsurances.forEach((ins) => slotInsurances.add(ins));
          }
        }
        insurance = Array.from(slotInsurances).join(", ");
      }

      // Generate unique ID from day and time
      const id = `${day.toLowerCase().replace(/\s+/g, "-")}-${time.toLowerCase().replace(/[:\s]+/g, "-")}`;

      slots.push({
        id,
        day,
        time,
        clinicians,
        insurance,
      });
    }

    // Sort by day order then time
    const dayOrder: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    slots.sort((a, b) => {
      const dayA = dayOrder[a.day.toLowerCase()] ?? 7;
      const dayB = dayOrder[b.day.toLowerCase()] ?? 7;
      if (dayA !== dayB) return dayA - dayB;

      // Sort by time (simple string comparison works for consistent time formats)
      return a.time.localeCompare(b.time);
    });

    return NextResponse.json({ slots });
  } catch (error) {
    console.error("Error fetching availability from sheets:", error);

    // Provide more specific error messages
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Check for common Google API errors
    if (errorMessage.includes("403") || errorMessage.includes("permission")) {
      return NextResponse.json(
        { error: "Permission denied. The availability spreadsheet may not be shared with your account." },
        { status: 403 }
      );
    }

    if (errorMessage.includes("404") || errorMessage.includes("not found")) {
      return NextResponse.json(
        { error: "Spreadsheet not found. Please check the spreadsheet ID." },
        { status: 404 }
      );
    }

    if (errorMessage.includes("401") || errorMessage.includes("invalid_grant") || errorMessage.includes("token")) {
      return NextResponse.json(
        { error: "Authentication expired. Please sign out and sign back in." },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: `Failed to fetch availability: ${errorMessage}` },
      { status: 500 }
    );
  }
}
