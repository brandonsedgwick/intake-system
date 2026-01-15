"use client";

import { useState } from "react";
import {
  useSettings,
  useUpdateSettings,
  useSheetsStatus,
  useSetupSheets,
  useIntakeFields,
  useSaveIntakeFields,
  IntakeField,
} from "@/hooks/use-settings";
import {
  Settings,
  Database,
  Mail,
  Clock,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  Save,
  ClipboardCheck,
} from "lucide-react";
import { EvaluationConfig } from "@/components/settings/evaluation-config";

type SettingsTab = "general" | "sheets" | "followups" | "intake-fields" | "evaluation";

function GeneralSettings() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const [formData, setFormData] = useState<Record<string, string>>({});

  // Initialize form data when settings load
  useState(() => {
    if (settings) {
      setFormData(settings);
    }
  });

  const handleSave = async () => {
    await updateSettings.mutateAsync({
      ...settings,
      ...formData,
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Practice Name
        </label>
        <input
          type="text"
          value={formData.practiceName || settings?.practiceName || ""}
          onChange={(e) =>
            setFormData({ ...formData, practiceName: e.target.value })
          }
          placeholder="Therapy Practice"
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          Used in email templates and the application header
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Practice Email
        </label>
        <input
          type="email"
          value={formData.practiceEmail || settings?.practiceEmail || ""}
          onChange={(e) =>
            setFormData({ ...formData, practiceEmail: e.target.value })
          }
          placeholder="intake@therapypractice.com"
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">
          Email address used for sending outreach emails
        </p>
      </div>

      <button
        onClick={handleSave}
        disabled={updateSettings.isPending}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {updateSettings.isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            Save Changes
          </>
        )}
      </button>
    </div>
  );
}

