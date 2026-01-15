import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { google } from "googleapis";
import { clientsApi } from "@/lib/api/google-sheets";
import { communicationsDbApi, auditLogDbApi } from "@/lib/api/prisma-db";
import { ClientStatus } from "@/types/client";

// Helper to create a raw email for Gmail API
function createRawEmail(
  to: string,
  from: string,
  subject: string,
  body: string
): string {
  const emailLines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    body,
  ];

  const email = emailLines.join("\r\n");

  // Base64 encode the email (URL-safe)
  return Buffer.from(email)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// POST /api/emails/send - Send an email via Gmail API
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { clientId, to, from, subject, body: emailBody, templateType } = body;

    if (!clientId || !to || !subject || !emailBody) {
      return NextResponse.json(
        { error: "Missing required fields: clientId, to, subject, body" },
        { status: 400 }
      );
    }

    // Verify client exists (still from Google Sheets)
    const client = await clientsApi.getById(session.accessToken, clientId);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Initialize Gmail API
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: session.accessToken });
    const gmail = google.gmail({ version: "v1", auth });

    // Create and send the email
    const rawEmail = createRawEmail(
      to,
      from || session.user?.email || "intake@practice.com",
      subject,
      emailBody
    );

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: rawEmail,
      },
    });

    const messageId = response.data.id;
    const threadId = response.data.threadId;

    // Record the communication in SQLite
    await communicationsDbApi.create({
      clientId,
      timestamp: new Date().toISOString(),
      direction: "out",
      type: "email",
      gmailMessageId: messageId || undefined,
      gmailThreadId: threadId || undefined,
      subject,
      bodyPreview: emailBody.substring(0, 200),
      fullBody: emailBody,
      sentBy: session.user?.email || undefined,
    });

    // Update client status based on template type (still in Google Sheets)
    let newStatus: ClientStatus | null = null;
    let updateFields: Record<string, string | null> = {};

    switch (templateType) {
      case "initial_outreach":
        newStatus = "outreach_sent";
        updateFields.initialOutreachDate = new Date().toISOString();
        break;
      case "follow_up_1":
        newStatus = "follow_up_1";
        updateFields.followUp1Date = new Date().toISOString();
        break;
      case "follow_up_2":
        newStatus = "follow_up_2";
        updateFields.followUp2Date = new Date().toISOString();
        break;
      case "referral_insurance":
      case "referral_specialty":
      case "referral_capacity":
        newStatus = "referred";
        updateFields.closedDate = new Date().toISOString();
        updateFields.closedReason = templateType;
        break;
    }

    if (newStatus) {
      await clientsApi.update(session.accessToken, clientId, {
        status: newStatus,
        ...updateFields,
      });
    }

    // Log the action to SQLite
    await auditLogDbApi.log({
      userId: session.user?.email || "unknown",
      userEmail: session.user?.email || "unknown",
      action: "send_email",
      entityType: "client",
      entityId: clientId,
      newValue: JSON.stringify({
        messageId,
        threadId,
        templateType,
        subject,
      }),
    });

    return NextResponse.json({
      success: true,
      messageId,
      threadId,
      newStatus,
    });
  } catch (error) {
    console.error("Error sending email:", error);

    // Check for specific Gmail API errors
    const errorMessage =
      error instanceof Error ? error.message : "Failed to send email";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
