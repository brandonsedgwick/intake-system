import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { EvaluationCriteria, EvaluableField, Client } from "@/types/client";

// Available fields that can be evaluated from the intake form
export const EVALUABLE_FIELDS: EvaluableField[] = [
  {
    field: "firstName",
    label: "First Name",
    description: "Client's first name",
    type: "text",
  },
  {
    field: "lastName",
    label: "Last Name",
    description: "Client's last name",
    type: "text",
  },
  {
    field: "email",
    label: "Email",
    description: "Client's email address",
    type: "text",
  },
  {
    field: "phone",
    label: "Phone",
    description: "Client's phone number",
    type: "text",
  },
  {
    field: "age",
    label: "Age",
    description: "Client's age",
    type: "text",
  },
  {
    field: "paymentType",
    label: "Payment Type",
    description: "How client intends to pay (Insurance, Self-Pay, etc.)",
    type: "select",
  },
  {
    field: "insuranceProvider",
    label: "Insurance Provider",
    description: "Name of insurance company",
    type: "text",
  },
  {
    field: "requestedClinician",
    label: "Requested Clinician",
    description: "Clinician the client prefers to see",
    type: "text",
  },
  {
    field: "presentingConcerns",
    label: "Presenting Concerns",
    description: "What the client wants to address in therapy",
    type: "textarea",
  },
  {
    field: "suicideAttemptRecent",
    label: "Recent Suicide Attempt",
    description: "Response to suicide attempt question",
    type: "text",
  },
  {
    field: "psychiatricHospitalization",
    label: "Psychiatric Hospitalization",
    description: "Response to hospitalization question",
    type: "text",
  },
  {
    field: "additionalInfo",
    label: "Additional Information",
    description: "Any other information the client shared",
    type: "textarea",
  },
];

// Fetch all evaluation criteria
export function useEvaluationCriteria() {
  return useQuery<EvaluationCriteria[]>({
    queryKey: ["evaluation-criteria"],
    queryFn: async () => {
      const response = await fetch("/api/evaluation-criteria");
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Admin access required");
        }
        throw new Error("Failed to fetch evaluation criteria");
      }
      return response.json();
    },
  });
}

// Create evaluation criteria
export function useCreateEvaluationCriteria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (criteria: Omit<EvaluationCriteria, "id" | "createdAt" | "updatedAt">) => {
      const response = await fetch("/api/evaluation-criteria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(criteria),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create criteria");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluation-criteria"] });
    },
  });
}

// Update evaluation criteria
export function useUpdateEvaluationCriteria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EvaluationCriteria> & { id: string }) => {
      const response = await fetch(`/api/evaluation-criteria/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update criteria");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluation-criteria"] });
    },
  });
}

// Delete evaluation criteria
export function useDeleteEvaluationCriteria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/evaluation-criteria/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete criteria");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluation-criteria"] });
    },
  });
}

// Bulk update evaluation criteria
export function useBulkUpdateEvaluationCriteria() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (criteria: Partial<EvaluationCriteria>[]) => {
      const response = await fetch("/api/evaluation-criteria", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ criteria }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update criteria");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluation-criteria"] });
    },
  });
}
