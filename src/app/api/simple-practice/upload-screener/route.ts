/**
 * API Route: Upload Screener to Simple Practice via Puppeteer
 *
 * POST /api/simple-practice/upload-screener
 *
 * Opens Puppeteer browser, navigates to client's SP profile,
 * clicks through Files → Actions → Upload file, and uploads the screener PDF.
 * Shows a floating popup with status and manual close button.
 */

import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';
import { prisma } from '@/lib/db/prisma';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { clientId } = await req.json();

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: 'Missing clientId' },
        { status: 400 }
      );
    }

    console.log('[Upload] Starting screener upload for client:', clientId);

    // Fetch client data
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        simplePracticeId: true,
        screenerPdfData: true,
        screenerGeneratedAt: true,
      }
    });

    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404 }
      );
    }

    if (!client.simplePracticeId) {
      return NextResponse.json(
        { success: false, error: 'Simple Practice ID not captured. Please create the client in Simple Practice first.' },
        { status: 400 }
      );
    }

    if (!client.screenerPdfData) {
      return NextResponse.json(
        { success: false, error: 'Screener PDF not generated. Please generate the screener first.' },
        { status: 400 }
      );
    }

    // Write PDF to temp file
    const pdfBuffer = Buffer.from(client.screenerPdfData, 'base64');
    const tmpFilePath = path.join('/tmp', `screener-${client.id}-${Date.now()}.pdf`);
    fs.writeFileSync(tmpFilePath, pdfBuffer);
    console.log('[Upload] Temp PDF file created:', tmpFilePath);

    // Launch browser
    const cookiesPath = '/tmp/simplepractice-cookies.json';
    let context;

    const browser = await chromium.launch({
      headless: false,
      slowMo: 100,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--force-color-profile=srgb',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1200'
      ]
    });

    // Try to load saved cookies for persistent session
    console.log('[Upload] Checking for saved session at:', cookiesPath);

    try {
      if (fs.existsSync(cookiesPath)) {
        console.log('[Upload] ✓ Cookies file found!');
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
    } catch (cookieError: any) {
      console.log('[Upload] Error loading cookies:', cookieError.message);
      context = await browser.newContext({
        viewport: { width: 1920, height: 1200 },
      });
    }

    const page = await context.newPage();

    // Client info for popup
    const clientInfo = {
      firstName: client.firstName,
      lastName: client.lastName,
      simplePracticeId: client.simplePracticeId,
      pdfGeneratedAt: client.screenerGeneratedAt,
    };

    // Inject floating popup using safe DOM methods
    const injectPopup = async (status: string, isError: boolean = false, showRetry: boolean = false) => {
      await page.evaluate(({ clientInfo, status, isError, showRetry }) => {
        // Type-safe window access helper for browser code
        const win = window as unknown as Record<string, unknown>;

        // Remove existing popup if any
        const existing = document.getElementById('upload-screener-popup');
        if (existing) existing.remove();

        // Create popup container
        const popup = document.createElement('div');
        popup.id = 'upload-screener-popup';
        popup.style.cssText = `
          position: fixed;
          top: 20px;
          left: 20px;
          width: 360px;
          background: linear-gradient(135deg, #ec4899 0%, #f43f5e 50%, #ef4444 100%);
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: white;
          overflow: hidden;
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
          padding: 16px 20px;
          background: rgba(0, 0, 0, 0.1);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        `;

        const headerTitle = document.createElement('div');
        headerTitle.style.cssText = 'font-size: 14px; font-weight: 600; margin-bottom: 4px;';
        headerTitle.textContent = '📤 Upload Screener';
        header.appendChild(headerTitle);

        const headerSubtitle = document.createElement('div');
        headerSubtitle.style.cssText = 'font-size: 12px; opacity: 0.9;';
        headerSubtitle.textContent = clientInfo.firstName + ' ' + clientInfo.lastName;
        header.appendChild(headerSubtitle);

        popup.appendChild(header);

        // Content
        const content = document.createElement('div');
        content.style.cssText = `
          padding: 20px;
          background: white;
          color: #374151;
        `;

        // Status indicator
        const statusDiv = document.createElement('div');
        statusDiv.style.cssText = `
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: ${isError ? 'linear-gradient(135deg, #fef2f2, #fee2e2)' : 'linear-gradient(135deg, #f0fdf4, #dcfce7)'};
          border-radius: 10px;
          border-left: 3px solid ${isError ? '#ef4444' : '#22c55e'};
          margin-bottom: 16px;
        `;

        const statusIcon = document.createElement('span');
        statusIcon.textContent = isError ? '❌' : (status.includes('✓') ? '✅' : '⏳');
        statusIcon.style.fontSize = '20px';
        statusDiv.appendChild(statusIcon);

        const statusTextContainer = document.createElement('div');

        const statusTitle = document.createElement('div');
        statusTitle.style.cssText = 'font-weight: 600; color: ' + (isError ? '#dc2626' : '#166534') + ';';
        statusTitle.textContent = isError ? 'Upload Failed' : 'Status';
        statusTextContainer.appendChild(statusTitle);

        const statusDetail = document.createElement('div');
        statusDetail.style.cssText = 'font-size: 12px; color: #6b7280; margin-top: 2px;';
        statusDetail.textContent = status;
        statusTextContainer.appendChild(statusDetail);

        statusDiv.appendChild(statusTextContainer);
        content.appendChild(statusDiv);

        // SP Link
        const linkDiv = document.createElement('div');
        linkDiv.style.cssText = `
          font-size: 11px;
          color: #9ca3af;
          margin-bottom: 16px;
        `;
        linkDiv.textContent = 'SP ID: ' + clientInfo.simplePracticeId;
        content.appendChild(linkDiv);

        // Buttons container
        const buttonsDiv = document.createElement('div');
        buttonsDiv.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';

        // Retry button (only if error)
        if (showRetry) {
          const retryBtn = document.createElement('button');
          retryBtn.id = 'upload-retry-btn';
          retryBtn.textContent = 'Retry Upload';
          retryBtn.style.cssText = `
            width: 100%;
            padding: 12px 20px;
            background: linear-gradient(135deg, #f59e0b, #d97706);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          `;
          retryBtn.addEventListener('click', () => {
            win['retryRequested'] = true;
          });
          buttonsDiv.appendChild(retryBtn);
        }

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.id = 'upload-close-btn';
        closeBtn.textContent = 'Close Browser';
        closeBtn.style.cssText = `
          width: 100%;
          padding: 12px 20px;
          background: transparent;
          color: #6b7280;
          border: 2px solid #d1d5db;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        `;
        closeBtn.addEventListener('click', () => {
          win['closeRequested'] = true;
        });
        buttonsDiv.appendChild(closeBtn);

        content.appendChild(buttonsDiv);
        popup.appendChild(content);
        document.body.appendChild(popup);
      }, { clientInfo, status, isError, showRetry });
    };

    // Navigate to client profile
    console.log('[Upload] Navigating to client profile...');
    await injectPopup('Navigating to client profile...');

    await page.goto(`https://secure.simplepractice.com/clients/${client.simplePracticeId}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    console.log('[Upload] ✓ Loaded client profile');
    await page.waitForTimeout(2000);

    // Re-inject popup after navigation
    await injectPopup('Opening Files tab...');

    // Click Files tab
    console.log('[Upload] Looking for Files tab...');
    try {
      // Try multiple selectors for the Files tab
      const filesTab = page.locator('a:has-text("Files"), button:has-text("Files"), [role="tab"]:has-text("Files")').first();
      await filesTab.waitFor({ timeout: 10000 });
      await filesTab.click();
      console.log('[Upload] ✓ Clicked Files tab');
    } catch (e: any) {
      console.error('[Upload] Failed to find Files tab:', e.message);
      await injectPopup('Could not find Files tab. Please click it manually.', true, true);

      // Wait for user to close or retry
      while (true) {
        const flags = await page.evaluate(() => {
          const w = window as unknown as Record<string, unknown>;
          return {
            closeRequested: (w['closeRequested'] as boolean) || false,
            retryRequested: (w['retryRequested'] as boolean) || false,
          };
        });

        if (flags.closeRequested) {
          await browser.close();
          if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
          return NextResponse.json({ success: false, error: 'User closed browser', screenerUploaded: false });
        }

        if (flags.retryRequested) {
          await page.evaluate(() => { (window as unknown as Record<string, unknown>)['retryRequested'] = false; });
          await injectPopup('Retrying... Looking for Files tab');
          continue;
        }

        await page.waitForTimeout(500);
      }
    }

    await page.waitForTimeout(2000);
    await injectPopup('Clicking Actions button...');

    // Click Actions button
    console.log('[Upload] Looking for Actions button...');
    try {
      const actionsBtn = page.locator('button:has-text("Actions")').first();
      await actionsBtn.waitFor({ timeout: 10000 });
      await actionsBtn.click();
      console.log('[Upload] ✓ Clicked Actions button');
    } catch (e: any) {
      console.error('[Upload] Failed to find Actions button:', e.message);
      await injectPopup('Could not find Actions button. Please click it manually.', true, true);

      while (true) {
        const flags = await page.evaluate(() => {
          const w = window as unknown as Record<string, unknown>;
          return {
            closeRequested: (w['closeRequested'] as boolean) || false,
            retryRequested: (w['retryRequested'] as boolean) || false,
          };
        });

        if (flags.closeRequested) {
          await browser.close();
          if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
          return NextResponse.json({ success: false, error: 'User closed browser', screenerUploaded: false });
        }

        if (flags.retryRequested) {
          await page.evaluate(() => { (window as unknown as Record<string, unknown>)['retryRequested'] = false; });
          break;
        }

        await page.waitForTimeout(500);
      }
    }

    await page.waitForTimeout(1000);
    await injectPopup('Uploading screener PDF...');

    // Handle file upload
    // IMPORTANT: Set up file chooser listener BEFORE clicking Upload file option
    console.log('[Upload] Setting up file chooser listener...');
    let uploadSuccess = false;
    let uploadError: string | null = null;

    try {
      // Set up file chooser promise FIRST (before triggering it)
      const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 15000 });

      // Now click the Upload file option (which triggers the file dialog)
      console.log('[Upload] Looking for Upload file option...');
      const uploadOption = page.locator('button:has-text("Upload file"), a:has-text("Upload file"), [role="menuitem"]:has-text("Upload file")').first();
      await uploadOption.waitFor({ timeout: 5000 });
      await uploadOption.click();
      console.log('[Upload] ✓ Clicked Upload file option');

      // Wait for the file chooser that was triggered by the click
      console.log('[Upload] Waiting for file chooser dialog...');
      const fileChooser = await fileChooserPromise;
      console.log('[Upload] ✓ File chooser opened');

      await fileChooser.setFiles(tmpFilePath);
      console.log('[Upload] ✓ File selected:', tmpFilePath);

      // Wait for upload to complete
      await page.waitForTimeout(5000);

      uploadSuccess = true;
      console.log('[Upload] ✓ Upload appears successful');

    } catch (uploadErr: any) {
      console.error('[Upload] Upload error:', uploadErr.message);
      uploadError = uploadErr.message;

      // If we failed to find the Upload file option, show manual retry
      if (uploadErr.message.includes('Upload file') || uploadErr.message.includes('Timeout')) {
        await injectPopup('Could not complete upload. Please try manually or click Retry.', true, true);

        // Wait for user decision
        while (true) {
          const flags = await page.evaluate(() => {
            const w = window as unknown as Record<string, unknown>;
            return {
              closeRequested: (w['closeRequested'] as boolean) || false,
              retryRequested: (w['retryRequested'] as boolean) || false,
            };
          });

          if (flags.closeRequested) {
            await browser.close();
            if (fs.existsSync(tmpFilePath)) fs.unlinkSync(tmpFilePath);
            return NextResponse.json({ success: false, error: 'User closed browser', screenerUploaded: false });
          }

          if (flags.retryRequested) {
            await page.evaluate(() => { (window as unknown as Record<string, unknown>)['retryRequested'] = false; });
            // Will retry in the main loop below
            break;
          }

          await page.waitForTimeout(500);
        }
      }
    }

    // Update popup with final status
    if (uploadSuccess) {
      await injectPopup('✓ Screener uploaded successfully!', false, false);

      // Update database
      await prisma.client.update({
        where: { id: clientId },
        data: {
          screenerUploadedToSP: true,
          screenerUploadError: null,
        }
      });

      // Also update scheduling progress
      const currentClient = await prisma.client.findUnique({
        where: { id: clientId },
        select: { schedulingProgress: true }
      });

      let progress = {
        clientCreated: false,
        screenerUploaded: false,
        appointmentCreated: false,
        finalized: false,
      };

      if (currentClient?.schedulingProgress) {
        try {
          progress = JSON.parse(currentClient.schedulingProgress);
        } catch (e) {}
      }

      progress.screenerUploaded = true;

      await prisma.client.update({
        where: { id: clientId },
        data: {
          schedulingProgress: JSON.stringify(progress),
        }
      });

      console.log('[Upload] ✓ Database updated with success status');

    } else {
      await injectPopup(uploadError || 'Upload failed. Please try again.', true, true);

      // Update database with error
      await prisma.client.update({
        where: { id: clientId },
        data: {
          screenerUploadedToSP: false,
          screenerUploadError: uploadError,
        }
      });
    }

    // Wait for user to close browser
    console.log('[Upload] Waiting for user to close browser...');
    while (true) {
      const flags = await page.evaluate(() => {
        const w = window as unknown as Record<string, unknown>;
        return {
          closeRequested: (w['closeRequested'] as boolean) || false,
          retryRequested: (w['retryRequested'] as boolean) || false,
        };
      });

      if (flags.closeRequested) {
        console.log('[Upload] User requested close');
        break;
      }

      if (flags.retryRequested && !uploadSuccess) {
        console.log('[Upload] User requested retry');
        await page.evaluate(() => { (window as unknown as Record<string, unknown>)['retryRequested'] = false; });

        // Retry the upload
        await injectPopup('Retrying upload...');

        try {
          // Click Actions again
          const actionsBtn = page.locator('button:has-text("Actions")').first();
          await actionsBtn.click();
          await page.waitForTimeout(500);

          // Set up file chooser BEFORE clicking Upload file
          const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 15000 });

          // Click Upload file (triggers file dialog)
          const uploadOption = page.locator('button:has-text("Upload file"), a:has-text("Upload file")').first();
          await uploadOption.click();
          console.log('[Upload] Retry: Clicked Upload file, waiting for file chooser...');

          const fileChooser = await fileChooserPromise;
          await fileChooser.setFiles(tmpFilePath);

          await page.waitForTimeout(5000);

          uploadSuccess = true;
          await injectPopup('✓ Screener uploaded successfully!', false, false);

          // Update database
          await prisma.client.update({
            where: { id: clientId },
            data: {
              screenerUploadedToSP: true,
              screenerUploadError: null,
            }
          });

          // Update scheduling progress
          const retryClient = await prisma.client.findUnique({
            where: { id: clientId },
            select: { schedulingProgress: true }
          });

          let retryProgress = {
            clientCreated: false,
            screenerUploaded: false,
            appointmentCreated: false,
            finalized: false,
          };

          if (retryClient?.schedulingProgress) {
            try {
              retryProgress = JSON.parse(retryClient.schedulingProgress);
            } catch (e) {}
          }

          retryProgress.screenerUploaded = true;

          await prisma.client.update({
            where: { id: clientId },
            data: {
              schedulingProgress: JSON.stringify(retryProgress),
            }
          });

        } catch (retryErr: any) {
          console.error('[Upload] Retry failed:', retryErr.message);
          await injectPopup(retryErr.message || 'Retry failed', true, true);
        }
      }

      await page.waitForTimeout(500);
    }

    // Close browser
    await browser.close();
    console.log('[Upload] Browser closed');

    // Clean up temp file
    if (fs.existsSync(tmpFilePath)) {
      fs.unlinkSync(tmpFilePath);
      console.log('[Upload] Temp file deleted');
    }

    return NextResponse.json({
      success: true,
      screenerUploaded: uploadSuccess,
      error: uploadError,
      message: uploadSuccess ? 'Screener uploaded successfully' : 'Upload completed with errors',
    });

  } catch (error: any) {
    console.error('[Upload] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
