"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Client, Communication, OfferedSlot, ScheduledAppointment } from "@/types/client";
import { useClientCommunications } from "@/hooks/use-clients";
import { useSendEmail, EmailAttachment } from "@/hooks/use-emails";
import { ReplyComposer } from "@/components/outreach/reply-composer";
import {
  X,
  ExternalLink,
  RefreshCw,
  Mail,
  Phone,
  Calendar,
  CheckCircle,
} from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import Link from "next/link";

interface SchedulingCommunicationsModalProps {
  client: Client;
  isOpen: boolean;
  onClose: () => void;
}

export function SchedulingCommunicationsModal({
  client,
  isOpen,
  onClose,
}: SchedulingCommunicationsModalProps) {
  // Fetch communications for this client
  const {
    data: communications,
    isLoading,
    refetch,
    isFetching,
  } = useClientCommunications(client.id);

  // Send email mutation
  const sendEmail = useSendEmail();

  // Scroll ref for auto-scroll to bottom
  const threadEndRef = useRef<HTMLDivElement>(null);

  // State for availability (not used in scheduling modal but needed for ReplyComposer)
  const [selectedAvailability, setSelectedAvailability] = useState<string[]>([]);

  // Sort communications by timestamp (oldest first for chat view)
  const sortedCommunications = useMemo(() => {
    if (!communications) return [];
    return [...communications].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [communications]);

  // Get thread start date
  const threadStartDate = useMemo(() => {
    if (sortedCommunications.length === 0) return null;
    return new Date(sortedCommunications[0].timestamp);
  }, [sortedCommunications]);

  // Parse offered availability from client
  const offeredSlots = useMemo(() => {
    if (!client.offeredAvailability) return [];
    try {
      return JSON.parse(client.offeredAvailability) as OfferedSlot[];
    } catch {
      return [];
    }
  }, [client.offeredAvailability]);

  // Parse scheduled appointment from client
  const scheduledAppointment = useMemo(() => {
    if (!client.scheduledAppointment) return null;
    try {
      return JSON.parse(client.scheduledAppointment) as ScheduledAppointment;
    } catch {
      return null;
    }
  }, [client.scheduledAppointment]);

  // Group offered slots by date
  const slotsByDate = useMemo(() => {
    return offeredSlots.reduce((acc, slot) => {
      const date = new Date(slot.offeredAt).toLocaleDateString();
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(slot);
      return acc;
    }, {} as Record<string, OfferedSlot[]>);
  }, [offeredSlots]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [sortedCommunications.length]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
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

  // Handle sending email
  const handleSend = async (data: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    attachments?: EmailAttachment[];
  }) => {
    await sendEmail.mutateAsync({
      clientId: client.id,
      ...data,
      bodyFormat: "html",
    });

    // Refetch communications after sending
    refetch();
  };

  if (!isOpen) return null;

  // Get status badge info
  const getStatusBadge = () => {
    switch (client.status) {
      case "awaiting_scheduling":
        return { label: "Awaiting Scheduling", color: "bg-amber-100 text-amber-700" };
      case "ready_to_schedule":
        return { label: "Ready to Schedule", color: "bg-green-100 text-green-700" };
      default:
        return { label: client.status, color: "bg-gray-100 text-gray-700" };
    }
  };

  const statusBadge = getStatusBadge();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white w-[95vw] h-[90vh] max-w-7xl rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b bg-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-semibold text-lg">
                {client.firstName[0]}
                {client.lastName[0]}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {client.firstName} {client.lastName}
                </h2>
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    {client.email}
                  </span>
                  {client.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" />
                      {client.phone}
                    </span>
                  )}
                  <span className={cn("px-2 py-0.5 rounded text-xs font-medium", statusBadge.color)}>
                    {statusBadge.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/clients/${client.id}`}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-2 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              View Full Profile
            </Link>
          </div>
        </div>

        {/* Main Content - Two Column Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Message Thread */}
          <div className="flex-1 flex flex-col border-r min-w-0">
            {/* Thread Header */}
            <div className="px-6 py-3 border-b bg-gray-50 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-medium text-gray-900">Email Thread</h3>
                <p className="text-sm text-gray-500">
                  {sortedCommunications.length} message
                  {sortedCommunications.length !== 1 ? "s" : ""}
                  {threadStartDate && <> &bull; Started {formatDate(threadStartDate)}</>}
                </p>
              </div>
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="px-3 py-1.5 text-sm text-gray-600 bg-white border rounded-lg hover:bg-gray-50 flex items-center gap-1 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
                Refresh
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
                </div>
              ) : sortedCommunications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Mail className="w-8 h-8 text-gray-400" />
                  </div>
                  <h4 className="font-medium text-gray-900 mb-1">No emails yet</h4>
                  <p className="text-sm text-gray-500 max-w-sm">
                    Start the conversation by composing an email using the form on the right.
                  </p>
                </div>
              ) : (
                <>
                  {sortedCommunications.map((communication) => (
                    <MessageCard key={communication.id} communication={communication} />
                  ))}
                  <div ref={threadEndRef} />

                  {/* Waiting indicator if last message was outgoing */}
                  {sortedCommunications.length > 0 &&
                    sortedCommunications[sortedCommunications.length - 1].direction === "out" && (
                      <div className="flex items-center gap-3 py-3 px-4 bg-white rounded-lg border">
                        <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                        <span className="text-sm text-gray-600">Waiting for client response...</span>
                      </div>
                    )}
                </>
              )}
            </div>
          </div>

          {/* Right: Compose Panel */}
          <div className="w-[480px] flex flex-col bg-white flex-shrink-0">
            <div className="px-6 py-3 border-b bg-gray-50 flex-shrink-0">
              <h3 className="font-medium text-gray-900">Compose Reply</h3>
            </div>

            {/* Compose Form - Scrollable */}
            <div className="flex-1 overflow-y-auto">
              {/* Scheduled Appointment Info */}
              {scheduledAppointment && (
                <div className="px-6 py-4 border-b bg-green-50">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-green-600" />
                    <h4 className="font-medium text-green-900">Scheduled Appointment</h4>
                  </div>
                  <div className="space-y-1 text-sm text-green-800">
                    <p><span className="font-medium">Day:</span> {scheduledAppointment.day}</p>
                    <p><span className="font-medium">Time:</span> {scheduledAppointment.time}</p>
                    <p><span className="font-medium">Clinician:</span> {scheduledAppointment.clinician}</p>
                    {scheduledAppointment.recurrence && (
                      <p><span className="font-medium">Recurrence:</span> {scheduledAppointment.recurrence}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Previously Offered Availability */}
              {offeredSlots.length > 0 && (
                <div className="px-6 py-4 border-b bg-amber-50">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-amber-600" />
                    <h4 className="font-medium text-amber-900">Offered Availability</h4>
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      {offeredSlots.length} slot{offeredSlots.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(slotsByDate)
                      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                      .map(([date, slots]) => (
                        <div key={date}>
                          <p className="text-xs font-medium text-amber-700 mb-1">
                            Offered {date}
                          </p>
                          <ul className="space-y-1">
                            {slots.map((slot, idx) => (
                              <li
                                key={`${slot.slotId}-${idx}`}
                                className="text-sm text-amber-900 flex items-start gap-2 bg-white/50 rounded px-2 py-1"
                              >
                                <span className="text-amber-500 mt-0.5">•</span>
                                <span>
                                  {slot.day} at {slot.time}
                                  <span className="text-amber-700 ml-1">
                                    — {slot.clinicians.join(", ")}
                                  </span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <ReplyComposer
                client={client}
                communications={sortedCommunications}
                onSend={handleSend}
                onOpenAvailabilityModal={() => {}} // No availability modal in scheduling
                selectedAvailability={selectedAvailability}
                onClearAvailability={() => setSelectedAvailability([])}
                isSending={sendEmail.isPending}
                compact
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Message Card component for the full modal view
function MessageCard({ communication }: { communication: Communication }) {
  const isOutgoing = communication.direction === "out";
  const timestamp = new Date(communication.timestamp);

  // Determine the label based on direction and context
  const getMessageLabel = () => {
    if (isOutgoing) {
      const subject = communication.subject?.toLowerCase() || "";
      if (subject.includes("initial") || subject.includes("outreach")) {
        return "Initial Outreach";
      }
      if (subject.includes("follow-up") || subject.includes("follow up")) {
        return "Follow-up";
      }
      if (subject.startsWith("re:")) {
        return "Reply";
      }
      return "Sent";
    }
    return "Client Reply";
  };

  // Strip HTML tags safely
  const stripHtmlTags = (html: string): string => {
    let text = html
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    text = text.replace(/<[^>]*>/g, "");
    text = text.replace(/\s+/g, " ").trim();
    return text;
  };

  const getDisplayContent = () => {
    const content = communication.fullBody || communication.bodyPreview;
    if (!content) return "";
    if (content.includes("<") && content.includes(">")) {
      return stripHtmlTags(content);
    }
    return content;
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) + " @ " + date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div
      className={cn(
        "rounded-xl overflow-hidden border",
        isOutgoing
          ? "bg-gradient-to-br from-green-50 to-emerald-50 border-green-100"
          : "bg-white border-gray-200"
      )}
    >
      {/* Card Header */}
      <div
        className={cn(
          "px-4 py-3 border-b flex items-center justify-between",
          isOutgoing ? "border-green-100" : "border-gray-100"
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              isOutgoing ? "bg-green-600" : "bg-blue-500"
            )}
          >
            {isOutgoing ? (
              <CheckCircle className="w-4 h-4 text-white" />
            ) : (
              <Mail className="w-4 h-4 text-white" />
            )}
          </div>
          <div>
            <span
              className={cn(
                "font-medium",
                isOutgoing ? "text-green-900" : "text-gray-900"
              )}
            >
              {getMessageLabel()}
            </span>
            <span
              className={cn(
                "text-sm ml-2",
                isOutgoing ? "text-green-600" : "text-blue-600"
              )}
            >
              {isOutgoing ? "Sent" : "Received"}
            </span>
          </div>
        </div>
        <span className="text-sm text-gray-500">{formatDateTime(timestamp)}</span>
      </div>

      {/* Card Body */}
      <div className="p-4">
        {communication.subject && (
          <p className="font-medium text-gray-900 mb-2">{communication.subject}</p>
        )}
        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
          {getDisplayContent()}
        </div>
      </div>

      {/* Card Footer */}
      <div
        className={cn(
          "px-4 py-2 text-xs",
          isOutgoing ? "text-green-600" : "text-gray-500"
        )}
      >
        {isOutgoing
          ? `Sent by ${communication.sentBy || "staff"}`
          : `From ${communication.sentBy || "client"}`}
      </div>
    </div>
  );
}
