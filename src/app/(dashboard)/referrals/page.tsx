"use client";

import { useState, useRef, useEffect, useMemo, Fragment } from "react";
import { useClients, useUpdateClient, useClosedClients } from "@/hooks/use-clients";
import { useReferralClinics } from "@/hooks/use-referral-clinics";
import { useReferralTemplates, usePreviewTemplate } from "@/hooks/use-templates";
import { useSendEmail, EmailAttachment } from "@/hooks/use-emails";
import { Client, EmailTemplate, ReferralClinic, isClosedStatus } from "@/types/client";
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
  Building2,
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
  MapPin,
  Tag,
  StickyNote,
  Eye,
  Send,
  Edit2,
  Paperclip,
  Trash2,
  Plus,
  Clock,
  Circle,
  XCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";

function ClientRow({
  client,
  isSelected,
  onClick,
  onDoubleClick,
  onClose,
}: {
  client: Client;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onClose: () => void;
}) {
  // Use persisted referral sent data from client record
  const isSent = !!client.referralEmailSentAt;
  const clinicNames = client.referralClinicNames?.split(", ").filter(Boolean) || [];

  return (
    <div
      className={`px-4 py-3 flex items-center gap-4 cursor-pointer transition-colors ${
        isSelected
          ? "bg-amber-50 border-l-4 border-amber-500"
          : "hover:bg-gray-50 border-l-4 border-transparent"
      }`}
      onClick={onClick}
      onDoubleClick={(e) => {
        e.preventDefault();
        onDoubleClick();
      }}
    >
      {/* Status Icon */}
      <div className="flex-shrink-0" title={isSent ? `Referral sent ${formatRelativeTime(client.referralEmailSentAt!)}` : "Pending referral"}>
        {isSent ? (
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
            <Circle className="w-5 h-5 text-amber-500" />
          </div>
        )}
      </div>

      {/* Client Info */}
      <div className="flex items-center gap-3 min-w-0 w-44 flex-shrink-0">
        <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-medium text-sm flex-shrink-0">
          {client.firstName[0]}
          {client.lastName[0]}
        </div>
        <div className="min-w-0">
          <div className="font-medium text-gray-900 truncate">
            {client.firstName} {client.lastName}
          </div>
          <div className="text-sm text-gray-500 truncate">{client.email}</div>
        </div>
      </div>

      {/* Submission Date */}
      <div className="text-xs text-gray-500 hidden sm:block flex-shrink-0 w-24">
        <div>{formatDate(client.createdAt)}</div>
        <div className="text-gray-400">{formatRelativeTime(client.createdAt)}</div>
      </div>
      <div className="text-xs text-gray-500 sm:hidden flex-shrink-0">{formatRelativeTime(client.createdAt)}</div>

      {/* Referral Status / Sent Info */}
      <div className="flex-1 min-w-0 hidden md:block">
        {isSent ? (
          <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 px-2 py-1.5 rounded-lg border border-green-200">
            <Clock className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">
              Sent {formatRelativeTime(client.referralEmailSentAt!)}
              {clinicNames.length > 0 && (
                <span className="text-green-600"> to {clinicNames.join(", ")}</span>
              )}
            </span>
          </div>
        ) : client.referralReason ? (
          <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded max-w-[200px] truncate">
            {client.referralReason}
          </div>
        ) : null}
      </div>

      {/* Close Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        title="Close referral"
      >
        <XCircle className="w-5 h-5" />
      </button>
    </div>
  );
}

// Dropdown component for template/clinic selection
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
            ? "bg-amber-50 border-amber-300 text-amber-700"
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

// Clinic Selector Modal - Full-featured search and filter with table view
interface ClinicSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (clinics: ReferralClinic[]) => void;
  selectedClinics: ReferralClinic[];
  clientConditions?: string; // For highlighting relevant specialties
}

function ClinicSelectorModal({
  isOpen,
  onClose,
  onSelect,
  selectedClinics,
  clientConditions,
}: ClinicSelectorModalProps) {
  const { data: clinics, isLoading } = useReferralClinics();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [expandedClinicId, setExpandedClinicId] = useState<string | null>(null);
  const [localSelectedClinics, setLocalSelectedClinics] = useState<ReferralClinic[]>(selectedClinics);

  // Sync local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalSelectedClinics(selectedClinics);
    }
  }, [isOpen, selectedClinics]);

  const isClinicSelected = (clinicId: string) => {
    return localSelectedClinics.some((c) => c.id === clinicId);
  };

  const toggleClinicSelection = (clinic: ReferralClinic) => {
    setLocalSelectedClinics((prev) => {
      if (prev.some((c) => c.id === clinic.id)) {
        return prev.filter((c) => c.id !== clinic.id);
      } else {
        return [...prev, clinic];
      }
    });
  };

  const handleConfirmSelection = () => {
    onSelect(localSelectedClinics);
    onClose();
  };

  // Get all unique specialties from clinics
  const allSpecialties = useMemo(() => {
    if (!clinics) return [];
    const specialtySet = new Set<string>();
    clinics.forEach((clinic) => {
      clinic.specialties?.forEach((s) => specialtySet.add(s));
    });
    return Array.from(specialtySet).sort();
  }, [clinics]);

  // Filter clinics based on search and specialty filter
  const filteredClinics = useMemo(() => {
    if (!clinics) return [];

    return clinics
      .filter((clinic) => clinic.isActive)
      .filter((clinic) => {
        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const matchesName = clinic.practiceName.toLowerCase().includes(query);
          const matchesAddress = clinic.address?.toLowerCase().includes(query);
          const matchesSpecialty = clinic.specialties?.some((s) =>
            s.toLowerCase().includes(query)
          );
          const matchesNotes = clinic.notes?.toLowerCase().includes(query);
          if (!matchesName && !matchesAddress && !matchesSpecialty && !matchesNotes) {
            return false;
          }
        }

        // Specialty filter
        if (selectedSpecialty) {
          if (!clinic.specialties?.includes(selectedSpecialty)) {
            return false;
          }
        }

        return true;
      });
  }, [clinics, searchQuery, selectedSpecialty]);

  // Parse client conditions to highlight matching specialties
  const conditionKeywords = useMemo(() => {
    if (!clientConditions) return [];
    return clientConditions.toLowerCase().split(/[\s,;]+/).filter((w) => w.length > 3);
  }, [clientConditions]);

  const isSpecialtyRelevant = (specialty: string) => {
    const specialtyLower = specialty.toLowerCase();
    return conditionKeywords.some((keyword) => specialtyLower.includes(keyword));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-b px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Select Referral Clinics
              </h2>
              <p className="text-sm text-gray-500">
                Select one or more clinics to include in the referral email
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search and Filters */}
          <div className="border-b px-6 py-4 space-y-3 flex-shrink-0">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search clinics by name, address, specialty, or notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>

            {/* Specialty Filter Pills */}
            {allSpecialties.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-gray-500 py-1">Filter by specialty:</span>
                {allSpecialties.slice(0, 10).map((specialty) => (
                  <button
                    key={specialty}
                    onClick={() =>
                      setSelectedSpecialty(selectedSpecialty === specialty ? null : specialty)
                    }
                    className={`px-3 py-1 text-sm rounded-full transition-colors ${
                      selectedSpecialty === specialty
                        ? "bg-amber-500 text-white"
                        : isSpecialtyRelevant(specialty)
                        ? "bg-green-100 text-green-700 border border-green-300 hover:bg-green-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {specialty}
                    {isSpecialtyRelevant(specialty) && selectedSpecialty !== specialty && (
                      <span className="ml-1 text-xs">★</span>
                    )}
                  </button>
                ))}
                {allSpecialties.length > 10 && (
                  <span className="text-sm text-gray-400 py-1">
                    +{allSpecialties.length - 10} more
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Clinic Table */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              </div>
            ) : filteredClinics.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600 font-medium">No clinics found</p>
                <p className="text-sm text-gray-500 mt-1">
                  {searchQuery || selectedSpecialty
                    ? "Try adjusting your search or filters"
                    : "Add referral clinics in Settings"}
                </p>
                {!searchQuery && !selectedSpecialty && (
                  <Link
                    href="/settings"
                    className="inline-block mt-3 text-sm text-blue-600 hover:underline"
                  >
                    Go to Settings
                  </Link>
                )}
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="border-b">
                    <th className="w-10 px-4 py-3"></th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Clinic Name
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Address
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Specialties
                    </th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredClinics.map((clinic) => {
                    const isSelected = isClinicSelected(clinic.id);
                    const isExpanded = clinic.id === expandedClinicId;

                    return (
                      <Fragment key={clinic.id}>
                        <tr
                          onClick={() => toggleClinicSelection(clinic)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-amber-50 hover:bg-amber-100"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleClinicSelection(clinic)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {clinic.practiceName}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {clinic.address ? (
                              <span className="text-sm text-gray-600">{clinic.address}</span>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm space-y-0.5">
                              {clinic.phone && (
                                <div className="flex items-center gap-1.5 text-gray-600">
                                  <Phone className="w-3 h-3 text-gray-400" />
                                  {clinic.phone}
                                </div>
                              )}
                              {clinic.email && (
                                <div className="flex items-center gap-1.5 text-gray-600">
                                  <Mail className="w-3 h-3 text-gray-400" />
                                  <span className="truncate max-w-[150px]">{clinic.email}</span>
                                </div>
                              )}
                              {!clinic.phone && !clinic.email && (
                                <span className="text-gray-400">—</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {clinic.specialties && clinic.specialties.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {clinic.specialties.slice(0, 3).map((specialty, i) => (
                                  <span
                                    key={i}
                                    className={`px-2 py-0.5 text-xs rounded ${
                                      isSpecialtyRelevant(specialty)
                                        ? "bg-green-100 text-green-700 font-medium"
                                        : "bg-gray-100 text-gray-600"
                                    }`}
                                  >
                                    {specialty}
                                    {isSpecialtyRelevant(specialty) && " ★"}
                                  </span>
                                ))}
                                {clinic.specialties.length > 3 && (
                                  <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
                                    +{clinic.specialties.length - 3}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {clinic.notes && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedClinicId(isExpanded ? null : clinic.id);
                                }}
                                className={`p-1.5 rounded transition-colors ${
                                  isExpanded
                                    ? "text-amber-600 bg-amber-100"
                                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                                }`}
                                title="View notes"
                              >
                                <StickyNote className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                        {/* Expanded Notes Row */}
                        {isExpanded && clinic.notes && (
                          <tr className="bg-gray-50">
                            <td colSpan={5} className="px-4 py-3">
                              <div className="p-3 bg-white rounded-lg border border-gray-200">
                                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-1">
                                  <StickyNote className="w-3 h-3" />
                                  Notes
                                </div>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                  {clinic.notes}
                                </p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div className="border-t px-6 py-4 flex items-center justify-between bg-gray-50 rounded-b-xl flex-shrink-0">
            <div className="text-sm text-gray-500">
              {filteredClinics.length} clinic{filteredClinics.length !== 1 ? "s" : ""} found
              {localSelectedClinics.length > 0 && (
                <span className="ml-2 text-amber-600 font-medium">
                  • {localSelectedClinics.length} selected
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSelection}
                disabled={localSelectedClinics.length === 0}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Selection
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ReadingPaneProps {
  client: Client;
  selectedTemplate: EmailTemplate | null;
  selectedClinics: ReferralClinic[];
  onSelectTemplate: (template: EmailTemplate | null) => void;
  onSelectClinics: (clinics: ReferralClinic[]) => void;
  onClose: () => void;
  onCloseCase: () => void;
  onReferralSent: (clinicNames: string[]) => void;
}

function ReadingPane({
  client,
  selectedTemplate,
  selectedClinics,
  onSelectTemplate,
  onSelectClinics,
  onClose,
  onCloseCase,
  onReferralSent,
}: ReadingPaneProps) {
  const { data: templates, isLoading: templatesLoading } = useReferralTemplates();
  const previewMutation = usePreviewTemplate();
  const sendEmailMutation = useSendEmail();
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [clinicModalOpen, setClinicModalOpen] = useState(false);
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

  const canPreview = selectedTemplate && selectedClinics.length > 0;

  // Build clinic information block for the email
  const buildClinicInfoBlock = (clinics: ReferralClinic[]): string => {
    if (clinics.length === 0) return "";

    const clinicBlocks = clinics.map((clinic) => {
      const lines = [`<strong>${clinic.practiceName}</strong>`];
      if (clinic.address) lines.push(clinic.address);
      if (clinic.phone) lines.push(`Phone: ${clinic.phone}`);
      if (clinic.email) lines.push(`Email: ${clinic.email}`);
      if (clinic.specialties && clinic.specialties.length > 0) {
        lines.push(`Specialties: ${clinic.specialties.join(", ")}`);
      }
      return lines.join("<br>");
    });

    return `<hr style="border: none; border-top: 2px solid #d1d5db; margin: 24px 0;"><p style="color: #6b7280; font-weight: 600; margin-bottom: 16px;">Recommended Provider${clinics.length > 1 ? "s" : ""}:</p>${clinicBlocks.join("<br><br>")}`;
  };

  const handlePreviewEmail = async () => {
    if (!selectedTemplate || selectedClinics.length === 0) return;

    try {
      // Use the first clinic for template variables (for backwards compatibility)
      const primaryClinic = selectedClinics[0];

      const result = await previewMutation.mutateAsync({
        templateId: selectedTemplate.id,
        variables: {
          // Required fields
          clientFirstName: client.firstName,
          clientLastName: client.lastName,
          clientEmail: client.email,
          practiceName: "Therapy Practice", // Will be overridden by settings in actual send
          // Optional client fields
          clientPhone: client.phone || undefined,
          clientAge: client.age || undefined,
          presentingConcerns: client.presentingConcerns || undefined,
          paymentType: client.paymentType || undefined,
          insuranceProvider: client.insuranceProvider || undefined,
          // Referral clinic fields (primary clinic for template variables)
          referralClinicName: primaryClinic.practiceName,
          referralClinicPhone: primaryClinic.phone || undefined,
          referralClinicEmail: primaryClinic.email || undefined,
          referralClinicAddress: primaryClinic.address || undefined,
          referralClinicSpecialties: primaryClinic.specialties.join(", ") || undefined,
        },
      });

      // Append clinic information block after the template body
      const clinicInfoBlock = buildClinicInfoBlock(selectedClinics);
      const fullBody = result.body + clinicInfoBlock;

      setEditedTo(client.email);
      setEditedCc("");
      setEditedBcc("");
      setEditedSubject(result.subject);
      setEditedBody(fullBody);
      setAttachments([]);
      setSendSuccess(false);
      setIsEditing(false);
      setShowEmailPreview(true);
    } catch (error) {
      console.error("Failed to preview email:", error);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: EmailAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Check file size (max 10MB per file)
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
    // Reset input
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

      // Notify parent that referral was sent
      onReferralSent(selectedClinics.map((c) => c.practiceName));

      addToast({
        type: "success",
        title: "Email sent",
        message: `Referral email sent to ${editedTo}`,
      });

      // Close after a brief delay (don't auto-process - let user close when ready)
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-semibold text-lg">
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

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b bg-white">
        <span className="text-sm font-medium text-gray-700">Compose Referral:</span>

        {/* Template Selector */}
        <Dropdown
          label="Select Template"
          icon={<FileEdit className="w-4 h-4" />}
          selectedLabel={selectedTemplate?.name}
          isOpen={templateDropdownOpen}
          onToggle={() => {
            setTemplateDropdownOpen(!templateDropdownOpen);
          }}
        >
          {templatesLoading ? (
            <div className="p-4 text-center">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400" />
            </div>
          ) : !templates || templates.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">
              <p>No referral templates available.</p>
              <Link href="/templates" className="text-blue-600 hover:underline">
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
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => {
                    onSelectTemplate(template);
                    setTemplateDropdownOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center justify-between ${
                    selectedTemplate?.id === template.id ? "bg-amber-50" : ""
                  }`}
                >
                  <div>
                    <div className="font-medium text-gray-900">{template.name}</div>
                    <div className="text-xs text-gray-500 truncate max-w-[200px]">
                      {template.subject}
                    </div>
                  </div>
                  {selectedTemplate?.id === template.id && (
                    <Check className="w-4 h-4 text-amber-600" />
                  )}
                </button>
              ))}
            </div>
          )}
        </Dropdown>

        {/* Clinic Selector Button */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setTemplateDropdownOpen(false);
            setClinicModalOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setTemplateDropdownOpen(false);
              setClinicModalOpen(true);
            }
          }}
          className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors cursor-pointer ${
            selectedClinics.length > 0
              ? "bg-amber-50 border-amber-300 text-amber-700"
              : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span className="max-w-[200px] truncate">
            {selectedClinics.length === 0
              ? "Select Clinics"
              : selectedClinics.length === 1
              ? selectedClinics[0].practiceName
              : `${selectedClinics.length} clinics selected`}
          </span>
          {selectedClinics.length > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectClinics([]);
              }}
              className="ml-1 p-0.5 hover:bg-amber-200 rounded"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex-1" />

        {/* Clinic Selector Modal */}
        <ClinicSelectorModal
          isOpen={clinicModalOpen}
          onClose={() => setClinicModalOpen(false)}
          onSelect={onSelectClinics}
          selectedClinics={selectedClinics}
          clientConditions={client.presentingConcerns || client.referralReason}
        />

        {/* Process Referral Button - only shown when both template and clinic are selected */}
        {canPreview && (
          <button
            onClick={handlePreviewEmail}
            disabled={previewMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            {previewMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Process Referral
          </button>
        )}

        {/* Close Case Button */}
        <button
          onClick={onCloseCase}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
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
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Additional Information
            </h3>
            {client.additionalInfo ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {client.additionalInfo}
              </p>
            ) : (
              <p className="text-sm text-gray-400 italic">No additional information provided</p>
            )}
          </div>

          {/* Referral Reason */}
          {client.referralReason && (
            <div className="bg-amber-50 rounded-lg border border-amber-200 p-4 lg:col-span-2">
              <h3 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Reason for Referral
              </h3>
              <p className="text-sm text-amber-900 whitespace-pre-wrap">
                {client.referralReason}
              </p>
            </div>
          )}

          {/* Clinical Flags */}
          {(client.suicideAttemptRecent || client.psychiatricHospitalization) && (
            <div className="bg-red-50 rounded-lg border border-red-200 p-4 lg:col-span-2">
              <h3 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Clinical Flags
              </h3>
              <div className="space-y-2 text-sm">
                {client.suicideAttemptRecent && (
                  <div className="flex items-center gap-2 text-red-700">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    Recent suicide attempt reported
                  </div>
                )}
                {client.psychiatricHospitalization && (
                  <div className="flex items-center gap-2 text-red-700">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    Psychiatric hospitalization history
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Email Preview Modal */}
      {showEmailPreview && previewMutation.data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !sendEmailMutation.isPending && setShowEmailPreview(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-gray-900">
                  {sendSuccess ? "Email Sent!" : isEditing ? "Edit Email" : "Preview Referral Email"}
                </h2>
                {!sendSuccess && (
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className={`px-3 py-1 text-sm rounded-full transition-colors ${
                      isEditing
                        ? "bg-amber-100 text-amber-700"
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
                    The referral email has been sent to {editedTo}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Email Fields */}
                  <div className="space-y-3">
                    {/* To */}
                    <div className="flex items-center gap-3">
                      <label className="w-16 text-sm font-medium text-gray-500">To:</label>
                      {isEditing ? (
                        <input
                          type="email"
                          value={editedTo}
                          onChange={(e) => setEditedTo(e.target.value)}
                          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          placeholder="recipient@example.com"
                        />
                      ) : (
                        <span className="text-sm text-gray-900">{editedTo}</span>
                      )}
                    </div>

                    {/* CC */}
                    <div className="flex items-center gap-3">
                      <label className="w-16 text-sm font-medium text-gray-500">CC:</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedCc}
                          onChange={(e) => setEditedCc(e.target.value)}
                          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          placeholder="Separate multiple emails with commas"
                        />
                      ) : (
                        <span className="text-sm text-gray-500">
                          {editedCc || <span className="italic">None</span>}
                        </span>
                      )}
                    </div>

                    {/* BCC */}
                    <div className="flex items-center gap-3">
                      <label className="w-16 text-sm font-medium text-gray-500">BCC:</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedBcc}
                          onChange={(e) => setEditedBcc(e.target.value)}
                          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                          placeholder="Separate multiple emails with commas"
                        />
                      ) : (
                        <span className="text-sm text-gray-500">
                          {editedBcc || <span className="italic">None</span>}
                        </span>
                      )}
                    </div>

                    {/* Subject */}
                    <div className="flex items-center gap-3">
                      <label className="w-16 text-sm font-medium text-gray-500">Subject:</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editedSubject}
                          onChange={(e) => setEditedSubject(e.target.value)}
                          className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      ) : (
                        <span className="text-sm text-gray-900 font-medium">{editedSubject}</span>
                      )}
                    </div>
                  </div>

                  {/* Referral Info Summary */}
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <div className="text-sm text-amber-800">
                      <strong>Referring to:</strong>{" "}
                      {selectedClinics.length === 1
                        ? `${selectedClinics[0].practiceName}${selectedClinics[0].phone ? ` • ${selectedClinics[0].phone}` : ""}`
                        : `${selectedClinics.length} clinics`}
                    </div>
                    {selectedClinics.length > 1 && (
                      <ul className="mt-2 text-xs text-amber-700 space-y-1">
                        {selectedClinics.map((clinic) => (
                          <li key={clinic.id} className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                            {clinic.practiceName}
                          </li>
                        ))}
                      </ul>
                    )}
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
                        dangerouslySetInnerHTML={{ __html: editedBody }}
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
                          className="flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700"
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
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
  referralWasSent: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

function CloseConfirmModal({
  client,
  isOpen,
  referralWasSent,
  onConfirm,
  onCancel,
  isLoading,
}: CloseConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onCancel} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-xl shadow-2xl max-w-md w-full"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            <div className={`w-12 h-12 rounded-full ${referralWasSent ? "bg-green-100" : "bg-amber-100"} flex items-center justify-center mx-auto mb-4`}>
              {referralWasSent ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <AlertCircle className="w-6 h-6 text-amber-600" />
              )}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
              {referralWasSent ? "Close Referral" : "Close Without Sending?"}
            </h3>
            <p className="text-sm text-gray-600 text-center mb-6">
              {referralWasSent ? (
                <>
                  Are you sure you want to close the referral for{" "}
                  <span className="font-medium">{client.firstName} {client.lastName}</span>?
                  This will mark them as referred.
                </>
              ) : (
                <>
                  No referral email was sent to{" "}
                  <span className="font-medium">{client.firstName} {client.lastName}</span>.
                  Are you sure you want to close this referral without sending an email?
                </>
              )}
            </p>
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
                  referralWasSent
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Closing...
                  </>
                ) : (
                  <>
                    {referralWasSent ? "Close" : "Close Anyway"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReferralsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: clients, isLoading, error, refetch } = useClients();

  // Selected client for reading pane
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Selected template and clinics for referral email composition
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [selectedClinics, setSelectedClinics] = useState<ReferralClinic[]>([]);

  // Close confirmation modal state
  const [closeConfirmClient, setCloseConfirmClient] = useState<Client | null>(null);

  // Closed cases section state
  const [showClosedSection, setShowClosedSection] = useState(false);
  const { data: closedReferrals, isLoading: closedLoading, refetch: refetchClosed } = useClosedClients("referral");
  const [previewClientId, setPreviewClientId] = useState<string | null>(null);

  // Update client hook for closing referrals
  const updateClient = useUpdateClient();
  const { addToast } = useToast();

  // Filter for pending_referral status
  const pendingReferrals = clients?.filter(
    (client) =>
      client.status === "pending_referral" &&
      (searchQuery === "" ||
        `${client.firstName} ${client.lastName}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        client.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Also get referred clients for stats
  const referredClients = clients?.filter((client) => client.status === "referred");

  // Get the selected client object
  const selectedClient = pendingReferrals?.find((c) => c.id === selectedClientId);

  const handleClientClick = (client: Client) => {
    if (client.id !== selectedClientId) {
      // Reset selections when switching clients
      setSelectedTemplate(null);
      setSelectedClinics([]);
    }
    setSelectedClientId(client.id);
  };

  const handleDoubleClick = (client: Client) => {
    // Double-click selects the client (same as single click)
    setSelectedClientId(client.id);
  };

  // Handler when a closed case is reopened
  const handleReopenSuccess = () => {
    refetch();
    refetchClosed();
  };

  // Mark a referral as sent (called when email is successfully sent)
  const markReferralSent = async (clientId: string, clinicNames: string[]) => {
    try {
      // Persist to database
      await updateClient.mutateAsync({
        id: clientId,
        data: {
          referralEmailSentAt: new Date().toISOString(),
          referralClinicNames: clinicNames.join(", "),
        },
      });
      // Refetch to update UI
      refetch();
    } catch (error) {
      console.error("Failed to save referral sent status:", error);
    }
  };

  // Handle close button click - shows confirmation
  const handleCloseClick = (client: Client) => {
    setCloseConfirmClient(client);
  };

  // Confirm close - update status and remove from list
  const handleConfirmClose = async () => {
    if (!closeConfirmClient) return;

    try {
      await updateClient.mutateAsync({
        id: closeConfirmClient.id,
        data: {
          status: "referred",
          closedDate: new Date().toISOString(),
          closedReason: closeConfirmClient.referralEmailSentAt
            ? "referral_sent"
            : "closed_without_referral",
          closedFromWorkflow: "referral",
          closedFromStatus: closeConfirmClient.status,
        },
      });

      addToast({
        type: "success",
        title: "Referral closed",
        message: `${closeConfirmClient.firstName} ${closeConfirmClient.lastName} has been marked as referred.`,
      });

      // Clear selection if this was the selected client
      if (selectedClientId === closeConfirmClient.id) {
        setSelectedClientId(null);
      }

      setCloseConfirmClient(null);
      refetch();
    } catch (error) {
      addToast({
        type: "error",
        title: "Failed to close",
        message: error instanceof Error ? error.message : "Failed to close referral",
      });
    }
  };

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>Failed to load referrals. Please try again.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-white">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Referrals</h1>
          <p className="text-sm text-gray-600">Manage clients pending referral to external providers</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
              <span className="text-gray-600">
                <span className="font-semibold text-amber-600">{pendingReferrals?.length || 0}</span> Pending
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-slate-400 rounded-full"></span>
              <span className="text-gray-600">
                <span className="font-semibold text-slate-600">{referredClients?.length || 0}</span> Referred
              </span>
            </div>
          </div>
          <Link
            href="/settings"
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Building2 className="w-4 h-4" />
            Manage Clinics
          </Link>
        </div>
      </div>

      {/* Main Content - Split View */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Client List (Top Half) */}
        <div className={`bg-white border-b ${selectedClient ? "h-[45%]" : "flex-1"} flex flex-col overflow-hidden transition-all`}>
          {/* Search Bar */}
          <div className="p-3 border-b bg-gray-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search pending referrals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading referrals...</p>
              </div>
            ) : pendingReferrals?.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600 font-medium">No pending referrals</p>
                <p className="text-sm text-gray-500 mt-1">
                  {searchQuery
                    ? "No clients match your search."
                    : "Clients moved to referrals will appear here."}
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {pendingReferrals?.map((client) => (
                  <ClientRow
                    key={client.id}
                    client={client}
                    isSelected={client.id === selectedClientId}
                    onClick={() => handleClientClick(client)}
                    onDoubleClick={() => handleDoubleClick(client)}
                    onClose={() => handleCloseClick(client)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Reading Pane (Bottom Half) */}
        {selectedClient && (
          <div className="h-[55%] border-t bg-white overflow-hidden">
            <ReadingPane
              client={selectedClient}
              selectedTemplate={selectedTemplate}
              selectedClinics={selectedClinics}
              onSelectTemplate={setSelectedTemplate}
              onSelectClinics={setSelectedClinics}
              onClose={() => setSelectedClientId(null)}
              onCloseCase={() => setCloseConfirmClient(selectedClient)}
              onReferralSent={(clinicNames) => markReferralSent(selectedClient.id, clinicNames)}
            />
          </div>
        )}

        {/* Closed Cases Section - Always visible at bottom */}
        <ClosedCasesSection
          clients={closedReferrals}
          workflow="referral"
          isExpanded={showClosedSection}
          onToggle={() => setShowClosedSection(!showClosedSection)}
          isLoading={closedLoading}
          onClientClick={(client) => setPreviewClientId(client.id)}
          onReopenSuccess={handleReopenSuccess}
        />
      </div>

      {/* Close Confirmation Modal */}
      {closeConfirmClient && (
        <CloseConfirmModal
          client={closeConfirmClient}
          isOpen={!!closeConfirmClient}
          referralWasSent={!!closeConfirmClient.referralEmailSentAt}
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
