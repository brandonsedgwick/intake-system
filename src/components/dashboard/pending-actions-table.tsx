"use client";

import Link from "next/link";
import { useClients } from "@/hooks/use-clients";
import { Client, ClientStatus } from "@/types/client";
import { formatRelativeTime } from "@/lib/utils";

const statusConfig: Record<
  ClientStatus,
  { label: string; bgColor: string; textColor: string }
> = {
  new: { label: "New", bgColor: "bg-blue-100", textColor: "text-blue-700" },
  pending_evaluation: {
    label: "Evaluating",
    bgColor: "bg-purple-100",
    textColor: "text-purple-700",
  },
  pending_outreach: {
    label: "Pending Outreach",
    bgColor: "bg-purple-100",
    textColor: "text-purple-700",
  },
  outreach_sent: {
    label: "Outreach Sent",
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-700",
  },
  follow_up_1: {
    label: "Follow-up 1",
    bgColor: "bg-orange-100",
    textColor: "text-orange-700",
  },
  follow_up_2: {
    label: "Follow-up 2",
    bgColor: "bg-red-100",
    textColor: "text-red-700",
  },
  replied: {
    label: "Replied",
    bgColor: "bg-green-100",
    textColor: "text-green-700",
  },
  ready_to_schedule: {
    label: "Ready",
    bgColor: "bg-teal-100",
    textColor: "text-teal-700",
  },
  scheduled: {
    label: "Scheduled",
    bgColor: "bg-emerald-100",
    textColor: "text-emerald-700",
  },
  completed: {
    label: "Completed",
    bgColor: "bg-gray-100",
    textColor: "text-gray-700",
  },
  pending_referral: {
    label: "Pending Referral",
    bgColor: "bg-amber-100",
    textColor: "text-amber-700",
  },
  referred: {
    label: "Referred",
    bgColor: "bg-slate-100",
    textColor: "text-slate-700",
  },
  closed_no_contact: {
    label: "Closed",
    bgColor: "bg-gray-100",
    textColor: "text-gray-600",
  },
  closed_other: {
    label: "Closed",
    bgColor: "bg-gray-100",
    textColor: "text-gray-600",
  },
  duplicate: {
    label: "Duplicate",
    bgColor: "bg-orange-100",
    textColor: "text-orange-700",
  },
};

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
}

function getAvatarColor(name: string) {
  const colors = [
    "bg-purple-100 text-purple-600",
    "bg-green-100 text-green-600",
    "bg-orange-100 text-orange-600",
    "bg-blue-100 text-blue-600",
    "bg-pink-100 text-pink-600",
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

// Filter for clients that need action
function needsAction(client: Client): boolean {
  const actionableStatuses: ClientStatus[] = [
    "new",
    "pending_evaluation",
    "pending_outreach",
    "outreach_sent",
    "follow_up_1",
    "follow_up_2",
    "replied",
    "ready_to_schedule",
    "pending_referral",
  ];
  return actionableStatuses.includes(client.status);
}

export function PendingActionsTable() {
  const { data: clients, isLoading } = useClients();

  // Filter to actionable clients and sort by status priority
  const pendingClients = clients
    ?.filter(needsAction)
    .sort((a, b) => {
      // Priority order
      const statusOrder: ClientStatus[] = [
        "new",
        "pending_evaluation",
        "replied",
        "ready_to_schedule",
        "pending_outreach",
        "follow_up_1",
        "follow_up_2",
        "outreach_sent",
        "pending_referral",
      ];
      return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
    })
    .slice(0, 10); // Show top 10

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Pending Actions</h2>
        </div>
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Pending Actions</h2>
        <span className="text-sm text-gray-500">
          {pendingClients?.length || 0} items
        </span>
      </div>

      {!pendingClients || pendingClients.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <p>No pending actions right now.</p>
          <p className="text-sm mt-1">All caught up!</p>
        </div>
      ) : (
        <div className="overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Client
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Payment
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Added
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Preferred Clinician
                </th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {pendingClients?.map((client) => {
                const status = statusConfig[client.status] || statusConfig.new;
                const initials = getInitials(client.firstName, client.lastName);
                const avatarColor = getAvatarColor(client.firstName);

                return (
                  <tr
                    key={client.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={`/clients/${client.id}`}
                        className="flex items-center gap-3"
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${avatarColor}`}
                        >
                          {initials}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 hover:text-blue-600">
                            {client.firstName} {client.lastName}
                          </p>
                          <p className="text-xs text-gray-500">{client.email}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bgColor} ${status.textColor}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {client.paymentType || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatRelativeTime(client.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {client.requestedClinician || "-"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/clients/${client.id}`}
                        className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-6 py-4 border-t border-gray-200">
        <Link
          href="/clients"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          View all clients &rarr;
        </Link>
      </div>
    </div>
  );
}
