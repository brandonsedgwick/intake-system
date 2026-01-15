import { Client, Clinician, EmailTemplate } from "@/types/client";

export interface TemplateVariables {
  clientFirstName: string;
  clientLastName: string;
  clientEmail: string;
  clinicianName?: string;
  clinicianEmail?: string;
  insuranceProvider?: string;
  availabilitySlots?: string;
  practiceName: string;
  practiceEmail?: string;
  customMessage?: string;
}

/**
 * Renders an email template with the provided variables
 */
export function renderTemplate(
  template: EmailTemplate,
  variables: TemplateVariables
): { subject: string; body: string } {
  let subject = template.subject;
  let body = template.body;

  // Replace all template variables
  const replacements: Record<string, string> = {
    "{{clientFirstName}}": variables.clientFirstName,
    "{{clientLastName}}": variables.clientLastName,
    "{{clientEmail}}": variables.clientEmail,
    "{{clinicianName}}": variables.clinicianName || "our team",
    "{{clinicianEmail}}": variables.clinicianEmail || "",
    "{{insuranceProvider}}": variables.insuranceProvider || "your insurance",
    "{{availabilitySlots}}": variables.availabilitySlots || "Please contact us for availability.",
    "{{practiceName}}": variables.practiceName,
    "{{practiceEmail}}": variables.practiceEmail || "",
    "{{customMessage}}": variables.customMessage || "",
  };

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
  availabilitySlots?: string[]
): TemplateVariables {
  return {
    clientFirstName: client.firstName,
    clientLastName: client.lastName,
    clientEmail: client.email,
    clinicianName: clinician
      ? `${clinician.firstName} ${clinician.lastName}`
      : undefined,
    clinicianEmail: clinician?.email,
    insuranceProvider: client.insuranceProvider,
    availabilitySlots: availabilitySlots
      ? formatAvailabilitySlots(availabilitySlots)
      : undefined,
    practiceName: settings?.practiceName || "Therapy Practice",
    practiceEmail: settings?.practiceEmail,
  };
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

/**
 * Generate a preview of the email with actual client data
 */
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

/**
 * Validate that a template has all required placeholders
 */
export function validateTemplate(template: EmailTemplate): {
  valid: boolean;
  missingRequired: string[];
  unusedPlaceholders: string[];
} {
  const requiredPlaceholders = [
    "{{clientFirstName}}",
    "{{practiceName}}",
  ];

  const allPlaceholders = [
    "{{clientFirstName}}",
    "{{clientLastName}}",
    "{{clientEmail}}",
    "{{clinicianName}}",
    "{{clinicianEmail}}",
    "{{insuranceProvider}}",
    "{{availabilitySlots}}",
    "{{practiceName}}",
    "{{practiceEmail}}",
    "{{customMessage}}",
  ];

  const templateContent = template.subject + template.body;

  const missingRequired = requiredPlaceholders.filter(
    (p) => !templateContent.includes(p)
  );

  const placeholdersInTemplate = allPlaceholders.filter((p) =>
    templateContent.includes(p)
  );

  const unusedPlaceholders = allPlaceholders.filter(
    (p) => !templateContent.includes(p)
  );

  return {
    valid: missingRequired.length === 0,
    missingRequired,
    unusedPlaceholders,
  };
}
