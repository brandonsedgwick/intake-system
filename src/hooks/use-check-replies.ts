import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSettings } from "./use-settings";

interface CheckReplyResult {
  clientId: string;
  clientName: string;
  attemptId: string;
  attemptNumber: number;
  previousStatus: string;
  newStatus: string | null;
  hasReply: boolean;
  replyPreview?: string;
  error?: string;
}

interface CheckRepliesResponse {
  success: boolean;
  summary?: {
    clientsChecked: number;
    repliesFound: number;
    statusUpdates: number;
  };
  results: CheckReplyResult[];
  checkedAt: string;
  error?: string;
}

interface SingleClientCheckResponse {
  success: boolean;
  clientId: string;
  results: CheckReplyResult[];
  error?: string;
}

/**
 * Hook for checking all outreach clients for replies with automatic polling
 */
export function useCheckReplies() {
  const { data: settings } = useSettings();
  const queryClient = useQueryClient();

  // Get polling interval from settings (default 5 minutes)
  const pollingIntervalMinutes = parseInt(
    settings?.replyCheckIntervalMinutes || "5",
    10
  );
  const pollingIntervalMs = pollingIntervalMinutes * 60 * 1000;

  return useQuery<CheckRepliesResponse>({
    queryKey: ["check-replies"],
    queryFn: async () => {
      const response = await fetch("/api/outreach/check-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to check replies");
      }

      const data = await response.json();

      // If any status updates were made, invalidate clients query
      if (data.summary?.statusUpdates > 0) {
        queryClient.invalidateQueries({ queryKey: ["clients"] });
        queryClient.invalidateQueries({ queryKey: ["outreach-attempts"] });
      }

      return data;
    },
    // Auto-polling configuration
    refetchInterval: pollingIntervalMs,
    refetchIntervalInBackground: false, // Don't poll when tab is hidden
    staleTime: 30000, // Consider data stale after 30 seconds
    enabled: true,
  });
}

/**
 * Hook for manually triggering a reply check (used by "Check Now" button)
 */
export function useManualCheckReplies() {
  const queryClient = useQueryClient();

  return useMutation<CheckRepliesResponse>({
    mutationFn: async () => {
      const response = await fetch("/api/outreach/check-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error("Failed to check replies");
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate relevant queries to refresh data
      if (data.summary?.statusUpdates && data.summary.statusUpdates > 0) {
        queryClient.invalidateQueries({ queryKey: ["clients"] });
        queryClient.invalidateQueries({ queryKey: ["outreach-attempts"] });
      }
      // Also update the check-replies cache
      queryClient.setQueryData(["check-replies"], data);
    },
  });
}

/**
 * Hook for checking a single client for replies
 */
export function useCheckClientReplies() {
  const queryClient = useQueryClient();

  return useMutation<SingleClientCheckResponse, Error, string>({
    mutationFn: async (clientId: string) => {
      const response = await fetch(
        `/api/outreach/check-replies?clientId=${clientId}`
      );

      if (!response.ok) {
        throw new Error("Failed to check replies for client");
      }

      return response.json();
    },
    onSuccess: (data, clientId) => {
      // Invalidate queries for the specific client
      queryClient.invalidateQueries({ queryKey: ["clients", clientId] });
      queryClient.invalidateQueries({
        queryKey: ["outreach-attempts", clientId],
      });
      // Also invalidate the main clients list
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

/**
 * Get the last check time from the cache
 */
export function useLastCheckTime() {
  const { data } = useCheckReplies();
  return data?.checkedAt ? new Date(data.checkedAt) : null;
}
