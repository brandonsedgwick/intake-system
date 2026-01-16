import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { sendEmail, EmailAttachment } from "@/lib/services/gmail";
import { clientsDbApi, communicationsDbApi, auditLogDbApi } from "@/lib/api/prisma-db";
import { ClientStatus } from "@/types/client";

// POST /api/emails/send - Send an email via Gmail API
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken || !session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      clientId,
      to,
      from,
      cc,
      bcc,
      subject,
      body: emailBody,
      bodyFormat = "html",
      templateType,
      attachments,
    } = body;

    if (!clientId || !to || !subject || !emailBody) {
      return NextResponse.json(
        { error: "Missing required fields: clientId, to, subject, body" },
        { status: 400 }
      );
    }

    // Verify client exists
    const client = await clientsDbApi.getById(clientId);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Parse CC and BCC into arrays
    const ccArray = cc ? (Array.isArray(cc) ? cc : cc.split(",").map((e: string) => e.trim()).filter(Boolean)) : undefined;
    const bccArray = bcc ? (Array.isArray(bcc) ? bcc : bcc.split(",").map((e: string) => e.trim()).filter(Boolean)) : undefined;

    // Send email using Gmail service
    const result = await sendEmail(session.accessToken, {
      to,
      from: from || session.user?.email || "intake@practice.com",
      cc: ccArray,
      bcc: bccArray,
      subject,
      body: emailBody,
      bodyFormat: bodyFormat as "html" | "plain",
      attachments: attachments as EmailAttachment[] | undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to send email" },
        { status: 500 }
      );
    }

    const { messageId, threadId } = result;

    // Record the communication
    await communicationsDbApi.create({
      clientId,
      timestamp: new Date().toISOString(),
      direction: "out",
      type: "email",
      gmailMessageId: messageId || undefined,
      gmailThreadId: threadId || undefined,
      subject,
      bodyPreview: emailBody.replace(/<[^>]*>/g, "").substring(0, 200),
      fullBody: emailBody,
      sentBy: session.user?.email || undefined,
    });

    // Update client status based on template type
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
      case "referral":
        newStatus = "referred";
        updateFields.closedDate = new Date().toISOString();
        updateFields.closedReason = templateType;
        break;
    }

    if (newStatus) {
      await clientsDbApi.update(clientId, {
        status: newStatus,
        ...updateFields,
      });
    }

    // Log the action
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

    const errorMessage =
      error instanceof Error ? error.message : "Failed to send email";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
