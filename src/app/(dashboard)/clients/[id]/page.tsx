"use client";

import { use, useState } from "react";
import { useClient, useClientCommunications, useUpdateClient } from "@/hooks/use-clients";
import { ClientStatus, EmailTemplate } from "@/types/client";
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
} from "lucide-react";

const STATUS_CONFIG: Record<
  ClientStatus,
  { label: string; color: string; bgColor: string }
> = {
  new: { label: "New", color: "text-blue-700", bgColor: "bg-blue-100" },
  pending_evaluation: { label: "Pending Evaluation", color: "text-yellow-700", bgColor: "bg-yellow-100" },
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
            {getActionButtons()}
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
          {(client.evaluationScore !== undefined || client.evaluationNotes) && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Evaluation
              </h2>
              {client.evaluationScore !== undefined && (
                <div className="mb-3">
                  <div className="text-sm text-gray-500 mb-1">Score</div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`text-2xl font-bold ${
                        client.evaluationScore >= 70
                          ? "text-green-600"
                          : client.evaluationScore >= 40
                            ? "text-yellow-600"
                            : "text-red-600"
                      }`}
                    >
                      {client.evaluationScore}
                    </div>
                    <div className="text-sm text-gray-500">/ 100</div>
                  </div>
                </div>
              )}
              {client.evaluationNotes && (
                <div>
                  <div className="text-sm text-gray-500 mb-1">Notes</div>
                  <p className="text-gray-700 text-sm">{client.evaluationNotes}</p>
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
    </div>
  );
}
