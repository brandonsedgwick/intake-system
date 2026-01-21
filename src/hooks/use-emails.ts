import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmailTemplate } from "@/types/client";

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  content: string; // Base64 encoded content
}

export interface EmailPreview {
  to: string;
  from: string;
  subject: string;
  body: string;
  templateId: string;
  templateType: EmailTemplate["type"];
}

// Fetch all email templates
export function useEmailTemplates() {
  return useQuery<EmailTemplate[]>({
    queryKey: ["templates"],
    queryFn: async () => {
      const response = await fetch("/api/templates");
      if (!response.ok) {
        throw new Error("Failed to fetch templates");
      }
      return response.json();
    },
  });
}

// Generate email preview
export function useEmailPreview() {
  return useMutation({
    mutationFn: async (data: {
      clientId: string;
      templateType: EmailTemplate["type"];
      clinicianId?: string;
      availabilitySlots?: string[];
    }): Promise<EmailPreview> => {
      const response = await fetch("/api/emails/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate preview");
      }
      return response.json();
    },
  });
}

// Send email
export function useSendEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      clientId: string;
      to: string;
      from?: string;
      cc?: string;
      bcc?: string;
      subject: string;
      body: string;
      bodyFormat?: "html" | "plain";
      templateType?: EmailTemplate["type"];
      attachments?: EmailAttachment[];
      outreachAttemptId?: string; // ID of the outreach attempt being sent (for Gmail ID tracking)
    }) => {
      const response = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send email");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate client queries to refresh status
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({
        queryKey: ["client", variables.clientId],
      });
      queryClient.invalidateQueries({
        queryKey: ["communications", variables.clientId],
      });
    },
  });
}

// Create a new template
export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      type: EmailTemplate["type"];
      subject: string;
      body: string;
      isActive?: boolean;
    }) => {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create template");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}
