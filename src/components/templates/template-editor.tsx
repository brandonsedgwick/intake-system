"use client";

import { useState, useEffect, useCallback } from "react";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Undo,
  Redo,
  Quote,
  Save,
  Trash2,
  Eye,
  Loader2,
  Star,
  X,
  AlertTriangle,
} from "lucide-react";
import { EmailTemplate, TemplateSection } from "@/types/client";
import { VariableDropdown } from "./variable-dropdown";
import { usePreviewTemplate } from "@/hooks/use-templates";

interface TemplateEditorProps {
  template: EmailTemplate | null;
  sections: TemplateSection[];
  onSave: (data: Partial<EmailTemplate>) => Promise<void>;
  onDelete?: () => Promise<void>;
  onSetDefault?: () => Promise<void>;
  onCancel: () => void;
  isSaving: boolean;
  isNew?: boolean;
}

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded transition-colors ${
        isActive
          ? "bg-blue-100 text-blue-700"
          : "text-gray-600 hover:bg-gray-100"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );
}

function EditorToolbar({
  editor,
  onInsertVariable,
}: {
  editor: Editor | null;
  onInsertVariable: (variable: string) => void;
}) {
  const setLink = useCallback(() => {
    if (!editor) return;

    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);

    if (url === null) return;

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-2 p-2 border-b bg-gray-50">
      <div className="flex items-center gap-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive("blockquote")}
          title="Quote"
        >
          <Quote className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <ToolbarButton
          onClick={setLink}
          isActive={editor.isActive("link")}
          title="Add Link"
        >
          <LinkIcon className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (Ctrl+Z)"
        >
          <Undo className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo className="w-4 h-4" />
        </ToolbarButton>
      </div>

      <VariableDropdown onInsert={onInsertVariable} />
    </div>
  );
}

/**
 * Preview component that safely renders HTML content using an iframe sandbox
 * This prevents XSS attacks by isolating the content in a sandboxed iframe
 */
