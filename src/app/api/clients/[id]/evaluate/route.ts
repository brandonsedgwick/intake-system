import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { clientsApi, auditLogApi, evaluationCriteriaApi } from "@/lib/api/google-sheets";
import {
  evaluateClient,
  checkForReferralKeywords,
  EvaluationResult,
} from "@/lib/services/evaluation";
import { ClientStatus } from "@/types/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/clients/[id]/evaluate - Run evaluation on a client
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Fetch client
    const client = await clientsApi.getById(session.accessToken, id);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Fetch evaluation criteria from sheet
    const criteria = await evaluationCriteriaApi.getActive(session.accessToken);

    // Run evaluation
    const result = evaluateClient(client, criteria);

    // Check for referral keywords in presenting concerns
    const keywordCheck = checkForReferralKeywords(
      client.presentingConcerns || ""
    );

    // Determine new status based on evaluation result
    let newStatus: ClientStatus;
    let referralReason: string | undefined;
    const hasFlagsOrKeywords = result.flags.length > 0 || keywordCheck.flagged;

    if (result.hasUrgent) {
      // Urgent flags go straight to pending referral
      newStatus = "pending_referral";
      referralReason = result.flags.find((f) => f.action === "flag_urgent")?.criteriaName;
    } else if (hasFlagsOrKeywords) {
      // Any flags or keywords = evaluation complete but flagged (red)
      newStatus = "evaluation_flagged";
      if (keywordCheck.flagged) {
        referralReason = `Keywords: ${keywordCheck.keywords.join(", ")}`;
      }
    } else {
      // No flags = evaluation complete (green)
      newStatus = "evaluation_complete";
    }

    // Build evaluation notes
    const notes = [
      ...result.flags.map((f) => `[${f.action}] ${f.criteriaName}: ${f.matchedValue}`),
    ];

    if (keywordCheck.flagged) {
      notes.push(`Keywords detected: ${keywordCheck.keywords.join(", ")}`);
    }

    // Update client with evaluation results
    const updatedClient = await clientsApi.update(session.accessToken, id, {
      status: newStatus,
      evaluationNotes: notes.join("\n"),
      referralReason,
    });

    // Log the action
    await auditLogApi.log(session.accessToken, {
      userId: session.user?.email || "unknown",
      userEmail: session.user?.email || "unknown",
      action: "evaluate",
      entityType: "client",
      entityId: id,
      previousValue: JSON.stringify({
        status: client.status,
      }),
      newValue: JSON.stringify({
        status: newStatus,
        flags: result.flags.length,
        hasUrgent: result.hasUrgent,
      }),
    });

    return NextResponse.json({
      success: true,
      result,
      newStatus,
      client: updatedClient,
    });
  } catch (error) {
    console.error("Error evaluating client:", error);
    return NextResponse.json(
      { error: "Failed to evaluate client" },
      { status: 500 }
    );
  }
}
