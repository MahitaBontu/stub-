import { extractInvoice } from "./extract";

export interface InvoiceData {
  invoiceAmount: number;
  termsDays: number;
  dueDate: string | null;
  discountTerms: string | null;
  customerName: string | null;
  confidence: string;
}

export function getDemoData() {
  return {
    success: true,
    data: {
      invoiceAmount: 8400,
      termsDays: 75,
      dueDate: '2026-03-01',
      discountTerms: null,
      customerName: 'Harborline Construction Co.',
      confidence: 'high'
    } as InvoiceData,
    source: 'demo'
  };
}



export async function scanInvoice(
  image: string,
  mimeType: string
) {
  const extractedData = await extractInvoice(image, mimeType);

  return {
    success: true,
    data: extractedData,
    source: "gemini" as const
  };
}
