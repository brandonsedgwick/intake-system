import { SheetAvailabilitySlot, BookedSlot } from "@/types/client";

// Clinician statistics for display and sorting
export interface ClinicianStats {
  name: string;
  totalSlots: number;
  availableSlots: number;
  bookedSlots: number;
  insurances: string[];
  days: string[];
  isRequestedClinician: boolean;
  matchesClientInsurance: boolean;
}

// Slot distribution for analytics
export interface SlotDistribution {
  byDay: Record<string, number>;
  byTime: Record<string, number>;
  byClinician: Record<string, number>;
}

// Time range definitions
export const TIME_RANGES = {
  morning: { label: "Morning (9-12)", start: 9, end: 12 },
  afternoon: { label: "Afternoon (12-5)", start: 12, end: 17 },
  evening: { label: "Evening (5+)", start: 17, end: 24 },
} as const;

export type TimeRange = keyof typeof TIME_RANGES;

/**
 * Parse a time string like "9:00 AM" or "2:30 PM" into 24-hour format number
 */
export function parseTimeToHour(timeStr: string): number {
  const match = timeStr.match(/(\d+):?(\d*)\s*(AM|PM)?/i);
  if (!match) return 12; // Default to noon if unparseable

  let hour = parseInt(match[1], 10);
  const isPM = match[3]?.toUpperCase() === "PM";

  if (isPM && hour !== 12) {
    hour += 12;
  } else if (!isPM && hour === 12) {
    hour = 0;
  }

  return hour;
}

/**
 * Check if a time falls within a time range
 */
export function isInTimeRange(timeStr: string, range: TimeRange): boolean {
  const hour = parseTimeToHour(timeStr);
  const { start, end } = TIME_RANGES[range];
  return hour >= start && hour < end;
}

/**
 * Create a set of booked slot IDs for quick lookup
 */
export function createBookedSet(bookedSlots: BookedSlot[]): Set<string> {
  const set = new Set<string>();
  bookedSlots.forEach((b) => {
    set.add(`${b.slotId}-${b.clinician}`);
  });
  return set;
}

/**
 * Check if a specific clinician is booked for a slot
 */
export function isClinicianBooked(
  bookedSet: Set<string>,
  slotId: string,
  clinician: string
): boolean {
  return bookedSet.has(`${slotId}-${clinician}`);
}

/**
 * Parse insurance string into individual insurance names
 */
export function parseInsurances(insuranceStr: string): string[] {
  if (!insuranceStr) return [];
  return insuranceStr
    .split(",")
    .map((ins) => ins.trim())
    .filter((ins) => ins.length > 0);
}

/**
 * Check if slot's insurance matches client's insurance (partial match)
 */
export function matchesClientInsurance(
  slotInsurance: string,
  clientInsurance: string | undefined
): boolean {
  if (!clientInsurance) return false;
  const clientIns = clientInsurance.toLowerCase();
  return slotInsurance.toLowerCase().includes(clientIns);
}

/**
 * Compute statistics for each clinician
 */
export function computeClinicianStats(
  slots: SheetAvailabilitySlot[],
  bookedSlots: BookedSlot[],
  requestedClinician?: string,
  clientInsurance?: string
): ClinicianStats[] {
  const bookedSet = createBookedSet(bookedSlots);
  const clinicianMap = new Map<string, ClinicianStats>();

  // Process each slot
  slots.forEach((slot) => {
    const slotInsurances = parseInsurances(slot.insurance);

    slot.clinicians.forEach((clinician) => {
      const isBooked = isClinicianBooked(bookedSet, slot.id, clinician);

      let stats = clinicianMap.get(clinician);
      if (!stats) {
        stats = {
          name: clinician,
          totalSlots: 0,
          availableSlots: 0,
          bookedSlots: 0,
          insurances: [],
          days: [],
          isRequestedClinician:
            requestedClinician?.toLowerCase() === clinician.toLowerCase(),
          matchesClientInsurance: false,
        };
        clinicianMap.set(clinician, stats);
      }

      stats.totalSlots++;

      if (isBooked) {
        stats.bookedSlots++;
      } else {
        stats.availableSlots++;
      }

      // Add unique days
      if (!stats.days.includes(slot.day)) {
        stats.days.push(slot.day);
      }

      // Add unique insurances
      slotInsurances.forEach((ins) => {
        if (!stats!.insurances.includes(ins)) {
          stats!.insurances.push(ins);
        }
      });
    });
  });

  // Check insurance match for each clinician
  if (clientInsurance) {
    clinicianMap.forEach((stats) => {
      stats.matchesClientInsurance = stats.insurances.some((ins) =>
        ins.toLowerCase().includes(clientInsurance.toLowerCase())
      );
    });
  }

  return Array.from(clinicianMap.values());
}

/**
 * Sort clinician stats by different criteria
 */
