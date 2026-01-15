import {
  TextEvaluationCategory,
  TextEvaluationSeverity,
  TextEvaluationFlag,
  TextEvaluationResult,
  TextEvaluationRule,
} from "@/types/client";

// Default negation words that negate a match when found before it
const DEFAULT_NEGATION_WORDS = [
  "never",
  "not",
  "don't",
  "dont",
  "no",
  "haven't",
  "havent",
  "wouldn't",
  "wouldnt",
  "didn't",
  "didnt",
  "wasn't",
  "wasnt",
  "isn't",
  "isnt",
  "aren't",
  "arent",
  "won't",
  "wont",
  "can't",
  "cant",
  "without",
  "denied",
  "denies",
];

// Default clinical patterns for text evaluation
export const DEFAULT_TEXT_EVALUATION_RULES: Omit<TextEvaluationRule, "id" | "createdAt" | "updatedAt">[] = [
  // Suicidal Ideation - Active (Urgent)
  {
    name: "Active Suicidal Ideation",
    category: "suicidal_ideation",
    severity: "urgent",
    patterns: [
      "want to die",
      "want to kill myself",
      "going to kill myself",
      "planning to end my life",
      "planning to end it",
      "plan to kill myself",
      "will kill myself",
      "ready to die",
      "going to end it",
      "going to end my life",
    ],
    isRegex: false,
    negationWords: DEFAULT_NEGATION_WORDS,
    negationWindow: 5,
    requiresLLM: false,
    isActive: true,
  },
  // Suicidal Ideation - Passive (High)
  {
    name: "Passive Suicidal Ideation",
    category: "suicidal_ideation",
    severity: "high",
    patterns: [
      "wish I was dead",
      "wish I wasn't alive",
      "wish i wasnt alive",
      "better off dead",
      "don't want to be here",
      "dont want to be here",
      "don't want to live",
      "dont want to live",
      "life isn't worth",
      "life isnt worth",
      "what's the point",
      "whats the point",
      "no reason to live",
      "tired of living",
    ],
    isRegex: false,
    negationWords: DEFAULT_NEGATION_WORDS,
    negationWindow: 5,
    requiresLLM: true, // Ambiguous phrases - needs LLM confirmation
    isActive: true,
  },
  // Self-Harm (High)
  {
    name: "Self-Harm",
    category: "self_harm",
    severity: "high",
    patterns: [
      "cutting myself",
      "hurting myself",
      "burning myself",
      "self-harm",
      "self harm",
      "harming myself",
      "hitting myself",
      "scratching myself",
    ],
    isRegex: false,
    negationWords: DEFAULT_NEGATION_WORDS,
    negationWindow: 5,
    requiresLLM: false,
    isActive: true,
  },
  // Substance Use - Current (High)
  {
    name: "Current Substance Use",
    category: "substance_use",
    severity: "high",
    patterns: [
      "using drugs",
      "drinking every day",
      "drinking daily",
      "can't stop drinking",
      "cant stop drinking",
      "can't stop using",
      "cant stop using",
      "addicted to",
      "dependent on",
      "using heroin",
      "using meth",
      "using cocaine",
      "overdosed",
    ],
    isRegex: false,
    negationWords: DEFAULT_NEGATION_WORDS,
    negationWindow: 5,
    requiresLLM: false,
    isActive: true,
  },
  // Substance Use - Mentioned (Medium)
  {
    name: "Substance Use Mentioned",
    category: "substance_use",
    severity: "medium",
    patterns: [
      "struggle with alcohol",
      "struggle with drugs",
      "history of addiction",
      "history of substance",
      "recovering addict",
      "in recovery",
      "used to drink",
      "used to use drugs",
    ],
    isRegex: false,
    negationWords: [],
    negationWindow: 0,
    requiresLLM: true, // May be historical
    isActive: true,
  },
  // Psychosis Indicators (High)
  {
    name: "Psychosis Indicators",
    category: "psychosis",
    severity: "high",
    patterns: [
      "hearing voices",
      "hear voices",
      "seeing things",
      "see things that aren't there",
      "people are watching",
      "being followed",
      "being monitored",
      "paranoid",
      "delusions",
      "hallucinating",
      "hallucinations",
    ],
    isRegex: false,
    negationWords: DEFAULT_NEGATION_WORDS,
    negationWindow: 5,
    requiresLLM: true, // Context matters significantly
    isActive: true,
  },
  // Eating Disorder (Medium)
  {
    name: "Eating Disorder Indicators",
    category: "eating_disorder",
    severity: "medium",
    patterns: [
      "making myself throw up",
      "purging",
      "binge eating",
      "bingeing",
      "starving myself",
      "haven't eaten",
      "havent eaten",
      "restricting food",
      "anorexia",
      "bulimia",
      "afraid to eat",
    ],
    isRegex: false,
    negationWords: DEFAULT_NEGATION_WORDS,
    negationWindow: 5,
    requiresLLM: true,
    isActive: true,
  },
  // Hospitalization (Medium)
  {
    name: "Psychiatric Hospitalization",
    category: "hospitalization",
    severity: "medium",
    patterns: [
      "hospitalized",
      "inpatient",
      "psychiatric hospital",
      "psych ward",
      "mental hospital",
      "involuntary commitment",
      "5150",
      "baker act",
    ],
    isRegex: false,
    negationWords: DEFAULT_NEGATION_WORDS,
    negationWindow: 5,
    requiresLLM: false,
    isActive: true,
  },
  // Violence/Safety (High)
  {
    name: "Violence or Safety Concerns",
    category: "violence",
    severity: "high",
    patterns: [
      "want to hurt someone",
      "going to hurt someone",
      "want to kill someone",
      "thoughts of hurting",
      "thoughts of killing",
      "violent thoughts",
      "homicidal",
    ],
    isRegex: false,
    negationWords: DEFAULT_NEGATION_WORDS,
    negationWindow: 5,
    requiresLLM: false,
    isActive: true,
  },
  // Abuse - Current (High)
  {
    name: "Current Abuse",
    category: "abuse",
    severity: "high",
    patterns: [
      "being abused",
      "abusing me",
      "hitting me",
      "hurting me",
      "afraid of my partner",
      "afraid of my husband",
      "afraid of my wife",
      "domestic violence",
      "sexual abuse",
      "sexually abused",
    ],
    isRegex: false,
    negationWords: DEFAULT_NEGATION_WORDS,
    negationWindow: 5,
    requiresLLM: true,
    isActive: true,
  },
];

