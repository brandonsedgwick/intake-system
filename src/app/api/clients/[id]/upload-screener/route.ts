/**
 * API Route: Upload Client Screener PDF to Simple Practice
 *
 * POST /api/clients/[id]/upload-screener
 *
 * Checks if PDF exists in database, then launches Puppeteer to upload it
 * to the client's documents page in Simple Practice.
 *
 * CORS: Allows cross-origin requests from Simple Practice domain.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// CORS headers for cross-origin requests from Simple Practice domain
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://secure.simplepractice.com',
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
  try {
    // NOTE: No authentication required - this endpoint is called from the Puppeteer
    // browser popup which runs in Simple Practice domain context, not the intake app domain.
    // Security is ensured by requiring a valid client ID and only uploading pre-generated PDFs.

    const { id } = await params;

    // Fetch client with PDF and Simple Practice ID
    const client = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        screenerPdfData: true,
        simplePracticeId: true,
      }
    });

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404, headers: corsHeaders });
    }

    // Check if PDF exists
    if (!client.screenerPdfData) {
      return NextResponse.json({
        error: 'PDF not generated',
        message: 'Please generate the screener PDF first before uploading.',
      }, { status: 400, headers: corsHeaders });
    }

    // Check if Simple Practice ID exists
    if (!client.simplePracticeId) {
      return NextResponse.json({
        error: 'Simple Practice ID missing',
        message: 'Please capture the Simple Practice ID first before uploading.',
      }, { status: 400, headers: corsHeaders });
    }

    // Convert base64 to Buffer
    const pdfBuffer = Buffer.from(client.screenerPdfData, 'base64');

    // Write to temp file
    const tmpFilePath = path.join('/tmp', `screener-${client.id}-${Date.now()}.pdf`);
    fs.writeFileSync(tmpFilePath, pdfBuffer);

    console.log('[Upload] Temp file created:', tmpFilePath);

    // Launch browser and upload
    const browser = await chromium.launch({ headless: false });

    let uploadError: string | null = null;

    try {
      // Load cookies if available
      const cookiesPath = '/tmp/simplepractice-cookies.json';
      let context;

      if (fs.existsSync(cookiesPath)) {
        const cookiesData = fs.readFileSync(cookiesPath, 'utf8');
        const cookies = JSON.parse(cookiesData);

        if (cookies.cookies && Array.isArray(cookies.cookies) && cookies.cookies.length > 0) {
          console.log('[Upload] Loading saved session cookies');
          context = await browser.newContext({
            viewport: { width: 1920, height: 1200 },
            storageState: cookies
          });
        } else {
          console.log('[Upload] Invalid cookie structure, creating fresh context');
          context = await browser.newContext({
            viewport: { width: 1920, height: 1200 },
          });
        }
      } else {
        console.log('[Upload] No saved cookies, creating fresh context');
        context = await browser.newContext({
          viewport: { width: 1920, height: 1200 },
        });
      }

      const page = await context.newPage();

      // Navigate to documents page
      console.log('[Upload] Navigating to documents page for client:', client.simplePracticeId);
      await page.goto(`https://secure.simplepractice.com/clients/${client.simplePracticeId}/documents`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      console.log('[Upload] ✓ Documents page loaded');
      await page.waitForTimeout(2000);

      // Look for upload/add file button
      console.log('[Upload] Looking for file upload button...');

      // Strategy 1: Try "Actions" dropdown with "Upload File" option
      try {
        const actionsButton = page.locator('button:has-text("Actions")').first();
        await actionsButton.click();
        console.log('[Upload] ✓ Clicked Actions button');

        await page.waitForTimeout(500);

        const uploadOption = page.locator('button:has-text("Upload File"), a:has-text("Upload File")').first();
        await uploadOption.click();
        console.log('[Upload] ✓ Clicked Upload File option');

      } catch (actionsError: any) {
        // Strategy 2: Try direct "Upload" or "Add File" button
        console.log('[Upload] Actions dropdown not found, trying direct upload button...');

        const uploadButton = page.locator('button:has-text("Upload"), button:has-text("Add File")').first();
        await uploadButton.click();
        console.log('[Upload] ✓ Clicked upload button');
      }

      await page.waitForTimeout(1000);

      // Wait for file chooser dialog
      console.log('[Upload] Waiting for file chooser...');

      const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 10000 });

      // Trigger file input (may be hidden)
      try {
        const fileInput = page.locator('input[type="file"]').first();
        await fileInput.click({ force: true });
      } catch (inputError: any) {
        console.log('[Upload] Could not click file input directly, continuing...');
      }

      const fileChooser = await fileChooserPromise;
      console.log('[Upload] ✓ File chooser opened');

      // Select file in chooser
      await fileChooser.setFiles(tmpFilePath);
      console.log('[Upload] ✓ File selected in chooser');

      // Wait for upload to complete
      await page.waitForTimeout(5000);

      // Look for success indicator
      const uploadSuccess = await page.locator('text=/uploaded|success|complete/i').first().isVisible({ timeout: 5000 })
        .catch(() => false);

      if (!uploadSuccess) {
        console.warn('[Upload] ⚠ Could not confirm upload success (no success message found)');
        uploadError = 'Upload may have failed - no success confirmation detected';
      } else {
        console.log('[Upload] ✓ Upload confirmed successful');
      }

    } catch (uploadErr: any) {
      uploadError = uploadErr.message;
      console.error('[Upload] ✗ PDF upload failed:', uploadError);
    } finally {
      // Clean up temp file
      if (fs.existsSync(tmpFilePath)) {
        fs.unlinkSync(tmpFilePath);
        console.log('[Upload] ✓ Temp file deleted');
      }
      await browser.close();
    }

    // Update database with upload status
    await prisma.client.update({
      where: { id: client.id },
      data: {
        screenerUploadedToSP: !uploadError,
        screenerUploadError: uploadError || null,
      }
    });

    console.log('[Upload] ✓ Database updated with upload status');

    if (uploadError) {
      return NextResponse.json({
        success: false,
        error: 'Upload failed',
        details: uploadError,
      }, { status: 500, headers: corsHeaders });
    }

    return NextResponse.json(
      { success: true, message: 'Screener uploaded successfully to Simple Practice' },
      { headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('[Upload] Error:', error);
    return NextResponse.json({
      error: 'Failed to upload screener',
      details: error.message
    }, { status: 500, headers: corsHeaders });
  }
}

