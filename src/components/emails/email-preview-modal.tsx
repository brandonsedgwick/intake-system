"use client";

import { useState, useEffect } from "react";
import { useEmailPreview, useSendEmail, EmailPreview } from "@/hooks/use-emails";
import { EmailTemplate } from "@/types/client";
import { X, Send, Edit2, Loader2, AlertCircle, CheckCircle } from "lucide-react";

interface EmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  templateType: EmailTemplate["type"];
  clinicianId?: string;
  availabilitySlots?: string[];
}

export function EmailPreviewModal({
  isOpen,
  onClose,
  clientId,
  clientName,
  templateType,
  clinicianId,
  availabilitySlots,
}: EmailPreviewModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState("");
  const [editedBody, setEditedBody] = useState("");
  const [sendSuccess, setSendSuccess] = useState(false);

  const previewMutation = useEmailPreview();
  const sendMutation = useSendEmail();

  // Load preview when modal opens
  useEffect(() => {
    if (isOpen && clientId && templateType) {
      previewMutation.mutate({
        clientId,
        templateType,
        clinicianId,
        availabilitySlots,
      });
      setSendSuccess(false);
    }
  }, [isOpen, clientId, templateType, clinicianId]);

  // Update edited content when preview loads
  useEffect(() => {
    if (previewMutation.data) {
      setEditedSubject(previewMutation.data.subject);
      setEditedBody(previewMutation.data.body);
    }
  }, [previewMutation.data]);

  const handleSend = async () => {
    if (!previewMutation.data) return;

    try {
      await sendMutation.mutateAsync({
        clientId,
        to: previewMutation.data.to,
        from: previewMutation.data.from,
        subject: isEditing ? editedSubject : previewMutation.data.subject,
        body: isEditing ? editedBody : previewMutation.data.body,
        templateType,
      });
      setSendSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      // Error is handled by mutation state
    }
  };

  if (!isOpen) return null;

  const preview = previewMutation.data;
  const isLoading = previewMutation.isPending;
  const error = previewMutation.error || sendMutation.error;
  const isSending = sendMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Preview Email for {clientName}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600">Generating preview...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error.message}</span>
            </div>
          ) : sendSuccess ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Email Sent Successfully!
              </h3>
              <p className="text-gray-600">
                The email has been sent to {preview?.to}
              </p>
            </div>
          ) : preview ? (
            <div className="space-y-4">
              {/* Email metadata */}
              <div className="grid grid-cols-[80px_1fr] gap-2 text-sm">
                <span className="text-gray-500">To:</span>
                <span className="text-gray-900">{preview.to}</span>

                <span className="text-gray-500">From:</span>
                <span className="text-gray-900">{preview.from}</span>

                <span className="text-gray-500">Subject:</span>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedSubject}
                    onChange={(e) => setEditedSubject(e.target.value)}
                    className="border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <span className="text-gray-900 font-medium">
                    {preview.subject}
                  </span>
                )}
              </div>

              {/* Email body */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-500">Message:</span>
                  <button
                    onClick={() => setIsEditing(!isEditing)}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Edit2 className="w-4 h-4" />
                    {isEditing ? "Preview" : "Edit"}
                  </button>
                </div>

                {isEditing ? (
                  <textarea
                    value={editedBody}
                    onChange={(e) => setEditedBody(e.target.value)}
                    rows={12}
                    className="w-full border rounded-lg p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap text-gray-700">
                    {isEditing ? editedBody : preview.body}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        {!sendSuccess && preview && (
          <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={isSending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Email
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
