import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { clientsDbApi, evaluationCriteriaDbApi, settingsDbApi, auditLogDbApi } from "@/lib/api/prisma-db";
import {
  evaluateClient,
  checkForReferralKeywords,
} from "@/lib/services/evaluation";
import {
  evaluateTextWithPatterns,
  getDefaultRulesWithIds,
  mergeEvaluationResults,
  createPatternEvaluationResult,
  getHighestSeverity,
} from "@/lib/services/text-evaluation";
import {
  evaluateTextWithLLM,
  shouldUseLLM,
} from "@/lib/services/vertex-ai";
import { ClientStatus, TextEvaluationResult } from "@/types/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/clients/[id]/evaluate - Run evaluation on a client
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Fetch client
    const client = await clientsDbApi.getById(id);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Fetch evaluation criteria from SQLite
    const criteria = await evaluationCriteriaDbApi.getActive();

    // Run evaluation
    const result = evaluateClient(client, criteria);

    // Check for referral keywords in presenting concerns
    const keywordCheck = checkForReferralKeywords(
      client.presentingConcerns || ""
    );

    // Run text evaluation on free-text fields
    let textEvalResult: TextEvaluationResult | null = null;
    const textToEvaluate = [
      client.presentingConcerns || "",
      client.additionalInfo || "",
    ]
      .filter((t) => t.trim().length > 0)
      .join("\n\n");

    if (textToEvaluate.trim()) {
      // Fetch LLM settings from SQLite
      const llmSettings = await settingsDbApi.getLLMSettings();

      const rules = getDefaultRulesWithIds();
      const patternResult = evaluateTextWithPatterns(textToEvaluate, rules);
      const patternSeverity = getHighestSeverity(patternResult.flags);

      // Determine if LLM should be used (pass settings)
      const useLLM = shouldUseLLM(patternSeverity, patternResult.needsLLM, llmSettings);

      if (useLLM) {
        const llmResult = await evaluateTextWithLLM(textToEvaluate, llmSettings);
        if (llmResult) {
          textEvalResult = mergeEvaluationResults(
            patternResult.flags,
            llmResult.flags,
            llmResult.model,
            llmResult.tokensUsed
          );
          textEvalResult.rawResponse = llmResult.rawResponse;
        } else {
          textEvalResult = createPatternEvaluationResult(patternResult.flags);
        }
      } else {
        textEvalResult = createPatternEvaluationResult(patternResult.flags);
      }
    }

    // Check if text evaluation found concerning flags
    const hasTextEvalFlags = textEvalResult && textEvalResult.flags.length > 0;
    const textEvalSeverity = textEvalResult?.overallSeverity || "none";
    const hasUrgentTextFlags = textEvalSeverity === "urgent";

    // Determine new status based on evaluation result
    let newStatus: ClientStatus;
    let referralReason: string | undefined;
    const hasFlagsOrKeywords = result.flags.length > 0 || keywordCheck.flagged || hasTextEvalFlags;

    if (result.hasUrgent || hasUrgentTextFlags) {
      // Urgent flags go straight to pending referral
      newStatus = "pending_referral";
      if (hasUrgentTextFlags && textEvalResult) {
        const urgentFlag = textEvalResult.flags.find((f) => f.severity === "urgent");
        referralReason = urgentFlag
          ? `Text evaluation: ${urgentFlag.category} - ${urgentFlag.matchedText}`
          : result.flags.find((f) => f.action === "flag_urgent")?.criteriaName;
      } else {
        referralReason = result.flags.find((f) => f.action === "flag_urgent")?.criteriaName;
      }
    } else if (hasFlagsOrKeywords) {
      // Any flags or keywords = evaluation complete but flagged (red)
      newStatus = "evaluation_flagged";
      if (keywordCheck.flagged) {
        referralReason = `Keywords: ${keywordCheck.keywords.join(", ")}`;
      } else if (hasTextEvalFlags && textEvalResult) {
        const highestFlag = textEvalResult.flags[0];
        referralReason = `Text evaluation: ${highestFlag.category} (${highestFlag.severity})`;
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

    // Add text evaluation notes
    if (textEvalResult && textEvalResult.flags.length > 0) {
      notes.push(`\n--- Text Evaluation (${textEvalResult.method}) ---`);
      for (const flag of textEvalResult.flags) {
        notes.push(`[${flag.severity.toUpperCase()}] ${flag.category}: "${flag.matchedText}"`);
        if (flag.reasoning) {
          notes.push(`  Reasoning: ${flag.reasoning}`);
        }
      }
    }

    // Update client with evaluation results
    const updatedClient = await clientsDbApi.update(id, {
      status: newStatus,
      evaluationNotes: notes.join("\n"),
      referralReason,
      textEvaluationResult: textEvalResult ? JSON.stringify(textEvalResult) : undefined,
    });

    // Log the action
    await auditLogDbApi.log({
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
        criteriaFlags: result.flags.length,
        hasUrgent: result.hasUrgent || hasUrgentTextFlags,
        textEvaluation: textEvalResult
          ? {
              method: textEvalResult.method,
              flagCount: textEvalResult.flags.length,
              overallSeverity: textEvalResult.overallSeverity,
              llmUsed: textEvalResult.llmUsed,
            }
          : null,
      }),
    });

    return NextResponse.json({
      success: true,
      result,
      textEvaluationResult: textEvalResult,
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
