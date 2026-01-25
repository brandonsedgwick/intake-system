/**
 * API Route: Save Simple Practice Client ID
 *
 * POST /api/clients/[id]/simple-practice-id
 *
 * Saves the captured Simple Practice client ID and updates scheduling progress.
 * This endpoint is called from the Puppeteer browser popup when user clicks
 * "Capture Simple Practice ID" button.
 *
 * NOTE: This is a public endpoint (no auth required) because it's called from
 * the browser context running on Simple Practice domain, not the intake app domain.
 *
 * CORS: Allows cross-origin requests from Simple Practice domain.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// CORS headers for cross-origin requests
// Using wildcard to allow requests from any origin (required for local dev)
// The popup runs in Simple Practice's domain context and calls back to our app
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400', // 24 hours preflight cache
};

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  console.log('[API] POST /api/clients/[id]/simple-practice-id - Request received');

  try {
    const { id } = await params;
    const body = await request.json();
    const { simplePracticeId } = body;

    console.log('[API] Saving Simple Practice ID:', { clientId: id, simplePracticeId });
    console.log('[API] Request body:', JSON.stringify(body));

    // Validate ID format (alphanumeric, 8+ characters)
    if (!simplePracticeId || !/^[a-zA-Z0-9]{8,}$/.test(simplePracticeId)) {
      console.error('[API] Invalid Simple Practice ID format:', simplePracticeId);
      return NextResponse.json(
        { success: false, error: 'Invalid Simple Practice ID format. Must be alphanumeric with at least 8 characters.' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get current scheduling progress
    const client = await prisma.client.findUnique({
      where: { id },
      select: { schedulingProgress: true }
    });

    if (!client) {
      console.error('[API] Client not found:', id);
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Parse existing progress or create new
    let progress: {
      clientCreated: boolean;
      clientCreatedAt?: string;
      screenerUploaded: boolean;
      appointmentCreated: boolean;
      finalized: boolean;
    } = {
      clientCreated: false,
      screenerUploaded: false,
      appointmentCreated: false,
      finalized: false
    };

    if (client.schedulingProgress) {
      try {
        progress = JSON.parse(client.schedulingProgress);
      } catch (e) {
        console.warn('[API] Failed to parse scheduling progress, using defaults');
      }
    }

    // Mark client created step as complete
    progress.clientCreated = true;
    progress.clientCreatedAt = new Date().toISOString();

    console.log('[API] Updating client with ID and progress:', { simplePracticeId, progress });

    // Update client with ID and progress
    await prisma.client.update({
      where: { id },
      data: {
        simplePracticeId,
        schedulingProgress: JSON.stringify(progress)
      }
    });

    console.log('[API] ✓ Simple Practice ID saved successfully');

    return NextResponse.json(
      { success: true, message: 'Simple Practice ID saved and progress updated' },
      { headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('[API] Error saving Simple Practice ID:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
