import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { clientsDbApi, settingsDbApi, auditLogDbApi } from "@/lib/api/prisma-db";
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
import { TextEvaluationResult } from "@/types/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/clients/[id]/evaluate-text
 *
 * Runs text evaluation on client's free-text fields (presentingConcerns, additionalInfo)
 * using a hybrid approach: pattern matching first, then LLM if needed.
 */
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

    // Combine text fields for evaluation
    const textToEvaluate = [
      client.presentingConcerns || "",
      client.additionalInfo || "",
    ]
      .filter((t) => t.trim().length > 0)
      .join("\n\n");

    // If no text to evaluate, return empty result
    if (!textToEvaluate.trim()) {
      const emptyResult: TextEvaluationResult = {
        method: "pattern",
        flags: [],
        overallSeverity: "none",
        llmUsed: false,
        evaluatedAt: new Date().toISOString(),
      };

      return NextResponse.json({
        success: true,
        result: emptyResult,
        client,
      });
    }

    // Fetch LLM settings from SQLite
    const llmSettings = await settingsDbApi.getLLMSettings();

    // Get evaluation rules (use defaults for now, later can load from sheet)
    const rules = getDefaultRulesWithIds();

    // Phase 1: Pattern matching
    const patternResult = evaluateTextWithPatterns(textToEvaluate, rules);
    const patternSeverity = getHighestSeverity(patternResult.flags);

    let finalResult: TextEvaluationResult;

    // Determine if LLM should be used (pass settings)
    const useLLM = shouldUseLLM(patternSeverity, patternResult.needsLLM, llmSettings);

    if (useLLM) {
      // Phase 2: LLM evaluation
      const llmResult = await evaluateTextWithLLM(textToEvaluate, llmSettings);

      if (llmResult) {
        // Merge pattern and LLM results
        finalResult = mergeEvaluationResults(
          patternResult.flags,
          llmResult.flags,
          llmResult.model,
          llmResult.tokensUsed
        );
        finalResult.rawResponse = llmResult.rawResponse;
      } else {
        // LLM failed or disabled, use pattern-only result
        finalResult = createPatternEvaluationResult(patternResult.flags);
      }
    } else {
      // Pattern-only result (clear high-severity flags don't need LLM)
      finalResult = createPatternEvaluationResult(patternResult.flags);
    }

    // Store result in client record
    const updatedClient = await clientsDbApi.update(id, {
      textEvaluationResult: JSON.stringify(finalResult),
    });

    // Log the evaluation
    await auditLogDbApi.log({
      userId: session.user?.email || "unknown",
      userEmail: session.user?.email || "unknown",
      action: "text_evaluate",
      entityType: "client",
      entityId: id,
      previousValue: client.textEvaluationResult || "null",
      newValue: JSON.stringify({
        method: finalResult.method,
        flagCount: finalResult.flags.length,
        overallSeverity: finalResult.overallSeverity,
        llmUsed: finalResult.llmUsed,
      }),
    });

    return NextResponse.json({
      success: true,
      result: finalResult,
      client: updatedClient,
    });
  } catch (error) {
    console.error("Error evaluating client text:", error);
    return NextResponse.json(
      { error: "Failed to evaluate client text" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/clients/[id]/evaluate-text
 *
 * Returns the stored text evaluation result for a client
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Parse stored result
    let result: TextEvaluationResult | null = null;
    if (client.textEvaluationResult) {
      try {
        result = JSON.parse(client.textEvaluationResult);
      } catch {
        // Invalid JSON stored
        result = null;
      }
    }

    return NextResponse.json({
      success: true,
      result,
      hasResult: result !== null,
    });
  } catch (error) {
    console.error("Error fetching text evaluation:", error);
    return NextResponse.json(
      { error: "Failed to fetch text evaluation" },
      { status: 500 }
    );
  }
}
