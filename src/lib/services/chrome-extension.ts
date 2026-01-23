const EXTENSION_ID = process.env.NEXT_PUBLIC_FORM_FILLER_EXTENSION_ID || 'ejjpmlmnogidonckoacipbaaagfojfkp';

export interface FillFormResult {
  success: boolean;
  filled: string[];
  errors: Array<{
    selector: string;
    error: string;
  }>;
  extractedId?: string;
}

export async function fillFormWithExtension(
  data: Record<string, any>,
  mappingId: string
): Promise<FillFormResult> {
  return new Promise((resolve, reject) => {
    if (typeof chrome === 'undefined' || !chrome.runtime) {
      reject(new Error('Chrome extension API not available. Please use Chrome browser.'));
      return;
    }

    chrome.runtime.sendMessage(
      EXTENSION_ID,
      {
        action: 'fillForm',
        data,
        mappingId
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      }
    );
  });
}

export function isExtensionAvailable(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.runtime;
}
