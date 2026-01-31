import { NextRequest, NextResponse } from 'next/server';
import { chromium, Page } from 'playwright';
import { prisma } from '@/lib/db/prisma';
import * as fs from 'fs';

const COOKIES_PATH = '/tmp/simplepractice-cookies.json';

// State machine states
type AppointmentState =
  | 'navigating'
  | 'selecting_service'
  | 'filling_form'
  | 'awaiting_confirmation'
  | 'saving'
  | 'complete'
  | 'error'
  // Series workflow states
  | 'series_first_filling'
  | 'series_first_confirming'
  | 'series_first_saving'
  | 'series_transition'
  | 'series_second_filling'
  | 'series_second_confirming'
  | 'series_second_saving'
  | 'series_complete';

// Series data interface
interface SeriesData {
  isSeries: boolean;
  isPartial: boolean;
  isRecurring: boolean;
  firstAppointment: {
    serviceCode: '90791';
    date: string;
    time: string;
    screenshot: string;
    createdAt: string;
  };
  secondAppointment?: {
    serviceCode: '90837';
    date: string;
    time: string;
    isRecurring: boolean;
    screenshot: string;
    createdAt: string;
  };
}

interface AppointmentInfo {
  clientId: string;
  clientName: string;
  email: string;
  phone: string;
  day: string;
  time: string;
  clinician: string;
  recurrence: string;
  startDate: string;
  startDateFormatted: string;
}

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
        schedulingProgress: true,
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

    console.log('[CreateAppointment] Starting automation...');
    console.log('[CreateAppointment] Client:', client.firstName, client.lastName);
    console.log('[CreateAppointment] SP ID:', client.simplePracticeId);
    console.log('[CreateAppointment] Appointment:', appointment);

    // Format start date for display
    let startDateFormatted = '';
    if (appointment.startDate) {
      try {
        startDateFormatted = new Date(appointment.startDate + 'T12:00:00').toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      } catch {
        startDateFormatted = appointment.startDate;
      }
    }

    // Prepare appointment info
    const appointmentInfo: AppointmentInfo = {
      clientId: client.id,
      clientName: `${client.firstName} ${client.lastName}`,
      email: client.email || '',
      phone: client.phone || '',
      day: appointment.day || '',
      time: appointment.time || '',
      clinician: appointment.clinician || client.assignedClinician || '',
      recurrence: appointment.recurrence || '',
      startDate: appointment.startDate || '',
      startDateFormatted,
    };

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
          console.log('[CreateAppointment] ✗ Invalid cookie file structure');
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
        }
      } else {
        console.log('[CreateAppointment] ✗ No saved session found');
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
      // Navigate to client profile
      const profileUrl = `https://secure.simplepractice.com/clients/${client.simplePracticeId}`;
      console.log('[CreateAppointment] Navigating to:', profileUrl);

      await page.goto(profileUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      // Check if we need to login
      const currentUrl = page.url();
      console.log('[CreateAppointment] Current URL after navigation:', currentUrl);
      const needsLogin = currentUrl.includes('/login') ||
                         currentUrl.includes('/sign_in') ||
                         currentUrl.includes('/saml/auth') ||
                         currentUrl.includes('account.simplepractice.com');
      console.log('[CreateAppointment] Needs login:', needsLogin);

      if (needsLogin) {
        console.log('[CreateAppointment] NOT LOGGED IN - PLEASE LOG IN MANUALLY');

        await injectLoginPrompt(page);

        // Wait for successful login (3 minute timeout)
        try {
          await page.waitForURL(/secure\.simplepractice\.com\/(clients|dashboard|home|calendar)/, {
            timeout: 180000
          });
          console.log('[CreateAppointment] Login successful!');

          // Wait for page to settle after login
          try {
            await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
          } catch {
            console.log('[CreateAppointment] domcontentloaded timeout after login');
          }
          await page.waitForTimeout(3000);

          const storageState = await context.storageState();
          if (storageState.cookies && storageState.cookies.length > 0) {
            fs.writeFileSync(COOKIES_PATH, JSON.stringify(storageState, null, 2));
            console.log('[CreateAppointment] ✓ Session saved');
          }

          // After login, navigate directly to appointment form
          const formOpened = await navigateToAppointmentForm(page, client.simplePracticeId!, appointmentInfo.startDate);
          if (!formOpened) {
            await browser.close();
            return NextResponse.json({
              success: false,
              error: 'Failed to navigate to appointment form after login'
            });
          }

        } catch {
          await browser.close();
          return NextResponse.json({
            success: false,
            error: 'Login timeout - please try again'
          });
        }
      } else {
        console.log('[CreateAppointment] Already logged in!');

        // ============================================
        // PHASE 1: Navigate directly to appointment form
        // ============================================
        console.log('[CreateAppointment] Phase 1: Navigating directly to appointment form...');

        const formOpened = await navigateToAppointmentForm(page, client.simplePracticeId!, appointmentInfo.startDate);

        if (!formOpened) {
          console.log('[CreateAppointment] Failed to navigate to appointment form');
          await browser.close();
          return NextResponse.json({
            success: false,
            error: 'Failed to navigate to appointment form'
          });
        }

        console.log('[CreateAppointment] ✓ Appointment form should be visible');
      }

      // ============================================
      // PHASE 2: Show service code selection popup
      // ============================================
      console.log('[CreateAppointment] Phase 2: Showing service code selection...');
      await injectServiceCodePopup(page, appointmentInfo);

      // ============================================
      // MAIN POLLING LOOP
      // ============================================
      let urlPollInterval: ReturnType<typeof setInterval> | null = null;
      let seriesData: SeriesData | null = null; // Track series workflow data

      // Track URL changes for re-injection
      let lastUrl = page.url();
      urlPollInterval = setInterval(async () => {
        try {
          const currentUrl = page.url();
          if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
          }
        } catch {
          // Page might be closed
        }
      }, 500);

      page.on('close', () => {
        if (urlPollInterval) clearInterval(urlPollInterval);
      });

      while (true) {
        const flags = await page.evaluate(() => ({
          appointmentState: (window as unknown as Record<string, string>)['appointmentState'] || 'selecting_service',
          selectedServiceCode: (window as unknown as Record<string, string | null>)['selectedServiceCode'] || null,
          confirmationReceived: (window as unknown as Record<string, boolean>)['confirmationReceived'] || false,
          closeRequested: (window as unknown as Record<string, boolean>)['closeRequested'] || false,
          errorMessage: (window as unknown as Record<string, string | null>)['errorMessage'] || null,
        }));

        // Debug logging for series states
        if (flags.appointmentState.startsWith('series_')) {
          console.log(`[CreateAppointment] SERIES STATE: ${flags.appointmentState}, confirmationReceived: ${flags.confirmationReceived}`);
        }

        // Handle close request
        if (flags.closeRequested) {
          console.log('[CreateAppointment] Close requested');
          if (urlPollInterval) clearInterval(urlPollInterval);
          await browser.close();

          // Check if we're in a partial series state (first appointment saved but second not done)
          const isPartialSeries = seriesData && seriesData.isPartial && seriesData.firstAppointment.createdAt;

          if (isPartialSeries) {
            console.log('[CreateAppointment] Partial series detected - first appointment was saved');
            return NextResponse.json({
              success: true,
              message: 'Browser closed by user. First appointment (90791) was saved.',
              isPartialSeries: true,
              serviceCode: '90791',
            });
          }

          return NextResponse.json({
            success: true,
            message: 'Browser closed by user'
          });
        }

        // Handle state transitions
        if (flags.appointmentState === 'filling_form' && flags.selectedServiceCode) {
          console.log('[CreateAppointment] Phase 3: Filling form with service code:', flags.selectedServiceCode);

          try {
            await fillAppointmentForm(page, appointmentInfo, flags.selectedServiceCode);
            await injectConfirmationPopup(page, appointmentInfo, flags.selectedServiceCode);
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('[CreateAppointment] Error filling form:', errorMessage);
            await injectErrorPopup(page, `Failed to fill form: ${errorMessage}`, true);
          }
        }

        if (flags.appointmentState === 'saving' && flags.confirmationReceived) {
          console.log('[CreateAppointment] Phase 5: Saving appointment...');

          try {
            // Capture screenshot of the filled form before saving
            let screenshotBase64: string | undefined;
            try {
              console.log('[CreateAppointment] Capturing appointment form screenshot...');
              const screenshotBuffer = await page.screenshot({ type: 'png' });
              screenshotBase64 = screenshotBuffer.toString('base64');
              console.log('[CreateAppointment] ✓ Screenshot captured for database storage');
            } catch (e) {
              console.log('[CreateAppointment] Could not capture screenshot:', e);
            }

            await saveAppointment(page);

            // Update database with service code, modifier code, and screenshot
            const selectedServiceCode = flags.selectedServiceCode;
            await updateClientRecord(clientId, selectedServiceCode || undefined, screenshotBase64, '95');

            await injectSuccessPopup(page, selectedServiceCode || '90837');
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('[CreateAppointment] Error saving:', errorMessage);
            await injectErrorPopup(page, `Failed to save: ${errorMessage}`, true);
          }
        }

        // ============================================
        // SERIES WORKFLOW STATE HANDLING
        // ============================================

        // Track series data across states
        if (!seriesData && flags.selectedServiceCode === 'series') {
          const isRecurring = appointment?.recurrence !== 'one-time';
          seriesData = {
            isSeries: true,
            isPartial: true,
            isRecurring,
            firstAppointment: {
              serviceCode: '90791',
              date: appointmentInfo.startDate,
              time: appointmentInfo.time,
              screenshot: '',
              createdAt: '',
            },
          };
        }

        // Series: Fill first appointment (90791)
        if (flags.appointmentState === 'series_first_filling' && flags.selectedServiceCode === 'series') {
          console.log('[CreateAppointment] SERIES: Filling appointment 1 of 2 (90791)...');

          try {
            await fillSeriesAppointmentForm(
              page,
              appointmentInfo,
              '90791',
              appointmentInfo.startDate,
              false, // No recurring for first appointment
              1
            );
            const isRecurring = appointment?.recurrence !== 'one-time';
            console.log('[CreateAppointment] SERIES: Form filled, now showing confirmation popup...');
            await injectSeriesConfirmationPopup(page, appointmentInfo, '90791', 1, appointmentInfo.startDate, isRecurring);
            console.log('[CreateAppointment] SERIES: Confirmation popup shown. Waiting for user to click Confirm...');
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('[CreateAppointment] Error filling series appointment 1:', errorMessage);
            await injectErrorPopup(page, `Failed to fill appointment 1: ${errorMessage}`, true);
          }
          // Wait for next iteration - don't fall through to other handlers
          await page.waitForTimeout(500);
          continue;
        }

        // Series: Wait for user confirmation on first appointment
        if (flags.appointmentState === 'series_first_confirming') {
          // Just waiting for user to click Confirm button in the popup
          // The popup's button click handler will change state to 'series_first_saving'
          await page.waitForTimeout(500);
          continue;
        }

        // Series: Save first appointment
        if (flags.appointmentState === 'series_first_saving' && flags.confirmationReceived) {
          console.log('[CreateAppointment] SERIES: Saving appointment 1 of 2...');

          try {
            // Capture screenshot
            let screenshot1Base64 = '';
            try {
              const screenshotBuffer = await page.screenshot({ type: 'png' });
              screenshot1Base64 = screenshotBuffer.toString('base64');
              console.log('[CreateAppointment] ✓ Screenshot captured for appointment 1');
            } catch (e) {
              console.log('[CreateAppointment] Could not capture screenshot:', e);
            }

            // Update series data
            if (seriesData) {
              seriesData.firstAppointment.screenshot = screenshot1Base64;
              seriesData.firstAppointment.createdAt = new Date().toISOString();
            }

            await saveAppointment(page);

            // Save partial series data in case browser closes before second appointment
            if (seriesData) {
              await updateClientRecordWithSeriesData(clientId, seriesData);
            }

            // Transition to second appointment
            console.log('[CreateAppointment] SERIES: Transitioning to appointment 2...');

            // Reset confirmation flag
            await page.evaluate(() => {
              (window as unknown as Record<string, boolean>)['confirmationReceived'] = false;
              (window as unknown as Record<string, string>)['appointmentState'] = 'series_transition';
            });

            // Wait for save to complete
            await page.waitForTimeout(2000);

            // Navigate directly to appointment form for second appointment (1 week later)
            const secondDate = calculateSecondAppointmentDate(appointmentInfo.startDate);
            console.log('[CreateAppointment] SERIES: Navigating directly to appointment form for second appointment...');
            console.log(`[CreateAppointment] SERIES: Second appointment date: ${secondDate}`);

            const formOpened = await navigateToAppointmentForm(page, client.simplePracticeId!, secondDate);

            if (!formOpened) {
              console.log('[CreateAppointment] SERIES: Failed to navigate to appointment form for second appointment');
              await injectErrorPopup(page, 'Failed to open appointment form for second appointment. Please try again.', true);
              continue;
            }

            console.log('[CreateAppointment] SERIES: ✓ Appointment form opened for second appointment');

            // Proceed to fill second appointment
            await page.evaluate(() => {
              (window as unknown as Record<string, string>)['appointmentState'] = 'series_second_filling';
            });

          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('[CreateAppointment] Error saving series appointment 1:', errorMessage);
            await injectErrorPopup(page, `Failed to save appointment 1: ${errorMessage}`, true);
          }
          continue;
        }

        // Series: Transition state (between appointments)
        if (flags.appointmentState === 'series_transition') {
          // Waiting for navigation to complete
          await page.waitForTimeout(500);
          continue;
        }

        // Series: Fill second appointment (90837)
        if (flags.appointmentState === 'series_second_filling') {
          console.log('[CreateAppointment] SERIES: Filling appointment 2 of 2 (90837)...');

          try {
            const secondDate = calculateSecondAppointmentDate(appointmentInfo.startDate);
            const isRecurring = appointment?.recurrence !== 'one-time';

            await fillSeriesAppointmentForm(
              page,
              appointmentInfo,
              '90837',
              secondDate,
              isRecurring,
              2
            );
            console.log('[CreateAppointment] SERIES: Form filled, now showing confirmation popup...');
            await injectSeriesConfirmationPopup(page, appointmentInfo, '90837', 2, secondDate, isRecurring);
            console.log('[CreateAppointment] SERIES: Confirmation popup shown. Waiting for user to click Confirm...');
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('[CreateAppointment] Error filling series appointment 2:', errorMessage);
            await injectErrorPopup(page, `Failed to fill appointment 2: ${errorMessage}`, true);
          }
          // Wait for next iteration - don't fall through to other handlers
          await page.waitForTimeout(500);
          continue;
        }

        // Series: Wait for user confirmation on second appointment
        if (flags.appointmentState === 'series_second_confirming') {
          // Just waiting for user to click Confirm button in the popup
          // The popup's button click handler will change state to 'series_second_saving'
          await page.waitForTimeout(500);
          continue;
        }

        // Series: Save second appointment
        if (flags.appointmentState === 'series_second_saving' && flags.confirmationReceived) {
          console.log('[CreateAppointment] SERIES: Saving appointment 2 of 2...');

          try {
            // Capture screenshot
            let screenshot2Base64 = '';
            try {
              const screenshotBuffer = await page.screenshot({ type: 'png' });
              screenshot2Base64 = screenshotBuffer.toString('base64');
              console.log('[CreateAppointment] ✓ Screenshot captured for appointment 2');
            } catch (e) {
              console.log('[CreateAppointment] Could not capture screenshot:', e);
            }

            await saveAppointment(page);

            // Update series data with second appointment
            const secondDate = calculateSecondAppointmentDate(appointmentInfo.startDate);
            const isRecurring = appointment?.recurrence !== 'one-time';

            if (seriesData) {
              seriesData.isPartial = false;
              seriesData.secondAppointment = {
                serviceCode: '90837',
                date: secondDate,
                time: appointmentInfo.time,
                isRecurring,
                screenshot: screenshot2Base64,
                createdAt: new Date().toISOString(),
              };

              // Save complete series data
              await updateClientRecordWithSeriesData(clientId, seriesData);
            }

            // Show success popup
            await injectSeriesSuccessPopup(page, isRecurring, appointmentInfo.startDate, secondDate);

          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('[CreateAppointment] Error saving series appointment 2:', errorMessage);
            await injectErrorPopup(page, `Failed to save appointment 2: ${errorMessage}`, true);
          }
          continue;
        }

        // Series: Complete state
        if (flags.appointmentState === 'series_complete') {
          // Waiting for user to close browser
          await page.waitForTimeout(500);
          continue;
        }

        // Wait before next poll (200ms for responsive cancel button)
        await new Promise(resolve => setTimeout(resolve, 200));

        // Check if browser was closed externally
        if (!browser.isConnected()) {
          console.log('[CreateAppointment] Browser disconnected');
          if (urlPollInterval) clearInterval(urlPollInterval);
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

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Opens the appointment dialog using the "+" button in the navbar.
 * This is more reliable than clicking "Schedule appointment" link which isn't always visible.
 * @returns true if dialog opened successfully, false otherwise
 */
/**
 * Navigates directly to the Simple Practice appointment form using a direct URL.
 * This bypasses all UI clicking and is more reliable.
 * @param page - Playwright page instance
 * @param simplePracticeId - The client's Simple Practice ID
 * @param dateString - Date in YYYY-MM-DD format
 * @returns true if navigation succeeded, false otherwise
 */
async function navigateToAppointmentForm(page: Page, simplePracticeId: string, dateString: string): Promise<boolean> {
  console.log('[CreateAppointment] Navigating directly to appointment form...');
  console.log(`[CreateAppointment] Client SP ID: ${simplePracticeId}, Date: ${dateString}`);

  const appointmentUrl = `https://secure.simplepractice.com/calendar/appointments/new?clientId=${simplePracticeId}&currentDate=${dateString}`;

  try {
    await page.goto(appointmentUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500);
    console.log('[CreateAppointment] ✓ Navigated to appointment form');
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log('[CreateAppointment] ✗ Failed to navigate to appointment form:', errorMessage);
    return false;
  }
}

async function injectLoginPrompt(page: Page) {
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
}

async function injectServiceCodePopup(page: Page, info: AppointmentInfo) {
  await page.evaluate((appointmentInfo) => {
    const existing = document.getElementById('puppeteer-info-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'puppeteer-info-panel';
    panel.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      z-index: 999999;
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      border-radius: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 420px;
      box-shadow: 0 20px 60px rgba(59, 130, 246, 0.4);
      cursor: move;
      user-select: none;
    `;

    // Drag functionality
    let isDragging = false;
    let initialX = 0;
    let initialY = 0;

    panel.addEventListener('mousedown', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'BUTTON' && target.tagName !== 'INPUT' && target.tagName !== 'LABEL') {
        isDragging = true;
        initialX = e.clientX - panel.offsetLeft;
        initialY = e.clientY - panel.offsetTop;
        panel.style.cursor = 'grabbing';
      }
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
        panel.style.left = (e.clientX - initialX) + 'px';
        panel.style.top = (e.clientY - initialY) + 'px';
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      panel.style.cursor = 'move';
    });

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      background: rgba(255, 255, 255, 0.15);
      padding: 16px 20px;
      border-radius: 16px 16px 0 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    `;

    const titleContainer = document.createElement('div');
    titleContainer.style.cssText = 'display: flex; align-items: center; gap: 8px;';

    const emoji = document.createElement('span');
    emoji.textContent = '📅';
    emoji.style.fontSize = '18px';
    titleContainer.appendChild(emoji);

    const titleText = document.createElement('span');
    titleText.textContent = 'Select Service Code';
    titleText.style.cssText = 'font-weight: 700; color: white; font-size: 16px;';
    titleContainer.appendChild(titleText);

    header.appendChild(titleContainer);

    const dragHint = document.createElement('div');
    dragHint.textContent = '⋮⋮';
    dragHint.style.cssText = 'font-size: 20px; color: rgba(255, 255, 255, 0.6);';
    header.appendChild(dragHint);
    panel.appendChild(header);

    // Content
    const content = document.createElement('div');
    content.style.cssText = 'padding: 20px; background: white; border-radius: 0 0 16px 16px;';

    // Client info box
    const clientBox = document.createElement('div');
    clientBox.style.cssText = `
      background: #f0f9ff;
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 20px;
      border-left: 3px solid #3b82f6;
    `;

    const clientName = document.createElement('div');
    clientName.textContent = appointmentInfo.clientName;
    clientName.style.cssText = 'font-weight: 700; color: #1e40af; margin-bottom: 8px;';
    clientBox.appendChild(clientName);

    const clientDetails = document.createElement('div');
    clientDetails.style.cssText = 'font-size: 13px; color: #3b82f6;';
    clientDetails.appendChild(document.createTextNode(appointmentInfo.day + ' at ' + appointmentInfo.time));
    clientDetails.appendChild(document.createElement('br'));
    clientDetails.appendChild(document.createTextNode('Clinician: ' + appointmentInfo.clinician));
    if (appointmentInfo.startDateFormatted) {
      clientDetails.appendChild(document.createElement('br'));
      clientDetails.appendChild(document.createTextNode('Starting: ' + appointmentInfo.startDateFormatted));
    }
    clientBox.appendChild(clientDetails);
    content.appendChild(clientBox);

    // Create Appointment Series button (above the individual options)
    const seriesBtn = document.createElement('button');
    seriesBtn.id = 'create-series-btn';
    seriesBtn.textContent = 'Create Appointment Series';
    seriesBtn.style.cssText = `
      width: 100%;
      padding: 16px;
      margin-bottom: 12px;
      background: linear-gradient(135deg, #8b5cf6, #7c3aed);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
      transition: all 0.2s;
    `;
    seriesBtn.addEventListener('mouseenter', () => {
      seriesBtn.style.transform = 'translateY(-2px)';
      seriesBtn.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.4)';
    });
    seriesBtn.addEventListener('mouseleave', () => {
      seriesBtn.style.transform = 'translateY(0)';
      seriesBtn.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)';
    });
    seriesBtn.addEventListener('click', () => {
      (window as unknown as Record<string, string>)['appointmentState'] = 'series_first_filling';
      (window as unknown as Record<string, string | null>)['selectedServiceCode'] = 'series';
    });
    content.appendChild(seriesBtn);

    // Series description
    const seriesDesc = document.createElement('div');
    seriesDesc.textContent = 'Creates 90791 (today) + 90837 (next week)';
    seriesDesc.style.cssText = 'font-size: 12px; text-align: center; color: #6b7280; margin-bottom: 20px;';
    content.appendChild(seriesDesc);

    // Divider
    const divider = document.createElement('div');
    divider.style.cssText = 'border-top: 1px solid #e5e7eb; margin-bottom: 16px;';
    content.appendChild(divider);

    // Service code label
    const codeLabel = document.createElement('div');
    codeLabel.textContent = 'Or choose a single appointment:';
    codeLabel.style.cssText = 'font-weight: 600; color: #374151; margin-bottom: 12px;';
    content.appendChild(codeLabel);

    // Service code options
    const codes = [
      { value: '90837', label: '90837 - Psychotherapy, 53-60 min', description: 'Standard individual therapy session' },
      { value: '90791', label: '90791 - Psychiatric Diagnostic Evaluation', description: 'Initial intake/assessment session' }
    ];

    const optionsContainer = document.createElement('div');
    optionsContainer.style.cssText = 'margin-bottom: 20px;';

    codes.forEach((code) => {
      const wrapper = document.createElement('div');
      wrapper.id = 'service-option-' + code.value;
      wrapper.style.cssText = `
        padding: 16px;
        margin-bottom: 12px;
        border: 2px solid #e5e7eb;
        border-radius: 10px;
        cursor: pointer;
        background: white;
        transition: all 0.2s;
      `;

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'serviceCode';
      radio.value = code.value;
      radio.id = 'service-' + code.value;
      radio.style.cssText = 'margin-right: 12px; transform: scale(1.2);';

      const labelContainer = document.createElement('div');
      labelContainer.style.cssText = 'display: inline-block; vertical-align: middle;';

      const label = document.createElement('label');
      label.htmlFor = 'service-' + code.value;
      label.textContent = code.label;
      label.style.cssText = 'font-weight: 600; color: #111827; cursor: pointer; display: block;';

      const desc = document.createElement('div');
      desc.textContent = code.description;
      desc.style.cssText = 'font-size: 12px; color: #6b7280; margin-top: 2px;';

      labelContainer.appendChild(label);
      labelContainer.appendChild(desc);

      wrapper.appendChild(radio);
      wrapper.appendChild(labelContainer);

      wrapper.addEventListener('click', () => {
        // Update all options styling
        document.querySelectorAll('[id^="service-option-"]').forEach(el => {
          (el as HTMLElement).style.border = '2px solid #e5e7eb';
          (el as HTMLElement).style.background = 'white';
        });

        // Highlight selected
        wrapper.style.border = '2px solid #3b82f6';
        wrapper.style.background = '#eff6ff';
        radio.checked = true;

        // Store selection
        (window as unknown as Record<string, string | null>)['selectedServiceCode'] = code.value;

        // Enable button
        const btn = document.getElementById('fill-form-btn');
        if (btn) {
          (btn as HTMLButtonElement).disabled = false;
          btn.style.opacity = '1';
          btn.style.cursor = 'pointer';
        }
      });

      optionsContainer.appendChild(wrapper);
    });

    content.appendChild(optionsContainer);

    // Fill Form button (disabled by default)
    const fillBtn = document.createElement('button');
    fillBtn.id = 'fill-form-btn';
    fillBtn.textContent = 'Fill Appointment Form';
    fillBtn.disabled = true;
    fillBtn.style.cssText = `
      width: 100%;
      padding: 14px 24px;
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      cursor: not-allowed;
      opacity: 0.5;
      transition: all 0.2s;
    `;
    fillBtn.addEventListener('click', () => {
      if (!(fillBtn as HTMLButtonElement).disabled) {
        (window as unknown as Record<string, string>)['appointmentState'] = 'filling_form';
      }
    });
    content.appendChild(fillBtn);

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
      width: 100%;
      padding: 12px;
      background: transparent;
      color: #6b7280;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      margin-top: 10px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    `;
    cancelBtn.addEventListener('mouseenter', () => {
      cancelBtn.style.background = '#f3f4f6';
    });
    cancelBtn.addEventListener('mouseleave', () => {
      cancelBtn.style.background = 'transparent';
    });
    cancelBtn.addEventListener('click', () => {
      (window as unknown as Record<string, boolean>)['closeRequested'] = true;
    });
    content.appendChild(cancelBtn);

    panel.appendChild(content);
    document.body.appendChild(panel);

    // Initialize state
    (window as unknown as Record<string, string>)['appointmentState'] = 'selecting_service';
    (window as unknown as Record<string, string | null>)['selectedServiceCode'] = null;
    (window as unknown as Record<string, boolean>)['confirmationReceived'] = false;
    (window as unknown as Record<string, boolean>)['closeRequested'] = false;

  }, info);
}

async function fillAppointmentForm(page: Page, info: AppointmentInfo, serviceCode: string) {
  console.log('[CreateAppointment] ========================================');
  console.log('[CreateAppointment] Starting form fill with label-based discovery');
  console.log('[CreateAppointment] Target date:', info.startDate);
  console.log('[CreateAppointment] Target time:', info.time);
  console.log('[CreateAppointment] Target clinician:', info.clinician);
  console.log('[CreateAppointment] Target service code:', serviceCode);
  console.log('[CreateAppointment] ========================================');

  // Move popup to bottom-right corner so it doesn't block form interactions
  await page.evaluate(() => {
    const panel = document.getElementById('puppeteer-info-panel');
    if (panel) {
      panel.style.top = 'auto';
      panel.style.left = 'auto';
      panel.style.bottom = '20px';
      panel.style.right = '20px';
      panel.style.maxWidth = '300px';

      const content = panel.querySelector('div:last-child');
      if (content) {
        while (content.firstChild) {
          content.removeChild(content.firstChild);
        }

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'padding: 20px; text-align: center;';

        const icon = document.createElement('div');
        icon.textContent = '⏳';
        icon.style.cssText = 'font-size: 32px; margin-bottom: 12px;';
        wrapper.appendChild(icon);

        const title = document.createElement('div');
        title.textContent = 'Filling Appointment Form...';
        title.style.cssText = 'font-weight: 600; color: #374151; margin-bottom: 6px; font-size: 14px;';
        wrapper.appendChild(title);

        const subtitle = document.createElement('div');
        subtitle.textContent = 'Please wait...';
        subtitle.style.cssText = 'font-size: 12px; color: #6b7280;';
        wrapper.appendChild(subtitle);

        content.appendChild(wrapper);
      }
    }
  });

  await page.waitForTimeout(500);

  // Step 1: Dismiss any open dropdowns/backdrops first
  console.log('[CreateAppointment] Step 1: Dismissing any open dropdowns...');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Take before screenshot for debugging
  try {
    await page.screenshot({ path: '/tmp/sp-form-before.png' });
    console.log('[CreateAppointment] Screenshot saved: /tmp/sp-form-before.png');
  } catch (e) {
    console.log('[CreateAppointment] Could not save screenshot:', e);
  }

  // Helper: Calculate end time (start + 53 minutes)
  const calculateEndTime = (startTime: string): string => {
    const match = startTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return startTime;

    let hours = parseInt(match[1]);
    let minutes = parseInt(match[2]);
    const period = match[3].toUpperCase();

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    minutes += 53;
    if (minutes >= 60) {
      hours += Math.floor(minutes / 60);
      minutes = minutes % 60;
    }

    let endPeriod = 'AM';
    if (hours >= 12) {
      endPeriod = 'PM';
      if (hours > 12) hours -= 12;
    }
    if (hours === 0) hours = 12;

    return `${hours}:${String(minutes).padStart(2, '0')} ${endPeriod}`;
  };

  const endTime = calculateEndTime(info.time);
  console.log('[CreateAppointment] Calculated end time:', endTime);

  // Format the target date
  const targetDate = new Date(info.startDate + 'T12:00:00');
  const formattedDate = `${String(targetDate.getMonth() + 1).padStart(2, '0')}/${String(targetDate.getDate()).padStart(2, '0')}/${targetDate.getFullYear()}`;
  console.log('[CreateAppointment] Formatted date:', formattedDate);

  // ============================================
  // Step 2: Find and fill DATE using label discovery
  // ============================================
  console.log('[CreateAppointment] Step 2: Setting date...');
  let dateSet = false;

  try {
    // Strategy A: Find by "Appointment details" heading and get the first date-like input after it
    const appointmentDetailsText = await page.getByText('Appointment details').first().isVisible().catch(() => false);
    console.log('[CreateAppointment] "Appointment details" heading visible:', appointmentDetailsText);

    // Strategy B: Find all inputs, filter by those with date values on right side of screen
    const allInputs = await page.locator('input').all();
    console.log('[CreateAppointment] Total inputs found:', allInputs.length);

    for (const input of allInputs) {
      try {
        const value = await input.inputValue().catch(() => '');
        const box = await input.boundingBox().catch(() => null);

        // Must be on right side (x > 500) and have a date-like value
        if (box && box.x > 500 && value.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) {
          console.log(`[CreateAppointment] Found date input with value "${value}" at x=${Math.round(box.x)}, y=${Math.round(box.y)}`);

          // Triple-click to select all, then type the new date
          await input.click({ clickCount: 3, force: true });
          await page.waitForTimeout(100);
          await page.keyboard.type(formattedDate, { delay: 50 });
          await page.waitForTimeout(100);
          await page.keyboard.press('Escape'); // Close any calendar popup
          await page.keyboard.press('Tab');
          dateSet = true;
          console.log(`[CreateAppointment] ✓ Date set to ${formattedDate}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!dateSet) {
      console.log('[CreateAppointment] ✗ Could not find date input');
    }
  } catch (e) {
    console.log('[CreateAppointment] Date field error:', e);
  }

  await page.waitForTimeout(400);

  // ============================================
  // Step 3: Find and fill TIME inputs
  // ============================================
  console.log('[CreateAppointment] Step 3: Setting times...');
  let startTimeSet = false;
  let endTimeSet = false;

  try {
    const allInputs = await page.locator('input').all();
    const timeInputsFound: { element: typeof allInputs[0]; x: number; y: number }[] = [];

    for (const input of allInputs) {
      try {
        const value = await input.inputValue().catch(() => '');
        const box = await input.boundingBox().catch(() => null);

        // Must be on right side and have a time-like value
        if (box && box.x > 500 && value.match(/\d{1,2}:\d{2}\s*(AM|PM)/i)) {
          console.log(`[CreateAppointment] Found time input with value "${value}" at x=${Math.round(box.x)}, y=${Math.round(box.y)}`);
          timeInputsFound.push({ element: input, x: box.x, y: box.y });
        }
      } catch (e) {
        continue;
      }
    }

    // Sort by x position (leftmost first = start time)
    timeInputsFound.sort((a, b) => a.x - b.x);
    console.log(`[CreateAppointment] Found ${timeInputsFound.length} time inputs`);

    if (timeInputsFound.length >= 1) {
      // Fill start time
      await timeInputsFound[0].element.click({ clickCount: 3, force: true });
      await page.waitForTimeout(100);
      await page.keyboard.type(info.time, { delay: 50 });
      await page.keyboard.press('Tab');
      startTimeSet = true;
      console.log(`[CreateAppointment] ✓ Start time set to ${info.time}`);
    }

    if (timeInputsFound.length >= 2) {
      await page.waitForTimeout(200);
      // Fill end time
      await timeInputsFound[1].element.click({ clickCount: 3, force: true });
      await page.waitForTimeout(100);
      await page.keyboard.type(endTime, { delay: 50 });
      await page.keyboard.press('Tab');
      endTimeSet = true;
      console.log(`[CreateAppointment] ✓ End time set to ${endTime}`);
    }

    if (!startTimeSet) {
      console.log('[CreateAppointment] ✗ Could not find start time input');
    }
    if (!endTimeSet && timeInputsFound.length < 2) {
      console.log('[CreateAppointment] ✗ Could not find end time input (only 1 time input found)');
    }
  } catch (e) {
    console.log('[CreateAppointment] Time field error:', e);
  }

  await page.waitForTimeout(400);

  // Note: Clinician selection skipped - user will select manually if needed

  // ============================================
  // Step 4: Select SERVICE CODE using native <select>
  // ============================================
  console.log('[CreateAppointment] Step 4: Setting service code...');
  let serviceSet = false;
  const targetServiceCode = serviceCode;

  try {
    // Service dropdown is a native <select name="code"> element
    const serviceSelect = page.locator('select[name="code"]');

    if (await serviceSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('[CreateAppointment] Found service <select> by name="code"');

      // Get all options to find the right one
      const options = await serviceSelect.locator('option').all();
      let optionValue: string | null = null;

      for (const option of options) {
        const optionText = await option.textContent().catch(() => '');
        if (optionText?.includes(targetServiceCode)) {
          optionValue = await option.getAttribute('value');
          console.log(`[CreateAppointment] Found matching option: "${optionText?.substring(0, 60)}" with value="${optionValue}"`);
          break;
        }
      }

      if (optionValue) {
        await serviceSelect.selectOption(optionValue);
        serviceSet = true;
        console.log(`[CreateAppointment] ✓ Service code selected: ${targetServiceCode}`);
      } else {
        // Fallback: try selecting by value directly
        await serviceSelect.selectOption(targetServiceCode);
        serviceSet = true;
        console.log(`[CreateAppointment] ✓ Service code selected by value: ${targetServiceCode}`);
      }
    } else {
      // Fallback: try aria-label selector
      console.log('[CreateAppointment] Trying aria-label="Services" selector...');
      const serviceSelectAlt = page.locator('select[aria-label="Services"]');

      if (await serviceSelectAlt.isVisible({ timeout: 1000 }).catch(() => false)) {
        await serviceSelectAlt.selectOption(targetServiceCode);
        serviceSet = true;
        console.log(`[CreateAppointment] ✓ Service code selected via aria-label: ${targetServiceCode}`);
      }
    }

    if (!serviceSet) {
      console.log('[CreateAppointment] ✗ Could not find service dropdown');
      console.log('[CreateAppointment] User may need to select service code manually');
    }
  } catch (e) {
    console.log('[CreateAppointment] Service code field error:', e);
  }

  await page.waitForTimeout(400);
  await page.keyboard.press('Escape'); // Close any open dropdown

  // ============================================
  // Step 5: Fill MODIFIER CODE "95" (Telehealth)
  // ============================================
  console.log('[CreateAppointment] Step 5: Setting modifier code...');
  let modifierSet = false;

  try {
    // Wait for modifier input to appear after service code selection
    await page.waitForTimeout(500);

    // The modifier input name includes the service code: input[name="modifierOne-{serviceCode}"]
    const modifierSelectors = [
      `input[name="modifierOne-${serviceCode}"]`,
      'input[aria-label="Modifier one"]',
      'input.modifier:first-of-type',
      'input[placeholder="AA"]:first-of-type',
    ];

    for (const selector of modifierSelectors) {
      try {
        const modifierInput = page.locator(selector).first();
        if (await modifierInput.isVisible({ timeout: 2000 })) {
          await modifierInput.click();
          await modifierInput.fill('95');
          modifierSet = true;
          console.log(`[CreateAppointment] ✓ Modifier code set to 95 (Telehealth) using selector: ${selector}`);
          break;
        }
      } catch {
        // Try next selector
      }
    }

    if (!modifierSet) {
      console.log('[CreateAppointment] ✗ Could not find modifier input - user may need to enter manually');
    }
  } catch (e) {
    console.log('[CreateAppointment] Modifier code field error:', e);
  }

  await page.waitForTimeout(300);

  // Take after screenshot for verification
  try {
    await page.screenshot({ path: '/tmp/sp-form-after.png' });
    console.log('[CreateAppointment] Screenshot saved: /tmp/sp-form-after.png');
  } catch (e) {
    console.log('[CreateAppointment] Could not save screenshot:', e);
  }

  console.log('[CreateAppointment] ========================================');
  console.log('[CreateAppointment] Form filling complete');
  console.log('[CreateAppointment] Date set:', dateSet);
  console.log('[CreateAppointment] Start time set:', startTimeSet);
  console.log('[CreateAppointment] End time set:', endTimeSet);
  console.log('[CreateAppointment] Service set:', serviceSet);
  console.log('[CreateAppointment] Modifier set:', modifierSet);
  console.log('[CreateAppointment] Note: Clinician must be selected manually');
  console.log('[CreateAppointment] ========================================');
}

async function injectConfirmationPopup(page: Page, info: AppointmentInfo, serviceCode: string) {
  const serviceLabel = serviceCode === '90837'
    ? '90837 - Psychotherapy, 53-60 min'
    : '90791 - Psychiatric Diagnostic Evaluation';

  await page.evaluate(({ appointmentInfo, serviceLabel }) => {
    const existing = document.getElementById('puppeteer-info-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'puppeteer-info-panel';
    panel.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      z-index: 999999;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 420px;
      box-shadow: 0 20px 60px rgba(16, 185, 129, 0.4);
      cursor: move;
    `;

    // Drag functionality
    let isDragging = false;
    let initialX = 0;
    let initialY = 0;

    panel.addEventListener('mousedown', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'BUTTON') {
        isDragging = true;
        initialX = e.clientX - panel.offsetLeft;
        initialY = e.clientY - panel.offsetTop;
      }
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
        panel.style.left = (e.clientX - initialX) + 'px';
        panel.style.top = (e.clientY - initialY) + 'px';
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 16px 20px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 16px 16px 0 0;
    `;

    const headerTitle = document.createElement('div');
    headerTitle.textContent = '✓ Appointment Details Filled';
    headerTitle.style.cssText = 'font-size: 18px; font-weight: 700; color: white;';
    header.appendChild(headerTitle);

    const headerSubtitle = document.createElement('div');
    headerSubtitle.textContent = 'Please review the form and confirm';
    headerSubtitle.style.cssText = 'font-size: 12px; color: rgba(255, 255, 255, 0.9); margin-top: 4px;';
    header.appendChild(headerSubtitle);

    panel.appendChild(header);

    // Content
    const content = document.createElement('div');
    content.style.cssText = 'padding: 20px; background: white; border-radius: 0 0 16px 16px;';

    // Summary box
    const summary = document.createElement('div');
    summary.style.cssText = `
      padding: 16px;
      background: #f0fdf4;
      border-radius: 10px;
      border-left: 3px solid #10b981;
      margin-bottom: 16px;
    `;

    const summaryTitle = document.createElement('div');
    summaryTitle.textContent = 'Filled Details:';
    summaryTitle.style.cssText = 'font-weight: 600; color: #065f46; margin-bottom: 10px;';
    summary.appendChild(summaryTitle);

    const summaryDetails = document.createElement('div');
    summaryDetails.style.cssText = 'font-size: 14px; color: #047857; line-height: 1.6;';
    summaryDetails.appendChild(document.createTextNode('📅 ' + (appointmentInfo.startDateFormatted || appointmentInfo.startDate)));
    summaryDetails.appendChild(document.createElement('br'));
    summaryDetails.appendChild(document.createTextNode('🕐 ' + appointmentInfo.time));
    summaryDetails.appendChild(document.createElement('br'));
    summaryDetails.appendChild(document.createTextNode('👨‍⚕️ ' + appointmentInfo.clinician));
    summaryDetails.appendChild(document.createElement('br'));
    summaryDetails.appendChild(document.createTextNode('📋 ' + serviceLabel));
    summaryDetails.appendChild(document.createElement('br'));
    summaryDetails.appendChild(document.createTextNode('📡 Modifier: 95 (Telehealth)'));
    summary.appendChild(summaryDetails);

    content.appendChild(summary);

    // Instructions
    const instructions = document.createElement('div');
    instructions.style.cssText = `
      font-size: 13px;
      color: #6b7280;
      margin-bottom: 16px;
      padding: 12px;
      background: #f9fafb;
      border-radius: 8px;
    `;
    instructions.textContent = 'Review the form in Simple Practice. You can make any edits before confirming.';
    content.appendChild(instructions);

    // Confirm button
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Details Confirmed - Save Appointment';
    confirmBtn.style.cssText = `
      width: 100%;
      padding: 14px 24px;
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
      transition: all 0.2s;
    `;
    confirmBtn.addEventListener('mouseenter', () => {
      confirmBtn.style.transform = 'translateY(-1px)';
      confirmBtn.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)';
    });
    confirmBtn.addEventListener('mouseleave', () => {
      confirmBtn.style.transform = 'translateY(0)';
      confirmBtn.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
    });
    confirmBtn.addEventListener('click', () => {
      (window as unknown as Record<string, boolean>)['confirmationReceived'] = true;
      (window as unknown as Record<string, string>)['appointmentState'] = 'saving';
    });
    content.appendChild(confirmBtn);

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel & Close Browser';
    cancelBtn.style.cssText = `
      width: 100%;
      padding: 12px;
      background: transparent;
      color: #6b7280;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      margin-top: 10px;
      cursor: pointer;
      transition: all 0.2s;
    `;
    cancelBtn.addEventListener('click', () => {
      (window as unknown as Record<string, boolean>)['closeRequested'] = true;
    });
    content.appendChild(cancelBtn);

    panel.appendChild(content);
    document.body.appendChild(panel);

    (window as unknown as Record<string, string>)['appointmentState'] = 'awaiting_confirmation';
  }, { appointmentInfo: info, serviceLabel });
}

async function saveAppointment(page: Page) {
  console.log('[CreateAppointment] Clicking Save button...');

  // Update popup to show saving state
  await page.evaluate(() => {
    const panel = document.getElementById('puppeteer-info-panel');
    if (panel) {
      const btn = panel.querySelector('button');
      if (btn) {
        btn.textContent = 'Saving...';
        (btn as HTMLButtonElement).disabled = true;
        btn.style.opacity = '0.7';
      }
    }
  });

  // Find and click Save button
  const saveSelectors = [
    'button:has-text("Save")',
    'button[type="submit"]:has-text("Save")',
    '[data-testid="save-button"]',
    '.btn-primary:has-text("Save")',
    'button.save-btn',
  ];

  let saved = false;
  for (const selector of saveSelectors) {
    try {
      const saveButton = page.locator(selector).first();
      if (await saveButton.isVisible({ timeout: 2000 })) {
        await saveButton.click();
        saved = true;
        console.log('[CreateAppointment] ✓ Clicked Save button');
        break;
      }
    } catch {
      // Try next selector
    }
  }

  if (!saved) {
    console.log('[CreateAppointment] Could not find Save button automatically');
  }

  // Wait for save to complete
  await page.waitForTimeout(3000);
}

async function updateClientRecord(clientId: string, serviceCode?: string, screenshotBase64?: string, modifierCode?: string) {
  console.log('[CreateAppointment] Updating client record...');

  // Get current progress
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
    } catch {
      // Use default
    }
  }

  // Update progress
  progress.appointmentCreated = true;
  const progressWithTimestamp = {
    ...progress,
    appointmentCreatedAt: new Date().toISOString(),
  };

  // Update client with service code, modifier code, progress, and optional screenshot
  await prisma.client.update({
    where: { id: clientId },
    data: {
      serviceCode: serviceCode || null,
      modifierCode: modifierCode || '95', // Default to '95' (Telehealth) for all appointments
      appointmentScreenshot: screenshotBase64 || null,
      schedulingProgress: JSON.stringify(progressWithTimestamp),
    }
  });

  console.log('[CreateAppointment] ✓ Client record updated');
  console.log('[CreateAppointment] ✓ Modifier code saved: ' + (modifierCode || '95'));
  if (screenshotBase64) {
    console.log('[CreateAppointment] ✓ Screenshot saved to database');
  }
}

async function injectSuccessPopup(page: Page, serviceCode: string) {
  const serviceLabel = serviceCode === '90837'
    ? '90837 - Psychotherapy'
    : '90791 - Psychiatric Diagnostic Evaluation';

  await page.evaluate((label) => {
    const existing = document.getElementById('puppeteer-info-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'puppeteer-info-panel';
    panel.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      z-index: 999999;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 380px;
      box-shadow: 0 20px 60px rgba(16, 185, 129, 0.4);
    `;

    const content = document.createElement('div');
    content.style.cssText = 'padding: 32px; text-align: center;';

    // Success icon with animation
    const icon = document.createElement('div');
    icon.textContent = '✅';
    icon.style.cssText = `
      font-size: 56px;
      margin-bottom: 16px;
      animation: bounce 0.5s ease;
    `;
    content.appendChild(icon);

    // Add animation keyframes
    const style = document.createElement('style');
    style.textContent = '@keyframes bounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.2); } }';
    document.head.appendChild(style);

    // Success message
    const title = document.createElement('div');
    title.textContent = 'Appointment Created!';
    title.style.cssText = 'font-size: 22px; font-weight: 700; color: white; margin-bottom: 8px;';
    content.appendChild(title);

    // Service code
    const codeText = document.createElement('div');
    codeText.textContent = label;
    codeText.style.cssText = 'font-size: 14px; color: rgba(255, 255, 255, 0.9); margin-bottom: 24px;';
    content.appendChild(codeText);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close Browser & Return to App';
    closeBtn.style.cssText = `
      padding: 14px 32px;
      background: white;
      color: #059669;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    `;
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.transform = 'translateY(-2px)';
      closeBtn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.transform = 'translateY(0)';
      closeBtn.style.boxShadow = 'none';
    });
    closeBtn.addEventListener('click', () => {
      (window as unknown as Record<string, boolean>)['closeRequested'] = true;
    });
    content.appendChild(closeBtn);

    panel.appendChild(content);
    document.body.appendChild(panel);

    (window as unknown as Record<string, string>)['appointmentState'] = 'complete';
  }, serviceLabel);
}

async function injectErrorPopup(page: Page, errorMessage: string, showRetry: boolean = true) {
  await page.evaluate(({ message, showRetry }) => {
    const existing = document.getElementById('puppeteer-info-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'puppeteer-info-panel';
    panel.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      z-index: 999999;
      background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
      border-radius: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 400px;
      box-shadow: 0 20px 60px rgba(239, 68, 68, 0.4);
    `;

    const content = document.createElement('div');
    content.style.cssText = 'padding: 24px; text-align: center;';

    const icon = document.createElement('div');
    icon.textContent = '⚠️';
    icon.style.cssText = 'font-size: 48px; margin-bottom: 16px;';
    content.appendChild(icon);

    const title = document.createElement('div');
    title.textContent = 'Something went wrong';
    title.style.cssText = 'font-size: 18px; font-weight: 700; color: white; margin-bottom: 8px;';
    content.appendChild(title);

    const msg = document.createElement('div');
    msg.textContent = message;
    msg.style.cssText = 'font-size: 13px; color: rgba(255, 255, 255, 0.9); margin-bottom: 20px; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px;';
    content.appendChild(msg);

    if (showRetry) {
      const retryBtn = document.createElement('button');
      retryBtn.textContent = 'Try Again';
      retryBtn.style.cssText = `
        padding: 12px 24px;
        background: white;
        color: #dc2626;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        margin-right: 10px;
      `;
      retryBtn.addEventListener('click', () => {
        (window as unknown as Record<string, string>)['appointmentState'] = 'selecting_service';
        location.reload();
      });
      content.appendChild(retryBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close Browser';
    closeBtn.style.cssText = `
      padding: 12px 24px;
      background: transparent;
      color: white;
      border: 1px solid rgba(255,255,255,0.5);
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
    `;
    closeBtn.addEventListener('click', () => {
      (window as unknown as Record<string, boolean>)['closeRequested'] = true;
    });
    content.appendChild(closeBtn);

    panel.appendChild(content);
    document.body.appendChild(panel);

    (window as unknown as Record<string, string>)['appointmentState'] = 'error';
    (window as unknown as Record<string, string | null>)['errorMessage'] = message;
  }, { message: errorMessage, showRetry });
}

// ============================================
// SERIES WORKFLOW HELPER FUNCTIONS
// ============================================

function calculateSecondAppointmentDate(firstDate: string): string {
  const date = new Date(firstDate + 'T12:00:00');
  date.setDate(date.getDate() + 7);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
}

function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

async function fillSeriesAppointmentForm(
  page: Page,
  info: AppointmentInfo,
  serviceCode: '90791' | '90837',
  targetDate: string,
  isRecurring: boolean,
  appointmentNumber: 1 | 2
) {
  console.log('[CreateAppointment] ========================================');
  console.log(`[CreateAppointment] SERIES: Filling appointment ${appointmentNumber} of 2`);
  console.log('[CreateAppointment] Target date:', targetDate);
  console.log('[CreateAppointment] Target time:', info.time);
  console.log('[CreateAppointment] Service code:', serviceCode);
  console.log('[CreateAppointment] Is recurring:', isRecurring);
  console.log('[CreateAppointment] ========================================');

  // Move popup to bottom-right corner
  await page.evaluate((apptNum) => {
    const panel = document.getElementById('puppeteer-info-panel');
    if (panel) {
      panel.style.top = 'auto';
      panel.style.left = 'auto';
      panel.style.bottom = '20px';
      panel.style.right = '20px';
      panel.style.maxWidth = '300px';

      const content = panel.querySelector('div:last-child');
      if (content) {
        while (content.firstChild) {
          content.removeChild(content.firstChild);
        }

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'padding: 20px; text-align: center;';

        const icon = document.createElement('div');
        icon.textContent = '⏳';
        icon.style.cssText = 'font-size: 32px; margin-bottom: 12px;';
        wrapper.appendChild(icon);

        const title = document.createElement('div');
        title.textContent = `Filling Appointment ${apptNum} of 2...`;
        title.style.cssText = 'font-weight: 600; color: #374151; margin-bottom: 6px; font-size: 14px;';
        wrapper.appendChild(title);

        const subtitle = document.createElement('div');
        subtitle.textContent = 'Please wait...';
        subtitle.style.cssText = 'font-size: 12px; color: #6b7280;';
        wrapper.appendChild(subtitle);

        content.appendChild(wrapper);
      }
    }
  }, appointmentNumber);

  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  // Calculate end time (start + 53 minutes)
  const calculateEndTime = (startTime: string): string => {
    const match = startTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) return startTime;

    let hours = parseInt(match[1]);
    let minutes = parseInt(match[2]);
    const period = match[3].toUpperCase();

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    minutes += 53;
    if (minutes >= 60) {
      hours += Math.floor(minutes / 60);
      minutes = minutes % 60;
    }

    let endPeriod = 'AM';
    if (hours >= 12) {
      endPeriod = 'PM';
      if (hours > 12) hours -= 12;
    }
    if (hours === 0) hours = 12;

    return `${hours}:${String(minutes).padStart(2, '0')} ${endPeriod}`;
  };

  const endTime = calculateEndTime(info.time);
  const dateObj = new Date(targetDate + 'T12:00:00');
  const formattedDate = `${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')}/${dateObj.getFullYear()}`;

  // Fill DATE
  let dateSet = false;
  try {
    const allInputs = await page.locator('input').all();
    for (const input of allInputs) {
      try {
        const value = await input.inputValue().catch(() => '');
        const box = await input.boundingBox().catch(() => null);
        if (box && box.x > 500 && value.match(/\d{1,2}\/\d{1,2}\/\d{4}/)) {
          await input.click({ clickCount: 3, force: true });
          await page.waitForTimeout(100);
          await page.keyboard.type(formattedDate, { delay: 50 });
          await page.keyboard.press('Escape');
          await page.keyboard.press('Tab');
          dateSet = true;
          console.log(`[CreateAppointment] ✓ Date set to ${formattedDate}`);
          break;
        }
      } catch {
        continue;
      }
    }
  } catch (e) {
    console.log('[CreateAppointment] Date field error:', e);
  }
  await page.waitForTimeout(400);

  // Fill TIME inputs
  let startTimeSet = false;
  let endTimeSet = false;
  try {
    const allInputs = await page.locator('input').all();
    const timeInputsFound: { element: typeof allInputs[0]; x: number; y: number }[] = [];

    for (const input of allInputs) {
      try {
        const value = await input.inputValue().catch(() => '');
        const box = await input.boundingBox().catch(() => null);
        if (box && box.x > 500 && value.match(/\d{1,2}:\d{2}\s*(AM|PM)/i)) {
          timeInputsFound.push({ element: input, x: box.x, y: box.y });
        }
      } catch {
        continue;
      }
    }

    timeInputsFound.sort((a, b) => a.x - b.x);

    if (timeInputsFound.length >= 1) {
      await timeInputsFound[0].element.click({ clickCount: 3, force: true });
      await page.waitForTimeout(100);
      await page.keyboard.type(info.time, { delay: 50 });
      await page.keyboard.press('Tab');
      startTimeSet = true;
      console.log(`[CreateAppointment] ✓ Start time set to ${info.time}`);
    }

    if (timeInputsFound.length >= 2) {
      await page.waitForTimeout(200);
      await timeInputsFound[1].element.click({ clickCount: 3, force: true });
      await page.waitForTimeout(100);
      await page.keyboard.type(endTime, { delay: 50 });
      await page.keyboard.press('Tab');
      endTimeSet = true;
      console.log(`[CreateAppointment] ✓ End time set to ${endTime}`);
    }
  } catch (e) {
    console.log('[CreateAppointment] Time field error:', e);
  }
  await page.waitForTimeout(400);

  // Fill SERVICE CODE
  let serviceSet = false;
  try {
    const serviceSelect = page.locator('select[name="code"]');
    if (await serviceSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      const options = await serviceSelect.locator('option').all();
      let optionValue: string | null = null;

      for (const option of options) {
        const optionText = await option.textContent().catch(() => '');
        if (optionText?.includes(serviceCode)) {
          optionValue = await option.getAttribute('value');
          break;
        }
      }

      if (optionValue) {
        await serviceSelect.selectOption(optionValue);
        serviceSet = true;
        console.log(`[CreateAppointment] ✓ Service code selected: ${serviceCode}`);
      } else {
        await serviceSelect.selectOption(serviceCode);
        serviceSet = true;
      }
    }
  } catch (e) {
    console.log('[CreateAppointment] Service code field error:', e);
  }
  await page.waitForTimeout(400);

  // Fill MODIFIER CODE "95" (Telehealth)
  let modifierSet = false;
  try {
    await page.waitForTimeout(500); // Wait for modifier input to appear after service code selection

    const modifierSelectors = [
      `input[name="modifierOne-${serviceCode}"]`,
      'input[aria-label="Modifier one"]',
      'input.modifier:first-of-type',
      'input[placeholder="AA"]:first-of-type',
    ];

    for (const selector of modifierSelectors) {
      try {
        const modifierInput = page.locator(selector).first();
        if (await modifierInput.isVisible({ timeout: 2000 })) {
          await modifierInput.click();
          await modifierInput.fill('95');
          modifierSet = true;
          console.log(`[CreateAppointment] ✓ Modifier code set to 95 (Telehealth)`);
          break;
        }
      } catch {
        // Try next selector
      }
    }

    if (!modifierSet) {
      console.log('[CreateAppointment] ✗ Could not find modifier input');
    }
  } catch (e) {
    console.log('[CreateAppointment] Modifier code field error:', e);
  }
  await page.waitForTimeout(300);

  // For second appointment only: Handle RECURRING checkbox
  if (appointmentNumber === 2 && isRecurring) {
    console.log('[CreateAppointment] Checking recurring checkbox...');
    try {
      const recurringCheckbox = page.locator('input#recurring-toggle[name="recurringToggle"]');
      if (await recurringCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
        const isChecked = await recurringCheckbox.isChecked().catch(() => false);
        if (!isChecked) {
          await recurringCheckbox.check({ force: true });
          console.log('[CreateAppointment] ✓ Recurring checkbox checked');
        } else {
          console.log('[CreateAppointment] ✓ Recurring checkbox already checked');
        }
      } else {
        // Try alternative selectors
        const altCheckbox = page.locator('input[type="checkbox"][id*="recurring"], input[type="checkbox"][name*="recurring"]').first();
        if (await altCheckbox.isVisible({ timeout: 1000 }).catch(() => false)) {
          const isChecked = await altCheckbox.isChecked().catch(() => false);
          if (!isChecked) {
            await altCheckbox.check({ force: true });
            console.log('[CreateAppointment] ✓ Recurring checkbox checked (alt selector)');
          }
        } else {
          console.log('[CreateAppointment] ✗ Could not find recurring checkbox');
        }
      }
    } catch (e) {
      console.log('[CreateAppointment] Recurring checkbox error:', e);
    }
    await page.waitForTimeout(400);
  }

  await page.keyboard.press('Escape');

  console.log('[CreateAppointment] ========================================');
  console.log(`[CreateAppointment] Appointment ${appointmentNumber} form filling complete`);
  console.log('[CreateAppointment] Date set:', dateSet);
  console.log('[CreateAppointment] Start time set:', startTimeSet);
  console.log('[CreateAppointment] End time set:', endTimeSet);
  console.log('[CreateAppointment] Service set:', serviceSet);
  console.log('[CreateAppointment] Modifier set:', modifierSet);
  console.log('[CreateAppointment] ========================================');
}

async function injectSeriesConfirmationPopup(
  page: Page,
  info: AppointmentInfo,
  serviceCode: '90791' | '90837',
  appointmentNumber: 1 | 2,
  appointmentDate: string,
  isRecurring: boolean
) {
  const serviceLabel = serviceCode === '90837'
    ? '90837 - Psychotherapy, 53-60 min'
    : '90791 - Psychiatric Diagnostic Evaluation';

  const formattedDate = formatDateForDisplay(appointmentDate);

  await page.evaluate(({ info: appointmentInfo, serviceLabel, apptNum, formattedDate, isRecurring }) => {
    const existing = document.getElementById('puppeteer-info-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'puppeteer-info-panel';
    panel.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      z-index: 999999;
      background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
      border-radius: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 420px;
      box-shadow: 0 20px 60px rgba(139, 92, 246, 0.4);
      cursor: move;
    `;

    // Drag functionality
    let isDragging = false;
    let initialX = 0;
    let initialY = 0;

    panel.addEventListener('mousedown', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== 'BUTTON') {
        isDragging = true;
        initialX = e.clientX - panel.offsetLeft;
        initialY = e.clientY - panel.offsetTop;
      }
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
        panel.style.left = (e.clientX - initialX) + 'px';
        panel.style.top = (e.clientY - initialY) + 'px';
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
    });

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 16px 20px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 16px 16px 0 0;
    `;

    const headerTitle = document.createElement('div');
    headerTitle.textContent = `✓ Appointment ${apptNum} of 2 Filled`;
    headerTitle.style.cssText = 'font-size: 18px; font-weight: 700; color: white;';
    header.appendChild(headerTitle);

    const headerSubtitle = document.createElement('div');
    headerSubtitle.textContent = 'Please review and confirm';
    headerSubtitle.style.cssText = 'font-size: 12px; color: rgba(255, 255, 255, 0.9); margin-top: 4px;';
    header.appendChild(headerSubtitle);

    panel.appendChild(header);

    // Content
    const content = document.createElement('div');
    content.style.cssText = 'padding: 20px; background: white; border-radius: 0 0 16px 16px;';

    // Summary box
    const summary = document.createElement('div');
    summary.style.cssText = `
      padding: 16px;
      background: #f5f3ff;
      border-radius: 10px;
      border-left: 3px solid #8b5cf6;
      margin-bottom: 16px;
    `;

    const summaryTitle = document.createElement('div');
    summaryTitle.textContent = `Appointment ${apptNum} Details:`;
    summaryTitle.style.cssText = 'font-weight: 600; color: #5b21b6; margin-bottom: 10px;';
    summary.appendChild(summaryTitle);

    const summaryDetails = document.createElement('div');
    summaryDetails.style.cssText = 'font-size: 14px; color: #6d28d9; line-height: 1.6;';
    summaryDetails.appendChild(document.createTextNode('📅 ' + formattedDate));
    summaryDetails.appendChild(document.createElement('br'));
    summaryDetails.appendChild(document.createTextNode('🕐 ' + appointmentInfo.time));
    summaryDetails.appendChild(document.createElement('br'));
    summaryDetails.appendChild(document.createTextNode('👨‍⚕️ ' + appointmentInfo.clinician));
    summaryDetails.appendChild(document.createElement('br'));
    summaryDetails.appendChild(document.createTextNode('📋 ' + serviceLabel));
    summaryDetails.appendChild(document.createElement('br'));
    summaryDetails.appendChild(document.createTextNode('📡 Modifier: 95 (Telehealth)'));
    if (apptNum === 2 && isRecurring) {
      summaryDetails.appendChild(document.createElement('br'));
      summaryDetails.appendChild(document.createTextNode('🔁 Recurring appointment'));
    }
    summary.appendChild(summaryDetails);
    content.appendChild(summary);

    // Progress indicator
    const progress = document.createElement('div');
    progress.style.cssText = 'display: flex; justify-content: center; gap: 8px; margin-bottom: 16px;';
    for (let i = 1; i <= 2; i++) {
      const dot = document.createElement('div');
      dot.style.cssText = `
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: ${i === apptNum ? '#8b5cf6' : '#e5e7eb'};
      `;
      progress.appendChild(dot);
    }
    content.appendChild(progress);

    // Confirm button
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = apptNum === 1
      ? 'Confirm & Continue to Appointment 2'
      : 'Confirm & Save Appointment';
    confirmBtn.style.cssText = `
      width: 100%;
      padding: 14px 24px;
      background: linear-gradient(135deg, #8b5cf6, #7c3aed);
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
      transition: all 0.2s;
    `;
    confirmBtn.addEventListener('click', () => {
      (window as unknown as Record<string, boolean>)['confirmationReceived'] = true;
      (window as unknown as Record<string, string>)['appointmentState'] = apptNum === 1 ? 'series_first_saving' : 'series_second_saving';
    });
    content.appendChild(confirmBtn);

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel & Close Browser';
    cancelBtn.style.cssText = `
      width: 100%;
      padding: 12px;
      background: transparent;
      color: #6b7280;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      margin-top: 10px;
      cursor: pointer;
    `;
    cancelBtn.addEventListener('click', () => {
      (window as unknown as Record<string, boolean>)['closeRequested'] = true;
    });
    content.appendChild(cancelBtn);

    panel.appendChild(content);
    document.body.appendChild(panel);

    (window as unknown as Record<string, string>)['appointmentState'] = apptNum === 1 ? 'series_first_confirming' : 'series_second_confirming';
  }, { info, serviceLabel, apptNum: appointmentNumber, formattedDate, isRecurring });
}

async function injectSeriesSuccessPopup(page: Page, isRecurring: boolean, firstDate: string, secondDate: string) {
  const firstDateFormatted = formatDateForDisplay(firstDate);
  const secondDateFormatted = formatDateForDisplay(secondDate);

  await page.evaluate(({ isRecurring, firstDateFormatted, secondDateFormatted }) => {
    const existing = document.getElementById('puppeteer-info-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'puppeteer-info-panel';
    panel.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      z-index: 999999;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      border-radius: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 420px;
      box-shadow: 0 20px 60px rgba(16, 185, 129, 0.4);
    `;

    const content = document.createElement('div');
    content.style.cssText = 'padding: 32px; text-align: center;';

    // Success icon
    const icon = document.createElement('div');
    icon.textContent = '✅';
    icon.style.cssText = 'font-size: 56px; margin-bottom: 16px;';
    content.appendChild(icon);

    // Success message
    const title = document.createElement('div');
    title.textContent = 'Both Appointments Created!';
    title.style.cssText = 'font-size: 22px; font-weight: 700; color: white; margin-bottom: 16px;';
    content.appendChild(title);

    // Appointment details
    const details = document.createElement('div');
    details.style.cssText = `
      background: rgba(255, 255, 255, 0.15);
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 24px;
      text-align: left;
    `;

    const appt1 = document.createElement('div');
    appt1.style.cssText = 'margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.2);';
    appt1.innerHTML = `
      <div style="font-weight: 600; color: white; margin-bottom: 4px;">1. 90791 - Psychiatric Diagnostic Evaluation</div>
      <div style="font-size: 13px; color: rgba(255,255,255,0.9);">${firstDateFormatted}</div>
    `;
    details.appendChild(appt1);

    const appt2 = document.createElement('div');
    appt2.innerHTML = `
      <div style="font-weight: 600; color: white; margin-bottom: 4px;">2. 90837 - Psychotherapy${isRecurring ? ' (recurring)' : ''}</div>
      <div style="font-size: 13px; color: rgba(255,255,255,0.9);">${secondDateFormatted}</div>
    `;
    details.appendChild(appt2);

    content.appendChild(details);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close Browser & Return to App';
    closeBtn.style.cssText = `
      padding: 14px 32px;
      background: white;
      color: #059669;
      border: none;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
    `;
    closeBtn.addEventListener('click', () => {
      (window as unknown as Record<string, boolean>)['closeRequested'] = true;
    });
    content.appendChild(closeBtn);

    panel.appendChild(content);
    document.body.appendChild(panel);

    (window as unknown as Record<string, string>)['appointmentState'] = 'series_complete';
  }, { isRecurring, firstDateFormatted, secondDateFormatted });
}

async function updateClientRecordWithSeriesData(
  clientId: string,
  seriesData: SeriesData
) {
  console.log('[CreateAppointment] Updating client record with series data...');

  // Get current progress
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
    } catch {
      // Use default
    }
  }

  // Update progress
  progress.appointmentCreated = true;
  const progressWithTimestamp = {
    ...progress,
    appointmentCreatedAt: new Date().toISOString(),
  };

  // Determine service code display string
  const displayServiceCode = seriesData.isPartial
    ? '90791'
    : (seriesData.secondAppointment?.isRecurring
      ? '90791 & 90837 (recurring)'
      : '90791 & 90837');

  // Update client with series data
  await prisma.client.update({
    where: { id: clientId },
    data: {
      serviceCode: displayServiceCode,
      modifierCode: '95', // Telehealth modifier for all appointments
      appointmentScreenshot: seriesData.firstAppointment.screenshot,
      appointmentSeriesData: JSON.stringify(seriesData),
      schedulingProgress: JSON.stringify(progressWithTimestamp),
    }
  });

  console.log('[CreateAppointment] ✓ Client record updated with series data');
  console.log('[CreateAppointment] ✓ Service code:', displayServiceCode);
  console.log('[CreateAppointment] ✓ Modifier code: 95');
}
