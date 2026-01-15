import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { communicationsApi, clientsApi, auditLogApi } from "@/lib/api/google-sheets";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/clients/[id]/communications - Get all communications for a client
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify client exists
    const client = await clientsApi.getById(session.accessToken, id);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const communications = await communicationsApi.getByClientId(
      session.accessToken,
      id
    );

    return NextResponse.json(communications);
  } catch (error) {
    console.error("Error fetching communications:", error);
    return NextResponse.json(
      { error: "Failed to fetch communications" },
      { status: 500 }
    );
  }
}

// POST /api/clients/[id]/communications - Add a communication record
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Verify client exists
    const client = await clientsApi.getById(session.accessToken, id);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Validate required fields
    if (!body.direction || !body.type || !body.subject) {
      return NextResponse.json(
        { error: "Missing required fields: direction, type, subject" },
        { status: 400 }
      );
    }

    const communication = await communicationsApi.create(session.accessToken, {
      clientId: id,
      timestamp: body.timestamp || new Date().toISOString(),
      direction: body.direction,
      type: body.type,
      gmailMessageId: body.gmailMessageId,
      gmailThreadId: body.gmailThreadId,
      subject: body.subject,
      bodyPreview: body.bodyPreview || body.fullBody?.substring(0, 200) || "",
      fullBody: body.fullBody,
      sentBy: session.user?.email || undefined,
    });

    // Log the action
    await auditLogApi.log(session.accessToken, {
      userId: session.user?.email || "unknown",
      userEmail: session.user?.email || "unknown",
      action: "create",
      entityType: "communication",
      entityId: communication.id,
      newValue: JSON.stringify(communication),
    });

    return NextResponse.json(communication, { status: 201 });
  } catch (error) {
    console.error("Error creating communication:", error);
    return NextResponse.json(
      { error: "Failed to create communication" },
      { status: 500 }
    );
  }
}
