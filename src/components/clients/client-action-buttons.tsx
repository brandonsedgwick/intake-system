"use client";

import { useState } from "react";
import { useUpdateClient } from "@/hooks/use-clients";
import { Client, ClientStatus } from "@/types/client";
import { useToast } from "@/components/ui/toast";
import {
  Mail,
  Users,
  Calendar,
  AlertTriangle,
  Loader2,
  ArrowRight,
} from "lucide-react";

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

interface ActionButtonsProps {
  client: Client;
  onActionComplete?: () => void;
  variant?: "full" | "compact" | "icon-only";
  showAllActions?: boolean;
}

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  isLoading: boolean;
}

function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  isLoading,
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={onClose}
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
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <p className="mt-2 text-sm text-gray-600">{message}</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowRight className="w-4 h-4" />
                  {confirmLabel}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ClientActionButtons({
  client,
  onActionComplete,
  variant = "full",
  showAllActions = false,
}: ActionButtonsProps) {
  const updateClient = useUpdateClient();
  const { addToast } = useToast();

  const [pendingAction, setPendingAction] = useState<{
    type: "outreach" | "referral" | "scheduling";
    targetStatus: ClientStatus;
  } | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const isEvaluated = EVALUATED_STATUSES.includes(client.status);

  const handleAction = async (
    actionType: "outreach" | "referral" | "scheduling",
    targetStatus: ClientStatus
  ) => {
    // If not evaluated, show confirmation
    if (!isEvaluated) {
      setPendingAction({ type: actionType, targetStatus });
      setShowConfirmation(true);
      return;
    }

    // Otherwise, proceed directly
    await executeAction(targetStatus, actionType);
  };

  const executeAction = async (
    targetStatus: ClientStatus,
    actionType: string
  ) => {
    try {
      await updateClient.mutateAsync({
        id: client.id,
        data: { status: targetStatus },
      });

      const actionLabels = {
        outreach: "Outreach",
        referral: "Referrals",
        scheduling: "Scheduling",
      };

      addToast({
        type: "success",
        title: `Moved to ${actionLabels[actionType as keyof typeof actionLabels]}`,
        message: `${client.firstName} ${client.lastName} has been moved successfully.`,
      });

      onActionComplete?.();
    } catch (error) {
      addToast({
        type: "error",
        title: "Action failed",
        message: error instanceof Error ? error.message : "Failed to update status",
      });
    }
  };

  const handleConfirm = async () => {
    if (pendingAction) {
      await executeAction(pendingAction.targetStatus, pendingAction.type);
      setShowConfirmation(false);
      setPendingAction(null);
    }
  };

  const handleCancel = () => {
    setShowConfirmation(false);
    setPendingAction(null);
  };

  // Determine which buttons to show based on current status
  // For early-stage clients (new, pending_evaluation), show all three options for flexibility
  const isEarlyStage = ["new", "pending_evaluation"].includes(client.status);

  const showOutreachButton =
    showAllActions ||
    isEarlyStage ||
    ["evaluation_complete", "evaluation_flagged"].includes(client.status);
  const showReferralButton =
    showAllActions ||
    isEarlyStage ||
    [
      "evaluation_complete",
      "evaluation_flagged",
      "pending_outreach",
    ].includes(client.status);
  const showSchedulingButton =
    showAllActions ||
    isEarlyStage ||
    [
      "evaluation_complete",
      "evaluation_flagged",
      "pending_outreach",
      "outreach_sent",
      "follow_up_1",
      "follow_up_2",
      "replied",
    ].includes(client.status);

  const isLoading = updateClient.isPending;

  if (variant === "icon-only") {
    return (
      <>
        <div className="flex items-center gap-1">
          {showOutreachButton && (
            <button
              onClick={() => handleAction("outreach", "pending_outreach")}
              disabled={isLoading}
              className="p-2 rounded-lg hover:bg-purple-50 text-purple-600 disabled:opacity-50 transition-colors"
              title="Move to Outreach"
            >
              <Mail className="w-5 h-5" />
            </button>
          )}
          {showReferralButton && (
            <button
              onClick={() => handleAction("referral", "pending_referral")}
              disabled={isLoading}
              className="p-2 rounded-lg hover:bg-amber-50 text-amber-600 disabled:opacity-50 transition-colors"
              title="Move to Referrals"
            >
              <Users className="w-5 h-5" />
            </button>
          )}
          {showSchedulingButton && (
            <button
              onClick={() => handleAction("scheduling", "ready_to_schedule")}
              disabled={isLoading}
              className="p-2 rounded-lg hover:bg-teal-50 text-teal-600 disabled:opacity-50 transition-colors"
              title="Move to Scheduling"
            >
              <Calendar className="w-5 h-5" />
            </button>
          )}
        </div>

        <ConfirmationModal
          isOpen={showConfirmation}
          onClose={handleCancel}
          onConfirm={handleConfirm}
          title="Skip Evaluation?"
          message={`This client has not been evaluated yet. Are you sure you want to move ${client.firstName} ${client.lastName} to ${
            pendingAction?.type === "outreach"
              ? "Outreach"
              : pendingAction?.type === "referral"
              ? "Referrals"
              : "Scheduling"
          } without evaluating first?`}
          confirmLabel="Yes, Skip Evaluation"
          isLoading={isLoading}
        />
      </>
    );
  }

  if (variant === "compact") {
    return (
      <>
        <div className="flex items-center gap-2">
          {showOutreachButton && (
            <button
              onClick={() => handleAction("outreach", "pending_outreach")}
              disabled={isLoading}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded transition-colors disabled:opacity-50"
            >
              <Mail className="w-3 h-3" />
              Outreach
            </button>
          )}
          {showReferralButton && (
            <button
              onClick={() => handleAction("referral", "pending_referral")}
              disabled={isLoading}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded transition-colors disabled:opacity-50"
            >
              <Users className="w-3 h-3" />
              Referral
            </button>
          )}
          {showSchedulingButton && (
            <button
              onClick={() => handleAction("scheduling", "ready_to_schedule")}
              disabled={isLoading}
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded transition-colors disabled:opacity-50"
            >
              <Calendar className="w-3 h-3" />
              Schedule
            </button>
          )}
        </div>

        <ConfirmationModal
          isOpen={showConfirmation}
          onClose={handleCancel}
          onConfirm={handleConfirm}
          title="Skip Evaluation?"
          message={`This client has not been evaluated yet. Are you sure you want to move ${client.firstName} ${client.lastName} to ${
            pendingAction?.type === "outreach"
              ? "Outreach"
              : pendingAction?.type === "referral"
              ? "Referrals"
              : "Scheduling"
          } without evaluating first?`}
          confirmLabel="Yes, Skip Evaluation"
          isLoading={isLoading}
        />
      </>
    );
  }

  // Full variant
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {showOutreachButton && (
          <button
            onClick={() => handleAction("outreach", "pending_outreach")}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {isLoading && pendingAction?.type === "outreach" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            Move to Outreach
          </button>
        )}
        {showReferralButton && (
          <button
            onClick={() => handleAction("referral", "pending_referral")}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {isLoading && pendingAction?.type === "referral" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Users className="w-4 h-4" />
            )}
            Move to Referrals
          </button>
        )}
        {showSchedulingButton && (
          <button
            onClick={() => handleAction("scheduling", "ready_to_schedule")}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {isLoading && pendingAction?.type === "scheduling" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Calendar className="w-4 h-4" />
            )}
            Move to Scheduling
          </button>
        )}
      </div>

      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={handleCancel}
        onConfirm={handleConfirm}
        title="Skip Evaluation?"
        message={`This client has not been evaluated yet. Are you sure you want to move ${client.firstName} ${client.lastName} to ${
          pendingAction?.type === "outreach"
            ? "Outreach"
            : pendingAction?.type === "referral"
            ? "Referrals"
            : "Scheduling"
        } without evaluating first?`}
        confirmLabel="Yes, Skip Evaluation"
        isLoading={isLoading}
      />
    </>
  );
}
