"use client";

import { useMemo } from "react";
import { Client, ScheduledAppointment, SchedulingProgress } from "@/types/client";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

// Type for the boolean progress steps (not the timestamp fields)
type SchedulingProgressStep = "clientCreated" | "screenerUploaded" | "appointmentCreated" | "finalized";

interface SchedulingTableProps {
  clients: Client[];
  selectedClientId: string | null;
  onSelectClient: (clientId: string) => void;
  onProgressUpdate: (
    clientId: string,
    step: SchedulingProgressStep,
    value: boolean
  ) => void;
  onFinalize: (clientId: string) => void;
  onCreateClient: (clientId: string) => void;
}

// Get initials from name
function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
}

// Parse scheduled appointment from client
function parseScheduledAppointment(
  client: Client
): ScheduledAppointment | null {
  if (!client.scheduledAppointment) return null;
  try {
    return JSON.parse(client.scheduledAppointment) as ScheduledAppointment;
  } catch {
    return null;
  }
}

// Parse scheduling progress from client
function parseSchedulingProgress(client: Client): SchedulingProgress {
  if (!client.schedulingProgress) {
    return {
      clientCreated: false,
      screenerUploaded: false,
      appointmentCreated: false,
      finalized: false,
    };
  }
  try {
    return JSON.parse(client.schedulingProgress) as SchedulingProgress;
  } catch {
    return {
      clientCreated: false,
      screenerUploaded: false,
      appointmentCreated: false,
      finalized: false,
    };
  }
}

// Action button component
interface ActionButtonProps {
  label: string;
  isDone: boolean;
  colorClass: string;
  hoverClass: string;
  onClick: () => void;
  disabled?: boolean;
}

function ActionButton({
  label,
  isDone,
  colorClass,
  hoverClass,
  onClick,
  disabled,
}: ActionButtonProps) {
  if (isDone) {
    return (
      <span className="px-3 py-1.5 text-xs font-medium text-green-600 inline-flex items-center gap-1">
        <Check className="w-4 h-4" />
        Done
      </span>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      className={cn(
        "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
        disabled
          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
          : `${colorClass} ${hoverClass}`
      )}
    >
      {label}
    </button>
  );
}

export function SchedulingTable({
  clients,
  selectedClientId,
  onSelectClient,
  onProgressUpdate,
  onFinalize,
  onCreateClient,
}: SchedulingTableProps) {
  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Client Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Therapist
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Day & Time
            </th>
            <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Create Client
            </th>
            <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Upload Screener
            </th>
            <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Create Appointment
            </th>
            <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Finalize
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {clients.map((client) => {
            const isSelected = client.id === selectedClientId;
            const appointment = parseScheduledAppointment(client);
            const progress = parseSchedulingProgress(client);
            const initials = getInitials(client.firstName, client.lastName);

            return (
              <tr
                key={client.id}
                onClick={() => onSelectClient(client.id)}
                className={cn(
                  "cursor-pointer transition-colors",
                  isSelected
                    ? "bg-green-50 border-l-4 border-l-green-500"
                    : "hover:bg-gray-50"
                )}
              >
                {/* Client Name */}
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm",
                        isSelected
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      )}
                    >
                      {initials}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {client.firstName} {client.lastName}
                      </p>
                      <p className="text-xs text-gray-500">{client.email}</p>
                    </div>
                  </div>
                </td>

                {/* Status */}
                <td className="px-6 py-4">
                  <span
                    className={cn(
                      "px-2.5 py-1 text-xs font-medium rounded-full",
                      client.status === "awaiting_scheduling"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-green-100 text-green-700"
                    )}
                  >
                    {client.status === "awaiting_scheduling"
                      ? "Awaiting Scheduling"
                      : "Ready to Schedule"}
                  </span>
                </td>

                {/* Therapist */}
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-900">
                    {appointment?.clinician || client.assignedClinician || "—"}
                  </span>
                </td>

                {/* Day & Time */}
                <td className="px-6 py-4">
                  {appointment ? (
                    <div className="text-sm">
                      <p className="text-gray-900 font-medium">
                        {appointment.day}
                      </p>
                      <p className="text-gray-500">{appointment.time}</p>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">—</span>
                  )}
                </td>

                {/* Create Client */}
                <td className="px-6 py-4 text-center">
                  <ActionButton
                    label="Create Client"
                    isDone={progress.clientCreated}
                    colorClass="bg-blue-100 text-blue-700"
                    hoverClass="hover:bg-blue-200"
                    onClick={() => onCreateClient(client.id)}
                  />
                </td>

                {/* Upload Screener */}
                <td className="px-6 py-4 text-center">
                  <ActionButton
                    label="Upload Screener"
                    isDone={progress.screenerUploaded}
                    colorClass="bg-purple-100 text-purple-700"
                    hoverClass="hover:bg-purple-200"
                    onClick={() =>
                      onProgressUpdate(client.id, "screenerUploaded", true)
                    }
                  />
                </td>

                {/* Create Appointment */}
                <td className="px-6 py-4 text-center">
                  <ActionButton
                    label="Create Appointment"
                    isDone={progress.appointmentCreated}
                    colorClass="bg-teal-100 text-teal-700"
                    hoverClass="hover:bg-teal-200"
                    onClick={() =>
                      onProgressUpdate(client.id, "appointmentCreated", true)
                    }
                  />
                </td>

                {/* Finalize */}
                <td className="px-6 py-4 text-center">
                  <ActionButton
                    label="Finalize"
                    isDone={progress.finalized}
                    colorClass="bg-green-100 text-green-700"
                    hoverClass="hover:bg-green-200"
                    onClick={() => onFinalize(client.id)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
