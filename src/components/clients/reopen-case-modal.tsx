"use client";

import { useEffect, useState } from "react";
import { useReopenClient, useClientReopenHistory } from "@/hooks/use-clients";
import {
  Client,
  ClientStatus,
  getNonClosedStatuses,
  WORKFLOW_STATUS_MAP,
} from "@/types/client";
import { formatDate } from "@/lib/utils";
import { X, AlertCircle, Loader2, RotateCcw, History } from "lucide-react";

// Status labels for the dropdown
const STATUS_LABELS: Record<ClientStatus, string> = {
  new: "New",
  pending_evaluation: "Pending Evaluation",
  evaluation_complete: "Evaluation Complete",
  evaluation_flagged: "Evaluation Flagged",
  pending_outreach: "Ready for Outreach",
  outreach_sent: "Outreach Sent",
  follow_up_1: "Follow-up 1",
  follow_up_2: "Follow-up 2",
  replied: "Replied",
  ready_to_schedule: "Ready to Schedule",
  scheduled: "Scheduled",
  completed: "Completed",
  pending_referral: "Pending Referral",
  referred: "Referred",
  closed_no_contact: "Closed - No Contact",
  closed_other: "Closed",
  duplicate: "Duplicate",
  // New automated outreach statuses
  awaiting_response: "Awaiting Response",
  follow_up_due: "Follow-up Due",
  no_contact_ok_close: "No Contact - OK to Close",
  in_communication: "In Communication",
};

// Group statuses by workflow for organized dropdown
const STATUS_GROUPS = [
  {
    label: "Evaluation",
    statuses: WORKFLOW_STATUS_MAP.evaluation.filter(
      (s) => getNonClosedStatuses().includes(s)
    ),
  },
  {
    label: "Outreach",
    statuses: WORKFLOW_STATUS_MAP.outreach.filter(
      (s) => getNonClosedStatuses().includes(s)
    ),
  },
  {
    label: "Scheduling",
    statuses: WORKFLOW_STATUS_MAP.scheduling.filter(
      (s) => getNonClosedStatuses().includes(s)
    ),
  },
  {
    label: "Referral",
    statuses: WORKFLOW_STATUS_MAP.referral.filter(
      (s) => getNonClosedStatuses().includes(s)
    ),
  },
];

interface ReopenCaseModalProps {
  client: Client;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ReopenCaseModal({
  client,
  isOpen,
  onClose,
  onSuccess,
}: ReopenCaseModalProps) {
  const [reason, setReason] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<ClientStatus>("new");
  const [error, setError] = useState<string | null>(null);

  const reopenClient = useReopenClient();
  const { data: reopenHistory } = useClientReopenHistory(client.id);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setReason("");
      setSelectedStatus("new");
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (reason.trim().length < 10) {
      setError("Please provide a reason with at least 10 characters");
      return;
    }

    try {
      await reopenClient.mutateAsync({
        clientId: client.id,
        reason: reason.trim(),
        newStatus: selectedStatus,
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reopen case");
    }
  };

  const hasBeenReopenedBefore = reopenHistory && reopenHistory.length > 0;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-b px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Reopen Case
                </h2>
                <p className="text-sm text-gray-500">
                  {client.firstName} {client.lastName}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-6">
              {/* Client closure info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Closure Information
                </h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <div>
                    <span className="text-gray-500">Current Status:</span>{" "}
                    <span className="font-medium">
                      {STATUS_LABELS[client.status]}
                    </span>
                  </div>
                  {client.closedDate && (
                    <div>
                      <span className="text-gray-500">Closed Date:</span>{" "}
                      {formatDate(client.closedDate)}
                    </div>
                  )}
                  {client.closedReason && (
                    <div>
                      <span className="text-gray-500">Reason:</span>{" "}
                      {client.closedReason}
                    </div>
                  )}
                  {client.closedFromWorkflow && (
                    <div>
                      <span className="text-gray-500">Closed From:</span>{" "}
                      <span className="capitalize">
                        {client.closedFromWorkflow}
                      </span>{" "}
                      workflow
                    </div>
                  )}
                </div>
              </div>

              {/* Warning if reopened before */}
              {hasBeenReopenedBefore && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <History className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-medium text-amber-800">
                        Previously Reopened
                      </h4>
                      <p className="text-sm text-amber-700 mt-1">
                        This case has been reopened {reopenHistory.length} time
                        {reopenHistory.length > 1 ? "s" : ""} before. Last
                        reopened on {formatDate(reopenHistory[0].reopenedAt)}.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* New status selection */}
              <div>
                <label
                  htmlFor="newStatus"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Reopen to Status <span className="text-red-500">*</span>
                </label>
                <select
                  id="newStatus"
                  value={selectedStatus}
                  onChange={(e) =>
                    setSelectedStatus(e.target.value as ClientStatus)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {STATUS_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.statuses.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Reason textarea */}
              <div>
                <label
                  htmlFor="reason"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Reason for Reopening <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Please explain why this case is being reopened..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={4}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Minimum 10 characters ({reason.trim().length}/10)
                </p>
              </div>

              {/* Error message */}
              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t px-6 py-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  reopenClient.isPending || reason.trim().length < 10
                }
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
              >
                {reopenClient.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Reopening...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Reopen Case
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
