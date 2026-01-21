"use client";

import { useEffect } from "react";
import { useClient } from "@/hooks/use-clients";
import {
  Client,
  ClientStatus,
  TextEvaluationResult,
  TextEvaluationSeverity,
  TextEvaluationCategory,
} from "@/types/client";
import { formatDateTime, formatDate } from "@/lib/utils";
import Link from "next/link";
import {
  X,
  Mail,
  Phone,
  Calendar,
  User,
  FileText,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { ClientActionButtons } from "@/components/clients/client-action-buttons";

// Severity badge colors for text evaluation
const SEVERITY_CONFIG: Record<
  TextEvaluationSeverity,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  none: { label: "None", color: "text-gray-600", bgColor: "bg-gray-100", borderColor: "border-gray-200" },
  low: { label: "Low", color: "text-blue-700", bgColor: "bg-blue-100", borderColor: "border-blue-200" },
  medium: { label: "Medium", color: "text-yellow-700", bgColor: "bg-yellow-100", borderColor: "border-yellow-200" },
  high: { label: "High", color: "text-orange-700", bgColor: "bg-orange-100", borderColor: "border-orange-200" },
  urgent: { label: "Urgent", color: "text-red-700", bgColor: "bg-red-100", borderColor: "border-red-200" },
};

// Category labels for text evaluation
const CATEGORY_LABELS: Record<TextEvaluationCategory, string> = {
  suicidal_ideation: "Suicidal Ideation",
  self_harm: "Self-Harm",
  substance_use: "Substance Use",
  psychosis: "Psychosis",
  eating_disorder: "Eating Disorder",
  hospitalization: "Hospitalization",
  violence: "Violence/Safety",
  abuse: "Abuse/Trauma",
  custom: "Custom",
};

const STATUS_CONFIG: Record<
  ClientStatus,
  { label: string; color: string; bgColor: string }
> = {
  new: { label: "New", color: "text-blue-700", bgColor: "bg-blue-100" },
  pending_evaluation: { label: "Pending Evaluation", color: "text-yellow-700", bgColor: "bg-yellow-100" },
  evaluation_complete: { label: "Evaluation Complete", color: "text-green-700", bgColor: "bg-green-100" },
  evaluation_flagged: { label: "Evaluation Flagged", color: "text-red-700", bgColor: "bg-red-100" },
  pending_outreach: { label: "Ready for Outreach", color: "text-purple-700", bgColor: "bg-purple-100" },
  outreach_sent: { label: "Outreach Sent", color: "text-indigo-700", bgColor: "bg-indigo-100" },
  follow_up_1: { label: "Follow-up 1", color: "text-orange-700", bgColor: "bg-orange-100" },
  follow_up_2: { label: "Follow-up 2", color: "text-red-700", bgColor: "bg-red-100" },
  replied: { label: "Replied", color: "text-green-700", bgColor: "bg-green-100" },
  ready_to_schedule: { label: "Ready to Schedule", color: "text-teal-700", bgColor: "bg-teal-100" },
  scheduled: { label: "Scheduled", color: "text-emerald-700", bgColor: "bg-emerald-100" },
  completed: { label: "Completed", color: "text-gray-700", bgColor: "bg-gray-100" },
  pending_referral: { label: "Pending Referral", color: "text-amber-700", bgColor: "bg-amber-100" },
  referred: { label: "Referred", color: "text-slate-700", bgColor: "bg-slate-100" },
  closed_no_contact: { label: "Closed - No Contact", color: "text-gray-600", bgColor: "bg-gray-100" },
  closed_other: { label: "Closed", color: "text-gray-600", bgColor: "bg-gray-100" },
  duplicate: { label: "Duplicate", color: "text-orange-700", bgColor: "bg-orange-100" },
  // New automated outreach statuses
  awaiting_response: { label: "Awaiting Response", color: "text-blue-700", bgColor: "bg-blue-100" },
  follow_up_due: { label: "Follow-up Due", color: "text-amber-700", bgColor: "bg-amber-100" },
  no_contact_ok_close: { label: "No Contact - OK to Close", color: "text-red-700", bgColor: "bg-red-100" },
  in_communication: { label: "In Communication", color: "text-green-700", bgColor: "bg-green-100" },
};

interface ClientPreviewModalProps {
  clientId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onActionComplete?: () => void;
}

