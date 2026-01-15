import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { cliniciansDbApi, auditLogDbApi } from "@/lib/api/prisma-db";
import { Clinician } from "@/types/client";

// GET /api/clinicians - Get all clinicians
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const acceptingNew = searchParams.get("acceptingNew") === "true";
    const insurance = searchParams.get("insurance");

    let clinicians: Clinician[];

    if (insurance) {
      clinicians = await cliniciansDbApi.getByInsurance(insurance);
    } else if (acceptingNew) {
      clinicians = await cliniciansDbApi.getAcceptingNew();
    } else {
      clinicians = await cliniciansDbApi.getAll();
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

    if (!session) {
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

    const newClinician = await cliniciansDbApi.create({
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
    });

    // Log the action
    await auditLogDbApi.log({
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
