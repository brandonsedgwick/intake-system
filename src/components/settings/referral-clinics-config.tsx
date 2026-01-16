"use client";

import { useState, useEffect } from "react";
import {
  useReferralClinics,
  useCreateReferralClinic,
  useUpdateReferralClinic,
  useDeleteReferralClinic,
  useReferralClinicsConfig,
  useUpdateReferralClinicsConfig,
} from "@/hooks/use-referral-clinics";
import {
  ReferralClinic,
  ReferralClinicCustomField,
} from "@/types/client";
import {
  Plus,
  Trash2,
  Loader2,
  Save,
  X,
  Building2,
  Settings2,
  ChevronDown,
  ChevronUp,
  Pencil,
  Phone,
  Mail,
  MapPin,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  GripVertical,
  Search,
  Tag,
} from "lucide-react";

// Field types for custom fields
const FIELD_TYPES: { value: ReferralClinicCustomField["type"]; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "url", label: "URL" },
  { value: "textarea", label: "Text Area" },
];

interface ClinicFormData {
  practiceName: string;
  address: string;
  phone: string;
  email: string;
  specialties: string;
  notes: string;
  customFields: Record<string, string>;
  isActive: boolean;
}

const DEFAULT_CLINIC_FORM: ClinicFormData = {
  practiceName: "",
  address: "",
  phone: "",
  email: "",
  specialties: "",
  notes: "",
  customFields: {},
  isActive: true,
};

