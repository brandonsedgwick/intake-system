"use client";

import { useState } from "react";
import { FileText, AlertTriangle, Mail } from "lucide-react";
import { EmailTemplate, TemplateSection } from "@/types/client";
import {
  useTemplates,
  useTemplateById,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useSetDefaultTemplate,
} from "@/hooks/use-templates";
import {
  useTemplateSections,
  useCreateTemplateSection,
  useUpdateTemplateSection,
  useDeleteTemplateSection,
} from "@/hooks/use-template-sections";
import { TemplatesSidebar } from "./templates-sidebar";
import { TemplateEditor } from "./template-editor";
import { SectionModal } from "./section-modal";

export function TemplatesPage() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [editingSection, setEditingSection] = useState<TemplateSection | null>(null);
  const [isCreatingSection, setIsCreatingSection] = useState(false);

  // Data fetching
  const { data: templates = [], isLoading: templatesLoading, error: templatesError } = useTemplates();
  const { data: sections = [], isLoading: sectionsLoading } = useTemplateSections();
  const { data: selectedTemplate } = useTemplateById(selectedTemplateId);

  // Template mutations
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();
  const setDefaultTemplate = useSetDefaultTemplate();

  // Section mutations
  const createSection = useCreateTemplateSection();
  const updateSection = useUpdateTemplateSection();
  const deleteSection = useDeleteTemplateSection();

  const isLoading = templatesLoading || sectionsLoading;
  const isSaving =
    createTemplate.isPending ||
    updateTemplate.isPending ||
    deleteTemplate.isPending ||
    setDefaultTemplate.isPending;

  const isSectionSaving =
    createSection.isPending ||
    updateSection.isPending ||
    deleteSection.isPending;

  // Handlers
  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setIsCreatingNew(false);
  };

  const handleCreateTemplate = () => {
    setSelectedTemplateId(null);
    setIsCreatingNew(true);
  };

  const handleCancelEdit = () => {
    setSelectedTemplateId(null);
    setIsCreatingNew(false);
  };

  const handleSaveTemplate = async (data: Partial<EmailTemplate>) => {
    try {
      if (isCreatingNew) {
        const newTemplate = await createTemplate.mutateAsync({
          name: data.name || "New Template",
          type: data.type || "initial_outreach",
          subject: data.subject || "",
          body: data.body || "",
          bodyFormat: data.bodyFormat || "html",
          isActive: data.isActive ?? true,
          isDefault: data.isDefault ?? false,
          sectionId: data.sectionId,
          order: data.order || 0,
        });
        setSelectedTemplateId(newTemplate.id);
        setIsCreatingNew(false);
      } else if (selectedTemplateId) {
        await updateTemplate.mutateAsync({
          id: selectedTemplateId,
          data,
        });
      }
    } catch (error) {
      console.error("Failed to save template:", error);
      throw error; // Re-throw so the editor can catch it
    }
  };

  const handleDeleteTemplate = async () => {
    if (!selectedTemplateId) return;

    if (!confirm("Are you sure you want to delete this template? This action cannot be undone.")) {
      return;
    }

    await deleteTemplate.mutateAsync(selectedTemplateId);
    setSelectedTemplateId(null);
  };

  const handleSetDefaultTemplate = async () => {
    if (!selectedTemplateId) return;

    await setDefaultTemplate.mutateAsync(selectedTemplateId);
  };

  const handleCreateSection = () => {
    setEditingSection(null);
    setIsCreatingSection(true);
  };

  const handleEditSection = (section: TemplateSection) => {
    setEditingSection(section);
    setIsCreatingSection(true);
  };

  const handleDeleteSection = async (sectionId: string) => {
    const sectionTemplates = templates.filter((t) => t.sectionId === sectionId);

    if (sectionTemplates.length > 0) {
      const confirmed = confirm(
        `This section contains ${sectionTemplates.length} template(s). ` +
        "Deleting the section will move those templates to 'Uncategorized'. Continue?"
      );
      if (!confirmed) return;
    } else {
      if (!confirm("Are you sure you want to delete this section?")) {
        return;
      }
    }

    await deleteSection.mutateAsync(sectionId);
  };

  const handleSaveSection = async (data: { name: string; color?: TemplateSection["color"] }) => {
    if (editingSection) {
      await updateSection.mutateAsync({
        id: editingSection.id,
        data,
      });
    } else {
      await createSection.mutateAsync({
        name: data.name,
        color: data.color,
        order: sections.length,
      });
    }
    setIsCreatingSection(false);
    setEditingSection(null);
  };

  const handleCloseSectionModal = () => {
    setIsCreatingSection(false);
    setEditingSection(null);
  };

  // Error state
  if (templatesError) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center p-8">
          <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-4" />
          <h2 className="text-lg font-medium text-gray-900 mb-2">
            Failed to load templates
          </h2>
          <p className="text-gray-600">
            {(templatesError as Error).message}
          </p>
        </div>
      </div>
    );
  }

  // Get the template to show in the editor
  const templateToEdit = isCreatingNew
    ? null
    : selectedTemplate || null;

  const showEditor = isCreatingNew || selectedTemplateId;

  return (
    <div className="flex h-full bg-gray-100">
      {/* Sidebar */}
      <TemplatesSidebar
        sections={sections}
        templates={templates}
        selectedTemplateId={selectedTemplateId}
        onSelectTemplate={handleSelectTemplate}
        onCreateTemplate={handleCreateTemplate}
        onCreateSection={handleCreateSection}
        onEditSection={handleEditSection}
        onDeleteSection={handleDeleteSection}
        isLoading={isLoading}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {showEditor ? (
          <TemplateEditor
            template={templateToEdit}
            sections={sections}
            onSave={handleSaveTemplate}
            onDelete={selectedTemplateId ? handleDeleteTemplate : undefined}
            onSetDefault={selectedTemplateId ? handleSetDefaultTemplate : undefined}
            onCancel={handleCancelEdit}
            isSaving={isSaving}
            isNew={isCreatingNew}
          />
        ) : (
          // Empty state
          <div className="flex-1 flex items-center justify-center bg-white">
            <div className="text-center max-w-md p-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
                <Mail className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Email Templates
              </h2>
              <p className="text-gray-600 mb-6">
                Create and manage email templates for client communications.
                Use variables like <code className="text-blue-600">{`{{clientFirstName}}`}</code> to
                personalize your messages.
              </p>

              <div className="space-y-3">
                <button
                  onClick={handleCreateTemplate}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <FileText className="w-5 h-5" />
                  Create Your First Template
                </button>

                {templates.length > 0 && (
                  <p className="text-sm text-gray-500">
                    Or select a template from the sidebar to edit it
                  </p>
                )}
              </div>

              {/* Quick Stats */}
              {templates.length > 0 && (
                <div className="mt-8 pt-6 border-t grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-semibold text-gray-900">
                      {templates.length}
                    </p>
                    <p className="text-sm text-gray-500">Templates</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-gray-900">
                      {templates.filter((t) => t.isActive).length}
                    </p>
                    <p className="text-sm text-gray-500">Active</p>
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-gray-900">
                      {templates.filter((t) => t.isDefault).length}
                    </p>
                    <p className="text-sm text-gray-500">Defaults Set</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Section Modal */}
      <SectionModal
        section={editingSection}
        isOpen={isCreatingSection}
        onClose={handleCloseSectionModal}
        onSave={handleSaveSection}
        isSaving={isSectionSaving}
      />
    </div>
  );
}
