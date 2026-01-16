import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { clientsDbApi, caseReopenHistoryDbApi, auditLogDbApi } from "@/lib/api/prisma-db";
import { ClientStatus, isClosedStatus } from "@/types/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/clients/[id]/reopen - Reopen a closed case
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { reason, newStatus } = body;

    // Validate required fields
    if (!reason || !newStatus) {
      return NextResponse.json(
        { error: "Missing required fields: reason, newStatus" },
        { status: 400 }
      );
    }

    // Validate reason length
    if (reason.trim().length < 10) {
      return NextResponse.json(
        { error: "Reopen reason must be at least 10 characters" },
        { status: 400 }
      );
    }

    // Validate newStatus is not a closed status
    if (isClosedStatus(newStatus as ClientStatus)) {
      return NextResponse.json(
        { error: "Cannot reopen to a closed status" },
        { status: 400 }
      );
    }

    // Get the current client
    const client = await clientsDbApi.getById(id);

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Verify client is currently closed
    if (!isClosedStatus(client.status)) {
      return NextResponse.json(
        { error: "Client is not in a closed status" },
        { status: 400 }
      );
    }

    // Create reopen history record
    await caseReopenHistoryDbApi.create({
      clientId: id,
      reopenedBy: session.user?.email || "unknown",
      reopenReason: reason.trim(),
      previousStatus: client.status,
      newStatus: newStatus as ClientStatus,
      closedDate: client.closedDate,
      closedReason: client.closedReason,
      closedFromWorkflow: client.closedFromWorkflow,
    });

    // Update client: clear closure fields and set new status
    const updatedClient = await clientsDbApi.update(id, {
      status: newStatus as ClientStatus,
      closedDate: undefined,
      closedReason: undefined,
      closedFromWorkflow: undefined,
      closedFromStatus: undefined,
    });

    // Log the action
    await auditLogDbApi.log({
      userId: session.user?.email || "unknown",
      userEmail: session.user?.email || "unknown",
      action: "reopen_case",
      entityType: "client",
      entityId: id,
      previousValue: JSON.stringify({
        status: client.status,
        closedDate: client.closedDate,
        closedReason: client.closedReason,
        closedFromWorkflow: client.closedFromWorkflow,
      }),
      newValue: JSON.stringify({
        status: newStatus,
        reopenReason: reason.trim(),
      }),
    });

    return NextResponse.json({
      success: true,
      client: updatedClient,
    });
  } catch (error) {
    console.error("Error reopening case:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Failed to reopen case";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
