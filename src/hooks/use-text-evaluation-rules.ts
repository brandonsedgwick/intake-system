import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TextEvaluationRule } from "@/types/client";

// Fetch all text evaluation rules
export function useTextEvaluationRules() {
  return useQuery<TextEvaluationRule[]>({
    queryKey: ["text-evaluation-rules"],
    queryFn: async () => {
      const response = await fetch("/api/settings/text-evaluation-rules");
      if (!response.ok) {
        throw new Error("Failed to fetch text evaluation rules");
      }
      return response.json();
    },
  });
}

// Create a new rule
export function useCreateTextEvaluationRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      rule: Omit<TextEvaluationRule, "id" | "createdAt" | "updatedAt">
    ) => {
      const response = await fetch("/api/settings/text-evaluation-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rule),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create rule");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["text-evaluation-rules"] });
    },
  });
}

// Update a rule
export function useUpdateTextEvaluationRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<TextEvaluationRule>;
    }) => {
      const response = await fetch("/api/settings/text-evaluation-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...updates }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update rule");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["text-evaluation-rules"] });
    },
  });
}

// Delete a rule
export function useDeleteTextEvaluationRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(
        `/api/settings/text-evaluation-rules?id=${id}`,
        {
          method: "DELETE",
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete rule");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["text-evaluation-rules"] });
    },
  });
}