/**
 * Extract context around a match (surrounding sentence)
 */
function extractContext(text: string, matchStart: number, matchEnd: number): string {
  // Find start of sentence containing match
  let sentenceStart = 0;
  for (let i = matchStart - 1; i >= 0; i--) {
    if (text[i] === "." || text[i] === "!" || text[i] === "?") {
      sentenceStart = i + 1;
      break;
    }
  }

  // Find end of sentence containing match
  let sentenceEnd = text.length;
  const sentenceEnders = /[.!?]/g;
  sentenceEnders.lastIndex = matchEnd;
  const endMatch = sentenceEnders.exec(text);
  if (endMatch) {
    sentenceEnd = endMatch.index + 1;
  }

  // Trim and return
  return text.slice(sentenceStart, sentenceEnd).trim();
}

/**
 * Check if a match is negated by checking words before it
 */
function isNegated(
  text: string,
  matchStart: number,
  negationWords: string[],
  negationWindow: number
): boolean {
  if (negationWords.length === 0 || negationWindow === 0) {
    return false;
  }

  // Get text before the match
  const textBefore = text.slice(0, matchStart).toLowerCase();
  const wordsBefore = textBefore.split(/\s+/).slice(-negationWindow);

  // Check if any negation word is present
  return wordsBefore.some((word) =>
    negationWords.some((negation) => word.includes(negation.toLowerCase()))
  );
}

/**
 * Find all matches of a pattern in text
 */
function findPatternMatches(
  text: string,
  pattern: string,
  isRegex: boolean
): { start: number; end: number; matched: string }[] {
  const matches: { start: number; end: number; matched: string }[] = [];
  const lowerText = text.toLowerCase();
  const lowerPattern = pattern.toLowerCase();

  if (isRegex) {
    try {
      const regex = new RegExp(pattern, "gi");
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          matched: match[0],
        });
      }
    } catch {
      // Invalid regex - skip
    }
  } else {
    // Simple string matching with word boundaries
    let searchStart = 0;
    while (searchStart < lowerText.length) {
      const index = lowerText.indexOf(lowerPattern, searchStart);
      if (index === -1) break;

      // Check for word boundaries
      const beforeOk = index === 0 || /\s/.test(lowerText[index - 1]);
      const afterOk =
        index + lowerPattern.length >= lowerText.length ||
        /[\s.,!?;:]/.test(lowerText[index + lowerPattern.length]);

      if (beforeOk && afterOk) {
        matches.push({
          start: index,
          end: index + lowerPattern.length,
          matched: text.slice(index, index + lowerPattern.length),
        });
      }

      searchStart = index + 1;
    }
  }

  return matches;
}

