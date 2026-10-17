import { extractInvoice, type ExtractedInvoice } from './extract';

export interface ScanResult {
  success: true;
  data: ExtractedInvoice;
  source: 'demo' | 'gemini';
}

/** Synthetic test document. This is never presented as an AI scan. */
export function getDemoData(): ScanResult {
  return {
    success: true,
    data: {
      invoiceNumber: 'INV-001',
      vendorName: 'Example Design Studio',
      customerName: 'Harborline Construction Co.',
      invoiceAmount: 8400,
      currency: 'USD',
      invoiceDate: '2026-10-01',
      dueDate: '2026-12-15',
      termsDays: 75,
      rawPaymentTerms: 'Net 75',
      discountTerms: null,
      fieldWarnings: [],
      extractionMode: 'demo'
    },
    source: 'demo'
  };
}

/** Actual scan: do not silently substitute demo figures when Gemini fails. */
export async function scanInvoice(image: string, mimeType: string): Promise<ScanResult> {
  return {
    success: true,
    data: await extractInvoice(image, mimeType),
    source: 'gemini'
  };
}