function SheetsSettings() {
  const { data: status, isLoading, refetch } = useSheetsStatus();
  const setupSheets = useSetupSheets();

  const handleSetup = async () => {
    await setupSheets.mutateAsync();
    refetch();
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Spreadsheet Info */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-2">Connected Spreadsheet</h3>
        <p className="text-sm text-gray-600 font-mono break-all">
          {status?.spreadsheetId || "Not configured"}
        </p>
        <p className="text-xs text-gray-500 mt-2">
          To change the spreadsheet, update the GOOGLE_SHEETS_SPREADSHEET_ID
          environment variable.
        </p>
      </div>

      {/* Sheet Status */}
      <div>
        <h3 className="font-medium text-gray-900 mb-3">Required Sheets</h3>
        <div className="space-y-2">
          {status?.requiredSheets?.map((sheetName: string) => {
            const exists = status?.existingSheets?.find(
              (s: { name: string }) => s.name === sheetName
            );
            return (
              <div
                key={sheetName}
                className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
              >
                <span className="text-sm text-gray-700">{sheetName}</span>
                {exists ? (
                  <span className="flex items-center gap-1 text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    Ready
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-yellow-600 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    Missing
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Setup Button */}
      {status?.missingSheets?.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-yellow-800">Setup Required</h4>
              <p className="text-sm text-yellow-700 mt-1">
                {status.missingSheets.length} sheet(s) need to be created. Click
                the button below to automatically set up all required sheets
                with proper headers and default data.
              </p>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleSetup}
        disabled={setupSheets.isPending}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {setupSheets.isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Setting up...
          </>
        ) : (
          <>
            <Database className="w-4 h-4" />
            {status?.missingSheets?.length > 0
              ? "Initialize Sheets"
              : "Reinitialize Sheets"}
          </>
        )}
      </button>

      {setupSheets.isSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            <span>Sheets initialized successfully!</span>
          </div>
        </div>
      )}

      {setupSheets.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span>{setupSheets.error.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function FollowUpSettings() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const [formData, setFormData] = useState({
    followUp1Days: "",
    followUp2Days: "",
    autoCloseDays: "",
  });

  // Initialize form data when settings load
  useState(() => {
    if (settings) {
      setFormData({
        followUp1Days: settings.followUp1Days || "3",
        followUp2Days: settings.followUp2Days || "5",
        autoCloseDays: settings.autoCloseDays || "7",
      });
    }
  });

  const handleSave = async () => {
    await updateSettings.mutateAsync(formData);
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Configure how long to wait before sending follow-up emails to clients
        who haven&apos;t responded.
      </p>

      <div className="grid grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            1st Follow-up After
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="30"
              value={formData.followUp1Days || settings?.followUp1Days || "3"}
              onChange={(e) =>
                setFormData({ ...formData, followUp1Days: e.target.value })
              }
              className="w-20 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">business days</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            2nd Follow-up After
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="30"
              value={formData.followUp2Days || settings?.followUp2Days || "5"}
              onChange={(e) =>
                setFormData({ ...formData, followUp2Days: e.target.value })
              }
              className="w-20 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">business days</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Auto-close After
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="60"
              value={formData.autoCloseDays || settings?.autoCloseDays || "7"}
              onChange={(e) =>
                setFormData({ ...formData, autoCloseDays: e.target.value })
              }
              className="w-20 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">business days</span>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">How it works</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>
            &bull; After initial outreach, wait{" "}
            {formData.followUp1Days || settings?.followUp1Days || "3"} days for
            1st follow-up
          </li>
          <li>
            &bull; If no response, wait{" "}
            {formData.followUp2Days || settings?.followUp2Days || "5"} more days
            for 2nd follow-up
          </li>
          <li>
            &bull; After{" "}
            {formData.autoCloseDays || settings?.autoCloseDays || "7"} total
            days with no contact, mark as closed
          </li>
        </ul>
      </div>

      <button
        onClick={handleSave}
        disabled={updateSettings.isPending}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {updateSettings.isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="w-4 h-4" />
            Save Changes
          </>
        )}
      </button>
    </div>
  );
}

function IntakeFieldsSettings() {
  const { data: fields, isLoading } = useIntakeFields();
  const saveFields = useSaveIntakeFields();
  const [localFields, setLocalFields] = useState<IntakeField[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize local fields when data loads
  useState(() => {
    if (fields) {
      setLocalFields(fields);
    }
  });

  const handleFieldChange = (
    index: number,
    key: keyof IntakeField,
    value: unknown
  ) => {
    const updated = [...localFields];
    (updated[index] as unknown as Record<string, unknown>)[key] = value;
    setLocalFields(updated);
    setHasChanges(true);
  };

  const handleAddField = () => {
    const newField: IntakeField = {
      id: `custom-${Date.now()}`,
      name: `customField${localFields.length + 1}`,
      label: "New Field",
      type: "text",
      required: false,
      mappedColumn: `customField${localFields.length + 1}`,
      order: localFields.length + 1,
      isActive: true,
    };
    setLocalFields([...localFields, newField]);
    setHasChanges(true);
  };

  const handleRemoveField = (index: number) => {
    const updated = localFields.filter((_, i) => i !== index);
    setLocalFields(updated);
    setHasChanges(true);
  };

  const handleSave = async () => {
    await saveFields.mutateAsync(localFields);
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
      </div>
    );
  }

  const displayFields = localFields.length > 0 ? localFields : fields || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Configure the fields collected from the intake form. These map to
          columns in the Clients sheet.
        </p>
        <button
          onClick={handleAddField}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
        >
          <Plus className="w-4 h-4" />
          Add Field
        </button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3 w-8"></th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">
                Label
              </th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">
                Type
              </th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">
                Column Name
              </th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">
                Form Field
              </th>
              <th className="text-center text-xs font-medium text-gray-500 uppercase px-4 py-3">
                Required
              </th>
              <th className="text-center text-xs font-medium text-gray-500 uppercase px-4 py-3">
                Active
              </th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {displayFields.map((field, index) => (
              <tr key={field.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) =>
                      handleFieldChange(index, "label", e.target.value)
                    }
                    className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-3">
                  <select
                    value={field.type}
                    onChange={(e) =>
                      handleFieldChange(index, "type", e.target.value)
                    }
                    className="border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="text">Text</option>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="date">Date</option>
                    <option value="select">Select</option>
                    <option value="multiselect">Multi-select</option>
                    <option value="textarea">Text Area</option>
                    <option value="checkbox">Checkbox</option>
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={field.mappedColumn}
                    onChange={(e) =>
                      handleFieldChange(index, "mappedColumn", e.target.value)
                    }
                    className="w-full border rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={field.formFieldName || ""}
                    onChange={(e) =>
                      handleFieldChange(index, "formFieldName", e.target.value)
                    }
                    placeholder="Google Form field"
                    className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) =>
                      handleFieldChange(index, "required", e.target.checked)
                    }
                    className="rounded border-gray-300"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={field.isActive}
                    onChange={(e) =>
                      handleFieldChange(index, "isActive", e.target.checked)
                    }
                    className="rounded border-gray-300"
                  />
                </td>
                <td className="px-4 py-3">
                  {!["firstName", "lastName", "email"].includes(field.id) && (
                    <button
                      onClick={() => handleRemoveField(index)}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">
          Google Form Integration
        </h4>
        <p className="text-sm text-blue-700">
          To map fields from your Google Form, enter the exact field name from
          the form in the &quot;Form Field&quot; column. When form submissions
          are processed, the values will be mapped to the corresponding columns
          in the Clients sheet.
        </p>
      </div>

      {hasChanges && (
        <button
          onClick={handleSave}
          disabled={saveFields.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saveFields.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Field Configuration
            </>
          )}
        </button>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("sheets");

  const tabs = [
    { id: "sheets" as const, label: "Sheets Setup", icon: Database },
    { id: "general" as const, label: "General", icon: Settings },
    { id: "followups" as const, label: "Follow-ups", icon: Clock },
    { id: "intake-fields" as const, label: "Intake Fields", icon: FileText },
    { id: "evaluation" as const, label: "Evaluation", icon: ClipboardCheck },
  ];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">
          Configure your intake system settings and preferences
        </p>
      </div>

      <div className="bg-white rounded-xl shadow">
        {/* Tabs */}
        <div className="border-b">
          <nav className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === "general" && <GeneralSettings />}
          {activeTab === "sheets" && <SheetsSettings />}
          {activeTab === "followups" && <FollowUpSettings />}
          {activeTab === "intake-fields" && <IntakeFieldsSettings />}
          {activeTab === "evaluation" && <EvaluationConfig />}
        </div>
      </div>
    </div>
  );
}