/**
 * Evaluate text against pattern rules
 */
export function evaluateTextWithPatterns(
  text: string,
  rules: TextEvaluationRule[]
): { flags: TextEvaluationFlag[]; needsLLM: boolean } {
  const flags: TextEvaluationFlag[] = [];
  let needsLLM = false;

  // Filter to active rules only
  const activeRules = rules.filter((r) => r.isActive);

  for (const rule of activeRules) {
    for (const pattern of rule.patterns) {
      const matches = findPatternMatches(text, pattern, rule.isRegex);

      for (const match of matches) {
        // Check if negated
        if (isNegated(text, match.start, rule.negationWords, rule.negationWindow)) {
          continue; // Skip negated matches
        }

        // Extract context
        const context = extractContext(text, match.start, match.end);

        // Add flag
        flags.push({
          category: rule.category,
          severity: rule.severity,
          matchedText: match.matched,
          context,
          ruleId: rule.id,
        });

        // Mark if LLM review needed
        if (rule.requiresLLM) {
          needsLLM = true;
        }
      }
    }
  }

  // Deduplicate flags (same category and similar matched text)
  const uniqueFlags = flags.reduce((acc, flag) => {
    const existing = acc.find(
      (f) => f.category === flag.category && f.matchedText === flag.matchedText
    );
    if (!existing) {
      acc.push(flag);
    }
    return acc;
  }, [] as TextEvaluationFlag[]);

  return { flags: uniqueFlags, needsLLM };
}

/**
 * Get the highest severity from a list of flags
 */
export function getHighestSeverity(flags: TextEvaluationFlag[]): TextEvaluationSeverity {
  const severityOrder: TextEvaluationSeverity[] = ["none", "low", "medium", "high", "urgent"];

  let highest: TextEvaluationSeverity = "none";
  for (const flag of flags) {
    if (severityOrder.indexOf(flag.severity) > severityOrder.indexOf(highest)) {
      highest = flag.severity;
    }
  }

  return highest;
}

/**
 * Create a pattern-only evaluation result
 */
export function createPatternEvaluationResult(
  flags: TextEvaluationFlag[]
): TextEvaluationResult {
  return {
    method: "pattern",
    flags,
    overallSeverity: getHighestSeverity(flags),
    llmUsed: false,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Merge pattern and LLM flags into a hybrid result
 */
export function mergeEvaluationResults(
  patternFlags: TextEvaluationFlag[],
  llmFlags: TextEvaluationFlag[],
  llmModel?: string,
  llmTokensUsed?: number
): TextEvaluationResult {
  // Combine all flags
  const allFlags = [...patternFlags];

  // Add LLM flags that don't duplicate pattern flags
  for (const llmFlag of llmFlags) {
    const isDuplicate = patternFlags.some(
      (pf) =>
        pf.category === llmFlag.category &&
        pf.matchedText.toLowerCase().includes(llmFlag.matchedText.toLowerCase())
    );
    if (!isDuplicate) {
      allFlags.push(llmFlag);
    }
  }

  return {
    method: llmFlags.length > 0 ? "hybrid" : "pattern",
    flags: allFlags,
    overallSeverity: getHighestSeverity(allFlags),
    llmUsed: llmFlags.length > 0,
    llmModel,
    llmTokensUsed,
    evaluatedAt: new Date().toISOString(),
  };
}

/**
 * Convert default rules to full rules with IDs
 */
export function getDefaultRulesWithIds(): TextEvaluationRule[] {
  const now = new Date().toISOString();
  return DEFAULT_TEXT_EVALUATION_RULES.map((rule, index) => ({
    ...rule,
    id: `default-${rule.category}-${index}`,
    createdAt: now,
    updatedAt: now,
  }));
}
