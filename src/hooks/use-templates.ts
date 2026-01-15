import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmailTemplate } from "@/types/client";

async function fetchTemplates(): Promise<EmailTemplate[]> {
  const response = await fetch("/api/templates");
  if (!response.ok) {
    throw new Error("Failed to fetch templates");
  }
  return response.json();
}

export function useTemplates() {
  return useQuery({
    queryKey: ["templates"],
    queryFn: fetchTemplates,
  });
}

export function useReferralTemplates() {
  const { data: templates, ...rest } = useTemplates();

  // Filter to only referral-type templates
  const referralTemplates = templates?.filter(
    (t) =>
      t.isActive &&
      (t.type === "referral_insurance" ||
        t.type === "referral_specialty" ||
        t.type === "referral_capacity" ||
        t.type === "referral_clinical")
  );

  return { data: referralTemplates, ...rest };
}

async function createTemplate(template: Omit<EmailTemplate, "id" | "updatedAt">): Promise<EmailTemplate> {
  const response = await fetch("/api/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(template),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create template");
  }
  return response.json();
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}

async function updateTemplate({
  id,
  data,
}: {
  id: string;
  data: Partial<EmailTemplate>;
}): Promise<EmailTemplate> {
  const response = await fetch(`/api/templates/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update template");
  }
  return response.json();
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}
