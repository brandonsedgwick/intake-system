import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { intakeFieldsDbApi } from "@/lib/api/prisma-db";

export interface IntakeField {
  id: string;
  name: string;
  label: string;
  type: "text" | "email" | "phone" | "date" | "select" | "multiselect" | "textarea" | "checkbox";
  required: boolean;
  options?: string[]; // For select/multiselect
  mappedColumn: string; // Column in Clients sheet
  formFieldName?: string; // Field name in Google Form (for mapping)
  order: number;
  isActive: boolean;
}

// Default intake fields that map to the Clients sheet
const DEFAULT_INTAKE_FIELDS: IntakeField[] = [
  {
    id: "firstName",
    name: "firstName",
    label: "First Name",
    type: "text",
    required: true,
    mappedColumn: "firstName",
    order: 1,
    isActive: true,
  },
  {
    id: "lastName",
    name: "lastName",
    label: "Last Name",
    type: "text",
    required: true,
    mappedColumn: "lastName",
    order: 2,
    isActive: true,
  },
  {
    id: "email",
    name: "email",
    label: "Email Address",
    type: "email",
    required: true,
    mappedColumn: "email",
    order: 3,
    isActive: true,
  },
  {
    id: "phone",
    name: "phone",
    label: "Phone Number",
    type: "phone",
    required: false,
    mappedColumn: "phone",
    order: 4,
    isActive: true,
  },
  {
    id: "dateOfBirth",
    name: "dateOfBirth",
    label: "Date of Birth",
    type: "date",
    required: false,
    mappedColumn: "dateOfBirth",
    order: 5,
    isActive: true,
  },
  {
    id: "insuranceProvider",
    name: "insuranceProvider",
    label: "Insurance Provider",
    type: "text",
    required: false,
    mappedColumn: "insuranceProvider",
    order: 6,
    isActive: true,
  },
  {
    id: "insuranceMemberId",
    name: "insuranceMemberId",
    label: "Insurance Member ID",
    type: "text",
    required: false,
    mappedColumn: "insuranceMemberId",
    order: 7,
    isActive: true,
  },
  {
    id: "preferredTimes",
    name: "preferredTimes",
    label: "Preferred Appointment Times",
    type: "multiselect",
    required: false,
    options: ["Mornings", "Afternoons", "Evenings", "Weekends"],
    mappedColumn: "preferredTimes",
    order: 8,
    isActive: true,
  },
  {
    id: "presentingConcerns",
    name: "presentingConcerns",
    label: "What brings you to therapy?",
    type: "textarea",
    required: false,
    mappedColumn: "presentingConcerns",
    order: 9,
    isActive: true,
  },
];

// GET /api/settings/intake-fields - Get intake field configuration
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fields = await intakeFieldsDbApi.getAll();

    if (fields.length === 0) {
      // Return default fields if none configured
      return NextResponse.json(DEFAULT_INTAKE_FIELDS);
    }

    // Transform DB fields to IntakeField format
    const intakeFields: IntakeField[] = fields.map((f) => ({
      id: f.id,
      name: f.field,
      label: f.label,
      type: f.type as IntakeField["type"],
      required: f.isRequired,
      mappedColumn: f.field,
      formFieldName: f.googleFormField || undefined,
      order: f.order,
      isActive: f.isActive,
    }));

    return NextResponse.json(intakeFields);
  } catch (error) {
    console.error("Error fetching intake fields:", error);
    return NextResponse.json(
      { error: "Failed to fetch intake fields" },
      { status: 500 }
    );
  }
}

// POST /api/settings/intake-fields - Save intake field configuration
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const fields: IntakeField[] = await request.json();

    // Get existing fields to determine which to update vs create
    const existingFields = await intakeFieldsDbApi.getAll();
    const existingIds = new Set(existingFields.map((f) => f.id));

    for (const field of fields) {
      const dbField = {
        field: field.name,
        label: field.label,
        description: "",
        type: field.type,
        googleFormField: field.formFieldName || undefined,
        isRequired: field.required,
        isActive: field.isActive,
        order: field.order,
      };

      if (existingIds.has(field.id)) {
        await intakeFieldsDbApi.update(field.id, dbField);
      } else {
        await intakeFieldsDbApi.create(dbField);
      }
    }

    // Delete fields that are no longer in the list
    const newIds = new Set(fields.map((f) => f.id));
    for (const existing of existingFields) {
      if (!newIds.has(existing.id)) {
        await intakeFieldsDbApi.delete(existing.id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving intake fields:", error);
    return NextResponse.json(
      { error: "Failed to save intake fields" },
      { status: 500 }
    );
  }
}
