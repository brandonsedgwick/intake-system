"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Copy, Check } from "lucide-react";
import {
  getVariablesByCategory,
  VARIABLE_CATEGORIES,
  TemplateVariableDefinition,
} from "@/lib/services/email-template";

interface VariableDropdownProps {
  onInsert: (variable: string) => void;
}

export function VariableDropdown({ onInsert }: VariableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const variablesByCategory = getVariablesByCategory();

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter variables by search
  const filteredCategories = Object.entries(variablesByCategory).reduce(
    (acc, [category, variables]) => {
      const filtered = variables.filter(
        (v) =>
          v.displayName.toLowerCase().includes(search.toLowerCase()) ||
          v.key.toLowerCase().includes(search.toLowerCase()) ||
          v.description.toLowerCase().includes(search.toLowerCase())
      );
      if (filtered.length > 0) {
        acc[category] = filtered;
      }
      return acc;
    },
    {} as Record<string, TemplateVariableDefinition[]>
  );

  const handleInsert = (variable: TemplateVariableDefinition) => {
    onInsert(`{{${variable.key}}}`);
    setIsOpen(false);
    setSearch("");
  };

  const handleCopy = (variable: TemplateVariableDefinition, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`{{${variable.key}}}`);
    setCopiedKey(variable.key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const categoryColors: Record<string, string> = {
    client: "bg-blue-50 text-blue-700 border-blue-200",
    clinician: "bg-purple-50 text-purple-700 border-purple-200",
    practice: "bg-green-50 text-green-700 border-green-200",
    datetime: "bg-amber-50 text-amber-700 border-amber-200",
    appointment: "bg-rose-50 text-rose-700 border-rose-200",
    custom: "bg-gray-50 text-gray-700 border-gray-200",
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
      >
        <span className="font-mono text-blue-600">{"{{}}"}</span>
        Insert Variable
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white border rounded-lg shadow-lg z-50 max-h-[400px] overflow-hidden flex flex-col">
          {/* Search */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search variables..."
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
          </div>

          {/* Variables List */}
          <div className="overflow-y-auto flex-1">
            {Object.keys(filteredCategories).length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No variables match your search.
              </div>
            ) : (
              Object.entries(filteredCategories).map(([category, variables]) => {
                const categoryInfo = VARIABLE_CATEGORIES[category as keyof typeof VARIABLE_CATEGORIES];
                return (
                  <div key={category}>
                    {/* Category Header */}
                    <div className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide ${categoryColors[category]} border-b`}>
                      {categoryInfo?.label || category}
                    </div>

                    {/* Variables */}
                    {variables.map((variable) => (
                      <div
                        key={variable.key}
                        onClick={() => handleInsert(variable)}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-start gap-3 border-b border-gray-100 last:border-0 cursor-pointer"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono text-blue-600">
                              {`{{${variable.key}}}`}
                            </code>
                            {variable.isRequired && (
                              <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                                Required
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">
                            {variable.description}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Example: {variable.exampleValue}
                          </p>
                        </div>
                        <button
                          onClick={(e) => handleCopy(variable, e)}
                          className="p-1 hover:bg-gray-200 rounded"
                          title="Copy to clipboard"
                        >
                          {copiedKey === variable.key ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t bg-gray-50 text-xs text-gray-500 text-center">
            Click a variable to insert it at the cursor position
          </div>
        </div>
      )}
    </div>
  );
}
