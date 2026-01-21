"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Client, Communication } from "@/types/client";
import { useClientCommunications } from "@/hooks/use-clients";
import { useSendEmail, EmailAttachment } from "@/hooks/use-emails";
import { MessageBubble } from "./message-bubble";
import { ReplyComposer } from "./reply-composer";
import { RefreshCw, Mail, Send } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface ClientCommunicationsProps {
  client: Client;
  onOpenAvailabilityModal: () => void;
  selectedAvailability: string[];
  onClearAvailability: () => void;
}

export function ClientCommunications({
  client,
  onOpenAvailabilityModal,
  selectedAvailability,
  onClearAvailability,
}: ClientCommunicationsProps) {
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
  };

  // Handle sending first email
  const handleSendFirstEmail = () => {
    onOpenAvailabilityModal();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
        </div>
      </div>
    );
  }

  // Empty state
  if (!communications || communications.length === 0) {
    return (
      <div className="flex flex-col h-full">
        {/* Thread Header - Empty */}
        <div className="px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Email Thread</h3>
              <p className="text-sm text-gray-500">No messages yet</p>
            </div>
          </div>
        </div>

        {/* Empty State Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Mail className="w-8 h-8 text-gray-400" />
          </div>
          <h4 className="font-medium text-gray-900 mb-1">No emails yet</h4>
          <p className="text-sm text-gray-500 mb-4 text-center">
            Start the conversation by sending an outreach email
          </p>
          <button
            onClick={handleSendFirstEmail}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Send First Email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Thread Header */}
      <div className="px-6 py-4 border-b bg-gray-50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Email Thread</h3>
            <p className="text-sm text-gray-500">
              {sortedCommunications.length} message
              {sortedCommunications.length !== 1 ? "s" : ""}
              {threadStartDate && (
                <> • Started {formatDate(threadStartDate)}</>
              )}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Message Thread - Scrollable, takes minimum 30% of space */}
      <div className="flex-1 min-h-[30%] overflow-y-auto px-6 py-4 space-y-6">
        {sortedCommunications.map((communication) => (
          <MessageBubble key={communication.id} communication={communication} />
        ))}
        <div ref={threadEndRef} />
      </div>

      {/* Reply Composer - Scrollable with max height */}
      <div className="flex-shrink-0 max-h-[60%] overflow-y-auto">
        <ReplyComposer
          client={client}
          communications={sortedCommunications}
          onSend={handleSend}
          onOpenAvailabilityModal={onOpenAvailabilityModal}
          selectedAvailability={selectedAvailability}
          onClearAvailability={onClearAvailability}
          isSending={sendEmail.isPending}
        />
      </div>
    </div>
  );
}
