import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';

export async function POST(req: NextRequest) {
  try {
    const { clientData } = await req.json();

    if (!clientData) {
      return NextResponse.json(
        { success: false, error: 'Missing client data' },
        { status: 400 }
      );
    }

    console.log('[Puppeteer] Starting Simple Practice automation...');

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

      // DON'T submit automatically - let user review and submit manually
      console.log('[Puppeteer] Waiting for manual form submission...');
      console.log('[Puppeteer] Please review the form and click the submit button');

      // Wait for navigation after manual submit
      await page.waitForURL(/\/clients\/\d+/, { timeout: 120000 }); // 2 minutes for manual review

      // Extract client ID from URL
      const url = page.url();
      const clientIdMatch = url.match(/\/clients\/(\d+)/);
      const simplePracticeId = clientIdMatch ? clientIdMatch[1] : null;

      console.log('[Puppeteer] Client created with ID:', simplePracticeId);

      // Keep browser open for 5 seconds so user can see the result
      await page.waitForTimeout(5000);

      await browser.close();

      return NextResponse.json({
        success: true,
        simplePracticeId,
        url
      });

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
