"use client";

import { useState, useMemo } from "react";
import { Client, OutreachAttempt, getAttemptLabel } from "@/types/client";
import { useOutreachAttempts } from "@/hooks/use-outreach-attempts";
import { useSettings } from "@/hooks/use-settings";
import { useManualCheckReplies, useLastCheckTime } from "@/hooks/use-check-replies";
import {
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Filter,
  ArrowUpDown,
  RefreshCw,
  MessageCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OutreachDashboardProps {
  clients: Client[];
  selectedClientId: string | null;
  onSelectClient: (client: Client) => void;
}

// Status badge component with new outreach statuses
function StatusBadge({ status, dueDate }: { status: string; dueDate?: string }) {
  const isOverdue = dueDate && new Date(dueDate) < new Date();
  const isDueToday = dueDate && isToday(new Date(dueDate));

  // New automated outreach statuses
  if (status === "in_communication") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700">
        <MessageCircle className="w-3 h-3" />
        In Communication
      </span>
    );
  }

  if (status === "awaiting_response") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700">
        <Clock className="w-3 h-3" />
        Awaiting Response
      </span>
    );
  }

  if (status === "follow_up_due") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-700">
        <AlertCircle className="w-3 h-3" />
        Follow-up Due
      </span>
    );
  }

  if (status === "no_contact_ok_close") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700">
        <XCircle className="w-3 h-3" />
        No Contact - OK to Close
      </span>
    );
  }

  if (status === "pending_outreach") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-700">
        <Clock className="w-3 h-3" />
        Pending
      </span>
    );
  }

  if (isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700">
        <AlertCircle className="w-3 h-3" />
        Overdue
      </span>
    );
  }

  if (isDueToday) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-700">
        <Clock className="w-3 h-3" />
        Due Today
      </span>
    );
  }

  // Legacy statuses - map to awaiting response
  if (status === "outreach_sent" || status === "follow_up_1" || status === "follow_up_2") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700">
        <Clock className="w-3 h-3" />
        Awaiting Response
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-700">
      {status}
    </span>
  );
}

// Progress indicator component showing mini status for each attempt
function ProgressIndicator({
  attempts,
  totalAttempts,
}: {
  attempts: OutreachAttempt[];
  totalAttempts: number;
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: totalAttempts }, (_, i) => {
        const attempt = attempts.find((a) => a.attemptNumber === i + 1);
        const isSent = attempt?.status === "sent";
        const isPending = attempt?.status === "pending";
        const hasResponse = attempt?.responseDetected;

        return (
          <div
            key={i}
            className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium",
              hasResponse
                ? "bg-green-500 text-white ring-2 ring-green-300"
                : isSent
                ? "bg-blue-500 text-white"
                : isPending
                ? "bg-amber-400 text-white"
                : "bg-gray-200 text-gray-500"
            )}
            title={
              attempt
                ? `${getAttemptLabel(attempt.attemptNumber)}: ${attempt.status}${hasResponse ? " (Reply received)" : ""}`
                : `Attempt ${i + 1}: Not created`
            }
          >
            {hasResponse ? (
              <MessageCircle className="w-3 h-3" />
            ) : isSent ? (
              <CheckCircle className="w-3 h-3" />
            ) : isPending ? (
              <Clock className="w-3 h-3" />
            ) : (
              i + 1
            )}
          </div>
        );
      })}
    </div>
  );
}

