"use client";

import { useState, useCallback, useEffect } from "react";
import {
  useEvaluationCriteria,
  useCreateEvaluationCriteria,
  useUpdateEvaluationCriteria,
  useDeleteEvaluationCriteria,
  EVALUABLE_FIELDS,
} from "@/hooks/use-evaluation-criteria";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import {
  useTextEvaluationRules,
  useCreateTextEvaluationRule,
  useUpdateTextEvaluationRule,
  useDeleteTextEvaluationRule,
} from "@/hooks/use-text-evaluation-rules";
import {
  Client,
  EvaluationCriteria,
  EvaluableField,
  EvaluationOperator,
  EvaluationAction,
  TextEvaluationSeverity,
  TextEvaluationCategory,
  TextEvaluationRule,
} from "@/types/client";
import {
  GripVertical,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Flag,
  Search,
  Loader2,
  Save,
  X,
  Brain,
  Settings2,
  Info,
  CheckCircle,
  XCircle,
  Pencil,
  FileText,
  Zap,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";

interface DragItem {
  field: EvaluableField;
  index: number;
}

const OPERATORS: { value: EvaluationOperator; label: string; description: string }[] = [
  { value: "contains", label: "Contains", description: "Field contains the text" },
  { value: "not_contains", label: "Does not contain", description: "Field does not contain the text" },
  { value: "contains_any", label: "Contains any keyword", description: "Field contains any of the keywords (comma-separated)" },
  { value: "contains_all", label: "Contains all keywords", description: "Field contains all keywords (comma-separated)" },
  { value: "equals", label: "Equals", description: "Field exactly matches the value" },
  { value: "not_equals", label: "Does not equal", description: "Field does not match the value" },
  { value: "exists", label: "Has value", description: "Field is not empty" },
  { value: "not_exists", label: "Is empty", description: "Field is empty" },
  { value: "regex", label: "Matches pattern", description: "Field matches regex pattern" },
];

const ACTIONS: { value: EvaluationAction; label: string; color: string; icon: typeof Flag }[] = [
  { value: "flag", label: "Flag for Review", color: "bg-yellow-100 text-yellow-700", icon: Flag },
  { value: "flag_urgent", label: "Flag as Urgent", color: "bg-red-100 text-red-700", icon: AlertTriangle },
  { value: "flag_review", label: "Needs Manual Review", color: "bg-blue-100 text-blue-700", icon: Search },
];

function CriteriaEditor({
  criteria,
  onUpdate,
  onDelete,
  isNew,
  onCancel,
}: {
  criteria: Partial<EvaluationCriteria>;
  onUpdate: (updates: Partial<EvaluationCriteria>) => void;
  onDelete?: () => void;
  isNew?: boolean;
  onCancel?: () => void;
}) {
  const [expanded, setExpanded] = useState(isNew);
  const field = EVALUABLE_FIELDS.find((f) => f.field === criteria.field);
  const operator = OPERATORS.find((o) => o.value === criteria.operator);
  const action = ACTIONS.find((a) => a.value === criteria.action);

  const needsValue = !["exists", "not_exists"].includes(criteria.operator || "");

  return (
    <div className="border rounded-lg bg-white">
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
        onClick={() => setExpanded(!expanded)}
      >
        <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 truncate">
              {criteria.name || "New Criteria"}
            </span>
            {action && (
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${action.color}`}>
                {action.label}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 truncate">
            {field?.label || "Select field"} {operator?.label.toLowerCase() || "..."}{" "}
            {needsValue && criteria.value ? `"${criteria.value}"` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={criteria.isActive ?? true}
              onChange={(e) => onUpdate({ isActive: e.target.checked })}
              className="rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm text-gray-600">Active</span>
          </label>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Criteria Name
              </label>
              <input
                type="text"
                value={criteria.name || ""}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder="e.g., Suicide Risk Flag"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field to Evaluate
              </label>
              <select
                value={criteria.field || ""}
                onChange={(e) => onUpdate({ field: e.target.value as keyof Client })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a field...</option>
                {EVALUABLE_FIELDS.map((f) => (
                  <option key={f.field} value={f.field}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={criteria.description || ""}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Explain what this criteria checks for"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Condition
              </label>
              <select
                value={criteria.operator || ""}
                onChange={(e) => onUpdate({ operator: e.target.value as EvaluationOperator })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select condition...</option>
                {OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
              {operator && (
                <p className="text-xs text-gray-500 mt-1">{operator.description}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Action When Matched
              </label>
              <select
                value={criteria.action || ""}
                onChange={(e) => onUpdate({ action: e.target.value as EvaluationAction })}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select action...</option>
                {ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {needsValue && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Value / Keywords
                {(criteria.operator === "contains_any" || criteria.operator === "contains_all") && (
                  <span className="font-normal text-gray-500"> (comma-separated)</span>
                )}
              </label>
              <textarea
                value={criteria.value || ""}
                onChange={(e) => onUpdate({ value: e.target.value })}
                placeholder={
                  criteria.operator === "contains_any" || criteria.operator === "contains_all"
                    ? "suicide, self-harm, crisis, emergency"
                    : "Enter the value to match"
                }
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex gap-2">
              {isNew && onCancel && (
                <button
                  onClick={onCancel}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              )}
            </div>
            {onDelete && (
              <button
                onClick={onDelete}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AvailableFieldsList({
  onAddField,
  usedFields,
}: {
  onAddField: (field: EvaluableField) => void;
  usedFields: Set<string>;
}) {
  return (
    <div className="border rounded-lg bg-gray-50 p-4">
      <h3 className="font-medium text-gray-900 mb-3">Available Fields</h3>
      <p className="text-sm text-gray-600 mb-4">
        Click a field to add evaluation criteria for it.
      </p>
      <div className="space-y-2">
        {EVALUABLE_FIELDS.map((field) => {
          const isUsed = usedFields.has(field.field);
          return (
            <button
              key={field.field}
              onClick={() => onAddField(field)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                isUsed
                  ? "bg-white border-blue-200 hover:border-blue-300"
                  : "bg-white border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-900">{field.label}</span>
                  <p className="text-xs text-gray-500">{field.description}</p>
                </div>
                {isUsed && (
                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    In use
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// LLM Threshold options
const LLM_THRESHOLD_OPTIONS: { value: TextEvaluationSeverity; label: string; description: string }[] = [
  { value: "none", label: "Always", description: "Always use LLM analysis for all text" },
  { value: "low", label: "Low threshold", description: "Use LLM when pattern match severity is low or none" },
  { value: "medium", label: "Medium threshold (Recommended)", description: "Use LLM when patterns are uncertain or ambiguous" },
  { value: "high", label: "High threshold", description: "Only use LLM when pattern matches are high severity" },
  { value: "urgent", label: "Urgent only", description: "Only use LLM for urgent pattern matches" },
];

function TextAnalysisSettings() {
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const [formData, setFormData] = useState({
    textEvaluationLLMEnabled: false,
    textEvaluationLLMThreshold: "medium" as TextEvaluationSeverity,
    googleCloudProject: "",
    vertexAILocation: "us-central1",
  });
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form data when settings load
  useEffect(() => {
    if (settings) {
      setFormData({
        textEvaluationLLMEnabled: settings.textEvaluationLLMEnabled === "true",
        textEvaluationLLMThreshold: (settings.textEvaluationLLMThreshold as TextEvaluationSeverity) || "medium",
        googleCloudProject: settings.googleCloudProject || "",
        vertexAILocation: settings.vertexAILocation || "us-central1",
      });
    }
  }, [settings]);

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    await updateSettings.mutateAsync({
      textEvaluationLLMEnabled: formData.textEvaluationLLMEnabled ? "true" : "false",
      textEvaluationLLMThreshold: formData.textEvaluationLLMThreshold,
      googleCloudProject: formData.googleCloudProject,
      vertexAILocation: formData.vertexAILocation,
    });
    setHasChanges(false);
  };

  if (settingsLoading) {
    return (
      <div className="p-6 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
      </div>
    );
  }

  const isLLMConfigured = formData.googleCloudProject.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Brain className="w-6 h-6 text-purple-600 mt-0.5" />
        <div>
          <h3 className="text-lg font-medium text-gray-900">AI Text Analysis (LLM)</h3>
          <p className="text-sm text-gray-600">
            Use Google Vertex AI Gemini for contextual analysis of free-text responses.
            This provides deeper understanding beyond keyword matching.
          </p>
        </div>
      </div>

      {/* Enable Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-3">
          {formData.textEvaluationLLMEnabled ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <XCircle className="w-5 h-5 text-gray-400" />
          )}
          <div>
            <span className="font-medium text-gray-900">Enable LLM Analysis</span>
            <p className="text-sm text-gray-500">
              {formData.textEvaluationLLMEnabled
                ? "AI will analyze text when pattern matching is uncertain"
                : "Only pattern matching will be used"}
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={formData.textEvaluationLLMEnabled}
            onChange={(e) => handleChange("textEvaluationLLMEnabled", e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      </div>

      {/* Google Cloud Configuration */}
      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-gray-600" />
          <h4 className="font-medium text-gray-900">Google Cloud Configuration</h4>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Google Cloud Project ID
            </label>
            <input
              type="text"
              value={formData.googleCloudProject}
              onChange={(e) => handleChange("googleCloudProject", e.target.value)}
              placeholder="your-project-id"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              The Google Cloud project with Vertex AI enabled
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vertex AI Location
            </label>
            <select
              value={formData.vertexAILocation}
              onChange={(e) => handleChange("vertexAILocation", e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="us-central1">us-central1 (Iowa)</option>
              <option value="us-east1">us-east1 (South Carolina)</option>
              <option value="us-west1">us-west1 (Oregon)</option>
              <option value="us-west4">us-west4 (Las Vegas)</option>
              <option value="europe-west1">europe-west1 (Belgium)</option>
              <option value="europe-west4">europe-west4 (Netherlands)</option>
              <option value="asia-northeast1">asia-northeast1 (Tokyo)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Region where Vertex AI requests are processed
            </p>
          </div>
        </div>

        {!isLLMConfigured && formData.textEvaluationLLMEnabled && (
          <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg text-yellow-800">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Configuration required</p>
              <p>Enter your Google Cloud Project ID to enable LLM analysis.</p>
            </div>
          </div>
        )}
      </div>

      {/* LLM Threshold Setting */}
      <div className="border rounded-lg p-4 space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          When to Use LLM Analysis
        </label>
        <div className="space-y-2">
          {LLM_THRESHOLD_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                formData.textEvaluationLLMThreshold === option.value
                  ? "border-blue-300 bg-blue-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="llmThreshold"
                value={option.value}
                checked={formData.textEvaluationLLMThreshold === option.value}
                onChange={(e) => handleChange("textEvaluationLLMThreshold", e.target.value)}
                className="mt-0.5"
              />
              <div>
                <span className="font-medium text-gray-900">{option.label}</span>
                <p className="text-sm text-gray-500">{option.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Info Box */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">About Authentication</p>
          <p>
            Vertex AI uses Google Cloud Application Default Credentials (ADC).
            Since you&apos;re already using Google Sheets with a service account,
            the same credentials will be used for Vertex AI. No separate API key is needed.
          </p>
          <p className="mt-2">
            <strong>Requirements:</strong>
          </p>
          <ul className="list-disc list-inside mt-1 space-y-0.5">
            <li>Vertex AI API must be enabled in your Google Cloud project</li>
            <li>Your service account needs the &quot;Vertex AI User&quot; role</li>
            <li>HIPAA BAA must cover Vertex AI (you mentioned this is already in place)</li>
          </ul>
        </div>
      </div>

      {/* Save Button */}
      {hasChanges && (
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
              Save LLM Settings
            </>
          )}
        </button>
      )}
    </div>
  );
}

// Category options for text evaluation rules
const TEXT_EVAL_CATEGORIES: { value: TextEvaluationCategory; label: string; description: string }[] = [
  { value: "suicidal_ideation", label: "Suicidal Ideation", description: "Thoughts about suicide or self-termination" },
  { value: "self_harm", label: "Self-Harm", description: "Non-suicidal self-injury" },
  { value: "substance_use", label: "Substance Use", description: "Alcohol or drug use concerns" },
  { value: "psychosis", label: "Psychosis", description: "Hallucinations, delusions, or breaks from reality" },
  { value: "eating_disorder", label: "Eating Disorder", description: "Disordered eating behaviors" },
  { value: "hospitalization", label: "Hospitalization", description: "Recent or past psychiatric hospitalization" },
  { value: "violence", label: "Violence/Safety", description: "Risk of harm to others" },
  { value: "abuse", label: "Abuse/Trauma", description: "Current or historical abuse" },
  { value: "custom", label: "Custom", description: "Other clinical concern" },
];

// Severity options for text evaluation rules
const TEXT_EVAL_SEVERITIES: { value: TextEvaluationSeverity; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "bg-blue-100 text-blue-700" },
  { value: "medium", label: "Medium", color: "bg-yellow-100 text-yellow-700" },
  { value: "high", label: "High", color: "bg-orange-100 text-orange-700" },
  { value: "urgent", label: "Urgent", color: "bg-red-100 text-red-700" },
];

interface RuleFormData {
  name: string;
  category: TextEvaluationCategory;
  severity: TextEvaluationSeverity;
  patterns: string;
  isRegex: boolean;
  negationWords: string;
  negationWindow: number;
  requiresLLM: boolean;
  isActive: boolean;
}

const DEFAULT_RULE_FORM: RuleFormData = {
  name: "",
  category: "custom",
  severity: "medium",
  patterns: "",
  isRegex: false,
  negationWords: "never, not, don't, no, haven't, wouldn't, didn't, wasn't",
  negationWindow: 5,
  requiresLLM: false,
  isActive: true,
};

function TextEvaluationRuleEditor({
  rule,
  onSave,
  onCancel,
  isSaving,
}: {
  rule: TextEvaluationRule | null;
  onSave: (data: RuleFormData) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState<RuleFormData>(() => {
    if (rule) {
      return {
        name: rule.name,
        category: rule.category,
        severity: rule.severity,
        patterns: rule.patterns.join(", "),
        isRegex: rule.isRegex,
        negationWords: rule.negationWords.join(", "),
        negationWindow: rule.negationWindow,
        requiresLLM: rule.requiresLLM,
        isActive: rule.isActive,
      };
    }
    return DEFAULT_RULE_FORM;
  });

  const handleChange = (field: keyof RuleFormData, value: string | boolean | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const selectedCategory = TEXT_EVAL_CATEGORIES.find((c) => c.value === formData.category);
  const selectedSeverity = TEXT_EVAL_SEVERITIES.find((s) => s.value === formData.severity);

  return (
    <div className="border-2 border-blue-200 rounded-lg bg-white">
      <div className="p-4 border-b border-blue-100 bg-blue-50">
        <h4 className="font-medium text-blue-900">
          {rule ? "Edit Pattern Rule" : "Create New Pattern Rule"}
        </h4>
      </div>

      <div className="p-4 space-y-4">
        {/* Name and Category */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rule Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="e.g., Active Suicidal Ideation"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => handleChange("category", e.target.value as TextEvaluationCategory)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TEXT_EVAL_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            {selectedCategory && (
              <p className="text-xs text-gray-500 mt-1">{selectedCategory.description}</p>
            )}
          </div>
        </div>

        {/* Patterns */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Keywords / Patterns
            <span className="font-normal text-gray-500"> (comma-separated)</span>
          </label>
          <textarea
            value={formData.patterns}
            onChange={(e) => handleChange("patterns", e.target.value)}
            placeholder="want to die, going to kill myself, planning to end it"
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
          />
          <p className="text-xs text-gray-500 mt-1">
            Enter phrases or keywords that should trigger this flag. Each pattern is matched case-insensitively.
          </p>
        </div>

        {/* Severity and Regex toggle */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Severity Level
            </label>
            <select
              value={formData.severity}
              onChange={(e) => handleChange("severity", e.target.value as TextEvaluationSeverity)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {TEXT_EVAL_SEVERITIES.map((sev) => (
                <option key={sev.value} value={sev.value}>
                  {sev.label}
                </option>
              ))}
            </select>
            {selectedSeverity && (
              <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${selectedSeverity.color}`}>
                {selectedSeverity.label} Severity
              </span>
            )}
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isRegex}
                onChange={(e) => handleChange("isRegex", e.target.checked)}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">Use Regular Expressions</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.requiresLLM}
                onChange={(e) => handleChange("requiresLLM", e.target.checked)}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">Always require LLM review</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => handleChange("isActive", e.target.checked)}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-sm text-gray-700">Rule is active</span>
            </label>
          </div>
        </div>

        {/* Negation Words */}
        <div className="border-t pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-gray-400" />
            <label className="text-sm font-medium text-gray-700">
              Negation Settings
            </label>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">
                Negation words (comma-separated)
              </label>
              <input
                type="text"
                value={formData.negationWords}
                onChange={(e) => handleChange("negationWords", e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Window (words before)
              </label>
              <input
                type="number"
                value={formData.negationWindow}
                onChange={(e) => handleChange("negationWindow", parseInt(e.target.value) || 5)}
                min={1}
                max={20}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            If a negation word appears within the window before a pattern match, the match is ignored.
            Example: &quot;I have never attempted suicide&quot; would not flag if &quot;never&quot; is a negation word.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between p-4 bg-gray-50 border-t">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
        <button
          onClick={() => onSave(formData)}
          disabled={isSaving || !formData.name.trim() || !formData.patterns.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {rule ? "Update Rule" : "Create Rule"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function TextEvaluationRulesConfig() {
  const { data: rules, isLoading, error } = useTextEvaluationRules();
  const createRule = useCreateTextEvaluationRule();
  const updateRule = useUpdateTextEvaluationRule();
  const deleteRule = useDeleteTextEvaluationRule();

  const [editingRule, setEditingRule] = useState<TextEvaluationRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Group rules by category
  const rulesByCategory = (rules || []).reduce((acc, rule) => {
    if (!acc[rule.category]) {
      acc[rule.category] = [];
    }
    acc[rule.category].push(rule);
    return acc;
  }, {} as Record<string, TextEvaluationRule[]>);

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleSave = async (data: RuleFormData) => {
    const ruleData = {
      name: data.name.trim(),
      category: data.category,
      severity: data.severity,
      patterns: data.patterns.split(",").map((p) => p.trim()).filter(Boolean),
      isRegex: data.isRegex,
      negationWords: data.negationWords.split(",").map((w) => w.trim()).filter(Boolean),
      negationWindow: data.negationWindow,
      requiresLLM: data.requiresLLM,
      isActive: data.isActive,
    };

    if (editingRule) {
      await updateRule.mutateAsync({ id: editingRule.id, updates: ruleData });
      setEditingRule(null);
    } else {
      await createRule.mutateAsync(ruleData);
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this pattern rule?")) {
      return;
    }
    await deleteRule.mutateAsync(id);
  };

  const handleToggleActive = async (rule: TextEvaluationRule) => {
    await updateRule.mutateAsync({
      id: rule.id,
      updates: { isActive: !rule.isActive },
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
        <p className="mt-2 text-sm text-gray-500">Loading pattern rules...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="w-8 h-8 mx-auto text-red-500 mb-2" />
        <p className="text-red-600">{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <FileText className="w-6 h-6 text-green-600 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-lg font-medium text-gray-900">Pattern Rules (Keywords)</h3>
          <p className="text-sm text-gray-600">
            Define keywords and phrases to detect in free-text fields like &quot;Presenting Concerns&quot; and &quot;Additional Info&quot;.
            These patterns are matched before LLM analysis and can trigger flags automatically.
          </p>
        </div>
        {!isCreating && !editingRule && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            Add Rule
          </button>
        )}
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingRule) && (
        <TextEvaluationRuleEditor
          rule={editingRule}
          onSave={handleSave}
          onCancel={() => {
            setIsCreating(false);
            setEditingRule(null);
          }}
          isSaving={createRule.isPending || updateRule.isPending}
        />
      )}

      {/* Rules List by Category */}
      {!isCreating && !editingRule && (
        <>
          {Object.keys(rulesByCategory).length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
              <FileText className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-gray-600">No pattern rules configured yet.</p>
              <p className="text-sm text-gray-500 mt-1">
                Click &quot;Add Rule&quot; to create your first keyword pattern for text evaluation.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {TEXT_EVAL_CATEGORIES.filter((cat) => rulesByCategory[cat.value]?.length > 0).map((category) => {
                const categoryRules = rulesByCategory[category.value] || [];
                const isExpanded = expandedCategories.has(category.value);
                const activeCount = categoryRules.filter((r) => r.isActive).length;

                return (
                  <div key={category.value} className="border rounded-lg bg-white">
                    <button
                      onClick={() => toggleCategory(category.value)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-gray-900">{category.label}</span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {categoryRules.length} rule{categoryRules.length !== 1 ? "s" : ""}
                          {activeCount < categoryRules.length && ` (${activeCount} active)`}
                        </span>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t divide-y">
                        {categoryRules.map((rule) => {
                          const severityInfo = TEXT_EVAL_SEVERITIES.find((s) => s.value === rule.severity);
                          return (
                            <div
                              key={rule.id}
                              className={`p-4 ${!rule.isActive ? "bg-gray-50 opacity-75" : ""}`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-gray-900">{rule.name}</span>
                                    {severityInfo && (
                                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${severityInfo.color}`}>
                                        {severityInfo.label}
                                      </span>
                                    )}
                                    {rule.requiresLLM && (
                                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 flex items-center gap-1">
                                        <Brain className="w-3 h-3" />
                                        LLM
                                      </span>
                                    )}
                                    {!rule.isActive && (
                                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">
                                        Inactive
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-600 font-mono bg-gray-100 rounded px-2 py-1 inline-block">
                                    {rule.patterns.slice(0, 5).join(", ")}
                                    {rule.patterns.length > 5 && ` +${rule.patterns.length - 5} more`}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleToggleActive(rule)}
                                    className="p-1.5 rounded hover:bg-gray-100"
                                    title={rule.isActive ? "Deactivate" : "Activate"}
                                  >
                                    {rule.isActive ? (
                                      <ToggleRight className="w-5 h-5 text-green-600" />
                                    ) : (
                                      <ToggleLeft className="w-5 h-5 text-gray-400" />
                                    )}
                                  </button>
                                  <button
                                    onClick={() => setEditingRule(rule)}
                                    className="p-1.5 rounded hover:bg-gray-100"
                                    title="Edit rule"
                                  >
                                    <Pencil className="w-4 h-4 text-gray-600" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(rule.id)}
                                    className="p-1.5 rounded hover:bg-red-50"
                                    title="Delete rule"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Info box about how pattern matching works */}
      <div className="bg-green-50 rounded-lg p-4">
        <h4 className="font-medium text-green-900 mb-2">How Pattern Matching Works</h4>
        <ul className="text-sm text-green-800 space-y-1">
          <li>
            &bull; Patterns are matched case-insensitively against text in &quot;Presenting Concerns&quot; and &quot;Additional Info&quot; fields.
          </li>
          <li>
            &bull; If a negation word (like &quot;never&quot; or &quot;not&quot;) appears within the negation window before a match, the match is ignored.
          </li>
          <li>
            &bull; Higher severity patterns take precedence when multiple patterns match.
          </li>
          <li>
            &bull; Rules marked &quot;Requires LLM&quot; will always trigger AI analysis for additional context.
          </li>
        </ul>
      </div>
    </div>
  );
}

export function EvaluationConfig() {
  const { data: criteria, isLoading, error } = useEvaluationCriteria();
  const createCriteria = useCreateEvaluationCriteria();
  const updateCriteria = useUpdateEvaluationCriteria();
  const deleteCriteria = useDeleteEvaluationCriteria();

  const [newCriteria, setNewCriteria] = useState<Partial<EvaluationCriteria> | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, Partial<EvaluationCriteria>>>(
    new Map()
  );

  const usedFields = new Set(criteria?.map((c) => c.field) || []);

  const handleAddField = (field: EvaluableField) => {
    setNewCriteria({
      name: `${field.label} Check`,
      field: field.field,
      operator: "contains",
      action: "flag",
      value: "",
      priority: (criteria?.length || 0) + 1,
      isActive: true,
    });
  };

  const handleCreateCriteria = async () => {
    if (!newCriteria?.name || !newCriteria?.field || !newCriteria?.operator || !newCriteria?.action) {
      return;
    }

    try {
      await createCriteria.mutateAsync(newCriteria as Omit<EvaluationCriteria, "id" | "createdAt" | "updatedAt">);
      setNewCriteria(null);
    } catch (error) {
      console.error("Failed to create criteria:", error);
    }
  };

  const handleUpdateCriteria = (id: string, updates: Partial<EvaluationCriteria>) => {
    setPendingUpdates((prev) => {
      const next = new Map(prev);
      const existing = next.get(id) || {};
      next.set(id, { ...existing, ...updates });
      return next;
    });

    // Debounced save
    updateCriteria.mutate({ id, ...updates });
  };

  const handleDeleteCriteria = async (id: string) => {
    if (!confirm("Are you sure you want to delete this evaluation criteria?")) {
      return;
    }

    try {
      await deleteCriteria.mutateAsync(id);
    } catch (error) {
      console.error("Failed to delete criteria:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />
        <p className="mt-2 text-sm text-gray-500">Loading evaluation criteria...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <AlertTriangle className="w-8 h-8 mx-auto text-red-500 mb-2" />
        <p className="text-red-600">{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Evaluation Criteria</h3>
          <p className="text-sm text-gray-600">
            Configure rules for automatically flagging intake submissions that need special attention.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Available Fields */}
        <div className="col-span-1">
          <AvailableFieldsList onAddField={handleAddField} usedFields={usedFields} />
        </div>

        {/* Configured Criteria */}
        <div className="col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">Configured Criteria</h3>
            <span className="text-sm text-gray-500">
              {criteria?.filter((c) => c.isActive).length || 0} active
            </span>
          </div>

          {/* New Criteria Form */}
          {newCriteria && (
            <div className="border-2 border-blue-200 border-dashed rounded-lg">
              <CriteriaEditor
                criteria={newCriteria}
                onUpdate={(updates) => setNewCriteria({ ...newCriteria, ...updates })}
                isNew
                onCancel={() => setNewCriteria(null)}
              />
              <div className="p-3 bg-blue-50 border-t border-blue-200">
                <button
                  onClick={handleCreateCriteria}
                  disabled={createCriteria.isPending || !newCriteria.name || !newCriteria.field}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {createCriteria.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Criteria
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Existing Criteria */}
          {!criteria || criteria.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
              <Flag className="w-8 h-8 mx-auto text-gray-400 mb-2" />
              <p className="text-gray-600">No evaluation criteria configured yet.</p>
              <p className="text-sm text-gray-500 mt-1">
                Click a field on the left to create your first criteria.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {criteria.map((c) => (
                <CriteriaEditor
                  key={c.id}
                  criteria={{ ...c, ...pendingUpdates.get(c.id) }}
                  onUpdate={(updates) => handleUpdateCriteria(c.id, updates)}
                  onDelete={() => handleDeleteCriteria(c.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">How Evaluation Works</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>
            &bull; When you click &quot;Evaluate Inquiries&quot; on the dashboard, each selected client is checked against these criteria.
          </li>
          <li>
            &bull; Criteria are evaluated in priority order (top to bottom).
          </li>
          <li>
            &bull; If a criteria matches, the client is flagged with the corresponding action.
          </li>
          <li>
            &bull; Use <strong>Keywords</strong> to check for specific words like &quot;suicide&quot;, &quot;crisis&quot;, or &quot;emergency&quot;.
          </li>
        </ul>
      </div>

      {/* Divider */}
      <div className="border-t my-8"></div>

      {/* Text Evaluation Pattern Rules */}
      <TextEvaluationRulesConfig />

      {/* Divider */}
      <div className="border-t my-8"></div>

      {/* Text Analysis Settings (LLM Configuration) */}
      <TextAnalysisSettings />
    </div>
  );
}
