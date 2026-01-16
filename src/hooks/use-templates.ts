import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EmailTemplate } from "@/types/client";
import { TemplateVariables } from "@/lib/services/email-template";

// ============================================
// Fetch Functions
// ============================================

async function fetchTemplates(): Promise<EmailTemplate[]> {
  const response = await fetch("/api/templates");
  if (!response.ok) {
    throw new Error("Failed to fetch templates");
  }
  return response.json();
}

async function fetchTemplateById(id: string): Promise<EmailTemplate> {
  const response = await fetch(`/api/templates/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch template");
  }
  return response.json();
}

async function fetchTemplatesBySection(sectionId: string | null): Promise<EmailTemplate[]> {
  const param = sectionId === null ? "null" : sectionId;
  const response = await fetch(`/api/templates?sectionId=${param}`);
  if (!response.ok) {
    throw new Error("Failed to fetch templates");
  }
  return response.json();
}

// ============================================
// Query Hooks
// ============================================

export function useTemplates() {
  return useQuery({
    queryKey: ["templates"],
    queryFn: fetchTemplates,
  });
}

export function useTemplateById(id: string | null) {
  return useQuery({
    queryKey: ["templates", id],
    queryFn: () => fetchTemplateById(id!),
    enabled: !!id,
  });
}

export function useTemplatesBySection(sectionId: string | null) {
  return useQuery({
    queryKey: ["templates", "section", sectionId],
    queryFn: () => fetchTemplatesBySection(sectionId),
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

// ============================================
// Mutation Functions
// ============================================

async function createTemplate(
  template: Omit<EmailTemplate, "id" | "updatedAt">
): Promise<EmailTemplate> {
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

async function deleteTemplate(id: string): Promise<void> {
  const response = await fetch(`/api/templates/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete template");
  }
}

async function setDefaultTemplate(id: string): Promise<EmailTemplate> {
  const response = await fetch(`/api/templates/${id}/set-default`, {
    method: "POST",
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to set default template");
  }
  return response.json();
}

interface PreviewTemplateParams {
  templateId?: string;
  template?: Partial<EmailTemplate>;
  variables?: Partial<TemplateVariables>;
  useSampleData?: boolean;
}

interface PreviewTemplateResult {
  subject: string;
  body: string;
  bodyFormat: "html" | "plain";
  variables: TemplateVariables;
}

async function previewTemplate(
  params: PreviewTemplateParams
): Promise<PreviewTemplateResult> {
  const response = await fetch("/api/templates/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to preview template");
  }
  return response.json();
}

// ============================================
// Mutation Hooks
// ============================================

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTemplate,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      // Also update the specific template in cache
      queryClient.setQueryData(["templates", data.id], data);
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}

export function useSetDefaultTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setDefaultTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}

export function usePreviewTemplate() {
  return useMutation({
    mutationFn: previewTemplate,
  });
}
