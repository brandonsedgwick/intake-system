"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Loader2, CheckCircle, AlertCircle, Mail, Users, Calendar, AlertTriangle, ArrowRight } from "lucide-react";
import { useClients, useEvaluateClient, useUpdateClient } from "@/hooks/use-clients";
import { Client, ClientStatus } from "@/types/client";
import { formatRelativeTime } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { ClientPreviewModal } from "@/components/clients/client-preview-modal";
import { ClientActionButtons } from "@/components/clients/client-action-buttons";

interface EvaluationProgress {
  total: number;
  completed: number;
  current: string | null;
  results: { clientId: string; clientName: string; status: "success" | "error" | "flagged"; message?: string }[];
}

interface BulkActionProgress {
  total: number;
  completed: number;
  current: string | null;
  actionType: "outreach" | "referral" | "scheduling";
  results: { clientId: string; clientName: string; status: "success" | "error"; message?: string }[];
}

// Statuses that indicate evaluation has been performed
const EVALUATED_STATUSES: ClientStatus[] = [
  "evaluation_complete",
  "evaluation_flagged",
  "pending_outreach",
  "outreach_sent",
  "follow_up_1",
  "follow_up_2",
  "replied",
  "ready_to_schedule",
  "scheduled",
  "completed",
  "pending_referral",
  "referred",
  "closed_no_contact",
  "closed_other",
];

const statusConfig: Record<
  ClientStatus,
  { label: string; bgColor: string; textColor: string }
> = {
  new: { label: "New", bgColor: "bg-blue-100", textColor: "text-blue-700" },
  pending_evaluation: {
    label: "Evaluating",
    bgColor: "bg-purple-100",
    textColor: "text-purple-700",
  },
  evaluation_complete: {
    label: "Evaluation Complete",
    bgColor: "bg-green-100",
    textColor: "text-green-700",
  },
  evaluation_flagged: {
    label: "Evaluation Complete",
    bgColor: "bg-red-100",
    textColor: "text-red-700",
  },
  pending_outreach: {
    label: "Pending Outreach",
    bgColor: "bg-purple-100",
    textColor: "text-purple-700",
  },
  outreach_sent: {
    label: "Outreach Sent",
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-700",
  },
  follow_up_1: {
    label: "Follow-up 1",
    bgColor: "bg-orange-100",
    textColor: "text-orange-700",
  },
  follow_up_2: {
    label: "Follow-up 2",
    bgColor: "bg-red-100",
    textColor: "text-red-700",
  },
  replied: {
    label: "Replied",
    bgColor: "bg-green-100",
    textColor: "text-green-700",
  },
  ready_to_schedule: {
    label: "Ready",
    bgColor: "bg-teal-100",
    textColor: "text-teal-700",
  },
  scheduled: {
    label: "Scheduled",
    bgColor: "bg-emerald-100",
    textColor: "text-emerald-700",
  },
  completed: {
    label: "Completed",
    bgColor: "bg-gray-100",
    textColor: "text-gray-700",
  },
  pending_referral: {
    label: "Pending Referral",
    bgColor: "bg-amber-100",
    textColor: "text-amber-700",
  },
  referred: {
    label: "Referred",
    bgColor: "bg-slate-100",
    textColor: "text-slate-700",
  },
  closed_no_contact: {
    label: "Closed",
    bgColor: "bg-gray-100",
    textColor: "text-gray-600",
  },
  closed_other: {
    label: "Closed",
    bgColor: "bg-gray-100",
    textColor: "text-gray-600",
  },
  duplicate: {
    label: "Duplicate",
    bgColor: "bg-orange-100",
    textColor: "text-orange-700",
  },
};

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
}

