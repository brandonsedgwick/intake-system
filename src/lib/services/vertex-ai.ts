import {
  TextEvaluationCategory,
  TextEvaluationSeverity,
  TextEvaluationFlag,
  TextEvaluationResult,
} from "@/types/client";
import { getHighestSeverity } from "./text-evaluation";

// LLM evaluation prompt for clinical text analysis
const EVALUATION_PROMPT = `You are a clinical intake assistant helping evaluate therapy intake forms for a mental health practice.
Your role is to identify potential clinical concerns that warrant human review.

IMPORTANT GUIDELINES:
- This is for FLAGGING purposes only - not diagnosis
- Be conservative: flag anything that warrants human review by a licensed clinician
- Provide brief, factual reasoning for each flag
- If something is ambiguous, flag it for review rather than dismissing it
- Consider context: "I used to struggle with X" is different from "I am currently struggling with X"

Analyze the following text for clinical concerns:

"""
{text}
"""

Evaluate for these categories and assign severity levels:
1. Suicidal ideation: none | passive (wishes to not exist) | active (intent) | urgent (plan or immediate risk)
2. Self-harm: none | historical | current
3. Substance use: none | historical | current | severe (dependency/daily use)
4. Psychosis indicators: none | possible | likely
5. Eating disorder: none | possible | likely
6. Hospitalization: none | past | recent (within 6 months)
7. Violence/safety: none | possible | likely
8. Abuse/trauma: none | historical | current/ongoing

Map severity to:
- urgent: Active suicidal ideation with plan, immediate safety concerns
- high: Active suicidal ideation, current self-harm, current severe substance use, violence concerns
- medium: Passive suicidal ideation, current substance use, possible psychosis, hospitalization history
- low: Historical concerns, possible eating disorder, historical trauma

Return your analysis as valid JSON only (no markdown, no code blocks):
{
  "flags": [
    {
      "category": "category_name",
      "severity": "none|low|medium|high|urgent",
      "matchedText": "brief relevant quote from text (max 50 chars)",
      "reasoning": "brief explanation (max 100 chars)"
    }
  ],
  "summary": "1-2 sentence summary for intake coordinator"
}

Only include flags with severity > "none". If no concerns found, return empty flags array.
Return ONLY the JSON object, no other text.`;

// Interface for LLM response
interface LLMEvaluationResponse {
  flags: {
    category: string;
    severity: string;
    matchedText: string;
    reasoning: string;
  }[];
  summary: string;
}

/**
 * Validate and map category from LLM response
 */
function mapCategory(category: string): TextEvaluationCategory | null {
  const categoryMap: Record<string, TextEvaluationCategory> = {
    suicidal_ideation: "suicidal_ideation",
    suicidal: "suicidal_ideation",
    suicide: "suicidal_ideation",
    self_harm: "self_harm",
    selfharm: "self_harm",
    "self-harm": "self_harm",
    substance_use: "substance_use",
    substance: "substance_use",
    addiction: "substance_use",
    psychosis: "psychosis",
    eating_disorder: "eating_disorder",
    eating: "eating_disorder",
    hospitalization: "hospitalization",
    hospital: "hospitalization",
    violence: "violence",
    safety: "violence",
    abuse: "abuse",
    trauma: "abuse",
  };

  const normalized = category.toLowerCase().replace(/\s+/g, "_");
  return categoryMap[normalized] || null;
}

/**
 * Validate and map severity from LLM response
 */
function mapSeverity(severity: string): TextEvaluationSeverity {
  const severityMap: Record<string, TextEvaluationSeverity> = {
    none: "none",
    low: "low",
    medium: "medium",
    moderate: "medium",
    high: "high",
    urgent: "urgent",
    critical: "urgent",
  };

  const normalized = severity.toLowerCase().trim();
  return severityMap[normalized] || "medium";
}

/**
 * Parse LLM response JSON
 */
function parseLLMResponse(responseText: string): LLMEvaluationResponse | null {
  try {
    // Try to extract JSON from response (in case there's extra text)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in LLM response");
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (!Array.isArray(parsed.flags)) {
      console.error("Invalid LLM response: flags is not an array");
      return null;
    }

    return {
      flags: parsed.flags || [],
      summary: parsed.summary || "",
    };
  } catch (error) {
    console.error("Failed to parse LLM response:", error);
    return null;
  }
}

/**
 * Convert LLM response to TextEvaluationFlags
 */
