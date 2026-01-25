/**
 * API Route: Generate Client Screener PDF
 *
 * POST /api/clients/[id]/generate-screener
 *
 * Generates a professionally-formatted PDF screener from client intake data
 * and saves it to the database as base64-encoded data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { prisma } from '@/lib/db/prisma';
import { generateScreenerPDF, saveScreenerPDF } from '@/lib/services/pdf-screener';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Fetch client data
    const client = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        dateOfBirth: true,
        age: true,
        paymentType: true,
        insuranceProvider: true,
        insuranceMemberId: true,
        presentingConcerns: true,
        suicideAttemptRecent: true,
        psychiatricHospitalization: true,
        additionalInfo: true,
      }
    });

    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      );
    }

    // Generate PDF
    console.log('[API] Generating screener PDF for client:', client.id);
    const { pdfBase64, generatedAt } = await generateScreenerPDF(client);

    // Save to database
    await saveScreenerPDF(client.id, pdfBase64, generatedAt);

    console.log('[API] ✓ Screener PDF generated and saved');

    return NextResponse.json({
      success: true,
      generatedAt,
      message: 'Screener PDF generated successfully',
    });

  } catch (error: any) {
    console.error('[API] Error generating screener:', error);
    return NextResponse.json(
      { error: 'Failed to generate screener PDF', details: error.message },
      { status: 500 }
    );
  }
}
