"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Folder,
  FolderOpen,
  FileText,
  Star,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { EmailTemplate, TemplateSection } from "@/types/client";

interface TemplatesSidebarProps {
  sections: TemplateSection[];
  templates: EmailTemplate[];
  selectedTemplateId: string | null;
  onSelectTemplate: (templateId: string) => void;
  onCreateTemplate: () => void;
  onCreateSection: () => void;
  onEditSection: (section: TemplateSection) => void;
  onDeleteSection: (sectionId: string) => void;
  isLoading?: boolean;
}

interface SectionItemProps {
  section: TemplateSection | null; // null for uncategorized
  templates: EmailTemplate[];
  selectedTemplateId: string | null;
  onSelectTemplate: (templateId: string) => void;
  onEditSection?: () => void;
  onDeleteSection?: () => void;
  defaultExpanded?: boolean;
}

// Color mapping for section badges
const SECTION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  blue: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  green: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" },
  purple: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  red: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

function SectionItem({
  section,
  templates,
  selectedTemplateId,
  onSelectTemplate,
  onEditSection,
  onDeleteSection,
  defaultExpanded = true,
}: SectionItemProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showMenu, setShowMenu] = useState(false);

  const sectionColor = section?.color
    ? SECTION_COLORS[section.color]
    : { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" };

  const sectionName = section?.name || "Uncategorized";
  const isUncategorized = !section;

  return (
    <div className="select-none">
      {/* Section Header */}
      <div
        className={`flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-100 ${
          isUncategorized ? "border-t border-gray-200 mt-2" : ""
        }`}
      >
        <div
          className="flex items-center gap-2 flex-1"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <>
              <ChevronDown className="w-4 h-4 text-gray-400" />
              <FolderOpen className={`w-4 h-4 ${sectionColor.text}`} />
            </>
          ) : (
            <>
              <ChevronRight className="w-4 h-4 text-gray-400" />
              <Folder className={`w-4 h-4 ${sectionColor.text}`} />
            </>
          )}
          <span className="text-sm font-medium text-gray-700 truncate">
            {sectionName}
          </span>
          <span className="text-xs text-gray-400">({templates.length})</span>
        </div>

        {!isUncategorized && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 hover:bg-gray-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="w-4 h-4 text-gray-400" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-6 bg-white border rounded-lg shadow-lg z-20 py-1 w-36">
                  <button
                    onClick={() => {
                      onEditSection?.();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <Pencil className="w-4 h-4" />
                    Edit Section
                  </button>
                  <button
                    onClick={() => {
                      onDeleteSection?.();
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Templates List */}
      {isExpanded && (
        <div className="ml-4">
          {templates.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400 italic">
              No templates
            </p>
          ) : (
            templates.map((template) => (
              <button
                key={template.id}
                onClick={() => onSelectTemplate(template.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-lg transition-colors ${
                  selectedTemplateId === template.id
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <FileText className="w-4 h-4 flex-shrink-0" />
                <span className="truncate flex-1">{template.name}</span>
                {template.isDefault && (
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0" />
                )}
                {!template.isActive && (
                  <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded flex-shrink-0">
                    Inactive
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function TemplatesSidebar({
  sections,
  templates,
  selectedTemplateId,
  onSelectTemplate,
  onCreateTemplate,
  onCreateSection,
  onEditSection,
  onDeleteSection,
  isLoading = false,
}: TemplatesSidebarProps) {
  // Group templates by section
  const templatesBySection = templates.reduce(
    (acc, template) => {
      const sectionId = template.sectionId || "uncategorized";
      if (!acc[sectionId]) {
        acc[sectionId] = [];
      }
      acc[sectionId].push(template);
      return acc;
    },
    {} as Record<string, EmailTemplate[]>
  );

  // Sort templates within each section by order, then name
  Object.values(templatesBySection).forEach((sectionTemplates) => {
    sectionTemplates.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.name.localeCompare(b.name);
    });
  });

  const uncategorizedTemplates = templatesBySection["uncategorized"] || [];

  if (isLoading) {
    return (
      <div className="w-80 border-r bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
          <p className="mt-2 text-sm text-gray-500">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 border-r bg-gray-50 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Email Templates</h2>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCreateTemplate}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
          <button
            onClick={onCreateSection}
            className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
            title="New Section"
          >
            <Folder className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sections and Templates */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Ordered sections */}
        {sections.map((section) => (
          <div key={section.id} className="group">
            <SectionItem
              section={section}
              templates={templatesBySection[section.id] || []}
              selectedTemplateId={selectedTemplateId}
              onSelectTemplate={onSelectTemplate}
              onEditSection={() => onEditSection(section)}
              onDeleteSection={() => onDeleteSection(section.id)}
            />
          </div>
        ))}

        {/* Uncategorized */}
        {uncategorizedTemplates.length > 0 && (
          <SectionItem
            section={null}
            templates={uncategorizedTemplates}
            selectedTemplateId={selectedTemplateId}
            onSelectTemplate={onSelectTemplate}
            defaultExpanded={sections.length === 0}
          />
        )}

        {/* Empty state */}
        {templates.length === 0 && sections.length === 0 && (
          <div className="p-4 text-center">
            <FileText className="w-8 h-8 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No templates yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Create your first template to get started
            </p>
          </div>
        )}
      </div>

      {/* Stats Footer */}
      <div className="p-3 border-t bg-white text-xs text-gray-500">
        <span>
          {templates.length} template{templates.length !== 1 ? "s" : ""} •{" "}
          {sections.length} section{sections.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
