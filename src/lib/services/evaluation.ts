import { Client, EvaluationCriteria, EvaluationAction } from "@/types/client";

export interface EvaluationResult {
  clientId: string;
  flags: EvaluationFlag[];
  hasUrgent: boolean;
  needsReview: boolean;
  evaluatedAt: string;
}

export interface EvaluationFlag {
  criteriaId: string;
  criteriaName: string;
  field: keyof Client;
  action: EvaluationAction;
  matchedValue: string;
  message: string;
}

/**
 * Evaluate a field against a criterion
 */
function evaluateField(
  client: Client,
  criterion: EvaluationCriteria
): { matched: boolean; value: string } {
  const fieldValue = client[criterion.field];
  const valueStr = String(fieldValue || "");

  switch (criterion.operator) {
    case "exists":
      return { matched: !!fieldValue && valueStr.trim() !== "", value: valueStr };

    case "not_exists":
      return { matched: !fieldValue || valueStr.trim() === "", value: valueStr };

    case "equals":
      return {
        matched: valueStr.toLowerCase() === criterion.value.toLowerCase(),
        value: valueStr,
      };

    case "not_equals":
      return {
        matched: valueStr.toLowerCase() !== criterion.value.toLowerCase(),
        value: valueStr,
      };

    case "contains":
      return {
        matched: valueStr.toLowerCase().includes(criterion.value.toLowerCase()),
        value: valueStr,
      };

    case "not_contains":
      return {
        matched: !valueStr.toLowerCase().includes(criterion.value.toLowerCase()),
        value: valueStr,
      };

    case "contains_any": {
      const keywords = criterion.value.split(",").map((v) => v.trim().toLowerCase());
      const found = keywords.filter((keyword) =>
        valueStr.toLowerCase().includes(keyword)
      );
      return {
        matched: found.length > 0,
        value: found.join(", "),
      };
    }

    case "contains_all": {
      const keywords = criterion.value.split(",").map((v) => v.trim().toLowerCase());
      const allFound = keywords.every((keyword) =>
        valueStr.toLowerCase().includes(keyword)
      );
      return {
        matched: allFound,
        value: valueStr,
      };
    }

    case "in_list": {
      const listValues = criterion.value.split(",").map((v) => v.trim().toLowerCase());
      return {
        matched: listValues.includes(valueStr.toLowerCase()),
        value: valueStr,
      };
    }

    case "not_in_list": {
      const excludeValues = criterion.value.split(",").map((v) => v.trim().toLowerCase());
      return {
        matched: !excludeValues.includes(valueStr.toLowerCase()),
        value: valueStr,
      };
    }

    case "regex":
      try {
        const regex = new RegExp(criterion.value, "i");
        const match = valueStr.match(regex);
        return {
          matched: !!match,
          value: match ? match[0] : valueStr,
        };
      } catch {
        return { matched: false, value: valueStr };
      }

    default:
      return { matched: false, value: valueStr };
  }
}

/**
 * Evaluate a client against all criteria
 */
export function evaluateClient(
  client: Client,
  criteria: EvaluationCriteria[]
): EvaluationResult {
  const activeCriteria = criteria.filter((c) => c.isActive);
  const flags: EvaluationFlag[] = [];

  // Sort by priority (lower = first)
  const sortedCriteria = [...activeCriteria].sort((a, b) => a.priority - b.priority);

  for (const criterion of sortedCriteria) {
    const { matched, value } = evaluateField(client, criterion);

    if (matched) {
      flags.push({
        criteriaId: criterion.id,
        criteriaName: criterion.name,
        field: criterion.field,
        action: criterion.action,
        matchedValue: value,
        message: criterion.description || `Matched: ${criterion.name}`,
      });
    }
  }

  return {
    clientId: client.id,
    flags,
    hasUrgent: flags.some((f) => f.action === "flag_urgent"),
    needsReview: flags.some((f) => f.action === "flag_review"),
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Evaluate multiple clients
 */
export function evaluateClients(
  clients: Client[],
  criteria: EvaluationCriteria[]
): Map<string, EvaluationResult> {
  const results = new Map<string, EvaluationResult>();

  for (const client of clients) {
    results.set(client.id, evaluateClient(client, criteria));
  }

  return results;
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
