"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useClients, useUpdateClient, useClosedClients } from "@/hooks/use-clients";
import { useTemplates, usePreviewTemplate } from "@/hooks/use-templates";
import { useSendEmail, EmailAttachment } from "@/hooks/use-emails";
import { useClinicians } from "@/hooks/use-clinicians";
import {
  useAvailabilityFromSheets,
  useBookedSlots,
  useCreateBookedSlot,
  matchesInsurance,
} from "@/hooks/use-availability-sheets";
import { Client, EmailTemplate, ClientStatus, SheetAvailabilitySlot, OfferedSlot, AcceptedSlot, BookedSlot } from "@/types/client";
import {
  computeClinicianStats,
  sortClinicianStats,
  ClinicianStats,
  getDayCounts,
  getInsuranceMatchCount,
  getTotalAvailableCount,
  TIME_RANGES,
  TimeRange,
} from "@/lib/availability-analytics";
import {
  selectRandomSlots,
  selectRandomTimesForClinician,
  selectRandomSlotsForDays,
  SelectedSlotInfo,
  filterSlots,
} from "@/lib/availability-random";
import { ClosedCasesSection } from "@/components/clients/closed-cases-section";
import { ClientPreviewModal } from "@/components/clients/client-preview-modal";
import { RichTextEditor } from "@/components/templates/rich-text-editor";
import { OutreachDashboard, ClientCommunications } from "@/components/outreach";
import {
  useOutreachAttempts,
  useInitializeOutreachAttempts,
  useUpdateOutreachAttempt,
} from "@/hooks/use-outreach-attempts";
import { formatRelativeTime, formatDate, cn } from "@/lib/utils";
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
  Shield,
  RefreshCw,
  RefreshCcw,
  Shuffle,
  Sparkles,
  Filter,
  ChevronRight,
  MessageCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";

