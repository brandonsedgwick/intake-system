"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Client, Communication, OfferedSlot, ScheduledAppointment } from "@/types/client";
import { useClientCommunications } from "@/hooks/use-clients";
import { useSendEmail, EmailAttachment } from "@/hooks/use-emails";
import { ReplyComposer } from "@/components/outreach/reply-composer";
import {
  RefreshCw,
  Mail,
  CheckCircle,
  Calendar,
  Maximize2,
} from "lucide-react";
import { formatDate, cn } from "@/lib/utils";

interface SchedulingCommunicationsTabProps {
  client: Client;
  onOpenModal?: () => void;
}

export function SchedulingCommunicationsTab({
  client,
  onOpenModal,
}: SchedulingCommunicationsTabProps) {
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

  // State for availability (not used in scheduling but needed for ReplyComposer)
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

  return (
    <div className="bg-white rounded-xl border shadow-sm h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
        <div>
          <h3 className="font-semibold text-gray-900">Communications</h3>
          <p className="text-sm text-gray-500">
            {sortedCommunications.length} message
            {sortedCommunications.length !== 1 ? "s" : ""}
            {threadStartDate && <> &bull; Started {formatDate(threadStartDate)}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-3 py-1.5 text-sm text-gray-600 bg-white border rounded-lg hover:bg-gray-50 flex items-center gap-1 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
            Refresh
          </button>
          {onOpenModal && (
            <button
              onClick={onOpenModal}
              className="px-3 py-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 flex items-center gap-1 transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
              Full View
            </button>
          )}
        </div>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Message Thread */}
        <div className="flex-1 flex flex-col border-r min-w-0">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
              </div>
            ) : sortedCommunications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                  <Mail className="w-6 h-6 text-gray-400" />
                </div>
                <h4 className="font-medium text-gray-900 mb-1 text-sm">No emails yet</h4>
                <p className="text-xs text-gray-500 max-w-xs">
                  Start the conversation by composing an email using the form.
                </p>
              </div>
            ) : (
              <>
                {sortedCommunications.map((communication) => (
                  <MessageCard key={communication.id} communication={communication} compact />
                ))}
                <div ref={threadEndRef} />

                {/* Waiting indicator if last message was outgoing */}
                {sortedCommunications.length > 0 &&
                  sortedCommunications[sortedCommunications.length - 1].direction === "out" && (
                    <div className="flex items-center gap-2 py-2 px-3 bg-white rounded-lg border text-xs">
                      <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse" />
                      <span className="text-gray-600">Waiting for client response...</span>
                    </div>
                  )}
              </>
            )}
          </div>
        </div>

        {/* Right: Compose Panel */}
        <div className="w-[380px] flex flex-col bg-white flex-shrink-0">
          <div className="px-4 py-2 border-b bg-gray-50 flex-shrink-0">
            <h4 className="font-medium text-gray-900 text-sm">Compose Reply</h4>
          </div>

          {/* Compose Form - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            {/* Scheduled Appointment Info */}
            {scheduledAppointment && (
              <div className="px-4 py-3 border-b bg-green-50">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-3.5 h-3.5 text-green-600" />
                  <h5 className="font-medium text-green-900 text-xs">Scheduled Appointment</h5>
                </div>
                <div className="space-y-0.5 text-xs text-green-800">
                  <p>{scheduledAppointment.day} at {scheduledAppointment.time}</p>
                  <p>with {scheduledAppointment.clinician}</p>
                </div>
              </div>
            )}

            {/* Previously Offered Availability */}
            {offeredSlots.length > 0 && (
              <div className="px-4 py-3 border-b bg-amber-50">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                  <h5 className="font-medium text-amber-900 text-xs">Offered Availability</h5>
                  <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                    {offeredSlots.length}
                  </span>
                </div>
                <div className="space-y-1">
                  {Object.entries(slotsByDate)
                    .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                    .slice(0, 1)
                    .map(([date, slots]) => (
                      <ul key={date} className="space-y-0.5">
                        {slots.slice(0, 3).map((slot, idx) => (
                          <li
                            key={`${slot.slotId}-${idx}`}
                            className="text-xs text-amber-900 flex items-start gap-1"
                          >
                            <span className="text-amber-500">•</span>
                            <span>{slot.day} at {slot.time}</span>
                          </li>
                        ))}
                        {slots.length > 3 && (
                          <li className="text-xs text-amber-700 italic">
                            +{slots.length - 3} more...
                          </li>
                        )}
                      </ul>
                    ))}
                </div>
              </div>
            )}

            <ReplyComposer
              client={client}
              communications={sortedCommunications}
              onSend={handleSend}
              onOpenAvailabilityModal={() => {}}
              selectedAvailability={selectedAvailability}
              onClearAvailability={() => setSelectedAvailability([])}
              isSending={sendEmail.isPending}
              compact
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Compact Message Card component for the tab view
function MessageCard({ communication, compact = false }: { communication: Communication; compact?: boolean }) {
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
    const stripped = content.includes("<") && content.includes(">")
      ? stripHtmlTags(content)
      : content;
    // Truncate for compact view
    if (compact && stripped.length > 150) {
      return stripped.substring(0, 150) + "...";
    }
    return stripped;
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }) + " @ " + date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div
      className={cn(
        "rounded-lg overflow-hidden border",
        isOutgoing
          ? "bg-gradient-to-br from-green-50 to-emerald-50 border-green-100"
          : "bg-white border-gray-200"
      )}
    >
      {/* Card Header */}
      <div
        className={cn(
          "px-3 py-2 border-b flex items-center justify-between",
          isOutgoing ? "border-green-100" : "border-gray-100"
        )}
      >
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center",
              isOutgoing ? "bg-green-600" : "bg-blue-500"
            )}
          >
            {isOutgoing ? (
              <CheckCircle className="w-3 h-3 text-white" />
            ) : (
              <Mail className="w-3 h-3 text-white" />
            )}
          </div>
          <span
            className={cn(
              "font-medium text-xs",
              isOutgoing ? "text-green-900" : "text-gray-900"
            )}
          >
            {getMessageLabel()}
          </span>
        </div>
        <span className="text-xs text-gray-500">{formatDateTime(timestamp)}</span>
      </div>

      {/* Card Body */}
      <div className="p-3">
        {communication.subject && (
          <p className="font-medium text-gray-900 text-xs mb-1">{communication.subject}</p>
        )}
        <div className="text-xs text-gray-700 leading-relaxed">
          {getDisplayContent()}
        </div>
      </div>
    </div>
  );
}