// Individual row component for a client
function OutreachRow({
  client,
  isSelected,
  onClick,
  totalAttempts,
  showColorCoding,
}: {
  client: Client;
  isSelected: boolean;
  onClick: () => void;
  totalAttempts: number;
  showColorCoding: boolean;
}) {
  const { data: attempts = [] } = useOutreachAttempts(client.id);

  // Calculate next action based on attempts
  const nextPendingAttempt = attempts.find((a) => a.status === "pending");
  const nextAction = nextPendingAttempt
    ? getAttemptLabel(nextPendingAttempt.attemptNumber)
    : "All sent";

  // Get the most recent sent attempt
  const lastSentAttempt = [...attempts]
    .filter((a) => a.status === "sent")
    .sort((a, b) => b.attemptNumber - a.attemptNumber)[0];

  // Calculate due date based on the outreach attempt's responseWindowEnd
  // This is 24 hours after the email was sent
  const calculateDueDate = (): Date | null => {
    // If we have a response window end from the last sent attempt, use that
    if (lastSentAttempt?.responseWindowEnd) {
      return new Date(lastSentAttempt.responseWindowEnd);
    }

    // Fallback: If sentAt exists but no responseWindowEnd, calculate 24h from sentAt
    if (lastSentAttempt?.sentAt) {
      return new Date(new Date(lastSentAttempt.sentAt).getTime() + 24 * 60 * 60 * 1000);
    }

    // No sent attempts - due now for pending outreach
    if (client.status === "pending_outreach") {
      return new Date();
    }

    return null;
  };

  const dueDate = calculateDueDate();

  // Count sent attempts without a response for row color coding
  const sentAttemptsWithoutResponse = attempts.filter(
    (a) => a.status === "sent" && !a.responseDetected
  ).length;

  // Determine row background color based on unanswered attempts
  // Creates visual urgency progression: none → green → amber → red
  // Colors are always visible for quick board scanning
  const getRowBackgroundClass = () => {
    // Selected state takes priority
    if (isSelected) return "bg-purple-100 hover:bg-purple-100";

    // If color coding is disabled, just use default hover
    if (!showColorCoding) return "hover:bg-gray-50";

    // If client has replied (in_communication), use green
    if (client.status === "in_communication") return "bg-green-100 hover:bg-green-200";

    // Color code by number of unanswered sent attempts
    // Colors always visible, darker on hover for interaction feedback
    switch (sentAttemptsWithoutResponse) {
      case 0:
        return "bg-white hover:bg-gray-100"; // No attempts sent yet
      case 1:
        return "bg-green-100 hover:bg-green-200"; // Initial outreach sent - looking good
      case 2:
        return "bg-amber-100 hover:bg-amber-200"; // 1st follow-up sent - needs attention
      default:
        return "bg-red-100 hover:bg-red-200"; // 2+ follow-ups sent - urgent
    }
  };

  const formatDueDate = (date: Date | null) => {
    if (!date) return "—";

    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const isOverdue = diffMs < 0;

    // Format day of week
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayOfWeek = dayNames[date.getDay()];

    // Format time (12-hour with am/pm)
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? "pm" : "am";
    const hour12 = hours % 12 || 12;
    const timeStr = `${hour12}:${minutes.toString().padStart(2, "0")}${ampm}`;

    // Format date (M/D)
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dateStr = `${month}/${day}`;

    // Build the display string
    if (isOverdue) {
      const overdueDays = Math.abs(Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      if (overdueDays === 0) {
        return `Today ${timeStr} (overdue)`;
      }
      return `${dayOfWeek} ${dateStr} ${timeStr} (${overdueDays}d overdue)`;
    }

    // Check if it's today
    const today = new Date();
    const isToday = date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();

    // Check if it's tomorrow
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.getDate() === tomorrow.getDate() &&
      date.getMonth() === tomorrow.getMonth() &&
      date.getFullYear() === tomorrow.getFullYear();

    if (isToday) {
      return `Today ${timeStr}`;
    } else if (isTomorrow) {
      return `Tomorrow ${timeStr}`;
    } else {
      return `${dayOfWeek} ${dateStr} ${timeStr}`;
    }
  };

  return (
    <tr
      onClick={onClick}
      className={cn(
        "cursor-pointer transition-colors",
        getRowBackgroundClass()
      )}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
              isSelected ? "bg-purple-200 text-purple-800" : "bg-gray-100 text-gray-600"
            )}
          >
            {client.firstName[0]}
            {client.lastName[0]}
          </div>
          <div>
            <p className="font-medium text-gray-900">
              {client.firstName} {client.lastName}
            </p>
            <p className="text-xs text-gray-500">{client.email}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={client.status} dueDate={dueDate?.toISOString()} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{nextAction}</td>
      <td className="px-4 py-3 text-sm">
        <span
          className={cn(
            "font-medium",
            dueDate && dueDate < new Date() ? "text-red-600" : "text-gray-600"
          )}
        >
          {formatDueDate(dueDate)}
        </span>
      </td>
      <td className="px-4 py-3">
        <ProgressIndicator attempts={attempts} totalAttempts={totalAttempts} />
      </td>
    </tr>
  );
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

type SortField = "name" | "status" | "dueDate";
type SortDirection = "asc" | "desc";

export function OutreachDashboard({
  clients,
  selectedClientId,
  onSelectClient,
}: OutreachDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("dueDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [showColorCoding, setShowColorCoding] = useState(true);
  const { data: settings } = useSettings();

  // Reply checking hooks
  const checkReplies = useManualCheckReplies();
  const lastCheckTime = useLastCheckTime();

  const totalAttempts = parseInt(settings?.outreachAttemptCount || "3", 10);

  // Format last check time for display
  const formatLastCheckTime = (date: Date | null) => {
    if (!date) return "Never";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins === 1) return "1 min ago";
    if (diffMins < 60) return `${diffMins} mins ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return "1 hour ago";
    if (diffHours < 24) return `${diffHours} hours ago`;

    return date.toLocaleDateString();
  };

  // Filter clients
  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      if (!searchQuery) return true;
      const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
      return (
        fullName.includes(searchQuery.toLowerCase()) ||
        client.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [clients, searchQuery]);

  // Sort clients - pending/overdue first, then by due date
  const sortedClients = useMemo(() => {
    return [...filteredClients].sort((a, b) => {
      // Pending outreach always first
      if (a.status === "pending_outreach" && b.status !== "pending_outreach") return -1;
      if (a.status !== "pending_outreach" && b.status === "pending_outreach") return 1;

      // Then by created date (oldest first for pending actions)
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortDirection === "asc" ? dateA - dateB : dateB - dateA;
    });
  }, [filteredClients, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="font-semibold text-gray-900">Outreach Queue</h2>
          <span className="text-sm text-gray-500">
            {filteredClients.length} {filteredClients.length === 1 ? "client" : "clients"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Last check time and Check Now button */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Last checked: {formatLastCheckTime(lastCheckTime)}</span>
            <button
              onClick={() => checkReplies.mutate()}
              disabled={checkReplies.isPending}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                checkReplies.isPending
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-purple-100 text-purple-700 hover:bg-purple-200"
              )}
            >
              <RefreshCw
                className={cn("w-4 h-4", checkReplies.isPending && "animate-spin")}
              />
              {checkReplies.isPending ? "Checking..." : "Check Now"}
            </button>
          </div>
          {/* Color coding toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showColorCoding}
              onChange={(e) => setShowColorCoding(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            Color by attempts
          </label>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 pl-9 pr-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Next Action</th>
              <th
                className="px-4 py-3 cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort("dueDate")}
              >
                <div className="flex items-center gap-1">
                  Due
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="px-4 py-3">Progress</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedClients.map((client) => (
              <OutreachRow
                key={client.id}
                client={client}
                isSelected={client.id === selectedClientId}
                onClick={() => onSelectClient(client)}
                totalAttempts={totalAttempts}
                showColorCoding={showColorCoding}
              />
            ))}
            {sortedClients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  {searchQuery
                    ? "No clients match your search"
                    : "No clients in outreach queue"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
