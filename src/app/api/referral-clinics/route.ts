import { NextRequest, NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/auth/admin";
import { referralClinicsDbApi, auditLogDbApi } from "@/lib/api/prisma-db";

// GET /api/referral-clinics - Get all referral clinics
export async function GET() {
  try {
    const { isAdmin, error } = await checkAdminAccess();

    if (!isAdmin) {
      return NextResponse.json({ error }, { status: error === "Unauthorized" ? 401 : 403 });
    }

    const clinics = await referralClinicsDbApi.getAll();

    return NextResponse.json(clinics);
  } catch (error) {
    console.error("Error fetching referral clinics:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch referral clinics";

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

    const clinic = await referralClinicsDbApi.create({
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
    await auditLogDbApi.log({
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

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
