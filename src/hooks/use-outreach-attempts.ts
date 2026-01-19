import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { OutreachAttempt, OutreachAttemptStatus } from "@/types/client";

// Fetch all outreach attempts for a client
export function useOutreachAttempts(clientId: string | undefined) {
  return useQuery<OutreachAttempt[]>({
    queryKey: ["outreach-attempts", clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const response = await fetch(`/api/clients/${clientId}/outreach-attempts`);
      if (!response.ok) {
        throw new Error("Failed to fetch outreach attempts");
      }
      return response.json();
    },
    enabled: !!clientId,
  });
}

// Initialize outreach attempts for a client
export function useInitializeOutreachAttempts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientId: string) => {
      const response = await fetch(`/api/clients/${clientId}/outreach-attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initialize: true }),
      });

      if (!response.ok) {
        throw new Error("Failed to initialize outreach attempts");
      }

      return response.json() as Promise<OutreachAttempt[]>;
    },
    onSuccess: (data, clientId) => {
      queryClient.setQueryData(["outreach-attempts", clientId], data);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

// Create a single outreach attempt
export function useCreateOutreachAttempt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      attemptNumber,
      attemptType,
      status,
      sentAt,
      emailSubject,
      emailPreview,
    }: {
      clientId: string;
      attemptNumber: number;
      attemptType: string;
      status?: OutreachAttemptStatus;
      sentAt?: string;
      emailSubject?: string;
      emailPreview?: string;
    }) => {
      const response = await fetch(`/api/clients/${clientId}/outreach-attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptNumber,
          attemptType,
          status,
          sentAt,
          emailSubject,
          emailPreview,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create outreach attempt");
      }

      return response.json() as Promise<OutreachAttempt>;
    },
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ["outreach-attempts", clientId] });
    },
  });
}

// Update an outreach attempt
export function useUpdateOutreachAttempt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      attemptId,
      status,
      sentAt,
      emailSubject,
      emailPreview,
    }: {
      clientId: string;
      attemptId: string;
      status?: OutreachAttemptStatus;
      sentAt?: string;
      emailSubject?: string;
      emailPreview?: string;
    }) => {
      const response = await fetch(`/api/clients/${clientId}/outreach-attempts`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          status,
          sentAt,
          emailSubject,
          emailPreview,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update outreach attempt");
      }

      return response.json() as Promise<OutreachAttempt>;
    },
    onSuccess: (_, { clientId }) => {
      queryClient.invalidateQueries({ queryKey: ["outreach-attempts", clientId] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

// Mark an outreach attempt as sent
export function useMarkOutreachAttemptSent() {
  const updateAttempt = useUpdateOutreachAttempt();

  return useMutation({
    mutationFn: async ({
      clientId,
      attemptId,
      emailSubject,
      emailBody,
    }: {
      clientId: string;
      attemptId: string;
      emailSubject: string;
      emailBody: string;
    }) => {
      return updateAttempt.mutateAsync({
        clientId,
        attemptId,
        status: "sent",
        sentAt: new Date().toISOString(),
        emailSubject,
        emailPreview: emailBody.substring(0, 200),
      });
    },
  });
}

// Delete all outreach attempts for a client
export function useDeleteOutreachAttempts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientId: string) => {
      const response = await fetch(`/api/clients/${clientId}/outreach-attempts`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete outreach attempts");
      }

      return response.json();
    },
    onSuccess: (_, clientId) => {
      queryClient.setQueryData(["outreach-attempts", clientId], []);
    },
  });
}

// Get the next pending outreach attempt for a client
export function useNextPendingAttempt(clientId: string | undefined) {
  const { data: attempts } = useOutreachAttempts(clientId);

  if (!attempts || attempts.length === 0) return null;

  return attempts.find((a) => a.status === "pending") || null;
}
