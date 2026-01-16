import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { templateSectionsDbApi, auditLogDbApi } from "@/lib/api/prisma-db";

// POST /api/template-sections/reorder - Reorder template sections
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { orderedIds } = body;

    if (!orderedIds || !Array.isArray(orderedIds)) {
      return NextResponse.json(
        { error: "Missing required field: orderedIds (array)" },
        { status: 400 }
      );
    }

    const success = await templateSectionsDbApi.reorder(orderedIds);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to reorder template sections" },
        { status: 500 }
      );
    }

    // Log the action
    await auditLogDbApi.log({
      userId: session.user?.email || "unknown",
      userEmail: session.user?.email || "unknown",
      action: "reorder",
      entityType: "settings",
      entityId: "template_sections",
      newValue: JSON.stringify({ orderedIds }),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error reordering template sections:", error);
    return NextResponse.json(
      { error: "Failed to reorder template sections" },
      { status: 500 }
    );
  }
}
