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

  // Track if we've already triggered a sync for the current pending count
  const hasSyncedRef = React.useRef<boolean>(false);

  // Auto-sync when pending entries are detected
  React.useEffect(() => {
    const pendingCount = status?.pendingSync ?? 0;

    console.log("[AutoSync] Status check:", {
      pendingCount,
      isPending: syncMutation.isPending,
      hasSynced: hasSyncedRef.current,
      isLoading,
    });

    // Trigger sync if:
    // 1. There are pending entries
    // 2. We're not already syncing
    // 3. We haven't already synced this set of pending entries
    if (pendingCount > 0 && !syncMutation.isPending && !hasSyncedRef.current) {
      console.log("[AutoSync] Triggering auto-sync for", pendingCount, "pending entries");
      hasSyncedRef.current = true;
      syncMutation.mutate();
    }

    // Reset the flag when pending goes to 0 (all synced) so we can sync again
    if (pendingCount === 0) {
      hasSyncedRef.current = false;
    }
  }, [status?.pendingSync, syncMutation.isPending, isLoading]);

  // Also reset if a new batch arrives (pending count increases)
  React.useEffect(() => {
    const pendingCount = status?.pendingSync ?? 0;
    // If pending count increases after we've synced, allow syncing again
    if (pendingCount > 0 && hasSyncedRef.current && !syncMutation.isPending) {
      // Check if mutation finished but there's still pending (new entries came in)
      console.log("[AutoSync] New entries detected after sync, resetting flag");
      hasSyncedRef.current = false;
    }
  }, [status?.pendingSync]);

  return { status, syncMutation, isLoading, error };
}

