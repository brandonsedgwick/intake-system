import { Client, Clinician, EmailTemplate } from "@/types/client";

// ============================================
// Template Variable Definitions
// ============================================

export interface TemplateVariableDefinition {
  key: string;
  displayName: string;
  description: string;
  category: "client" | "clinician" | "practice" | "datetime" | "appointment" | "custom";
  isRequired: boolean;
  exampleValue: string;
}

/**
 * Central registry of all available template variables
 */
export const TEMPLATE_VARIABLE_REGISTRY: TemplateVariableDefinition[] = [
  // Client Category
  {
    key: "clientFirstName",
    displayName: "Client First Name",
    description: "The client's first name",
    category: "client",
    isRequired: true,
    exampleValue: "John",
  },
  {
    key: "clientLastName",
    displayName: "Client Last Name",
    description: "The client's last name",
    category: "client",
    isRequired: false,
    exampleValue: "Smith",
  },
  {
    key: "clientEmail",
    displayName: "Client Email",
    description: "The client's email address",
    category: "client",
    isRequired: false,
    exampleValue: "john.smith@email.com",
  },
  {
    key: "clientPhone",
    displayName: "Client Phone",
    description: "The client's phone number",
    category: "client",
    isRequired: false,
    exampleValue: "(555) 123-4567",
  },
  {
    key: "clientAge",
    displayName: "Client Age",
    description: "The client's age",
    category: "client",
    isRequired: false,
    exampleValue: "35",
  },
  {
    key: "presentingConcerns",
    displayName: "Presenting Concerns",
    description: "The client's presenting concerns from intake",
    category: "client",
    isRequired: false,
    exampleValue: "Anxiety, stress management",
  },
  {
    key: "paymentType",
    displayName: "Payment Type",
    description: "The client's payment method (Insurance, Self-Pay, etc.)",
    category: "client",
    isRequired: false,
    exampleValue: "Insurance",
  },
  {
    key: "insuranceProvider",
    displayName: "Insurance Provider",
    description: "Client's insurance provider name",
    category: "client",
    isRequired: false,
    exampleValue: "Blue Cross Blue Shield",
  },

  // Clinician Category
  {
    key: "clinicianName",
    displayName: "Clinician Name",
    description: "Full name of the assigned clinician",
    category: "clinician",
    isRequired: false,
    exampleValue: "Dr. Jane Wilson",
  },
  {
    key: "clinicianEmail",
    displayName: "Clinician Email",
    description: "Email of the assigned clinician",
    category: "clinician",
    isRequired: false,
    exampleValue: "jane.wilson@practice.com",
  },

  // Practice Category
  {
    key: "practiceName",
    displayName: "Practice Name",
    description: "Name of the therapy practice",
    category: "practice",
    isRequired: true,
    exampleValue: "Sunrise Counseling Center",
  },
  {
    key: "practiceEmail",
    displayName: "Practice Email",
    description: "Main contact email for the practice",
    category: "practice",
    isRequired: false,
    exampleValue: "intake@sunrise-counseling.com",
  },

  // DateTime Category
  {
    key: "currentDate",
    displayName: "Current Date",
    description: "Today's date when the email is sent",
    category: "datetime",
    isRequired: false,
    exampleValue: "January 15, 2026",
  },
  {
    key: "currentDay",
    displayName: "Current Day",
    description: "Current day of the week",
    category: "datetime",
    isRequired: false,
    exampleValue: "Wednesday",
  },

  // Appointment Category
  {
    key: "availabilitySlots",
    displayName: "Availability Slots",
    description: "Formatted list of available appointment times",
    category: "appointment",
    isRequired: false,
    exampleValue: "• Monday 2:00 PM\n• Tuesday 10:00 AM",
  },
  {
    key: "appointmentDate",
    displayName: "Appointment Date",
    description: "Scheduled appointment date",
    category: "appointment",
    isRequired: false,
    exampleValue: "January 20, 2026",
  },
  {
    key: "appointmentTime",
    displayName: "Appointment Time",
    description: "Scheduled appointment time",
    category: "appointment",
    isRequired: false,
    exampleValue: "2:30 PM",
  },

  // Custom Category
  {
    key: "customMessage",
    displayName: "Custom Message",
    description: "A custom message added by the sender",
    category: "custom",
    isRequired: false,
    exampleValue: "Looking forward to meeting you!",
  },
];

/**
 * Category display names and descriptions
 */
export const VARIABLE_CATEGORIES = {
  client: {
    label: "Client Information",
    description: "Information about the client from their intake form",
  },
  clinician: {
    label: "Clinician Details",
    description: "Details about the assigned clinician",
  },
  practice: {
    label: "Practice Information",
    description: "Information about your practice from settings",
  },
  datetime: {
    label: "Date & Time",
    description: "Automatically generated date and time values",
  },
  appointment: {
    label: "Appointment Details",
    description: "Scheduled appointment information",
  },
  custom: {
    label: "Custom Content",
    description: "Custom content you can add when sending",
  },
} as const;

