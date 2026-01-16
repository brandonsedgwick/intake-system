import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { templateSectionsDbApi, auditLogDbApi } from "@/lib/api/prisma-db";

// GET /api/template-sections/[id] - Get a specific template section
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const section = await templateSectionsDbApi.getById(id);

    if (!section) {
      return NextResponse.json(
        { error: "Template section not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(section);
  } catch (error) {
    console.error("Error fetching template section:", error);
    return NextResponse.json(
      { error: "Failed to fetch template section" },
      { status: 500 }
    );
  }
}

// PATCH /api/template-sections/[id] - Update a template section
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Get previous value for audit
    const previousSection = await templateSectionsDbApi.getById(id);

    if (!previousSection) {
      return NextResponse.json(
        { error: "Template section not found" },
        { status: 404 }
      );
    }

    const updatedSection = await templateSectionsDbApi.update(id, body);

    if (!updatedSection) {
      return NextResponse.json(
        { error: "Failed to update template section" },
        { status: 500 }
      );
    }

    // Log the action
    await auditLogDbApi.log({
      userId: session.user?.email || "unknown",
      userEmail: session.user?.email || "unknown",
      action: "update",
      entityType: "settings",
      entityId: id,
      previousValue: JSON.stringify(previousSection),
      newValue: JSON.stringify(updatedSection),
    });

    return NextResponse.json(updatedSection);
  } catch (error) {
    console.error("Error updating template section:", error);
    return NextResponse.json(
      { error: "Failed to update template section" },
      { status: 500 }
    );
  }
}

// DELETE /api/template-sections/[id] - Delete a template section
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get section for audit log
    const section = await templateSectionsDbApi.getById(id);

    if (!section) {
      return NextResponse.json(
        { error: "Template section not found" },
        { status: 404 }
      );
    }

    const deleted = await templateSectionsDbApi.delete(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Failed to delete template section" },
        { status: 500 }
      );
    }

    // Log the action
    await auditLogDbApi.log({
      userId: session.user?.email || "unknown",
      userEmail: session.user?.email || "unknown",
      action: "delete",
      entityType: "settings",
      entityId: id,
      previousValue: JSON.stringify(section),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting template section:", error);
    return NextResponse.json(
      { error: "Failed to delete template section" },
      { status: 500 }
    );
  }
}
