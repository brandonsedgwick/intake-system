import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { clientsApi, auditLogApi } from "@/lib/api/google-sheets";
import {
  evaluateClient,
  checkForReferralKeywords,
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

    // TODO: Fetch custom criteria from EvaluationCriteria sheet
    // For now, use default criteria

    // Run evaluation
    const result = evaluateClient(client);

    // Check for referral keywords in presenting concerns
    const keywordCheck = checkForReferralKeywords(
      client.presentingConcerns || ""
    );

    if (keywordCheck.flagged) {
      result.notes.push(
        `⚠ Referral keywords detected: ${keywordCheck.keywords.join(", ")}`
      );
      if (result.action !== "referral") {
        result.action = "review";
      }
    }

    // Determine new status based on evaluation result
    let newStatus: ClientStatus;
    switch (result.action) {
      case "accept":
        newStatus = "pending_outreach";
        break;
      case "referral":
        newStatus = "pending_referral";
        break;
      case "review":
        newStatus = "pending_evaluation"; // Keep in pending for manual review
        break;
      default:
        newStatus = "pending_outreach";
    }

    // Update client with evaluation results
    const updatedClient = await clientsApi.update(session.accessToken, id, {
      status: newStatus,
      evaluationScore: result.score,
      evaluationNotes: result.notes.join("\n"),
      referralReason: result.referralReason,
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
        evaluationScore: client.evaluationScore,
      }),
      newValue: JSON.stringify({
        status: newStatus,
        evaluationScore: result.score,
        action: result.action,
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
