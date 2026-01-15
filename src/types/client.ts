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
