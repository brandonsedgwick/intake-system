import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TemplateSection } from "@/types/client";

// ============================================
// Fetch Functions
// ============================================

async function fetchTemplateSections(): Promise<TemplateSection[]> {
  const response = await fetch("/api/template-sections");
  if (!response.ok) {
    throw new Error("Failed to fetch template sections");
  }
  return response.json();
}

async function fetchTemplateSectionById(id: string): Promise<TemplateSection> {
  const response = await fetch(`/api/template-sections/${id}`);
  if (!response.ok) {
    throw new Error("Failed to fetch template section");
  }
  return response.json();
}

// ============================================
// Query Hooks
// ============================================

export function useTemplateSections() {
  return useQuery({
    queryKey: ["template-sections"],
    queryFn: fetchTemplateSections,
  });
}

export function useTemplateSectionById(id: string | null) {
  return useQuery({
    queryKey: ["template-sections", id],
    queryFn: () => fetchTemplateSectionById(id!),
    enabled: !!id,
  });
}

// ============================================
// Mutation Functions
// ============================================

async function createTemplateSection(
  section: Omit<TemplateSection, "id" | "createdAt" | "updatedAt">
): Promise<TemplateSection> {
  const response = await fetch("/api/template-sections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(section),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create template section");
  }
  return response.json();
}

async function updateTemplateSection({
  id,
  data,
}: {
  id: string;
  data: Partial<Omit<TemplateSection, "id" | "createdAt" | "updatedAt">>;
}): Promise<TemplateSection> {
  const response = await fetch(`/api/template-sections/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update template section");
  }
  return response.json();
}

async function deleteTemplateSection(id: string): Promise<void> {
  const response = await fetch(`/api/template-sections/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete template section");
  }
}

async function reorderTemplateSections(orderedIds: string[]): Promise<void> {
  const response = await fetch("/api/template-sections/reorder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderedIds }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to reorder template sections");
  }
}

// ============================================
// Mutation Hooks
// ============================================

export function useCreateTemplateSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTemplateSection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["template-sections"] });
    },
  });
}

export function useUpdateTemplateSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTemplateSection,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["template-sections"] });
      queryClient.setQueryData(["template-sections", data.id], data);
    },
  });
}

export function useDeleteTemplateSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTemplateSection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["template-sections"] });
      // Also invalidate templates as they may be affected
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
}

export function useReorderTemplateSections() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reorderTemplateSections,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["template-sections"] });
    },
  });
}
