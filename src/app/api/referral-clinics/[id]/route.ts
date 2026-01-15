import { NextRequest, NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/auth/admin";
import { referralClinicsDbApi, auditLogDbApi } from "@/lib/api/prisma-db";

// GET /api/referral-clinics/[id] - Get a specific referral clinic
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAdmin, error } = await checkAdminAccess();

    if (!isAdmin) {
      return NextResponse.json({ error }, { status: error === "Unauthorized" ? 401 : 403 });
    }

    const { id } = await params;
    const clinic = await referralClinicsDbApi.getById(id);

    if (!clinic) {
      return NextResponse.json(
        { error: "Referral clinic not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(clinic);
  } catch (error) {
    console.error("Error fetching referral clinic:", error);
    return NextResponse.json(
      { error: "Failed to fetch referral clinic" },
      { status: 500 }
    );
  }
}

// PATCH /api/referral-clinics/[id] - Update a referral clinic
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAdmin, session, error } = await checkAdminAccess();

    if (!isAdmin) {
      return NextResponse.json({ error }, { status: error === "Unauthorized" ? 401 : 403 });
    }

    const { id } = await params;
    const body = await request.json();

    // Get previous value for audit
    const previousClinic = await referralClinicsDbApi.getById(id);

    if (!previousClinic) {
      return NextResponse.json(
        { error: "Referral clinic not found" },
        { status: 404 }
      );
    }

    const updatedClinic = await referralClinicsDbApi.update(id, body);

    if (!updatedClinic) {
      return NextResponse.json(
        { error: "Failed to update referral clinic" },
        { status: 500 }
      );
    }

    // Log the action
    await auditLogDbApi.log({
      userId: session!.user?.email || "unknown",
      userEmail: session!.user?.email || "unknown",
      action: "update",
      entityType: "settings",
      entityId: id,
      previousValue: JSON.stringify(previousClinic),
      newValue: JSON.stringify(updatedClinic),
    });

    return NextResponse.json(updatedClinic);
  } catch (error) {
    console.error("Error updating referral clinic:", error);
    return NextResponse.json(
      { error: "Failed to update referral clinic" },
      { status: 500 }
    );
  }
}

// DELETE /api/referral-clinics/[id] - Delete a referral clinic
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { isAdmin, session, error } = await checkAdminAccess();

    if (!isAdmin) {
      return NextResponse.json({ error }, { status: error === "Unauthorized" ? 401 : 403 });
    }

    const { id } = await params;

    // Get clinic for audit log
    const clinic = await referralClinicsDbApi.getById(id);

    if (!clinic) {
      return NextResponse.json(
        { error: "Referral clinic not found" },
        { status: 404 }
      );
    }

    const deleted = await referralClinicsDbApi.delete(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Failed to delete referral clinic" },
        { status: 500 }
      );
    }

    // Log the action
    await auditLogDbApi.log({
      userId: session!.user?.email || "unknown",
      userEmail: session!.user?.email || "unknown",
      action: "delete",
      entityType: "settings",
      entityId: id,
      previousValue: JSON.stringify(clinic),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting referral clinic:", error);
    return NextResponse.json(
      { error: "Failed to delete referral clinic" },
      { status: 500 }
    );
  }
}
