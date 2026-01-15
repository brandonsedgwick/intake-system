import { NextRequest, NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/auth/admin";
import { evaluationCriteriaDbApi, auditLogDbApi } from "@/lib/api/prisma-db";

// DELETE /api/evaluation-criteria/[id] - Delete evaluation criteria (admin only)
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
    const deleted = await evaluationCriteriaDbApi.delete(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Criteria not found" },
        { status: 404 }
      );
    }

    // Log the action
    await auditLogDbApi.log({
      userId: session!.user?.email || "unknown",
      userEmail: session!.user?.email || "unknown",
      action: "delete",
      entityType: "settings",
      entityId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting evaluation criteria:", error);
    return NextResponse.json(
      { error: "Failed to delete evaluation criteria" },
      { status: 500 }
    );
  }
}

// PATCH /api/evaluation-criteria/[id] - Update single evaluation criteria (admin only)
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

    const updated = await evaluationCriteriaDbApi.update(id, body);

    if (!updated) {
      return NextResponse.json(
        { error: "Criteria not found" },
        { status: 404 }
      );
    }

    // Log the action
    await auditLogDbApi.log({
      userId: session!.user?.email || "unknown",
      userEmail: session!.user?.email || "unknown",
      action: "update",
      entityType: "settings",
      entityId: id,
      newValue: JSON.stringify(updated),
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating evaluation criteria:", error);
    return NextResponse.json(
      { error: "Failed to update evaluation criteria" },
      { status: 500 }
    );
  }
}
