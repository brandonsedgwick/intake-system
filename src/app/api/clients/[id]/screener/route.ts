/**
 * API Route: Download Client Screener PDF
 *
 * GET /api/clients/[id]/screener
 *
 * Returns the base64-encoded PDF screener for a client, along with metadata
 * about generation and upload status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Fetch client with screener data
    const client = await prisma.client.findUnique({
      where: { id },
      select: {
        screenerPdfData: true,
        screenerGeneratedAt: true,
        screenerUploadedToSP: true,
        screenerUploadError: true,
        firstName: true,
        lastName: true,
      }
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    if (!client.screenerPdfData) {
      return NextResponse.json(
        { error: 'No screener PDF found for this client' },
        { status: 404 }
      );
    }

    // Return screener data
    return NextResponse.json({
      screenerPdfData: client.screenerPdfData,
      screenerGeneratedAt: client.screenerGeneratedAt,
      screenerUploadedToSP: client.screenerUploadedToSP,
      screenerUploadError: client.screenerUploadError,
      fileName: `screener-${client.firstName}-${client.lastName}.pdf`,
    });

  } catch (error: any) {
    console.error('[API] Error fetching screener:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
