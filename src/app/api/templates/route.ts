import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { templatesApi, auditLogApi } from "@/lib/api/google-sheets";
import { google } from "googleapis";
import { EmailTemplate } from "@/types/client";

// GET /api/templates - Get all email templates
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const templates = await templatesApi.getAll(session.accessToken);
    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// POST /api/templates - Create a new email template
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, type, subject, body: templateBody, isActive } = body;

    if (!name || !type || !subject || !templateBody) {
      return NextResponse.json(
        { error: "Missing required fields: name, type, subject, body" },
        { status: 400 }
      );
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

    const newTemplate: EmailTemplate = {
      id: crypto.randomUUID(),
      name,
      type,
      subject,
      body: templateBody,
      isActive: isActive !== false,
      updatedAt: new Date().toISOString(),
      updatedBy: session.user?.email || undefined,
    };

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "EmailTemplates!A:H",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            newTemplate.id,
            newTemplate.name,
            newTemplate.type,
            newTemplate.subject,
            newTemplate.body,
            newTemplate.isActive ? "true" : "false",
            newTemplate.updatedAt,
            newTemplate.updatedBy,
          ],
        ],
      },
    });

    // Log the action
    await auditLogApi.log(session.accessToken, {
      userId: session.user?.email || "unknown",
      userEmail: session.user?.email || "unknown",
      action: "create",
      entityType: "template",
      entityId: newTemplate.id,
      newValue: JSON.stringify(newTemplate),
    });

    return NextResponse.json(newTemplate, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
