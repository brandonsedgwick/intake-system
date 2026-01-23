# Chrome Extension Testing Guide

## Setup Instructions

### 1. Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **"Developer mode"** (toggle in top right corner)
3. Click **"Load unpacked"**
4. Navigate to and select: `/Users/brandonsedgwick/development/generic-form-filler-extension/dist`
5. The extension should now appear in your extensions list

### 2. Get the Extension ID

1. In `chrome://extensions`, find "Generic Form Filler"
2. Copy the **Extension ID** (looks like: `ejjpmlmnogidonckoacipbaaagfojfkp`)
3. If your extension ID is different from the one already configured, update it:
   - Open your `.env.local` file (or create it from `.env.example`)
   - Add/update: `NEXT_PUBLIC_FORM_FILLER_EXTENSION_ID=your-actual-extension-id`
   - Restart your Next.js dev server

### 3. Verify Extension is Loaded

1. Click the puzzle piece icon in Chrome toolbar
2. You should see "Generic Form Filler"
3. Click it to open the popup - you should see "Simple Practice Client Creation" in the mappings list

---

## Testing the Create Client Flow

### Test 1: Extension Communication Test

1. Navigate to `http://localhost:3001/extension-test`
2. Click the **"Test Extension"** button
3. **Expected Result**: Green success box showing the extension responded
   - Should show `filled: []` (no fields filled since you're not on Simple Practice)
   - Should show `errors: []` if communication works
   - If you see an error, check that:
     - Extension is loaded in Chrome
     - Extension ID matches in your `.env.local`
     - You restarted your dev server after adding the env variable

### Test 2: Create Client in Scheduling Workflow

1. Navigate to `http://localhost:3001/scheduling`
2. Select a client from the list
3. In the "Scheduling Progress" section, find **"Create Client in SimplePractice"**
4. Click the **"Start"** button

### Test 3: Choose Extension Method

1. In the modal that appears, you'll see two options:
   - **Browser Automation (Puppeteer)** - Not implemented yet
   - **Chrome Extension Auto-Fill** - This is what we're testing
2. Click **"Chrome Extension Auto-Fill"**

### Test 4: Extension Fills Form (Simulated)

1. The extension will attempt to fill form fields
2. Since you're not on the Simple Practice page, it won't find the fields
3. The **"Simple Practice ID Modal"** should appear automatically

### Test 5: Enter Manual ID

1. In the modal, enter a test Simple Practice ID (e.g., `12345`)
2. Click **"Save Client ID"**
3. **Expected Results**:
   - Toast notification: "Simple Practice ID saved"
   - The "Create Client in SimplePractice" step shows a green checkmark
   - An **"Undo"** button appears next to the step

### Test 6: Undo Client Creation

1. Click the **"Undo"** button next to the completed step
2. In the modal that appears, enter a reason (e.g., "Testing undo functionality")
3. Click **"Undo Client Creation"**
4. **Expected Results**:
   - Toast notification: "Simple Practice ID cleared"
   - The step shows as incomplete again (number 1 instead of checkmark)
   - The **"Start"** button reappears
   - The reason is saved to `schedulingNotes` in the database

---

## Testing on Actual Simple Practice (When Ready)

### Prepare Test Data

1. Have a test client in your scheduling workflow
2. Make sure the client has:
   - First Name
   - Last Name
   - Email
   - Phone (optional)
   - Date of Birth (optional)
   - Payment Type (optional)

### Use the Extension

1. **In your app**: Click "Start" on Create Client step
2. **Choose Extension method**
3. **In a new tab/window**: Navigate to `https://secure.simplepractice.com/clients`
4. **Click** "Create Client" button in Simple Practice
5. **The extension** should auto-fill the form fields
6. **Review** the filled data
7. **Submit** the form manually in Simple Practice
8. **Copy** the Simple Practice Client ID from the URL (e.g., `/clients/12345`)
9. **Return to your app** and enter the ID in the modal
10. **Click** "Save Client ID"

---

## Troubleshooting

### Extension Not Found Error

**Problem**: `Chrome extension API not available` or extension ID error

**Solutions**:
- Verify extension is loaded in `chrome://extensions`
- Check extension ID matches in `.env.local`
- Restart Next.js dev server after changing env variables
- Make sure you're using Chrome (not Firefox, Safari, etc.)

### Extension Popup Shows No Mappings

**Problem**: Extension popup is empty or shows "No mappings created yet"

**Solutions**:
- Reload the extension in `chrome://extensions`
- Check browser console for errors
- The default "Simple Practice Client Creation" mapping should load automatically

### Form Fields Not Filling

**Problem**: Extension runs but doesn't fill form fields

**Solutions**:
- Make sure you're on the actual Simple Practice client creation page
- Check the browser console for errors
- The field selectors in `simple-practice.json` may need updating if Simple Practice changed their form

### Simple Practice ID Not Saving

**Problem**: ID entered but step doesn't mark as complete

**Solutions**:
- Check browser console for API errors
- Verify database migration ran (should have `schedulingNotes` column)
- Check that `simplePracticeId` is being saved to database

---

## Expected Field Mapping

The extension currently maps these fields:

| Your App Field | Simple Practice Field Selector |
|----------------|-------------------------------|
| firstName      | `input#client_first_name`     |
| lastName       | `input#client_last_name`      |
| email          | `input#client_email`          |
| phone          | `input#client_phone`          |
| dateOfBirth    | `input#client_date_of_birth`  |
| paymentType    | `select#client_billing_type`  |

**Note**: These selectors are guesses based on common form patterns. You may need to update them in `/Users/brandonsedgwick/development/generic-form-filler-extension/src/defaults/simple-practice.json` to match the actual Simple Practice form.

---

## Next Steps

1. Test the extension communication (Test 1-6 above)
2. Verify the undo functionality works
3. When ready, test on actual Simple Practice page
4. Update field selectors in `simple-practice.json` if needed
5. Rebuild extension: `cd generic-form-filler-extension && npm run build`
6. Reload extension in Chrome
