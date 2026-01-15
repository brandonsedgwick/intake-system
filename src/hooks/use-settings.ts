import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface IntakeField {
  id: string;
  name: string;
  label: string;
  type: "text" | "email" | "phone" | "date" | "select" | "multiselect" | "textarea" | "checkbox";
  required: boolean;
  options?: string[];
  mappedColumn: string;
  formFieldName?: string;
  order: number;
  isActive: boolean;
}

// Fetch settings
export function useSettings() {
  return useQuery<Record<string, string>>({
    queryKey: ["settings"],
    queryFn: async () => {
      const response = await fetch("/api/settings");
      if (!response.ok) {
        throw new Error("Failed to fetch settings");
      }
      return response.json();
    },
  });
}

// Update settings
export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Record<string, string>) => {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update settings");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}

// Fetch intake field configuration
export function useIntakeFields() {
  return useQuery<IntakeField[]>({
    queryKey: ["intake-fields"],
    queryFn: async () => {
      const response = await fetch("/api/settings/intake-fields");
      if (!response.ok) {
        throw new Error("Failed to fetch intake fields");
      }
      return response.json();
    },
  });
}

// Save intake field configuration
export function useSaveIntakeFields() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fields: IntakeField[]) => {
      const response = await fetch("/api/settings/intake-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save intake fields");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["intake-fields"] });
    },
  });
}

// Setup sheets
export function useSetupSheets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/setup/sheets", {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to setup sheets");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sheets-status"] });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}

// Check sheets status
export function useSheetsStatus() {
  return useQuery({
    queryKey: ["sheets-status"],
    queryFn: async () => {
      const response = await fetch("/api/setup/sheets");
      if (!response.ok) {
        throw new Error("Failed to check sheets status");
      }
      return response.json();
    },
  });
}
