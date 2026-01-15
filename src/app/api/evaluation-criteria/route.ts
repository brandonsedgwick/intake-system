import { NextRequest, NextResponse } from "next/server";
import { checkAdminAccess } from "@/lib/auth/admin";
import { evaluationCriteriaDbApi, auditLogDbApi } from "@/lib/api/prisma-db";
import { EvaluationCriteria, Client } from "@/types/client";

// GET /api/evaluation-criteria - Get all evaluation criteria (admin only)
export async function GET() {
  try {
    const { isAdmin, session, error } = await checkAdminAccess();

    if (!isAdmin) {
      return NextResponse.json({ error }, { status: error === "Unauthorized" ? 401 : 403 });
    }

    const criteria = await evaluationCriteriaDbApi.getAll();

    return NextResponse.json(criteria);
  } catch (error) {
    console.error("Error fetching evaluation criteria:", error);
    return NextResponse.json(
      { error: "Failed to fetch evaluation criteria" },
      { status: 500 }
    );
  }
}

// POST /api/evaluation-criteria - Create new evaluation criteria (admin only)
export async function POST(request: NextRequest) {
  try {
    const { isAdmin, session, error } = await checkAdminAccess();

    if (!isAdmin) {
      return NextResponse.json({ error }, { status: error === "Unauthorized" ? 401 : 403 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.field || !body.operator || !body.action) {
      return NextResponse.json(
        { error: "Missing required fields: name, field, operator, action" },
        { status: 400 }
      );
    }

    // Validate field is a valid Client field
    const validFields: (keyof Client)[] = [
      "firstName", "lastName", "email", "phone", "age",
      "paymentType", "insuranceProvider", "requestedClinician",
      "presentingConcerns", "suicideAttemptRecent",
      "psychiatricHospitalization", "additionalInfo"
    ];

    if (!validFields.includes(body.field)) {
      return NextResponse.json(
        { error: `Invalid field: ${body.field}` },
        { status: 400 }
      );
    }

    const criteria = await evaluationCriteriaDbApi.create({
      name: body.name,
      description: body.description,
      field: body.field,
      operator: body.operator,
      value: body.value || "",
      action: body.action,
      priority: body.priority || 0,
      isActive: body.isActive ?? true,
    });

    // Log the action
    await auditLogDbApi.log({
      userId: session!.user?.email || "unknown",
      userEmail: session!.user?.email || "unknown",
      action: "create",
      entityType: "settings",
      entityId: criteria.id,
      newValue: JSON.stringify(criteria),
    });

    return NextResponse.json(criteria, { status: 201 });
  } catch (error) {
    console.error("Error creating evaluation criteria:", error);
    return NextResponse.json(
      { error: "Failed to create evaluation criteria" },
      { status: 500 }
    );
  }
}

// PUT /api/evaluation-criteria - Bulk update evaluation criteria (admin only)
export async function PUT(request: NextRequest) {
  try {
    const { isAdmin, session, error } = await checkAdminAccess();

    if (!isAdmin) {
      return NextResponse.json({ error }, { status: error === "Unauthorized" ? 401 : 403 });
    }

    const body = await request.json();

    if (!body.criteria || !Array.isArray(body.criteria)) {
      return NextResponse.json(
        { error: "Missing criteria array" },
        { status: 400 }
      );
    }

    const results: EvaluationCriteria[] = [];

    for (const item of body.criteria) {
      if (item.id) {
        // Update existing
        const updated = await evaluationCriteriaDbApi.update(item.id, item);
        if (updated) results.push(updated);
      } else {
        // Create new
        const created = await evaluationCriteriaDbApi.create({
          name: item.name,
          description: item.description,
          field: item.field,
          operator: item.operator,
          value: item.value || "",
          action: item.action,
          priority: item.priority || 0,
          isActive: item.isActive ?? true,
        });
        results.push(created);
      }
    }

    // Log the bulk action
    await auditLogDbApi.log({
      userId: session!.user?.email || "unknown",
      userEmail: session!.user?.email || "unknown",
      action: "bulk_update",
      entityType: "settings",
      entityId: "evaluation_criteria",
      newValue: `Updated ${results.length} criteria`,
    });

    return NextResponse.json({ criteria: results });
  } catch (error) {
    console.error("Error updating evaluation criteria:", error);
    return NextResponse.json(
      { error: "Failed to update evaluation criteria" },
      { status: 500 }
    );
  }
}
