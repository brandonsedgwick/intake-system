"use client";

import { useState } from "react";
import { useClinicians, useCreateClinician } from "@/hooks/use-clinicians";
import { Clinician } from "@/types/client";
import {
  Plus,
  User,
  Mail,
  Calendar,
  Shield,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";

function ClinicianCard({ clinician }: { clinician: Clinician }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
            {clinician.firstName[0]}
            {clinician.lastName[0]}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              {clinician.firstName} {clinician.lastName}
            </h3>
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Mail className="w-3 h-3" />
              {clinician.email}
            </div>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
            clinician.isAcceptingNew
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {clinician.isAcceptingNew ? (
            <>
              <CheckCircle className="w-3 h-3" />
              Accepting New
            </>
          ) : (
            <>
              <XCircle className="w-3 h-3" />
              Not Accepting
            </>
          )}
        </span>
      </div>

      <div className="space-y-3">
        {/* Capacity */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">New Client Capacity</span>
          <span className="font-medium">{clinician.newClientCapacity} slots</span>
        </div>

        {/* Session Length */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Session Length</span>
          <span className="font-medium">{clinician.defaultSessionLength} min</span>
        </div>

        {/* Insurance Panels */}
        {clinician.insurancePanels.length > 0 && (
          <div>
            <div className="text-sm text-gray-500 mb-2 flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Insurance Panels
            </div>
            <div className="flex flex-wrap gap-1">
              {clinician.insurancePanels.map((panel) => (
                <span
                  key={panel}
                  className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded"
                >
                  {panel}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Specialties */}
        {clinician.specialties.length > 0 && (
          <div>
            <div className="text-sm text-gray-500 mb-2">Specialties</div>
            <div className="flex flex-wrap gap-1">
              {clinician.specialties.map((specialty) => (
                <span
                  key={specialty}
                  className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded"
                >
                  {specialty}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Calendar */}
        {clinician.calendarId && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            Calendar connected
          </div>
        )}
      </div>
    </div>
  );
}

function AddClinicianModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    calendarId: "",
    insurancePanels: "",
    specialties: "",
    newClientCapacity: 5,
    isAcceptingNew: true,
    defaultSessionLength: 50,
  });

  const createClinician = useCreateClinician();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    await createClinician.mutateAsync({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      calendarId: formData.calendarId || undefined,
      insurancePanels: formData.insurancePanels
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      specialties: formData.specialties
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      newClientCapacity: formData.newClientCapacity,
      isAcceptingNew: formData.isAcceptingNew,
      defaultSessionLength: formData.defaultSessionLength,
    });

    onClose();
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      calendarId: "",
      insurancePanels: "",
      specialties: "",
      newClientCapacity: 5,
      isAcceptingNew: true,
      defaultSessionLength: 50,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Add Clinician
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                First Name *
              </label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(e) =>
                  setFormData({ ...formData, lastName: e.target.value })
                }
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Google Calendar ID
            </label>
            <input
              type="text"
              value={formData.calendarId}
              onChange={(e) =>
                setFormData({ ...formData, calendarId: e.target.value })
              }
              placeholder="clinician@gmail.com"
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Insurance Panels (comma-separated)
            </label>
            <input
              type="text"
              value={formData.insurancePanels}
              onChange={(e) =>
                setFormData({ ...formData, insurancePanels: e.target.value })
              }
              placeholder="Blue Cross, Aetna, United"
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Specialties (comma-separated)
            </label>
            <input
              type="text"
              value={formData.specialties}
              onChange={(e) =>
                setFormData({ ...formData, specialties: e.target.value })
              }
              placeholder="Anxiety, Depression, PTSD"
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Client Capacity
              </label>
              <input
                type="number"
                min="0"
                value={formData.newClientCapacity}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    newClientCapacity: parseInt(e.target.value),
                  })
                }
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Session Length (min)
              </label>
              <input
                type="number"
                min="15"
                step="5"
                value={formData.defaultSessionLength}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    defaultSessionLength: parseInt(e.target.value),
                  })
                }
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isAcceptingNew"
              checked={formData.isAcceptingNew}
              onChange={(e) =>
                setFormData({ ...formData, isAcceptingNew: e.target.checked })
              }
              className="rounded border-gray-300"
            />
            <label htmlFor="isAcceptingNew" className="text-sm text-gray-700">
              Currently accepting new clients
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createClinician.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {createClinician.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Add Clinician
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CliniciansPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const { data: clinicians, isLoading, error } = useClinicians();

  const acceptingCount = clinicians?.filter((c) => c.isAcceptingNew).length || 0;
  const totalCapacity = clinicians?.reduce((sum, c) => sum + c.newClientCapacity, 0) || 0;

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>Failed to load clinicians. Please try again.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clinicians</h1>
          <p className="text-gray-600">
            {clinicians?.length || 0} clinicians &middot; {acceptingCount} accepting
            new &middot; {totalCapacity} total capacity
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Clinician
        </button>
      </div>

      {/* Clinician Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading clinicians...</p>
        </div>
      ) : clinicians?.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">No clinicians yet.</p>
          <p className="text-sm text-gray-400">
            Add your first clinician to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clinicians?.map((clinician) => (
            <ClinicianCard key={clinician.id} clinician={clinician} />
          ))}
        </div>
      )}

      {/* Add Modal */}
      <AddClinicianModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </div>
  );
}
