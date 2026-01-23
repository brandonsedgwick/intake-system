'use client';

import { useState } from 'react';
import { Client } from '@/types/client';
import { X, Sparkles, Chrome } from 'lucide-react';
import { fillFormWithExtension, isExtensionAvailable } from '@/lib/services/chrome-extension';

interface CreateClientModalProps {
  client: Client;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (simplePracticeId: string, method: 'puppeteer' | 'extension') => void;
}

export default function CreateClientModal({
  client,
  isOpen,
  onClose,
  onSuccess
}: CreateClientModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<'puppeteer' | 'extension' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extensionAvailable = isExtensionAvailable();

  if (!isOpen) return null;

  const handleExtensionMethod = async () => {
    setLoading(true);
    setError(null);

    try {
      // Parse date of birth into components for Simple Practice dropdowns
      let dateOfBirthMonth = '';
      let dateOfBirthDay = '';
      let dateOfBirthYear = '';

      if (client.dateOfBirth) {
        try {
          const date = new Date(client.dateOfBirth);
          if (!isNaN(date.getTime())) {
            dateOfBirthMonth = String(date.getMonth() + 1); // 1-12
            dateOfBirthDay = String(date.getDate()); // 1-31
            dateOfBirthYear = String(date.getFullYear()); // YYYY
          }
        } catch (e) {
          console.warn('Failed to parse date of birth:', e);
        }
      }

      // Parse scheduled appointment for clinician name
      let clinicianName = '';
      if (client.scheduledAppointment) {
        try {
          const appointment = JSON.parse(client.scheduledAppointment);
          clinicianName = appointment.clinician || '';
        } catch (e) {
          console.warn('Failed to parse scheduled appointment:', e);
        }
      }

      // Format client data for Simple Practice
      const formData = {
        firstName: client.firstName || '',
        lastName: client.lastName || '',
        email: client.email || '',
        phone: client.phone || '',
        dateOfBirthMonth,
        dateOfBirthDay,
        dateOfBirthYear,
        isSelfPay: client.paymentType === 'Self-pay',
        // NEW v4.0.0 fields
        hasInsurance: client.paymentType !== 'Self-pay', // Conditional flag for insurance selection
        clinicianName: clinicianName, // From scheduled appointment
        status: 'Active' // Static value always
      };

      // Store data in extension's storage via message
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        setError('Chrome extension not available. Please install the Form Filler extension.');
        setLoading(false);
        return;
      }

      const EXTENSION_ID = process.env.NEXT_PUBLIC_FORM_FILLER_EXTENSION_ID || 'ejjpmlmnogidonckoacipbaaagfojfkp';

      // Send data to extension to store
      chrome.runtime.sendMessage(
        EXTENSION_ID,
        {
          action: 'storeClientData',
          data: formData
        },
        (response) => {
          if (chrome.runtime.lastError) {
            setError('Failed to communicate with extension: ' + chrome.runtime.lastError.message);
            setLoading(false);
            return;
          }

          if (response?.success) {
            // Now open Simple Practice in new tab
            const newTab = window.open('https://secure.simplepractice.com/clients/new', '_blank');

            if (!newTab) {
              setError('Please allow popups for this site to use the extension method.');
              setLoading(false);
              return;
            }

            // Show instructions
            alert(
              'Simple Practice is opening in a new tab.\n\n' +
              'Once the client creation form appears:\n' +
              '1. Click the extension icon (puzzle piece in Chrome toolbar)\n' +
              '2. Click "Fill Form" button\n' +
              '3. Review the filled fields\n' +
              '4. Submit the form\n' +
              '5. Come back here to enter the Client ID'
            );

            onClose();
          } else {
            setError('Failed to store data in extension');
            setLoading(false);
          }
        }
      );

    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handlePuppeteerMethod = async () => {
    setLoading(true);
    setError(null);

    try {
      // Parse date of birth into components
      let dateOfBirthMonth = '';
      let dateOfBirthDay = '';
      let dateOfBirthYear = '';

      if (client.dateOfBirth) {
        try {
          const date = new Date(client.dateOfBirth);
          if (!isNaN(date.getTime())) {
            dateOfBirthMonth = String(date.getMonth() + 1);
            dateOfBirthDay = String(date.getDate());
            dateOfBirthYear = String(date.getFullYear());
          }
        } catch (e) {
          console.warn('Failed to parse date of birth:', e);
        }
      }

      // Parse scheduled appointment for clinician name
      let clinicianName = '';
      if (client.scheduledAppointment) {
        try {
          const appointment = JSON.parse(client.scheduledAppointment);
          clinicianName = appointment.clinician || '';
        } catch (e) {
          console.warn('Failed to parse scheduled appointment:', e);
        }
      }

      // Call Puppeteer API endpoint
      const response = await fetch('/api/simple-practice/create-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientData: {
            firstName: client.firstName || '',
            lastName: client.lastName || '',
            email: client.email || '',
            phone: client.phone || '',
            dateOfBirthMonth,
            dateOfBirthDay,
            dateOfBirthYear,
            hasInsurance: client.paymentType !== 'Self-pay',
            clinicianName,
            status: 'Active'
          }
        })
      });

      const data = await response.json();

      if (data.success && data.simplePracticeId) {
        onSuccess(data.simplePracticeId, 'puppeteer');
        onClose();
      } else {
        setError(data.error || 'Failed to create client in Simple Practice');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMethodSelect = (method: 'puppeteer' | 'extension') => {
    setSelectedMethod(method);
    setError(null);

    if (method === 'extension') {
      handleExtensionMethod();
    } else {
      handlePuppeteerMethod();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Create Client in Simple Practice
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {client.firstName} {client.lastName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={loading}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <p className="text-gray-700 mb-6">
            Choose how you'd like to create this client in Simple Practice:
          </p>

          <div className="space-y-4">
            {/* Option 1: Browser Automation */}
            <button
              onClick={() => handleMethodSelect('puppeteer')}
              disabled={loading}
              className="w-full text-left border-2 border-purple-200 rounded-xl p-6 hover:border-purple-400 hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    Browser Automation (Puppeteer)
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Fully automated - logs into Simple Practice and creates the client for you.
                    You can watch it happen in a browser window.
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-100 text-green-700 text-xs font-medium">
                      ✓ Fully automated
                    </span>
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-700 text-xs font-medium">
                      Auto-captures ID
                    </span>
                  </div>
                </div>
              </div>
            </button>

            {/* Option 2: Chrome Extension */}
            <button
              onClick={() => handleMethodSelect('extension')}
              disabled={loading || !extensionAvailable}
              className="w-full text-left border-2 border-gray-200 rounded-xl p-6 hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Chrome className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">
                    Chrome Extension Auto-Fill
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Opens Simple Practice in a new tab and automatically fills the form fields.
                    You review and submit manually.
                  </p>
                  <div className="flex items-center gap-2">
                    {extensionAvailable ? (
                      <>
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-100 text-green-700 text-xs font-medium">
                          ✓ Extension installed
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-amber-100 text-amber-700 text-xs font-medium">
                          Manual submit
                        </span>
                      </>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-red-100 text-red-700 text-xs font-medium">
                        Extension not installed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          </div>

          {!extensionAvailable && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Extension not detected.</strong> Install the Form Filler extension to use the auto-fill option.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
