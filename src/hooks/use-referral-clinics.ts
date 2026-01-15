import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ReferralClinic, ReferralClinicCustomField, ReferralClinicsConfig } from "@/types/client";

// Fetch all referral clinics
export function useReferralClinics() {
  return useQuery<ReferralClinic[]>({
    queryKey: ["referral-clinics"],
    queryFn: async () => {
      const response = await fetch("/api/referral-clinics");
      if (!response.ok) {
        throw new Error("Failed to fetch referral clinics");
      }
      return response.json();
    },
  });
}

// Fetch a single referral clinic
export function useReferralClinic(id: string | null) {
  return useQuery<ReferralClinic>({
    queryKey: ["referral-clinic", id],
    queryFn: async () => {
      if (!id) throw new Error("No clinic ID provided");
      const response = await fetch(`/api/referral-clinics/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch referral clinic");
      }
      return response.json();
    },
    enabled: !!id,
  });
}

// Create a new referral clinic
export function useCreateReferralClinic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<ReferralClinic, "id" | "createdAt" | "updatedAt">) => {
      const response = await fetch("/api/referral-clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create referral clinic");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referral-clinics"] });
    },
  });
}

// Update a referral clinic
export function useUpdateReferralClinic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<ReferralClinic>;
    }) => {
      const response = await fetch(`/api/referral-clinics/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update referral clinic");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["referral-clinics"] });
      queryClient.invalidateQueries({ queryKey: ["referral-clinic", variables.id] });
    },
  });
}

// Delete a referral clinic
export function useDeleteReferralClinic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/referral-clinics/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete referral clinic");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referral-clinics"] });
    },
  });
}

// Fetch referral clinics config (custom fields)
export function useReferralClinicsConfig() {
  return useQuery<ReferralClinicsConfig>({
    queryKey: ["referral-clinics-config"],
    queryFn: async () => {
      const response = await fetch("/api/referral-clinics/config");
      if (!response.ok) {
        throw new Error("Failed to fetch referral clinics config");
      }
      return response.json();
    },
  });
}

// Update referral clinics config (custom fields)
export function useUpdateReferralClinicsConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customFields: ReferralClinicCustomField[]) => {
      const response = await fetch("/api/referral-clinics/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customFields }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update referral clinics config");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referral-clinics-config"] });
    },
  });
}
