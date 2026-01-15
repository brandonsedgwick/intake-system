import { Client, EvaluationCriteria } from "@/types/client";

export interface EvaluationResult {
  score: number;
  action: "accept" | "referral" | "review";
  notes: string[];
  matchedCriteria: EvaluationCriteria[];
  referralReason?: string;
}

/**
 * Default evaluation criteria if none are configured in the sheet
 */
const DEFAULT_CRITERIA: EvaluationCriteria[] = [
  {
    id: "default-1",
    name: "Has Email",
    type: "required",
    field: "email",
    operator: "exists",
    value: "",
    action: "continue",
    weight: 10,
    isActive: true,
  },
  {
    id: "default-2",
    name: "Has Name",
    type: "required",
    field: "firstName",
    operator: "exists",
    value: "",
    action: "continue",
    weight: 10,
    isActive: true,
  },
  {
    id: "default-3",
    name: "Has Insurance",
    type: "scoring",
    field: "insuranceProvider",
    operator: "exists",
    value: "",
    action: "continue",
    weight: 20,
    isActive: true,
  },
  {
    id: "default-4",
    name: "Has Phone",
    type: "scoring",
    field: "phone",
    operator: "exists",
    value: "",
    action: "continue",
    weight: 10,
    isActive: true,
  },
];

/**
 * Evaluate a field against a criterion
 */
function evaluateField(
  client: Client,
  criterion: EvaluationCriteria
): boolean {
  const fieldValue = client[criterion.field as keyof Client];

  switch (criterion.operator) {
    case "exists":
      return !!fieldValue && String(fieldValue).trim() !== "";

    case "not_exists":
      return !fieldValue || String(fieldValue).trim() === "";

    case "equals":
      return String(fieldValue).toLowerCase() === criterion.value.toLowerCase();

    case "not_equals":
      return String(fieldValue).toLowerCase() !== criterion.value.toLowerCase();

    case "contains":
      return String(fieldValue || "")
        .toLowerCase()
        .includes(criterion.value.toLowerCase());

    case "not_contains":
      return !String(fieldValue || "")
        .toLowerCase()
        .includes(criterion.value.toLowerCase());

    case "in_list":
      const listValues = criterion.value.split(",").map((v) => v.trim().toLowerCase());
      return listValues.includes(String(fieldValue || "").toLowerCase());

    case "not_in_list":
      const excludeValues = criterion.value.split(",").map((v) => v.trim().toLowerCase());
      return !excludeValues.includes(String(fieldValue || "").toLowerCase());

    case "regex":
      try {
        const regex = new RegExp(criterion.value, "i");
        return regex.test(String(fieldValue || ""));
      } catch {
        return false;
      }

    default:
      return false;
  }
}

/**
 * Evaluate a client against all criteria
 */
export function evaluateClient(
  client: Client,
  criteria?: EvaluationCriteria[]
): EvaluationResult {
  const activeCriteria = (criteria || DEFAULT_CRITERIA).filter((c) => c.isActive);
  const matchedCriteria: EvaluationCriteria[] = [];
  const notes: string[] = [];
  let score = 0;
  let maxPossibleScore = 0;
  let action: EvaluationResult["action"] = "accept";
  let referralReason: string | undefined;

  // Process required criteria first
  const requiredCriteria = activeCriteria.filter((c) => c.type === "required");
  for (const criterion of requiredCriteria) {
    const passed = evaluateField(client, criterion);
    if (passed) {
      matchedCriteria.push(criterion);
      notes.push(`✓ ${criterion.name}`);
    } else {
      notes.push(`✗ ${criterion.name} (required)`);
      if (criterion.action === "reject" || criterion.action === "referral") {
        action = "referral";
        referralReason = criterion.name;
      }
    }
  }

  // Process scoring criteria
  const scoringCriteria = activeCriteria.filter((c) => c.type === "scoring");
  for (const criterion of scoringCriteria) {
    maxPossibleScore += criterion.weight;
    const passed = evaluateField(client, criterion);
    if (passed) {
      score += criterion.weight;
      matchedCriteria.push(criterion);
      notes.push(`✓ ${criterion.name} (+${criterion.weight})`);
    } else {
      notes.push(`○ ${criterion.name} (not matched)`);
    }
  }

  // Process referral criteria (keywords, specific conditions)
  const referralCriteria = activeCriteria.filter((c) => c.type === "referral");
  for (const criterion of referralCriteria) {
    const triggered = evaluateField(client, criterion);
    if (triggered) {
      matchedCriteria.push(criterion);
      notes.push(`⚠ ${criterion.name} - Referral triggered`);
      action = "referral";
      referralReason = criterion.name;
    }
  }

  // Normalize score to 0-100
  const normalizedScore = maxPossibleScore > 0
    ? Math.round((score / maxPossibleScore) * 100)
    : 100;

  // Determine final action based on score if not already set to referral
  if (action === "accept") {
    if (normalizedScore < 40) {
      action = "review";
      notes.push("Low score - manual review recommended");
    }
  }

  return {
    score: normalizedScore,
    action,
    notes,
    matchedCriteria,
    referralReason,
  };
}

/**
 * Check if a client matches insurance with any clinician
 */
export function checkInsuranceMatch(
  clientInsurance: string,
  clinicianPanels: string[]
): boolean {
  if (!clientInsurance) return true; // No insurance = self-pay, any clinician works

  const normalizedClientInsurance = clientInsurance.toLowerCase().trim();
  return clinicianPanels.some(
    (panel) => panel.toLowerCase().trim() === normalizedClientInsurance
  );
}

/**
 * Flag keywords that might indicate referral is needed
 */
const REFERRAL_KEYWORDS = [
  "suicid",
  "self-harm",
  "eating disorder",
  "anorexia",
  "bulimia",
  "substance abuse",
  "addiction",
  "psychosis",
  "schizophren",
  "bipolar",
  "inpatient",
  "hospitali",
];

/**
 * Check presenting concerns for referral keywords
 */
export function checkForReferralKeywords(presentingConcerns: string): {
  flagged: boolean;
  keywords: string[];
} {
  if (!presentingConcerns) {
    return { flagged: false, keywords: [] };
  }

  const lowerConcerns = presentingConcerns.toLowerCase();
  const foundKeywords = REFERRAL_KEYWORDS.filter((keyword) =>
    lowerConcerns.includes(keyword)
  );

  return {
    flagged: foundKeywords.length > 0,
    keywords: foundKeywords,
  };
}
