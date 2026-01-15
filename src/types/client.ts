export type ClientStatus =
  | "new"
  | "pending_evaluation"
  | "evaluation_complete"
  | "evaluation_flagged"
  | "pending_outreach"
  | "outreach_sent"
  | "follow_up_1"
  | "follow_up_2"
  | "replied"
  | "ready_to_schedule"
  | "scheduled"
  | "completed"
  | "pending_referral"
  | "referred"
  | "closed_no_contact"
  | "closed_other"
  | "duplicate";

export interface Client {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: ClientStatus;
  source: "google_form" | "manual";

  // Form submission tracking
  formResponseId?: string; // Row number or unique ID from form responses
  formTimestamp?: string; // Original form submission timestamp

  // Personal Info
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  age?: string;

  // Payment/Insurance
  paymentType?: string; // "Insurance", "Self-Pay", etc.
  insuranceProvider?: string;
  insuranceMemberId?: string;

  // Preferences
  preferredTimes?: string[];
  requestedClinician?: string;
  assignedClinician?: string;

  // Form Data - Clinical
  presentingConcerns?: string; // "What would you like to address in therapy?"
  suicideAttemptRecent?: string; // "Have you attempted suicide in the past 6 months?"
  psychiatricHospitalization?: string; // "Have you been hospitalized for a psychiatric condition..."
  additionalInfo?: string; // "What else would you like to share?"

  // Evaluation
  evaluationScore?: number;
  evaluationNotes?: string;
  referralReason?: string;
  isDuplicate?: boolean;
  duplicateOfClientId?: string;
  textEvaluationResult?: string; // JSON string of TextEvaluationResult

  // Communication Tracking
  initialOutreachDate?: string;
  followUp1Date?: string;
  followUp2Date?: string;
  nextFollowUpDue?: string;

  // Scheduling
  scheduledDate?: string;
  simplePracticeId?: string;
  paperworkComplete?: boolean;

  // Closure
  closedDate?: string;
  closedReason?: string;
}

export interface Communication {
  id: string;
  clientId: string;
  timestamp: string;
  direction: "in" | "out";
  type: "email" | "note" | "phone";
  gmailMessageId?: string;
  gmailThreadId?: string;
  subject: string;
  bodyPreview: string;
  fullBody?: string;
  sentBy?: string;
}

export interface Clinician {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  calendarId?: string;
  simplePracticeId?: string;
  insurancePanels: string[];
  specialties: string[];
  newClientCapacity: number;
  isAcceptingNew: boolean;
  defaultSessionLength: number;
}

export interface AvailabilitySlot {
  id: string;
  clinicianId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  specificDate?: string;
  isBooked: boolean;
  bookedClientId?: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  type:
    | "initial_outreach"
    | "follow_up_1"
    | "follow_up_2"
    | "referral_insurance"
    | "referral_specialty"
    | "referral_capacity"
    | "referral_clinical";
  subject: string;
  body: string;
  isActive: boolean;
  updatedAt: string;
  updatedBy?: string;
}

export type EvaluationOperator =
  | "exists"
  | "not_exists"
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "contains_any"
  | "contains_all"
  | "in_list"
  | "not_in_list"
  | "regex";

export type EvaluationAction = "flag" | "flag_urgent" | "flag_review";

export interface EvaluationCriteria {
  id: string;
  name: string;
  description?: string;
  field: keyof Client;
  operator: EvaluationOperator;
  value: string; // For keywords, comma-separated list
  action: EvaluationAction;
  priority: number; // Order of evaluation, lower = first
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Fields available for evaluation from the intake form
export interface EvaluableField {
  field: keyof Client;
  label: string;
  description: string;
  type: "text" | "textarea" | "select" | "boolean";
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  action: string;
  entityType: "client" | "clinician" | "template" | "settings" | "communication";
  entityId: string;
  previousValue?: string;
  newValue?: string;
  ipAddress?: string;
}

// Form response mapping configuration
export interface FormFieldMapping {
  formColumnName: string;
  clientField: keyof Client;
  transform?: "none" | "lowercase" | "trim" | "parse_json";
}

// ============================================
// Text Evaluation Types (Hybrid Pattern + LLM)
// ============================================

// Categories for text evaluation flags
export type TextEvaluationCategory =
  | "suicidal_ideation"
  | "self_harm"
  | "substance_use"
  | "psychosis"
  | "eating_disorder"
  | "hospitalization"
  | "violence"
  | "abuse"
  | "custom";

// Severity levels for flags
export type TextEvaluationSeverity = "none" | "low" | "medium" | "high" | "urgent";

// Individual flag from text evaluation
export interface TextEvaluationFlag {
  category: TextEvaluationCategory;
  severity: TextEvaluationSeverity;
  matchedText: string;        // The text that triggered the flag
  context: string;            // Surrounding sentence(s) for review
  reasoning?: string;         // LLM explanation (if used)
  ruleId?: string;            // Pattern rule ID (if pattern-matched)
}

// Full text evaluation result
export interface TextEvaluationResult {
  method: "pattern" | "llm" | "hybrid";
  flags: TextEvaluationFlag[];
  overallSeverity: TextEvaluationSeverity;
  llmUsed: boolean;
  llmModel?: string;
  llmTokensUsed?: number;
  evaluatedAt: string;
  rawResponse?: string;       // For debugging/audit
}

// Pattern rule configuration (admin-configurable)
export interface TextEvaluationRule {
  id: string;
  name: string;
  category: TextEvaluationCategory;
  severity: TextEvaluationSeverity;
  patterns: string[];         // Keywords or regex patterns
  isRegex: boolean;
  negationWords: string[];    // Words that negate the match
  negationWindow: number;     // How many words before to check for negations
  requiresLLM: boolean;       // Force LLM review when matched
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Referral Clinic Types
// ============================================

// Custom field definition for referral clinics
export interface ReferralClinicCustomField {
  id: string;
  name: string;            // Field key (e.g., "faxNumber")
  label: string;           // Display label (e.g., "Fax Number")
  type: "text" | "email" | "phone" | "url" | "textarea";
  order: number;
}

// Referral clinic entity
export interface ReferralClinic {
  id: string;
  practiceName: string;
  address?: string;
  phone?: string;
  email?: string;
  specialties: string[];   // Array of specialties
  notes?: string;          // Additional notes about the clinic
  customFields?: Record<string, string>;  // Dynamic custom field values
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Configuration for custom fields in referral clinics
export interface ReferralClinicsConfig {
  customFields: ReferralClinicCustomField[];
  updatedAt: string;
}
