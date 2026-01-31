"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Client, EmailTemplate, Communication } from "@/types/client";
import { useEmailTemplates, useEmailPreview, EmailAttachment } from "@/hooks/use-emails";
import { RichTextEditor } from "@/components/templates/rich-text-editor";
import {
  FileEdit,
  Calendar,
  ChevronDown,
  X,
  Paperclip,
  Send,
  Eye,
  Search,
  Plus,
  RefreshCw,
} from "lucide-react";

interface ReplyComposerProps {
  client: Client;
  communications: Communication[];
  onSend: (data: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    attachments?: EmailAttachment[];
  }) => Promise<void>;
  onOpenAvailabilityModal: () => void;
  selectedAvailability: string[];
  onClearAvailability: () => void;
  isSending?: boolean;
  compact?: boolean; // For modal view - always expanded, no collapse state
  hideAvailabilityPreview?: boolean; // Hide the built-in preview (shown in parent instead)
  onBodyChange?: (body: string) => void; // Callback when body changes
  insertText?: string; // Text to insert into body (one-time trigger)
  onInsertTextHandled?: () => void; // Callback after insert text is handled
}

export function ReplyComposer({
  client,
  communications,
  onSend,
  onOpenAvailabilityModal,
  selectedAvailability,
  onClearAvailability,
  isSending = false,
  compact = false,
  hideAvailabilityPreview = false,
  onBodyChange,
  insertText,
  onInsertTextHandled,
}: ReplyComposerProps) {
  // Get templates
  const { data: templates } = useEmailTemplates();
  const emailPreview = useEmailPreview();

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
  const [isExpanded, setIsExpanded] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get the last subject from communications for "Re:" prefix
  const getDefaultSubject = () => {
    const lastOutgoing = [...communications]
      .reverse()
      .find((c) => c.direction === "out");
    if (lastOutgoing?.subject) {
      if (lastOutgoing.subject.toLowerCase().startsWith("re:")) {
        return lastOutgoing.subject;
      }
      return `Re: ${lastOutgoing.subject}`;
    }
    return "";
  };

  // Initialize subject if empty
  useEffect(() => {
    if (!subject && communications.length > 0) {
      setSubject(getDefaultSubject());
    }
  }, [communications]);

  // Handle text insertion from parent (e.g., "Insert into Reply" button)
  useEffect(() => {
    if (insertText) {
      setBody((prev) => prev + insertText);
      onInsertTextHandled?.();
    }
  }, [insertText, onInsertTextHandled]);

  // Notify parent of body changes
  useEffect(() => {
    onBodyChange?.(body);
  }, [body, onBodyChange]);

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

  // Filter templates based on search
  const filteredTemplates = templates?.filter(
    (t) =>
      t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
      t.type.toLowerCase().includes(templateSearch.toLowerCase())
  );

  // Group templates by category
  const templatesByCategory = {
    quickResponses: filteredTemplates?.filter((t) =>
      ["appointment_confirmation", "reschedule_request", "parking_directions", "general_followup", "insurance_verification"].includes(t.type)
    ) || [],
    outreach: filteredTemplates?.filter((t) =>
      t.type.startsWith("follow_up") || t.type === "initial_outreach"
    ) || [],
    other: filteredTemplates?.filter(
      (t) =>
        !["appointment_confirmation", "reschedule_request", "parking_directions", "general_followup", "insurance_verification"].includes(t.type) &&
        !t.type.startsWith("follow_up") &&
        t.type !== "initial_outreach"
    ) || [],
  };

  // Handle template selection
  const handleSelectTemplate = async (template: EmailTemplate) => {
    setTemplateDropdownOpen(false);

    // Generate preview with populated variables
    try {
      const preview = await emailPreview.mutateAsync({
        clientId: client.id,
        templateType: template.type,
        availabilitySlots: selectedAvailability,
      });
      setSubject(preview.subject);
      setBody(preview.body);
    } catch {
      // Fallback to raw template
      setSubject(template.subject);
      setBody(template.body);
    }
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

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle removing attachment
  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Insert availability into body
  const getBodyWithAvailability = () => {
    if (selectedAvailability.length === 0) return body;

    const availabilityBlock = `\n\nAvailable appointment times:\n${selectedAvailability.map((slot) => `• ${slot}`).join("\n")}\n`;

    // Check if body already contains availability
    if (body.includes("Available appointment times:")) {
      return body.replace(
        /Available appointment times:[\s\S]*?(?=\n\n|$)/,
        `Available appointment times:\n${selectedAvailability.map((slot) => `• ${slot}`).join("\n")}`
      );
    }

    return body + availabilityBlock;
  };

  // Handle send
  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      alert("Please enter a subject and message.");
      return;
    }

    await onSend({
      to: client.email,
      cc: cc || undefined,
      bcc: bcc || undefined,
      subject,
      body: getBodyWithAvailability(),
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    // Reset form
    setSubject(getDefaultSubject());
    setBody("");
    setCc("");
    setBcc("");
    setAttachments([]);
    onClearAvailability();
  };

  // Handle cancel
  const handleCancel = () => {
    setSubject(getDefaultSubject());
    setBody("");
    setCc("");
    setBcc("");
    setAttachments([]);
    onClearAvailability();
    setIsExpanded(false);
  };

  // Collapsed view (not shown in compact mode)
  if (!isExpanded && !compact) {
    return (
      <div className="border-t bg-gray-50 px-6 py-4">
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Type a quick reply or click 'Compose' for full editor..."
            className="flex-1 px-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            onFocus={() => setIsExpanded(true)}
          />
          <button
            onClick={() => setTemplateDropdownOpen(true)}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <FileEdit className="w-4 h-4" />
            Templates
          </button>
          <button
            onClick={onOpenAvailabilityModal}
            className="px-4 py-2.5 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            Availability
          </button>
          <button
            onClick={() => setIsExpanded(true)}
            className="px-4 py-2.5 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
          >
            Compose
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(compact ? "p-6" : "border-t bg-gray-50 p-6")}>
      {/* Composer Header with Quick Actions */}
      <div className={cn("flex items-center justify-between", compact ? "mb-4" : "mb-4")}>
        {!compact && <h4 className="font-medium text-gray-900">Compose Reply</h4>}
        <div className={cn("flex items-center gap-2", compact && "w-full")}>
          {/* Template Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setTemplateDropdownOpen(!templateDropdownOpen)}
              className={cn(
                "text-sm font-medium rounded-lg flex items-center gap-2 transition-colors",
                compact
                  ? "px-4 py-2 bg-white border text-gray-700 hover:bg-gray-50"
                  : "px-3 py-1.5 text-gray-700 bg-white border hover:bg-gray-50"
              )}
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
                      className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="overflow-y-auto max-h-72 p-2">
                  {/* Quick Responses */}
                  {templatesByCategory.quickResponses.length > 0 && (
                    <>
                      <p className="text-xs font-medium text-gray-400 px-2 py-1 uppercase tracking-wider">
                        Quick Responses
                      </p>
                      {templatesByCategory.quickResponses.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleSelectTemplate(t)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 hover:text-purple-700 rounded-lg"
                        >
                          {t.name}
                        </button>
                      ))}
                    </>
                  )}

                  {/* Outreach Templates */}
                  {templatesByCategory.outreach.length > 0 && (
                    <>
                      <div className="border-t my-2" />
                      <p className="text-xs font-medium text-gray-400 px-2 py-1 uppercase tracking-wider">
                        Outreach Templates
                      </p>
                      {templatesByCategory.outreach.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleSelectTemplate(t)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 hover:text-purple-700 rounded-lg"
                        >
                          {t.name}
                        </button>
                      ))}
                    </>
                  )}

                  {/* Other Templates */}
                  {templatesByCategory.other.length > 0 && (
                    <>
                      <div className="border-t my-2" />
                      <p className="text-xs font-medium text-gray-400 px-2 py-1 uppercase tracking-wider">
                        Other
                      </p>
                      {templatesByCategory.other.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleSelectTemplate(t)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 hover:text-purple-700 rounded-lg"
                        >
                          {t.name}
                        </button>
                      ))}
                    </>
                  )}

                  {/* No templates */}
                  {filteredTemplates?.length === 0 && (
                    <p className="text-sm text-gray-500 px-3 py-2">
                      No templates found
                    </p>
                  )}

                  {/* Create new template link */}
                  <div className="border-t my-2" />
                  <a
                    href="/settings?tab=templates"
                    className="w-full text-left px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-lg flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Manage Templates
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Offer Availability Button */}
          <button
            onClick={onOpenAvailabilityModal}
            className={cn(
              "text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 flex items-center gap-2 transition-colors",
              compact ? "px-4 py-2" : "px-3 py-1.5"
            )}
          >
            <Calendar className="w-4 h-4" />
            Offer New Availability
          </button>
        </div>
      </div>

      {/* Selected Availability Preview - can be hidden if shown in parent */}
      {!hideAvailabilityPreview && selectedAvailability.length > 0 && (
        <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-purple-800">
              Selected Availability (will be inserted)
            </span>
            <button
              onClick={onClearAvailability}
              className="text-xs text-purple-600 hover:text-purple-800"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedAvailability.map((slot, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-white text-purple-700 text-xs rounded border border-purple-200"
              >
                {slot}
              </span>
            ))}
          </div>
        </div>
      )}

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
          <label className="w-16 text-sm font-medium text-gray-600">
            Subject:
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Enter subject..."
            className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* CC/BCC Toggle */}
        <div className="flex items-center gap-3">
          <span className="w-16" />
          {!showCcBcc ? (
            <button
              onClick={() => setShowCcBcc(true)}
              className="text-xs text-purple-600 hover:text-purple-800"
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
                  className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="w-8 text-sm text-gray-600">BCC:</label>
                <input
                  type="text"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="Email addresses separated by commas"
                  className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
          <RichTextEditor
            content={body}
            onChange={setBody}
            placeholder="Type your message here..."
          />
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
            <span className="text-xs text-gray-500">Max 10MB</span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            {showPreview ? "Hide Preview" : "Preview"}
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
          >
            Clear
          </button>
          <button
            onClick={handleSend}
            disabled={isSending || !subject.trim() || !body.trim()}
            className={cn(
              "px-6 py-2 text-sm font-medium text-white rounded-lg flex items-center gap-2",
              isSending || !subject.trim() || !body.trim()
                ? "bg-purple-400 cursor-not-allowed"
                : "bg-purple-600 hover:bg-purple-700"
            )}
          >
            {isSending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Reply
              </>
            )}
          </button>
        </div>
      </div>

      {/* Preview Panel - displays user's own composed content as plain text for safety */}
      {showPreview && (
        <div className="mt-4 p-4 bg-white border rounded-lg">
          <h5 className="font-medium text-gray-900 mb-2">Email Preview</h5>
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-gray-500">To:</span> {client.email}
            </p>
            {cc && (
              <p>
                <span className="text-gray-500">CC:</span> {cc}
              </p>
            )}
            {bcc && (
              <p>
                <span className="text-gray-500">BCC:</span> {bcc}
              </p>
            )}
            <p>
              <span className="text-gray-500">Subject:</span> {subject}
            </p>
            <div className="border-t pt-2 mt-2">
              {/* Preview the body as plain text for security - strip HTML tags */}
              <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                {getBodyWithAvailability()
                  .replace(/<[^>]*>/g, "")
                  .replace(/&nbsp;/g, " ")
                  .replace(/&amp;/g, "&")
                  .replace(/&lt;/g, "<")
                  .replace(/&gt;/g, ">")
                  .replace(/&quot;/g, '"')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
