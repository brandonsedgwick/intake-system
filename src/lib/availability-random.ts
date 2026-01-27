import { SheetAvailabilitySlot, BookedSlot } from "@/types/client";
import {
  createBookedSet,
  isClinicianBooked,
  matchesClientInsurance,
  isInTimeRange,
  TimeRange,
} from "./availability-analytics";

// Selected slot info (matches existing interface in outreach page)
export interface SelectedSlotInfo {
  slotId: string;
  day: string;
  time: string;
  clinicians: string[];
  startDate?: string;   // ISO date string (YYYY-MM-DD) for earliest appointment start
  weeksAdded?: number;  // Number of additional weeks beyond calculated minimum
}

// Options for random selection
export interface RandomSelectionOptions {
  count: number;
  mode: "full" | "by-clinician" | "by-day";
  clinician?: string; // Required for 'by-clinician' mode
  days?: string[]; // Required for 'by-day' mode
  clientInsurance?: string; // For insurance matching
  onlyInsuranceMatch?: boolean; // Filter to only insurance-matched slots
  excludeOffered?: boolean; // Exclude previously offered slots
  previouslyOffered?: Set<string>; // Set of slot IDs previously offered
  timeRange?: TimeRange; // Optional time filter
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Get available slots (not fully booked) with optional filters
 */
function getAvailableSlots(
  slots: SheetAvailabilitySlot[],
  bookedSlots: BookedSlot[],
  options: {
    clientInsurance?: string;
    onlyInsuranceMatch?: boolean;
    excludeOffered?: boolean;
    previouslyOffered?: Set<string>;
    timeRange?: TimeRange;
    filterClinician?: string;
    filterDays?: string[];
  }
): Array<{ slot: SheetAvailabilitySlot; availableClinicians: string[] }> {
  const bookedSet = createBookedSet(bookedSlots);
  const result: Array<{
    slot: SheetAvailabilitySlot;
    availableClinicians: string[];
  }> = [];

  for (const slot of slots) {
    // Filter by days if specified
    if (
      options.filterDays &&
      options.filterDays.length > 0 &&
      !options.filterDays.includes(slot.day)
    ) {
      continue;
    }

    // Filter by time range if specified
    if (options.timeRange && !isInTimeRange(slot.time, options.timeRange)) {
      continue;
    }

    // Filter by insurance match if required
    if (
      options.onlyInsuranceMatch &&
      options.clientInsurance &&
      !matchesClientInsurance(slot.insurance, options.clientInsurance)
    ) {
      continue;
    }

    // Filter by previously offered if required
    if (
      options.excludeOffered &&
      options.previouslyOffered?.has(slot.id)
    ) {
      continue;
    }

    // Get available clinicians for this slot
    let availableClinicians = slot.clinicians.filter(
      (c) => !isClinicianBooked(bookedSet, slot.id, c)
    );

    // Filter to specific clinician if specified
    if (options.filterClinician) {
      availableClinicians = availableClinicians.filter(
        (c) => c.toLowerCase() === options.filterClinician!.toLowerCase()
      );
    }

    if (availableClinicians.length > 0) {
      result.push({ slot, availableClinicians });
    }
  }

  return result;
}

/**
 * Full Random: Pick N diverse clinician+time combos
 * Prioritizes different days for diversity
 */
export function selectRandomSlotsFull(
  slots: SheetAvailabilitySlot[],
  bookedSlots: BookedSlot[],
  options: RandomSelectionOptions
): SelectedSlotInfo[] {
  const availableSlots = getAvailableSlots(slots, bookedSlots, {
    clientInsurance: options.clientInsurance,
    onlyInsuranceMatch: options.onlyInsuranceMatch,
    excludeOffered: options.excludeOffered,
    previouslyOffered: options.previouslyOffered,
    timeRange: options.timeRange,
  });

  if (availableSlots.length === 0) return [];

  const selected: SelectedSlotInfo[] = [];
  const usedDays = new Set<string>();
  const shuffled = shuffleArray(availableSlots);

  // First pass: try to get different days
  for (const { slot, availableClinicians } of shuffled) {
    if (selected.length >= options.count) break;

    if (!usedDays.has(slot.day)) {
      // Pick a random clinician from available ones
      const randomClinician =
        availableClinicians[
          Math.floor(Math.random() * availableClinicians.length)
        ];

      selected.push({
        slotId: slot.id,
        day: slot.day,
        time: slot.time,
        clinicians: [randomClinician],
      });

      usedDays.add(slot.day);
    }
  }

  // Second pass: fill remaining slots (may repeat days)
  if (selected.length < options.count) {
    const selectedIds = new Set(selected.map((s) => s.slotId));

    for (const { slot, availableClinicians } of shuffled) {
      if (selected.length >= options.count) break;

      if (!selectedIds.has(slot.id)) {
        const randomClinician =
          availableClinicians[
            Math.floor(Math.random() * availableClinicians.length)
          ];

        selected.push({
          slotId: slot.id,
          day: slot.day,
          time: slot.time,
          clinicians: [randomClinician],
        });

        selectedIds.add(slot.id);
      }
    }
  }

  return selected;
}

/**
 * Clinician-first Random: Pick a clinician, then N random times
 */
export function selectRandomTimesForClinician(
  slots: SheetAvailabilitySlot[],
  bookedSlots: BookedSlot[],
  clinician: string,
  count: number,
  options?: {
    clientInsurance?: string;
    onlyInsuranceMatch?: boolean;
    excludeOffered?: boolean;
    previouslyOffered?: Set<string>;
    timeRange?: TimeRange;
  }
): SelectedSlotInfo[] {
  const availableSlots = getAvailableSlots(slots, bookedSlots, {
    ...options,
    filterClinician: clinician,
  });

  if (availableSlots.length === 0) return [];

  const shuffled = shuffleArray(availableSlots);
  const selected: SelectedSlotInfo[] = [];
  const usedDays = new Set<string>();

  // First pass: try to get different days
  for (const { slot } of shuffled) {
    if (selected.length >= count) break;

    if (!usedDays.has(slot.day)) {
      selected.push({
        slotId: slot.id,
        day: slot.day,
        time: slot.time,
        clinicians: [clinician],
      });
      usedDays.add(slot.day);
    }
  }

  // Second pass: fill remaining (may repeat days)
  if (selected.length < count) {
    const selectedIds = new Set(selected.map((s) => s.slotId));

    for (const { slot } of shuffled) {
      if (selected.length >= count) break;

      if (!selectedIds.has(slot.id)) {
        selected.push({
          slotId: slot.id,
          day: slot.day,
          time: slot.time,
          clinicians: [clinician],
        });
        selectedIds.add(slot.id);
      }
    }
  }

  return selected;
}

/**
 * Day-first Random: Pick day(s), then N random clinician+time combos
 */
export function selectRandomSlotsForDays(
  slots: SheetAvailabilitySlot[],
  bookedSlots: BookedSlot[],
  days: string[],
  count: number,
  options?: {
    clientInsurance?: string;
    onlyInsuranceMatch?: boolean;
    excludeOffered?: boolean;
    previouslyOffered?: Set<string>;
    timeRange?: TimeRange;
  }
): SelectedSlotInfo[] {
  const availableSlots = getAvailableSlots(slots, bookedSlots, {
    ...options,
    filterDays: days,
  });

  if (availableSlots.length === 0) return [];

  const shuffled = shuffleArray(availableSlots);
  const selected: SelectedSlotInfo[] = [];
  const usedClinicians = new Set<string>();

  // First pass: try to get different clinicians
  for (const { slot, availableClinicians } of shuffled) {
    if (selected.length >= count) break;

    // Find a clinician we haven't used yet
    const unusedClinician = availableClinicians.find(
      (c) => !usedClinicians.has(c)
    );

    if (unusedClinician) {
      selected.push({
        slotId: slot.id,
        day: slot.day,
        time: slot.time,
        clinicians: [unusedClinician],
      });
      usedClinicians.add(unusedClinician);
    }
  }

  // Second pass: fill remaining (may repeat clinicians)
  if (selected.length < count) {
    const selectedIds = new Set(selected.map((s) => s.slotId));

    for (const { slot, availableClinicians } of shuffled) {
      if (selected.length >= count) break;

      if (!selectedIds.has(slot.id)) {
        const randomClinician =
          availableClinicians[
            Math.floor(Math.random() * availableClinicians.length)
          ];

        selected.push({
          slotId: slot.id,
          day: slot.day,
          time: slot.time,
          clinicians: [randomClinician],
        });
        selectedIds.add(slot.id);
      }
    }
  }

  return selected;
}

/**
 * Main random selection function that dispatches to the appropriate mode
 */
export function selectRandomSlots(
  slots: SheetAvailabilitySlot[],
  bookedSlots: BookedSlot[],
  options: RandomSelectionOptions
): SelectedSlotInfo[] {
  switch (options.mode) {
    case "full":
      return selectRandomSlotsFull(slots, bookedSlots, options);

    case "by-clinician":
      if (!options.clinician) {
        console.warn("by-clinician mode requires clinician option");
        return [];
      }
      return selectRandomTimesForClinician(
        slots,
        bookedSlots,
        options.clinician,
        options.count,
        {
          clientInsurance: options.clientInsurance,
          onlyInsuranceMatch: options.onlyInsuranceMatch,
          excludeOffered: options.excludeOffered,
          previouslyOffered: options.previouslyOffered,
          timeRange: options.timeRange,
        }
      );

    case "by-day":
      if (!options.days || options.days.length === 0) {
        console.warn("by-day mode requires days option");
        return [];
      }
      return selectRandomSlotsForDays(
        slots,
        bookedSlots,
        options.days,
        options.count,
        {
          clientInsurance: options.clientInsurance,
          onlyInsuranceMatch: options.onlyInsuranceMatch,
          excludeOffered: options.excludeOffered,
          previouslyOffered: options.previouslyOffered,
          timeRange: options.timeRange,
        }
      );

    default:
      return [];
  }
}

/**
 * Filter slots by multiple criteria
 */
export function filterSlots(
  slots: SheetAvailabilitySlot[],
  bookedSlots: BookedSlot[],
  filters: {
    clinicians?: string[];
    days?: string[];
    timeRange?: TimeRange;
    specificTime?: string; // Exact time like "9:00 AM"
    clientInsurance?: string;
    onlyInsuranceMatch?: boolean;
    excludeOffered?: boolean;
    previouslyOffered?: Set<string>;
  }
): Array<{ slot: SheetAvailabilitySlot; availableClinicians: string[] }> {
  const bookedSet = createBookedSet(bookedSlots);
  const result: Array<{
    slot: SheetAvailabilitySlot;
    availableClinicians: string[];
  }> = [];

  for (const slot of slots) {
    // Filter by days
    if (filters.days && filters.days.length > 0) {
      if (!filters.days.includes(slot.day)) continue;
    }

    // Filter by specific time (exact match)
    if (filters.specificTime && slot.time !== filters.specificTime) {
      continue;
    }

    // Filter by time range (only if no specific time set)
    if (!filters.specificTime && filters.timeRange && !isInTimeRange(slot.time, filters.timeRange)) {
      continue;
    }

    // Filter by insurance match
    if (
      filters.onlyInsuranceMatch &&
      filters.clientInsurance &&
      !matchesClientInsurance(slot.insurance, filters.clientInsurance)
    ) {
      continue;
    }

    // Filter by previously offered
    if (filters.excludeOffered && filters.previouslyOffered?.has(slot.id)) {
      continue;
    }

    // Get available clinicians
    let availableClinicians = slot.clinicians.filter(
      (c) => !isClinicianBooked(bookedSet, slot.id, c)
    );

    // Filter by specific clinicians
    if (filters.clinicians && filters.clinicians.length > 0) {
      availableClinicians = availableClinicians.filter((c) =>
        filters.clinicians!.some(
          (fc) => fc.toLowerCase() === c.toLowerCase()
        )
      );
    }

    if (availableClinicians.length > 0) {
      result.push({ slot, availableClinicians });
    }
  }

  return result;
}
