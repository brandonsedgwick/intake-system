import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { clientsDbApi, auditLogDbApi } from "@/lib/api/prisma-db";
import { Client } from "@/types/client";

// GET /api/clients - Get all clients or filter by status
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") as Client["status"] | null;
    const followUpsDue = searchParams.get("followUpsDue") === "true";

    let clients: Client[];

    if (followUpsDue) {
      clients = await clientsDbApi.getFollowUpsDue();
    } else if (status) {
      clients = await clientsDbApi.getByStatus(status);
    } else {
      clients = await clientsDbApi.getAll();
    }

    return NextResponse.json(clients);
  } catch (error) {
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 }
    );
  }
}

// POST /api/clients - Create a new client
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
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

    const client = await clientsDbApi.create({
      status: body.status || "new",
      source: body.source || "manual",
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      age: body.age,
      paymentType: body.paymentType,
      insuranceProvider: body.insuranceProvider,
      insuranceMemberId: body.insuranceMemberId,
      preferredTimes: body.preferredTimes,
      requestedClinician: body.requestedClinician,
      presentingConcerns: body.presentingConcerns,
      suicideAttemptRecent: body.suicideAttemptRecent,
      psychiatricHospitalization: body.psychiatricHospitalization,
      additionalInfo: body.additionalInfo,
      paperworkComplete: false,
    });

    // Log the action
    await auditLogDbApi.log({
      userId: session.user?.email || "unknown",
      userEmail: session.user?.email || "unknown",
      action: "create",
      entityType: "client",
      entityId: client.id,
      newValue: JSON.stringify(client),
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error("Error creating client:", error);
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    );
  }
}

// DELETE /api/clients - Clear all clients (for testing/reset purposes)
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const deletedCount = await clientsDbApi.deleteAll();

    if (deletedCount > 0) {
      // Log the action
      await auditLogDbApi.log({
        userId: session.user?.email || "unknown",
        userEmail: session.user?.email || "unknown",
        action: "delete_all",
        entityType: "client",
        entityId: "all",
        previousValue: `${deletedCount} clients`,
        newValue: "0 clients",
      });
    }

    return NextResponse.json({
      message: `Cleared ${deletedCount} client${deletedCount === 1 ? "" : "s"}`,
      deletedCount,
    });
  } catch (error) {
    console.error("Error clearing clients:", error);
    return NextResponse.json(
      { error: "Failed to clear clients" },
      { status: 500 }
    );
  }
}
