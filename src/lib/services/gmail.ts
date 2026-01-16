import { google, gmail_v1 } from "googleapis";

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  content: string; // Base64 encoded content
}

export interface SendEmailParams {
  to: string;
  from: string;
  subject: string;
  body: string;
  bodyFormat?: "html" | "plain";
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: EmailAttachment[];
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  threadId?: string;
  error?: string;
}

/**
 * Creates a Gmail API client with the provided access token
 */
export function createGmailClient(accessToken: string): gmail_v1.Gmail {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth });
}

/**
 * Creates a raw email string for the Gmail API
 * Supports both plain text and HTML emails, with optional attachments
 */
function createRawEmail(params: SendEmailParams): string {
  const { to, from, subject, body, bodyFormat = "plain", replyTo, cc, bcc, attachments } = params;

  const mixedBoundary = `----=_Mixed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const altBoundary = `----=_Alt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
  ];

  if (cc && cc.length > 0) {
    headers.push(`Cc: ${cc.join(", ")}`);
  }

  if (bcc && bcc.length > 0) {
    headers.push(`Bcc: ${bcc.join(", ")}`);
  }

  if (replyTo) {
    headers.push(`Reply-To: ${replyTo}`);
  }

  headers.push(`Subject: ${subject}`);
  headers.push("MIME-Version: 1.0");

  const hasAttachments = attachments && attachments.length > 0;

  if (hasAttachments) {
    // Multipart/mixed for attachments
    headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);

    const emailLines = [...headers, ""];

    // Body part
    emailLines.push(`--${mixedBoundary}`);

    if (bodyFormat === "html") {
      // HTML body with alternative part
      const plainTextBody = htmlToPlainText(body);
      emailLines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
      emailLines.push("");
      emailLines.push(`--${altBoundary}`);
      emailLines.push('Content-Type: text/plain; charset="UTF-8"');
      emailLines.push("Content-Transfer-Encoding: base64");
      emailLines.push("");
      emailLines.push(Buffer.from(plainTextBody).toString("base64"));
      emailLines.push("");
      emailLines.push(`--${altBoundary}`);
      emailLines.push('Content-Type: text/html; charset="UTF-8"');
      emailLines.push("Content-Transfer-Encoding: base64");
      emailLines.push("");
      emailLines.push(Buffer.from(body).toString("base64"));
      emailLines.push("");
      emailLines.push(`--${altBoundary}--`);
    } else {
      // Plain text body
      emailLines.push('Content-Type: text/plain; charset="UTF-8"');
      emailLines.push("Content-Transfer-Encoding: base64");
      emailLines.push("");
      emailLines.push(Buffer.from(body).toString("base64"));
    }

    // Attachments
    for (const attachment of attachments) {
      emailLines.push("");
      emailLines.push(`--${mixedBoundary}`);
      emailLines.push(`Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`);
      emailLines.push("Content-Transfer-Encoding: base64");
      emailLines.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
      emailLines.push("");
      emailLines.push(attachment.content);
    }

    emailLines.push("");
    emailLines.push(`--${mixedBoundary}--`);

    return base64UrlEncode(emailLines.join("\r\n"));
  } else if (bodyFormat === "html") {
    // HTML email without attachments
    const plainTextBody = htmlToPlainText(body);
    headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);

    const emailLines = [
      ...headers,
      "",
      `--${altBoundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(plainTextBody).toString("base64"),
      "",
      `--${altBoundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      Buffer.from(body).toString("base64"),
      "",
      `--${altBoundary}--`,
    ];

    return base64UrlEncode(emailLines.join("\r\n"));
  } else {
    // Plain text email without attachments
    headers.push('Content-Type: text/plain; charset="UTF-8"');

    const emailLines = [...headers, "", body];

    return base64UrlEncode(emailLines.join("\r\n"));
  }
}

/**
 * Converts HTML to plain text for multipart emails
 */
function htmlToPlainText(html: string): string {
  return html
    // Replace <br> and </p> with newlines
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    // Replace <hr> with a line
    .replace(/<hr[^>]*>/gi, "\n---\n")
    // Handle links - keep the text and URL
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, "$2 ($1)")
    // Handle strong/bold
    .replace(/<strong[^>]*>([^<]*)<\/strong>/gi, "*$1*")
    .replace(/<b[^>]*>([^<]*)<\/b>/gi, "*$1*")
    // Handle emphasis/italic
    .replace(/<em[^>]*>([^<]*)<\/em>/gi, "_$1_")
    .replace(/<i[^>]*>([^<]*)<\/i>/gi, "_$1_")
    // Handle list items
    .replace(/<li[^>]*>/gi, "• ")
    // Remove all other HTML tags
    .replace(/<[^>]*>/g, "")
    // Decode common HTML entities
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Clean up multiple newlines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Base64 URL-safe encoding for Gmail API
 */
function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Sends an email using the Gmail API
 */
export async function sendEmail(
  accessToken: string,
  params: SendEmailParams
): Promise<SendEmailResult> {
  try {
    const gmail = createGmailClient(accessToken);
    const rawEmail = createRawEmail(params);

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: rawEmail,
      },
    });

    return {
      success: true,
      messageId: response.data.id || undefined,
      threadId: response.data.threadId || undefined,
    };
  } catch (error) {
    console.error("Gmail API error:", error);

    let errorMessage = "Failed to send email";
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    // Check for specific Gmail API errors
    if (typeof error === "object" && error !== null) {
      const apiError = error as { code?: number; message?: string };
      if (apiError.code === 401) {
        errorMessage = "Gmail authentication failed. Please re-authenticate.";
      } else if (apiError.code === 403) {
        errorMessage = "Gmail access denied. Check your permissions.";
      } else if (apiError.code === 429) {
        errorMessage = "Gmail rate limit exceeded. Please try again later.";
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Gets the user's Gmail profile (for fetching their email address)
 */
export async function getGmailProfile(
  accessToken: string
): Promise<{ email: string; messagesTotal?: number } | null> {
  try {
    const gmail = createGmailClient(accessToken);
    const response = await gmail.users.getProfile({
      userId: "me",
    });

    return {
      email: response.data.emailAddress || "",
      messagesTotal: response.data.messagesTotal || undefined,
    };
  } catch (error) {
    console.error("Failed to get Gmail profile:", error);
    return null;
  }
}

/**
 * Creates a draft email (useful for review before sending)
 */
export async function createDraft(
  accessToken: string,
  params: SendEmailParams
): Promise<{ success: boolean; draftId?: string; error?: string }> {
  try {
    const gmail = createGmailClient(accessToken);
    const rawEmail = createRawEmail(params);

    const response = await gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: {
          raw: rawEmail,
        },
      },
    });

    return {
      success: true,
      draftId: response.data.id || undefined,
    };
  } catch (error) {
    console.error("Gmail API error creating draft:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create draft",
    };
  }
}

/**
 * Fetches a message by ID
 */
export async function getMessage(
  accessToken: string,
  messageId: string
): Promise<gmail_v1.Schema$Message | null> {
  try {
    const gmail = createGmailClient(accessToken);
    const response = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    return response.data;
  } catch (error) {
    console.error("Failed to get message:", error);
    return null;
  }
}

/**
 * Lists messages in a thread
 */
export async function getThread(
  accessToken: string,
  threadId: string
): Promise<gmail_v1.Schema$Thread | null> {
  try {
    const gmail = createGmailClient(accessToken);
    const response = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "full",
    });

    return response.data;
  } catch (error) {
    console.error("Failed to get thread:", error);
    return null;
  }
}
