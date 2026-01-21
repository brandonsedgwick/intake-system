"use client";

import { useState } from "react";
import { useClients } from "@/hooks/use-clients";
import { Client, ClientStatus, isClosedStatus, CLOSED_STATUSES } from "@/types/client";
import { ReopenCaseModal } from "@/components/clients/reopen-case-modal";
import { formatRelativeTime } from "@/lib/utils";
import Link from "next/link";
import {
  Search,
  Filter,
  Plus,
  Mail,
  Phone,
  Calendar,
  ChevronRight,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  UserPlus,
  RotateCcw,
  Archive,
} from "lucide-react";

const STATUS_CONFIG: Record<
  ClientStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  new: {
    label: "New",
    color: "bg-blue-100 text-blue-800",
    icon: <UserPlus className="w-3 h-3" />,
  },
  pending_evaluation: {
    label: "Pending Eval",
    color: "bg-yellow-100 text-yellow-800",
    icon: <Clock className="w-3 h-3" />,
  },
  evaluation_complete: {
    label: "Eval Complete",
    color: "bg-green-100 text-green-800",
    icon: <CheckCircle className="w-3 h-3" />,
  },
  evaluation_flagged: {
    label: "Eval Flagged",
    color: "bg-red-100 text-red-800",
    icon: <AlertCircle className="w-3 h-3" />,
  },
  pending_outreach: {
    label: "Ready for Outreach",
    color: "bg-purple-100 text-purple-800",
    icon: <Mail className="w-3 h-3" />,
  },
  outreach_sent: {
    label: "Outreach Sent",
    color: "bg-indigo-100 text-indigo-800",
    icon: <Mail className="w-3 h-3" />,
  },
  follow_up_1: {
    label: "Follow-up 1",
    color: "bg-orange-100 text-orange-800",
    icon: <Clock className="w-3 h-3" />,
  },
  follow_up_2: {
    label: "Follow-up 2",
    color: "bg-red-100 text-red-800",
    icon: <AlertCircle className="w-3 h-3" />,
  },
  replied: {
    label: "Replied",
    color: "bg-green-100 text-green-800",
    icon: <CheckCircle className="w-3 h-3" />,
  },
  ready_to_schedule: {
    label: "Ready to Schedule",
    color: "bg-teal-100 text-teal-800",
    icon: <Calendar className="w-3 h-3" />,
  },
  scheduled: {
    label: "Scheduled",
    color: "bg-emerald-100 text-emerald-800",
    icon: <CheckCircle className="w-3 h-3" />,
  },
  completed: {
    label: "Completed",
    color: "bg-gray-100 text-gray-800",
    icon: <CheckCircle className="w-3 h-3" />,
  },
  pending_referral: {
    label: "Pending Referral",
    color: "bg-amber-100 text-amber-800",
    icon: <AlertCircle className="w-3 h-3" />,
  },
  referred: {
    label: "Referred",
    color: "bg-slate-100 text-slate-800",
    icon: <XCircle className="w-3 h-3" />,
  },
  closed_no_contact: {
    label: "Closed - No Contact",
    color: "bg-gray-100 text-gray-600",
    icon: <XCircle className="w-3 h-3" />,
  },
  closed_other: {
    label: "Closed",
    color: "bg-gray-100 text-gray-600",
    icon: <XCircle className="w-3 h-3" />,
  },
  duplicate: {
    label: "Duplicate",
    color: "bg-orange-100 text-orange-800",
    icon: <AlertCircle className="w-3 h-3" />,
  },
  // New automated outreach statuses
  awaiting_response: {
    label: "Awaiting Response",
    color: "bg-blue-100 text-blue-800",
    icon: <Clock className="w-3 h-3" />,
  },
  follow_up_due: {
    label: "Follow-up Due",
    color: "bg-amber-100 text-amber-800",
    icon: <AlertCircle className="w-3 h-3" />,
  },
  no_contact_ok_close: {
    label: "No Contact - OK to Close",
    color: "bg-red-100 text-red-800",
    icon: <XCircle className="w-3 h-3" />,
  },
  in_communication: {
    label: "In Communication",
    color: "bg-green-100 text-green-800",
    icon: <CheckCircle className="w-3 h-3" />,
  },
};

