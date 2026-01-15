"use client";

import { useState, useCallback } from "react";
import {
  useEvaluationCriteria,
  useCreateEvaluationCriteria,
  useUpdateEvaluationCriteria,
  useDeleteEvaluationCriteria,
  EVALUABLE_FIELDS,
} from "@/hooks/use-evaluation-criteria";
import {
  Client,
  EvaluationCriteria,
  EvaluableField,
  EvaluationOperator,
  EvaluationAction,
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
    </div>
  );
}