/**
 * Get variables grouped by category for UI display
 */
export function getVariablesByCategory(): Record<string, TemplateVariableDefinition[]> {
  return TEMPLATE_VARIABLE_REGISTRY.reduce((acc, variable) => {
    if (!acc[variable.category]) {
      acc[variable.category] = [];
    }
    acc[variable.category].push(variable);
    return acc;
  }, {} as Record<string, TemplateVariableDefinition[]>);
}

/**
 * Get required variables for validation
 */
export function getRequiredVariables(): TemplateVariableDefinition[] {
  return TEMPLATE_VARIABLE_REGISTRY.filter((v) => v.isRequired);
}

/**
 * Get all variable keys as placeholder strings
 */
export function getAllPlaceholders(): string[] {
  return TEMPLATE_VARIABLE_REGISTRY.map((v) => `{{${v.key}}}`);
}

// ============================================
// Template Variables Interface
// ============================================

export interface TemplateVariables {
  // Client basic info
  clientFirstName: string;
  clientLastName: string;
  clientEmail: string;

  // Client detail variables
  clientPhone?: string;
  clientAge?: string;
  presentingConcerns?: string;
  paymentType?: string;

  // Clinician
  clinicianName?: string;
  clinicianEmail?: string;

  // Insurance
  insuranceProvider?: string;

  // Practice
  practiceName: string;
  practiceEmail?: string;

  // Availability/Appointment
  availabilitySlots?: string;
  appointmentDate?: string;
  appointmentTime?: string;

  // Date/Time (computed)
  currentDate?: string;
  currentDay?: string;

  // Custom
  customMessage?: string;
}

/**
 * Context object for appointment-related variables
 */
export interface AppointmentContext {
  date?: Date;
  time?: string; // "HH:MM" 24h format
}

// ============================================
// Date/Time Formatting Utilities
// ============================================

function formatCurrentDate(): string {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatCurrentDay(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "long" });
}

function formatAppointmentDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatAppointmentTime(time: string): string {
  // Convert "HH:MM" to "H:MM AM/PM"
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format availability slots for email display
 */
function formatAvailabilitySlots(slots: string[]): string {
  if (slots.length === 0) {
    return "Please contact us to discuss available times.";
  }
  return slots.map((slot) => `• ${slot}`).join("\n");
}

// ============================================
// Default Fallback Values
// ============================================

const VARIABLE_FALLBACKS: Record<string, string> = {
  clinicianName: "our team",
  clinicianEmail: "",
  insuranceProvider: "your insurance",
  availabilitySlots: "Please contact us for availability.",
  practiceEmail: "",
  customMessage: "",
  clientPhone: "",
  clientAge: "",
  presentingConcerns: "",
  paymentType: "",
  currentDate: "",
  currentDay: "",
  appointmentDate: "TBD",
  appointmentTime: "TBD",
};

// ============================================
// Core Functions
// ============================================

/**
 * Renders an email template with the provided variables
 */
export function renderTemplate(
  template: EmailTemplate,
  variables: TemplateVariables,
  customFallbacks?: Partial<Record<keyof TemplateVariables, string>>
): { subject: string; body: string } {
  let subject = template.subject;
  let body = template.body;

  // Merge default fallbacks with any custom ones
  const fallbacks = { ...VARIABLE_FALLBACKS, ...customFallbacks };

  // Build replacements dynamically from registry
  const replacements: Record<string, string> = {};

  for (const varDef of TEMPLATE_VARIABLE_REGISTRY) {
    const key = varDef.key as keyof TemplateVariables;
    const placeholder = `{{${key}}}`;
    const value = variables[key];

    // Use value if defined, otherwise use fallback
    replacements[placeholder] = value ?? fallbacks[key] ?? "";
  }

  // Apply all replacements
  for (const [placeholder, value] of Object.entries(replacements)) {
    subject = subject.replaceAll(placeholder, value);
    body = body.replaceAll(placeholder, value);
  }

  return { subject, body };
}

/**
 * Build template variables from client and clinician data
 */
export function buildTemplateVariables(
  client: Client,
  clinician?: Clinician,
  settings?: Record<string, string>,
  availabilitySlots?: string[],
  appointmentContext?: AppointmentContext
): TemplateVariables {
  return {
    // Client basic info
    clientFirstName: client.firstName,
    clientLastName: client.lastName,
    clientEmail: client.email,

    // Client detail variables
    clientPhone: client.phone || undefined,
    clientAge: client.age || undefined,
    presentingConcerns: client.presentingConcerns || undefined,
    paymentType: client.paymentType || undefined,

    // Clinician
    clinicianName: clinician
      ? `${clinician.firstName} ${clinician.lastName}`
      : undefined,
    clinicianEmail: clinician?.email,

    // Insurance
    insuranceProvider: client.insuranceProvider,

    // Availability
    availabilitySlots: availabilitySlots
      ? formatAvailabilitySlots(availabilitySlots)
      : undefined,

    // Practice
    practiceName: settings?.practiceName || "Therapy Practice",
    practiceEmail: settings?.practiceEmail,

    // Date/Time (always computed fresh)
    currentDate: formatCurrentDate(),
    currentDay: formatCurrentDay(),

    // Appointment (from context)
    appointmentDate: appointmentContext?.date
      ? formatAppointmentDate(appointmentContext.date)
      : undefined,
    appointmentTime: appointmentContext?.time
      ? formatAppointmentTime(appointmentContext.time)
      : undefined,
  };
}

/**
 * Build sample template variables for preview
 */
export function buildSampleVariables(): TemplateVariables {
  const sampleVars: TemplateVariables = {
    clientFirstName: "John",
    clientLastName: "Smith",
    clientEmail: "john.smith@email.com",
    clientPhone: "(555) 123-4567",
    clientAge: "35",
    presentingConcerns: "Anxiety and stress management",
    paymentType: "Insurance",
    clinicianName: "Dr. Jane Wilson",
    clinicianEmail: "jane.wilson@practice.com",
    insuranceProvider: "Blue Cross Blue Shield",
    availabilitySlots: "• Monday 2:00 PM\n• Wednesday 10:00 AM\n• Friday 3:00 PM",
    practiceName: "Sunrise Counseling Center",
    practiceEmail: "intake@sunrise-counseling.com",
    currentDate: formatCurrentDate(),
    currentDay: formatCurrentDay(),
    appointmentDate: "January 20, 2026",
    appointmentTime: "2:30 PM",
    customMessage: "Looking forward to meeting you!",
  };
  return sampleVars;
}

// ============================================
// Email Preview
// ============================================

export interface EmailPreview {
  to: string;
  from: string;
  subject: string;
  body: string;
  templateId: string;
  templateType: EmailTemplate["type"];
}

export function generateEmailPreview(
  template: EmailTemplate,
  variables: TemplateVariables,
  fromEmail: string
): EmailPreview {
  const { subject, body } = renderTemplate(template, variables);

  return {
    to: variables.clientEmail,
    from: fromEmail,
    subject,
    body,
    templateId: template.id,
    templateType: template.type,
  };
}

// ============================================
// Template Validation
// ============================================

export interface TemplateValidationResult {
  valid: boolean;
  missingRequired: string[];
  unusedPlaceholders: string[];
  unrecognizedPlaceholders: string[];
  warnings: string[];
}

/**
 * Validate that a template has proper placeholder usage
 */
export function validateTemplate(template: EmailTemplate): TemplateValidationResult {
  const templateContent = template.subject + template.body;

  // Get required placeholders from registry
  const requiredPlaceholders = TEMPLATE_VARIABLE_REGISTRY.filter((v) => v.isRequired).map(
    (v) => `{{${v.key}}}`
  );

  // Get all valid placeholders
  const allValidPlaceholders = getAllPlaceholders();

  // Find placeholders used in template
  const placeholderPattern = /\{\{([a-zA-Z]+)\}\}/g;
  const usedPlaceholders: string[] = [];
  let match;

  while ((match = placeholderPattern.exec(templateContent)) !== null) {
    usedPlaceholders.push(`{{${match[1]}}}`);
  }

  // Find missing required
  const missingRequired = requiredPlaceholders.filter(
    (p) => !templateContent.includes(p)
  );

  // Find unused (available but not used)
  const unusedPlaceholders = allValidPlaceholders.filter(
    (p) => !templateContent.includes(p)
  );

  // Find unrecognized (used but not in registry - potential typos)
  const unrecognizedPlaceholders = [...new Set(usedPlaceholders)].filter(
    (p) => !allValidPlaceholders.includes(p)
  );

  // Generate warnings
  const warnings: string[] = [];

  if (unrecognizedPlaceholders.length > 0) {
    warnings.push(
      `Unrecognized placeholders found: ${unrecognizedPlaceholders.join(", ")}. ` +
        "These will not be replaced with values."
    );
  }

  // Warn about appointment variables in non-scheduling templates
  const appointmentVars = ["{{appointmentDate}}", "{{appointmentTime}}"];
  const usesAppointmentVars = appointmentVars.some((v) => templateContent.includes(v));
  if (usesAppointmentVars && !template.type.includes("scheduled")) {
    warnings.push(
      "This template uses appointment variables but may not always have " +
        "appointment context available. Consider adding fallback text."
    );
  }

  return {
    valid: missingRequired.length === 0 && unrecognizedPlaceholders.length === 0,
    missingRequired,
    unusedPlaceholders,
    unrecognizedPlaceholders,
    warnings,
  };
}
