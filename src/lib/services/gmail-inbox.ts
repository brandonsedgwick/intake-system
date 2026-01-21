import { gmail_v1 } from "googleapis";
import { createGmailClient, getThread } from "./gmail";

/**
 * Result of scanning a Gmail thread for replies
 */
export interface ThreadScanResult {
  hasReply: boolean;
  replyCount: number;
  latestReplyFrom: string | null;
  latestReplyAt: Date | null;
  latestReplyPreview: string | null;
  latestReplyMessageId: string | null;
}

/**
 * Result of checking outreach attempts for replies
 */
export interface OutreachReplyCheckResult {
  attemptId: string;
  clientId: string;
  threadId: string;
  hasReply: boolean;
  replyDetails: ThreadScanResult | null;
  error?: string;
}

/**
 * Extract email address from a header value like "John Doe <john@example.com>"
 */
function extractEmail(headerValue: string): string {
  const match = headerValue.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase();
  return headerValue.toLowerCase().trim();
}

/**
 * Get a header value from a message
 */
function getHeader(
  message: gmail_v1.Schema$Message,
  headerName: string
): string | null {
  const headers = message.payload?.headers || [];
  const header = headers.find(
    (h) => h.name?.toLowerCase() === headerName.toLowerCase()
  );
  return header?.value || null;
}

/**
 * Extract preview text from a message
 */
function getMessagePreview(message: gmail_v1.Schema$Message): string {
  // Try snippet first
  if (message.snippet) {
    return message.snippet.substring(0, 200);
  }

  // Try to extract from body
  const body = message.payload?.body?.data;
  if (body) {
    try {
      const decoded = Buffer.from(body, "base64").toString("utf-8");
      return decoded.replace(/<[^>]*>/g, "").substring(0, 200);
    } catch {
      return "";
    }
  }

  return "";
}

/**
 * Scan a Gmail thread for replies after a specific message was sent
 *
 * @param accessToken - OAuth access token
 * @param threadId - Gmail thread ID to scan
 * @param afterMessageId - Only look for messages after this message ID
 * @param clientEmail - The client's email address to look for replies from
 * @returns ThreadScanResult with reply details
 */
export async function scanThreadForReplies(
  accessToken: string,
  threadId: string,
  afterMessageId: string,
  clientEmail: string
): Promise<ThreadScanResult> {
  const normalizedClientEmail = clientEmail.toLowerCase().trim();

  try {
    const thread = await getThread(accessToken, threadId);

    if (!thread || !thread.messages || thread.messages.length === 0) {
      return {
        hasReply: false,
        replyCount: 0,
        latestReplyFrom: null,
        latestReplyAt: null,
        latestReplyPreview: null,
        latestReplyMessageId: null,
      };
    }

    // Find the index of our sent message
    const sentMessageIndex = thread.messages.findIndex(
      (m) => m.id === afterMessageId
    );

    if (sentMessageIndex === -1) {
      // Message not found in thread - might have been deleted
      return {
        hasReply: false,
        replyCount: 0,
        latestReplyFrom: null,
        latestReplyAt: null,
        latestReplyPreview: null,
        latestReplyMessageId: null,
      };
    }

    // Look at messages after the sent message
    const messagesAfterSent = thread.messages.slice(sentMessageIndex + 1);

    // Filter for messages FROM the client
    const clientReplies = messagesAfterSent.filter((message) => {
      const from = getHeader(message, "From");
      if (!from) return false;

      const fromEmail = extractEmail(from);
      return fromEmail === normalizedClientEmail;
    });

    if (clientReplies.length === 0) {
      return {
        hasReply: false,
        replyCount: 0,
        latestReplyFrom: null,
        latestReplyAt: null,
        latestReplyPreview: null,
        latestReplyMessageId: null,
      };
    }

    // Get the latest reply
    const latestReply = clientReplies[clientReplies.length - 1];
    const fromHeader = getHeader(latestReply, "From");
    const internalDate = latestReply.internalDate
      ? new Date(parseInt(latestReply.internalDate, 10))
      : null;

    return {
      hasReply: true,
      replyCount: clientReplies.length,
      latestReplyFrom: fromHeader,
      latestReplyAt: internalDate,
      latestReplyPreview: getMessagePreview(latestReply),
      latestReplyMessageId: latestReply.id || null,
    };
  } catch (error) {
    console.error("Error scanning thread for replies:", error);
    return {
      hasReply: false,
      replyCount: 0,
      latestReplyFrom: null,
      latestReplyAt: null,
      latestReplyPreview: null,
      latestReplyMessageId: null,
    };
  }
}

/**
 * Check multiple outreach attempts for replies
 *
 * @param accessToken - OAuth access token
 * @param attempts - Array of attempt details to check
 * @returns Array of check results
 */
export async function checkOutreachAttemptsForReplies(
  accessToken: string,
  attempts: Array<{
    attemptId: string;
    clientId: string;
    clientEmail: string;
    gmailThreadId: string;
    gmailMessageId: string;
  }>
): Promise<OutreachReplyCheckResult[]> {
  const results: OutreachReplyCheckResult[] = [];

  for (const attempt of attempts) {
    try {
      const scanResult = await scanThreadForReplies(
        accessToken,
        attempt.gmailThreadId,
        attempt.gmailMessageId,
        attempt.clientEmail
      );

      results.push({
        attemptId: attempt.attemptId,
        clientId: attempt.clientId,
        threadId: attempt.gmailThreadId,
        hasReply: scanResult.hasReply,
        replyDetails: scanResult.hasReply ? scanResult : null,
      });
    } catch (error) {
      results.push({
        attemptId: attempt.attemptId,
        clientId: attempt.clientId,
        threadId: attempt.gmailThreadId,
        hasReply: false,
        replyDetails: null,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}

/**
 * Calculate the response window end time (24 hours after sent)
 */
export function calculateResponseWindowEnd(sentAt: Date): Date {
  return new Date(sentAt.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Check if we're still within the response window
 */
export function isWithinResponseWindow(responseWindowEnd: Date): boolean {
  return new Date() < responseWindowEnd;
}

/**
 * Determine the appropriate status based on outreach attempt state
 */
export function determineOutreachStatus(params: {
  responseDetected: boolean;
  sentAt: Date | null;
  responseWindowEnd: Date | null;
  attemptNumber: number;
  totalAttempts: number;
}): "awaiting_response" | "follow_up_due" | "no_contact_ok_close" | "in_communication" | null {
  const { responseDetected, sentAt, responseWindowEnd, attemptNumber, totalAttempts } = params;

  // If response was detected, client is in communication
  if (responseDetected) {
    return "in_communication";
  }

  // If not sent yet, no status to assign
  if (!sentAt) {
    return null;
  }

  const now = new Date();

  // If within response window, awaiting response
  if (responseWindowEnd && now < responseWindowEnd) {
    return "awaiting_response";
  }

  // Response window has passed, check if more attempts available
  if (attemptNumber < totalAttempts) {
    return "follow_up_due";
  }

  // Max attempts reached and window passed, ok to close
  return "no_contact_ok_close";
}
