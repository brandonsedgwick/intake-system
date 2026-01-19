"use client";

import { useState, useMemo } from "react";
import { Client, OutreachAttempt, getAttemptLabel } from "@/types/client";
import { useOutreachAttempts } from "@/hooks/use-outreach-attempts";
import { useSettings } from "@/hooks/use-settings";
import {
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OutreachDashboardProps {
  clients: Client[];
  selectedClientId: string | null;
  onSelectClient: (client: Client) => void;
}

// Status badge component
function StatusBadge({ status, dueDate }: { status: string; dueDate?: string }) {
  const isOverdue = dueDate && new Date(dueDate) < new Date();
  const isDueToday = dueDate && isToday(new Date(dueDate));

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

        return (
          <div
            key={i}
            className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium",
              isSent
                ? "bg-green-500 text-white"
                : isPending
                ? "bg-amber-400 text-white"
                : "bg-gray-200 text-gray-500"
            )}
            title={
              attempt
                ? `${getAttemptLabel(attempt.attemptNumber)}: ${attempt.status}`
                : `Attempt ${i + 1}: Not created`
            }
          >
            {isSent ? (
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
}: {
  client: Client;
  isSelected: boolean;
  onClick: () => void;
  totalAttempts: number;
}) {
  const { data: attempts = [] } = useOutreachAttempts(client.id);

  // Calculate next action based on attempts
  const nextPendingAttempt = attempts.find((a) => a.status === "pending");
  const nextAction = nextPendingAttempt
    ? getAttemptLabel(nextPendingAttempt.attemptNumber)
    : "All sent";

  // Calculate due date based on settings and last sent attempt
  const lastSentAttempt = [...attempts]
    .filter((a) => a.status === "sent")
    .sort((a, b) => b.attemptNumber - a.attemptNumber)[0];

  // Simple due date logic - 3 days after last action
  const dueDate = lastSentAttempt?.sentAt
    ? new Date(new Date(lastSentAttempt.sentAt).getTime() + 3 * 24 * 60 * 60 * 1000)
    : new Date();

  const formatDueDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `${Math.abs(diffDays)}d overdue`;
    } else if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Tomorrow";
    } else {
      return `in ${diffDays}d`;
    }
  };

  return (
    <tr
      onClick={onClick}
      className={cn(
        "cursor-pointer hover:bg-gray-50 transition-colors",
        isSelected && "bg-purple-50 hover:bg-purple-50"
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
        <StatusBadge status={client.status} dueDate={dueDate.toISOString()} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">{nextAction}</td>
      <td className="px-4 py-3 text-sm">
        <span
          className={cn(
            "font-medium",
            dueDate < new Date() ? "text-red-600" : "text-gray-600"
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
  const { data: settings } = useSettings();

  const totalAttempts = parseInt(settings?.outreachAttemptCount || "3", 10);

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
