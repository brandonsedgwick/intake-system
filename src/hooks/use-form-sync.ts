import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface SyncStatus {
  formResponsesCount: number;
  clientsCount: number;
  syncedCount: number;
  pendingSync: number;
  lastSyncCheck: string;
}

interface SyncResult {
  newClients: number;
  duplicates: number;
  errors: string[];
  syncedIds: string[];
  message: string;
}

// Fetch sync status
export function useFormSyncStatus() {
  return useQuery<SyncStatus>({
    queryKey: ["form-sync-status"],
    queryFn: async () => {
      const response = await fetch("/api/sync/form-responses");
      if (!response.ok) {
        throw new Error("Failed to fetch sync status");
      }
      return response.json();
    },
    refetchInterval: 60000, // Check every minute
  });
}

// Trigger manual sync
export function useFormSync() {
  const queryClient = useQueryClient();

  return useMutation<SyncResult>({
    mutationFn: async () => {
      const response = await fetch("/api/sync/form-responses", {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to sync form responses");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["form-sync-status"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}

// Auto-sync hook - DISABLED for now to prevent infinite loops
// Will be re-enabled once sheet headers are fixed
export function useAutoFormSync() {
  const { data: status, isLoading, error } = useFormSyncStatus();
  const syncMutation = useFormSync();

  // Auto-sync disabled - user must click "Sync Now" manually
  // This prevents infinite loops when sheet headers are misconfigured

  return { status, syncMutation, isLoading, error };
}

// Clear all clients (for testing)
export function useClearClients() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/clients", {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to clear clients");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["form-sync-status"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
    },
  });
}
