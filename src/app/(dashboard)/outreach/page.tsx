"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useClients, useUpdateClient, useClosedClients } from "@/hooks/use-clients";
import { useTemplates, usePreviewTemplate } from "@/hooks/use-templates";
import { useSendEmail, EmailAttachment } from "@/hooks/use-emails";
import { Client, EmailTemplate, ClientStatus } from "@/types/client";
import { ClosedCasesSection } from "@/components/clients/closed-cases-section";
import { ClientPreviewModal } from "@/components/clients/client-preview-modal";
import { RichTextEditor } from "@/components/templates/rich-text-editor";
import { formatRelativeTime, formatDate } from "@/lib/utils";
import Link from "next/link";
import {
  Search,
  Mail,
  Phone,
  AlertCircle,
  Loader2,
  Users,
  CheckCircle,
  X,
  Calendar,
  FileText,
  User,
  CreditCard,
  MessageSquare,
  ExternalLink,
  ChevronDown,
  FileEdit,
  Check,
  Send,
  Paperclip,
  Trash2,
  Plus,
  Clock,
  Circle,
  XCircle,
  ArrowRight,
  Reply,
  MailCheck,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";

// Outreach workflow statuses
const OUTREACH_STATUSES: ClientStatus[] = [
  "pending_outreach",
  "outreach_sent",
  "follow_up_1",
  "follow_up_2",
];

// Calculate days since a given date
function getDaysSince(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  const date = new Date(dateStr);
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// Status info for display
interface StatusInfo {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  label: string;
  isOverdue: boolean;
}

function getStatusInfo(client: Client): StatusInfo {
  const OVERDUE_DAYS = 7;

  switch (client.status) {
    case "pending_outreach": {
      const daysSince = getDaysSince(client.createdAt);
      const isOverdue = daysSince > OVERDUE_DAYS;
      return {
        icon: isOverdue ? <AlertCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />,
        color: isOverdue ? "text-red-600" : "text-purple-600",
        bgColor: isOverdue ? "bg-red-100" : "bg-purple-100",
        label: "Ready for outreach",
        isOverdue,
      };
    }
    case "outreach_sent": {
      const daysSince = getDaysSince(client.initialOutreachDate);
      const isOverdue = daysSince > OVERDUE_DAYS;
      return {
        icon: isOverdue ? <AlertCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />,
        color: isOverdue ? "text-red-600" : "text-blue-600",
        bgColor: isOverdue ? "bg-red-100" : "bg-blue-100",
        label: `Sent ${daysSince}d ago`,
        isOverdue,
      };
    }
    case "follow_up_1": {
      const daysSince = getDaysSince(client.followUp1Date);
      const isOverdue = daysSince > OVERDUE_DAYS;
      return {
        icon: isOverdue ? <AlertCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />,
        color: isOverdue ? "text-red-600" : "text-orange-600",
        bgColor: isOverdue ? "bg-red-100" : "bg-orange-100",
        label: `F/U 1 sent ${daysSince}d ago`,
        isOverdue,
      };
    }
    case "follow_up_2": {
      const daysSince = getDaysSince(client.followUp2Date);
      return {
        icon: <CheckCircle className="w-5 h-5" />,
        color: "text-gray-600",
        bgColor: "bg-gray-100",
        label: `F/U 2 sent ${daysSince}d ago`,
        isOverdue: false,
      };
    }
    default:
      return {
        icon: <Circle className="w-5 h-5" />,
        color: "text-gray-600",
        bgColor: "bg-gray-100",
        label: client.status,
        isOverdue: false,
      };
  }
}

// Get workflow banner info based on status
interface BannerInfo {
  color: string;
  bgColor: string;
  borderColor: string;
  title: string;
  message: string;
}

function getWorkflowBanner(client: Client): BannerInfo {
  switch (client.status) {
    case "pending_outreach":
      return {
        color: "text-purple-800",
        bgColor: "bg-purple-50",
        borderColor: "border-purple-200",
        title: "Ready for Initial Outreach",
        message: "Send the initial contact email to this client.",
      };
    case "outreach_sent": {
      const days = getDaysSince(client.initialOutreachDate);
      const isOverdue = days > 7;
      return {
        color: isOverdue ? "text-red-800" : "text-blue-800",
        bgColor: isOverdue ? "bg-red-50" : "bg-blue-50",
        borderColor: isOverdue ? "border-red-200" : "border-blue-200",
        title: "Awaiting Response",
        message: isOverdue
          ? `No response in ${days} days. Consider sending Follow-up 1.`
          : `Initial outreach sent ${days} days ago. Awaiting client response.`,
      };
    }
    case "follow_up_1": {
      const days = getDaysSince(client.followUp1Date);
      const isOverdue = days > 7;
      return {
        color: isOverdue ? "text-red-800" : "text-orange-800",
        bgColor: isOverdue ? "bg-red-50" : "bg-orange-50",
        borderColor: isOverdue ? "border-red-200" : "border-orange-200",
        title: "Follow-up 1 Sent",
        message: isOverdue
          ? `No response in ${days} days. Consider sending Follow-up 2.`
          : `Follow-up 1 sent ${days} days ago. Awaiting client response.`,
      };
    }
    case "follow_up_2": {
      const days = getDaysSince(client.followUp2Date);
      return {
        color: "text-gray-800",
        bgColor: "bg-gray-50",
        borderColor: "border-gray-200",
        title: "Final Follow-up Sent",
        message: `Follow-up 2 sent ${days} days ago. Consider closing if no response.`,
      };
    }
    default:
      return {
        color: "text-gray-800",
        bgColor: "bg-gray-50",
        borderColor: "border-gray-200",
        title: client.status,
        message: "",
      };
  }
}

// Get suggested template type based on status
function getSuggestedTemplateType(status: ClientStatus): string | null {
  switch (status) {
    case "pending_outreach":
      return "initial_outreach";
    case "outreach_sent":
      return "follow_up_1";
    case "follow_up_1":
      return "follow_up_2";
    case "follow_up_2":
      return null; // All follow-ups exhausted
    default:
      return null;
  }
}

// Client Row Component for the left panel
function ClientRow({
  client,
  isSelected,
  onClick,
  onClose,
}: {
  client: Client;
  isSelected: boolean;
  onClick: () => void;
  onClose: () => void;
}) {
  const statusInfo = getStatusInfo(client);

  return (
    <div
      className={`px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors ${
        isSelected
          ? "bg-purple-50 border-l-4 border-purple-500"
          : "hover:bg-gray-50 border-l-4 border-transparent"
      }`}
      onClick={onClick}
    >
      {/* Status Icon */}
      <div
        className={`w-8 h-8 rounded-full ${statusInfo.bgColor} flex items-center justify-center flex-shrink-0`}
        title={statusInfo.label}
      >
        <span className={statusInfo.color}>{statusInfo.icon}</span>
      </div>

      {/* Client Info */}
      <div className="min-w-0 flex-1">
        <div className="font-medium text-gray-900 truncate">
          {client.firstName} {client.lastName}
        </div>
        <div className="text-xs text-gray-500 truncate">{client.email}</div>
      </div>

      {/* Status Badge */}
      <div className="flex-shrink-0 hidden sm:block">
        <span
          className={`text-xs px-2 py-1 rounded-full ${statusInfo.bgColor} ${statusInfo.color}`}
        >
          {statusInfo.label}
        </span>
      </div>

      {/* Close Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        title="Close case"
      >
        <XCircle className="w-5 h-5" />
      </button>
    </div>
  );
}

// Dropdown component for template selection
interface DropdownProps {
  label: string;
  icon: React.ReactNode;
  selectedLabel?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Dropdown({ label, icon, selectedLabel, isOpen, onToggle, children }: DropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (isOpen) onToggle();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onToggle]);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
          selectedLabel
            ? "bg-purple-50 border-purple-300 text-purple-700"
            : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
        }`}
      >
        {icon}
        <span className="max-w-[150px] truncate">{selectedLabel || label}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white border rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  );
}

// Reading Pane Component
interface ReadingPaneProps {
  client: Client;
  selectedTemplate: EmailTemplate | null;
  onSelectTemplate: (template: EmailTemplate | null) => void;
  onClose: () => void;
  onCloseCase: () => void;
  onEmailSent: () => void;
  onMoveToScheduling: () => void;
  onMoveToReferral: () => void;
}

function ReadingPane({
  client,
  selectedTemplate,
  onSelectTemplate,
  onClose,
  onCloseCase,
  onEmailSent,
  onMoveToScheduling,
  onMoveToReferral,
}: ReadingPaneProps) {
  const { data: allTemplates, isLoading: templatesLoading } = useTemplates();
  const previewMutation = usePreviewTemplate();
  const sendEmailMutation = useSendEmail();
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  // Email fields
  const [editedTo, setEditedTo] = useState("");
  const [editedCc, setEditedCc] = useState("");
  const [editedBcc, setEditedBcc] = useState("");
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);

  // Filter templates to outreach types only
  const outreachTemplates = useMemo(() => {
    return allTemplates?.filter(
      (t) =>
        ["initial_outreach", "follow_up_1", "follow_up_2"].includes(t.type) && t.isActive
    );
  }, [allTemplates]);

  // Get suggested template based on client status
  const suggestedTemplateType = getSuggestedTemplateType(client.status);
  const suggestedTemplate = useMemo(() => {
    if (!suggestedTemplateType || !outreachTemplates) return null;
    return outreachTemplates.find((t) => t.type === suggestedTemplateType) || null;
  }, [suggestedTemplateType, outreachTemplates]);

  // Auto-select suggested template when client changes
  useEffect(() => {
    if (suggestedTemplate && !selectedTemplate) {
      onSelectTemplate(suggestedTemplate);
    }
  }, [suggestedTemplate, selectedTemplate, onSelectTemplate]);

  const banner = getWorkflowBanner(client);

  const handlePreviewEmail = async () => {
    if (!selectedTemplate) return;

    try {
      const result = await previewMutation.mutateAsync({
        templateId: selectedTemplate.id,
        variables: {
          clientFirstName: client.firstName,
          clientLastName: client.lastName,
          clientEmail: client.email,
          practiceName: "Therapy Practice",
          clientPhone: client.phone || undefined,
          clientAge: client.age || undefined,
          presentingConcerns: client.presentingConcerns || undefined,
          paymentType: client.paymentType || undefined,
          insuranceProvider: client.insuranceProvider || undefined,
        },
      });

      setEditedTo(client.email);
      setEditedCc("");
      setEditedBcc("");
      setEditedSubject(result.subject);
      setEditedBody(result.body);
      setAttachments([]);
      setSendSuccess(false);
      setIsEditing(false);
      setShowEmailPreview(true);
    } catch (error) {
      console.error("Failed to preview email:", error);
      addToast({
        type: "error",
        title: "Preview failed",
        message: "Failed to generate email preview",
      });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: EmailAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) {
        addToast({
          type: "error",
          title: "File too large",
          message: `${file.name} exceeds the 10MB limit`,
        });
        continue;
      }

      const content = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(",")[1];
          resolve(base64);
        };
        reader.readAsDataURL(file);
      });

      newAttachments.push({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        content,
      });
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSendEmail = async () => {
    if (!editedTo || !editedSubject || !editedBody) {
      addToast({
        type: "error",
        title: "Missing fields",
        message: "Please fill in To, Subject, and Body",
      });
      return;
    }

    try {
      await sendEmailMutation.mutateAsync({
        clientId: client.id,
        to: editedTo,
        cc: editedCc || undefined,
        bcc: editedBcc || undefined,
        subject: editedSubject,
        body: editedBody,
        bodyFormat: "html",
        templateType: selectedTemplate?.type,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      setSendSuccess(true);
      onEmailSent();

      addToast({
        type: "success",
        title: "Email sent",
        message: `${selectedTemplate?.type === "initial_outreach" ? "Initial outreach" : "Follow-up"} email sent to ${editedTo}`,
      });

      setTimeout(() => {
        setShowEmailPreview(false);
      }, 1500);
    } catch (error) {
      addToast({
        type: "error",
        title: "Failed to send",
        message: error instanceof Error ? error.message : "Failed to send email",
      });
    }
  };

  // Render HTML content safely (content comes from our own templates)
  const renderEmailBody = (html: string) => {
    return { __html: html };
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-semibold text-lg">
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
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/clients/${client.id}`}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Full Profile
          </Link>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Workflow Status Banner */}
      <div
        className={`px-6 py-3 border-b ${banner.bgColor} ${banner.borderColor} flex-shrink-0`}
      >
        <div className="flex items-center gap-3">
          <MailCheck className={`w-5 h-5 ${banner.color}`} />
          <div>
            <div className={`font-medium ${banner.color}`}>{banner.title}</div>
            <div className={`text-sm ${banner.color} opacity-80`}>{banner.message}</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b bg-white flex-shrink-0 flex-wrap">
        {/* Template Selector */}
        <Dropdown
          label="Select Template"
          icon={<FileEdit className="w-4 h-4" />}
          selectedLabel={selectedTemplate?.name}
          isOpen={templateDropdownOpen}
          onToggle={() => setTemplateDropdownOpen(!templateDropdownOpen)}
        >
          {templatesLoading ? (
            <div className="p-4 text-center">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
            </div>
          ) : !outreachTemplates || outreachTemplates.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">
              <p>No outreach templates available.</p>
              <Link href="/templates" className="text-purple-600 hover:underline">
                Create templates
              </Link>
            </div>
          ) : (
            <div className="py-1">
              {selectedTemplate && (
                <button
                  onClick={() => {
                    onSelectTemplate(null);
                    setTemplateDropdownOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Clear selection
                </button>
              )}
              {outreachTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => {
                    onSelectTemplate(template);
                    setTemplateDropdownOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${
                    selectedTemplate?.id === template.id ? "bg-purple-50" : ""
                  }`}
                >
                  <div>
                    <div className="font-medium text-gray-900 flex items-center gap-2">
                      {template.name}
                      {template.type === suggestedTemplateType && (
                        <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                          Suggested
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 truncate max-w-[200px]">
                      {template.subject}
                    </div>
                  </div>
                  {selectedTemplate?.id === template.id && (
                    <Check className="w-4 h-4 text-purple-600" />
                  )}
                </button>
              ))}
            </div>
          )}
        </Dropdown>

        {/* Send Email Button */}
        {selectedTemplate && (
          <button
            onClick={handlePreviewEmail}
            disabled={previewMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            {previewMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Send Email
          </button>
        )}

        <div className="flex-1" />

        {/* Action Buttons */}
        <button
          onClick={onMoveToScheduling}
          className="flex items-center gap-2 px-3 py-2 text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
          title="Client responded - ready to schedule"
        >
          <Reply className="w-4 h-4" />
          Client Replied
        </button>

        <button
          onClick={onMoveToReferral}
          className="flex items-center gap-2 px-3 py-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
          title="Move to referral workflow"
        >
          <ArrowRight className="w-4 h-4" />
          Move to Referral
        </button>

        <button
          onClick={onCloseCase}
          className="flex items-center gap-2 px-3 py-2 text-gray-600 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <XCircle className="w-4 h-4" />
          Close Case
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              Basic Information
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Full Name</dt>
                <dd className="text-gray-900 font-medium">
                  {client.firstName} {client.lastName}
                </dd>
              </div>
              {client.age && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Age</dt>
                  <dd className="text-gray-900">{client.age}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Email</dt>
                <dd className="text-gray-900">{client.email}</dd>
              </div>
              {client.phone && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Phone</dt>
                  <dd className="text-gray-900">{client.phone}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-gray-500">Submitted</dt>
                <dd className="text-gray-900">{formatDate(client.createdAt)}</dd>
              </div>
            </dl>
          </div>

          {/* Outreach History */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Outreach History
            </h3>
            <dl className="space-y-2 text-sm">
              {client.initialOutreachDate && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Initial Outreach</dt>
                  <dd className="text-gray-900">{formatDate(client.initialOutreachDate)}</dd>
                </div>
              )}
              {client.followUp1Date && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Follow-up 1</dt>
                  <dd className="text-gray-900">{formatDate(client.followUp1Date)}</dd>
                </div>
              )}
              {client.followUp2Date && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Follow-up 2</dt>
                  <dd className="text-gray-900">{formatDate(client.followUp2Date)}</dd>
                </div>
              )}
              {!client.initialOutreachDate && !client.followUp1Date && !client.followUp2Date && (
                <p className="text-gray-400 italic">No outreach emails sent yet</p>
              )}
            </dl>
          </div>

          {/* Insurance & Payment */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Insurance & Payment
            </h3>
            <dl className="space-y-2 text-sm">
              {client.paymentType && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Payment Type</dt>
                  <dd className="text-gray-900 capitalize">{client.paymentType}</dd>
                </div>
              )}
              {client.insuranceProvider && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Insurance Provider</dt>
                  <dd className="text-gray-900">{client.insuranceProvider}</dd>
                </div>
              )}
              {client.insuranceMemberId && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Member ID</dt>
                  <dd className="text-gray-900">{client.insuranceMemberId}</dd>
                </div>
              )}
              {!client.paymentType && !client.insuranceProvider && (
                <p className="text-gray-400 italic">No insurance information provided</p>
              )}
            </dl>
          </div>

          {/* Presenting Concerns */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Presenting Concerns
            </h3>
            {client.presentingConcerns ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {client.presentingConcerns}
              </p>
            ) : (
              <p className="text-sm text-gray-400 italic">No presenting concerns provided</p>
            )}
          </div>

          {/* Additional Information */}
          {client.additionalInfo && (
            <div className="bg-white rounded-lg border p-4 lg:col-span-2">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Additional Information
              </h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {client.additionalInfo}
              </p>
            </div>
          )}

          {/* Clinical Flags - Only show if client explicitly answered "Yes" */}
          {(() => {
            const hasSuicideFlag = client.suicideAttemptRecent?.toLowerCase().trim() === "yes";
            const hasHospitalizationFlag = client.psychiatricHospitalization?.toLowerCase().trim() === "yes";

            if (!hasSuicideFlag && !hasHospitalizationFlag) return null;

            return (
              <div className="bg-red-50 rounded-lg border border-red-200 p-4 lg:col-span-2">
                <h3 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Clinical Flags
                </h3>
                <div className="space-y-2 text-sm">
                  {hasSuicideFlag && (
                    <div className="flex items-center gap-2 text-red-700">
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      Recent suicide attempt reported
                    </div>
                  )}
                  {hasHospitalizationFlag && (
                    <div className="flex items-center gap-2 text-red-700">
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      Psychiatric hospitalization history
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Email Preview Modal */}
      {showEmailPreview && previewMutation.data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !sendEmailMutation.isPending && setShowEmailPreview(false)}
          />

          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-gray-900">
                  {sendSuccess ? "Email Sent!" : isEditing ? "Edit Email" : "Preview Email"}
                </h2>
                {!sendSuccess && (
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className={`px-3 py-1 text-sm rounded-full transition-colors ${
                      isEditing
                        ? "bg-purple-100 text-purple-700"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {isEditing ? "Preview Mode" : "Edit Mode"}
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowEmailPreview(false)}
                disabled={sendEmailMutation.isPending}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {sendSuccess ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Email Sent Successfully!
                  </h3>
                  <p className="text-gray-600">
                    The email has been sent to {editedTo}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Email Fields */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="w-16 text-sm font-medium text-gray-500">To:</label>
                      {isEditing ? (
                        <input
                          type="email"
                          value={editedTo}
                          onChange={(e) => setEditedTo(e.target.value)}
                          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="recipient@example.com"
                        />
                      ) : (
                        <span className="text-sm text-gray-900">{editedTo}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="w-16 text-sm font-medium text-gray-500">CC:</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedCc}
                          onChange={(e) => setEditedCc(e.target.value)}
                          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Separate multiple emails with commas"
                        />
                      ) : (
                        <span className="text-sm text-gray-500">
                          {editedCc || <span className="italic">None</span>}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="w-16 text-sm font-medium text-gray-500">BCC:</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedBcc}
                          onChange={(e) => setEditedBcc(e.target.value)}
                          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Separate multiple emails with commas"
                        />
                      ) : (
                        <span className="text-sm text-gray-500">
                          {editedBcc || <span className="italic">None</span>}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="w-16 text-sm font-medium text-gray-500">Subject:</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedSubject}
                          onChange={(e) => setEditedSubject(e.target.value)}
                          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      ) : (
                        <span className="text-sm text-gray-900 font-medium">{editedSubject}</span>
                      )}
                    </div>
                  </div>

                  {/* Email body */}
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">Message:</label>
                    {isEditing ? (
                      <RichTextEditor
                        content={editedBody}
                        onChange={setEditedBody}
                        placeholder="Compose your email..."
                        editable={true}
                      />
                    ) : (
                      <div
                        className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={renderEmailBody(editedBody)}
                      />
                    )}
                  </div>

                  {/* Attachments */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-500">
                        Attachments ({attachments.length})
                      </label>
                      {isEditing && (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
                        >
                          <Plus className="w-4 h-4" />
                          Add File
                        </button>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    {attachments.length > 0 ? (
                      <div className="space-y-2">
                        {attachments.map((attachment, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                          >
                            <div className="flex items-center gap-2">
                              <Paperclip className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-700">{attachment.filename}</span>
                              <span className="text-xs text-gray-400">
                                ({Math.round(attachment.content.length * 0.75 / 1024)}KB)
                              </span>
                            </div>
                            {isEditing && (
                              <button
                                onClick={() => removeAttachment(index)}
                                className="p-1 text-gray-400 hover:text-red-500 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 italic">No attachments</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {!sendSuccess && (
              <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
                <button
                  onClick={() => setShowEmailPreview(false)}
                  disabled={sendEmailMutation.isPending}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={sendEmailMutation.isPending || !editedTo || !editedSubject}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendEmailMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Email
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Close Confirmation Modal
interface CloseConfirmModalProps {
  client: Client;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

function CloseConfirmModal({
  client,
  isOpen,
  onConfirm,
  onCancel,
  isLoading,
}: CloseConfirmModalProps) {
  if (!isOpen) return null;

  const hasAllFollowUps = !!client.followUp2Date;
  const attemptCount =
    (client.initialOutreachDate ? 1 : 0) +
    (client.followUp1Date ? 1 : 0) +
    (client.followUp2Date ? 1 : 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onCancel} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-xl shadow-2xl max-w-md w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            <div
              className={`w-12 h-12 rounded-full ${hasAllFollowUps ? "bg-gray-100" : "bg-amber-100"} flex items-center justify-center mx-auto mb-4`}
            >
              {hasAllFollowUps ? (
                <CheckCircle className="w-6 h-6 text-gray-600" />
              ) : (
                <AlertCircle className="w-6 h-6 text-amber-600" />
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
              {hasAllFollowUps ? "Close Case" : "Close Without All Follow-ups?"}
            </h3>
            <p className="text-sm text-gray-600 text-center mb-4">
              {hasAllFollowUps ? (
                <>
                  Are you sure you want to close the case for{" "}
                  <span className="font-medium">
                    {client.firstName} {client.lastName}
                  </span>
                  ? All follow-up attempts have been exhausted.
                </>
              ) : (
                <>
                  <span className="font-medium">
                    {client.firstName} {client.lastName}
                  </span>{" "}
                  has only received {attemptCount} outreach{" "}
                  {attemptCount === 1 ? "attempt" : "attempts"}. Are you sure you want to close
                  this case without completing all follow-ups?
                </>
              )}
            </p>

            {/* Outreach Summary */}
            <div className="bg-gray-50 rounded-lg p-3 mb-6 text-sm">
              <div className="font-medium text-gray-700 mb-2">Outreach Summary:</div>
              <ul className="space-y-1 text-gray-600">
                <li className="flex items-center gap-2">
                  {client.initialOutreachDate ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <Circle className="w-4 h-4 text-gray-300" />
                  )}
                  Initial Outreach
                  {client.initialOutreachDate && (
                    <span className="text-gray-400">
                      - {formatDate(client.initialOutreachDate)}
                    </span>
                  )}
                </li>
                <li className="flex items-center gap-2">
                  {client.followUp1Date ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <Circle className="w-4 h-4 text-gray-300" />
                  )}
                  Follow-up 1
                  {client.followUp1Date && (
                    <span className="text-gray-400">- {formatDate(client.followUp1Date)}</span>
                  )}
                </li>
                <li className="flex items-center gap-2">
                  {client.followUp2Date ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <Circle className="w-4 h-4 text-gray-300" />
                  )}
                  Follow-up 2
                  {client.followUp2Date && (
                    <span className="text-gray-400">- {formatDate(client.followUp2Date)}</span>
                  )}
                </li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                disabled={isLoading}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                  hasAllFollowUps
                    ? "bg-gray-600 hover:bg-gray-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Closing...
                  </>
                ) : (
                  <>{hasAllFollowUps ? "Close Case" : "Close Anyway"}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Outreach Page Component
export default function OutreachPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: clients, isLoading, error, refetch } = useClients();

  // Selected client for reading pane
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Selected template for email composition
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);

  // Close confirmation modal state
  const [closeConfirmClient, setCloseConfirmClient] = useState<Client | null>(null);

  // Closed cases section state
  const [showClosedSection, setShowClosedSection] = useState(false);
  const {
    data: closedOutreach,
    isLoading: closedLoading,
    refetch: refetchClosed,
  } = useClosedClients("outreach");
  const [previewClientId, setPreviewClientId] = useState<string | null>(null);

  // Update client hook
  const updateClient = useUpdateClient();
  const { addToast } = useToast();

  // Filter for outreach workflow statuses
  const outreachClients = clients?.filter(
    (client) =>
      OUTREACH_STATUSES.includes(client.status) &&
      (searchQuery === "" ||
        `${client.firstName} ${client.lastName}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        client.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Get stats by status
  const pendingCount =
    outreachClients?.filter((c) => c.status === "pending_outreach").length || 0;
  const awaitingCount =
    outreachClients?.filter((c) => c.status === "outreach_sent").length || 0;
  const followUpCount =
    outreachClients?.filter(
      (c) => c.status === "follow_up_1" || c.status === "follow_up_2"
    ).length || 0;

  // Get the selected client object
  const selectedClient = outreachClients?.find((c) => c.id === selectedClientId);

  const handleClientClick = (client: Client) => {
    if (client.id !== selectedClientId) {
      // Reset template selection when switching clients
      setSelectedTemplate(null);
    }
    setSelectedClientId(client.id);
  };

  const handleReopenSuccess = () => {
    refetch();
    refetchClosed();
  };

  const handleEmailSent = () => {
    refetch();
  };

  const handleMoveToScheduling = async () => {
    if (!selectedClient) return;

    try {
      await updateClient.mutateAsync({
        id: selectedClient.id,
        data: {
          status: "ready_to_schedule",
        },
      });

      addToast({
        type: "success",
        title: "Moved to scheduling",
        message: `${selectedClient.firstName} ${selectedClient.lastName} is now ready to schedule.`,
      });

      setSelectedClientId(null);
      refetch();
    } catch (error) {
      addToast({
        type: "error",
        title: "Failed to update",
        message: error instanceof Error ? error.message : "Failed to move client",
      });
    }
  };

  const handleMoveToReferral = async () => {
    if (!selectedClient) return;

    try {
      await updateClient.mutateAsync({
        id: selectedClient.id,
        data: {
          status: "pending_referral",
        },
      });

      addToast({
        type: "success",
        title: "Moved to referrals",
        message: `${selectedClient.firstName} ${selectedClient.lastName} has been moved to referrals.`,
      });

      setSelectedClientId(null);
      refetch();
    } catch (error) {
      addToast({
        type: "error",
        title: "Failed to update",
        message: error instanceof Error ? error.message : "Failed to move client",
      });
    }
  };

  const handleCloseClick = (client: Client) => {
    setCloseConfirmClient(client);
  };

  const handleConfirmClose = async () => {
    if (!closeConfirmClient) return;

    try {
      await updateClient.mutateAsync({
        id: closeConfirmClient.id,
        data: {
          status: "closed_no_contact",
          closedDate: new Date().toISOString(),
          closedReason: "no_response_after_outreach",
          closedFromWorkflow: "outreach",
          closedFromStatus: closeConfirmClient.status,
        },
      });

      addToast({
        type: "success",
        title: "Case closed",
        message: `${closeConfirmClient.firstName} ${closeConfirmClient.lastName} has been closed.`,
      });

      if (selectedClientId === closeConfirmClient.id) {
        setSelectedClientId(null);
      }

      setCloseConfirmClient(null);
      refetch();
      refetchClosed();
    } catch (error) {
      addToast({
        type: "error",
        title: "Failed to close",
        message: error instanceof Error ? error.message : "Failed to close case",
      });
    }
  };

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>Failed to load outreach clients. Please try again.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Outreach</h1>
          <p className="text-sm text-gray-600">
            Manage client communications and follow-ups
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
            <span className="text-gray-600">
              <span className="font-semibold text-purple-600">{pendingCount}</span> Pending
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            <span className="text-gray-600">
              <span className="font-semibold text-blue-600">{awaitingCount}</span> Awaiting
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
            <span className="text-gray-600">
              <span className="font-semibold text-orange-600">{followUpCount}</span> Follow-up
            </span>
          </div>
        </div>
      </div>

      {/* Main Content - Left/Right Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Client List */}
        <div className="w-[380px] flex-shrink-0 border-r bg-white flex flex-col">
          {/* Search Bar */}
          <div className="p-3 border-b bg-gray-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search outreach clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Client List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading clients...</p>
              </div>
            ) : outreachClients?.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600 font-medium">No outreach clients</p>
                <p className="text-sm text-gray-500 mt-1">
                  {searchQuery
                    ? "No clients match your search."
                    : "Clients ready for outreach will appear here."}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {outreachClients?.map((client) => (
                  <ClientRow
                    key={client.id}
                    client={client}
                    isSelected={client.id === selectedClientId}
                    onClick={() => handleClientClick(client)}
                    onClose={() => handleCloseClick(client)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Reading Pane */}
        <div className="flex-1 bg-white overflow-hidden flex flex-col">
          {selectedClient ? (
            <ReadingPane
              client={selectedClient}
              selectedTemplate={selectedTemplate}
              onSelectTemplate={setSelectedTemplate}
              onClose={() => setSelectedClientId(null)}
              onCloseCase={() => setCloseConfirmClient(selectedClient)}
              onEmailSent={handleEmailSent}
              onMoveToScheduling={handleMoveToScheduling}
              onMoveToReferral={handleMoveToReferral}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <Mail className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">
                  Select a client to view details
                </h3>
                <p className="text-sm text-gray-500">
                  Choose a client from the list to compose and send outreach emails
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Closed Cases Section - Always visible at bottom */}
      <ClosedCasesSection
        clients={closedOutreach}
        workflow="outreach"
        isExpanded={showClosedSection}
        onToggle={() => setShowClosedSection(!showClosedSection)}
        isLoading={closedLoading}
        onClientClick={(client) => setPreviewClientId(client.id)}
        onReopenSuccess={handleReopenSuccess}
      />

      {/* Close Confirmation Modal */}
      {closeConfirmClient && (
        <CloseConfirmModal
          client={closeConfirmClient}
          isOpen={!!closeConfirmClient}
          onConfirm={handleConfirmClose}
          onCancel={() => setCloseConfirmClient(null)}
          isLoading={updateClient.isPending}
        />
      )}

      {/* Client Preview Modal (for closed cases) */}
      <ClientPreviewModal
        clientId={previewClientId}
        isOpen={!!previewClientId}
        onClose={() => setPreviewClientId(null)}
        onActionComplete={handleReopenSuccess}
      />
    </div>
  );
}
