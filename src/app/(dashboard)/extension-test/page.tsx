'use client';

import { useState } from 'react';

const EXTENSION_ID = 'ejjpmlmnogidonckoacipbaaagfojfkp'; // Your extension ID

export default function ExtensionTestPage() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const testExtension = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Check if chrome.runtime is available
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        throw new Error('Chrome runtime API not available. Make sure you\'re running this in Chrome.');
      }

      // Test message
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          EXTENSION_ID,
          {
            action: 'fillForm',
            data: {
              firstName: 'John',
              lastName: 'Doe',
              email: 'john@example.com',
              phone: '555-1234',
              dateOfBirth: '1990-01-15'
            },
            mappingId: 'simple-practice-client'
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          }
        );
      });

      setResult(response);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Chrome Extension Test</h1>

      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Extension Configuration</h2>
        <div className="space-y-2 text-sm">
          <div className="flex">
            <span className="font-medium w-32">Extension ID:</span>
            <code className="bg-gray-100 px-2 py-1 rounded">{EXTENSION_ID}</code>
          </div>
          <div className="flex">
            <span className="font-medium w-32">Mapping ID:</span>
            <code className="bg-gray-100 px-2 py-1 rounded">simple-practice-client</code>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Test Extension Communication</h2>
        <p className="text-gray-600 mb-4">
          This will send test data to the extension to verify communication works.
        </p>

        <button
          onClick={testExtension}
          disabled={loading}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test Extension'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <h3 className="text-red-900 font-semibold mb-2">Error</h3>
          <p className="text-red-800 text-sm">{error}</p>
          <div className="mt-4 text-xs text-red-700">
            <p className="font-medium mb-2">Common issues:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Extension not installed or not loaded in Chrome</li>
              <li>Extension ID doesn't match (check chrome://extensions)</li>
              <li>Extension doesn't have this origin in externally_connectable</li>
            </ul>
          </div>
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-green-900 font-semibold mb-2">Success!</h3>
          <pre className="bg-white p-4 rounded border text-xs overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-blue-900 font-semibold mb-2">Setup Instructions</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
          <li>Open Chrome and navigate to <code className="bg-blue-100 px-1 rounded">chrome://extensions</code></li>
          <li>Enable "Developer mode" (toggle in top right)</li>
          <li>Click "Load unpacked"</li>
          <li>Select: <code className="bg-blue-100 px-1 rounded">/Users/brandonsedgwick/development/generic-form-filler-extension/dist</code></li>
          <li>Copy the Extension ID and update it in this file if different</li>
          <li>Reload this page and click "Test Extension"</li>
        </ol>
      </div>
    </div>
  );
}
