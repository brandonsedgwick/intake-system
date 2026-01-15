"use client";

import { RefreshCw, CheckCircle, AlertCircle, Clock, Trash2, Wrench } from "lucide-react";
import { useAutoFormSync, useClearClients } from "@/hooks/use-form-sync";
import { useState } from "react";

export function SyncStatus() {
  // Auto-sync disabled - manual sync only until headers are fixed
  const { status, syncMutation, isLoading, error } = useAutoFormSync();
  const clearMutation = useClearClients();
  const [fixingHeaders, setFixingHeaders] = useState(false);
  const [fixResult, setFixResult] = useState<string | null>(null);

  const handleSync = () => {
    syncMutation.mutate();
  };

  const handleClear = () => {
    if (window.confirm("Are you sure you want to clear all client data? This cannot be undone.")) {
      clearMutation.mutate();
    }
  };

  const handleFixHeaders = async () => {
    if (!window.confirm("This will fix the Clients sheet headers and clear all existing client data. Continue?")) {
      return;
    }
    setFixingHeaders(true);
    setFixResult(null);
    try {
      const response = await fetch("/api/setup/fix-headers", { method: "POST" });
      const data = await response.json();
      if (response.ok) {
        setFixResult(data.message);
        // Refresh data after fixing
        window.location.reload();
      } else {
        setFixResult(`Error: ${data.error}`);
      }
    } catch (e) {
      setFixResult(`Error: ${e}`);
    } finally {
      setFixingHeaders(false);
    }
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

      {clearMutation.isSuccess && (
        <div className="mt-3 p-2 bg-blue-50 rounded-lg text-sm text-blue-700">
          All client data cleared
        </div>
      )}

      {/* Admin tools for testing - remove in production */}
      <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
        {status?.clientsCount && status.clientsCount > 0 && (
          <button
            onClick={handleClear}
            disabled={clearMutation.isPending}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {clearMutation.isPending ? "Clearing..." : "Clear All Clients"}
          </button>
        )}
        <button
          onClick={handleFixHeaders}
          disabled={fixingHeaders}
          className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors text-orange-600 hover:bg-orange-50 disabled:opacity-50"
        >
          <Wrench className="w-4 h-4" />
          {fixingHeaders ? "Fixing..." : "Fix Sheet Headers"}
        </button>
        {fixResult && (
          <p className="text-xs text-gray-600">{fixResult}</p>
        )}
      </div>
    </div>
  );
}
