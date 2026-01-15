"use client";

import { RefreshCw, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { useAutoFormSync } from "@/hooks/use-form-sync";

export function SyncStatus() {
  const { status, syncMutation, isLoading, error } = useAutoFormSync();

  const handleSync = () => {
    syncMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          <span className="text-sm text-gray-500">Checking sync status...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-sm text-red-600">Failed to check sync status</span>
        </div>
      </div>
    );
  }

  const hasPending = status && status.pendingSync > 0;

  return (
    <div className={`bg-white rounded-xl border ${hasPending ? "border-yellow-200" : "border-gray-200"} p-4`}>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {hasPending ? (
            <Clock className="w-5 h-5 text-yellow-500 flex-shrink-0" />
          ) : (
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {hasPending
                ? `${status?.pendingSync} new form submission${status?.pendingSync === 1 ? "" : "s"}`
                : "All form responses synced"}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {status?.syncedCount || 0} synced from {status?.formResponsesCount || 0} responses
            </p>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={syncMutation.isPending}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors flex-shrink-0 ${
            hasPending
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          <span className="whitespace-nowrap">{syncMutation.isPending ? "Syncing..." : "Sync Now"}</span>
        </button>
      </div>

      {syncMutation.isSuccess && (
        <div className="mt-3 p-2 bg-green-50 rounded-lg text-sm text-green-700">
          Synced {syncMutation.data.newClients} new client{syncMutation.data.newClients === 1 ? "" : "s"}
          {syncMutation.data.duplicates > 0 && (
            <span className="text-yellow-700">
              {" "}({syncMutation.data.duplicates} duplicate{syncMutation.data.duplicates === 1 ? "" : "s"} flagged)
            </span>
          )}
        </div>
      )}

      {syncMutation.isError && (
        <div className="mt-3 p-2 bg-red-50 rounded-lg text-sm text-red-700">
          Sync failed
        </div>
      )}
    </div>
  );
}
