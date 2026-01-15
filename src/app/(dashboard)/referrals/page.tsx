"use client";

import { useState, useRef, useEffect, useMemo, Fragment } from "react";
import { useClients, useUpdateClient } from "@/hooks/use-clients";
import { useReferralClinics } from "@/hooks/use-referral-clinics";
import { useReferralTemplates } from "@/hooks/use-templates";
import { Client, EmailTemplate, ReferralClinic } from "@/types/client";
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
} from "lucide-react";
import { useToast } from "@/components/ui/toast";

function ClientRow({
  client,
  isSelected,
  onClick,
  onDoubleClick,
}: {
  client: Client;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  return (
    <div
      className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${
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
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-medium text-sm flex-shrink-0">
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

      <div className="flex items-center gap-4 flex-shrink-0">
        {client.referralReason && (
          <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded max-w-[150px] truncate hidden lg:block">
            {client.referralReason}
          </div>
        )}
        <div className="text-xs text-gray-500">{formatRelativeTime(client.createdAt)}</div>
      </div>
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
  onSelect: (clinic: ReferralClinic) => void;
  selectedClinicId?: string;
  clientConditions?: string; // For highlighting relevant specialties
}

function ClinicSelectorModal({
  isOpen,
  onClose,
  onSelect,
  selectedClinicId,
  clientConditions,
}: ClinicSelectorModalProps) {
  const { data: clinics, isLoading } = useReferralClinics();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [expandedClinicId, setExpandedClinicId] = useState<string | null>(null);

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
                Select Referral Clinic
              </h2>
              <p className="text-sm text-gray-500">
                Click a row to select a clinic
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
                    const isSelected = clinic.id === selectedClinicId;
                    const isExpanded = clinic.id === expandedClinicId;

                    return (
                      <Fragment key={clinic.id}>
                        <tr
                          onClick={() => {
                            onSelect(clinic);
                            onClose();
                          }}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-amber-50 hover:bg-amber-100"
                              : "hover:bg-gray-50"
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {clinic.practiceName}
                              </span>
                              {isSelected && (
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500 text-white text-xs rounded-full">
                                  <Check className="w-3 h-3" />
                                </span>
                              )}
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
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ReadingPaneProps {
  client: Client;
  selectedTemplate: EmailTemplate | null;
  selectedClinic: ReferralClinic | null;
  onSelectTemplate: (template: EmailTemplate | null) => void;
  onSelectClinic: (clinic: ReferralClinic | null) => void;
  onProcessReferral: () => void;
  onClose: () => void;
}

function ReadingPane({
  client,
  selectedTemplate,
  selectedClinic,
  onSelectTemplate,
  onSelectClinic,
  onProcessReferral,
  onClose,
}: ReadingPaneProps) {
  const { data: templates, isLoading: templatesLoading } = useReferralTemplates();
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [clinicModalOpen, setClinicModalOpen] = useState(false);

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
        <button
          onClick={() => {
            setTemplateDropdownOpen(false);
            setClinicModalOpen(true);
          }}
          className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
            selectedClinic
              ? "bg-amber-50 border-amber-300 text-amber-700"
              : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span className="max-w-[150px] truncate">
            {selectedClinic?.practiceName || "Select Clinic"}
          </span>
          {selectedClinic && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectClinic(null);
              }}
              className="ml-1 p-0.5 hover:bg-amber-200 rounded"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </button>

        <div className="flex-1" />

        {/* Clinic Selector Modal */}
        <ClinicSelectorModal
          isOpen={clinicModalOpen}
          onClose={() => setClinicModalOpen(false)}
          onSelect={onSelectClinic}
          selectedClinicId={selectedClinic?.id}
          clientConditions={client.presentingConcerns || client.referralReason}
        />

        <button
          onClick={onProcessReferral}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
        >
          <CheckCircle className="w-4 h-4" />
          Process Referral
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
    </div>
  );
}

interface ReferralModalProps {
  client: Client;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

function ReferralModal({ client, isOpen, onClose, onComplete }: ReferralModalProps) {
  const { data: clinics, isLoading: clinicsLoading } = useReferralClinics();
  const updateClient = useUpdateClient();
  const { addToast } = useToast();
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  const [notes, setNotes] = useState(client.referralReason || "");

  if (!isOpen) return null;

  const activeClinics = (clinics || []).filter((c) => c.isActive);
  const selectedClinic = activeClinics.find((c) => c.id === selectedClinicId);

  const handleReferral = async () => {
    if (!selectedClinicId) {
      addToast({
        type: "error",
        title: "No clinic selected",
        message: "Please select a referral clinic.",
      });
      return;
    }

    try {
      await updateClient.mutateAsync({
        id: client.id,
        data: {
          status: "referred",
          referralReason: notes,
          evaluationNotes: `Referred to: ${selectedClinic?.practiceName}`,
        },
      });

      addToast({
        type: "success",
        title: "Referral Complete",
        message: `${client.firstName} ${client.lastName} has been referred to ${selectedClinic?.practiceName}.`,
      });

      onComplete();
      onClose();
    } catch (error) {
      addToast({
        type: "error",
        title: "Referral failed",
        message: error instanceof Error ? error.message : "Failed to complete referral",
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-b px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Refer Client
              </h2>
              <p className="text-sm text-gray-500">
                {client.firstName} {client.lastName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Referral Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for Referral
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe why this client is being referred..."
                rows={3}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            {/* Clinic Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Referral Clinic
              </label>
              {clinicsLoading ? (
                <div className="text-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                </div>
              ) : activeClinics.length === 0 ? (
                <div className="text-center py-4 bg-gray-50 rounded-lg">
                  <Building2 className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-gray-600">No referral clinics configured.</p>
                  <Link
                    href="/settings"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Add clinics in Settings
                  </Link>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {activeClinics.map((clinic) => (
                    <label
                      key={clinic.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedClinicId === clinic.id
                          ? "border-amber-300 bg-amber-50"
                          : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="clinic"
                        value={clinic.id}
                        checked={selectedClinicId === clinic.id}
                        onChange={(e) => setSelectedClinicId(e.target.value)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{clinic.practiceName}</div>
                        {clinic.address && (
                          <div className="text-sm text-gray-500">{clinic.address}</div>
                        )}
                        {clinic.specialties.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {clinic.specialties.slice(0, 4).map((specialty, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs"
                              >
                                {specialty}
                              </span>
                            ))}
                            {clinic.specialties.length > 4 && (
                              <span className="text-xs text-gray-500">
                                +{clinic.specialties.length - 4} more
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          {clinic.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {clinic.phone}
                            </span>
                          )}
                          {clinic.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {clinic.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t px-6 py-4 flex items-center justify-between bg-gray-50 rounded-b-xl">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleReferral}
              disabled={!selectedClinicId || updateClient.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              {updateClient.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Complete Referral
                </>
              )}
            </button>
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

  // Modal state for referral processing
  const [referralClient, setReferralClient] = useState<Client | null>(null);

  // Selected template and clinic for referral email composition
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [selectedClinic, setSelectedClinic] = useState<ReferralClinic | null>(null);

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
      setSelectedClinic(null);
    }
    setSelectedClientId(client.id);
  };

  const handleDoubleClick = (client: Client) => {
    setReferralClient(client);
  };

  const handleReferralComplete = () => {
    setSelectedClientId(null);
    refetch();
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
              selectedClinic={selectedClinic}
              onSelectTemplate={setSelectedTemplate}
              onSelectClinic={setSelectedClinic}
              onProcessReferral={() => setReferralClient(selectedClient)}
              onClose={() => setSelectedClientId(null)}
            />
          </div>
        )}
      </div>

      {/* Referral Modal */}
      {referralClient && (
        <ReferralModal
          client={referralClient}
          isOpen={!!referralClient}
          onClose={() => setReferralClient(null)}
          onComplete={handleReferralComplete}
        />
      )}
    </div>
  );
}
