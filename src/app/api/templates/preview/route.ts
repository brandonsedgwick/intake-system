import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { templatesDbApi } from "@/lib/api/prisma-db";
import {
  renderTemplate,
  buildSampleVariables,
  TemplateVariables,
} from "@/lib/services/email-template";
import { EmailTemplate } from "@/types/client";

// POST /api/templates/preview - Preview a template with variables
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { templateId, template, variables, useSampleData } = body;

    // Either get template by ID or use provided template data
    let templateToPreview: EmailTemplate | null = null;

    if (templateId) {
      templateToPreview = await templatesDbApi.getById(templateId);
      if (!templateToPreview) {
        return NextResponse.json(
          { error: "Template not found" },
          { status: 404 }
        );
      }
    } else if (template) {
      // Use provided template data for unsaved templates
      templateToPreview = {
        id: "preview",
        name: template.name || "Preview",
        type: template.type || "initial_outreach",
        subject: template.subject || "",
        body: template.body || "",
        bodyFormat: template.bodyFormat || "html",
        isActive: true,
        isDefault: false,
        order: 0,
        updatedAt: new Date().toISOString(),
      };
    } else {
      return NextResponse.json(
        { error: "Either templateId or template data is required" },
        { status: 400 }
      );
    }

    // Use sample data or provided variables
    const templateVariables: TemplateVariables = useSampleData
      ? buildSampleVariables()
      : variables || buildSampleVariables();

    // Render the template
    const { subject, body: renderedBody } = renderTemplate(
      templateToPreview,
      templateVariables
    );

    return NextResponse.json({
      subject,
      body: renderedBody,
      bodyFormat: templateToPreview.bodyFormat,
      variables: templateVariables,
    });
  } catch (error) {
    console.error("Error previewing template:", error);
    return NextResponse.json(
      { error: "Failed to preview template" },
      { status: 500 }
    );
  }
}
