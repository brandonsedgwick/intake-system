/**
 * PDF Screener Generation Service
 *
 * Generates professionally-formatted PDF documents from client intake data
 * using Playwright's PDF rendering capabilities.
 */

import { chromium } from 'playwright';
import { prisma } from '@/lib/db/prisma';

export interface ClientDataForPDF {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  dateOfBirth?: string | null;
  age?: string | null;
  paymentType?: string | null;
  insuranceProvider?: string | null;
  insuranceMemberId?: string | null;
  presentingConcerns?: string | null;
  suicideAttemptRecent?: string | null;
  psychiatricHospitalization?: string | null;
  additionalInfo?: string | null;
}

/**
 * Generate HTML template for screener PDF
 */
function generateScreenerHTML(client: ClientDataForPDF): string {
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formatField = (value: string | null | undefined): string => {
    if (!value || value.trim() === '') return '<em style="color: #999;">Not provided</em>';
    return value.replace(/\n/g, '<br>');
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Intake Screener - ${client.firstName} ${client.lastName}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #000;
      background: #fff;
    }

    .container {
      padding: 0.5in;
    }

    .header {
      text-align: center;
      margin-bottom: 32px;
      padding-bottom: 16px;
      border-bottom: 2px solid #000;
    }

    .header h1 {
      font-size: 18pt;
      font-weight: bold;
      margin-bottom: 8px;
    }

    .header .meta {
      font-size: 10pt;
      color: #666;
    }

    .section {
      margin-bottom: 24px;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 12pt;
      font-weight: bold;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid #333;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .field {
      margin-bottom: 12px;
    }

    .field-label {
      font-weight: bold;
      margin-bottom: 4px;
      font-size: 10pt;
      color: #333;
    }

    .field-value {
      font-size: 11pt;
      padding-left: 12px;
      color: #000;
    }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 12px;
    }

    .footer {
      margin-top: 48px;
      padding-top: 16px;
      border-top: 1px solid #ccc;
      font-size: 9pt;
      color: #666;
      text-align: center;
    }

    @media print {
      body {
        margin: 0;
        padding: 0;
      }

      .container {
        padding: 0.5in;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>INTAKE SCREENER DOCUMENT</h1>
      <div class="meta">Generated: ${generatedDate}</div>
    </div>

    <!-- Client Demographics -->
    <div class="section">
      <div class="section-title">Client Demographics</div>

      <div class="grid">
        <div class="field">
          <div class="field-label">Full Name</div>
          <div class="field-value">${client.firstName} ${client.lastName}</div>
        </div>

        <div class="field">
          <div class="field-label">Date of Birth</div>
          <div class="field-value">${formatField(client.dateOfBirth)}</div>
        </div>
      </div>

      <div class="grid">
        <div class="field">
          <div class="field-label">Age</div>
          <div class="field-value">${formatField(client.age)}</div>
        </div>

        <div class="field">
          <div class="field-label">Email</div>
          <div class="field-value">${client.email}</div>
        </div>
      </div>

      <div class="field">
        <div class="field-label">Phone</div>
        <div class="field-value">${formatField(client.phone)}</div>
      </div>
    </div>

    <!-- Insurance Information -->
    <div class="section">
      <div class="section-title">Insurance Information</div>

      <div class="field">
        <div class="field-label">Payment Type</div>
        <div class="field-value">${formatField(client.paymentType)}</div>
      </div>

      ${
        client.paymentType && client.paymentType.toLowerCase() !== 'self-pay'
          ? `
      <div class="field">
        <div class="field-label">Insurance Provider</div>
        <div class="field-value">${formatField(client.insuranceProvider)}</div>
      </div>

      <div class="field">
        <div class="field-label">Member ID</div>
        <div class="field-value">${formatField(client.insuranceMemberId)}</div>
      </div>
          `
          : '<div class="field"><div class="field-value"><em>Self-pay client</em></div></div>'
      }
    </div>

    <!-- Clinical Intake -->
    <div class="section">
      <div class="section-title">Clinical Intake</div>

      <div class="field">
        <div class="field-label">Presenting Concerns</div>
        <div class="field-value">${formatField(client.presentingConcerns)}</div>
      </div>

      <div class="field">
        <div class="field-label">Recent Suicide Attempt</div>
        <div class="field-value">${formatField(client.suicideAttemptRecent)}</div>
      </div>

      <div class="field">
        <div class="field-label">Psychiatric Hospitalization</div>
        <div class="field-value">${formatField(client.psychiatricHospitalization)}</div>
      </div>

      <div class="field">
        <div class="field-label">Additional Information</div>
        <div class="field-value">${formatField(client.additionalInfo)}</div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div>Document generated by Serenity Intake System</div>
      <div>Timestamp: ${new Date().toISOString()}</div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate PDF from client data using Playwright
 */
export async function generateScreenerPDF(client: ClientDataForPDF): Promise<{
  pdfBase64: string;
  generatedAt: string;
}> {
  console.log('[PDF] Starting PDF generation for client:', client.id);

  // Generate HTML content
  const html = generateScreenerHTML(client);

  // Launch headless browser
  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const page = await browser.newPage();

    // Set content
    await page.setContent(html, { waitUntil: 'networkidle' });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: false,
      margin: {
        top: '0.5in',
        bottom: '0.5in',
        left: '0.5in',
        right: '0.5in',
      },
    });

    // Convert to base64
    const pdfBase64 = pdfBuffer.toString('base64');
    const generatedAt = new Date().toISOString();

    console.log('[PDF] PDF generated successfully, size:', pdfBase64.length, 'bytes');

    return {
      pdfBase64,
      generatedAt,
    };
  } finally {
    await browser.close();
  }
}

/**
 * Save PDF to database
 */
export async function saveScreenerPDF(
  clientId: string,
  pdfBase64: string,
  generatedAt: string
): Promise<void> {
  console.log('[PDF] Saving PDF to database for client:', clientId);

  await prisma.client.update({
    where: { id: clientId },
    data: {
      screenerPdfData: pdfBase64,
      screenerGeneratedAt: generatedAt,
    },
  });

  console.log('[PDF] ✓ PDF saved successfully');
}
