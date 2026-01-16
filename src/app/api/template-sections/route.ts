import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { templateSectionsDbApi, auditLogDbApi } from "@/lib/api/prisma-db";

// GET /api/template-sections - Get all template sections
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sections = await templateSectionsDbApi.getAll();
    return NextResponse.json(sections);
  } catch (error) {
    console.error("Error fetching template sections:", error);
    return NextResponse.json(
      { error: "Failed to fetch template sections" },
      { status: 500 }
    );
  }
}

// POST /api/template-sections - Create a new template section
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, order, color } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Missing required field: name" },
        { status: 400 }
      );
    }

    // If order not specified, place at end
    let sectionOrder = order;
    if (sectionOrder === undefined) {
      const existingSections = await templateSectionsDbApi.getAll();
      sectionOrder = existingSections.length;
    }

    const newSection = await templateSectionsDbApi.create({
      name,
      order: sectionOrder,
      color: color || undefined,
    });

    // Log the action
    await auditLogDbApi.log({
      userId: session.user?.email || "unknown",
      userEmail: session.user?.email || "unknown",
      action: "create",
      entityType: "settings",
      entityId: newSection.id,
      newValue: JSON.stringify(newSection),
    });

    return NextResponse.json(newSection, { status: 201 });
  } catch (error) {
    console.error("Error creating template section:", error);
    return NextResponse.json(
      { error: "Failed to create template section" },
      { status: 500 }
    );
  }
}
