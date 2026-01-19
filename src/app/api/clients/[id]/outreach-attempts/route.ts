import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { outreachAttemptsDbApi, settingsDbApi } from "@/lib/api/prisma-db";
import { OutreachAttemptType, OutreachAttemptStatus } from "@/types/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/clients/[id]/outreach-attempts - Get all outreach attempts for a client
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const attempts = await outreachAttemptsDbApi.getByClientId(id);

    return NextResponse.json(attempts);
  } catch (error) {
    console.error("Error fetching outreach attempts:", error);
    return NextResponse.json(
      { error: "Failed to fetch outreach attempts" },
      { status: 500 }
    );
  }
}

// POST /api/clients/[id]/outreach-attempts - Create a new outreach attempt or initialize all attempts
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // If initialize flag is set, create all pending attempts for the client
    if (body.initialize) {
      // Get the configured attempt count from settings
      const settings = await settingsDbApi.getAll();
      const attemptCount = parseInt(settings.outreachAttemptCount || "3", 10);

      const attempts = await outreachAttemptsDbApi.initializeForClient(id, attemptCount);
      return NextResponse.json(attempts, { status: 201 });
    }

    // Otherwise, create a single attempt
    const { attemptNumber, attemptType, status, sentAt, emailSubject, emailPreview } = body;

    if (!attemptNumber || !attemptType) {
      return NextResponse.json(
        { error: "attemptNumber and attemptType are required" },
        { status: 400 }
      );
    }

    const attempt = await outreachAttemptsDbApi.create({
      clientId: id,
      attemptNumber,
      attemptType: attemptType as OutreachAttemptType,
      status: status as OutreachAttemptStatus,
      sentAt,
      emailSubject,
      emailPreview,
    });

    return NextResponse.json(attempt, { status: 201 });
  } catch (error) {
    console.error("Error creating outreach attempt:", error);
    return NextResponse.json(
      { error: "Failed to create outreach attempt" },
      { status: 500 }
    );
  }
}

// PATCH /api/clients/[id]/outreach-attempts - Update an outreach attempt
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await params; // We need the client ID for validation but update uses attempt ID

    const body = await request.json();
    const { attemptId, status, sentAt, emailSubject, emailPreview } = body;

    if (!attemptId) {
      return NextResponse.json(
        { error: "attemptId is required" },
        { status: 400 }
      );
    }

    const attempt = await outreachAttemptsDbApi.update(attemptId, {
      status: status as OutreachAttemptStatus,
      sentAt,
      emailSubject,
      emailPreview,
    });

    if (!attempt) {
      return NextResponse.json(
        { error: "Outreach attempt not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(attempt);
  } catch (error) {
    console.error("Error updating outreach attempt:", error);
    return NextResponse.json(
      { error: "Failed to update outreach attempt" },
      { status: 500 }
    );
  }
}

// DELETE /api/clients/[id]/outreach-attempts - Delete all outreach attempts for a client
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const deletedCount = await outreachAttemptsDbApi.deleteByClientId(id);

    return NextResponse.json({ deleted: deletedCount });
  } catch (error) {
    console.error("Error deleting outreach attempts:", error);
    return NextResponse.json(
      { error: "Failed to delete outreach attempts" },
      { status: 500 }
    );
  }
}