function SafeHTMLPreview({ html }: { html: string }) {
  const srcDoc = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            line-height: 1.6;
            color: #333;
            padding: 16px;
            margin: 0;
          }
          a { color: #2563eb; }
          p { margin: 0 0 1em 0; }
          ul, ol { margin: 0 0 1em 0; padding-left: 1.5em; }
          blockquote {
            border-left: 3px solid #e5e7eb;
            margin: 0 0 1em 0;
            padding-left: 1em;
            color: #666;
          }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `;

  return (
    <iframe
      srcDoc={srcDoc}
      sandbox="allow-same-origin"
      className="w-full h-full border-0"
      title="Email preview"
    />
  );
}

export function TemplateEditor({
  template,
  sections,
  onSave,
  onDelete,
  onSetDefault,
  onCancel,
  isSaving,
  isNew = false,
}: TemplateEditorProps) {
  const [name, setName] = useState(template?.name || "");
  const [type, setType] = useState<string>(template?.type || "initial_outreach");
  const [subject, setSubject] = useState(template?.subject || "");
  const [body, setBody] = useState(template?.body || "");
  const [isActive, setIsActive] = useState(template?.isActive ?? true);
  const [sectionId, setSectionId] = useState<string | undefined>(template?.sectionId);
  const [isDirty, setIsDirty] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const previewMutation = usePreviewTemplate();

  // Initialize editor
  const editor = useEditor({
    immediatelyRender: false, // Prevent SSR hydration mismatch
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-600 underline",
        },
      }),
      Placeholder.configure({
        placeholder: "Write your email template here...",
        emptyEditorClass:
          "before:content-[attr(data-placeholder)] before:text-gray-400 before:float-left before:h-0 before:pointer-events-none",
      }),
    ],
    content: body,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4",
      },
    },
    onUpdate: ({ editor }) => {
      setBody(editor.getHTML());
      setIsDirty(true);
    },
  });

  // Update editor when template changes
  useEffect(() => {
    if (editor && template) {
      editor.commands.setContent(template.body);
      setName(template.name);
      setType(template.type);
      setSubject(template.subject);
      setBody(template.body);
      setIsActive(template.isActive);
      setSectionId(template.sectionId);
      setIsDirty(false);
    }
  }, [template, editor]);

  // Warn on unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const handleInsertVariable = useCallback(
    (variable: string) => {
      if (editor) {
        editor.chain().focus().insertContent(variable).run();
      }
    },
    [editor]
  );

  const handleInsertVariableInSubject = (variable: string) => {
    // Insert at cursor position in subject
    const input = document.getElementById("subject-input") as HTMLInputElement;
    if (input) {
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const newSubject = subject.slice(0, start) + variable + subject.slice(end);
      setSubject(newSubject);
      setIsDirty(true);
      // Reset cursor position after state update
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  };

  const handleSave = async () => {
    // Strip HTML tags to check if body has actual content
    const strippedBody = body.replace(/<[^>]*>/g, "").trim();

    if (!name.trim() || !subject.trim() || !strippedBody) {
      alert("Please fill in all required fields: Name, Subject, and Body");
      return;
    }

    try {
      await onSave({
        name: name.trim(),
        type: (type.trim() || "custom") as EmailTemplate["type"],
        subject: subject.trim(),
        body,
        bodyFormat: "html",
        isActive,
        sectionId,
      });
      setIsDirty(false);
    } catch (error) {
      console.error("Failed to save template:", error);
      alert("Failed to save template. Please try again.");
    }
  };

  const handlePreview = async () => {
    try {
      await previewMutation.mutateAsync({
        template: { name, type: type as EmailTemplate["type"], subject, body, bodyFormat: "html" },
        useSampleData: true,
      });
      setShowPreview(true);
    } catch (error) {
      console.error("Preview failed:", error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div className="flex items-center gap-4 flex-1">
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setIsDirty(true);
            }}
            placeholder="Template Name *"
            className={`text-lg font-medium border-0 border-b-2 focus:border-blue-500 focus:outline-none bg-transparent ${
              name.trim() ? "border-transparent" : "border-red-300"
            }`}
          />

          {template?.isDefault && (
            <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-medium">
              <Star className="w-3 h-3 fill-amber-500" />
              Default
            </span>
          )}
        </div>

        <button
          onClick={onCancel}
          className="p-2 text-gray-400 hover:text-gray-600"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Section Selector */}
      <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 border-b">
        <label className="text-sm text-gray-600">Section:</label>
        <select
          value={sectionId || ""}
          onChange={(e) => {
            setSectionId(e.target.value || undefined);
            setIsDirty(true);
          }}
          className="text-sm border rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Uncategorized</option>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 ml-auto">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => {
              setIsActive(e.target.checked);
              setIsDirty(true);
            }}
            className="rounded border-gray-300 text-blue-600"
          />
          <span className="text-sm text-gray-600">Active</span>
        </label>
      </div>

      {/* Subject Line */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-white">
        <label className="text-sm font-medium text-gray-700 w-16">Subject: *</label>
        <input
          id="subject-input"
          type="text"
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            setIsDirty(true);
          }}
          placeholder="Email subject line with {{variables}}"
          className={`flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            subject.trim() ? "border-gray-300" : "border-red-300"
          }`}
        />
        <VariableDropdown onInsert={handleInsertVariableInSubject} />
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <EditorToolbar editor={editor} onInsertVariable={handleInsertVariable} />
        <div className="flex-1 overflow-y-auto bg-white">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between p-4 border-t bg-gray-50">
        <div className="flex items-center gap-2">
          {onDelete && !isNew && (
            <button
              onClick={onDelete}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}

          {onSetDefault && !isNew && !template?.isDefault && (
            <button
              onClick={onSetDefault}
              className="flex items-center gap-2 px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 rounded-lg"
            >
              <Star className="w-4 h-4" />
              Set as Default
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-sm text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" />
              Unsaved changes
            </span>
          )}

          <button
            onClick={handlePreview}
            disabled={previewMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            {previewMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            Preview
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim() || !subject.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {isNew ? "Save Template" : "Save Changes"}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && previewMutation.data && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-medium">Template Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b bg-gray-50">
              <p className="text-sm text-gray-500">Subject:</p>
              <p className="font-medium">{previewMutation.data.subject}</p>
            </div>

            <div className="flex-1 overflow-hidden min-h-[300px]">
              <SafeHTMLPreview html={previewMutation.data.body} />
            </div>

            <div className="p-4 border-t bg-gray-50">
              <p className="text-xs text-gray-500">
                This preview uses sample data. Actual values will vary based on client information.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