function StatusBadge({ status }: { status: ClientStatus }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.new;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

// Workflow badge for closed clients
const WORKFLOW_LABELS: Record<string, { label: string; color: string }> = {
  evaluation: { label: "Evaluation", color: "bg-yellow-100 text-yellow-700" },
  outreach: { label: "Outreach", color: "bg-purple-100 text-purple-700" },
  referral: { label: "Referral", color: "bg-amber-100 text-amber-700" },
  scheduling: { label: "Scheduling", color: "bg-teal-100 text-teal-700" },
  other: { label: "Other", color: "bg-gray-100 text-gray-600" },
};

function ClientRow({
  client,
  onReopenClick,
}: {
  client: Client;
  onReopenClick?: (client: Client) => void;
}) {
  const isClosed = isClosedStatus(client.status);

  return (
    <div className="hover:bg-gray-50 transition-colors flex items-center">
      <Link
        href={`/clients/${client.id}`}
        className="flex-1 px-6 py-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${isClosed ? "bg-gray-100 text-gray-500" : "bg-blue-100 text-blue-600"}`}>
            {client.firstName[0]}
            {client.lastName[0]}
          </div>
          <div>
            <div className="font-medium text-gray-900">
              {client.firstName} {client.lastName}
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {client.email}
              </span>
              {client.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {client.phone}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {client.requestedClinician && (
            <div className="text-sm text-gray-600">
              <span className="text-gray-400">Preferred:</span> {client.requestedClinician}
            </div>
          )}
          <StatusBadge status={client.status} />
          {/* Show workflow badge for closed clients */}
          {isClosed && client.closedFromWorkflow && (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${WORKFLOW_LABELS[client.closedFromWorkflow]?.color || WORKFLOW_LABELS.other.color}`}>
              {WORKFLOW_LABELS[client.closedFromWorkflow]?.label || "Unknown"}
            </span>
          )}
          <div className="text-sm text-gray-500">
            {formatRelativeTime(client.createdAt)}
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
      </Link>
      {/* Reopen button for closed clients */}
      {isClosed && onReopenClick && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onReopenClick(client);
          }}
          className="mr-4 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-1.5"
        >
          <RotateCcw className="w-4 h-4" />
          Reopen
        </button>
      )}
    </div>
  );
}

export default function ClientsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClientStatus | "all" | "closed">("all");
  const [reopenClient, setReopenClient] = useState<Client | null>(null);
  const { data: clients, isLoading, error, refetch } = useClients();

  // Filter clients based on search and status
  const filteredClients = clients?.filter((client) => {
    const matchesSearch =
      searchQuery === "" ||
      `${client.firstName} ${client.lastName}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      client.email.toLowerCase().includes(searchQuery.toLowerCase());

    // Handle special "closed" filter
    let matchesStatus = true;
    if (statusFilter === "closed") {
      matchesStatus = isClosedStatus(client.status);
    } else if (statusFilter !== "all") {
      matchesStatus = client.status === statusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  // Group clients by status for stats
  const statusCounts = clients?.reduce(
    (acc, client) => {
      acc[client.status] = (acc[client.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Count closed clients
  const closedCount = clients?.filter((c) => isClosedStatus(c.status)).length || 0;

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>Failed to load clients. Please try again.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-600">
            {clients?.length || 0} total clients
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" />
          Add Client
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600">
            {statusCounts?.new || 0}
          </div>
          <div className="text-sm text-blue-800">New</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-600">
            {statusCounts?.pending_outreach || 0}
          </div>
          <div className="text-sm text-purple-800">Ready for Outreach</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-orange-600">
            {(statusCounts?.follow_up_1 || 0) + (statusCounts?.follow_up_2 || 0)}
          </div>
          <div className="text-sm text-orange-800">Follow-ups Due</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-600">
            {statusCounts?.replied || 0}
          </div>
          <div className="text-sm text-green-800">Replied</div>
        </div>
        <div className="bg-teal-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-teal-600">
            {statusCounts?.ready_to_schedule || 0}
          </div>
          <div className="text-sm text-teal-800">Ready to Schedule</div>
        </div>
        <button
          onClick={() => setStatusFilter("closed")}
          className={`rounded-lg p-4 text-left transition-colors ${statusFilter === "closed" ? "bg-gray-200 ring-2 ring-gray-400" : "bg-gray-50 hover:bg-gray-100"}`}
        >
          <div className="text-2xl font-bold text-gray-600">
            {closedCount}
          </div>
          <div className="text-sm text-gray-700 flex items-center gap-1">
            <Archive className="w-3 h-3" />
            Closed
          </div>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as ClientStatus | "all" | "closed")
              }
              className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="closed">All Closed ({closedCount})</option>
              <optgroup label="Active Statuses">
                {Object.entries(STATUS_CONFIG)
                  .filter(([value]) => !CLOSED_STATUSES.includes(value as ClientStatus))
                  .map(([value, config]) => (
                    <option key={value} value={value}>
                      {config.label}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Closed Statuses">
                {Object.entries(STATUS_CONFIG)
                  .filter(([value]) => CLOSED_STATUSES.includes(value as ClientStatus))
                  .map(([value, config]) => (
                    <option key={value} value={value}>
                      {config.label}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>
        </div>

        {/* Client List */}
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading clients...</p>
          </div>
        ) : filteredClients?.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchQuery || statusFilter !== "all"
              ? "No clients match your filters."
              : "No clients yet. Add your first client to get started."}
          </div>
        ) : (
          <div className="divide-y">
            {filteredClients?.map((client) => (
              <ClientRow
                key={client.id}
                client={client}
                onReopenClick={
                  isClosedStatus(client.status) ? setReopenClient : undefined
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Reopen Case Modal */}
      {reopenClient && (
        <ReopenCaseModal
          client={reopenClient}
          isOpen={!!reopenClient}
          onClose={() => setReopenClient(null)}
          onSuccess={refetch}
        />
      )}
    </div>
  );
}
