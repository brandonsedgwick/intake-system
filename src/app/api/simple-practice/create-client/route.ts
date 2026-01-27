import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';
import { prisma } from '@/lib/db/prisma';

export async function POST(req: NextRequest) {
  try {
    const { clientData } = await req.json();

    if (!clientData) {
      return NextResponse.json(
        { success: false, error: 'Missing client data' },
        { status: 400 }
      );
    }

    // Get app origin for API calls from popup
    const appOrigin = process.env.NEXTAUTH_URL || 'http://localhost:3001';

    // Add appOrigin to clientData for popup to use
    const clientDataWithOrigin = {
      ...clientData,
      appOrigin,
    };

    console.log('[Puppeteer] Starting Simple Practice automation...');
    console.log('[Puppeteer] App origin for API calls:', appOrigin);
    // Note: Screener PDF is auto-generated when client moves to scheduling
    // Upload can be done separately from the scheduling page

    // Launch browser (visible for now per user request)
    const browser = await chromium.launch({
      headless: false,
      slowMo: 100, // Slow down by 100ms to appear more human
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--force-color-profile=srgb',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1200' // Set window size directly
      ]
    });

    // Try to load saved cookies for persistent session
    const cookiesPath = '/tmp/simplepractice-cookies.json';
    let context;

    const fs = require('fs');
    console.log('[Puppeteer] Checking for saved session at:', cookiesPath);

    try {
      if (fs.existsSync(cookiesPath)) {
        console.log('[Puppeteer] ✓ Cookies file found!');
        const cookiesData = fs.readFileSync(cookiesPath, 'utf8');
        console.log('[Puppeteer] Cookies file size:', cookiesData.length, 'bytes');

        const cookies = JSON.parse(cookiesData);

        // Validate cookie structure
        if (!cookies.cookies || !Array.isArray(cookies.cookies) || cookies.cookies.length === 0) {
          console.log('[Puppeteer] ✗ Invalid cookie file structure, will need login');
          context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1200 },
            deviceScaleFactor: 1,
            locale: 'en-US',
            timezoneId: 'America/Los_Angeles'
          });
        } else {
          console.log('[Puppeteer] ✓ Loading', cookies.cookies.length, 'cookies');
          console.log('[Puppeteer] Origins with storage:', cookies.origins ? cookies.origins.length : 0);

          context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1200 },
            deviceScaleFactor: 1,
            locale: 'en-US',
            timezoneId: 'America/Los_Angeles',
            storageState: cookies
          });
          console.log('[Puppeteer] ✓ Session cookies loaded into browser context');
        }
      } else {
        console.log('[Puppeteer] ✗ No saved session found');
        console.log('[Puppeteer] Will need manual login');
        context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          viewport: { width: 1920, height: 1200 },
          deviceScaleFactor: 1,
          locale: 'en-US',
          timezoneId: 'America/Los_Angeles'
        });
      }
    } catch (error) {
      console.log('[Puppeteer] ✗ Error loading cookies:', error.message);
      console.log('[Puppeteer] Stack:', error.stack);
      console.log('[Puppeteer] Starting fresh session');
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
      // Navigate to Simple Practice
      console.log('[Puppeteer] Navigating to Simple Practice...');
      await page.goto('https://secure.simplepractice.com/clients', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      console.log('[Puppeteer] Current URL:', page.url());

      // Check if we need to login (including SAML redirect)
      const currentUrl = page.url();
      const needsLogin = currentUrl.includes('/login') ||
                         currentUrl.includes('/sign_in') ||
                         currentUrl.includes('/saml/auth') || // SAML authentication
                         currentUrl.includes('account.simplepractice.com'); // Account subdomain

      if (needsLogin) {
        console.log('[Puppeteer] ============================================');
        console.log('[Puppeteer] NOT LOGGED IN - PLEASE LOG IN MANUALLY');
        console.log('[Puppeteer] ============================================');
        console.log('[Puppeteer] Detected URL:', currentUrl);
        console.log('[Puppeteer] Email: brandon@arcadiawa.com');
        console.log('[Puppeteer] Password: Mooseman2024^');
        console.log('[Puppeteer]');
        console.log('[Puppeteer] The browser window is waiting for you...');
        console.log('[Puppeteer] After logging in, this will save your session');
        console.log('[Puppeteer] and you won\'t need to log in again.');
        console.log('[Puppeteer] ============================================');

        // Wait for user to manually login - wait for secure.simplepractice.com (not account subdomain)
        await page.waitForURL(/secure\.simplepractice\.com\/(clients|dashboard|home|calendar)/, { timeout: 180000 }); // 3 minutes
        console.log('[Puppeteer] Login successful! New URL:', page.url());
        console.log('[Puppeteer] Saving session...');

        // Wait for network idle and all cookies to be set
        await page.waitForLoadState('networkidle').catch(() => null);
        await page.waitForTimeout(5000); // 5 seconds for all cookies to settle

        // Save cookies for next time
        const fs = require('fs');
        const cookies = await context.storageState();

        // Validate cookies were captured
        if (!cookies.cookies || cookies.cookies.length === 0) {
          console.log('[Puppeteer] ✗ ERROR: No cookies captured!');
          throw new Error('Session capture failed - no cookies found');
        }

        console.log('[Puppeteer] ✓ Captured', cookies.cookies.length, 'cookies');

        const cookiesJson = JSON.stringify(cookies, null, 2);

        try {
          fs.writeFileSync(cookiesPath, cookiesJson, 'utf8');
          console.log('[Puppeteer] ✓ Session saved to:', cookiesPath);
          console.log('[Puppeteer] ✓ Saved', cookiesJson.length, 'bytes');

          // Verify by reading back
          const readBack = fs.readFileSync(cookiesPath, 'utf8');
          const parsed = JSON.parse(readBack);

          if (parsed.cookies.length !== cookies.cookies.length) {
            throw new Error('Cookie file verification failed');
          }

          console.log('[Puppeteer] ✓ Verified: Cookie file is valid');
        } catch (writeError) {
          console.log('[Puppeteer] ✗ ERROR saving cookies:', writeError.message);
          throw writeError;
        }

        console.log('[Puppeteer] You won\'t need to log in next time!');
      } else {
        console.log('[Puppeteer] Already logged in with saved session!');
        console.log('[Puppeteer] Current URL:', page.url());
      }

      // Navigate to create client page
      console.log('[Puppeteer] Navigating to create client form...');
      await page.goto('https://secure.simplepractice.com/clients/new', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Wait for form to be visible
      await page.waitForSelector('input[name="firstName"]', { timeout: 30000 });

      // Inject zoom to fit large forms
      await page.evaluate(() => {
        document.documentElement.style.zoom = '0.85';
      });
      console.log('[Puppeteer] Applied 85% zoom for better visibility');

      console.log('[Puppeteer] Filling form fields...');

      // Wait a bit for modal to fully load
      await page.waitForTimeout(1000);

      // Fill basic fields - try multiple selector strategies
      try {
        await page.fill('input[name="firstName"]', clientData.firstName || '');
        console.log('[Puppeteer] Filled firstName');
      } catch (error) {
        console.log('[Puppeteer] firstName field not found with name selector');
      }

      try {
        await page.fill('input[name="lastName"]', clientData.lastName || '');
        console.log('[Puppeteer] Filled lastName');
      } catch (error) {
        console.log('[Puppeteer] lastName field not found with name selector');
      }

      // Fill date of birth - try with longer timeout
      if (clientData.dateOfBirthMonth) {
        try {
          await page.selectOption('select[name="month"]', clientData.dateOfBirthMonth, { timeout: 5000 });
          console.log('[Puppeteer] Selected birth month');
        } catch (error) {
          console.log('[Puppeteer] Month dropdown not found:', error.message);
        }
      }
      if (clientData.dateOfBirthDay) {
        try {
          await page.selectOption('select[name="day"]', clientData.dateOfBirthDay, { timeout: 5000 });
          console.log('[Puppeteer] Selected birth day');
        } catch (error) {
          console.log('[Puppeteer] Day dropdown not found:', error.message);
        }
      }
      if (clientData.dateOfBirthYear) {
        try {
          await page.selectOption('select[name="year"]', clientData.dateOfBirthYear, { timeout: 5000 });
          console.log('[Puppeteer] Selected birth year');
        } catch (error) {
          console.log('[Puppeteer] Year dropdown not found:', error.message);
        }
      }

      // Handle billing type - Individual appointments
      const individualBillingValue = clientData.hasInsurance ? 'Insurance' : 'Self-pay';
      await page.click(`input[name="billingType"][value="${individualBillingValue}"]`);
      console.log(`[Puppeteer] Set individual billing to ${individualBillingValue}`);

      // Handle billing type - Group appointments (defaults to Self-pay)
      await page.click('input[name="billingTypeGroupAppt"][value="Self-pay"]');
      console.log('[Puppeteer] Set group billing to Self-pay');

      // Find Status field - it's a custom dropdown component, not a native select
      console.log('[Puppeteer] Looking for Status custom dropdown...');

      try {
        // Look for the text "Status" that's next to the dropdown (not "Client status" heading)
        const statusElements = await page.getByText('Status', { exact: false }).all();
        console.log(`[Puppeteer] Found ${statusElements.length} elements with "Status" text`);

        for (let i = 0; i < statusElements.length; i++) {
          const elem = statusElements[i];
          const tagName = await elem.evaluate(el => el.tagName);
          const className = await elem.getAttribute('class');
          const text = await elem.textContent();

          console.log(`[Puppeteer] Status element ${i}: tag="${tagName}", class="${className}", text="${text?.trim()}"`);

          // Skip the "Client status" heading (H3 tag)
          if (tagName === 'H3') {
            console.log(`[Puppeteer]   Skipping - this is the section heading`);
            continue;
          }

          // Look for dropdown near this element using multiple strategies
          try {
            // Get parent element
            const parent = elem.locator('..');

            // Try to find button or combobox in parent
            const dropdownCount = await parent.locator('button, [role="combobox"], select').count();
            console.log(`[Puppeteer]   Found ${dropdownCount} potential dropdown elements in parent`);

            if (dropdownCount > 0) {
              const dropdown = parent.locator('button, [role="combobox"], select').first();
              const dropdownTag = await dropdown.evaluate(el => el.tagName);
              const dropdownRole = await dropdown.getAttribute('role');
              console.log(`[Puppeteer]   ★★★ Found dropdown: tag="${dropdownTag}", role="${dropdownRole}"`);

              // Try to click it to open the dropdown
              await dropdown.click({ timeout: 3000 });
              console.log('[Puppeteer]   ★★★ Clicked Status dropdown');
              await page.waitForTimeout(800);

              // Now look for "Active" option in the opened dropdown
              const activeOption = page.getByText('Active', { exact: true }).first();
              await activeOption.click({ timeout: 3000 });
              console.log('[Puppeteer]   ★★★ SUCCESS! Clicked Active option');
              break;
            }
          } catch (e) {
            console.log(`[Puppeteer]   Failed with this element: ${e.message}`);
          }
        }

        // If the above didn't work, try a more direct approach
        // Look for any button with text containing "Select" near the Status section
        console.log('[Puppeteer] Trying alternative strategy: looking for "Select" button...');
        const selectButtons = await page.getByRole('button').all();
        for (const btn of selectButtons) {
          const btnText = await btn.textContent();
          if (btnText && btnText.trim() === 'Select') {
            console.log('[Puppeteer] ★★★ Found "Select" button, checking if it\'s the Status dropdown...');
            try {
              // Click it
              await btn.click({ timeout: 3000 });
              await page.waitForTimeout(800);

              // Try to click "Active"
              const activeOption = page.getByText('Active', { exact: true }).first();
              await activeOption.click({ timeout: 3000 });
              console.log('[Puppeteer] ★★★ SUCCESS! Selected Active from dropdown');
              break;
            } catch (e) {
              console.log(`[Puppeteer] This wasn't the right dropdown: ${e.message}`);
            }
          }
        }
      } catch (error) {
        console.log('[Puppeteer] Error finding Status dropdown:', error.message);
      }

      // Scroll down to reveal clinician, email, phone, and reminder fields
      console.log('[Puppeteer] Scrolling down to reveal lower form fields...');
      await page.evaluate(() => {
        const modal = document.querySelector('[role="dialog"]') || document.querySelector('.modal') || document.body;
        modal.scrollTo(0, 400);
      });
      await page.waitForTimeout(800);

      // Select clinician if provided - try multiple strategies
      if (clientData.clinicianName) {
        try {
          // Strategy 1: Find select near "Primary clinician" or "Clinician" label
          const clinicianSelects = await page.locator('select').all();
          for (const select of clinicianSelects) {
            const selectId = await select.getAttribute('id');
            if (selectId) {
              const label = await page.locator(`label[for="${selectId}"]`).first().textContent().catch(() => null);
              if (label && label.toLowerCase().includes('clinician')) {
                await select.selectOption({ label: clientData.clinicianName });
                console.log(`[Puppeteer] Set clinician to ${clientData.clinicianName}`);
                break;
              }
            }
          }
        } catch (error) {
          console.log('[Puppeteer] Could not set clinician:', error.message);
        }
      }

      // Add email
      if (clientData.email) {
        try {
          console.log('[Puppeteer] Looking for Add email button...');

          // Click "Add email" button - try different selectors
          try {
            await page.click('button:has-text("Add email")', { timeout: 5000 });
            console.log('[Puppeteer] Clicked Add email button (has-text)');
          } catch {
            // Try alternative selector
            const buttons = await page.locator('button').all();
            for (const button of buttons) {
              const text = await button.textContent();
              if (text && text.toLowerCase().includes('add email')) {
                await button.click();
                console.log('[Puppeteer] Clicked Add email button (text search)');
                break;
              }
            }
          }

          await page.waitForTimeout(1000);

          // Find and fill the email input
          console.log('[Puppeteer] Looking for email input field...');

          // Get all input elements (any type)
          const allInputs = await page.locator('input').all();
          console.log(`[Puppeteer] Found ${allInputs.length} total input elements`);

          // Find the newest/last visible input that's not already filled
          let emailInputFilled = false;
          for (let i = allInputs.length - 1; i >= 0; i--) {
            const input = allInputs[i];
            const value = await input.inputValue().catch(() => '');
            const isVisible = await input.isVisible().catch(() => false);
            const type = await input.getAttribute('type');
            const name = await input.getAttribute('name');
            const id = await input.getAttribute('id');

            console.log(`[Puppeteer] Input ${i}: type="${type}", name="${name}", id="${id}", visible=${isVisible}, value="${value}"`);

            // Look for empty visible input (likely the newly added email field)
            if (isVisible && !value && type !== 'checkbox' && type !== 'radio' && type !== 'hidden') {
              await input.fill(clientData.email);
              console.log(`[Puppeteer] Filled email in input ${i} (type="${type}", name="${name}")`);
              emailInputFilled = true;
              break;
            }
          }

          if (!emailInputFilled) {
            console.log('[Puppeteer] Could not find empty visible input for email');
          }
        } catch (error) {
          console.log('[Puppeteer] Could not add email:', error.message);
        }
      }

      // Add phone
      if (clientData.phone) {
        try {
          console.log('[Puppeteer] Looking for Add phone button...');

          // Click "Add phone" button - try different selectors
          try {
            await page.click('button:has-text("Add phone")', { timeout: 5000 });
            console.log('[Puppeteer] Clicked Add phone button (has-text)');
          } catch {
            // Try alternative selector
            const buttons = await page.locator('button').all();
            for (const button of buttons) {
              const text = await button.textContent();
              if (text && text.toLowerCase().includes('add phone')) {
                await button.click();
                console.log('[Puppeteer] Clicked Add phone button (text search)');
                break;
              }
            }
          }

          await page.waitForTimeout(1000);

          // Find and fill the phone input
          console.log('[Puppeteer] Looking for phone input field...');

          // Strategy 1: Find all tel inputs and use the last one
          const phoneInputs = await page.locator('input[type="tel"]').all();
          console.log(`[Puppeteer] Found ${phoneInputs.length} phone input(s)`);

          if (phoneInputs.length > 0) {
            const lastPhoneInput = phoneInputs[phoneInputs.length - 1];

            // Clear the field first
            await lastPhoneInput.clear();

            // Click to focus
            await lastPhoneInput.click();
            await page.waitForTimeout(200);

            // Type character by character to work with auto-formatting
            await lastPhoneInput.type(clientData.phone, { delay: 50 });
            console.log('[Puppeteer] Typed phone number character by character');

            // Verify the value
            const phoneValue = await lastPhoneInput.inputValue();
            console.log(`[Puppeteer] Phone field value after typing: "${phoneValue}"`);
          } else {
            console.log('[Puppeteer] No phone inputs found!');
          }
        } catch (error) {
          console.log('[Puppeteer] Could not add phone:', error.message);
        }
      }

      // Enable notification/reminder toggles
      console.log('[Puppeteer] Looking for reminder/notification toggles...');

      // Get all checkboxes with IDs containing "toggle-switch" (Ember.js pattern for toggles)
      const toggleSwitches = await page.locator('input[type="checkbox"][id*="toggle-switch"]').all();
      console.log(`[Puppeteer] Found ${toggleSwitches.length} toggle switches`);

      // Check all toggle switches (these are the reminder notifications)
      // Use .click() instead of .check() because the checkboxes are covered by styled span elements
      for (const toggle of toggleSwitches) {
        try {
          const isChecked = await toggle.isChecked();
          const toggleId = await toggle.getAttribute('id');

          if (!isChecked) {
            // Use click with force option to bypass the span overlay
            await toggle.click({ force: true, timeout: 3000 });
            console.log(`[Puppeteer] ✓ Enabled toggle: ${toggleId}`);
          } else {
            console.log(`[Puppeteer] Toggle ${toggleId} already checked`);
          }
        } catch (error) {
          console.log(`[Puppeteer] Could not check toggle:`, error.message);
        }
      }

      console.log('[Puppeteer] Form filling complete');

      // Define the injection function that we'll call multiple times
      const injectPopup = async () => {
        await page.evaluate((clientInfo) => {
          // Remove existing panel if present
          const existing = document.getElementById('puppeteer-info-panel');
          if (existing) {
            existing.remove();
          }

          console.log('[Popup] Injecting client info panel...');
        // Create draggable info panel (left side)
        const infoPanel = document.createElement('div');
        infoPanel.id = 'puppeteer-info-panel';
        infoPanel.style.cssText = `
          position: fixed;
          top: 20px;
          left: 20px;
          z-index: 999999;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          padding: 0;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(240, 147, 251, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          max-width: 380px;
          cursor: move;
          user-select: none;
          backdrop-filter: blur(10px);
        `;

        // Drag functionality
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;

        infoPanel.addEventListener('mousedown', (e) => {
          if (e.target.tagName !== 'BUTTON') {
            isDragging = true;
            initialX = e.clientX - infoPanel.offsetLeft;
            initialY = e.clientY - infoPanel.offsetTop;
            infoPanel.style.cursor = 'grabbing';
          }
        });

        document.addEventListener('mousemove', (e) => {
          if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            infoPanel.style.left = currentX + 'px';
            infoPanel.style.top = currentY + 'px';
          }
        });

        document.addEventListener('mouseup', () => {
          isDragging = false;
          infoPanel.style.cursor = 'move';
        });

        // Header with drag hint
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
        title.textContent = '📋 Client Information';
        title.style.cssText = 'font-size: 18px; font-weight: 700; color: white; display: flex; align-items: center; gap: 8px;';
        header.appendChild(title);

        const dragHint = document.createElement('div');
        dragHint.textContent = '⋮⋮';
        dragHint.style.cssText = 'font-size: 20px; color: rgba(255, 255, 255, 0.6); letter-spacing: 2px;';
        header.appendChild(dragHint);

        infoPanel.appendChild(header);

        // Content area
        const content = document.createElement('div');
        content.style.cssText = 'padding: 20px; background: white; border-radius: 0 0 16px 16px;';

        // Info rows with colorful icons
        const infoData = [
          { label: 'Name', value: `${clientInfo.firstName || ''} ${clientInfo.lastName || ''}`, icon: '👤', color: '#667eea' },
          { label: 'Email', value: clientInfo.email || 'N/A', icon: '✉️', color: '#f093fb' },
          { label: 'Phone', value: clientInfo.phone || 'N/A', icon: '📱', color: '#4ade80' },
          { label: 'DOB', value: clientInfo.dateOfBirth || 'N/A', icon: '🎂', color: '#fbbf24' },
          { label: 'Payment', value: clientInfo.hasInsurance ? 'Insurance' : 'Self-pay', icon: '💳', color: '#06b6d4' },
          { label: 'Clinician', value: clientInfo.clinicianName || 'N/A', icon: '👨‍⚕️', color: '#8b5cf6' },
          { label: 'Status', value: 'Active', icon: '✅', color: '#10b981' }
        ];

        infoData.forEach(item => {
          const row = document.createElement('div');
          row.style.cssText = `
            margin-bottom: 14px;
            padding: 12px;
            background: linear-gradient(135deg, ${item.color}15, ${item.color}05);
            border-radius: 10px;
            border-left: 3px solid ${item.color};
            transition: transform 0.2s;
          `;
          row.addEventListener('mouseenter', () => {
            row.style.transform = 'translateX(4px)';
          });
          row.addEventListener('mouseleave', () => {
            row.style.transform = 'translateX(0)';
          });

          const labelRow = document.createElement('div');
          labelRow.style.cssText = 'display: flex; align-items: center; gap: 6px; margin-bottom: 6px;';

          const icon = document.createElement('span');
          icon.textContent = item.icon;
          icon.style.cssText = 'font-size: 16px;';
          labelRow.appendChild(icon);

          const label = document.createElement('div');
          label.textContent = item.label;
          label.style.cssText = 'font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.8px;';
          labelRow.appendChild(label);

          row.appendChild(labelRow);

          const value = document.createElement('div');
          value.textContent = item.value;
          value.style.cssText = 'font-size: 15px; color: #1f2937; font-weight: 600; padding-left: 22px;';
          row.appendChild(value);

          content.appendChild(row);
        });

        infoPanel.appendChild(content);

        // Add multi-state button container at the bottom of the panel
        const buttonContainer = document.createElement('div');
        buttonContainer.id = 'puppeteer-button-container';
        buttonContainer.style.cssText = `
          padding: 20px;
          background: white;
          border-radius: 0 0 16px 16px;
          padding-top: 0;
        `;
        console.log('[Popup] ✓ Button container created with ID:', buttonContainer.id);

        // Track state in window object
        window['captureAttempts'] = 0;
        window['capturedSimplePracticeId'] = null;

        // Function to render button states
        window['renderButtonState'] = function(state) {
          console.log('[renderButtonState] Called with state:', state);
          const container = document.getElementById('puppeteer-button-container');
          console.log('[renderButtonState] Container element:', container);

          // Check if container exists
          if (!container) {
            console.error('[renderButtonState] ✗ Button container not found!');
            return;
          }

          console.log('[renderButtonState] ✓ Container found, rendering state:', state);

          // Clear container using safe DOM methods
          while (container.firstChild) {
            container.removeChild(container.firstChild);
          }

          if (state === 'initial') {
            // Instruction text
            const instructionText = document.createElement('div');
            instructionText.textContent = '✓ Form filled by automation';
            instructionText.style.cssText = `
              text-align: center;
              font-size: 13px;
              font-weight: 600;
              color: #10b981;
              margin-bottom: 8px;
              padding: 8px;
              background: #10b98110;
              border-radius: 8px;
            `;
            container.appendChild(instructionText);

            const subtitle = document.createElement('div');
            subtitle.textContent = 'Complete the workflow, then capture the ID';
            subtitle.style.cssText = `
              text-align: center;
              font-size: 12px;
              color: #6b7280;
              margin-bottom: 12px;
            `;
            container.appendChild(subtitle);

            // Green Capture button
            const captureBtn = document.createElement('button');
            captureBtn.id = 'puppeteer-capture-btn';
            captureBtn.textContent = 'Capture Simple Practice ID';
            captureBtn.style.cssText = `
              width: 100%;
              padding: 16px 24px;
              background: linear-gradient(135deg, #10b981, #059669);
              color: white;
              border: none;
              border-radius: 12px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.3s ease;
              box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
            `;

            captureBtn.addEventListener('mouseenter', () => {
              captureBtn.style.transform = 'translateY(-2px)';
              captureBtn.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
            });

            captureBtn.addEventListener('mouseleave', () => {
              captureBtn.style.transform = 'translateY(0)';
              captureBtn.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
            });

            captureBtn.addEventListener('click', async () => {
              const url = window.location.href;
              console.log('[Popup] Current URL:', url);
              console.log('[Popup] Looking for client ID pattern /clients/[id]');

              const match = url.match(/\/clients\/([a-zA-Z0-9]+)/);

              window['captureAttempts'] = (window['captureAttempts'] || 0) + 1;
              console.log('[Popup] Capture attempt #', window['captureAttempts']);

              if (match && match[1]) {
                const capturedId = match[1];
                console.log('[Popup] ✓ Found Simple Practice ID in URL:', capturedId);
                window['capturedSimplePracticeId'] = capturedId;

                // Show saving state
                captureBtn.textContent = 'Saving...';
                captureBtn.disabled = true;
                captureBtn.style.opacity = '0.7';

                // Call API to save the ID
                const apiUrl = clientInfo.appOrigin + '/api/clients/' + clientInfo.clientId + '/simple-practice-id';
                console.log('[Popup] Calling API to save ID...');
                console.log('[Popup] API URL:', apiUrl);
                console.log('[Popup] Client ID (internal):', clientInfo.clientId);
                console.log('[Popup] Simple Practice ID:', capturedId);

                try {
                  const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ simplePracticeId: capturedId })
                  });

                  console.log('[Popup] Response status:', response.status);
                  console.log('[Popup] Response OK:', response.ok);

                  let data;
                  try {
                    data = await response.json();
                    console.log('[Popup] Response data:', JSON.stringify(data));
                  } catch (jsonErr) {
                    console.error('[Popup] Failed to parse JSON response:', jsonErr);
                    window['apiError'] = 'Invalid response from server (status ' + response.status + ')';
                    window['renderButtonState']('api_error');
                    return;
                  }

                  if (response.ok && data.success) {
                    console.log('[Popup] ✓ ID saved successfully!');
                    window['idSavedToDb'] = true;
                    window['renderButtonState']('success');
                  } else {
                    console.error('[Popup] ✗ API returned error:', data.error);
                    window['apiError'] = data.error || 'Failed to save ID (status ' + response.status + ')';
                    window['renderButtonState']('api_error');
                  }
                } catch (err) {
                  console.error('[Popup] ✗ Network/fetch error:', err);
                  console.error('[Popup] Error name:', err.name);
                  console.error('[Popup] Error message:', err.message);

                  // Provide more helpful error messages
                  let errorMsg = 'Network error: ' + (err.message || 'Unknown error');
                  if (err.message && err.message.includes('Failed to fetch')) {
                    errorMsg = 'Cannot reach server. This may be a CORS or mixed-content issue. Check that ' + clientInfo.appOrigin + ' is accessible.';
                  }

                  window['apiError'] = errorMsg;
                  window['renderButtonState']('api_error');
                }
              } else {
                console.log('[Popup] ✗ No client ID found in URL. URL does not match pattern /clients/[id]');
                window['renderButtonState']('error');
              }
            });

            container.appendChild(captureBtn);

            // Close Browser button (always available) - gray outline style
            const closeBtnInitial = document.createElement('button');
            closeBtnInitial.id = 'puppeteer-close-btn';
            closeBtnInitial.textContent = 'Close Browser & Return to App';
            closeBtnInitial.style.cssText = `
              width: 100%;
              padding: 12px 24px;
              background: transparent;
              color: #6b7280;
              border: 1px solid #d1d5db;
              border-radius: 12px;
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.3s ease;
              margin-top: 12px;
            `;

            closeBtnInitial.addEventListener('mouseenter', () => {
              closeBtnInitial.style.borderColor = '#9ca3af';
              closeBtnInitial.style.color = '#4b5563';
              closeBtnInitial.style.background = '#f9fafb';
            });

            closeBtnInitial.addEventListener('mouseleave', () => {
              closeBtnInitial.style.borderColor = '#d1d5db';
              closeBtnInitial.style.color = '#6b7280';
              closeBtnInitial.style.background = 'transparent';
            });

            closeBtnInitial.addEventListener('click', () => {
              window['closeRequested'] = true;
            });

            container.appendChild(closeBtnInitial);

          } else if (state === 'success') {
            // Success state: Show ID + Upload button + Close button
            const successDiv = document.createElement('div');

            // Success header
            const successHeader = document.createElement('div');
            successHeader.style.cssText = `
              display: flex;
              align-items: center;
              gap: 12px;
              margin-bottom: 16px;
              padding: 16px;
              background: linear-gradient(135deg, #10b98115, #05966905);
              border-radius: 10px;
              border-left: 3px solid #10b981;
            `;

            const checkIconSpan = document.createElement('span');
            checkIconSpan.textContent = '✅';
            checkIconSpan.style.fontSize = '20px';
            successHeader.appendChild(checkIconSpan);

            const successMsgDiv = document.createElement('div');
            const successMsg = document.createElement('div');
            successMsg.textContent = 'ID Captured & Saved!';
            successMsg.style.cssText = 'font-weight: 600; color: #10b981;';
            const savedNote = document.createElement('div');
            savedNote.textContent = 'Saved to database';
            savedNote.style.cssText = 'font-size: 11px; color: #6b7280; margin-top: 2px;';
            successMsgDiv.appendChild(successMsg);
            successMsgDiv.appendChild(savedNote);
            successHeader.appendChild(successMsgDiv);

            // Display captured ID
            const idDisplay = document.createElement('div');
            idDisplay.style.cssText = `
              padding: 12px;
              background: #1f2937;
              border-radius: 8px;
              margin-bottom: 16px;
              text-align: center;
            `;

            const idLabel = document.createElement('div');
            idLabel.style.cssText = 'font-size: 12px; color: #9ca3af; margin-bottom: 4px;';
            idLabel.textContent = 'Simple Practice Client ID:';

            const idValue = document.createElement('div');
            idValue.style.cssText = `
              font-size: 18px;
              font-weight: 600;
              color: #10b981;
              font-family: 'Monaco', 'Courier New', monospace;
            `;
            idValue.textContent = window['capturedSimplePracticeId'];

            idDisplay.appendChild(idLabel);
            idDisplay.appendChild(idValue);

            // Close Browser button (gray outline)
            const closeBtn = document.createElement('button');
            closeBtn.id = 'puppeteer-close-btn';
            closeBtn.textContent = 'Close Browser & Return to App';
            closeBtn.style.cssText = `
              width: 100%;
              padding: 14px 24px;
              background: transparent;
              color: #6b7280;
              border: 2px solid #d1d5db;
              border-radius: 12px;
              font-size: 15px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.3s ease;
            `;

            closeBtn.addEventListener('mouseenter', () => {
              closeBtn.style.borderColor = '#9ca3af';
              closeBtn.style.color = '#4b5563';
            });

            closeBtn.addEventListener('mouseleave', () => {
              closeBtn.style.borderColor = '#d1d5db';
              closeBtn.style.color = '#6b7280';
            });

            closeBtn.addEventListener('click', () => {
              window['closeRequested'] = true;
            });

            successDiv.appendChild(successHeader);
            successDiv.appendChild(idDisplay);
            successDiv.appendChild(closeBtn);
            container.appendChild(successDiv);

          } else if (state === 'api_error') {
            // API error state: Show error + debug info + retry option
            const apiErrorDiv = document.createElement('div');

            const errorHeader = document.createElement('div');
            errorHeader.style.cssText = `
              display: flex;
              align-items: center;
              gap: 12px;
              margin-bottom: 16px;
              padding: 16px;
              background: linear-gradient(135deg, #ef444415, #dc262605);
              border-radius: 10px;
              border-left: 3px solid #ef4444;
            `;

            const errorIcon = document.createElement('span');
            errorIcon.textContent = '❌';
            errorIcon.style.fontSize = '20px';
            errorHeader.appendChild(errorIcon);

            const errorMsgDiv = document.createElement('div');
            const errorTitle = document.createElement('div');
            errorTitle.textContent = 'Failed to Save ID';
            errorTitle.style.cssText = 'font-weight: 600; color: #ef4444;';
            const errorDetail = document.createElement('div');
            errorDetail.textContent = window['apiError'] || 'Unknown error';
            errorDetail.style.cssText = 'font-size: 12px; color: #6b7280; margin-top: 2px; word-break: break-word;';
            errorMsgDiv.appendChild(errorTitle);
            errorMsgDiv.appendChild(errorDetail);
            errorHeader.appendChild(errorMsgDiv);

            // Debug info section (collapsible)
            const debugSection = document.createElement('div');
            debugSection.style.cssText = `
              margin-bottom: 12px;
              padding: 12px;
              background: #f3f4f6;
              border-radius: 8px;
              font-size: 11px;
              font-family: 'Monaco', 'Courier New', monospace;
            `;

            const debugLabel = document.createElement('div');
            debugLabel.textContent = 'Debug Info:';
            debugLabel.style.cssText = 'font-weight: 600; margin-bottom: 8px; color: #374151;';
            debugSection.appendChild(debugLabel);

            const debugApiUrl = document.createElement('div');
            debugApiUrl.textContent = 'API: ' + clientInfo.appOrigin + '/api/clients/' + clientInfo.clientId + '/simple-practice-id';
            debugApiUrl.style.cssText = 'word-break: break-all; color: #6b7280; margin-bottom: 4px;';
            debugSection.appendChild(debugApiUrl);

            const debugTip = document.createElement('div');
            debugTip.textContent = 'Tip: Check browser console (F12) for detailed logs';
            debugTip.style.cssText = 'color: #9ca3af; font-style: italic;';
            debugSection.appendChild(debugTip);

            // Retry button
            const retryBtn = document.createElement('button');
            retryBtn.textContent = 'Retry';
            retryBtn.style.cssText = `
              width: 100%;
              padding: 14px 24px;
              background: linear-gradient(135deg, #f59e0b, #d97706);
              color: white;
              border: none;
              border-radius: 12px;
              font-size: 15px;
              font-weight: 600;
              cursor: pointer;
              margin-bottom: 12px;
            `;

            retryBtn.addEventListener('click', () => {
              window['renderButtonState']('initial');
            });

            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.id = 'puppeteer-close-btn';
            closeBtn.textContent = 'Close Browser & Return to App';
            closeBtn.style.cssText = `
              width: 100%;
              padding: 14px 24px;
              background: transparent;
              color: #6b7280;
              border: 2px solid #d1d5db;
              border-radius: 12px;
              font-size: 15px;
              font-weight: 600;
              cursor: pointer;
            `;

            closeBtn.addEventListener('click', () => {
              window['closeRequested'] = true;
            });

            apiErrorDiv.appendChild(errorHeader);
            apiErrorDiv.appendChild(debugSection);
            apiErrorDiv.appendChild(retryBtn);
            apiErrorDiv.appendChild(closeBtn);
            container.appendChild(apiErrorDiv);

          } else if (state === 'error') {
            // Error state: Show message + Retry button
            const errorDiv = document.createElement('div');

            // Error header
            const errorHeader = document.createElement('div');
            errorHeader.style.cssText = `
              display: flex;
              align-items: center;
              gap: 12px;
              margin-bottom: 16px;
              padding: 16px;
              background: linear-gradient(135deg, #ef444415, #dc262605);
              border-radius: 10px;
              border-left: 3px solid #ef4444;
            `;

            const errorIconSpan = document.createElement('span');
            errorIconSpan.textContent = '⚠️';
            errorIconSpan.style.fontSize = '20px';
            errorHeader.appendChild(errorIconSpan);

            const errorMsg = document.createElement('span');
            errorMsg.textContent = 'ID Not Found in Current URL';
            errorMsg.style.cssText = 'font-weight: 600; color: #ef4444;';
            errorHeader.appendChild(errorMsg);

            // Instructions
            const instructions = document.createElement('div');
            instructions.style.cssText = `
              padding: 12px;
              background: rgba(255, 255, 255, 0.05);
              border-radius: 8px;
              margin-bottom: 16px;
              font-size: 14px;
              color: #6b7280;
              line-height: 1.6;
            `;
            instructions.textContent = 'Please navigate to the client profile page first. The URL should look like: secure.simplepractice.com/clients/[ID]/overview';

            // Retry button
            const retryBtn = document.createElement('button');
            retryBtn.textContent = `Retry (Attempt ${window['captureAttempts']})`;
            retryBtn.style.cssText = `
              width: 100%;
              padding: 16px 24px;
              background: linear-gradient(135deg, #f59e0b, #d97706);
              color: white;
              border: none;
              border-radius: 12px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.3s ease;
              box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
            `;

            retryBtn.addEventListener('mouseenter', () => {
              retryBtn.style.transform = 'translateY(-2px)';
              retryBtn.style.boxShadow = '0 6px 20px rgba(245, 158, 11, 0.4)';
            });

            retryBtn.addEventListener('mouseleave', () => {
              retryBtn.style.transform = 'translateY(0)';
              retryBtn.style.boxShadow = '0 4px 12px rgba(245, 158, 11, 0.3)';
            });

            retryBtn.addEventListener('click', () => {
              window['renderButtonState']('initial');
            });

            errorDiv.appendChild(errorHeader);
            errorDiv.appendChild(instructions);
            errorDiv.appendChild(retryBtn);

            // Show manual entry link after 2+ attempts
            if (window['captureAttempts'] >= 2) {
              const manualLink = document.createElement('button');
              manualLink.style.cssText = `
                width: 100%;
                padding: 12px;
                background: transparent;
                color: #60a5fa;
                border: 1px solid #60a5fa;
                border-radius: 8px;
                font-size: 14px;
                cursor: pointer;
                margin-top: 12px;
                transition: all 0.2s;
              `;
              manualLink.textContent = 'Enter ID Manually';

              manualLink.addEventListener('mouseenter', () => {
                manualLink.style.background = 'rgba(96, 165, 250, 0.1)';
              });

              manualLink.addEventListener('mouseleave', () => {
                manualLink.style.background = 'transparent';
              });

              manualLink.addEventListener('click', () => {
                window['renderButtonState']('manual');
              });

              errorDiv.appendChild(manualLink);
            }

            // Close Browser button (always available)
            const closeBtnError = document.createElement('button');
            closeBtnError.id = 'puppeteer-close-btn';
            closeBtnError.textContent = 'Close Browser & Return to App';
            closeBtnError.style.cssText = `
              width: 100%;
              padding: 12px 24px;
              background: transparent;
              color: #6b7280;
              border: 1px solid #d1d5db;
              border-radius: 12px;
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.3s ease;
              margin-top: 12px;
            `;

            closeBtnError.addEventListener('mouseenter', () => {
              closeBtnError.style.borderColor = '#9ca3af';
              closeBtnError.style.color = '#4b5563';
              closeBtnError.style.background = '#f9fafb';
            });

            closeBtnError.addEventListener('mouseleave', () => {
              closeBtnError.style.borderColor = '#d1d5db';
              closeBtnError.style.color = '#6b7280';
              closeBtnError.style.background = 'transparent';
            });

            closeBtnError.addEventListener('click', () => {
              window['closeRequested'] = true;
            });

            errorDiv.appendChild(closeBtnError);

            container.appendChild(errorDiv);

          } else if (state === 'manual') {
            // Manual entry state: Input field + Submit button
            const manualDiv = document.createElement('div');

            // Header
            const manualHeader = document.createElement('div');
            manualHeader.style.cssText = `
              font-size: 14px;
              color: #374151;
              margin-bottom: 12px;
              font-weight: 500;
            `;
            manualHeader.textContent = 'Enter Simple Practice Client ID:';

            // Input field
            const input = document.createElement('input');
            input.type = 'text';
            input.id = 'manual-id-input';
            input.placeholder = 'e.g., 43bb7957ac5cafa3';
            input.style.cssText = `
              width: 100%;
              padding: 12px;
              background: #f9fafb;
              border: 1px solid #d1d5db;
              border-radius: 8px;
              color: #1f2937;
              font-size: 14px;
              margin-bottom: 12px;
              font-family: 'Monaco', 'Courier New', monospace;
            `;

            input.addEventListener('focus', () => {
              input.style.borderColor = '#60a5fa';
              input.style.boxShadow = '0 0 0 3px rgba(96, 165, 250, 0.1)';
            });

            input.addEventListener('blur', () => {
              input.style.borderColor = '#d1d5db';
              input.style.boxShadow = 'none';
            });

            // Submit button
            const submitBtn = document.createElement('button');
            submitBtn.textContent = 'Submit ID';
            submitBtn.style.cssText = `
              width: 100%;
              padding: 16px 24px;
              background: linear-gradient(135deg, #10b981, #059669);
              color: white;
              border: none;
              border-radius: 12px;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.3s ease;
              box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
            `;

            submitBtn.addEventListener('mouseenter', () => {
              submitBtn.style.transform = 'translateY(-2px)';
              submitBtn.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.4)';
            });

            submitBtn.addEventListener('mouseleave', () => {
              submitBtn.style.transform = 'translateY(0)';
              submitBtn.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
            });

            submitBtn.addEventListener('click', () => {
              const enteredId = input.value.trim();

              // Validate format (alphanumeric, reasonable length)
              if (enteredId && /^[a-zA-Z0-9]{8,}$/.test(enteredId)) {
                window['capturedSimplePracticeId'] = enteredId;
                window['renderButtonState']('success');
              } else {
                // Show validation error
                input.style.borderColor = '#ef4444';
                input.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';

                setTimeout(() => {
                  input.style.borderColor = '#d1d5db';
                  input.style.boxShadow = 'none';
                }, 2000);
              }
            });

            // Cancel link
            const cancelLink = document.createElement('button');
            cancelLink.style.cssText = `
              width: 100%;
              padding: 8px;
              background: transparent;
              color: #6b7280;
              border: none;
              font-size: 13px;
              cursor: pointer;
              margin-top: 8px;
            `;
            cancelLink.textContent = '← Back to Capture';

            cancelLink.addEventListener('click', () => {
              window['renderButtonState']('initial');
            });

            // Close Browser button (always available)
            const closeBtnManual = document.createElement('button');
            closeBtnManual.id = 'puppeteer-close-btn';
            closeBtnManual.textContent = 'Close Browser & Return to App';
            closeBtnManual.style.cssText = `
              width: 100%;
              padding: 12px 24px;
              background: transparent;
              color: #6b7280;
              border: 1px solid #d1d5db;
              border-radius: 12px;
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.3s ease;
              margin-top: 16px;
            `;

            closeBtnManual.addEventListener('mouseenter', () => {
              closeBtnManual.style.borderColor = '#9ca3af';
              closeBtnManual.style.color = '#4b5563';
              closeBtnManual.style.background = '#f9fafb';
            });

            closeBtnManual.addEventListener('mouseleave', () => {
              closeBtnManual.style.borderColor = '#d1d5db';
              closeBtnManual.style.color = '#6b7280';
              closeBtnManual.style.background = 'transparent';
            });

            closeBtnManual.addEventListener('click', () => {
              window['closeRequested'] = true;
            });

            manualDiv.appendChild(manualHeader);
            manualDiv.appendChild(input);
            manualDiv.appendChild(submitBtn);
            manualDiv.appendChild(cancelLink);
            manualDiv.appendChild(closeBtnManual);
            container.appendChild(manualDiv);

          }
        };

        // Append button container to panel FIRST
        infoPanel.appendChild(buttonContainer);
        console.log('[Popup] Button container appended to panel');

        // Append panel to body
        document.body.appendChild(infoPanel);
        console.log('[Popup] Panel appended to body');

        // Initialize with capture button AFTER everything is in the DOM
        console.log('[Popup] Calling renderButtonState(initial)...');
        window['renderButtonState']('initial');
        console.log('[Popup] ✓ Panel injected successfully');
        }, clientDataWithOrigin);
      };

      // Inject popup initially
      await injectPopup();

      console.log('[Puppeteer] ✓ Injected client info panel with capture button');

      // Re-inject popup on every navigation (since it gets removed on page change)
      // Listen for both 'load' and 'domcontentloaded' events
      page.on('load', async () => {
        console.log('[Puppeteer] Page load event, re-injecting popup...');
        await injectPopup().catch(e => console.log('[Puppeteer] Failed to re-inject on load:', e.message));
      });

      page.on('domcontentloaded', async () => {
        console.log('[Puppeteer] DOM content loaded, re-injecting popup...');
        await injectPopup().catch(e => console.log('[Puppeteer] Failed to re-inject on DOMContentLoaded:', e.message));
      });

      // Also poll for URL changes (SP might use client-side routing that doesn't trigger page events)
      let lastKnownUrl = page.url();
      const urlPollInterval = setInterval(async () => {
        try {
          if (!browser.isConnected()) {
            clearInterval(urlPollInterval);
            return;
          }
          const currentUrl = page.url();
          if (currentUrl !== lastKnownUrl) {
            console.log('[Puppeteer] URL changed (client-side routing detected):', currentUrl);
            lastKnownUrl = currentUrl;
            await injectPopup().catch(e => console.log('[Puppeteer] Failed to re-inject on URL change:', e.message));
          }
        } catch (e) {
          // Page might be navigating or closed - ignore
        }
      }, 500);

      // Clean up interval when page closes
      page.on('close', () => {
        console.log('[Puppeteer] Page closed, clearing URL poll interval');
        clearInterval(urlPollInterval);
      });

      console.log('[Puppeteer] ============================================');
      console.log('[Puppeteer] NEXT STEPS:');
      console.log('[Puppeteer] 1. Complete the Simple Practice workflow');
      console.log('[Puppeteer] 2. Click "Capture Simple Practice ID" button');
      console.log('[Puppeteer] 3. Click "Close Browser" when done');
      console.log('[Puppeteer] ============================================');

      // Poll for user close action
      console.log('[Puppeteer] Waiting for user to capture ID and close...');

      let capturedId: string | null = null;

      // Main polling loop
      while (true) {
        // Check for flags
        const flags = await page.evaluate(() => ({
          closeRequested: window['closeRequested'] || false,
          capturedId: window['capturedSimplePracticeId'] || null,
        }));

        capturedId = flags.capturedId;

        // Handle close request
        if (flags.closeRequested) {
          console.log('[Puppeteer] Close requested, closing browser...');
          await browser.close();

          return NextResponse.json({
            success: true,
            simplePracticeId: capturedId,
            message: capturedId
              ? 'Client created and ID captured successfully!'
              : 'Browser closed.'
          });
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, 500));

        // Check if browser was closed externally
        if (!browser.isConnected()) {
          console.log('[Puppeteer] Browser disconnected');
          return NextResponse.json({
            success: capturedId ? true : false,
            simplePracticeId: capturedId,
            message: 'Browser was closed.'
          });
        }
      }

    } catch (error: any) {
      console.error('[Puppeteer] Error during automation:', error);
      await browser.close();

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('[Puppeteer] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