// Outreach workflow statuses
const OUTREACH_STATUSES: ClientStatus[] = [
  "pending_outreach",
  "outreach_sent",
  "follow_up_1",
  "follow_up_2",
  // New automated outreach statuses
  "awaiting_response",
  "follow_up_due",
  "no_contact_ok_close",
  "in_communication",
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

// Get suggested template type based on outreach attempts
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

// Get suggested template type based on outreach attempts (more accurate)
function getSuggestedTemplateTypeFromAttempts(attempts: { attemptNumber: number; status: string }[]): string | null {
  // Find the next pending attempt
  const nextPending = attempts.find((a) => a.status === "pending");
  if (!nextPending) {
    // All attempts sent - no template suggestion
    return null;
  }

  // Map attempt number to template type
  if (nextPending.attemptNumber === 1) {
    return "initial_outreach";
  } else if (nextPending.attemptNumber === 2) {
    return "follow_up_1";
  } else if (nextPending.attemptNumber === 3) {
    return "follow_up_2";
  }
  // For attempts > 3, reuse follow_up_2 template
  return "follow_up_2";
}

// Get attempt label for UI display
function getAttemptDisplayLabel(attemptNumber: number): string {
  if (attemptNumber === 1) return "Initial Outreach";
  return `Follow-up #${attemptNumber - 1}`;
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

// Availability Modal Component - Uses real data from Google Sheets with Smart Select
interface AvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertAvailability: (availabilityText: string, selectedSlots: SelectedSlotInfo[]) => void;
  client: Client;
}

function AvailabilityModal({ isOpen, onClose, onInsertAvailability, client }: AvailabilityModalProps) {
  const { data: slots, isLoading: slotsLoading, refetch, isFetching } = useAvailabilityFromSheets();
  const { data: bookedSlots } = useBookedSlots();

  // Tab state
  const [activeTab, setActiveTab] = useState<"smart" | "browse">("smart");

  // Selection state
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlotInfo[]>([]);

  // Smart Select filters
  const [selectedClinicians, setSelectedClinicians] = useState<Set<string>>(new Set());
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange | "all">("all");
  const [selectedSpecificTime, setSelectedSpecificTime] = useState<string>(""); // Specific time like "9:00 AM"
  const [onlyInsuranceMatch, setOnlyInsuranceMatch] = useState(true);
  const [excludeOffered, setExcludeOffered] = useState(false);

  // Random picker state
  const [randomMode, setRandomMode] = useState<"full" | "by-clinician" | "by-day">("full");
  const [randomCount, setRandomCount] = useState(3);
  const [randomClinician, setRandomClinician] = useState<string>("");
  const [randomDays, setRandomDays] = useState<Set<string>>(new Set());

  // Clinician sorting
  const [clinicianSort, setClinicianSort] = useState<"availability" | "alpha" | "insurance">("availability");

  // Browse tab filters
  const [searchQuery, setSearchQuery] = useState("");
  const [insuranceFilter, setInsuranceFilter] = useState<"all" | "matching">("matching");

  // Parse client's previously offered slots
  const previouslyOffered = useMemo(() => {
    if (!client.offeredAvailability) return new Set<string>();
    try {
      const offered: OfferedSlot[] = JSON.parse(client.offeredAvailability);
      return new Set(offered.map((o) => o.slotId));
    } catch {
      return new Set<string>();
    }
  }, [client.offeredAvailability]);

  // Computed statistics
  const clinicianStats = useMemo(() => {
    if (!slots || !bookedSlots) return [];
    return sortClinicianStats(
      computeClinicianStats(slots, bookedSlots, client.requestedClinician, client.insuranceProvider),
      clinicianSort
    );
  }, [slots, bookedSlots, client.requestedClinician, client.insuranceProvider, clinicianSort]);

  const dayCounts = useMemo(() => {
    if (!slots || !bookedSlots) return {};
    return getDayCounts(slots, bookedSlots);
  }, [slots, bookedSlots]);

  const insuranceMatchCount = useMemo(() => {
    if (!slots || !bookedSlots) return 0;
    return getInsuranceMatchCount(slots, bookedSlots, client.insuranceProvider);
  }, [slots, bookedSlots, client.insuranceProvider]);

  const totalAvailableCount = useMemo(() => {
    if (!slots || !bookedSlots) return 0;
    return getTotalAvailableCount(slots, bookedSlots);
  }, [slots, bookedSlots]);

  // Available days from data
  const availableDays = useMemo(() => {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    return days.filter(day => dayCounts[day] > 0);
  }, [dayCounts]);

  // Unique times from availability data (sorted)
  const uniqueTimes = useMemo(() => {
    if (!slots) return [];
    const timeSet = new Set<string>();
    slots.forEach(slot => timeSet.add(slot.time));
    // Sort times chronologically
    return Array.from(timeSet).sort((a, b) => {
      const parseTime = (t: string) => {
        const match = t.match(/(\d+):?(\d*)\s*(AM|PM)?/i);
        if (!match) return 0;
        let hour = parseInt(match[1], 10);
        const isPM = match[3]?.toUpperCase() === "PM";
        if (isPM && hour !== 12) hour += 12;
        else if (!isPM && hour === 12) hour = 0;
        return hour;
      };
      return parseTime(a) - parseTime(b);
    });
  }, [slots]);

  // Check if requested clinician has any availability
  const requestedClinicianHasAvailability = useMemo(() => {
    if (!client.requestedClinician || !clinicianStats.length) return true;
    const stat = clinicianStats.find(
      s => s.name.toLowerCase() === client.requestedClinician?.toLowerCase()
    );
    return stat ? stat.availableSlots > 0 : false;
  }, [client.requestedClinician, clinicianStats]);

  // Filter slots for Browse tab
  const filteredSlots = useMemo(() => {
    if (!slots) return [];

    return slots.filter((slot) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          slot.day.toLowerCase().includes(query) ||
          slot.time.toLowerCase().includes(query) ||
          slot.clinicians.some((c) => c.toLowerCase().includes(query)) ||
          slot.insurance.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      if (insuranceFilter === "matching" && client.insuranceProvider) {
        if (!matchesInsurance(slot, client.insuranceProvider)) return false;
      }

      return true;
    });
  }, [slots, searchQuery, insuranceFilter, client.insuranceProvider]);

  // Filtered slots for Smart Select matching slots display
  const matchingSlots = useMemo(() => {
    if (!slots || !bookedSlots) return [];

    const hasFilters = selectedClinicians.size > 0 || selectedDays.size > 0 || selectedTimeRange !== "all" || selectedSpecificTime !== "";
    if (!hasFilters) return [];

    return filterSlots(slots, bookedSlots, {
      clinicians: selectedClinicians.size > 0 ? Array.from(selectedClinicians) : undefined,
      days: selectedDays.size > 0 ? Array.from(selectedDays) : undefined,
      timeRange: selectedTimeRange !== "all" ? selectedTimeRange : undefined,
      specificTime: selectedSpecificTime || undefined,
      clientInsurance: client.insuranceProvider,
      onlyInsuranceMatch,
      excludeOffered,
      previouslyOffered,
    });
  }, [slots, bookedSlots, selectedClinicians, selectedDays, selectedTimeRange, selectedSpecificTime, client.insuranceProvider, onlyInsuranceMatch, excludeOffered, previouslyOffered]);

  // Toggle clinician filter
  const toggleClinicianFilter = (clinician: string) => {
    setSelectedClinicians(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clinician)) {
        newSet.delete(clinician);
      } else {
        newSet.add(clinician);
      }
      return newSet;
    });
  };

  // Toggle day filter
  const toggleDayFilter = (day: string) => {
    setSelectedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(day)) {
        newSet.delete(day);
      } else {
        newSet.add(day);
      }
      return newSet;
    });
  };

  // Toggle random day selection
  const toggleRandomDay = (day: string) => {
    setRandomDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(day)) {
        newSet.delete(day);
      } else {
        newSet.add(day);
      }
      return newSet;
    });
  };

  // Generate random selection
  const handleGenerateRandom = () => {
    if (!slots || !bookedSlots) return;

    let result: SelectedSlotInfo[] = [];

    switch (randomMode) {
      case "full":
        result = selectRandomSlots(slots, bookedSlots, {
          count: randomCount,
          mode: "full",
          clientInsurance: client.insuranceProvider,
          onlyInsuranceMatch,
          excludeOffered,
          previouslyOffered,
          timeRange: selectedTimeRange !== "all" ? selectedTimeRange : undefined,
        });
        break;
      case "by-clinician":
        if (!randomClinician) return;
        result = selectRandomTimesForClinician(slots, bookedSlots, randomClinician, randomCount, {
          clientInsurance: client.insuranceProvider,
          onlyInsuranceMatch,
          excludeOffered,
          previouslyOffered,
          timeRange: selectedTimeRange !== "all" ? selectedTimeRange : undefined,
        });
        break;
      case "by-day":
        if (randomDays.size === 0) return;
        result = selectRandomSlotsForDays(slots, bookedSlots, Array.from(randomDays), randomCount, {
          clientInsurance: client.insuranceProvider,
          onlyInsuranceMatch,
          excludeOffered,
          previouslyOffered,
          timeRange: selectedTimeRange !== "all" ? selectedTimeRange : undefined,
        });
        break;
    }

    setSelectedSlots(result);
  };

  // Add a slot to selection
  const addSlotToSelection = (slot: SheetAvailabilitySlot, clinician: string) => {
    setSelectedSlots(prev => {
      const existingIndex = prev.findIndex(s => s.slotId === slot.id);
      if (existingIndex === -1) {
        return [...prev, { slotId: slot.id, day: slot.day, time: slot.time, clinicians: [clinician] }];
      }
      const existing = prev[existingIndex];
      if (existing.clinicians.includes(clinician)) {
        return prev;
      }
      const updated = { ...existing, clinicians: [...existing.clinicians, clinician] };
      return [...prev.slice(0, existingIndex), updated, ...prev.slice(existingIndex + 1)];
    });
  };

  // Remove a slot from selection
  const removeSlotFromSelection = (slotId: string) => {
    setSelectedSlots(prev => prev.filter(s => s.slotId !== slotId));
  };

  // Clear all selections
  const clearAllSelections = () => {
    setSelectedSlots([]);
  };

  // Build availability text for email
  const handleInsert = () => {
    if (selectedSlots.length === 0) return;

    const lines: string[] = [];
    selectedSlots.forEach((slot) => {
      const clinicianList = slot.clinicians.join(" or ");
      lines.push(`• ${slot.day} at ${slot.time} with ${clinicianList}`);
    });

    let availabilityText = "";
    if (lines.length === 1) {
      const slot = selectedSlots[0];
      const clinicianList = slot.clinicians.join(" or ");
      availabilityText = `I have availability on ${slot.day} at ${slot.time} with ${clinicianList}.`;
    } else {
      availabilityText = `I have the following availability:\n${lines.join("\n")}`;
    }

    onInsertAvailability(availabilityText, selectedSlots);
    handleClose();
  };

  const handleClose = () => {
    onClose();
    setSearchQuery("");
    setSelectedSlots([]);
    setSelectedClinicians(new Set());
    setSelectedDays(new Set());
    setSelectedTimeRange("all");
    setSelectedSpecificTime("");
    setActiveTab("smart");
  };

  // Check if slot was previously offered
  const wasOffered = (slotId: string) => previouslyOffered.has(slotId);

  if (!isOpen) return null;

  // Handle clicking on requested clinician
  const handleRequestedClinicianClick = () => {
    if (client.requestedClinician) {
      setSelectedClinicians(new Set([client.requestedClinician]));
      setActiveTab("smart");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      {/* Modal - Extra large (50% wider) */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[1800px] h-[95vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-8 py-5 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">Find Availability</h2>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-purple-200">
                  Client: {client.firstName} {client.lastName}
                </span>
                {client.insuranceProvider && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-500/30 text-purple-100">
                    <Shield className="w-4 h-4 mr-1.5" />
                    {client.insuranceProvider}
                  </span>
                )}
                {client.requestedClinician && (
                  <button
                    onClick={handleRequestedClinicianClick}
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm transition-colors cursor-pointer ${
                      requestedClinicianHasAvailability
                        ? "bg-amber-500/40 text-amber-100 hover:bg-amber-500/60"
                        : "bg-red-500/40 text-red-100 hover:bg-red-500/60"
                    }`}
                    title={requestedClinicianHasAvailability
                      ? "Click to filter to this clinician"
                      : "This clinician has no availability - click to see their profile"}
                  >
                    <User className="w-4 h-4 mr-1.5" />
                    Requested: {client.requestedClinician}
                    {!requestedClinicianHasAvailability && (
                      <AlertCircle className="w-4 h-4 ml-1.5" />
                    )}
                    {requestedClinicianHasAvailability && (
                      <ChevronRight className="w-4 h-4 ml-1" />
                    )}
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="p-2.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Refresh availability"
              >
                <RefreshCw className={`w-5 h-5 ${isFetching ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={handleClose}
                className="p-2.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Warning Banner - Requested clinician has no availability */}
        {client.requestedClinician && !requestedClinicianHasAvailability && !slotsLoading && (
          <div className="bg-amber-50 border-b border-amber-200 px-8 py-3">
            <div className="flex items-center gap-3 text-amber-800">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">
                <span className="font-semibold">{client.requestedClinician}</span> (requested clinician) currently has no available slots.
                Consider offering alternative clinicians or checking back later.
              </p>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="border-b px-8">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab("smart")}
              className={`py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "smart"
                  ? "border-purple-500 text-purple-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Sparkles className="w-4 h-4 inline-block mr-2" />
              Smart Select
            </button>
            <button
              onClick={() => setActiveTab("browse")}
              className={`py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "browse"
                  ? "border-purple-500 text-purple-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              <Search className="w-4 h-4 inline-block mr-2" />
              Browse All
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {slotsLoading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 className="w-10 h-10 animate-spin text-purple-600 mb-4" />
              <p className="text-gray-500 text-lg">Loading availability...</p>
            </div>
          ) : !slots || slots.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Calendar className="w-16 h-16 text-gray-300 mb-4" />
              <p className="text-gray-900 font-medium text-lg mb-2">No availability found</p>
              <p className="text-gray-500">Check the availability spreadsheet for data</p>
            </div>
          ) : activeTab === "smart" ? (
            <div className="h-full flex">
              {/* Left Column - Selection Tools */}
              <div className="w-1/2 border-r overflow-y-auto p-8">
                {/* Quick Stats */}
                <div className="flex gap-4 mb-8">
                  {client.insuranceProvider && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">{insuranceMatchCount} insurance matches</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 rounded-lg">
                    <Clock className="w-5 h-5" />
                    <span className="font-medium">{totalAvailableCount} total available</span>
                  </div>
                </div>

                {/* By Clinician Section */}
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                      <User className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">By Clinician</h3>
                      <p className="text-sm text-gray-500">Select specific provider(s)</p>
                    </div>
                  </div>

                  {/* Sort Options */}
                  <div className="flex items-center gap-3 mb-4 text-sm">
                    <span className="text-gray-500">Sort:</span>
                    <button
                      onClick={() => setClinicianSort("availability")}
                      className={`px-3 py-1 rounded-lg transition-colors ${
                        clinicianSort === "availability" ? "bg-purple-100 text-purple-700 font-medium" : "hover:bg-gray-100"
                      }`}
                    >
                      Most Available
                    </button>
                    <button
                      onClick={() => setClinicianSort("alpha")}
                      className={`px-3 py-1 rounded-lg transition-colors ${
                        clinicianSort === "alpha" ? "bg-purple-100 text-purple-700 font-medium" : "hover:bg-gray-100"
                      }`}
                    >
                      A-Z
                    </button>
                    <button
                      onClick={() => setClinicianSort("insurance")}
                      className={`px-3 py-1 rounded-lg transition-colors ${
                        clinicianSort === "insurance" ? "bg-purple-100 text-purple-700 font-medium" : "hover:bg-gray-100"
                      }`}
                    >
                      Insurance Match
                    </button>
                  </div>

                  {/* Clinician Chips */}
                  <div className="flex flex-wrap gap-2">
                    {clinicianStats.map((stat) => (
                      <button
                        key={stat.name}
                        onClick={() => toggleClinicianFilter(stat.name)}
                        className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          selectedClinicians.has(stat.name)
                            ? "bg-purple-600 text-white shadow-md"
                            : stat.isRequestedClinician
                            ? "bg-amber-100 text-amber-800 hover:bg-amber-200 ring-2 ring-amber-400"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {stat.name}
                        <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                          selectedClinicians.has(stat.name) ? "bg-purple-500" : "bg-gray-200 text-gray-600"
                        }`}>
                          {stat.availableSlots}
                        </span>
                        {stat.matchesClientInsurance && !selectedClinicians.has(stat.name) && (
                          <CheckCircle className="w-4 h-4 ml-1 text-green-500" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* By Day Section */}
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">By Day</h3>
                      <p className="text-sm text-gray-500">Pick specific day(s)</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {availableDays.map((day) => (
                      <button
                        key={day}
                        onClick={() => toggleDayFilter(day)}
                        className={`inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          selectedDays.has(day)
                            ? "bg-blue-600 text-white shadow-md"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {day}
                        <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                          selectedDays.has(day) ? "bg-blue-500" : "bg-gray-200 text-gray-600"
                        }`}>
                          {dayCounts[day]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* By Time Section */}
                <div className="mb-8">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <Clock className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">By Time</h3>
                      <p className="text-sm text-gray-500">Filter by time of day or specific time</p>
                    </div>
                  </div>

                  {/* Time Range Buttons */}
                  <div className="flex flex-wrap gap-3 mb-4">
                    <button
                      onClick={() => { setSelectedTimeRange("all"); setSelectedSpecificTime(""); }}
                      className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        selectedTimeRange === "all" && !selectedSpecificTime
                          ? "bg-green-600 text-white shadow-md"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      All Times
                    </button>
                    {(Object.keys(TIME_RANGES) as TimeRange[]).map((range) => (
                      <button
                        key={range}
                        onClick={() => { setSelectedTimeRange(range); setSelectedSpecificTime(""); }}
                        className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          selectedTimeRange === range && !selectedSpecificTime
                            ? "bg-green-600 text-white shadow-md"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {TIME_RANGES[range].label}
                      </button>
                    ))}
                  </div>

                  {/* Specific Time Dropdown */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 font-medium">Or specific time:</span>
                    <div className="relative">
                      <select
                        value={selectedSpecificTime}
                        onChange={(e) => {
                          setSelectedSpecificTime(e.target.value);
                          if (e.target.value) setSelectedTimeRange("all");
                        }}
                        className={`appearance-none pl-4 pr-10 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 min-w-[140px] ${
                          selectedSpecificTime
                            ? "bg-green-50 border-green-300 text-green-700"
                            : "bg-white border-gray-300"
                        }`}
                      >
                        <option value="">Any time</option>
                        {uniqueTimes.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    </div>
                    {selectedSpecificTime && (
                      <button
                        onClick={() => setSelectedSpecificTime("")}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                        title="Clear specific time"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Random Picker Section */}
                <div className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                      <Shuffle className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">Random Pick</h3>
                      <p className="text-sm text-gray-500">Auto-select diverse options</p>
                    </div>
                  </div>

                  {/* Mode Selection */}
                  <div className="flex gap-2 mb-4 p-1 bg-white/60 rounded-lg">
                    <button
                      onClick={() => setRandomMode("full")}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                        randomMode === "full" ? "bg-amber-500 text-white shadow" : "hover:bg-white/50"
                      }`}
                    >
                      Full Random
                    </button>
                    <button
                      onClick={() => setRandomMode("by-clinician")}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                        randomMode === "by-clinician" ? "bg-amber-500 text-white shadow" : "hover:bg-white/50"
                      }`}
                    >
                      By Clinician
                    </button>
                    <button
                      onClick={() => setRandomMode("by-day")}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                        randomMode === "by-day" ? "bg-amber-500 text-white shadow" : "hover:bg-white/50"
                      }`}
                    >
                      By Day
                    </button>
                  </div>

                  {/* Clinician selector for by-clinician mode */}
                  {randomMode === "by-clinician" && (
                    <select
                      value={randomClinician}
                      onChange={(e) => setRandomClinician(e.target.value)}
                      className="w-full mb-4 px-4 py-2.5 border rounded-lg text-sm bg-white"
                    >
                      <option value="">Select clinician...</option>
                      {clinicianStats.map((stat) => (
                        <option key={stat.name} value={stat.name}>
                          {stat.name} ({stat.availableSlots} available)
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Day selector for by-day mode */}
                  {randomMode === "by-day" && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {availableDays.map((day) => (
                        <button
                          key={day}
                          onClick={() => toggleRandomDay(day)}
                          className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                            randomDays.has(day)
                              ? "bg-amber-500 text-white"
                              : "bg-white/70 hover:bg-white"
                          }`}
                        >
                          {day.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Count and Generate */}
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-700">Pick</span>
                    <select
                      value={randomCount}
                      onChange={(e) => setRandomCount(parseInt(e.target.value))}
                      className="border rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      {[2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <span className="text-sm text-gray-700">slots</span>
                    <button
                      onClick={handleGenerateRandom}
                      disabled={
                        (randomMode === "by-clinician" && !randomClinician) ||
                        (randomMode === "by-day" && randomDays.size === 0)
                      }
                      className="ml-auto px-5 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md"
                    >
                      <Shuffle className="w-4 h-4" />
                      Generate
                    </button>
                  </div>
                </div>

                {/* Advanced Filters */}
                <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">Filters</span>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {client.insuranceProvider && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={onlyInsuranceMatch}
                          onChange={(e) => setOnlyInsuranceMatch(e.target.checked)}
                          className="rounded text-purple-600 w-4 h-4"
                        />
                        <span className="text-sm">Only insurance-matched</span>
                      </label>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={excludeOffered}
                        onChange={(e) => setExcludeOffered(e.target.checked)}
                        className="rounded text-purple-600 w-4 h-4"
                      />
                      <span className="text-sm">Exclude previously offered</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Right Column - Results & Selection */}
              <div className="w-1/2 overflow-y-auto p-8 bg-gray-50">
                {/* Matching Slots Display */}
                {matchingSlots.length > 0 && (
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-900 text-lg">Matching Slots ({matchingSlots.length})</h4>
                      <button
                        onClick={() => {
                          setSelectedClinicians(new Set());
                          setSelectedDays(new Set());
                          setSelectedTimeRange("all");
                        }}
                        className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1 rounded-lg hover:bg-white"
                      >
                        Clear Filters
                      </button>
                    </div>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {matchingSlots.map(({ slot, availableClinicians }) => (
                        <div
                          key={slot.id}
                          className={`flex items-center justify-between p-4 rounded-xl border bg-white ${
                            wasOffered(slot.id) ? "border-amber-300" : "border-gray-200"
                          }`}
                        >
                          <div>
                            <p className="font-medium text-gray-900">{slot.day} at {slot.time}</p>
                            <p className="text-sm text-gray-500">{availableClinicians.join(", ")}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {wasOffered(slot.id) && (
                              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-lg">Previously offered</span>
                            )}
                            {matchesInsurance(slot, client.insuranceProvider) && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                Insurance
                              </span>
                            )}
                            <button
                              onClick={() => addSlotToSelection(slot, availableClinicians[0])}
                              className="p-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selected Slots Preview */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-gray-900 text-lg">
                      Selected Slots {selectedSlots.length > 0 && `(${selectedSlots.length})`}
                    </h4>
                    {selectedSlots.length > 0 && (
                      <button
                        onClick={clearAllSelections}
                        className="text-sm text-red-600 hover:text-red-700 px-3 py-1 rounded-lg hover:bg-red-50"
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  {selectedSlots.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-gray-200">
                      <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No slots selected yet</p>
                      <p className="text-sm text-gray-400 mt-1">Use the filters on the left or generate random slots</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3 mb-6">
                        {selectedSlots.map((slot, index) => (
                          <div
                            key={slot.slotId}
                            className="flex items-center justify-between p-4 bg-white border border-purple-200 rounded-xl shadow-sm"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-semibold">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{slot.day} at {slot.time}</p>
                                <p className="text-sm text-gray-500">{slot.clinicians.join(" or ")}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {wasOffered(slot.slotId) && (
                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-lg">Previously offered</span>
                              )}
                              <button
                                onClick={() => removeSlotFromSelection(slot.slotId)}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Email Preview */}
                      <div className="bg-white rounded-xl border border-gray-200 p-5">
                        <p className="text-xs text-gray-500 mb-3 font-semibold uppercase tracking-wide">Email Preview</p>
                        <div className="text-sm text-gray-700 space-y-1">
                          <p>I have the following availability:</p>
                          {selectedSlots.map((slot) => (
                            <p key={slot.slotId}>
                              • {slot.day} at {slot.time} with {slot.clinicians.join(" or ")}
                            </p>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Browse All Tab */
            <div className="h-full overflow-y-auto p-8">
              {/* Filters */}
              <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by day, time, clinician..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                {client.insuranceProvider && (
                  <button
                    onClick={() => setInsuranceFilter(insuranceFilter === "all" ? "matching" : "all")}
                    className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-colors ${
                      insuranceFilter === "matching"
                        ? "bg-blue-100 text-blue-700 border border-blue-200"
                        : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <Shield className="w-5 h-5" />
                    {insuranceFilter === "matching" ? "Insurance Match" : "Show All"}
                  </button>
                )}
              </div>

              {/* Slots List */}
              {filteredSlots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Search className="w-16 h-16 text-gray-300 mb-4" />
                  <p className="text-gray-900 font-medium text-lg mb-2">No matching slots</p>
                  <p className="text-gray-500">
                    Try adjusting your search or{" "}
                    <button
                      onClick={() => setInsuranceFilter("all")}
                      className="text-purple-600 hover:underline"
                    >
                      show all insurance types
                    </button>
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {filteredSlots.map((slot) => {
                    const insuranceMatches = matchesInsurance(slot, client.insuranceProvider);
                    const offered = wasOffered(slot.id);

                    return (
                      <div
                        key={slot.id}
                        className={`rounded-xl border p-5 transition-colors ${
                          offered
                            ? "border-amber-300 bg-amber-50"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="font-semibold text-gray-900 text-lg">
                              {slot.day} at {slot.time}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {offered && (
                              <span className="text-xs px-2.5 py-1 rounded-lg bg-amber-200 text-amber-800 font-medium">
                                Previously offered
                              </span>
                            )}
                            {insuranceMatches && (
                              <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2.5 py-1 rounded-lg font-medium">
                                <CheckCircle className="w-3.5 h-3.5" />
                                Insurance
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {slot.clinicians.map((clinician) => {
                            const isSelected = selectedSlots.some(
                              s => s.slotId === slot.id && s.clinicians.includes(clinician)
                            );

                            return (
                              <button
                                key={clinician}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedSlots(prev => {
                                      const existing = prev.find(s => s.slotId === slot.id);
                                      if (!existing) return prev;
                                      const newClinicians = existing.clinicians.filter(c => c !== clinician);
                                      if (newClinicians.length === 0) {
                                        return prev.filter(s => s.slotId !== slot.id);
                                      }
                                      return prev.map(s => s.slotId === slot.id ? { ...s, clinicians: newClinicians } : s);
                                    });
                                  } else {
                                    addSlotToSelection(slot, clinician);
                                  }
                                }}
                                className={`px-4 py-2.5 rounded-lg border font-medium transition-colors ${
                                  isSelected
                                    ? "bg-purple-100 border-purple-500 text-purple-700"
                                    : "bg-gray-50 border-gray-200 hover:border-purple-300 hover:bg-purple-50 text-gray-900"
                                }`}
                              >
                                {isSelected && <Check className="w-4 h-4 inline mr-1.5" />}
                                {clinician}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-8 py-5 border-t bg-gray-50 rounded-b-2xl">
          <div className="text-gray-600">
            {selectedSlots.length > 0 && (
              <span className="font-medium">
                {selectedSlots.length} slot{selectedSlots.length !== 1 ? "s" : ""} selected
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleClose}
              className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleInsert}
              disabled={selectedSlots.length === 0}
              className="px-6 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-md"
            >
              <Plus className="w-5 h-5" />
              Insert Availability
            </button>
          </div>
        </div>
      </div>
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
  const updateClientMutation = useUpdateClient();
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Outreach attempts tracking
  const { data: outreachAttempts = [] } = useOutreachAttempts(client.id);
  const initializeAttempts = useInitializeOutreachAttempts();
  const updateAttempt = useUpdateOutreachAttempt();

  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  // Email fields
  const [editedTo, setEditedTo] = useState("");
  const [editedCc, setEditedCc] = useState("");
  const [editedBcc, setEditedBcc] = useState("");
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);

  // Track slots selected from availability modal to save when email is sent
  const [pendingOfferedSlots, setPendingOfferedSlots] = useState<SelectedSlotInfo[]>([]);

  // Track whether user is using previous slots or new availability
  const [usePreviousSlots, setUsePreviousSlots] = useState(false);

  // Tab navigation state
  type ReadingPaneTab = "details" | "communications" | "outreach-history";
  const [activeTab, setActiveTab] = useState<ReadingPaneTab>("details");

  // Selected availability for communications tab
  const [communicationsSelectedAvailability, setCommunicationsSelectedAvailability] = useState<string[]>([]);

  // Filter templates to outreach types only
  const outreachTemplates = useMemo(() => {
    return allTemplates?.filter(
      (t) =>
        ["initial_outreach", "follow_up_1", "follow_up_2"].includes(t.type) && t.isActive
    );
  }, [allTemplates]);

  // Get next pending attempt info
  const nextPendingAttempt = outreachAttempts.find((a) => a.status === "pending");
  const nextAttemptNumber = nextPendingAttempt?.attemptNumber || 1;
  const isFollowUp = nextAttemptNumber > 1;
  const attemptLabel = getAttemptDisplayLabel(nextAttemptNumber);

  // Get suggested template based on outreach attempts (more accurate than client status)
  const suggestedTemplateType = outreachAttempts.length > 0
    ? getSuggestedTemplateTypeFromAttempts(outreachAttempts)
    : getSuggestedTemplateType(client.status);
  const suggestedTemplate = useMemo(() => {
    if (!suggestedTemplateType || !outreachTemplates) return null;
    return outreachTemplates.find((t) => t.type === suggestedTemplateType) || null;
  }, [suggestedTemplateType, outreachTemplates]);

  // Parse previously offered slots for follow-up reuse
  const previouslyOfferedSlots = useMemo(() => {
    if (!client.offeredAvailability) return [];
    try {
      return JSON.parse(client.offeredAvailability) as OfferedSlot[];
    } catch {
      return [];
    }
  }, [client.offeredAvailability]);

  // Auto-select suggested template when client changes
  useEffect(() => {
    if (suggestedTemplate && !selectedTemplate) {
      onSelectTemplate(suggestedTemplate);
    }
  }, [suggestedTemplate, selectedTemplate, onSelectTemplate]);

  // Reset usePreviousSlots when client changes
  useEffect(() => {
    setUsePreviousSlots(false);
    setPendingOfferedSlots([]);
  }, [client.id]);

  // Auto-initialize outreach attempts if client is in outreach workflow but has no attempts
  // This handles cases where emails were sent before the attempt tracking was properly set up
  useEffect(() => {
    const initializeAttemptsForExistingClient = async () => {
      // Statuses that indicate emails have been sent
      const sentStatuses: Record<string, number> = {
        awaiting_response: 1, // At least 1 email sent
        follow_up_due: 1, // At least 1 email sent
        outreach_sent: 1, // Legacy: initial sent
        follow_up_1: 2, // Legacy: 2 emails sent
        follow_up_2: 3, // Legacy: 3 emails sent
      };

      const sentCount = sentStatuses[client.status];
      if (sentCount === undefined) return;

      // If client has sent emails but no attempts tracked, initialize and mark as sent
      if (outreachAttempts.length === 0) {
        try {
          const newAttempts = await initializeAttempts.mutateAsync(client.id);

          // Mark the appropriate number of attempts as "sent"
          for (let i = 0; i < sentCount && i < newAttempts.length; i++) {
            await updateAttempt.mutateAsync({
              clientId: client.id,
              attemptId: newAttempts[i].id,
              status: "sent",
              sentAt: new Date().toISOString(), // Use current time as placeholder
            });
          }
        } catch (error) {
          console.error("Failed to initialize outreach attempts:", error);
        }
      }
    };

    initializeAttemptsForExistingClient();
  }, [client.id, client.status, outreachAttempts.length, initializeAttempts, updateAttempt]);

  // When using previous slots, convert them to pending slots format
  useEffect(() => {
    if (usePreviousSlots && previouslyOfferedSlots.length > 0) {
      const convertedSlots: SelectedSlotInfo[] = previouslyOfferedSlots.map((slot) => ({
        slotId: slot.slotId,
        day: slot.day,
        time: slot.time,
        clinicians: slot.clinicians,
      }));
      setPendingOfferedSlots(convertedSlots);
    } else if (!usePreviousSlots) {
      // Clear pending slots when switching away from previous slots
      // Only if we haven't manually selected new slots
      // Actually, keep pending slots if user selected new ones
    }
  }, [usePreviousSlots, previouslyOfferedSlots]);

  const banner = getWorkflowBanner(client);

  // Build HTML availability block from selected slots
  const buildAvailabilityBlock = (slots: SelectedSlotInfo[]): string => {
    if (slots.length === 0) return "";

    const slotLines = slots.map((slot) => {
      const clinicianList = slot.clinicians.join(" or ");
      return `<li style="margin-bottom: 8px;">${slot.day} at ${slot.time} with ${clinicianList}</li>`;
    });

    return `<hr style="border: none; border-top: 2px solid #d1d5db; margin: 24px 0;">
<p style="color: #374151; font-weight: 600; margin-bottom: 12px;">Available Appointment Times:</p>
<ul style="margin: 0; padding-left: 20px; color: #4b5563;">
${slotLines.join("\n")}
</ul>
<p style="color: #6b7280; margin-top: 16px; font-size: 14px;">Please let me know which time works best for you, and I'll get you scheduled right away.</p>`;
  };

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

      // Build the full body with availability slots appended
      const availabilityBlock = buildAvailabilityBlock(pendingOfferedSlots);
      const fullBody = result.body + availabilityBlock;

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
      // FIRST: Ensure outreach attempts exist and find the pending one
      // This must happen BEFORE sending so we can pass the attempt ID to the API
      let attempts = outreachAttempts;
      if (attempts.length === 0) {
        try {
          // Get the newly initialized attempts from the mutation result
          attempts = await initializeAttempts.mutateAsync(client.id);
        } catch {
          // Failed to initialize attempts, continue without tracking
          console.error("Failed to initialize outreach attempts");
        }
      }

      // Find the next pending attempt
      const pendingAttempt = attempts.find((a) => a.status === "pending");

      // SECOND: Send the email WITH the outreach attempt ID
      // This allows the backend to store Gmail thread/message IDs on the attempt
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
        outreachAttemptId: pendingAttempt?.id, // Pass attempt ID so Gmail IDs get stored
      });

      // THIRD: Mark the attempt as sent (the backend also does this, but we update locally too)
      if (pendingAttempt) {
        try {
          await updateAttempt.mutateAsync({
            clientId: client.id,
            attemptId: pendingAttempt.id,
            status: "sent",
            sentAt: new Date().toISOString(),
            emailSubject: editedSubject,
            emailPreview: editedBody.replace(/<[^>]*>/g, "").substring(0, 200),
          });
        } catch {
          // Failed to update attempt, continue without tracking
          console.error("Failed to update outreach attempt");
        }
      }

      // Save offered availability if any NEW slots were selected
      // Don't save if we're reusing previous slots (they're already saved)
      if (pendingOfferedSlots.length > 0 && !usePreviousSlots) {
        const now = new Date().toISOString();
        const newOfferedSlots: OfferedSlot[] = pendingOfferedSlots.map((slot) => ({
          slotId: slot.slotId,
          day: slot.day,
          time: slot.time,
          clinicians: slot.clinicians,
          offeredAt: now,
        }));

        // Parse existing offered slots and append new ones
        let existingSlots: OfferedSlot[] = [];
        if (client.offeredAvailability) {
          try {
            existingSlots = JSON.parse(client.offeredAvailability);
          } catch {
            // Invalid JSON, start fresh
          }
        }

        const allOfferedSlots = [...existingSlots, ...newOfferedSlots];

        await updateClientMutation.mutateAsync({
          id: client.id,
          data: {
            offeredAvailability: JSON.stringify(allOfferedSlots),
          },
        });
      }

      // Clear pending slots and reset usePreviousSlots
      setPendingOfferedSlots([]);
      setUsePreviousSlots(false);

      setSendSuccess(true);
      onEmailSent();

      addToast({
        type: "success",
        title: "Email sent",
        message: `${attemptLabel} email sent to ${editedTo}`,
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
        {/* Template Selector - Dynamic label based on attempt */}
        <Dropdown
          label={`Select Template for ${attemptLabel}`}
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

        {/* Availability Buttons - Show different options for follow-ups */}
        {isFollowUp && previouslyOfferedSlots.length > 0 ? (
          <>
            {/* Offer Previous Slots Button */}
            <button
              onClick={() => {
                setUsePreviousSlots(true);
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                usePreviousSlots
                  ? "bg-green-600 text-white"
                  : "text-green-700 bg-green-50 border border-green-200 hover:bg-green-100"
              )}
              title="Reuse the availability slots offered in previous outreach"
            >
              <RefreshCcw className="w-4 h-4" />
              {usePreviousSlots ? `Using Previous (${previouslyOfferedSlots.length})` : "Offer Previous Slots"}
            </button>

            {/* Offer New Availability Button */}
            <button
              onClick={() => {
                setUsePreviousSlots(false);
                setPendingOfferedSlots([]);
                setShowAvailabilityModal(true);
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                !usePreviousSlots && pendingOfferedSlots.length > 0
                  ? "bg-purple-600 text-white"
                  : "text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100"
              )}
              title="Select new availability slots to offer"
            >
              <Calendar className="w-4 h-4" />
              {!usePreviousSlots && pendingOfferedSlots.length > 0
                ? `New Slots (${pendingOfferedSlots.length})`
                : "Offer New Availability"}
            </button>
          </>
        ) : (
          /* Initial outreach - just show Find Availability */
          <button
            onClick={() => setShowAvailabilityModal(true)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
              pendingOfferedSlots.length > 0
                ? "bg-purple-600 text-white"
                : "text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100"
            )}
          >
            <Calendar className="w-4 h-4" />
            {pendingOfferedSlots.length > 0
              ? `Availability (${pendingOfferedSlots.length} slots)`
              : "Find Availability"}
          </button>
        )}

        {/* Process Outreach Button - Dynamic label based on attempt */}
        {selectedTemplate && (
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
            Process {attemptLabel}
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

      {/* Tab Navigation */}
      <div className="flex border-b bg-white flex-shrink-0">
        <button
          onClick={() => setActiveTab("details")}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
            activeTab === "details"
              ? "border-purple-600 text-purple-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          )}
        >
          <User className="w-4 h-4" />
          Details
        </button>
        <button
          onClick={() => setActiveTab("communications")}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
            activeTab === "communications"
              ? "border-purple-600 text-purple-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          )}
        >
          <MessageCircle className="w-4 h-4" />
          Client Communications
        </button>
        <button
          onClick={() => setActiveTab("outreach-history")}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
            activeTab === "outreach-history"
              ? "border-purple-600 text-purple-600"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
          )}
        >
          <Clock className="w-4 h-4" />
          Outreach History
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "communications" ? (
        <ClientCommunications
          client={client}
          onOpenAvailabilityModal={() => setShowAvailabilityModal(true)}
          selectedAvailability={communicationsSelectedAvailability}
          onClearAvailability={() => setCommunicationsSelectedAvailability([])}
        />
      ) : activeTab === "outreach-history" ? (
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <div className="space-y-6">
            {/* Outreach Attempts Timeline */}
            <div className="bg-white rounded-lg border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                Outreach Timeline
              </h3>
              {outreachAttempts.length === 0 ? (
                <p className="text-gray-500 text-sm">No outreach attempts recorded yet.</p>
              ) : (
                <div className="space-y-4">
                  {outreachAttempts.map((attempt, index) => (
                    <div
                      key={attempt.id}
                      className={cn(
                        "flex items-start gap-4 p-4 rounded-lg border",
                        attempt.status === "sent"
                          ? "bg-green-50 border-green-200"
                          : attempt.status === "pending"
                          ? "bg-amber-50 border-amber-200"
                          : "bg-gray-50 border-gray-200"
                      )}
                    >
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                          attempt.status === "sent"
                            ? "bg-green-500"
                            : attempt.status === "pending"
                            ? "bg-amber-400"
                            : "bg-gray-300"
                        )}
                      >
                        {attempt.status === "sent" ? (
                          <Check className="w-5 h-5 text-white" />
                        ) : (
                          <Clock className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-gray-900">
                            {attempt.attemptNumber === 1
                              ? "Initial Outreach"
                              : `Follow-up #${attempt.attemptNumber - 1}`}
                          </h4>
                          <span
                            className={cn(
                              "text-xs px-2 py-1 rounded-full font-medium",
                              attempt.status === "sent"
                                ? "bg-green-100 text-green-700"
                                : attempt.status === "pending"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-gray-100 text-gray-600"
                            )}
                          >
                            {attempt.status === "sent" ? "Sent" : attempt.status === "pending" ? "Pending" : attempt.status}
                          </span>
                        </div>
                        {attempt.sentAt && (
                          <p className="text-sm text-gray-600 mt-1">
                            Sent on {formatDate(attempt.sentAt)}
                          </p>
                        )}
                        {attempt.emailSubject && (
                          <p className="text-sm text-gray-500 mt-1">
                            Subject: {attempt.emailSubject}
                          </p>
                        )}
                        {attempt.responseDetected && (
                          <div className="flex items-center gap-2 mt-2 text-sm text-green-700">
                            <CheckCircle className="w-4 h-4" />
                            Response detected
                            {attempt.responseDetectedAt && (
                              <span>on {formatDate(attempt.responseDetectedAt)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Legacy Outreach History */}
            {(client.initialOutreachDate || client.followUp1Date || client.followUp2Date) && (
              <div className="bg-white rounded-lg border p-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Legacy Records
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
                </dl>
              </div>
            )}
          </div>
        </div>
      ) : (
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

          {/* Offered Availability */}
          {(() => {
            let offeredSlots: OfferedSlot[] = [];
            if (client.offeredAvailability) {
              try {
                offeredSlots = JSON.parse(client.offeredAvailability);
              } catch {
                // Invalid JSON, ignore
              }
            }

            // Parse accepted slot if exists
            let acceptedSlot: { slotId: string; day: string; time: string; clinician: string; acceptedAt: string } | null = null;
            if (client.acceptedSlot) {
              try {
                acceptedSlot = JSON.parse(client.acceptedSlot);
              } catch {
                // Invalid JSON, ignore
              }
            }

            // Group offered slots by date
            const slotsByDate = offeredSlots.reduce((acc, slot) => {
              const date = new Date(slot.offeredAt).toLocaleDateString();
              if (!acc[date]) {
                acc[date] = [];
              }
              acc[date].push(slot);
              return acc;
            }, {} as Record<string, OfferedSlot[]>);

            const sortedDates = Object.keys(slotsByDate).sort(
              (a, b) => new Date(b).getTime() - new Date(a).getTime()
            );

            if (offeredSlots.length === 0 && !acceptedSlot) return null;

            return (
              <div className="bg-white rounded-lg border p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {acceptedSlot ? "Scheduled Slot" : "Offered Availability"}
                </h3>

                {acceptedSlot ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-green-800 font-medium">
                      <CheckCircle className="w-4 h-4" />
                      {acceptedSlot.day} at {acceptedSlot.time}
                    </div>
                    <p className="text-sm text-green-700 mt-1">
                      with {acceptedSlot.clinician}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      Accepted {formatDate(acceptedSlot.acceptedAt)}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sortedDates.map((date) => (
                      <div key={date}>
                        <p className="text-xs font-medium text-gray-500 mb-1">
                          Offered {date}
                        </p>
                        <ul className="space-y-1">
                          {slotsByDate[date].map((slot, idx) => (
                            <li
                              key={`${slot.slotId}-${idx}`}
                              className="text-sm text-gray-700 flex items-start gap-2"
                            >
                              <span className="text-amber-500 mt-0.5">•</span>
                              <span>
                                {slot.day} {slot.time} — {slot.clinicians.join(", ")}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

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
      )}

      {/* Availability Modal */}
      <AvailabilityModal
        isOpen={showAvailabilityModal}
        onClose={() => setShowAvailabilityModal(false)}
        client={client}
        onInsertAvailability={(text, selectedSlots) => {
          // Track selected slots for when email is sent
          setPendingOfferedSlots(selectedSlots);

          // If on communications tab, update communications availability state
          if (activeTab === "communications") {
            const slotStrings = selectedSlots.map(
              (slot) => `${slot.day} at ${slot.time} with ${slot.clinicians.join(" or ")}`
            );
            setCommunicationsSelectedAvailability(slotStrings);
          }

          // If email preview is open and in edit mode, append to body
          if (showEmailPreview && isEditing) {
            setEditedBody((prev) => prev + "\n\n" + text);
          } else {
            // Store in clipboard and show toast
            navigator.clipboard.writeText(text);
            addToast({
              type: "success",
              title: "Copied to clipboard",
              message: "Availability has been copied. Paste it into your email.",
            });
          }
        }}
      />

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
                  {sendSuccess ? "Email Sent!" : isEditing ? "Edit Email" : "Process Outreach"}
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

                  {/* Availability Summary */}
                  {pendingOfferedSlots.length > 0 && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar className="w-4 h-4 text-purple-600" />
                        <label className="text-sm font-medium text-purple-800">
                          Offering {pendingOfferedSlots.length} Appointment Slot{pendingOfferedSlots.length !== 1 ? "s" : ""}
                        </label>
                      </div>
                      <div className="space-y-2">
                        {pendingOfferedSlots.map((slot, index) => (
                          <div
                            key={slot.slotId}
                            className="flex items-center gap-2 text-sm text-purple-700"
                          >
                            <span className="w-5 h-5 bg-purple-200 rounded-full flex items-center justify-center text-xs font-medium">
                              {index + 1}
                            </span>
                            <span>
                              {slot.day} at {slot.time} with {slot.clinicians.join(" or ")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

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
  onConfirm: (reason: string) => void;
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
  const [closeReason, setCloseReason] = useState("");
  const [reasonError, setReasonError] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setCloseReason("");
      setReasonError(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const hasAllFollowUps = !!client.followUp2Date;
  const attemptCount =
    (client.initialOutreachDate ? 1 : 0) +
    (client.followUp1Date ? 1 : 0) +
    (client.followUp2Date ? 1 : 0);

  const handleConfirm = () => {
    if (!closeReason.trim()) {
      setReasonError(true);
      return;
    }
    onConfirm(closeReason.trim());
  };

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
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
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

            {/* Required Reason Field */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason for closing <span className="text-red-500">*</span>
              </label>
              <textarea
                value={closeReason}
                onChange={(e) => {
                  setCloseReason(e.target.value);
                  if (e.target.value.trim()) setReasonError(false);
                }}
                placeholder="Enter the reason for closing this case..."
                rows={3}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  reasonError ? "border-red-500" : "border-gray-300"
                }`}
              />
              {reasonError && (
                <p className="text-xs text-red-500 mt-1">A reason is required to close this case</p>
              )}
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
                onClick={handleConfirm}
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

// Props for slot acceptance modal
interface AcceptanceModalProps {
  client: Client;
  isOpen: boolean;
  onConfirm: (slotId: string, clinician: string) => void;
  onSkip: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

// Modal for selecting which offered slot the client accepted
function AcceptanceModal({
  client,
  isOpen,
  onConfirm,
  onSkip,
  onCancel,
  isLoading,
}: AcceptanceModalProps) {
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedClinician, setSelectedClinician] = useState<string>("");

  if (!isOpen) return null;

  // Parse offered slots
  let offeredSlots: OfferedSlot[] = [];
  if (client.offeredAvailability) {
    try {
      offeredSlots = JSON.parse(client.offeredAvailability);
    } catch {
      // Invalid JSON
    }
  }

  // Get unique slots (dedupe by slotId, keeping all clinicians)
  const uniqueSlots = offeredSlots.reduce((acc, slot) => {
    const existing = acc.find((s) => s.slotId === slot.slotId);
    if (existing) {
      // Merge clinicians
      slot.clinicians.forEach((c) => {
        if (!existing.clinicians.includes(c)) {
          existing.clinicians.push(c);
        }
      });
    } else {
      acc.push({ ...slot, clinicians: [...slot.clinicians] });
    }
    return acc;
  }, [] as OfferedSlot[]);

  const selectedSlot = uniqueSlots.find((s) => s.slotId === selectedSlotId);

  const handleConfirm = () => {
    if (selectedSlotId && selectedClinician) {
      onConfirm(selectedSlotId, selectedClinician);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onCancel} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
              Client Replied
            </h3>
            <p className="text-sm text-gray-600 text-center">
              Did {client.firstName} accept one of the offered time slots?
            </p>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {uniqueSlots.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                <Calendar className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                <p className="text-sm">No availability was offered to this client.</p>
                <p className="text-xs text-gray-400 mt-1">
                  You can still move them to scheduling without booking a slot.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {uniqueSlots.map((slot) => (
                  <label
                    key={slot.slotId}
                    className={`block p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedSlotId === slot.slotId
                        ? "border-green-500 bg-green-50 ring-2 ring-green-200"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="slot"
                        value={slot.slotId}
                        checked={selectedSlotId === slot.slotId}
                        onChange={() => {
                          setSelectedSlotId(slot.slotId);
                          // Auto-select if only one clinician
                          if (slot.clinicians.length === 1) {
                            setSelectedClinician(slot.clinicians[0]);
                          } else {
                            setSelectedClinician("");
                          }
                        }}
                        className="mt-1 text-green-600 focus:ring-green-500"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {slot.day} at {slot.time}
                        </div>
                        <div className="text-sm text-gray-500">
                          {slot.clinicians.join(", ")}
                        </div>
                      </div>
                    </div>

                    {/* Clinician selection if multiple */}
                    {selectedSlotId === slot.slotId && slot.clinicians.length > 1 && (
                      <div className="mt-3 pl-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Select clinician:
                        </label>
                        <select
                          value={selectedClinician}
                          onChange={(e) => setSelectedClinician(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                        >
                          <option value="">Choose a clinician...</option>
                          {slot.clinicians.map((clinician) => (
                            <option key={clinician} value={clinician}>
                              {clinician}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </label>
                ))}

                {/* No booking option */}
                <label
                  className={`block p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedSlotId === "none"
                      ? "border-gray-500 bg-gray-50 ring-2 ring-gray-200"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="slot"
                      value="none"
                      checked={selectedSlotId === "none"}
                      onChange={() => {
                        setSelectedSlotId("none");
                        setSelectedClinician("");
                      }}
                      className="text-gray-600 focus:ring-gray-500"
                    />
                    <div>
                      <div className="font-medium text-gray-700">
                        No slot accepted
                      </div>
                      <div className="text-sm text-gray-500">
                        Move to scheduling without booking a specific slot
                      </div>
                    </div>
                  </div>
                </label>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t bg-gray-50">
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                disabled={isLoading}
                className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              {selectedSlotId === "none" || uniqueSlots.length === 0 ? (
                <button
                  onClick={onSkip}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 text-white bg-gray-600 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Move to Scheduling"
                  )}
                </button>
              ) : (
                <button
                  onClick={handleConfirm}
                  disabled={isLoading || !selectedSlotId || (selectedSlot && selectedSlot.clinicians.length > 1 && !selectedClinician)}
                  className="flex-1 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Booking...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Book Slot
                    </>
                  )}
                </button>
              )}
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

  // Acceptance modal state
  const [acceptanceClient, setAcceptanceClient] = useState<Client | null>(null);

  // Update client hook
  const updateClient = useUpdateClient();
  const createBookedSlot = useCreateBookedSlot();
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
    outreachClients?.filter((c) =>
      c.status === "outreach_sent" || c.status === "awaiting_response"
    ).length || 0;
  const followUpCount =
    outreachClients?.filter(
      (c) => c.status === "follow_up_1" || c.status === "follow_up_2" || c.status === "follow_up_due"
    ).length || 0;
  const inCommunicationCount =
    outreachClients?.filter((c) => c.status === "in_communication").length || 0;
  const noContactCount =
    outreachClients?.filter((c) => c.status === "no_contact_ok_close").length || 0;

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

  // Opens the acceptance modal
  const handleMoveToScheduling = () => {
    if (!selectedClient) return;
    setAcceptanceClient(selectedClient);
  };

  // Handle slot acceptance (books a slot and moves to scheduling)
  const handleAcceptSlot = async (slotId: string, clinician: string) => {
    if (!acceptanceClient) return;

    // Find the slot details from offered availability
    let offeredSlots: OfferedSlot[] = [];
    if (acceptanceClient.offeredAvailability) {
      try {
        offeredSlots = JSON.parse(acceptanceClient.offeredAvailability);
      } catch {
        // Invalid JSON
      }
    }

    const slot = offeredSlots.find((s) => s.slotId === slotId);
    if (!slot) {
      addToast({
        type: "error",
        title: "Slot not found",
        message: "Could not find the selected slot details.",
      });
      return;
    }

    try {
      // Create the booked slot record
      await createBookedSlot.mutateAsync({
        slotId: slot.slotId,
        day: slot.day,
        time: slot.time,
        clinician: clinician,
        clientId: acceptanceClient.id,
      });

      // Create accepted slot data
      const acceptedSlot: AcceptedSlot = {
        slotId: slot.slotId,
        day: slot.day,
        time: slot.time,
        clinician: clinician,
        acceptedAt: new Date().toISOString(),
      };

      // Update client with accepted slot and move to scheduling
      await updateClient.mutateAsync({
        id: acceptanceClient.id,
        data: {
          status: "ready_to_schedule",
          acceptedSlot: JSON.stringify(acceptedSlot),
          assignedClinician: clinician,
        },
      });

      addToast({
        type: "success",
        title: "Slot booked",
        message: `${acceptanceClient.firstName} ${acceptanceClient.lastName} is booked for ${slot.day} at ${slot.time} with ${clinician}.`,
      });

      setAcceptanceClient(null);
      setSelectedClientId(null);
      refetch();
    } catch (error) {
      addToast({
        type: "error",
        title: "Failed to book slot",
        message: error instanceof Error ? error.message : "Failed to book slot",
      });
    }
  };

  // Handle moving to scheduling without booking a slot
  const handleSkipSlotBooking = async () => {
    if (!acceptanceClient) return;

    try {
      await updateClient.mutateAsync({
        id: acceptanceClient.id,
        data: {
          status: "ready_to_schedule",
        },
      });

      addToast({
        type: "success",
        title: "Moved to scheduling",
        message: `${acceptanceClient.firstName} ${acceptanceClient.lastName} is now ready to schedule.`,
      });

      setAcceptanceClient(null);
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

  const handleConfirmClose = async (reason: string) => {
    if (!closeConfirmClient) return;

    try {
      await updateClient.mutateAsync({
        id: closeConfirmClient.id,
        data: {
          status: "closed_no_contact",
          closedDate: new Date().toISOString(),
          closedReason: reason, // Now uses the user-provided reason
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
            <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
            <span className="text-gray-600">
              <span className="font-semibold text-amber-600">{followUpCount}</span> Follow-up
            </span>
          </div>
          {inCommunicationCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span className="text-gray-600">
                <span className="font-semibold text-green-600">{inCommunicationCount}</span> In Comm.
              </span>
            </div>
          )}
          {noContactCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              <span className="text-gray-600">
                <span className="font-semibold text-red-600">{noContactCount}</span> No Contact
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Left/Right Split */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Client List */}
        <div className="w-[280px] flex-shrink-0 border-r bg-white flex flex-col">
          {/* Search Bar */}
          <div className="p-3 border-b bg-gray-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search clients..."
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

        {/* Right Panel - Split View: Dashboard Table + Details */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Section: Outreach Dashboard Table (~45% height) */}
          <div className="h-[45%] border-b overflow-hidden">
            <OutreachDashboard
              clients={outreachClients || []}
              selectedClientId={selectedClientId}
              onSelectClient={handleClientClick}
            />
          </div>

          {/* Bottom Section: Client Details (~55% height) */}
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
                    Choose a client from the table or list to compose and send outreach emails
                  </p>
                </div>
              </div>
            )}
          </div>
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

      {/* Acceptance Modal (for Client Replied) */}
      {acceptanceClient && (
        <AcceptanceModal
          client={acceptanceClient}
          isOpen={!!acceptanceClient}
          onConfirm={handleAcceptSlot}
          onSkip={handleSkipSlotBooking}
          onCancel={() => setAcceptanceClient(null)}
          isLoading={updateClient.isPending || createBookedSlot.isPending}
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
