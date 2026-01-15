import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { cliniciansApi, auditLogApi } from "@/lib/api/google-sheets";
import { google } from "googleapis";
import { Clinician } from "@/types/client";

// GET /api/clinicians - Get all clinicians
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const acceptingNew = searchParams.get("acceptingNew") === "true";
    const insurance = searchParams.get("insurance");

    let clinicians: Clinician[];

    if (insurance) {
      clinicians = await cliniciansApi.getByInsurance(
        session.accessToken,
        insurance
      );
    } else if (acceptingNew) {
      clinicians = await cliniciansApi.getAcceptingNew(session.accessToken);
    } else {
      clinicians = await cliniciansApi.getAll(session.accessToken);
    }

    return NextResponse.json(clinicians);
  } catch (error) {
    console.error("Error fetching clinicians:", error);
    return NextResponse.json(
      { error: "Failed to fetch clinicians" },
      { status: 500 }
    );
  }
}

// POST /api/clinicians - Create a new clinician
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

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    const newClinician: Clinician = {
      id: crypto.randomUUID(),
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      calendarId: body.calendarId,
      simplePracticeId: body.simplePracticeId,
      insurancePanels: body.insurancePanels || [],
      specialties: body.specialties || [],
      newClientCapacity: body.newClientCapacity || 5,
      isAcceptingNew: body.isAcceptingNew !== false,
      defaultSessionLength: body.defaultSessionLength || 50,
    };

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Clinicians!A:K",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            newClinician.id,
            newClinician.firstName,
            newClinician.lastName,
            newClinician.email,
            newClinician.calendarId || "",
            newClinician.simplePracticeId || "",
            JSON.stringify(newClinician.insurancePanels),
            JSON.stringify(newClinician.specialties),
            newClinician.newClientCapacity,
            newClinician.isAcceptingNew ? "true" : "false",
            newClinician.defaultSessionLength,
          ],
        ],
      },
    });

    // Log the action
    await auditLogApi.log(session.accessToken, {
      userId: session.user?.email || "unknown",
      userEmail: session.user?.email || "unknown",
      action: "create",
      entityType: "clinician",
      entityId: newClinician.id,
      newValue: JSON.stringify(newClinician),
    });

    return NextResponse.json(newClinician, { status: 201 });
  } catch (error) {
    console.error("Error creating clinician:", error);
    return NextResponse.json(
      { error: "Failed to create clinician" },
      { status: 500 }
    );
  }
}
