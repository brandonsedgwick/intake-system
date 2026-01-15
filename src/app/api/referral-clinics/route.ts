import { NextRequest, NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/auth/admin";
import { referralClinicsApi, auditLogApi } from "@/lib/api/google-sheets";

// GET /api/referral-clinics - Get all referral clinics
export async function GET() {
  try {
    const { isAdmin, session, error } = await checkAdminAccess();

    if (!isAdmin) {
      return NextResponse.json({ error }, { status: error === "Unauthorized" ? 401 : 403 });
    }

    const clinics = await referralClinicsApi.getAll(session!.accessToken!);

    return NextResponse.json(clinics);
  } catch (error) {
    console.error("Error fetching referral clinics:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch referral clinics";

    // Check if the sheet doesn't exist - return empty array instead of error
    if (errorMessage.includes("Unable to parse range") || errorMessage.includes("not found")) {
      return NextResponse.json([]);
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// POST /api/referral-clinics - Create a new referral clinic
export async function POST(request: NextRequest) {
  try {
    const { isAdmin, session, error } = await checkAdminAccess();

    if (!isAdmin) {
      return NextResponse.json({ error }, { status: error === "Unauthorized" ? 401 : 403 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.practiceName) {
      return NextResponse.json(
        { error: "Missing required field: practiceName" },
        { status: 400 }
      );
    }

    const clinic = await referralClinicsApi.create(session!.accessToken!, {
      practiceName: body.practiceName,
      address: body.address,
      phone: body.phone,
      email: body.email,
      specialties: body.specialties || [],
      notes: body.notes,
      customFields: body.customFields,
      isActive: body.isActive ?? true,
    });

    // Log the action
    await auditLogApi.log(session!.accessToken!, {
      userId: session!.user?.email || "unknown",
      userEmail: session!.user?.email || "unknown",
      action: "create",
      entityType: "settings",
      entityId: clinic.id,
      newValue: JSON.stringify(clinic),
    });

    return NextResponse.json(clinic, { status: 201 });
  } catch (error) {
    console.error("Error creating referral clinic:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to create referral clinic";

    // Check if the sheet doesn't exist
    if (errorMessage.includes("Unable to parse range") || errorMessage.includes("not found")) {
      return NextResponse.json(
        { error: "ReferralClinics sheet not found. Please run Sheets Setup from Settings to create the required sheets." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
