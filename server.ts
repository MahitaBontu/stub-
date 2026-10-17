import 'dotenv/config';
import express, { type Request, type Response } from 'express';
// The existing project already uses cors; no new type package is required.
const cors: () => import('express').RequestHandler = require('cors');
import { getDemoData, scanInvoice } from './prompts';
import { analyzeInvoice, calcNegotiationImpact, buildLeverageLetter, rankCustomers, type CustomerInvoice } from './findings';

const app = express();
app.use(cors());
app.use(express.json({ limit: '12mb' }));
app.use(express.static('public'));

// Hackathon-only, process-local records. Do not use this with real private invoices.
const scannedInvoices: CustomerInvoice[] = [];

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Unexpected error';
}
function numeric(value: unknown, label: string): number {
  const result = typeof value === 'number' ? value :
    (typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN);
  if (!Number.isFinite(result)) throw new Error(`${label} is required and must be numeric.`);
  return result;
}
function optionalRate(value: unknown): number | undefined {
  return value === undefined || value === null || value === '' ? undefined : numeric(value, 'Annual rate');
}
function bodyObject(req: Request): Record<string, unknown> {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw new Error('A JSON object is required.');
  }
  return req.body as Record<string, unknown>;
}
function handleBadRequest(res: Response, err: unknown) {
  res.status(400).json({ success: false, error: errorMessage(err) });
}

app.post('/scan', async (req: Request, res: Response) => {
  try {
    const body = bodyObject(req);
    if (body.demo === true) return res.json(getDemoData());
    const image = body.image ?? body.imageBase64;
    if (typeof image !== 'string' || !image) {
      return res.status(400).json({ success: false, error: 'Provide base64 image data, or set demo: true.' });
    }
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'image/png';
    return res.json(await scanInvoice(image, mimeType));
  } catch (err) {
    // Never masquerade as a successful extraction if Gemini fails.
    console.error('Invoice scan failed:', errorMessage(err));
    return res.status(502).json({ success: false, error: 'Invoice extraction failed. Check your key, input file, and model, then retry.' });
  }
});

app.post('/analyze', (req: Request, res: Response) => {
  try {
    const body = bodyObject(req);
    const invoiceAmount = numeric(body.invoiceAmount, 'Invoice amount');
    const termsDays = numeric(body.termsDays, 'Payment term');
    const discountTerms = typeof body.discountTerms === 'string' ? body.discountTerms : null;
    const result = analyzeInvoice(invoiceAmount, termsDays, discountTerms, optionalRate(body.annualRate));
    scannedInvoices.push({
      customerName: typeof body.customerName === 'string' ? body.customerName : 'Unknown customer',
      costOfFloat: result.costOfFloat.estimatedCost
    });
    return res.json({ success: true, ...result });
  } catch (err) {
    return handleBadRequest(res, err);
  }
});

app.post('/negotiate', (req: Request, res: Response) => {
  try {
    const body = bodyObject(req);
    const result = calcNegotiationImpact(
      numeric(body.invoiceAmount, 'Invoice amount'),
      numeric(body.currentDays, 'Current payment term'),
      numeric(body.proposedDays, 'Proposed payment term'),
      body.invoicesPerYear === undefined ? 1 : numeric(body.invoicesPerYear, 'Invoices per year'),
      optionalRate(body.annualRate)
    );
    return res.json({ success: true, ...result });
  } catch (err) {
    return handleBadRequest(res, err);
  }
});

app.post('/letter', (req: Request, res: Response) => {
  try {
    const body = bodyObject(req);
    const letterText = buildLeverageLetter(
      typeof body.customerName === 'string' ? body.customerName : '',
      numeric(body.invoiceAmount, 'Invoice amount'),
      numeric(body.currentDays, 'Current payment term'),
      numeric(body.proposedDays, 'Proposed payment term'),
      numeric(body.annualSavings, 'Annual savings estimate')
    );
    return res.json({ success: true, letterText });
  } catch (err) {
    return handleBadRequest(res, err);
  }
});

app.post('/rank', (_req: Request, res: Response) => {
  return res.json({ success: true, ranking: rankCustomers(scannedInvoices) });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log(`Stub running on http://localhost:${PORT}`));
export default app;
