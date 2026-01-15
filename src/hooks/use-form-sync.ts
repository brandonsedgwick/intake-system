import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";

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

// Auto-sync hook - automatically syncs when pending entries are detected
export function useAutoFormSync() {
  const { data: status, isLoading, error } = useFormSyncStatus();
  const syncMutation = useFormSync();

  // Auto-sync when pending entries are detected
  // Uses React Query's built-in deduplication to prevent rapid re-syncs
  React.useEffect(() => {
    if (
      status?.pendingSync &&
      status.pendingSync > 0 &&
      !syncMutation.isPending &&
      !syncMutation.isSuccess // Don't re-trigger if we just synced
    ) {
      syncMutation.mutate();
    }
  }, [status?.pendingSync]);

  return { status, syncMutation, isLoading, error };
}