function ClinicEditor({
  clinic,
  customFields,
  onSave,
  onCancel,
  isSaving,
}: {
  clinic: ReferralClinic | null;
  customFields: ReferralClinicCustomField[];
  onSave: (data: ClinicFormData) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState<ClinicFormData>(() => {
    if (clinic) {
      return {
        practiceName: clinic.practiceName,
        address: clinic.address || "",
        phone: clinic.phone || "",
        email: clinic.email || "",
        specialties: clinic.specialties.join(", "),
        notes: clinic.notes || "",
        customFields: clinic.customFields || {},
        isActive: clinic.isActive,
      };
    }
    return DEFAULT_CLINIC_FORM;
  });

  const handleChange = (field: keyof ClinicFormData, value: string | boolean | Record<string, string>) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCustomFieldChange = (fieldName: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      customFields: { ...prev.customFields, [fieldName]: value },
    }));
  };

  return (
    <div className="border-2 border-blue-200 rounded-lg bg-white">
      <div className="p-4 border-b border-blue-100 bg-blue-50">
        <h4 className="font-medium text-blue-900">
          {clinic ? "Edit Referral Clinic" : "Add New Referral Clinic"}
        </h4>
      </div>

      <div className="p-4 space-y-4">
        {/* Practice Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Practice Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.practiceName}
            onChange={(e) => handleChange("practiceName", e.target.value)}
            placeholder="e.g., Downtown Counseling Center"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Address
          </label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => handleChange("address", e.target.value)}
            placeholder="123 Main St, City, State 12345"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Phone and Email */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              placeholder="(555) 123-4567"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="referrals@clinic.com"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Specialties */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Specialties <span className="text-gray-500">(comma-separated)</span>
          </label>
          <input
            type="text"
            value={formData.specialties}
            onChange={(e) => handleChange("specialties", e.target.value)}
            placeholder="e.g., Anxiety, Depression, PTSD, Couples Therapy"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Custom Fields */}
        {customFields.length > 0 && (
          <div className="border-t pt-4">
            <h5 className="text-sm font-medium text-gray-700 mb-3">Additional Fields</h5>
            <div className="grid grid-cols-2 gap-4">
              {customFields.map((field) => (
                <div key={field.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      value={formData.customFields[field.name] || ""}
                      onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
                      rows={3}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <input
                      type={field.type === "email" ? "email" : field.type === "url" ? "url" : "text"}
                      value={formData.customFields[field.name] || ""}
                      onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => handleChange("notes", e.target.value)}
            placeholder="Additional notes about this clinic..."
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Active Toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.isActive}
            onChange={(e) => handleChange("isActive", e.target.checked)}
            className="rounded border-gray-300 text-blue-600"
          />
          <span className="text-sm text-gray-700">Clinic is active and available for referrals</span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between p-4 bg-gray-50 border-t">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
        <button
          onClick={() => onSave(formData)}
          disabled={isSaving || !formData.practiceName.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {clinic ? "Update Clinic" : "Add Clinic"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function CustomFieldsConfig({
  customFields,
  onSave,
  isSaving,
}: {
  customFields: ReferralClinicCustomField[];
  onSave: (fields: ReferralClinicCustomField[]) => void;
  isSaving: boolean;
}) {
  const [localFields, setLocalFields] = useState<ReferralClinicCustomField[]>(customFields);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalFields(customFields);
    setHasChanges(false);
  }, [customFields]);

  const handleAddField = () => {
    const newField: ReferralClinicCustomField = {
      id: `custom-${Date.now()}`,
      name: `customField${localFields.length + 1}`,
      label: "New Field",
      type: "text",
      order: localFields.length + 1,
    };
    setLocalFields([...localFields, newField]);
    setHasChanges(true);
  };

  const handleUpdateField = (index: number, updates: Partial<ReferralClinicCustomField>) => {
    const updated = [...localFields];
    updated[index] = { ...updated[index], ...updates };

    // Update name from label if not manually changed
    if (updates.label && !updates.name) {
      updated[index].name = updates.label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
    }

    setLocalFields(updated);
    setHasChanges(true);
  };

  const handleRemoveField = (index: number) => {
    const updated = localFields.filter((_, i) => i !== index);
    setLocalFields(updated);
    setHasChanges(true);
  };

  const handleSave = () => {
    onSave(localFields);
    setHasChanges(false);
  };

  return (
    <div className="border rounded-lg bg-white">
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-gray-600" />
            <h4 className="font-medium text-gray-900">Custom Fields</h4>
          </div>
          <button
            onClick={handleAddField}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Add Field
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          Add custom fields to collect additional information about referral clinics.
        </p>
      </div>

      <div className="p-4">
        {localFields.length === 0 ? (
          <div className="text-center py-6 text-gray-500">
            <Settings2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No custom fields configured.</p>
            <p className="text-sm">Click &quot;Add Field&quot; to create one.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {localFields.map((field, index) => (
              <div
                key={field.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                <div className="flex-1 grid grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => handleUpdateField(index, { label: e.target.value })}
                    placeholder="Field Label"
                    className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={field.name}
                    onChange={(e) => handleUpdateField(index, { name: e.target.value })}
                    placeholder="field_name"
                    className="border rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <select
                    value={field.type}
                    onChange={(e) => handleUpdateField(index, { type: e.target.value as ReferralClinicCustomField["type"] })}
                    className="border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {FIELD_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => handleRemoveField(index)}
                  className="p-1.5 text-gray-400 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {hasChanges && (
          <div className="mt-4 pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Custom Fields
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ReferralClinicsConfig() {
  const { data: clinics, isLoading: clinicsLoading, error: clinicsError } = useReferralClinics();
  const { data: config, isLoading: configLoading } = useReferralClinicsConfig();
  const createClinic = useCreateReferralClinic();
  const updateClinic = useUpdateReferralClinic();
  const deleteClinic = useDeleteReferralClinic();
  const updateConfig = useUpdateReferralClinicsConfig();

  const [editingClinic, setEditingClinic] = useState<ReferralClinic | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedClinics, setExpandedClinics] = useState<Set<string>>(new Set());
  const [showCustomFields, setShowCustomFields] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

  const customFields = config?.customFields || [];

  // Get all unique specialties for keyword tags
  const allSpecialties = Array.from(
    new Set((clinics || []).flatMap((c) => c.specialties))
  ).sort();

  // Filter clinics based on search and selected tags
  const filteredClinics = (clinics || []).filter((clinic) => {
    // Search filter
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      clinic.practiceName.toLowerCase().includes(searchLower) ||
      clinic.specialties.some((s) => s.toLowerCase().includes(searchLower)) ||
      clinic.address?.toLowerCase().includes(searchLower) ||
      clinic.email?.toLowerCase().includes(searchLower) ||
      clinic.notes?.toLowerCase().includes(searchLower);

    // Tag filter - clinic must have ALL selected tags
    const matchesTags =
      selectedTags.size === 0 ||
      Array.from(selectedTags).every((tag) => clinic.specialties.includes(tag));

    return matchesSearch && matchesTags;
  });

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedTags(new Set());
  };

  const toggleClinic = (id: string) => {
    setExpandedClinics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSave = async (data: ClinicFormData) => {
    const clinicData = {
      practiceName: data.practiceName.trim(),
      address: data.address.trim() || undefined,
      phone: data.phone.trim() || undefined,
      email: data.email.trim() || undefined,
      specialties: data.specialties
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      notes: data.notes.trim() || undefined,
      customFields: Object.keys(data.customFields).length > 0 ? data.customFields : undefined,
      isActive: data.isActive,
    };

    if (editingClinic) {
      await updateClinic.mutateAsync({ id: editingClinic.id, data: clinicData });
      setEditingClinic(null);
    } else {
      await createClinic.mutateAsync(clinicData);
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this referral clinic?")) {
      return;
    }
    await deleteClinic.mutateAsync(id);
  };

  const handleToggleActive = async (clinic: ReferralClinic) => {
    await updateClinic.mutateAsync({
      id: clinic.id,
      data: { isActive: !clinic.isActive },
    });
  };

  const handleSaveCustomFields = async (fields: ReferralClinicCustomField[]) => {
    await updateConfig.mutateAsync(fields);
  };

  if (clinicsLoading || configLoading) {
    return (
      <div className="p-6 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
        <p className="mt-2 text-sm text-gray-500">Loading referral clinics...</p>
      </div>
    );
  }

  if (clinicsError) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="w-8 h-8 mx-auto text-red-500 mb-2" />
        <p className="text-red-600">{(clinicsError as Error).message}</p>
      </div>
    );
  }

  const activeClinics = (clinics || []).filter((c) => c.isActive);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Building2 className="w-6 h-6 text-amber-600 mt-0.5" />
          <div>
            <h3 className="text-lg font-medium text-gray-900">Referral Clinics</h3>
            <p className="text-sm text-gray-600">
              Manage the list of clinics available for patient referrals.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCustomFields(!showCustomFields)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <Settings2 className="w-4 h-4" />
            Custom Fields
            {showCustomFields ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {!isCreating && !editingClinic && (
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
            >
              <Plus className="w-4 h-4" />
              Add Clinic
            </button>
          )}
        </div>
      </div>

      {/* Search and Filter */}
      <div className="space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clinics by name, specialty, address..."
            className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          />
          {(searchQuery || selectedTags.size > 0) && (
            <button
              onClick={clearFilters}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Keyword Tags */}
        {allSpecialties.length > 0 && (
          <div className="flex items-start gap-2">
            <Tag className="w-4 h-4 text-gray-400 mt-1.5 flex-shrink-0" />
            <div className="flex flex-wrap gap-1.5">
              {allSpecialties.map((specialty) => (
                <button
                  key={specialty}
                  onClick={() => toggleTag(specialty)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedTags.has(specialty)
                      ? "bg-amber-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {specialty}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active Filters */}
        {(searchQuery || selectedTags.size > 0) && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>
              Showing {filteredClinics.length} of {clinics?.length || 0} clinics
            </span>
            {selectedTags.size > 0 && (
              <span className="text-amber-600">
                ({selectedTags.size} tag{selectedTags.size !== 1 ? "s" : ""} selected)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Custom Fields Configuration */}
      {showCustomFields && (
        <CustomFieldsConfig
          customFields={customFields}
          onSave={handleSaveCustomFields}
          isSaving={updateConfig.isPending}
        />
      )}

      {/* Create/Edit Form */}
      {(isCreating || editingClinic) && (
        <ClinicEditor
          clinic={editingClinic}
          customFields={customFields}
          onSave={handleSave}
          onCancel={() => {
            setIsCreating(false);
            setEditingClinic(null);
          }}
          isSaving={createClinic.isPending || updateClinic.isPending}
        />
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span className="flex items-center gap-1">
          <Building2 className="w-4 h-4" />
          {clinics?.length || 0} total
        </span>
        <span className="text-green-600">{activeClinics.length} active</span>
        {clinics && clinics.length > activeClinics.length && (
          <span className="text-gray-400">
            {clinics.length - activeClinics.length} inactive
          </span>
        )}
        {allSpecialties.length > 0 && (
          <span className="text-amber-600">{allSpecialties.length} specialties</span>
        )}
      </div>

      {/* Clinics List */}
      {!isCreating && !editingClinic && (
        <>
          {!clinics || clinics.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
              <Building2 className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-gray-600">No referral clinics configured yet.</p>
              <p className="text-sm text-gray-500 mt-1">
                Click &quot;Add Clinic&quot; to add your first referral clinic.
              </p>
            </div>
          ) : filteredClinics.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
              <Search className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-gray-600">No clinics match your search.</p>
              <p className="text-sm text-gray-500 mt-1">
                Try different keywords or{" "}
                <button onClick={clearFilters} className="text-amber-600 hover:underline">
                  clear filters
                </button>
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredClinics.map((clinic) => {
                const isExpanded = expandedClinics.has(clinic.id);

                return (
                  <div
                    key={clinic.id}
                    className={`border rounded-lg bg-white ${!clinic.isActive ? "opacity-75" : ""}`}
                  >
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleClinic(clinic.id)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Building2 className={`w-5 h-5 ${clinic.isActive ? "text-amber-600" : "text-gray-400"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900 truncate">
                              {clinic.practiceName}
                            </span>
                            {!clinic.isActive && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">
                                Inactive
                              </span>
                            )}
                          </div>
                          {clinic.specialties.length > 0 && (
                            <p className="text-sm text-gray-500 truncate">
                              {clinic.specialties.slice(0, 3).join(", ")}
                              {clinic.specialties.length > 3 && ` +${clinic.specialties.length - 3} more`}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t p-4 bg-gray-50">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          {clinic.address && (
                            <div className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                              <span className="text-sm text-gray-700">{clinic.address}</span>
                            </div>
                          )}
                          {clinic.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-gray-400" />
                              <a href={`tel:${clinic.phone}`} className="text-sm text-blue-600 hover:underline">
                                {clinic.phone}
                              </a>
                            </div>
                          )}
                          {clinic.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-gray-400" />
                              <a href={`mailto:${clinic.email}`} className="text-sm text-blue-600 hover:underline">
                                {clinic.email}
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Specialties */}
                        {clinic.specialties.length > 0 && (
                          <div className="mb-4">
                            <h5 className="text-xs font-medium text-gray-500 uppercase mb-2">Specialties</h5>
                            <div className="flex flex-wrap gap-1">
                              {clinic.specialties.map((specialty, i) => (
                                <span
                                  key={i}
                                  className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs"
                                >
                                  {specialty}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Custom Fields */}
                        {clinic.customFields && Object.keys(clinic.customFields).length > 0 && (
                          <div className="mb-4">
                            <h5 className="text-xs font-medium text-gray-500 uppercase mb-2">Additional Info</h5>
                            <div className="grid grid-cols-2 gap-2">
                              {customFields.map((field) => {
                                const value = clinic.customFields?.[field.name];
                                if (!value) return null;
                                return (
                                  <div key={field.id} className="text-sm">
                                    <span className="text-gray-500">{field.label}:</span>{" "}
                                    <span className="text-gray-700">{value}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Notes */}
                        {clinic.notes && (
                          <div className="mb-4">
                            <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">Notes</h5>
                            <p className="text-sm text-gray-700">{clinic.notes}</p>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-3 border-t">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleActive(clinic);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded"
                          >
                            {clinic.isActive ? (
                              <>
                                <ToggleRight className="w-5 h-5 text-green-600" />
                                Active
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="w-5 h-5 text-gray-400" />
                                Inactive
                              </>
                            )}
                          </button>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingClinic(clinic);
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Pencil className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(clinic.id);
                              }}
                              className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Info Box */}
      <div className="bg-amber-50 rounded-lg p-4">
        <h4 className="font-medium text-amber-900 mb-2">About Referral Clinics</h4>
        <ul className="text-sm text-amber-800 space-y-1">
          <li>&bull; Add clinics that accept referrals from your practice.</li>
          <li>&bull; Use specialties to match clients with appropriate providers.</li>
          <li>&bull; Custom fields let you track additional information like fax numbers, insurance networks, etc.</li>
          <li>&bull; Inactive clinics won&apos;t appear in referral options but will be preserved for records.</li>
        </ul>
      </div>
    </div>
  );
}
