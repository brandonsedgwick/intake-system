import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SheetAvailabilitySlot, BookedSlot } from "@/types/client";

// Fetch all availability slots from external Google Sheet
export function useAvailabilityFromSheets() {
  return useQuery<SheetAvailabilitySlot[]>({
    queryKey: ["availability-sheets"],
    queryFn: async () => {
      const response = await fetch("/api/availability/sheets");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch availability (${response.status})`);
      }
      const data = await response.json();
      return data.slots || [];
    },
    // Refresh every 30 seconds since this is real-time data
    refetchInterval: 30000,
    staleTime: 10000, // Consider data stale after 10 seconds
    retry: 1, // Only retry once to avoid hammering the API
  });
}

// Fetch all booked slots from local database
export function useBookedSlots() {
  return useQuery<BookedSlot[]>({
    queryKey: ["booked-slots"],
    queryFn: async () => {
      const response = await fetch("/api/availability/booked");
      if (!response.ok) {
        throw new Error("Failed to fetch booked slots");
      }
      const data = await response.json();
      return data.bookedSlots || [];
    },
  });
}

// Create a booked slot when client accepts
export function useCreateBookedSlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      slotId: string;
      day: string;
      time: string;
      clinician: string;
      clientId: string;
    }) => {
      const response = await fetch("/api/availability/booked", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to book slot");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booked-slots"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

// Delete a booked slot (for corrections)
export function useDeleteBookedSlot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/availability/booked/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete booked slot");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booked-slots"] });
    },
  });
}

// Combined hook for availability with booking status
export function useAvailabilityWithBookings() {
  const { data: slots, isLoading: slotsLoading, error: slotsError } = useAvailabilityFromSheets();
  const { data: bookedSlots, isLoading: bookedLoading } = useBookedSlots();

  // Create a set of booked slot IDs for quick lookup
  const bookedSlotIds = new Set(bookedSlots?.map((b) => `${b.slotId}-${b.clinician}`) || []);

  // Augment slots with booking information
  const augmentedSlots = slots?.map((slot) => ({
    ...slot,
    // Check if any clinician in this slot is booked
    bookedClinicians: slot.clinicians.filter((clinician) =>
      bookedSlotIds.has(`${slot.id}-${clinician}`)
    ),
    // Check if all clinicians are booked
    isFullyBooked: slot.clinicians.every((clinician) =>
      bookedSlotIds.has(`${slot.id}-${clinician}`)
    ),
  }));

  return {
    slots: augmentedSlots,
    bookedSlots,
    isLoading: slotsLoading || bookedLoading,
    error: slotsError,
  };
}

// Filter availability by insurance (partial match)
export function filterByInsurance(
  slots: SheetAvailabilitySlot[] | undefined,
  insuranceFilter: string | undefined
): SheetAvailabilitySlot[] {
  if (!slots) return [];
  if (!insuranceFilter) return slots;

  const filterLower = insuranceFilter.toLowerCase();
  return slots.filter((slot) =>
    slot.insurance.toLowerCase().includes(filterLower)
  );
}

// Check if a slot matches a client's insurance
export function matchesInsurance(
  slot: SheetAvailabilitySlot,
  clientInsurance: string | undefined
): boolean {
  if (!clientInsurance) return false;
  const insuranceLower = clientInsurance.toLowerCase();
  return slot.insurance.toLowerCase().includes(insuranceLower);
}
