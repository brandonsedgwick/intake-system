"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Client, ScheduledAppointment, SchedulingProgress } from "@/types/client";
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

export function SchedulingDetails({
  client,
  onProgressUpdate,
  onFinalize,
}: SchedulingDetailsProps) {
  const appointment = parseScheduledAppointment(client);
  const progress = parseSchedulingProgress(client);
  const initials = getInitials(client.firstName, client.lastName);

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
    <div className="bg-white rounded-xl border shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between">
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

      {/* Details Content Grid */}
      <div className="p-6 grid grid-cols-3 gap-6">
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

        {/* Quick Actions */}
        <div
          className={cn(
            "bg-white rounded-lg p-4 border",
            appointment?.communicationNote ? "" : "col-span-1"
          )}
        >
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
