import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { clientsDbApi, cliniciansDbApi, templatesDbApi, settingsDbApi } from "@/lib/api/prisma-db";
import {
  buildTemplateVariables,
  generateEmailPreview,
} from "@/lib/services/email-template";
import { EmailTemplate } from "@/types/client";

// POST /api/emails/preview - Generate an email preview for a client
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { clientId, templateType, clinicianId, availabilitySlots } = body;

    if (!clientId || !templateType) {
      return NextResponse.json(
        { error: "Missing required fields: clientId, templateType" },
        { status: 400 }
      );
    }

    // Fetch client
    const client = await clientsDbApi.getById(clientId);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Fetch template
    const template = await templatesDbApi.getByType(
      templateType as EmailTemplate["type"]
    );
    if (!template) {
      return NextResponse.json(
        { error: `No active template found for type: ${templateType}` },
        { status: 404 }
      );
    }

    // Fetch clinician if provided
    let clinician = null;
    if (clinicianId) {
      clinician = await cliniciansDbApi.getById(clinicianId);
    }

    // Fetch settings
    const allSettings = await settingsDbApi.getAll();
    const settings = {
      practiceName: allSettings.practiceName || "Therapy Practice",
      practiceEmail: allSettings.practiceEmail || session.user?.email || "intake@practice.com",
    };

    // Build template variables
    const variables = buildTemplateVariables(
      client,
      clinician || undefined,
      settings,
      availabilitySlots
    );

    // Generate preview
    const preview = generateEmailPreview(
      template,
      variables,
      settings.practiceEmail
    );

    return NextResponse.json(preview);
  } catch (error) {
    console.error("Error generating email preview:", error);
    return NextResponse.json(
      { error: "Failed to generate email preview" },
      { status: 500 }
    );
  }
}
