import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { templatesDbApi, auditLogDbApi } from "@/lib/api/prisma-db";

// GET /api/templates - Get all email templates
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const templates = await templatesDbApi.getAll();
    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// POST /api/templates - Create a new email template
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, subject, body: templateBody, isActive } = body;

    if (!name || !type || !subject || !templateBody) {
      return NextResponse.json(
        { error: "Missing required fields: name, type, subject, body" },
        { status: 400 }
      );
    }

    const newTemplate = await templatesDbApi.create({
      name,
      type,
      subject,
      body: templateBody,
      isActive: isActive !== false,
      updatedBy: session.user?.email || undefined,
    });

    // Log the action
    await auditLogDbApi.log({
      userId: session.user?.email || "unknown",
      userEmail: session.user?.email || "unknown",
      action: "create",
      entityType: "template",
      entityId: newTemplate.id,
      newValue: JSON.stringify(newTemplate),
    });

    return NextResponse.json(newTemplate, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
