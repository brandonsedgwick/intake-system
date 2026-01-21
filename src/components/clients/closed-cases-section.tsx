"use client";

import { useState } from "react";
import { Client, ClientStatus, ClosedFromWorkflow } from "@/types/client";
import { formatDate } from "@/lib/utils";
import { ReopenCaseModal } from "./reopen-case-modal";
import {
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Archive,
  User,
  Calendar,
} from "lucide-react";

// Status labels
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

// Status badge colors
const STATUS_BADGE_COLORS: Record<ClientStatus, { bg: string; text: string }> = {
  new: { bg: "bg-blue-100", text: "text-blue-700" },
  pending_evaluation: { bg: "bg-yellow-100", text: "text-yellow-700" },
  evaluation_complete: { bg: "bg-green-100", text: "text-green-700" },
  evaluation_flagged: { bg: "bg-red-100", text: "text-red-700" },
  pending_outreach: { bg: "bg-purple-100", text: "text-purple-700" },
  outreach_sent: { bg: "bg-indigo-100", text: "text-indigo-700" },
  follow_up_1: { bg: "bg-orange-100", text: "text-orange-700" },
  follow_up_2: { bg: "bg-red-100", text: "text-red-700" },
  replied: { bg: "bg-green-100", text: "text-green-700" },
  ready_to_schedule: { bg: "bg-teal-100", text: "text-teal-700" },
  scheduled: { bg: "bg-emerald-100", text: "text-emerald-700" },
  completed: { bg: "bg-gray-100", text: "text-gray-700" },
  pending_referral: { bg: "bg-amber-100", text: "text-amber-700" },
  referred: { bg: "bg-slate-100", text: "text-slate-700" },
  closed_no_contact: { bg: "bg-gray-100", text: "text-gray-600" },
  closed_other: { bg: "bg-gray-100", text: "text-gray-600" },
  duplicate: { bg: "bg-orange-100", text: "text-orange-700" },
  // New automated outreach statuses
  awaiting_response: { bg: "bg-blue-100", text: "text-blue-700" },
  follow_up_due: { bg: "bg-amber-100", text: "text-amber-700" },
  no_contact_ok_close: { bg: "bg-red-100", text: "text-red-700" },
  in_communication: { bg: "bg-green-100", text: "text-green-700" },
};

interface ClosedCasesSectionProps {
  clients: Client[] | undefined;
  workflow?: ClosedFromWorkflow;
  isExpanded: boolean;
  onToggle: () => void;
  isLoading?: boolean;
  onClientClick?: (client: Client) => void;
  onReopenSuccess?: () => void;
}

export function ClosedCasesSection({
  clients,
  workflow,
  isExpanded,
  onToggle,
  isLoading,
  onClientClick,
  onReopenSuccess,
}: ClosedCasesSectionProps) {
  const [reopenClient, setReopenClient] = useState<Client | null>(null);

  const closedCount = clients?.length || 0;

  return (
    <>
      <div className="border-t border-gray-200 bg-gray-50/50">
        {/* Toggle Header */}
        <button
          onClick={onToggle}
          className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-100/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Archive className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">
              Closed Cases
              {workflow && (
                <span className="text-gray-500">
                  {" "}
                  from {workflow.charAt(0).toUpperCase() + workflow.slice(1)}
                </span>
              )}
            </span>
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-200 text-gray-700">
              {closedCount}
            </span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="px-4 pb-4">
            {isLoading ? (
              <div className="text-center py-8 text-sm text-gray-500">
                Loading closed cases...
              </div>
            ) : closedCount === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500">
                No closed cases found
              </div>
            ) : (
              <div className="space-y-2">
                {clients?.map((client) => {
                  const statusColors = STATUS_BADGE_COLORS[client.status];

                  return (
                    <div
                      key={client.id}
                      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div
                          className="flex items-center gap-3 flex-1 cursor-pointer"
                          onClick={() => onClientClick?.(client)}
                        >
                          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-sm font-medium flex-shrink-0">
                            {client.firstName[0]}
                            {client.lastName[0]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 truncate">
                                {client.firstName} {client.lastName}
                              </span>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors.bg} ${statusColors.text}`}
                              >
                                {STATUS_LABELS[client.status]}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                              {client.closedDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {formatDate(client.closedDate)}
                                </span>
                              )}
                              {client.closedReason && (
                                <span className="truncate max-w-[200px]">
                                  {client.closedReason}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setReopenClient(client);
                          }}
                          className="ml-3 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1.5 flex-shrink-0"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Reopen
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reopen Modal */}
      {reopenClient && (
        <ReopenCaseModal
          client={reopenClient}
          isOpen={!!reopenClient}
          onClose={() => setReopenClient(null)}
          onSuccess={onReopenSuccess}
        />
      )}
    </>
  );
}
