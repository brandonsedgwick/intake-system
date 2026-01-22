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
  | "duplicate"
  // New statuses for automated outreach tracking
  | "awaiting_response"    // Email sent, within 24h response window
  | "follow_up_due"        // No reply after 24h, more attempts available
  | "no_contact_ok_close"  // Max attempts exhausted, no reply detected
  | "in_communication";    // Client replied

// Closed status helpers
export const CLOSED_STATUSES: ClientStatus[] = [
  "referred",
  "closed_no_contact",
  "closed_other",
  "completed",
  "duplicate",
];

export function isClosedStatus(status: ClientStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}

export type ClosedFromWorkflow = "evaluation" | "outreach" | "referral" | "scheduling" | "other";

// Map workflows to their associated statuses
export const WORKFLOW_STATUS_MAP: Record<ClosedFromWorkflow, ClientStatus[]> = {
  evaluation: ["new", "pending_evaluation", "evaluation_complete", "evaluation_flagged"],
  outreach: [
    "pending_outreach",
    "outreach_sent",
    "follow_up_1",
    "follow_up_2",
    "replied",
    "closed_no_contact",
    "awaiting_response",
    "follow_up_due",
    "no_contact_ok_close",
    "in_communication",
  ],
  referral: ["pending_referral", "referred"],
  scheduling: ["ready_to_schedule", "scheduled", "completed"],
  other: ["duplicate", "closed_other"],
};

// Get non-closed statuses for reopen status selection
export function getNonClosedStatuses(): ClientStatus[] {
  return [
    "new",
    "pending_evaluation",
    "evaluation_complete",
    "evaluation_flagged",
    "pending_outreach",
    "outreach_sent",
    "follow_up_1",
    "follow_up_2",
    "replied",
    "ready_to_schedule",
    "scheduled",
    "pending_referral",
    "awaiting_response",
    "follow_up_due",
    "in_communication",
  ];
}

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

  // Referral
  referralEmailSentAt?: string;
  referralClinicNames?: string; // Comma-separated list of clinic names

  // Availability Tracking
  offeredAvailability?: string; // JSON string of OfferedSlot[]
  acceptedSlot?: string; // JSON string of AcceptedSlot
  scheduledAppointment?: string; // JSON string of ScheduledAppointment

  // Closure
  closedDate?: string;
  closedReason?: string;
  closedFromWorkflow?: "evaluation" | "outreach" | "referral" | "scheduling" | "other";
  closedFromStatus?: ClientStatus;
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
  outreachAttemptNumber?: number; // Which outreach attempt this communication is associated with (1=initial, 2=follow-up #1, etc.)
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

// Sheet-based availability (from external Google Sheet)
export interface SheetAvailabilitySlot {
  id: string;           // generated: `${day}-${time}` (normalized)
  day: string;          // "Monday", "Tuesday", etc.
  time: string;         // "9:00 AM", "10:00 AM", etc.
  clinicians: string[]; // ["John Smith", "Jane Doe"]
  insurance: string;    // Raw insurance string from sheet
}

// Offered slot - tracked on client when availability is included in an email
export interface OfferedSlot {
  slotId: string;       // day-time identifier matching SheetAvailabilitySlot.id
  day: string;
  time: string;
  clinicians: string[]; // clinicians offered for this slot
  offeredAt: string;    // ISO timestamp when offered
}

// Accepted slot - when client accepts a specific slot
export interface AcceptedSlot {
  slotId: string;
  day: string;
  time: string;
  clinician: string;    // single clinician who was selected
  acceptedAt: string;   // ISO timestamp
}

// Recurrence pattern options for scheduled appointments
export type RecurrencePattern = "weekly" | "bi-weekly" | "monthly" | "one-time";

// Scheduled appointment - when moving client to scheduling
export interface ScheduledAppointment {
  slotId?: string;           // If from offered slots
  day: string;               // "Monday", "Tuesday", etc. (Mon-Sun)
  time: string;              // "9:00 AM", "2:00 PM", etc.
  clinician: string;         // Selected clinician name
  startDate: string;         // ISO date string for first appointment
  recurrence: RecurrencePattern;
  scheduledAt: string;       // ISO timestamp when scheduled
  fromOfferedSlot: boolean;  // true if selected from offered times
  communicationNote?: string; // Required if client didn't reply via email (status != in_communication)
}

// Booked slot - stored in database to track globally booked slots
export interface BookedSlot {
  id: string;
  slotId: string;       // matches sheet slot id
  day: string;
  time: string;
  clinician: string;
  clientId: string;
  bookedAt: string;
  createdAt: string;
}

export interface TemplateSection {
  id: string;
  name: string;
  order: number;
  color?: "blue" | "green" | "purple" | "amber" | "red";
  createdAt: string;
  updatedAt: string;
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
  bodyFormat: "html" | "plain";
  isActive: boolean;
  isDefault: boolean;
  sectionId?: string;
  order: number;
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

// ============================================
// Case Reopen History Types
// ============================================

export interface CaseReopenHistory {
  id: string;
  clientId: string;
  reopenedAt: string;
  reopenedBy: string;
  reopenReason: string;
  previousStatus: ClientStatus;
  newStatus: ClientStatus;
  closedDate?: string;
  closedReason?: string;
  closedFromWorkflow?: ClosedFromWorkflow;
}

// ============================================
// Outreach Attempt Types
// ============================================

export type OutreachAttemptStatus = "pending" | "sent" | "skipped";

export type OutreachAttemptType =
  | "initial_outreach"
  | "follow_up_1"
  | "follow_up_2"
  | "follow_up_3"
  | "follow_up_4"
  | "follow_up_5"
  | "follow_up_6"
  | "follow_up_7"
  | "follow_up_8"
  | "follow_up_9";

export interface OutreachAttempt {
  id: string;
  clientId: string;
  attemptNumber: number;
  attemptType: OutreachAttemptType;
  sentAt?: string;
  status: OutreachAttemptStatus;
  emailSubject?: string;
  emailPreview?: string;
  // Response tracking fields
  gmailThreadId?: string;         // Thread ID for reply detection
  gmailMessageId?: string;        // Message ID of sent email
  responseDetected?: boolean;     // Whether a reply was found
  responseDetectedAt?: string;    // When the reply was detected
  responseMessageId?: string;     // Message ID of the reply
  responseWindowEnd?: string;     // When 24h response window expires
  createdAt: string;
  updatedAt: string;
}

// Helper to get attempt type from attempt number
export function getAttemptType(attemptNumber: number): OutreachAttemptType {
  if (attemptNumber === 1) return "initial_outreach";
  return `follow_up_${attemptNumber - 1}` as OutreachAttemptType;
}

// Helper to get display label for attempt
export function getAttemptLabel(attemptNumber: number): string {
  if (attemptNumber === 1) return "Initial Outreach";
  return `Follow-up #${attemptNumber - 1}`;
}

// Client with outreach attempts included
export interface ClientWithOutreachAttempts extends Client {
  outreachAttempts?: OutreachAttempt[];
}
