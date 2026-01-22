"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Client, Communication, OfferedSlot, ScheduledAppointment, EmailTemplate } from "@/types/client";
import { useClientCommunications } from "@/hooks/use-clients";
import { useSendEmail, useEmailTemplates, EmailAttachment } from "@/hooks/use-emails";
import { useTemplateSections } from "@/hooks/use-template-sections";
import { RichTextEditor } from "@/components/templates/rich-text-editor";
import {
  X,
  ExternalLink,
  RefreshCw,
  Mail,
  Phone,
  CheckCircle,
  Calendar,
  Send,
  Eye,
  EyeOff,
  FileEdit,
  ChevronDown,
  Search,
  Plus,
  Paperclip,
  AlertCircle,
} from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import Link from "next/link";

interface FinalizeModalProps {
  client: Client;
  isOpen: boolean;
  onClose: () => void;
  onFinalize: () => Promise<void>;
  isLoading?: boolean;
}

export function FinalizeModal({
  client,
  isOpen,
  onClose,
  onFinalize,
  isLoading = false,
}: FinalizeModalProps) {
  // Fetch communications for this client
  const {
    data: communications,
    isLoading: commsLoading,
    refetch,
    isFetching,
  } = useClientCommunications(client.id);

  // Send email mutation
  const sendEmail = useSendEmail();

  // Templates - only from "Simple Practice Templates" section
  const { data: templates } = useEmailTemplates();
  const { data: templateSections } = useTemplateSections();

  // Scroll ref for auto-scroll to bottom
  const threadEndRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);

  // UI state
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

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

  // Parse scheduled appointment from client
  const scheduledAppointment = useMemo(() => {
    if (!client.scheduledAppointment) return null;
    try {
      return JSON.parse(client.scheduledAppointment) as ScheduledAppointment;
    } catch {
      return null;
    }
  }, [client.scheduledAppointment]);

  // Find the "Simple Practice Templates" section ID
  const simplePracticeSectionId = useMemo(() => {
    if (!templateSections) return null;
    const section = templateSections.find(
      (s) => s.name.toLowerCase().includes("simple practice")
    );
    return section?.id || null;
  }, [templateSections]);

  // Filter templates to only show those from "Simple Practice Templates" section
  const simplePracticeTemplates = useMemo(() => {
    if (!templates || !simplePracticeSectionId) return [];
    return templates.filter((t) => t.sectionId === simplePracticeSectionId);
  }, [templates, simplePracticeSectionId]);

  // Apply search filter to Simple Practice templates
  const filteredTemplates = simplePracticeTemplates.filter(
    (t) =>
      t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
      t.type.toLowerCase().includes(templateSearch.toLowerCase())
  );

  // Get the last subject from communications for "Re:" prefix
  const getDefaultSubject = () => {
    const lastOutgoing = [...(communications || [])]
      .reverse()
      .find((c) => c.direction === "out");
    if (lastOutgoing?.subject) {
      if (lastOutgoing.subject.toLowerCase().startsWith("re:")) {
        return lastOutgoing.subject;
      }
      return `Re: ${lastOutgoing.subject}`;
    }
    return "Appointment Confirmation";
  };

  // Initialize subject if empty
  useEffect(() => {
    if (!subject && communications && communications.length > 0) {
      setSubject(getDefaultSubject());
    }
  }, [communications]);

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

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setTemplateDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle template selection - only insert the body text, don't change subject
  const handleSelectTemplate = (template: EmailTemplate) => {
    setTemplateDropdownOpen(false);
    // Only insert the template body, leave subject unchanged
    setBody(template.body);
  };

  // Handle file attachment
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Max size is 10MB.`);
        continue;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        setAttachments((prev) => [
          ...prev,
          {
            filename: file.name,
            mimeType: file.type,
            content: base64,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle removing attachment
  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle send and finalize
  const handleSendAndFinalize = async () => {
    if (!subject.trim() || !body.trim()) {
      setSendError("Please enter a subject and message.");
      return;
    }

    setIsSending(true);
    setSendError(null);

    try {
      // Send the email
      await sendEmail.mutateAsync({
        clientId: client.id,
        to: client.email,
        cc: cc || undefined,
        bcc: bcc || undefined,
        subject,
        body,
        bodyFormat: "html",
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      // Call the finalize handler (updates status to awaiting_paperwork)
      await onFinalize();

      // Close the modal
      onClose();
    } catch (error) {
      setSendError("Failed to send email. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  // Strip HTML for preview
  const getPreviewBody = () => {
    return body
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"');
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
                  Finalize Scheduling - {client.firstName} {client.lastName}
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

        {/* Scheduled Appointment Banner */}
        {scheduledAppointment && (
          <div className="px-6 py-3 bg-green-50 border-b border-green-100 flex items-center gap-4">
            <Calendar className="w-5 h-5 text-green-600" />
            <div className="text-sm">
              <span className="font-medium text-green-900">Scheduled Appointment: </span>
              <span className="text-green-800">
                {scheduledAppointment.day} at {scheduledAppointment.time} with {scheduledAppointment.clinician}
                {scheduledAppointment.recurrence && scheduledAppointment.recurrence !== "one-time" && (
                  <> ({scheduledAppointment.recurrence})</>
                )}
              </span>
            </div>
          </div>
        )}

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
              {commsLoading ? (
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
                    Compose an email using the form on the right.
                  </p>
                </div>
              ) : (
                <>
                  {sortedCommunications.map((communication) => (
                    <MessageCard key={communication.id} communication={communication} />
                  ))}
                  <div ref={threadEndRef} />
                </>
              )}
            </div>
          </div>

          {/* Right: Compose Panel */}
          <div className="w-[480px] flex flex-col bg-white flex-shrink-0">
            <div className="px-6 py-3 border-b bg-gray-50 flex-shrink-0">
              <h3 className="font-medium text-gray-900">Send Confirmation Email</h3>
              <p className="text-xs text-gray-500 mt-1">
                This email will be sent to the client and their status will be updated to "Awaiting Paperwork"
              </p>
            </div>

            {/* Compose Form - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Template Selection */}
              <div className="mb-4">
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setTemplateDropdownOpen(!templateDropdownOpen)}
                    className="px-4 py-2 text-sm font-medium bg-white border text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <FileEdit className="w-4 h-4" />
                    Use Template
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {templateDropdownOpen && (
                    <div className="absolute left-0 mt-1 w-72 bg-white border rounded-lg shadow-lg z-20 max-h-96 overflow-hidden">
                      {/* Search */}
                      <div className="p-2 border-b">
                        <div className="relative">
                          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Search templates..."
                            value={templateSearch}
                            onChange={(e) => setTemplateSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                      </div>

                      <div className="overflow-y-auto max-h-72 p-2">
                        {filteredTemplates?.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => handleSelectTemplate(t)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 hover:text-green-700 rounded-lg"
                          >
                            {t.name}
                          </button>
                        ))}

                        {filteredTemplates?.length === 0 && (
                          <p className="text-sm text-gray-500 px-3 py-2">
                            No templates found
                          </p>
                        )}

                        <div className="border-t my-2" />
                        <a
                          href="/settings?tab=templates"
                          className="w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded-lg flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Manage Templates
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Email Fields */}
              <div className="space-y-3">
                {/* To Field */}
                <div className="flex items-center gap-3">
                  <label className="w-16 text-sm font-medium text-gray-600">To:</label>
                  <input
                    type="email"
                    value={client.email}
                    readOnly
                    className="flex-1 px-3 py-2 text-sm bg-gray-100 border rounded-lg text-gray-700"
                  />
                </div>

                {/* Subject Field */}
                <div className="flex items-center gap-3">
                  <label className="w-16 text-sm font-medium text-gray-600">Subject:</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter subject..."
                    className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                {/* CC/BCC Toggle */}
                <div className="flex items-center gap-3">
                  <span className="w-16" />
                  {!showCcBcc ? (
                    <button
                      onClick={() => setShowCcBcc(true)}
                      className="text-xs text-green-600 hover:text-green-800"
                    >
                      + Add CC/BCC
                    </button>
                  ) : (
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <label className="w-8 text-sm text-gray-600">CC:</label>
                        <input
                          type="text"
                          value={cc}
                          onChange={(e) => setCc(e.target.value)}
                          placeholder="Email addresses separated by commas"
                          className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="w-8 text-sm text-gray-600">BCC:</label>
                        <input
                          type="text"
                          value={bcc}
                          onChange={(e) => setBcc(e.target.value)}
                          placeholder="Email addresses separated by commas"
                          className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Message Body */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Message:
                  </label>
                  {showPreview ? (
                    <div className="border rounded-lg p-4 bg-gray-50 min-h-[200px]">
                      <div className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">
                        {getPreviewBody()}
                      </div>
                    </div>
                  ) : (
                    <RichTextEditor
                      content={body}
                      onChange={setBody}
                      placeholder="Type your message here..."
                    />
                  )}
                </div>

                {/* Attachments */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Attachments:
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {attachments.map((attachment, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg text-sm"
                      >
                        <Paperclip className="w-3 h-3 text-gray-500" />
                        <span className="text-gray-700">{attachment.filename}</span>
                        <button
                          onClick={() => handleRemoveAttachment(index)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-2 text-sm text-gray-600 bg-white border border-dashed rounded-lg hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Paperclip className="w-4 h-4" />
                      Add Attachment
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Error Message */}
                {sendError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4" />
                    {sendError}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 flex items-center gap-2"
              >
                {showPreview ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    Edit
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    Preview
                  </>
                )}
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendAndFinalize}
                  disabled={isSending || isLoading || !subject.trim() || !body.trim()}
                  className={cn(
                    "px-6 py-2 text-sm font-medium text-white rounded-lg flex items-center gap-2",
                    isSending || isLoading || !subject.trim() || !body.trim()
                      ? "bg-green-400 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700"
                  )}
                >
                  {isSending || isLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send & Finalize
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Message Card component for the thread
function MessageCard({ communication }: { communication: Communication }) {
  const isOutgoing = communication.direction === "out";
  const timestamp = new Date(communication.timestamp);

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

      <div className="p-4">
        {communication.subject && (
          <p className="font-medium text-gray-900 mb-2">{communication.subject}</p>
        )}
        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
          {getDisplayContent()}
        </div>
      </div>

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
