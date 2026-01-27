"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Client,
  OfferedSlot,
  ScheduledAppointment,
  RecurrencePattern,
  Clinician,
} from "@/types/client";
import { useClinicians } from "@/hooks/use-clinicians";
import { formatDate, cn, formatDateForDisplay } from "@/lib/utils";
import {
  X,
  Calendar,
  Clock,
  User,
  Loader2,
  AlertCircle,
  MessageSquare,
  Check,
  ChevronDown,
} from "lucide-react";

// Days of the week for dropdown
const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

// Time options for dropdown (8 AM to 7 PM in 30 min increments)
const TIME_OPTIONS = [
  "8:00 AM",
  "8:30 AM",
  "9:00 AM",
  "9:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
  "2:30 PM",
  "3:00 PM",
  "3:30 PM",
  "4:00 PM",
  "4:30 PM",
  "5:00 PM",
  "5:30 PM",
  "6:00 PM",
  "6:30 PM",
  "7:00 PM",
];

// Recurrence options
const RECURRENCE_OPTIONS: { value: RecurrencePattern; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "bi-weekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "one-time", label: "One-time" },
];

interface SchedulingModalProps {
  client: Client;
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (appointment: ScheduledAppointment) => Promise<void>;
  isLoading?: boolean;
}

export function SchedulingModal({
  client,
  isOpen,
  onClose,
  onSchedule,
  isLoading = false,
}: SchedulingModalProps) {
  // Fetch clinicians for dropdown
  const { data: clinicians, isLoading: cliniciansLoading } = useClinicians();

  // Form state
  const [selectionMode, setSelectionMode] = useState<"offered" | "custom">("offered");
  const [selectedOfferedSlotId, setSelectedOfferedSlotId] = useState<string | null>(null);
  const [selectedClinicianForSlot, setSelectedClinicianForSlot] = useState<string>("");

  // Custom entry state
  const [customClinician, setCustomClinician] = useState<string>("");
  const [customDay, setCustomDay] = useState<string>("");
  const [customTime, setCustomTime] = useState<string>("");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customRecurrence, setCustomRecurrence] = useState<RecurrencePattern>("weekly");

  // Communication note (required if client status is not "in_communication")
  const [communicationNote, setCommunicationNote] = useState<string>("");

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Whether communication note is required
  const requiresCommunicationNote = client.status !== "in_communication";

  // Parse offered slots from client
  const offeredSlots: OfferedSlot[] = useMemo(() => {
    if (!client.offeredAvailability) return [];
    try {
      return JSON.parse(client.offeredAvailability);
    } catch {
      return [];
    }
  }, [client.offeredAvailability]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectionMode(offeredSlots.length > 0 ? "offered" : "custom");
      setSelectedOfferedSlotId(null);
      setSelectedClinicianForSlot("");
      setCustomClinician("");
      setCustomDay("");
      setCustomTime("");
      setCustomStartDate("");
      setCustomRecurrence("weekly");
      setCommunicationNote("");
      setError(null);
    }
  }, [isOpen, offeredSlots.length]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  // Get selected offered slot details
  const selectedOfferedSlot = useMemo(() => {
    if (!selectedOfferedSlotId) return null;
    return offeredSlots.find((slot) => slot.slotId === selectedOfferedSlotId) || null;
  }, [selectedOfferedSlotId, offeredSlots]);

  // Validate form
  const validateForm = (): boolean => {
    setError(null);

    // Check communication note if required
    if (requiresCommunicationNote && communicationNote.trim().length < 10) {
      setError("Please explain how the client communicated (at least 10 characters)");
      return false;
    }

    if (selectionMode === "offered") {
      if (!selectedOfferedSlotId) {
        setError("Please select an offered time slot");
        return false;
      }
      if (selectedOfferedSlot && selectedOfferedSlot.clinicians.length > 1 && !selectedClinicianForSlot) {
        setError("Please select a clinician for this slot");
        return false;
      }
      if (!customStartDate) {
        setError("Please select a start date");
        return false;
      }
      // Validate start date matches the offered slot's day
      if (selectedOfferedSlot) {
        const startDateObj = new Date(customStartDate + "T12:00:00");
        const startDayOfWeek = DAYS_OF_WEEK[startDateObj.getDay() === 0 ? 6 : startDateObj.getDay() - 1];
        if (startDayOfWeek !== selectedOfferedSlot.day) {
          setError(`Start date falls on ${startDayOfWeek}, but the slot is for ${selectedOfferedSlot.day}. Please adjust.`);
          return false;
        }
        // Check if start date is in the future
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (startDateObj < today) {
          setError("Start date must be in the future");
          return false;
        }
      }
    } else {
      // Custom mode validation
      if (!customClinician) {
        setError("Please select a clinician");
        return false;
      }
      if (!customDay) {
        setError("Please select a day");
        return false;
      }
      if (!customTime) {
        setError("Please select a time");
        return false;
      }
      if (!customStartDate) {
        setError("Please select a start date");
        return false;
      }

      // Check if start date day matches selected day
      const startDateObj = new Date(customStartDate + "T12:00:00"); // Add time to avoid timezone issues
      const startDayOfWeek = DAYS_OF_WEEK[startDateObj.getDay() === 0 ? 6 : startDateObj.getDay() - 1];
      if (startDayOfWeek !== customDay) {
        setError(`Start date falls on ${startDayOfWeek}, but you selected ${customDay}. Please adjust.`);
        return false;
      }

      // Check if start date is in the future
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (startDateObj < today) {
        setError("Start date must be in the future");
        return false;
      }
    }

    return true;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      const appointment: ScheduledAppointment = selectionMode === "offered"
        ? {
            slotId: selectedOfferedSlotId!,
            day: selectedOfferedSlot!.day,
            time: selectedOfferedSlot!.time,
            clinician: selectedOfferedSlot!.clinicians.length === 1
              ? selectedOfferedSlot!.clinicians[0]
              : selectedClinicianForSlot,
            startDate: customStartDate || new Date().toISOString().split("T")[0],
            recurrence: customRecurrence,
            scheduledAt: new Date().toISOString(),
            fromOfferedSlot: true,
            communicationNote: requiresCommunicationNote ? communicationNote.trim() : undefined,
          }
        : {
            day: customDay,
            time: customTime,
            clinician: customClinician,
            startDate: customStartDate,
            recurrence: customRecurrence,
            scheduledAt: new Date().toISOString(),
            fromOfferedSlot: false,
            communicationNote: requiresCommunicationNote ? communicationNote.trim() : undefined,
          };

      await onSchedule(appointment);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule appointment");
    }
  };

  // Generate preview text
  const getPreviewText = (): string | null => {
    if (selectionMode === "offered" && selectedOfferedSlot) {
      const clinician = selectedOfferedSlot.clinicians.length === 1
        ? selectedOfferedSlot.clinicians[0]
        : selectedClinicianForSlot || "TBD";
      return `Every ${selectedOfferedSlot.day} at ${selectedOfferedSlot.time} with ${clinician}`;
    }
    if (selectionMode === "custom" && customDay && customTime && customClinician) {
      const recurrenceLabel = RECURRENCE_OPTIONS.find((r) => r.value === customRecurrence)?.label || customRecurrence;
      const dateStr = customStartDate
        ? new Date(customStartDate + "T12:00:00").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })
        : "";
      return `${recurrenceLabel} on ${customDay}s at ${customTime} with ${customClinician}${dateStr ? `, starting ${dateStr}` : ""}`;
    }
    return null;
  };

  if (!isOpen) return null;

  const previewText = getPreviewText();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-xl shadow-2xl max-w-xl w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-b px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Move to Scheduling
                </h2>
                <p className="text-sm text-gray-500">
                  {client.firstName} {client.lastName}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Communication Note (required if not in_communication) */}
              {requiresCommunicationNote && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-amber-800">
                        Communication Method Required
                      </h4>
                      <p className="text-sm text-amber-700 mt-1 mb-3">
                        Since the client hasn't replied via email, please explain how they communicated (phone call, text, in-person, etc.)
                      </p>
                      <textarea
                        value={communicationNote}
                        onChange={(e) => setCommunicationNote(e.target.value)}
                        placeholder="e.g., Client called on 1/20 and confirmed Monday 9AM works for them..."
                        className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none text-sm"
                        rows={3}
                      />
                      <p className="mt-1 text-xs text-amber-600">
                        Minimum 10 characters ({communicationNote.trim().length}/10)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Selection Mode Toggle */}
              {offeredSlots.length > 0 && (
                <div className="space-y-4">
                  {/* Offered Slots Option */}
                  <label
                    className={cn(
                      "flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all",
                      selectionMode === "offered"
                        ? "border-green-500 bg-green-50 ring-2 ring-green-200"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <input
                      type="radio"
                      name="selectionMode"
                      value="offered"
                      checked={selectionMode === "offered"}
                      onChange={() => setSelectionMode("offered")}
                      className="mt-1 text-green-600 focus:ring-green-500"
                    />
                    <div className="flex-1">
                      <span className="font-medium text-gray-900">
                        Select from offered times
                      </span>
                      <p className="text-sm text-gray-500 mt-1">
                        Choose from the times already offered to this client
                      </p>
                    </div>
                  </label>

                  {/* Offered Slots List */}
                  {selectionMode === "offered" && (
                    <div className="ml-7 space-y-3">
                      {offeredSlots.map((slot) => (
                        <div
                          key={slot.slotId}
                          className={cn(
                            "p-3 border rounded-lg transition-all",
                            selectedOfferedSlotId === slot.slotId
                              ? "border-green-500 bg-green-50"
                              : "border-gray-200 hover:border-gray-300"
                          )}
                        >
                          <label className="flex items-start gap-3 cursor-pointer">
                            <input
                              type="radio"
                              name="offeredSlot"
                              value={slot.slotId}
                              checked={selectedOfferedSlotId === slot.slotId}
                              onChange={() => {
                                setSelectedOfferedSlotId(slot.slotId);
                                if (slot.clinicians.length === 1) {
                                  setSelectedClinicianForSlot(slot.clinicians[0]);
                                } else {
                                  setSelectedClinicianForSlot("");
                                }
                                // Pre-populate start date from offered slot if available
                                if (slot.startDate) {
                                  setCustomStartDate(slot.startDate);
                                }
                              }}
                              className="mt-1 text-green-600 focus:ring-green-500"
                            />
                            <div className="flex-1">
                              <span className="font-medium text-gray-900">
                                {slot.day} at {slot.time}
                              </span>
                              <p className="text-sm text-gray-500">
                                {slot.clinicians.length === 1
                                  ? `Clinician: ${slot.clinicians[0]}`
                                  : `Clinicians: ${slot.clinicians.join(", ")}`}
                              </p>
                              {slot.startDate && (
                                <p className="text-sm text-green-600 mt-1">
                                  Starting: {formatDateForDisplay(slot.startDate)}
                                </p>
                              )}
                            </div>
                          </label>

                          {/* Clinician dropdown if multiple */}
                          {selectedOfferedSlotId === slot.slotId && slot.clinicians.length > 1 && (
                            <div className="mt-3 ml-7">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Select Clinician <span className="text-red-500">*</span>
                              </label>
                              <select
                                value={selectedClinicianForSlot}
                                onChange={(e) => setSelectedClinicianForSlot(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-sm"
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
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Start Date and Recurrence for Offered Slots */}
                  {selectionMode === "offered" && selectedOfferedSlotId && (
                    <div className="ml-7 space-y-4 mt-4 pt-4 border-t border-gray-200">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Start Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          min={new Date().toISOString().split("T")[0]}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          The first appointment date. Pre-populated from offered availability.
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Recurrence <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={customRecurrence}
                          onChange={(e) => setCustomRecurrence(e.target.value as RecurrencePattern)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        >
                          {RECURRENCE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Custom Entry Option */}
                  <label
                    className={cn(
                      "flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all",
                      selectionMode === "custom"
                        ? "border-green-500 bg-green-50 ring-2 ring-green-200"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <input
                      type="radio"
                      name="selectionMode"
                      value="custom"
                      checked={selectionMode === "custom"}
                      onChange={() => setSelectionMode("custom")}
                      className="mt-1 text-green-600 focus:ring-green-500"
                    />
                    <div className="flex-1">
                      <span className="font-medium text-gray-900">
                        Enter custom time
                      </span>
                      <p className="text-sm text-gray-500 mt-1">
                        Manually enter an agreed-upon appointment time
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Custom Entry Form */}
              {(selectionMode === "custom" || offeredSlots.length === 0) && (
                <div className="space-y-4">
                  {offeredSlots.length === 0 && (
                    <p className="text-sm text-gray-500">
                      No times have been offered to this client yet. Enter the agreed-upon appointment details below.
                    </p>
                  )}

                  {/* Clinician */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Clinician <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={customClinician}
                      onChange={(e) => setCustomClinician(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      disabled={cliniciansLoading}
                    >
                      <option value="">Select clinician...</option>
                      {clinicians?.map((clinician) => (
                        <option key={clinician.id} value={`${clinician.firstName} ${clinician.lastName}`}>
                          {clinician.firstName} {clinician.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Day and Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Day <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={customDay}
                        onChange={(e) => setCustomDay(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      >
                        <option value="">Select day...</option>
                        {DAYS_OF_WEEK.map((day) => (
                          <option key={day} value={day}>
                            {day}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Time <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={customTime}
                        onChange={(e) => setCustomTime(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      >
                        <option value="">Select time...</option>
                        {TIME_OPTIONS.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Start Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>

                  {/* Recurrence */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Recurrence <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={customRecurrence}
                      onChange={(e) => setCustomRecurrence(e.target.value as RecurrencePattern)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      {RECURRENCE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Preview */}
              {previewText && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-1">
                    Appointment Preview
                  </h4>
                  <p className="text-sm text-gray-900">
                    {previewText}
                  </p>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t px-6 py-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Move to Scheduling
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
