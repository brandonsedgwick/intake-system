'use client';

import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';

interface SimplePracticeIdModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: string) => void;
  autoDetectedId?: string | null;
  clientName: string;
}

export default function SimplePracticeIdModal({
  isOpen,
  onClose,
  onSubmit,
  autoDetectedId,
  clientName
}: SimplePracticeIdModalProps) {
  const [simplePracticeId, setSimplePracticeId] = useState(autoDetectedId || '');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = () => {
    const trimmedId = simplePracticeId.trim();

    if (!trimmedId) {
      setError('Please enter a Simple Practice Client ID');
      return;
    }

    // Validate it's a number (Simple Practice IDs are numeric)
    if (!/^\d+$/.test(trimmedId)) {
      setError('Simple Practice Client ID should be a number');
      return;
    }

    onSubmit(trimmedId);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">
            Enter Simple Practice Client ID
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!autoDetectedId && (
            <div className="mb-4 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium mb-1">Couldn't automatically detect the client ID</p>
                <p>Please enter it manually from the Simple Practice URL.</p>
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Client: <span className="text-gray-900">{clientName}</span>
            </label>

            <label className="block text-sm font-medium text-gray-700 mb-2">
              Simple Practice Client ID
            </label>
            <input
              type="text"
              value={simplePracticeId}
              onChange={(e) => {
                setSimplePracticeId(e.target.value);
                setError(null);
              }}
              placeholder="e.g., 12345"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900 font-medium mb-2">
              How to find the Client ID:
            </p>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Go to the client profile in Simple Practice</li>
              <li>Look at the URL in your browser</li>
              <li>The URL will look like: <code className="bg-blue-100 px-1 rounded text-xs">https://secure.simplepractice.com/clients/12345</code></li>
              <li>The number at the end (12345) is the Client ID</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Save Client ID
          </button>
        </div>
      </div>
    </div>
  );
}