export function ClientPreviewModal({ clientId, isOpen, onClose, onActionComplete }: ClientPreviewModalProps) {
  const { data: client, isLoading, error } = useClient(clientId || "");

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

  if (!isOpen || !clientId) return null;

  // Parse text evaluation result if available
  let textEvalResult: TextEvaluationResult | null = null;
  if (client?.textEvaluationResult) {
    try {
      textEvalResult = JSON.parse(client.textEvaluationResult);
    } catch {
      // Invalid JSON stored
    }
  }

  const statusConfig = client ? STATUS_CONFIG[client.status] || STATUS_CONFIG.new : STATUS_CONFIG.new;

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
          className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Inquiry Preview
              </h2>
              {client && (
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
                >
                  {statusConfig.label}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {client && (
                <Link
                  href={`/clients/${client.id}`}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Full Page
                </Link>
              )}
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(85vh-4rem)]">
            {isLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                <p className="mt-2 text-sm text-gray-500">Loading client details...</p>
              </div>
            ) : error || !client ? (
              <div className="p-8 text-center">
                <AlertCircle className="w-8 h-8 mx-auto text-red-500 mb-2" />
                <p className="text-red-600">Failed to load client details.</p>
              </div>
            ) : (
              <div className="p-6 space-y-6">
                {/* Client Header */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-lg font-medium">
                    {client.firstName[0]}
                    {client.lastName[0]}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {client.firstName} {client.lastName}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Added {formatDate(client.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Contact Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <a href={`mailto:${client.email}`} className="text-blue-600 hover:underline">
                        {client.email}
                      </a>
                    </div>
                    {client.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <a href={`tel:${client.phone}`} className="text-blue-600 hover:underline">
                          {client.phone}
                        </a>
                      </div>
                    )}
                    {client.age && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span>Age: {client.age}</span>
                      </div>
                    )}
                    {client.paymentType && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span>Payment: {client.paymentType}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Insurance */}
                {client.insuranceProvider && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Insurance</h4>
                    <div className="text-sm text-gray-600">
                      <div className="font-medium">{client.insuranceProvider}</div>
                      {client.insuranceMemberId && (
                        <div className="text-gray-500">Member ID: {client.insuranceMemberId}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Preferences */}
                {(client.requestedClinician || client.preferredTimes?.length) && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Preferences</h4>
                    <div className="space-y-2">
                      {client.requestedClinician && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <User className="w-4 h-4 text-gray-400" />
                          <span>Requested: {client.requestedClinician}</span>
                        </div>
                      )}
                      {client.preferredTimes && client.preferredTimes.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {client.preferredTimes.map((time) => (
                            <span
                              key={time}
                              className="px-2 py-1 bg-white text-gray-700 text-xs rounded border"
                            >
                              {time}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Presenting Concerns */}
                {client.presentingConcerns && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Presenting Concerns</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {client.presentingConcerns}
                    </p>
                  </div>
                )}

                {/* Additional Info */}
                {client.additionalInfo && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Additional Information</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {client.additionalInfo}
                    </p>
                  </div>
                )}

                {/* Evaluation Results */}
                {(client.status === "evaluation_complete" ||
                  client.status === "evaluation_flagged" ||
                  client.evaluationNotes ||
                  client.referralReason) && (
                  <div className={`rounded-lg p-4 ${
                    client.status === "evaluation_flagged"
                      ? "bg-red-50 border border-red-200"
                      : "bg-green-50 border border-green-200"
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-700">Evaluation Results</h4>
                      {client.status === "evaluation_flagged" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          <AlertCircle className="w-3 h-3" />
                          Flagged
                        </span>
                      ) : client.status === "evaluation_complete" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircle className="w-3 h-3" />
                          Clear
                        </span>
                      ) : null}
                    </div>

                    {client.status === "evaluation_complete" && !client.evaluationNotes && !client.referralReason && (
                      <div className="flex items-center gap-2 text-green-700 text-sm">
                        <CheckCircle className="w-4 h-4" />
                        <span>No concerns detected. Ready for outreach.</span>
                      </div>
                    )}

                    {client.referralReason && (
                      <div className="space-y-2">
                        {client.referralReason.split("; ").map((reason, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 p-2 bg-white rounded text-red-700 text-sm"
                          >
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{reason}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Text Evaluation Results */}
                {textEvalResult && textEvalResult.flags.length > 0 && (
                  <div className="rounded-lg p-4 bg-amber-50 border border-amber-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-700">Text Analysis Flags</h4>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${SEVERITY_CONFIG[textEvalResult.overallSeverity].bgColor} ${SEVERITY_CONFIG[textEvalResult.overallSeverity].color}`}>
                        {SEVERITY_CONFIG[textEvalResult.overallSeverity].label}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {textEvalResult.flags.slice(0, 3).map((flag, idx) => {
                        const severityConfig = SEVERITY_CONFIG[flag.severity];
                        const categoryLabel = CATEGORY_LABELS[flag.category] || flag.category;

                        return (
                          <div
                            key={idx}
                            className={`p-2 rounded border ${severityConfig.borderColor} ${severityConfig.bgColor}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-sm font-medium ${severityConfig.color}`}>
                                {categoryLabel}
                              </span>
                              <span className={`text-xs ${severityConfig.color}`}>
                                {severityConfig.label}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              &quot;{flag.matchedText}&quot;
                            </div>
                          </div>
                        );
                      })}
                      {textEvalResult.flags.length > 3 && (
                        <div className="text-xs text-gray-500 text-center">
                          +{textEvalResult.flags.length - 3} more flags
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {client && (
            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4">
              <div className="flex items-center justify-between">
                <ClientActionButtons
                  client={client}
                  variant="compact"
                  onActionComplete={() => {
                    onActionComplete?.();
                    onClose();
                  }}
                />
                <Link
                  href={`/clients/${client.id}`}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Full Details
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
