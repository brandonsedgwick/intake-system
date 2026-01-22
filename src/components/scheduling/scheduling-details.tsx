"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Client, ScheduledAppointment, SchedulingProgress, OfferedSlot } from "@/types/client";
import { cn, formatDate } from "@/lib/utils";
import {
  Calendar,
  User,
  ClipboardCheck,
  MessageSquare,
  Mail,
  RefreshCw,
  FileText,
  Check,
  ExternalLink,
  XCircle,
  MessagesSquare,
  Clock,
  Plus,
} from "lucide-react";

// Type for the boolean progress steps (not the timestamp fields)
type SchedulingProgressStep = "clientCreated" | "screenerUploaded" | "appointmentCreated" | "finalized";

interface SchedulingDetailsProps {
  client: Client;
  onProgressUpdate: (
    clientId: string,
    step: SchedulingProgressStep,
    value: boolean
  ) => void;
  onFinalize: (clientId: string) => void;
  onOpenCommunicationsModal?: () => void;
  onOfferNewAvailability?: () => void; // TODO: Implement Offer New Availability feature
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

// Format recurrence pattern for display
function formatRecurrence(recurrence: string | undefined): string {
  if (!recurrence) return "—";
  switch (recurrence) {
    case "weekly":
      return "Weekly";
    case "bi-weekly":
      return "Bi-Weekly";
    case "monthly":
      return "Monthly";
    case "one-time":
      return "One-Time";
    default:
      return recurrence;
  }
}

// Parse offered availability from client
function parseOfferedSlots(client: Client): OfferedSlot[] {
  if (!client.offeredAvailability) return [];
  try {
    return JSON.parse(client.offeredAvailability) as OfferedSlot[];
  } catch {
    return [];
  }
}

export function SchedulingDetails({
  client,
  onProgressUpdate,
  onFinalize,
  onOpenCommunicationsModal,
  onOfferNewAvailability,
}: SchedulingDetailsProps) {
  const appointment = parseScheduledAppointment(client);
  const progress = parseSchedulingProgress(client);
  const initials = getInitials(client.firstName, client.lastName);
  const offeredSlots = parseOfferedSlots(client);

  // Group offered slots by date
  const slotsByDate = useMemo(() => {
    return offeredSlots.reduce((acc, slot) => {
      const date = new Date(slot.offeredAt).toLocaleDateString();
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(slot);
      return acc;
    }, {} as Record<string, OfferedSlot[]>);
  }, [offeredSlots]);

  // Progress steps
  const progressSteps = [
    {
      key: "clientCreated" as const,
      label: "Create Client in SimplePractice",
      completed: progress.clientCreated,
    },
    {
      key: "screenerUploaded" as const,
      label: "Upload Screener Documents",
      completed: progress.screenerUploaded,
    },
    {
      key: "appointmentCreated" as const,
      label: "Create Appointment",
      completed: progress.appointmentCreated,
    },
    {
      key: "finalized" as const,
      label: "Finalize & Close",
      completed: progress.finalized,
    },
  ];

  const completedSteps = progressSteps.filter((s) => s.completed).length;

  return (
    <div className="bg-white rounded-xl border shadow-sm flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-semibold text-xl">
            {initials}
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {client.firstName} {client.lastName}
            </h2>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>{client.email}</span>
              {client.phone && (
                <>
                  <span>&bull;</span>
                  <span>{client.phone}</span>
                </>
              )}
              <span>&bull;</span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-medium",
                  client.status === "awaiting_scheduling"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-green-100 text-green-700"
                )}
              >
                {client.status === "awaiting_scheduling"
                  ? "Awaiting Scheduling"
                  : "Ready to Schedule"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/clients/${client.id}`}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors inline-flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            View Full Profile
          </Link>
          <button className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            Close Case
          </button>
        </div>
      </div>

      {/* Quick Action Bar */}
      <div className="px-6 py-3 border-b flex-shrink-0 bg-gray-50 flex items-center gap-3">
        <button
          onClick={onOpenCommunicationsModal}
          className="px-4 py-2 text-sm font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-lg transition-colors inline-flex items-center gap-2"
        >
          <MessagesSquare className="w-4 h-4" />
          View Communications
        </button>
      </div>

      {/* Details Content Grid */}
      <div className="p-6 grid grid-cols-3 gap-6 flex-1 overflow-y-auto">
        {/* Appointment Details */}
        <div className="bg-green-50 rounded-lg p-4 border border-green-100">
          <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Appointment Details
          </h3>
          {appointment ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-green-700">Day</dt>
                <dd className="text-green-900 font-medium">{appointment.day}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-green-700">Time</dt>
                <dd className="text-green-900 font-medium">{appointment.time}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-green-700">Clinician</dt>
                <dd className="text-green-900 font-medium">
                  {appointment.clinician}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-green-700">Recurrence</dt>
                <dd className="text-green-900 font-medium">
                  {formatRecurrence(appointment.recurrence)}
                </dd>
              </div>
              {appointment.startDate && (
                <div className="flex justify-between">
                  <dt className="text-green-700">Start Date</dt>
                  <dd className="text-green-900 font-medium">
                    {formatDate(appointment.startDate)}
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-green-700 italic">
              No appointment details available
            </p>
          )}
        </div>

        {/* Client Info */}
        <div className="bg-white rounded-lg p-4 border">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            Client Information
          </h3>
          <dl className="space-y-2 text-sm">
            {client.age && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Age</dt>
                <dd className="text-gray-900">{client.age}</dd>
              </div>
            )}
            {client.insuranceProvider && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Insurance</dt>
                <dd className="text-gray-900">{client.insuranceProvider}</dd>
              </div>
            )}
            {client.insuranceMemberId && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Member ID</dt>
                <dd className="text-gray-900">{client.insuranceMemberId}</dd>
              </div>
            )}
            {client.paymentType && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Payment Type</dt>
                <dd className="text-gray-900">{client.paymentType}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Scheduling Progress */}
        <div className="bg-white rounded-lg p-4 border">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-gray-400" />
            Scheduling Progress
            <span className="ml-auto text-xs font-normal text-gray-500">
              {completedSteps}/{progressSteps.length}
            </span>
          </h3>
          <div className="space-y-3">
            {progressSteps.map((step, index) => (
              <div key={step.key} className="flex items-center gap-3">
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center",
                    step.completed
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-500"
                  )}
                >
                  {step.completed ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span className="text-xs">{index + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-sm",
                    step.completed ? "text-gray-900" : "text-gray-600"
                  )}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Communication Note (if exists) */}
        {appointment?.communicationNote && (
          <div className="col-span-2 bg-amber-50 rounded-lg p-4 border border-amber-100">
            <h3 className="text-sm font-semibold text-amber-800 mb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Communication Note
            </h3>
            <p className="text-sm text-amber-900">
              {appointment.communicationNote}
            </p>
          </div>
        )}

        {/* Offered Availability */}
        <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Offered Availability
              {offeredSlots.length > 0 && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  {offeredSlots.length} slot{offeredSlots.length !== 1 ? "s" : ""}
                </span>
              )}
            </h3>
            <button
              onClick={onOfferNewAvailability}
              className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Offer New Availability
            </button>
          </div>
          {offeredSlots.length > 0 ? (
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {Object.entries(slotsByDate)
                .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                .map(([date, slots]) => (
                  <div key={date}>
                    <p className="text-xs font-medium text-amber-700 mb-1">
                      Offered {date}
                    </p>
                    <ul className="space-y-1">
                      {slots.map((slot, idx) => (
                        <li
                          key={`${slot.slotId}-${idx}`}
                          className="text-sm text-amber-900 flex items-start gap-2 bg-white/50 rounded px-2 py-1"
                        >
                          <span className="text-amber-500 mt-0.5">•</span>
                          <span>
                            {slot.day} at {slot.time}
                            <span className="text-amber-700 ml-1">
                              — {slot.clinicians.join(", ")}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-amber-700 italic">
              No availability has been offered yet
            </p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg p-4 border">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            Quick Actions
          </h3>
          <div className="space-y-2">
            <button className="w-full px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-400" />
              Send Confirmation Email
            </button>
            <button className="w-full px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-gray-400" />
              Reschedule
            </button>
            <button className="w-full px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              Add Note
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
