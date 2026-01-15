import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { textEvaluationRulesApi } from "@/lib/api/google-sheets";
import { TextEvaluationRule } from "@/types/client";

// GET /api/settings/text-evaluation-rules - Get all text evaluation rules
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rules = await textEvaluationRulesApi.getAll(session.accessToken);
    return NextResponse.json(rules);
  } catch (error) {
    console.error("Error fetching text evaluation rules:", error);
    return NextResponse.json(
      { error: "Failed to fetch text evaluation rules" },
      { status: 500 }
    );
  }
}

// POST /api/settings/text-evaluation-rules - Create a new rule
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.category || !body.severity) {
      return NextResponse.json(
        { error: "Missing required fields: name, category, severity" },
        { status: 400 }
      );
    }

    const rule = await textEvaluationRulesApi.create(session.accessToken, {
      name: body.name,
      category: body.category,
      severity: body.severity,
      patterns: body.patterns || [],
      isRegex: body.isRegex || false,
      negationWords: body.negationWords || [],
      negationWindow: body.negationWindow || 5,
      requiresLLM: body.requiresLLM || false,
      isActive: body.isActive !== false,
    });

    return NextResponse.json(rule, { status: 201 });
  } catch (error) {
    console.error("Error creating text evaluation rule:", error);
    return NextResponse.json(
      { error: "Failed to create text evaluation rule" },
      { status: 500 }
    );
  }
}

// PATCH /api/settings/text-evaluation-rules - Update a rule
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    if (!body.id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
      );
    }

    const { id, ...updates } = body;
    const rule = await textEvaluationRulesApi.update(session.accessToken, id, updates);

    if (!rule) {
      return NextResponse.json(
        { error: "Rule not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(rule);
  } catch (error) {
    console.error("Error updating text evaluation rule:", error);
    return NextResponse.json(
      { error: "Failed to update text evaluation rule" },
      { status: 500 }
    );
  }
}

// DELETE /api/settings/text-evaluation-rules - Delete a rule
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing required parameter: id" },
        { status: 400 }
      );
    }

    const success = await textEvaluationRulesApi.delete(session.accessToken, id);

    if (!success) {
      return NextResponse.json(
        { error: "Rule not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting text evaluation rule:", error);
    return NextResponse.json(
      { error: "Failed to delete text evaluation rule" },
      { status: 500 }
    );
  }
}
