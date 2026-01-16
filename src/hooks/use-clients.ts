import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Client, Communication, ClientStatus, CaseReopenHistory, ClosedFromWorkflow } from "@/types/client";

// Fetch all clients
export function useClients(status?: Client["status"]) {
  return useQuery<Client[]>({
    queryKey: ["clients", status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);

      const response = await fetch(`/api/clients?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch clients");
      }
      return response.json();
    },
  });
}

// Fetch clients with follow-ups due
export function useFollowUpsDue() {
  return useQuery<Client[]>({
    queryKey: ["clients", "followUpsDue"],
    queryFn: async () => {
      const response = await fetch("/api/clients?followUpsDue=true");
      if (!response.ok) {
        throw new Error("Failed to fetch follow-ups");
      }
      return response.json();
    },
  });
}

// Fetch a single client
export function useClient(id: string | null) {
  return useQuery<Client>({
    queryKey: ["client", id],
    queryFn: async () => {
      if (!id) throw new Error("No client ID provided");
      const response = await fetch(`/api/clients/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch client");
      }
      return response.json();
    },
    enabled: !!id,
  });
}

// Fetch communications for a client
export function useClientCommunications(clientId: string | null) {
  return useQuery<Communication[]>({
    queryKey: ["communications", clientId],
    queryFn: async () => {
      if (!clientId) throw new Error("No client ID provided");
      const response = await fetch(`/api/clients/${clientId}/communications`);
      if (!response.ok) {
        throw new Error("Failed to fetch communications");
      }
      return response.json();
    },
    enabled: !!clientId,
  });
}

// Create a new client
export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: Omit<Client, "id" | "createdAt" | "updatedAt">
    ) => {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create client");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

// Update a client
export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Client>;
    }) => {
      const response = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update client");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client", variables.id] });
    },
  });
}

// Add a communication
export function useAddCommunication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      data,
    }: {
      clientId: string;
      data: Omit<Communication, "id" | "clientId">;
    }) => {
      const response = await fetch(`/api/clients/${clientId}/communications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add communication");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["communications", variables.clientId],
      });
    },
  });
}

// Setup sheets (for initial configuration)
export function useSetupSheets() {
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

// Evaluate a client
export function useEvaluateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientId: string) => {
      const response = await fetch(`/api/clients/${clientId}/evaluate`, {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to evaluate client");
      }
      return response.json();
    },
    onSuccess: (_, clientId) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    },
  });
}

// Fetch closed clients (optionally by workflow)
export function useClosedClients(workflow?: ClosedFromWorkflow) {
  return useQuery<Client[]>({
    queryKey: ["clients", "closed", workflow],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (workflow) params.set("workflow", workflow);

      const response = await fetch(`/api/clients/closed?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch closed clients");
      }
      return response.json();
    },
  });
}

// Reopen a closed case
export function useReopenClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      reason,
      newStatus,
    }: {
      clientId: string;
      reason: string;
      newStatus: ClientStatus;
    }) => {
      const response = await fetch(`/api/clients/${clientId}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, newStatus }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reopen case");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate all client-related queries
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client", variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ["reopen-history", variables.clientId] });
    },
  });
}

// Fetch reopen history for a client
export function useClientReopenHistory(clientId: string | null) {
  return useQuery<CaseReopenHistory[]>({
    queryKey: ["reopen-history", clientId],
    queryFn: async () => {
      if (!clientId) throw new Error("No client ID provided");
      const response = await fetch(`/api/clients/${clientId}/reopen-history`);
      if (!response.ok) {
        throw new Error("Failed to fetch reopen history");
      }
      return response.json();
    },
    enabled: !!clientId,
  });
}
