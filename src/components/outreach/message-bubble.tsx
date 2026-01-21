"use client";

import { cn, formatDateTime } from "@/lib/utils";
import { Communication } from "@/types/client";

interface MessageBubbleProps {
  communication: Communication;
}

export function MessageBubble({ communication }: MessageBubbleProps) {
  const isOutgoing = communication.direction === "out";
  const timestamp = new Date(communication.timestamp);

  // Determine the label based on direction and context
  const getMessageLabel = () => {
    if (isOutgoing) {
      // Check if subject contains common outreach patterns
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

  // Get label styling
  const getLabelStyle = () => {
    if (isOutgoing) {
      const label = getMessageLabel();
      if (label === "Initial Outreach") {
        return "bg-purple-100 text-purple-700";
      }
      if (label === "Follow-up") {
        return "bg-amber-100 text-amber-700";
      }
      return "bg-blue-100 text-blue-700";
    }
    return "bg-green-100 text-green-700";
  };

  // Strip HTML tags safely using regex (for display only)
  const stripHtmlTags = (html: string): string => {
    // Replace common HTML entities
    let text = html
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Remove HTML tags
    text = text.replace(/<[^>]*>/g, "");

    // Clean up extra whitespace
    text = text.replace(/\s+/g, " ").trim();

    return text;
  };

  // Get display content - use fullBody if available, otherwise bodyPreview
  const getDisplayContent = () => {
    const content = communication.fullBody || communication.bodyPreview;
    if (!content) return "";

    // Check if content appears to be HTML and strip tags
    if (content.includes("<") && content.includes(">")) {
      return stripHtmlTags(content);
    }
    return content;
  };

  return (
    <div className={cn("flex", isOutgoing ? "justify-end" : "justify-start")}>
      <div className="max-w-[75%]">
        {/* Timestamp and Label */}
        <div
          className={cn(
            "flex items-center gap-2 mb-1",
            isOutgoing ? "justify-end" : "justify-start"
          )}
        >
          {!isOutgoing && (
            <span className={cn("text-xs px-2 py-0.5 rounded", getLabelStyle())}>
              {getMessageLabel()}
            </span>
          )}
          <span className="text-xs text-gray-500">
            {formatDateTime(timestamp)}
          </span>
          {isOutgoing && (
            <span className={cn("text-xs px-2 py-0.5 rounded", getLabelStyle())}>
              {getMessageLabel()}
            </span>
          )}
        </div>

        {/* Message Bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            isOutgoing
              ? "bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-tr-md"
              : "bg-gray-100 text-gray-800 border rounded-tl-md"
          )}
        >
          {/* Subject */}
          {communication.subject && (
            <p
              className={cn(
                "font-medium mb-2",
                isOutgoing ? "text-white" : "text-gray-900"
              )}
            >
              {communication.subject}
            </p>
          )}

          {/* Body - displayed as plain text for security */}
          <div
            className={cn(
              "text-sm whitespace-pre-wrap break-words",
              isOutgoing ? "text-white/90" : "text-gray-700"
            )}
          >
            {getDisplayContent()}
          </div>
        </div>

        {/* Sender info */}
        <div className={cn("mt-1", isOutgoing ? "text-right" : "text-left")}>
          <span className="text-xs text-gray-400">
            {isOutgoing
              ? `Sent by ${communication.sentBy || "staff"}`
              : `From ${communication.sentBy || "client"}`}
          </span>
        </div>
      </div>
    </div>
  );
}
