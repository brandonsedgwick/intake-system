import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';
import { prisma } from '@/lib/db/prisma';
import * as fs from 'fs';

const COOKIES_PATH = '/tmp/simplepractice-cookies.json';

export async function POST(req: NextRequest) {
  try {
    const { clientId } = await req.json();

    if (!clientId) {
      return NextResponse.json(
        { success: false, error: 'Missing client ID' },
        { status: 400 }
      );
    }

    // Fetch client from database
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        simplePracticeId: true,
        scheduledAppointment: true,
        assignedClinician: true,
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
        { success: false, error: 'Simple Practice ID not captured yet. Please create the client first.' },
        { status: 400 }
      );
    }

    // Parse appointment data
    let appointment: {
      day?: string;
      time?: string;
      clinician?: string;
      recurrence?: string;
      startDate?: string;
    } | null = null;

    if (client.scheduledAppointment) {
      try {
        appointment = JSON.parse(client.scheduledAppointment);
      } catch {
        appointment = null;
      }
    }

    if (!appointment) {
      return NextResponse.json(
        { success: false, error: 'No appointment details found for this client.' },
        { status: 400 }
      );
    }

    console.log('[CreateAppointment] Starting Puppeteer automation...');
    console.log('[CreateAppointment] Client:', client.firstName, client.lastName);
    console.log('[CreateAppointment] SP ID:', client.simplePracticeId);
    console.log('[CreateAppointment] Appointment:', appointment);

    // Launch browser (visible)
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
    let context;
    console.log('[CreateAppointment] Checking for saved session at:', COOKIES_PATH);

    try {
      if (fs.existsSync(COOKIES_PATH)) {
        console.log('[CreateAppointment] ✓ Cookies file found!');
        const cookiesData = fs.readFileSync(COOKIES_PATH, 'utf8');
        const cookies = JSON.parse(cookiesData);

        if (!cookies.cookies || !Array.isArray(cookies.cookies) || cookies.cookies.length === 0) {
          console.log('[CreateAppointment] ✗ Invalid cookie file structure, will need login');
          context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1200 },
            deviceScaleFactor: 1,
            locale: 'en-US',
            timezoneId: 'America/Los_Angeles'
          });
        } else {
          console.log('[CreateAppointment] ✓ Loading', cookies.cookies.length, 'cookies');
          context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1200 },
            deviceScaleFactor: 1,
            locale: 'en-US',
            timezoneId: 'America/Los_Angeles',
            storageState: cookies
          });
          console.log('[CreateAppointment] ✓ Session cookies loaded into browser context');
        }
      } else {
        console.log('[CreateAppointment] ✗ No saved session found, will need manual login');
        context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          viewport: { width: 1920, height: 1200 },
          deviceScaleFactor: 1,
          locale: 'en-US',
          timezoneId: 'America/Los_Angeles'
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log('[CreateAppointment] ✗ Error loading cookies:', errorMessage);
      context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1200 },
        deviceScaleFactor: 1,
        locale: 'en-US',
        timezoneId: 'America/Los_Angeles'
      });
    }

    const page = await context.newPage();

    try {
      // Navigate to client profile in Simple Practice
      const profileUrl = `https://secure.simplepractice.com/clients/${client.simplePracticeId}`;
      console.log('[CreateAppointment] Navigating to:', profileUrl);

      await page.goto(profileUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      console.log('[CreateAppointment] Current URL:', page.url());

      // Check if we need to login
      const currentUrl = page.url();
      const needsLogin = currentUrl.includes('/login') ||
                         currentUrl.includes('/sign_in') ||
                         currentUrl.includes('/saml/auth') ||
                         currentUrl.includes('account.simplepractice.com');

      if (needsLogin) {
        console.log('[CreateAppointment] ============================================');
        console.log('[CreateAppointment] NOT LOGGED IN - PLEASE LOG IN MANUALLY');
        console.log('[CreateAppointment] ============================================');

        // Inject login prompt popup
        await page.evaluate(() => {
          const panel = document.createElement('div');
          panel.id = 'puppeteer-info-panel';
          panel.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 999999;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 16px;
            padding: 24px;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            max-width: 380px;
            box-shadow: 0 20px 60px rgba(102, 126, 234, 0.4);
          `;

          const title = document.createElement('h3');
          title.textContent = '🔐 Login Required';
          title.style.cssText = 'margin: 0 0 16px; font-size: 18px;';
          panel.appendChild(title);

          const msg = document.createElement('p');
          msg.textContent = 'Please log in to Simple Practice to continue.';
          msg.style.cssText = 'margin: 0 0 16px; font-size: 14px; opacity: 0.9;';
          panel.appendChild(msg);

          const hint = document.createElement('p');
          hint.textContent = 'Once logged in, the automation will continue automatically.';
          hint.style.cssText = 'margin: 0; font-size: 12px; opacity: 0.7;';
          panel.appendChild(hint);

          document.body.appendChild(panel);
        });

        // Wait for successful login (3 minute timeout)
        try {
          await page.waitForURL(/secure\.simplepractice\.com\/(clients|dashboard|home|calendar)/, {
            timeout: 180000
          });
          console.log('[CreateAppointment] Login successful! New URL:', page.url());

          // Wait for network idle and save cookies
          await page.waitForLoadState('networkidle').catch(() => null);
          await page.waitForTimeout(5000);

          const storageState = await context.storageState();
          if (storageState.cookies && storageState.cookies.length > 0) {
            fs.writeFileSync(COOKIES_PATH, JSON.stringify(storageState, null, 2));
            console.log('[CreateAppointment] ✓ Session saved to:', COOKIES_PATH);
          }

          // Navigate to client profile after login
          await page.goto(profileUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          });

        } catch {
          await browser.close();
          return NextResponse.json({
            success: false,
            error: 'Login timeout - please try again'
          });
        }
      } else {
        console.log('[CreateAppointment] Already logged in with saved session!');
      }

      // Wait for page to load
      await page.waitForLoadState('networkidle').catch(() => null);
      await page.waitForTimeout(1000);

      // Prepare appointment info for popup
      const appointmentInfo = {
        clientName: `${client.firstName} ${client.lastName}`,
        email: client.email || '',
        phone: client.phone || '',
        day: appointment.day || '',
        time: appointment.time || '',
        clinician: appointment.clinician || client.assignedClinician || '',
        recurrence: appointment.recurrence || '',
        startDate: appointment.startDate || '',
      };

      // Inject floating popup with appointment details
      const injectPopup = async () => {
        await page.evaluate((info) => {
          // Remove existing panel if present
          const existing = document.getElementById('puppeteer-info-panel');
          if (existing) {
            existing.remove();
          }

          console.log('[Popup] Injecting appointment info panel...');

          // Create draggable info panel
          const infoPanel = document.createElement('div');
          infoPanel.id = 'puppeteer-info-panel';
          infoPanel.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 999999;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            padding: 0;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(16, 185, 129, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            max-width: 400px;
            cursor: move;
            user-select: none;
            backdrop-filter: blur(10px);
          `;

          // Drag functionality
          let isDragging = false;
          let initialX = 0;
          let initialY = 0;

          infoPanel.addEventListener('mousedown', (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName !== 'BUTTON') {
              isDragging = true;
              initialX = e.clientX - infoPanel.offsetLeft;
              initialY = e.clientY - infoPanel.offsetTop;
              infoPanel.style.cursor = 'grabbing';
            }
          });

          document.addEventListener('mousemove', (e: MouseEvent) => {
            if (isDragging) {
              e.preventDefault();
              infoPanel.style.left = (e.clientX - initialX) + 'px';
              infoPanel.style.top = (e.clientY - initialY) + 'px';
            }
          });

          document.addEventListener('mouseup', () => {
            isDragging = false;
            infoPanel.style.cursor = 'move';
          });

          // Header
          const header = document.createElement('div');
          header.style.cssText = `
            background: rgba(255, 255, 255, 0.15);
            padding: 16px 20px;
            border-radius: 16px 16px 0 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
            display: flex;
            align-items: center;
            justify-content: space-between;
          `;

          const title = document.createElement('div');
          title.textContent = '📅 Create Appointment';
          title.style.cssText = 'font-size: 18px; font-weight: 700; color: white;';
          header.appendChild(title);

          const dragHint = document.createElement('div');
          dragHint.textContent = '⋮⋮';
          dragHint.style.cssText = 'font-size: 20px; color: rgba(255, 255, 255, 0.6); letter-spacing: 2px;';
          header.appendChild(dragHint);

          infoPanel.appendChild(header);

          // Content area
          const content = document.createElement('div');
          content.style.cssText = 'padding: 20px; background: white; border-radius: 0 0 16px 16px;';

          // Client name header
          const clientHeader = document.createElement('div');
          clientHeader.style.cssText = `
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid #e5e7eb;
          `;

          const clientLabel = document.createElement('div');
          clientLabel.textContent = 'CLIENT';
          clientLabel.style.cssText = 'font-size: 11px; text-transform: uppercase; color: #6b7280; margin-bottom: 4px; letter-spacing: 0.5px;';
          clientHeader.appendChild(clientLabel);

          const clientName = document.createElement('div');
          clientName.textContent = info.clientName;
          clientName.style.cssText = 'font-size: 18px; font-weight: 700; color: #111827;';
          clientHeader.appendChild(clientName);

          content.appendChild(clientHeader);

          // Appointment details grid
          const grid = document.createElement('div');
          grid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;';

          // Day
          const dayBox = document.createElement('div');
          dayBox.style.cssText = 'background: #f0fdf4; border-radius: 8px; padding: 12px; border-left: 3px solid #10b981;';
          const dayLabel = document.createElement('div');
          dayLabel.textContent = '📅 DAY';
          dayLabel.style.cssText = 'font-size: 11px; text-transform: uppercase; color: #059669; margin-bottom: 4px;';
          dayBox.appendChild(dayLabel);
          const dayValue = document.createElement('div');
          dayValue.textContent = info.day || 'Not set';
          dayValue.style.cssText = 'font-size: 14px; font-weight: 600; color: #065f46;';
          dayBox.appendChild(dayValue);
          grid.appendChild(dayBox);

          // Time
          const timeBox = document.createElement('div');
          timeBox.style.cssText = 'background: #fef3c7; border-radius: 8px; padding: 12px; border-left: 3px solid #f59e0b;';
          const timeLabel = document.createElement('div');
          timeLabel.textContent = '🕐 TIME';
          timeLabel.style.cssText = 'font-size: 11px; text-transform: uppercase; color: #d97706; margin-bottom: 4px;';
          timeBox.appendChild(timeLabel);
          const timeValue = document.createElement('div');
          timeValue.textContent = info.time || 'Not set';
          timeValue.style.cssText = 'font-size: 14px; font-weight: 600; color: #92400e;';
          timeBox.appendChild(timeValue);
          grid.appendChild(timeBox);

          // Clinician
          const clinicianBox = document.createElement('div');
          clinicianBox.style.cssText = 'background: #ede9fe; border-radius: 8px; padding: 12px; border-left: 3px solid #8b5cf6;';
          const clinicianLabel = document.createElement('div');
          clinicianLabel.textContent = '👨‍⚕️ CLINICIAN';
          clinicianLabel.style.cssText = 'font-size: 11px; text-transform: uppercase; color: #7c3aed; margin-bottom: 4px;';
          clinicianBox.appendChild(clinicianLabel);
          const clinicianValue = document.createElement('div');
          clinicianValue.textContent = info.clinician || 'Not set';
          clinicianValue.style.cssText = 'font-size: 14px; font-weight: 600; color: #5b21b6;';
          clinicianBox.appendChild(clinicianValue);
          grid.appendChild(clinicianBox);

          // Recurrence
          const recurrenceBox = document.createElement('div');
          recurrenceBox.style.cssText = 'background: #dbeafe; border-radius: 8px; padding: 12px; border-left: 3px solid #3b82f6;';
          const recurrenceLabel = document.createElement('div');
          recurrenceLabel.textContent = '🔄 RECURRENCE';
          recurrenceLabel.style.cssText = 'font-size: 11px; text-transform: uppercase; color: #2563eb; margin-bottom: 4px;';
          recurrenceBox.appendChild(recurrenceLabel);
          const recurrenceValue = document.createElement('div');
          recurrenceValue.textContent = info.recurrence || 'Not set';
          recurrenceValue.style.cssText = 'font-size: 14px; font-weight: 600; color: #1e40af;';
          recurrenceBox.appendChild(recurrenceValue);
          grid.appendChild(recurrenceBox);

          content.appendChild(grid);

          // Start date (full width)
          if (info.startDate) {
            const startDateBox = document.createElement('div');
            startDateBox.style.cssText = 'background: #fce7f3; border-radius: 8px; padding: 12px; border-left: 3px solid #ec4899; margin-bottom: 16px;';
            const startDateLabel = document.createElement('div');
            startDateLabel.textContent = '📆 START DATE';
            startDateLabel.style.cssText = 'font-size: 11px; text-transform: uppercase; color: #db2777; margin-bottom: 4px;';
            startDateBox.appendChild(startDateLabel);
            const startDateValue = document.createElement('div');
            try {
              startDateValue.textContent = new Date(info.startDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              });
            } catch {
              startDateValue.textContent = info.startDate;
            }
            startDateValue.style.cssText = 'font-size: 14px; font-weight: 600; color: #9d174d;';
            startDateBox.appendChild(startDateValue);
            content.appendChild(startDateBox);
          }

          // Instructions
          const instructions = document.createElement('div');
          instructions.style.cssText = `
            padding: 12px;
            background: #f9fafb;
            border-radius: 8px;
            margin-bottom: 16px;
            border: 1px solid #e5e7eb;
          `;
          const instructionText = document.createElement('p');
          instructionText.textContent = 'Use the "Schedule appointment" link in the right sidebar to create this appointment in Simple Practice.';
          instructionText.style.cssText = 'margin: 0; font-size: 13px; color: #6b7280; line-height: 1.5;';
          instructions.appendChild(instructionText);
          content.appendChild(instructions);

          // Close button
          const closeBtn = document.createElement('button');
          closeBtn.id = 'puppeteer-close-btn';
          closeBtn.textContent = 'Close Browser & Return to App';
          closeBtn.style.cssText = `
            width: 100%;
            padding: 14px 24px;
            background: #f3f4f6;
            color: #374151;
            border: 1px solid #d1d5db;
            border-radius: 10px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
          `;

          closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = '#e5e7eb';
            closeBtn.style.borderColor = '#9ca3af';
          });

          closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = '#f3f4f6';
            closeBtn.style.borderColor = '#d1d5db';
          });

          closeBtn.addEventListener('click', () => {
            (window as unknown as Record<string, boolean>)['closeRequested'] = true;
          });

          content.appendChild(closeBtn);
          infoPanel.appendChild(content);
          document.body.appendChild(infoPanel);

          console.log('[Popup] ✓ Appointment info panel injected');
        }, appointmentInfo);
      };

      // Inject popup
      await injectPopup();

      // Re-inject on page navigation (SPA routing)
      page.on('load', async () => {
        console.log('[CreateAppointment] Page load event, re-injecting popup...');
        await injectPopup().catch((e: Error) => console.log('[CreateAppointment] Failed to re-inject on load:', e.message));
      });

      page.on('domcontentloaded', async () => {
        console.log('[CreateAppointment] DOMContentLoaded event, re-injecting popup...');
        await injectPopup().catch((e: Error) => console.log('[CreateAppointment] Failed to re-inject on DOMContentLoaded:', e.message));
      });

      // Poll for URL changes (for SPA navigation)
      let lastUrl = page.url();
      const urlPollInterval = setInterval(async () => {
        try {
          const currentUrl = page.url();
          if (currentUrl !== lastUrl) {
            console.log('[CreateAppointment] URL changed:', currentUrl);
            lastUrl = currentUrl;
            await injectPopup().catch((e: Error) => console.log('[CreateAppointment] Failed to re-inject on URL change:', e.message));
          }
        } catch {
          // Page might be closed
        }
      }, 500);

      page.on('close', () => {
        console.log('[CreateAppointment] Page closed, clearing URL poll interval');
        clearInterval(urlPollInterval);
      });

      console.log('[CreateAppointment] ============================================');
      console.log('[CreateAppointment] NEXT STEPS:');
      console.log('[CreateAppointment] 1. Click "Schedule appointment" in the right sidebar');
      console.log('[CreateAppointment] 2. Create the appointment using the info shown');
      console.log('[CreateAppointment] 3. Click "Close Browser & Return to App" when done');
      console.log('[CreateAppointment] ============================================');

      // Main polling loop - wait for close request
      while (true) {
        const flags = await page.evaluate(() => ({
          closeRequested: (window as unknown as Record<string, boolean>)['closeRequested'] || false,
        }));

        if (flags.closeRequested) {
          console.log('[CreateAppointment] Close requested, closing browser...');
          clearInterval(urlPollInterval);
          await browser.close();

          return NextResponse.json({
            success: true,
            message: 'Browser closed'
          });
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if browser was closed externally
        if (!browser.isConnected()) {
          console.log('[CreateAppointment] Browser disconnected');
          clearInterval(urlPollInterval);
          return NextResponse.json({
            success: true,
            message: 'Browser was closed'
          });
        }
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[CreateAppointment] Error during automation:', errorMessage);
      await browser.close();

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 500 }
      );
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CreateAppointment] Error:', errorMessage);
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