function getAvatarColor(name: string) {
  const colors = [
    "bg-purple-100 text-purple-600",
    "bg-green-100 text-green-600",
    "bg-orange-100 text-orange-600",
    "bg-blue-100 text-blue-600",
    "bg-pink-100 text-pink-600",
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

// Filter for clients that need action
function needsAction(client: Client): boolean {
  const actionableStatuses: ClientStatus[] = [
    "new",
    "pending_evaluation",
    "evaluation_complete",
    "evaluation_flagged",
    "pending_outreach",
    "outreach_sent",
    "follow_up_1",
    "follow_up_2",
    "replied",
    "ready_to_schedule",
    "pending_referral",
  ];
  return actionableStatuses.includes(client.status);
}

export function PendingActionsTable() {
  const router = useRouter();
  const { data: clients, isLoading, refetch } = useClients();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [evaluationProgress, setEvaluationProgress] = useState<EvaluationProgress | null>(null);
  const [bulkActionProgress, setBulkActionProgress] = useState<BulkActionProgress | null>(null);
  const evaluateClient = useEvaluateClient();
  const updateClient = useUpdateClient();
  const { addToast, updateToast } = useToast();

  // Preview modal state
  const [previewClientId, setPreviewClientId] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Bulk action confirmation modal state
  const [showBulkConfirmation, setShowBulkConfirmation] = useState(false);
  const [pendingBulkAction, setPendingBulkAction] = useState<{
    type: "outreach" | "referral" | "scheduling";
    targetStatus: ClientStatus;
    unevaluatedClients: Client[];
  } | null>(null);

  // Click tracking for single vs double click
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const DOUBLE_CLICK_DELAY = 300; // ms

  // Handle view button click - single click opens preview, double click navigates
  const handleViewClick = useCallback((clientId: string) => {
    if (clickTimeoutRef.current) {
      // Double click detected - navigate to full page
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      router.push(`/clients/${clientId}`);
    } else {
      // First click - set timeout to detect if it's a single click
      clickTimeoutRef.current = setTimeout(() => {
        // Single click - open preview modal
        setPreviewClientId(clientId);
        setIsPreviewOpen(true);
        clickTimeoutRef.current = null;
      }, DOUBLE_CLICK_DELAY);
    }
  }, [router]);

  const handleClosePreview = useCallback(() => {
    setIsPreviewOpen(false);
    setPreviewClientId(null);
  }, []);

  // Filter to actionable clients and sort by status priority
  const pendingClients = useMemo(() => {
    return clients
      ?.filter(needsAction)
      .sort((a, b) => {
        // Priority order
        const statusOrder: ClientStatus[] = [
          "new",
          "pending_evaluation",
          "evaluation_flagged",
          "evaluation_complete",
          "replied",
          "ready_to_schedule",
          "pending_outreach",
          "follow_up_1",
          "follow_up_2",
          "outreach_sent",
          "pending_referral",
        ];
        return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
      })
      .slice(0, 10); // Show top 10
  }, [clients]);

  const allSelected = pendingClients && pendingClients.length > 0 &&
    pendingClients.every(client => selectedIds.has(client.id));

  const someSelected = selectedIds.size > 0;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingClients?.map(c => c.id) || []));
    }
  };

  const handleSelectOne = (clientId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(clientId)) {
      newSelected.delete(clientId);
    } else {
      newSelected.add(clientId);
    }
    setSelectedIds(newSelected);
  };

  const handleEvaluateInquiries = async () => {
    const selectedClients = pendingClients?.filter(c => selectedIds.has(c.id)) || [];
    if (selectedClients.length === 0) return;

    // Show loading toast
    const toastId = addToast({
      type: "loading",
      title: "Evaluating inquiries...",
      message: `Processing ${selectedClients.length} client${selectedClients.length === 1 ? "" : "s"}`,
    });

    // Initialize progress
    setEvaluationProgress({
      total: selectedClients.length,
      completed: 0,
      current: selectedClients[0].firstName + " " + selectedClients[0].lastName,
      results: [],
    });

    const results: EvaluationProgress["results"] = [];

    // Evaluate each client sequentially
    for (let i = 0; i < selectedClients.length; i++) {
      const client = selectedClients[i];
      const clientName = `${client.firstName} ${client.lastName}`;

      setEvaluationProgress(prev => prev ? {
        ...prev,
        current: clientName,
        completed: i,
      } : null);

      try {
        const result = await evaluateClient.mutateAsync(client.id);

        // Determine result status based on the new client status
        const status = result.client?.status === "evaluation_flagged" ? "flagged" : "success";
        results.push({
          clientId: client.id,
          clientName,
          status,
          message: status === "flagged" ? "Flagged for review" : "Evaluation complete",
        });
      } catch (error) {
        results.push({
          clientId: client.id,
          clientName,
          status: "error",
          message: error instanceof Error ? error.message : "Evaluation failed",
        });
      }
    }

    // Update final progress
    setEvaluationProgress(prev => prev ? {
      ...prev,
      completed: selectedClients.length,
      current: null,
      results,
    } : null);

    // Count results
    const successCount = results.filter(r => r.status === "success").length;
    const flaggedCount = results.filter(r => r.status === "flagged").length;
    const errorCount = results.filter(r => r.status === "error").length;

    // Update toast with final result
    if (errorCount > 0) {
      updateToast(toastId, {
        type: "warning",
        title: "Evaluation completed with errors",
        message: `${successCount} complete, ${flaggedCount} flagged, ${errorCount} failed`,
      });
    } else if (flaggedCount > 0) {
      updateToast(toastId, {
        type: "warning",
        title: "Evaluation complete",
        message: `${successCount} clear, ${flaggedCount} flagged for review`,
      });
    } else {
      updateToast(toastId, {
        type: "success",
        title: "Evaluation complete",
        message: `All ${successCount} client${successCount === 1 ? "" : "s"} evaluated successfully`,
      });
    }

    // Clear selection after a brief delay
    setTimeout(() => {
      setSelectedIds(new Set());
      setEvaluationProgress(null);
      refetch();
    }, 2000);
  };

  // Handle bulk move action
  const handleBulkAction = (
    actionType: "outreach" | "referral" | "scheduling",
    targetStatus: ClientStatus
  ) => {
    const selectedClients = pendingClients?.filter(c => selectedIds.has(c.id)) || [];
    if (selectedClients.length === 0) return;

    // Check for unevaluated clients
    const unevaluatedClients = selectedClients.filter(
      c => !EVALUATED_STATUSES.includes(c.status)
    );

    if (unevaluatedClients.length > 0) {
      // Show confirmation modal
      setPendingBulkAction({ type: actionType, targetStatus, unevaluatedClients });
      setShowBulkConfirmation(true);
      return;
    }

    // All clients are evaluated, proceed directly
    executeBulkAction(selectedClients, actionType, targetStatus);
  };

  // Execute bulk action
  const executeBulkAction = async (
    clientsToMove: Client[],
    actionType: "outreach" | "referral" | "scheduling",
    targetStatus: ClientStatus
  ) => {
    const actionLabels = {
      outreach: "Outreach",
      referral: "Referrals",
      scheduling: "Scheduling",
    };

    // Show loading toast
    const toastId = addToast({
      type: "loading",
      title: `Moving to ${actionLabels[actionType]}...`,
      message: `Processing ${clientsToMove.length} client${clientsToMove.length === 1 ? "" : "s"}`,
    });

    // Initialize progress
    setBulkActionProgress({
      total: clientsToMove.length,
      completed: 0,
      current: clientsToMove[0].firstName + " " + clientsToMove[0].lastName,
      actionType,
      results: [],
    });

    const results: BulkActionProgress["results"] = [];

    // Process each client sequentially
    for (let i = 0; i < clientsToMove.length; i++) {
      const client = clientsToMove[i];
      const clientName = `${client.firstName} ${client.lastName}`;

      setBulkActionProgress(prev => prev ? {
        ...prev,
        current: clientName,
        completed: i,
      } : null);

      try {
        await updateClient.mutateAsync({
          id: client.id,
          data: { status: targetStatus },
        });

        results.push({
          clientId: client.id,
          clientName,
          status: "success",
          message: `Moved to ${actionLabels[actionType]}`,
        });
      } catch (error) {
        results.push({
          clientId: client.id,
          clientName,
          status: "error",
          message: error instanceof Error ? error.message : "Failed to update",
        });
      }
    }

    // Update final progress
    setBulkActionProgress(prev => prev ? {
      ...prev,
      completed: clientsToMove.length,
      current: null,
      results,
    } : null);

    // Count results
    const successCount = results.filter(r => r.status === "success").length;
    const errorCount = results.filter(r => r.status === "error").length;

    // Update toast with final result
    if (errorCount > 0) {
      updateToast(toastId, {
        type: "warning",
        title: "Bulk action completed with errors",
        message: `${successCount} moved, ${errorCount} failed`,
      });
    } else {
      updateToast(toastId, {
        type: "success",
        title: `Moved to ${actionLabels[actionType]}`,
        message: `${successCount} client${successCount === 1 ? "" : "s"} moved successfully`,
      });
    }

    // Clear selection after a brief delay
    setTimeout(() => {
      setSelectedIds(new Set());
      setBulkActionProgress(null);
      refetch();
    }, 2000);
  };

  // Handle bulk action confirmation
  const handleBulkConfirm = () => {
    if (pendingBulkAction) {
      const selectedClients = pendingClients?.filter(c => selectedIds.has(c.id)) || [];
      executeBulkAction(selectedClients, pendingBulkAction.type, pendingBulkAction.targetStatus);
      setShowBulkConfirmation(false);
      setPendingBulkAction(null);
    }
  };

  const handleBulkCancel = () => {
    setShowBulkConfirmation(false);
    setPendingBulkAction(null);
  };

  const isBulkActionLoading = updateClient.isPending || bulkActionProgress !== null;

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Pending Actions</h2>
        </div>
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Pending Actions</h2>
          <span className="text-sm text-gray-500">
            {pendingClients?.length || 0} items
          </span>
        </div>

        {/* Evaluation Progress */}
        {evaluationProgress && (
          <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                <span className="text-sm font-medium text-gray-900">
                  Evaluating inquiries...
                </span>
              </div>
              <span className="text-sm text-gray-500">
                {evaluationProgress.completed} / {evaluationProgress.total}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-blue-600 transition-all duration-300 ease-out"
                style={{ width: `${(evaluationProgress.completed / evaluationProgress.total) * 100}%` }}
              />
            </div>

            {/* Current client */}
            {evaluationProgress.current && (
              <p className="text-sm text-gray-600">
                Processing: <span className="font-medium">{evaluationProgress.current}</span>
              </p>
            )}

            {/* Results summary when complete */}
            {evaluationProgress.completed === evaluationProgress.total && evaluationProgress.results.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200 space-y-1">
                {evaluationProgress.results.map((result) => (
                  <div key={result.clientId} className="flex items-center gap-2 text-sm">
                    {result.status === "success" ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : result.status === "flagged" ? (
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className={
                      result.status === "success" ? "text-green-700" :
                      result.status === "flagged" ? "text-amber-700" :
                      "text-red-700"
                    }>
                      {result.clientName}: {result.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bulk Action Progress */}
        {bulkActionProgress && (
          <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                <span className="text-sm font-medium text-gray-900">
                  Moving to {bulkActionProgress.actionType === "outreach" ? "Outreach" : bulkActionProgress.actionType === "referral" ? "Referrals" : "Scheduling"}...
                </span>
              </div>
              <span className="text-sm text-gray-500">
                {bulkActionProgress.completed} / {bulkActionProgress.total}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-blue-600 transition-all duration-300 ease-out"
                style={{ width: `${(bulkActionProgress.completed / bulkActionProgress.total) * 100}%` }}
              />
            </div>

            {/* Current client */}
            {bulkActionProgress.current && (
              <p className="text-sm text-gray-600">
                Processing: <span className="font-medium">{bulkActionProgress.current}</span>
              </p>
            )}

            {/* Results summary when complete */}
            {bulkActionProgress.completed === bulkActionProgress.total && bulkActionProgress.results.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200 space-y-1">
                {bulkActionProgress.results.map((result) => (
                  <div key={result.clientId} className="flex items-center gap-2 text-sm">
                    {result.status === "success" ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className={result.status === "success" ? "text-green-700" : "text-red-700"}>
                      {result.clientName}: {result.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selection toolbar - hide during evaluation or bulk action */}
        {someSelected && !evaluationProgress && !bulkActionProgress && (
          <div className="mt-3 flex flex-wrap items-center gap-3 p-3 bg-blue-50 rounded-lg">
            <span className="text-sm text-blue-700 font-medium">
              {selectedIds.size} selected
            </span>
            <div className="h-4 w-px bg-blue-200" />
            <button
              onClick={handleEvaluateInquiries}
              disabled={evaluateClient.isPending || isBulkActionLoading}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition-colors"
            >
              <ClipboardCheck className="w-4 h-4" />
              Evaluate
            </button>
            <div className="h-4 w-px bg-blue-200" />
            <button
              onClick={() => handleBulkAction("outreach", "pending_outreach")}
              disabled={isBulkActionLoading}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 rounded-lg transition-colors"
            >
              <Mail className="w-4 h-4" />
              Outreach
            </button>
            <button
              onClick={() => handleBulkAction("referral", "pending_referral")}
              disabled={isBulkActionLoading}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 rounded-lg transition-colors"
            >
              <Users className="w-4 h-4" />
              Referrals
            </button>
            <button
              onClick={() => handleBulkAction("scheduling", "ready_to_schedule")}
              disabled={isBulkActionLoading}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:bg-teal-400 rounded-lg transition-colors"
            >
              <Calendar className="w-4 h-4" />
              Scheduling
            </button>
          </div>
        )}
      </div>

      {!pendingClients || pendingClients.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <p>No pending actions right now.</p>
          <p className="text-sm mt-1">All caught up!</p>
        </div>
      ) : (
        <div className="overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-12 px-6 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Client
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Payment
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Added
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Preferred Clinician
                </th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pendingClients?.map((client) => {
                const status = statusConfig[client.status] || statusConfig.new;
                const initials = getInitials(client.firstName, client.lastName);
                const avatarColor = getAvatarColor(client.firstName);
                const isSelected = selectedIds.has(client.id);

                return (
                  <tr
                    key={client.id}
                    className={`hover:bg-gray-50 transition-colors ${isSelected ? "bg-blue-50" : ""}`}
                  >
                    <td className="w-12 px-6 py-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectOne(client.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/clients/${client.id}`}
                        className="flex items-center gap-3"
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${avatarColor}`}
                        >
                          {initials}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 hover:text-blue-600">
                            {client.firstName} {client.lastName}
                          </p>
                          <p className="text-xs text-gray-500">{client.email}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bgColor} ${status.textColor}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {client.paymentType || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatRelativeTime(client.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {client.requestedClinician || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <ClientActionButtons
                          client={client}
                          variant="icon-only"
                          onActionComplete={() => refetch()}
                        />
                        <button
                          onClick={() => handleViewClick(client.id)}
                          className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                          title="Click to preview, double-click to open"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-6 py-4 border-t border-gray-200">
        <Link
          href="/clients"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          View all clients &rarr;
        </Link>
      </div>

      {/* Client Preview Modal */}
      <ClientPreviewModal
        clientId={previewClientId}
        isOpen={isPreviewOpen}
        onClose={handleClosePreview}
        onActionComplete={() => refetch()}
      />

      {/* Bulk Action Confirmation Modal */}
      {showBulkConfirmation && pendingBulkAction && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={handleBulkCancel}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">Skip Evaluation?</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    {pendingBulkAction.unevaluatedClients.length === 1
                      ? `1 client has not been evaluated yet.`
                      : `${pendingBulkAction.unevaluatedClients.length} clients have not been evaluated yet.`}
                    {" "}Are you sure you want to move {selectedIds.size === 1 ? "this client" : `these ${selectedIds.size} clients`} to{" "}
                    {pendingBulkAction.type === "outreach"
                      ? "Outreach"
                      : pendingBulkAction.type === "referral"
                      ? "Referrals"
                      : "Scheduling"}
                    {" "}without evaluating first?
                  </p>
                  {pendingBulkAction.unevaluatedClients.length <= 5 && (
                    <div className="mt-3 text-sm text-gray-500">
                      <strong>Unevaluated:</strong>{" "}
                      {pendingBulkAction.unevaluatedClients
                        .map(c => `${c.firstName} ${c.lastName}`)
                        .join(", ")}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={handleBulkCancel}
                  disabled={isBulkActionLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkConfirm}
                  disabled={isBulkActionLoading}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isBulkActionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      Yes, Skip Evaluation
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
