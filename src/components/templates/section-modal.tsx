"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Folder } from "lucide-react";
import { TemplateSection } from "@/types/client";

interface SectionModalProps {
  section: TemplateSection | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { name: string; color?: TemplateSection["color"] }) => Promise<void>;
  isSaving: boolean;
}

const SECTION_COLORS: { value: TemplateSection["color"]; label: string; classes: string }[] = [
  { value: undefined, label: "None", classes: "bg-gray-100 text-gray-600" },
  { value: "blue", label: "Blue", classes: "bg-blue-100 text-blue-700" },
  { value: "green", label: "Green", classes: "bg-green-100 text-green-700" },
  { value: "purple", label: "Purple", classes: "bg-purple-100 text-purple-700" },
  { value: "amber", label: "Amber", classes: "bg-amber-100 text-amber-700" },
  { value: "red", label: "Red", classes: "bg-red-100 text-red-700" },
];

export function SectionModal({
  section,
  isOpen,
  onClose,
  onSave,
  isSaving,
}: SectionModalProps) {
  const [name, setName] = useState(section?.name || "");
  const [color, setColor] = useState<TemplateSection["color"]>(section?.color);

  // Reset form when section changes
  useEffect(() => {
    if (section) {
      setName(section.name);
      setColor(section.color);
    } else {
      setName("");
      setColor(undefined);
    }
  }, [section, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await onSave({ name: name.trim(), color });
    onClose();
  };

  const isEdit = !!section;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Folder className="w-5 h-5 text-gray-600" />
            <h3 className="font-medium text-gray-900">
              {isEdit ? "Edit Section" : "New Section"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Section Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Outreach, Follow-ups, Referrals"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color Label
            </label>
            <div className="flex flex-wrap gap-2">
              {SECTION_COLORS.map((colorOption) => (
                <button
                  key={colorOption.label}
                  type="button"
                  onClick={() => setColor(colorOption.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    colorOption.classes
                  } ${
                    color === colorOption.value
                      ? "ring-2 ring-offset-2 ring-blue-500"
                      : "opacity-70 hover:opacity-100"
                  }`}
                >
                  {colorOption.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          {name.trim() && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-2">Preview:</p>
              <div className="flex items-center gap-2">
                <Folder
                  className={`w-4 h-4 ${
                    color
                      ? SECTION_COLORS.find((c) => c.value === color)?.classes.split(" ")[1]
                      : "text-gray-600"
                  }`}
                />
                <span className="text-sm font-medium text-gray-700">
                  {name.trim()}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>{isEdit ? "Update Section" : "Create Section"}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