function convertLLMFlags(response: LLMEvaluationResponse): TextEvaluationFlag[] {
  const flags: TextEvaluationFlag[] = [];

  for (const flag of response.flags) {
    const category = mapCategory(flag.category);
    if (!category) {
      console.warn(`Unknown category from LLM: ${flag.category}`);
      continue;
    }

    const severity = mapSeverity(flag.severity);
    if (severity === "none") {
      continue; // Skip "none" severity flags
    }

    flags.push({
      category,
      severity,
      matchedText: flag.matchedText || "",
      context: flag.matchedText || "", // LLM provides context in matchedText
      reasoning: flag.reasoning,
    });
  }

  return flags;
}

/**
 * LLM configuration settings
 */
export interface LLMSettings {
  textEvaluationLLMEnabled?: string;
  textEvaluationLLMThreshold?: string;
  googleCloudProject?: string;
  vertexAILocation?: string;
}

/**
 * Evaluate text using Vertex AI Gemini
 *
 * Note: This requires the @google-cloud/vertexai package and proper
 * Google Cloud credentials configured.
 *
 * @param text The text to evaluate
 * @param settings Optional settings from database (falls back to env vars)
 */
export async function evaluateTextWithLLM(
  text: string,
  settings?: LLMSettings
): Promise<{
  flags: TextEvaluationFlag[];
  model: string;
  tokensUsed: number;
  rawResponse: string;
} | null> {
  // Check if LLM evaluation is enabled (database settings take precedence over env vars)
  const llmEnabled = settings?.textEvaluationLLMEnabled ?? process.env.TEXT_EVALUATION_LLM_ENABLED;
  if (llmEnabled !== "true") {
    console.log("LLM text evaluation is disabled");
    return null;
  }

  // Get configuration (database settings take precedence over env vars)
  const projectId = settings?.googleCloudProject || process.env.GOOGLE_CLOUD_PROJECT;
  const location = settings?.vertexAILocation || process.env.VERTEX_AI_LOCATION || "us-central1";

  if (!projectId) {
    console.error("Google Cloud Project ID is not configured");
    return null;
  }

  try {
    // Dynamic import to avoid errors if package not installed
    const { VertexAI } = await import("@google-cloud/vertexai");

    const vertexAI = new VertexAI({
      project: projectId,
      location: location,
    });

    const model = vertexAI.getGenerativeModel({
      model: "gemini-1.5-flash", // Use flash for faster/cheaper evaluation
    });

    // Prepare prompt
    const prompt = EVALUATION_PROMPT.replace("{text}", text);

    // Generate response
    const result = await model.generateContent(prompt);
    const response = result.response;
    const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Get token usage
    const tokensUsed = response.usageMetadata?.totalTokenCount || 0;

    // Parse response
    const parsed = parseLLMResponse(responseText);
    if (!parsed) {
      console.error("Failed to parse LLM response");
      return {
        flags: [],
        model: "gemini-1.5-flash",
        tokensUsed,
        rawResponse: responseText,
      };
    }

    // Convert to flags
    const flags = convertLLMFlags(parsed);

    return {
      flags,
      model: "gemini-1.5-flash",
      tokensUsed,
      rawResponse: responseText,
    };
  } catch (error) {
    console.error("Error calling Vertex AI:", error);
    return null;
  }
}

/**
 * Create an LLM-only evaluation result
 */
export function createLLMEvaluationResult(
  flags: TextEvaluationFlag[],
  model: string,
  tokensUsed: number,
  rawResponse?: string
): TextEvaluationResult {
  return {
    method: "llm",
    flags,
    overallSeverity: getHighestSeverity(flags),
    llmUsed: true,
    llmModel: model,
    llmTokensUsed: tokensUsed,
    evaluatedAt: new Date().toISOString(),
    rawResponse,
  };
}

/**
 * Check if LLM evaluation should be triggered based on threshold
 *
 * @param patternSeverity The severity from pattern matching
 * @param needsLLMFromPatterns Whether patterns explicitly require LLM
 * @param settings Optional settings from database (falls back to env vars)
 */
export function shouldUseLLM(
  patternSeverity: TextEvaluationSeverity,
  needsLLMFromPatterns: boolean,
  settings?: LLMSettings
): boolean {
  // If patterns explicitly require LLM review, always use it
  if (needsLLMFromPatterns) {
    return true;
  }

  // Check threshold setting (database settings take precedence over env vars)
  const threshold = settings?.textEvaluationLLMThreshold || process.env.TEXT_EVALUATION_LLM_THRESHOLD || "medium";
  const severityOrder: TextEvaluationSeverity[] = ["none", "low", "medium", "high", "urgent"];
  const thresholdIndex = severityOrder.indexOf(threshold as TextEvaluationSeverity);
  const severityIndex = severityOrder.indexOf(patternSeverity);

  // Use LLM if severity is at or below threshold (more uncertain = more likely to need LLM)
  // For example, if threshold is "medium", use LLM for none, low, medium
  return severityIndex <= thresholdIndex;
}
