import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import {
  clientsDbApi,
  communicationsDbApi,
  outreachAttemptsDbApi,
  settingsDbApi,
} from "@/lib/api/prisma-db";
import {
  scanThreadForReplies,
  calculateResponseWindowEnd,
  isWithinResponseWindow,
  determineOutreachStatus,
} from "@/lib/services/gmail-inbox";
import { ClientStatus } from "@/types/client";

interface CheckReplyResult {
  clientId: string;
  clientName: string;
  attemptId: string;
  attemptNumber: number;
  previousStatus: ClientStatus;
  newStatus: ClientStatus | null;
  hasReply: boolean;
  replyPreview?: string;
  error?: string;
}

/**
 * POST /api/outreach/check-replies
 * Check all clients in awaiting_response status for Gmail replies
 *
 * GET /api/outreach/check-replies?clientId=xxx
 * Check a single client for replies
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId");

    if (!clientId) {
      return NextResponse.json(
        { error: "clientId query parameter is required" },
        { status: 400 }
      );
    }

    // Get the client
    const client = await clientsDbApi.getById(clientId);
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get outreach attempts for this client
    const attempts = await outreachAttemptsDbApi.getByClientId(clientId);
    const settings = await settingsDbApi.getAll();
    const totalAttempts = parseInt(settings.outreachAttemptCount || "3", 10);

    const results: CheckReplyResult[] = [];

    // Get all sent attempts that have thread IDs for reply checking
    const sentAttempts = attempts
      .filter(
        (a) =>
          a.status === "sent" &&
          a.gmailThreadId &&
          a.gmailMessageId &&
          !a.responseDetected
      )
      .sort((a, b) => b.attemptNumber - a.attemptNumber); // Sort by attempt number descending

    // Find the most recent sent attempt (highest attempt number)
    const latestSentAttempt = sentAttempts[0];

    // Check ALL sent attempts for replies (a client might reply to any thread)
    let foundReply = false;
    for (const attempt of sentAttempts) {
      try {
        const scanResult = await scanThreadForReplies(
          session.accessToken,
          attempt.gmailThreadId!,
          attempt.gmailMessageId!,
          client.email
        );

        if (scanResult.hasReply) {
          foundReply = true;

          // Update the attempt with response info
          await outreachAttemptsDbApi.updateResponseStatus(attempt.id, {
            responseDetected: true,
            responseDetectedAt: scanResult.latestReplyAt?.toISOString(),
            responseMessageId: scanResult.latestReplyMessageId || undefined,
          });

          // Create a communication record for the reply
          if (scanResult.latestReplyPreview) {
            await communicationsDbApi.create({
              clientId,
              timestamp: scanResult.latestReplyAt?.toISOString() || new Date().toISOString(),
              direction: "in",
              type: "email",
              gmailMessageId: scanResult.latestReplyMessageId || undefined,
              gmailThreadId: attempt.gmailThreadId,
              subject: `Re: ${attempt.emailSubject || "Outreach"}`,
              bodyPreview: scanResult.latestReplyPreview,
              outreachAttemptNumber: attempt.attemptNumber,
            });
          }

          // Update client status
          await clientsDbApi.update(clientId, {
            status: "in_communication",
          });

          results.push({
            clientId,
            clientName: `${client.firstName} ${client.lastName}`,
            attemptId: attempt.id,
            attemptNumber: attempt.attemptNumber,
            previousStatus: client.status,
            newStatus: "in_communication",
            hasReply: true,
            replyPreview: scanResult.latestReplyPreview || undefined,
          });

          // Found a reply, stop checking other attempts
          break;
        }
      } catch (error) {
        results.push({
          clientId,
          clientName: `${client.firstName} ${client.lastName}`,
          attemptId: attempt.id,
          attemptNumber: attempt.attemptNumber,
          previousStatus: client.status,
          newStatus: null,
          hasReply: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    // If no reply found, check if status should change based on the LATEST sent attempt
    if (!foundReply && latestSentAttempt) {
      const responseWindowEnd = latestSentAttempt.responseWindowEnd
        ? new Date(latestSentAttempt.responseWindowEnd)
        : latestSentAttempt.sentAt
        ? calculateResponseWindowEnd(new Date(latestSentAttempt.sentAt))
        : null;

      const newStatus = determineOutreachStatus({
        responseDetected: false,
        sentAt: latestSentAttempt.sentAt ? new Date(latestSentAttempt.sentAt) : null,
        responseWindowEnd,
        attemptNumber: latestSentAttempt.attemptNumber,
        totalAttempts,
      });

      if (newStatus && newStatus !== client.status) {
        await clientsDbApi.update(clientId, { status: newStatus });

        results.push({
          clientId,
          clientName: `${client.firstName} ${client.lastName}`,
          attemptId: latestSentAttempt.id,
          attemptNumber: latestSentAttempt.attemptNumber,
          previousStatus: client.status,
          newStatus,
          hasReply: false,
        });
      }
    }

    return NextResponse.json({
      success: true,
      clientId,
      results,
    });
  } catch (error) {
    console.error("Error checking replies:", error);
    return NextResponse.json(
      { error: "Failed to check replies" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get settings for total attempt count
    const settings = await settingsDbApi.getAll();
    const totalAttempts = parseInt(settings.outreachAttemptCount || "3", 10);

    // Get all clients in outreach statuses that need checking
    const allClients = await clientsDbApi.getAll();
    const clientsToCheck = allClients.filter((c) =>
      [
        "outreach_sent",
        "follow_up_1",
        "follow_up_2",
        "awaiting_response",
        "follow_up_due",
      ].includes(c.status)
    );

    const allResults: CheckReplyResult[] = [];
    let repliesFound = 0;
    let statusUpdates = 0;

    for (const client of clientsToCheck) {
      const attempts = await outreachAttemptsDbApi.getByClientId(client.id);

      // Get all sent attempts that have thread IDs for reply checking
      const sentAttempts = attempts
        .filter(
          (a) =>
            a.status === "sent" &&
            a.gmailThreadId &&
            a.gmailMessageId &&
            !a.responseDetected
        )
        .sort((a, b) => b.attemptNumber - a.attemptNumber); // Sort by attempt number descending

      // Find the most recent sent attempt (highest attempt number)
      const latestSentAttempt = sentAttempts[0];

      // Check ALL sent attempts for replies (a client might reply to any thread)
      let foundReply = false;
      for (const attempt of sentAttempts) {
        try {
          const scanResult = await scanThreadForReplies(
            session.accessToken,
            attempt.gmailThreadId!,
            attempt.gmailMessageId!,
            client.email
          );

          if (scanResult.hasReply) {
            repliesFound++;
            foundReply = true;

            // Update the attempt
            await outreachAttemptsDbApi.updateResponseStatus(attempt.id, {
              responseDetected: true,
              responseDetectedAt: scanResult.latestReplyAt?.toISOString(),
              responseMessageId: scanResult.latestReplyMessageId || undefined,
            });

            // Create communication record
            if (scanResult.latestReplyPreview) {
              await communicationsDbApi.create({
                clientId: client.id,
                timestamp:
                  scanResult.latestReplyAt?.toISOString() ||
                  new Date().toISOString(),
                direction: "in",
                type: "email",
                gmailMessageId: scanResult.latestReplyMessageId || undefined,
                gmailThreadId: attempt.gmailThreadId,
                subject: `Re: ${attempt.emailSubject || "Outreach"}`,
                bodyPreview: scanResult.latestReplyPreview,
                outreachAttemptNumber: attempt.attemptNumber,
              });
            }

            // Update client status to in_communication
            await clientsDbApi.update(client.id, {
              status: "in_communication",
            });

            statusUpdates++;

            allResults.push({
              clientId: client.id,
              clientName: `${client.firstName} ${client.lastName}`,
              attemptId: attempt.id,
              attemptNumber: attempt.attemptNumber,
              previousStatus: client.status,
              newStatus: "in_communication",
              hasReply: true,
              replyPreview: scanResult.latestReplyPreview || undefined,
            });

            // Found a reply, stop checking other attempts for this client
            break;
          }
        } catch (error) {
          allResults.push({
            clientId: client.id,
            clientName: `${client.firstName} ${client.lastName}`,
            attemptId: attempt.id,
            attemptNumber: attempt.attemptNumber,
            previousStatus: client.status,
            newStatus: null,
            hasReply: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // If no reply found, check if status should change based on the LATEST sent attempt
      if (!foundReply && latestSentAttempt) {
        const responseWindowEnd = latestSentAttempt.responseWindowEnd
          ? new Date(latestSentAttempt.responseWindowEnd)
          : latestSentAttempt.sentAt
          ? calculateResponseWindowEnd(new Date(latestSentAttempt.sentAt))
          : null;

        const newStatus = determineOutreachStatus({
          responseDetected: false,
          sentAt: latestSentAttempt.sentAt ? new Date(latestSentAttempt.sentAt) : null,
          responseWindowEnd,
          attemptNumber: latestSentAttempt.attemptNumber,
          totalAttempts,
        });

        if (newStatus && newStatus !== client.status) {
          await clientsDbApi.update(client.id, { status: newStatus });
          statusUpdates++;

          allResults.push({
            clientId: client.id,
            clientName: `${client.firstName} ${client.lastName}`,
            attemptId: latestSentAttempt.id,
            attemptNumber: latestSentAttempt.attemptNumber,
            previousStatus: client.status,
            newStatus,
            hasReply: false,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        clientsChecked: clientsToCheck.length,
        repliesFound,
        statusUpdates,
      },
      results: allResults,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error checking replies:", error);
    return NextResponse.json(
      { error: "Failed to check replies" },
      { status: 500 }
    );
  }
}