export function sortClinicianStats(
  stats: ClinicianStats[],
  sortBy: "availability" | "alpha" | "insurance"
): ClinicianStats[] {
  const sorted = [...stats];

  switch (sortBy) {
    case "availability":
      // Most available first, then by name
      sorted.sort((a, b) => {
        // Requested clinician always first
        if (a.isRequestedClinician && !b.isRequestedClinician) return -1;
        if (!a.isRequestedClinician && b.isRequestedClinician) return 1;

        // Then by available slots
        if (b.availableSlots !== a.availableSlots) {
          return b.availableSlots - a.availableSlots;
        }
        return a.name.localeCompare(b.name);
      });
      break;

    case "alpha":
      sorted.sort((a, b) => {
        // Requested clinician always first
        if (a.isRequestedClinician && !b.isRequestedClinician) return -1;
        if (!a.isRequestedClinician && b.isRequestedClinician) return 1;

        return a.name.localeCompare(b.name);
      });
      break;

    case "insurance":
      // Insurance match first, then by availability
      sorted.sort((a, b) => {
        // Requested clinician always first
        if (a.isRequestedClinician && !b.isRequestedClinician) return -1;
        if (!a.isRequestedClinician && b.isRequestedClinician) return 1;

        // Then by insurance match
        if (a.matchesClientInsurance && !b.matchesClientInsurance) return -1;
        if (!a.matchesClientInsurance && b.matchesClientInsurance) return 1;

        // Then by available slots
        if (b.availableSlots !== a.availableSlots) {
          return b.availableSlots - a.availableSlots;
        }
        return a.name.localeCompare(b.name);
      });
      break;
  }

  return sorted;
}

/**
 * Compute slot distribution by day, time, and clinician
 */
export function computeSlotDistribution(
  slots: SheetAvailabilitySlot[],
  bookedSlots: BookedSlot[]
): SlotDistribution {
  const bookedSet = createBookedSet(bookedSlots);

  const distribution: SlotDistribution = {
    byDay: {},
    byTime: {},
    byClinician: {},
  };

  slots.forEach((slot) => {
    // Count available clinicians in this slot
    const availableClinicians = slot.clinicians.filter(
      (c) => !isClinicianBooked(bookedSet, slot.id, c)
    );

    if (availableClinicians.length === 0) return; // Skip fully booked slots

    // By day
    distribution.byDay[slot.day] = (distribution.byDay[slot.day] || 0) + 1;

    // By time (group into ranges)
    const hour = parseTimeToHour(slot.time);
    let timeKey: string;
    if (hour < 12) {
      timeKey = "morning";
    } else if (hour < 17) {
      timeKey = "afternoon";
    } else {
      timeKey = "evening";
    }
    distribution.byTime[timeKey] = (distribution.byTime[timeKey] || 0) + 1;

    // By clinician (count unique slots per clinician)
    availableClinicians.forEach((c) => {
      distribution.byClinician[c] = (distribution.byClinician[c] || 0) + 1;
    });
  });

  return distribution;
}

/**
 * Get counts for each day of the week
 */
export function getDayCounts(
  slots: SheetAvailabilitySlot[],
  bookedSlots: BookedSlot[]
): Record<string, number> {
  const bookedSet = createBookedSet(bookedSlots);
  const counts: Record<string, number> = {};

  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  days.forEach((day) => (counts[day] = 0));

  slots.forEach((slot) => {
    const availableClinicians = slot.clinicians.filter(
      (c) => !isClinicianBooked(bookedSet, slot.id, c)
    );
    if (availableClinicians.length > 0) {
      counts[slot.day] = (counts[slot.day] || 0) + 1;
    }
  });

  return counts;
}

/**
 * Get insurance-matched slot count
 */
export function getInsuranceMatchCount(
  slots: SheetAvailabilitySlot[],
  bookedSlots: BookedSlot[],
  clientInsurance: string | undefined
): number {
  if (!clientInsurance) return 0;

  const bookedSet = createBookedSet(bookedSlots);
  let count = 0;

  slots.forEach((slot) => {
    if (!matchesClientInsurance(slot.insurance, clientInsurance)) return;

    const availableClinicians = slot.clinicians.filter(
      (c) => !isClinicianBooked(bookedSet, slot.id, c)
    );
    if (availableClinicians.length > 0) {
      count++;
    }
  });

  return count;
}

/**
 * Get total available slot count (not fully booked)
 */
export function getTotalAvailableCount(
  slots: SheetAvailabilitySlot[],
  bookedSlots: BookedSlot[]
): number {
  const bookedSet = createBookedSet(bookedSlots);
  let count = 0;

  slots.forEach((slot) => {
    const availableClinicians = slot.clinicians.filter(
      (c) => !isClinicianBooked(bookedSet, slot.id, c)
    );
    if (availableClinicians.length > 0) {
      count++;
    }
  });

  return count;
}
