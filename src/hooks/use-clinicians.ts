import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clinician } from "@/types/client";

// Fetch all clinicians
export function useClinicians(options?: {
  acceptingNew?: boolean;
  insurance?: string;
}) {
  return useQuery<Clinician[]>({
    queryKey: ["clinicians", options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.acceptingNew) params.set("acceptingNew", "true");
      if (options?.insurance) params.set("insurance", options.insurance);

      const response = await fetch(`/api/clinicians?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch clinicians");
      }
      return response.json();
    },
  });
}

// Create a new clinician
export function useCreateClinician() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Clinician, "id">) => {
      const response = await fetch("/api/clinicians", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create clinician");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clinicians"] });
    },
  });
}
