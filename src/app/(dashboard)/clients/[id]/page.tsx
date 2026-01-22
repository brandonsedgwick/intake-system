"use client";

import { use, useState } from "react";
import { useClient, useClientCommunications, useUpdateClient, useClientReopenHistory } from "@/hooks/use-clients";
import { ClientStatus, EmailTemplate, TextEvaluationResult, TextEvaluationSeverity, TextEvaluationCategory, isClosedStatus, ClosedFromWorkflow } from "@/types/client";
import { ReopenCaseModal } from "@/components/clients/reopen-case-modal";
import { formatDateTime, formatDate } from "@/lib/utils";
import { EmailPreviewModal } from "@/components/emails/email-preview-modal";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  User,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  Edit,
  MoreHorizontal,
  MessageSquare,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  XCircle,
  Archive,
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
  awaiting_scheduling: { label: "Awaiting Scheduling", color: "text-amber-700", bgColor: "bg-amber-100" },
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
  awaiting_paperwork: { label: "Awaiting Paperwork", color: "text-purple-700", bgColor: "bg-purple-100" },
};

// Workflow labels for closed case display
const WORKFLOW_LABELS: Record<ClosedFromWorkflow, string> = {
  evaluation: "Evaluation",
  outreach: "Outreach",
  referral: "Referral",
  scheduling: "Scheduling",
  other: "Other",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ClientDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { data: client, isLoading: clientLoading, error: clientError } = useClient(id);
  const { data: communications, isLoading: commsLoading } = useClientCommunications(id);
  const updateClient = useUpdateClient();

  // Email modal state
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailTemplateType, setEmailTemplateType] = useState<EmailTemplate["type"]>("initial_outreach");

  // Reopen modal state
  const [reopenModalOpen, setReopenModalOpen] = useState(false);

  // Fetch reopen history for timeline
  const { data: reopenHistory } = useClientReopenHistory(id);

  const openEmailModal = (templateType: EmailTemplate["type"]) => {
    setEmailTemplateType(templateType);
    setEmailModalOpen(true);
  };

  if (clientLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (clientError || !client) {
    return (
      <div className="p-8">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>Client not found or failed to load.</span>
        </div>
        <Link
          href="/clients"
          className="mt-4 inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Clients
        </Link>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[client.status] || STATUS_CONFIG.new;

  // Parse text evaluation result if available
  let textEvalResult: TextEvaluationResult | null = null;
  if (client.textEvaluationResult) {
    try {
      textEvalResult = JSON.parse(client.textEvaluationResult);
    } catch {
      // Invalid JSON stored
    }
  }

  // Action buttons based on status
  const getActionButtons = () => {
    switch (client.status) {
      case "new":
      case "pending_evaluation":
        return (
          <button className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700">
            <FileText className="w-4 h-4" />
            Evaluate Client
          </button>
        );
      case "evaluation_complete":
        return (
          <button
            onClick={() => openEmailModal("initial_outreach")}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Mail className="w-4 h-4" />
            Generate Email
          </button>
        );
      case "evaluation_flagged":
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => openEmailModal("initial_outreach")}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Mail className="w-4 h-4" />
              Generate Email
            </button>
            <button
              onClick={() => openEmailModal("referral_clinical")}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
            >
              <AlertCircle className="w-4 h-4" />
              Refer Out
            </button>
          </div>
        );
      case "pending_outreach":
        return (
          <button
            onClick={() => openEmailModal("initial_outreach")}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Mail className="w-4 h-4" />
            Generate Email
          </button>
        );
      case "outreach_sent":
        return (
          <button
            onClick={() => openEmailModal("follow_up_1")}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            <Send className="w-4 h-4" />
            Send Follow-up 1
          </button>
        );
      case "follow_up_1":
        return (
          <button
            onClick={() => openEmailModal("follow_up_2")}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
          >
            <Send className="w-4 h-4" />
            Send Follow-up 2
          </button>
        );
      case "follow_up_2":
        return (
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
            <Clock className="w-4 h-4" />
            Close - No Contact
          </button>
        );
      case "replied":
      case "ready_to_schedule":
        return (
          <button className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
            <Calendar className="w-4 h-4" />
            Schedule Appointment
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/clients"
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Clients
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xl font-medium">
              {client.firstName[0]}
              {client.lastName[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {client.firstName} {client.lastName}
              </h1>
              <div className="flex items-center gap-4 mt-1">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
                >
                  {statusConfig.label}
                </span>
                <span className="text-gray-500 text-sm">
                  Added {formatDate(client.createdAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isClosedStatus(client.status) ? (
              <button
                onClick={() => setReopenModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <RotateCcw className="w-4 h-4" />
                Reopen Case
              </button>
            ) : (
              <>
                <ClientActionButtons
                  client={client}
                  variant="full"
                  showAllActions
                />
                <div className="h-6 w-px bg-gray-200" />
                {getActionButtons()}
              </>
            )}
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <Edit className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Client Info */}
        <div className="col-span-1 space-y-6">
          {/* Closure Details - Only show for closed clients */}
          {isClosedStatus(client.status) && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg shadow p-6">
              <div className="flex items-center gap-2 mb-4">
                <Archive className="w-5 h-5 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-700">
                  Case Closed
                </h2>
              </div>
              <div className="space-y-3">
                {client.closedDate && (
                  <div>
                    <div className="text-sm text-gray-500">Closed Date</div>
                    <div className="font-medium text-gray-700">
                      {formatDate(client.closedDate)}
                    </div>
                  </div>
                )}
                {client.closedFromWorkflow && (
                  <div>
                    <div className="text-sm text-gray-500">Closed From</div>
                    <div className="font-medium text-gray-700">
                      {WORKFLOW_LABELS[client.closedFromWorkflow]} Workflow
                    </div>
                  </div>
                )}
                {client.closedReason && (
                  <div>
                    <div className="text-sm text-gray-500">Reason</div>
                    <div className="font-medium text-gray-700">
                      {client.closedReason}
                    </div>
                  </div>
                )}
                {reopenHistory && reopenHistory.length > 0 && (
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex items-center gap-1 text-sm text-amber-600">
                      <AlertCircle className="w-4 h-4" />
                      <span>Previously reopened {reopenHistory.length} time{reopenHistory.length > 1 ? "s" : ""}</span>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setReopenModalOpen(true)}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reopen Case
              </button>
            </div>
          )}

          {/* Contact Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Contact Information
            </h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-gray-600">
                <Mail className="w-4 h-4 text-gray-400" />
                <a
                  href={`mailto:${client.email}`}
                  className="text-blue-600 hover:underline"
                >
                  {client.email}
                </a>
              </div>
              {client.phone && (
                <div className="flex items-center gap-3 text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <a
                    href={`tel:${client.phone}`}
                    className="text-blue-600 hover:underline"
                  >
                    {client.phone}
                  </a>
                </div>
              )}
              {client.age && (
                <div className="flex items-center gap-3 text-gray-600">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span>Age: {client.age}</span>
                </div>
              )}
            </div>
          </div>

          {/* Insurance */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Insurance
            </h2>
            {client.insuranceProvider ? (
              <div className="space-y-2">
                <div className="font-medium">{client.insuranceProvider}</div>
                {client.insuranceMemberId && (
                  <div className="text-sm text-gray-600">
                    Member ID: {client.insuranceMemberId}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No insurance on file</p>
            )}
          </div>

          {/* Preferences */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Preferences
            </h2>
            <div className="space-y-3">
              {client.preferredTimes && client.preferredTimes.length > 0 && (
                <div>
                  <div className="text-sm text-gray-500 mb-1">
                    Preferred Times
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {client.preferredTimes.map((time) => (
                      <span
                        key={time}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                      >
                        {time}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {client.requestedClinician && (
                <div>
                  <div className="text-sm text-gray-500 mb-1">
                    Requested Clinician
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    {client.requestedClinician}
                  </div>
                </div>
              )}
              {client.assignedClinician && (
                <div>
                  <div className="text-sm text-gray-500 mb-1">
                    Assigned Clinician
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    {client.assignedClinician}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Evaluation Results */}
          {(client.status === "evaluation_complete" ||
            client.status === "evaluation_flagged" ||
            client.evaluationNotes ||
            client.referralReason) && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Evaluation Results
                </h2>
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
                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg text-green-700">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm">No concerns detected. Ready for outreach.</span>
                </div>
              )}

              {client.referralReason && (
                <div className="mb-3">
                  <div className="text-sm font-medium text-gray-700 mb-2">Flags Detected:</div>
                  <div className="space-y-2">
                    {client.referralReason.split("; ").map((reason, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 p-2 bg-red-50 rounded-lg text-red-700"
                      >
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {client.evaluationNotes && (
                <div className="mt-3">
                  <div className="text-sm text-gray-500 mb-1">Additional Notes</div>
                  <p className="text-gray-700 text-sm whitespace-pre-wrap">{client.evaluationNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* Text Evaluation Results */}
          {textEvalResult && textEvalResult.flags.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Text Analysis Results
                </h2>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${SEVERITY_CONFIG[textEvalResult.overallSeverity].bgColor} ${SEVERITY_CONFIG[textEvalResult.overallSeverity].color}`}>
                    {SEVERITY_CONFIG[textEvalResult.overallSeverity].label}
                  </span>
                  <span className="text-xs text-gray-500 capitalize">
                    ({textEvalResult.method})
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {textEvalResult.flags.map((flag, idx) => {
                  const severityConfig = SEVERITY_CONFIG[flag.severity];
                  const categoryLabel = CATEGORY_LABELS[flag.category] || flag.category;

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${severityConfig.borderColor} ${severityConfig.bgColor}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`font-medium ${severityConfig.color}`}>
                          {categoryLabel}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${severityConfig.bgColor} ${severityConfig.color} border ${severityConfig.borderColor}`}>
                          {severityConfig.label}
                        </span>
                      </div>

                      <div className="text-sm text-gray-700 mb-1">
                        <span className="text-gray-500">Matched: </span>
                        <span className="font-medium">"{flag.matchedText}"</span>
                      </div>

                      {flag.context && flag.context !== flag.matchedText && (
                        <div className="text-sm text-gray-600 italic mt-1">
                          Context: "{flag.context}"
                        </div>
                      )}

                      {flag.reasoning && (
                        <div className="text-sm text-gray-600 mt-2 pt-2 border-t border-gray-200">
                          <span className="text-gray-500">AI Reasoning: </span>
                          {flag.reasoning}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {textEvalResult.llmUsed && (
                <div className="mt-4 pt-3 border-t text-xs text-gray-500 flex items-center justify-between">
                  <span>
                    Analyzed with {textEvalResult.llmModel || "LLM"}
                    {textEvalResult.llmTokensUsed && ` (${textEvalResult.llmTokensUsed} tokens)`}
                  </span>
                  <span>{new Date(textEvalResult.evaluatedAt).toLocaleString()}</span>
                </div>
              )}
            </div>
          )}

          {/* Presenting Concerns */}
          {client.presentingConcerns && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Presenting Concerns
              </h2>
              <p className="text-gray-700 text-sm whitespace-pre-wrap">
                {client.presentingConcerns}
              </p>
            </div>
          )}
        </div>

        {/* Right Column - Communication Chain */}
        <div className="col-span-2">
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Communication History
              </h2>
              <button className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg">
                <MessageSquare className="w-4 h-4" />
                Add Note
              </button>
            </div>

            {commsLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : !communications || communications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No communications yet.</p>
                <p className="text-sm mt-1">
                  Send the initial outreach email to get started.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {communications.map((comm, index) => (
                  <div key={comm.id} className="p-6">
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          comm.direction === "out"
                            ? "bg-blue-100 text-blue-600"
                            : "bg-green-100 text-green-600"
                        }`}
                      >
                        {comm.direction === "out" ? (
                          <ArrowUpRight className="w-5 h-5" />
                        ) : (
                          <ArrowDownLeft className="w-5 h-5" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-medium text-gray-900">
                            {comm.direction === "out"
                              ? "Sent Email"
                              : "Received Reply"}
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatDateTime(comm.timestamp)}
                          </div>
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          {comm.subject}
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700">
                          {comm.bodyPreview || comm.fullBody?.substring(0, 300)}
                          {comm.fullBody && comm.fullBody.length > 300 && (
                            <button className="text-blue-600 hover:underline ml-1">
                              Read more
                            </button>
                          )}
                        </div>
                        {comm.sentBy && (
                          <div className="mt-2 text-xs text-gray-500">
                            Sent by {comm.sentBy}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-lg shadow mt-6 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Timeline
            </h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                <div className="text-sm">
                  <span className="font-medium">Created</span>
                  <span className="text-gray-500 ml-2">
                    {formatDateTime(client.createdAt)}
                  </span>
                </div>
              </div>
              {client.initialOutreachDate && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-purple-600"></div>
                  <div className="text-sm">
                    <span className="font-medium">Initial Outreach</span>
                    <span className="text-gray-500 ml-2">
                      {formatDateTime(client.initialOutreachDate)}
                    </span>
                  </div>
                </div>
              )}
              {client.followUp1Date && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-orange-600"></div>
                  <div className="text-sm">
                    <span className="font-medium">Follow-up 1</span>
                    <span className="text-gray-500 ml-2">
                      {formatDateTime(client.followUp1Date)}
                    </span>
                  </div>
                </div>
              )}
              {client.followUp2Date && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-600"></div>
                  <div className="text-sm">
                    <span className="font-medium">Follow-up 2</span>
                    <span className="text-gray-500 ml-2">
                      {formatDateTime(client.followUp2Date)}
                    </span>
                  </div>
                </div>
              )}
              {client.scheduledDate && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-600"></div>
                  <div className="text-sm">
                    <span className="font-medium">Scheduled</span>
                    <span className="text-gray-500 ml-2">
                      {formatDateTime(client.scheduledDate)}
                    </span>
                  </div>
                </div>
              )}
              {client.closedDate && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-gray-600"></div>
                  <div className="text-sm">
                    <span className="font-medium">Closed</span>
                    <span className="text-gray-500 ml-2">
                      {formatDateTime(client.closedDate)}
                    </span>
                    {client.closedReason && (
                      <span className="text-gray-400 ml-2">
                        ({client.closedReason})
                      </span>
                    )}
                  </div>
                </div>
              )}
              {/* Reopen History */}
              {reopenHistory && reopenHistory.length > 0 && (
                <>
                  <div className="my-4 border-t border-gray-200 pt-4">
                    <h3 className="text-sm font-medium text-gray-500 mb-3">Reopen History</h3>
                  </div>
                  {reopenHistory.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 pb-3">
                      <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5"></div>
                      <div className="text-sm flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Case Reopened</span>
                          <span className="text-gray-500">
                            {formatDateTime(entry.reopenedAt)}
                          </span>
                        </div>
                        <div className="text-gray-600 mt-1">
                          <span className="text-gray-400">From:</span> {STATUS_CONFIG[entry.previousStatus]?.label || entry.previousStatus}
                          <span className="mx-2">→</span>
                          <span className="text-gray-400">To:</span> {STATUS_CONFIG[entry.newStatus]?.label || entry.newStatus}
                        </div>
                        <div className="text-gray-500 mt-1 italic">
                          "{entry.reopenReason}"
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          By {entry.reopenedBy}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Email Preview Modal */}
      <EmailPreviewModal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        clientId={client.id}
        clientName={`${client.firstName} ${client.lastName}`}
        templateType={emailTemplateType}
      />

      {/* Reopen Case Modal */}
      {reopenModalOpen && (
        <ReopenCaseModal
          client={client}
          isOpen={reopenModalOpen}
          onClose={() => setReopenModalOpen(false)}
        />
      )}
    </div>
  );
}
