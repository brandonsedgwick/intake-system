import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { templatesDbApi, auditLogDbApi } from "@/lib/api/prisma-db";

// POST /api/templates/[id]/set-default - Set template as default for its type
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get template before change
    const previousTemplate = await templatesDbApi.getById(id);

    if (!previousTemplate) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 }
      );
    }

    // Set as default (this unsets current default for the type)
    const updatedTemplate = await templatesDbApi.setDefault(id);

    if (!updatedTemplate) {
      return NextResponse.json(
        { error: "Failed to set default template" },
        { status: 500 }
      );
    }

    // Log the action
    await auditLogDbApi.log({
      userId: session.user?.email || "unknown",
      userEmail: session.user?.email || "unknown",
      action: "set_default",
      entityType: "template",
      entityId: id,
      previousValue: JSON.stringify({ isDefault: previousTemplate.isDefault }),
      newValue: JSON.stringify({ isDefault: true }),
    });

    return NextResponse.json(updatedTemplate);
  } catch (error) {
    console.error("Error setting default template:", error);
    return NextResponse.json(
      { error: "Failed to set default template" },
      { status: 500 }
    );
  }
}
