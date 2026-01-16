"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  useAvailabilityFromSheets,
  useBookedSlots,
} from "@/hooks/use-availability-sheets";
import { SheetAvailabilitySlot } from "@/types/client";
import {
  Search,
  Calendar,
  RefreshCw,
  Loader2,
  AlertCircle,
  ChevronDown,
  X,
  Users,
  Shield,
  Clock,
  Check,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

// Day order for sorting
const DAY_ORDER: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AvailabilityPage() {
  const queryClient = useQueryClient();
  const { data: slots, isLoading, error, refetch, isFetching } = useAvailabilityFromSheets();
  const { data: bookedSlots } = useBookedSlots();

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [dayFilter, setDayFilter] = useState<string>("all");
  const [clinicianFilter, setClinicianFilter] = useState<string>("all");
  const [selectedInsurances, setSelectedInsurances] = useState<Set<string>>(new Set());
  const [insuranceDropdownOpen, setInsuranceDropdownOpen] = useState(false);
  const [sortField, setSortField] = useState<"day" | "time" | "clinicians" | "insurance">("day");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Ref for insurance dropdown to handle click outside
  const insuranceDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (insuranceDropdownRef.current && !insuranceDropdownRef.current.contains(event.target as Node)) {
        setInsuranceDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Create set of booked slot IDs for quick lookup
  const bookedSet = useMemo(() => {
    const set = new Set<string>();
    bookedSlots?.forEach((b) => {
      set.add(`${b.slotId}-${b.clinician}`);
    });
    return set;
  }, [bookedSlots]);

  // Get unique clinician names for filter dropdown
  const uniqueClinicians = useMemo(() => {
    if (!slots) return [];
    const clinicians = new Set<string>();
    slots.forEach((slot) => {
      slot.clinicians.forEach((c) => {
        if (c) clinicians.add(c);
      });
    });
    return Array.from(clinicians).sort();
  }, [slots]);

  // Get unique insurance values for filter dropdown (parse comma-separated values)
  const uniqueInsurances = useMemo(() => {
    if (!slots) return [];
    const insurances = new Set<string>();
    slots.forEach((slot) => {
      if (slot.insurance) {
        // Split by comma and trim each insurance name
        slot.insurance.split(",").forEach((ins) => {
          const trimmed = ins.trim();
          if (trimmed) {
            insurances.add(trimmed);
          }
        });
      }
    });
    return Array.from(insurances).sort();
  }, [slots]);

  // Filter and sort slots
  const filteredSlots = useMemo(() => {
    if (!slots) return [];

    let filtered = slots.filter((slot) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          slot.day.toLowerCase().includes(query) ||
          slot.time.toLowerCase().includes(query) ||
          slot.clinicians.some((c) => c.toLowerCase().includes(query)) ||
          slot.insurance.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Day filter
      if (dayFilter !== "all" && slot.day.toLowerCase() !== dayFilter.toLowerCase()) {
        return false;
      }

      // Clinician filter
      if (clinicianFilter !== "all" && !slot.clinicians.some((c) => c === clinicianFilter)) {
        return false;
      }

      // Insurance filter (multi-select)
      if (selectedInsurances.size > 0) {
        // Parse the slot's insurance into individual values
        const slotInsurances = slot.insurance
          .split(",")
          .map((ins) => ins.trim().toLowerCase())
          .filter((ins) => ins.length > 0);
        // Check if any of the selected insurances match
        const hasMatch = Array.from(selectedInsurances).some((selected) =>
          slotInsurances.some((slotIns) => slotIns.includes(selected.toLowerCase()))
        );
        if (!hasMatch) return false;
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "day":
          comparison = (DAY_ORDER[a.day.toLowerCase()] ?? 7) - (DAY_ORDER[b.day.toLowerCase()] ?? 7);
          if (comparison === 0) {
            comparison = a.time.localeCompare(b.time);
          }
          break;
        case "time":
          comparison = a.time.localeCompare(b.time);
          break;
        case "clinicians":
          comparison = a.clinicians.join(", ").localeCompare(b.clinicians.join(", "));
          break;
        case "insurance":
          comparison = a.insurance.localeCompare(b.insurance);
          break;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [slots, searchQuery, dayFilter, clinicianFilter, selectedInsurances, sortField, sortDirection]);

  // Check if a slot is booked
  const isSlotBooked = (slot: SheetAvailabilitySlot, clinician: string) => {
    return bookedSet.has(`${slot.id}-${clinician}`);
  };

  // Check if all clinicians in a slot are booked
  const isFullyBooked = (slot: SheetAvailabilitySlot) => {
    return slot.clinicians.every((c) => isSlotBooked(slot, c));
  };

  const handleSort = (field: "day" | "time" | "clinicians" | "insurance") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["booked-slots"] });
  };

  const toggleInsurance = (insurance: string) => {
    setSelectedInsurances((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(insurance)) {
        newSet.delete(insurance);
      } else {
        newSet.add(insurance);
      }
      return newSet;
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setDayFilter("all");
    setClinicianFilter("all");
    setSelectedInsurances(new Set());
  };

  const hasActiveFilters = searchQuery || dayFilter !== "all" || clinicianFilter !== "all" || selectedInsurances.size > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Availability</h1>
                <p className="text-sm text-gray-500">
                  Clinician availability from scheduling sheet
                </p>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={isFetching}
              className="flex items-center gap-2 px-4 py-2 text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search availability..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Day Filter */}
            <div className="relative">
              <select
                value={dayFilter}
                onChange={(e) => setDayFilter(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              >
                <option value="all">All Days</option>
                {DAYS.map((day) => (
                  <option key={day} value={day.toLowerCase()}>
                    {day}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Clinician Filter */}
            <div className="relative">
              <select
                value={clinicianFilter}
                onChange={(e) => setClinicianFilter(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              >
                <option value="all">All Clinicians</option>
                {uniqueClinicians.map((clinician) => (
                  <option key={clinician} value={clinician}>
                    {clinician}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Insurance Filter - Multi-select Checkbox Dropdown */}
            <div className="relative" ref={insuranceDropdownRef}>
              <button
                type="button"
                onClick={() => setInsuranceDropdownOpen(!insuranceDropdownOpen)}
                className="flex items-center gap-2 pl-4 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white min-w-[160px] text-left"
              >
                <Shield className="w-4 h-4 text-gray-400" />
                <span className="text-sm">
                  {selectedInsurances.size === 0
                    ? "All Insurance"
                    : `${selectedInsurances.size} selected`}
                </span>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              </button>

              {insuranceDropdownOpen && (
                <div className="absolute z-50 mt-1 w-64 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {/* Select All / Clear All */}
                  <div className="px-3 py-2 border-b bg-gray-50 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedInsurances(new Set(uniqueInsurances))}
                      className="text-xs text-purple-600 hover:text-purple-800"
                    >
                      Select All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedInsurances(new Set())}
                      className="text-xs text-gray-600 hover:text-gray-800"
                    >
                      Clear All
                    </button>
                  </div>

                  {/* Insurance Options */}
                  <div className="py-1">
                    {uniqueInsurances.map((insurance) => (
                      <label
                        key={insurance}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            selectedInsurances.has(insurance)
                              ? "bg-purple-600 border-purple-600"
                              : "border-gray-300"
                          }`}
                        >
                          {selectedInsurances.has(insurance) && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedInsurances.has(insurance)}
                          onChange={() => toggleInsurance(insurance)}
                          className="sr-only"
                        />
                        <span className="text-sm text-gray-700">{insurance}</span>
                      </label>
                    ))}
                  </div>

                  {uniqueInsurances.length === 0 && (
                    <div className="px-3 py-4 text-sm text-gray-500 text-center">
                      No insurance data available
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}

            {/* Results count */}
            <div className="text-sm text-gray-500">
              {filteredSlots.length} slot{filteredSlots.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 pb-6">
        {isLoading ? (
          <div className="bg-white rounded-xl border p-12 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600 mb-4" />
            <p className="text-gray-500">Loading availability...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl border p-12 flex flex-col items-center justify-center">
            <AlertCircle className="w-8 h-8 text-red-500 mb-4" />
            <p className="text-gray-900 font-medium mb-2">Failed to load availability</p>
            <p className="text-gray-500 text-sm mb-4">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Try Again
            </button>
          </div>
        ) : filteredSlots.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 flex flex-col items-center justify-center">
            <Calendar className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-gray-900 font-medium mb-2">No availability found</p>
            <p className="text-gray-500 text-sm">
              {hasActiveFilters
                ? "Try adjusting your filters"
                : "No availability data in the spreadsheet"}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th
                    className="text-left px-6 py-4 text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("day")}
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      Day
                      {sortField === "day" && (
                        <span className="text-purple-600">{sortDirection === "asc" ? "↑" : "↓"}</span>
                      )}
                    </div>
                  </th>
                  <th
                    className="text-left px-6 py-4 text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("time")}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      Time
                      {sortField === "time" && (
                        <span className="text-purple-600">{sortDirection === "asc" ? "↑" : "↓"}</span>
                      )}
                    </div>
                  </th>
                  <th
                    className="text-left px-6 py-4 text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("clinicians")}
                  >
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-400" />
                      Clinicians
                      {sortField === "clinicians" && (
                        <span className="text-purple-600">{sortDirection === "asc" ? "↑" : "↓"}</span>
                      )}
                    </div>
                  </th>
                  <th
                    className="text-left px-6 py-4 text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("insurance")}
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-gray-400" />
                      Insurance
                      {sortField === "insurance" && (
                        <span className="text-purple-600">{sortDirection === "asc" ? "↑" : "↓"}</span>
                      )}
                    </div>
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-gray-900">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredSlots.map((slot) => {
                  const fullyBooked = isFullyBooked(slot);

                  return (
                    <tr
                      key={slot.id}
                      className={`hover:bg-gray-50 ${fullyBooked ? "bg-gray-50 opacity-60" : ""}`}
                    >
                      <td className={`px-6 py-4 text-sm font-medium ${fullyBooked ? "text-gray-400 line-through" : "text-gray-900"}`}>
                        {slot.day}
                      </td>
                      <td className={`px-6 py-4 text-sm ${fullyBooked ? "text-gray-400 line-through" : "text-gray-600"}`}>
                        {slot.time}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex flex-wrap gap-1">
                          {slot.clinicians.map((clinician) => {
                            const booked = isSlotBooked(slot, clinician);
                            return (
                              <span
                                key={clinician}
                                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  booked
                                    ? "bg-red-100 text-red-700 line-through"
                                    : "bg-purple-100 text-purple-700"
                                }`}
                              >
                                {clinician}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className={`px-6 py-4 text-sm ${fullyBooked ? "text-gray-400" : "text-gray-600"}`}>
                        {slot.insurance || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {fullyBooked ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            Booked
                          </span>
                        ) : slot.clinicians.some((c) => isSlotBooked(slot, c)) ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            Partial
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Available
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
