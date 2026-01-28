"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Client, Communication, OfferedSlot } from "@/types/client";
import { useClientCommunications } from "@/hooks/use-clients";
import { useSendEmail, EmailAttachment } from "@/hooks/use-emails";
import { MessageBubble } from "./message-bubble";
import { ReplyComposer } from "./reply-composer";
import {
  X,
  ExternalLink,
  RefreshCw,
  Mail,
  Phone,
  Send,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { formatDate, cn, formatDateForDisplay } from "@/lib/utils";
import Link from "next/link";

interface CommunicationsModalProps {
  client: Client;
  isOpen: boolean;
  onClose: () => void;
  onOpenAvailabilityModal: () => void;
  selectedAvailability: string[];
  onClearAvailability: () => void;
  onMoveToScheduling?: () => void;
  onEmailSentWithSlots?: () => Promise<void>; // Callback to save offered slots after email is sent
  outreachStats?: {
    attemptsSent: number;
    totalAttempts: number;
    nextFollowUpDue?: string;
  };
}

export function CommunicationsModal({
  client,
  isOpen,
  onClose,
  onOpenAvailabilityModal,
  selectedAvailability,
  onClearAvailability,
  onMoveToScheduling,
  onEmailSentWithSlots,
  outreachStats,
}: CommunicationsModalProps) {
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

  // Count messages by direction
  const messageStats = useMemo(() => {
    const sent = sortedCommunications.filter((c) => c.direction === "out").length;
    const received = sortedCommunications.filter((c) => c.direction === "in").length;
    return { sent, received };
  }, [sortedCommunications]);

  // Parse offered availability from client (only active offers)
  const offeredSlots = useMemo(() => {
    if (!client.offeredAvailability) return [];
    try {
      const allSlots = JSON.parse(client.offeredAvailability) as OfferedSlot[];
      // Filter to only active offers (isActive is true or undefined for backwards compatibility)
      return allSlots.filter((slot) => slot.isActive !== false);
    } catch {
      return [];
    }
  }, [client.offeredAvailability]);

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

  // State for text insertion into reply
  const [insertText, setInsertText] = useState<string>("");
  const [availabilityInserted, setAvailabilityInserted] = useState(false);

  // Format selected availability as text for insertion
  const formatAvailabilityText = () => {
    if (selectedAvailability.length === 0) return "";
    return `\n\nAdditional available appointment times:\n${selectedAvailability.map((slot) => `• ${slot}`).join("\n")}\n`;
  };

  // Handle "Insert into Reply" button click
  const handleInsertAvailability = () => {
    const text = formatAvailabilityText();
    setInsertText(text);
    setAvailabilityInserted(true);
  };

  // Reset insertion state when availability changes
  useEffect(() => {
    setAvailabilityInserted(false);
  }, [selectedAvailability]);

  // Track previous status to detect changes
  const prevStatusRef = useRef(client.status);

  // Auto-refetch communications when client status changes to in_communication
  // This handles the case where "Check Now" detects a reply while modal is open
  useEffect(() => {
    if (prevStatusRef.current !== client.status) {
      // Status changed - refetch communications to get new messages
      if (client.status === "in_communication") {
        refetch();
      }
      prevStatusRef.current = client.status;
    }
  }, [client.status, refetch]);

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
    console.log("CommunicationsModal handleSend called");
    console.log("CommunicationsModal - selectedAvailability:", selectedAvailability);
    console.log("CommunicationsModal - onEmailSentWithSlots exists:", !!onEmailSentWithSlots);

    await sendEmail.mutateAsync({
      clientId: client.id,
      ...data,
      bodyFormat: "html",
    });

    // If availability slots were included, save them to the client
    if (selectedAvailability.length > 0 && onEmailSentWithSlots) {
      console.log("Calling onEmailSentWithSlots callback");
      await onEmailSentWithSlots();
    } else {
      console.log("NOT calling onEmailSentWithSlots - selectedAvailability.length:", selectedAvailability.length);
    }

    // Refetch communications after sending
    refetch();
  };

  if (!isOpen) return null;

  // Get status badge info
  const getStatusBadge = () => {
    switch (client.status) {
      case "awaiting_response":
        return { label: "Awaiting Response", color: "bg-blue-100 text-blue-700" };
      case "in_communication":
        return { label: "In Communication", color: "bg-green-100 text-green-700" };
      case "follow_up_due":
        return { label: "Follow-up Due", color: "bg-amber-100 text-amber-700" };
      case "no_contact_ok_close":
        return { label: "No Contact - OK to Close", color: "bg-red-100 text-red-700" };
      case "pending_outreach":
        return { label: "Pending Outreach", color: "bg-purple-100 text-purple-700" };
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
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-semibold text-lg">
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
            {onMoveToScheduling && (
              <button
                onClick={onMoveToScheduling}
                className="px-4 py-2 text-green-700 bg-green-100 hover:bg-green-200 rounded-lg flex items-center gap-2 transition-colors font-medium"
              >
                <Calendar className="w-4 h-4" />
                Move to Scheduling
              </button>
            )}
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
                                  {slot.startDate && (
                                    <span className="text-amber-600 ml-1 font-medium">
                                      (starting {formatDateForDisplay(slot.startDate)})
                                    </span>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Additional Availability Offered - shows newly selected slots */}
              {selectedAvailability.length > 0 && (
                <div className="px-6 py-4 border-b bg-green-50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-green-600" />
                      <h4 className="font-medium text-green-900">Additional Availability Offered</h4>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        {selectedAvailability.length} new slot{selectedAvailability.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={onClearAvailability}
                        className="text-xs text-green-600 hover:text-green-800"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <ul className="space-y-1 mb-3">
                    {selectedAvailability.map((slot, idx) => (
                      <li
                        key={idx}
                        className="text-sm text-green-900 flex items-start gap-2 bg-white/50 rounded px-2 py-1"
                      >
                        <span className="text-green-500 mt-0.5">•</span>
                        <span>{slot}</span>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={handleInsertAvailability}
                    disabled={availabilityInserted}
                    className={cn(
                      "w-full px-3 py-2 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors",
                      availabilityInserted
                        ? "bg-green-200 text-green-700 cursor-default"
                        : "bg-green-600 text-white hover:bg-green-700"
                    )}
                  >
                    {availabilityInserted ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Inserted into Reply
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Insert into Reply
                      </>
                    )}
                  </button>
                </div>
              )}

              <ReplyComposer
                client={client}
                communications={sortedCommunications}
                onSend={handleSend}
                onOpenAvailabilityModal={onOpenAvailabilityModal}
                selectedAvailability={selectedAvailability}
                onClearAvailability={onClearAvailability}
                isSending={sendEmail.isPending}
                compact
                hideAvailabilityPreview={true}
                insertText={insertText}
                onInsertTextHandled={() => setInsertText("")}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Message Card component for the full modal view (more detailed than MessageBubble)
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
          ? "bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-100"
          : "bg-white border-gray-200"
      )}
    >
      {/* Card Header */}
      <div
        className={cn(
          "px-4 py-3 border-b flex items-center justify-between",
          isOutgoing ? "border-purple-100" : "border-gray-100"
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              isOutgoing ? "bg-purple-600" : "bg-green-500"
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
                isOutgoing ? "text-purple-900" : "text-gray-900"
              )}
            >
              {getMessageLabel()}
            </span>
            <span
              className={cn(
                "text-sm ml-2",
                isOutgoing ? "text-purple-600" : "text-green-600"
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
          isOutgoing ? "text-purple-600" : "text-gray-500"
        )}
      >
        {isOutgoing
          ? `Sent by ${communication.sentBy || "staff"}`
          : `From ${communication.sentBy || "client"}`}
      </div>
    </div>
  );
}
