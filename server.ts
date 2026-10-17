import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';

import { scanInvoice, getDemoData } from './prompts';
import { retrieveRelevantInvoices } from './backend/calculations/retrieve';
import { analyzeInvoice, calcNegotiationImpact, buildLeverageLetter, rankCustomers } from './findings';
import { recordDeposit } from './nessie';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

interface ScannedInvoice {
  customerName: string;
  invoiceAmount: number;
  termsDays: number;
  costOfFloat: number;
  industry?: string;
}
let scannedInvoices: ScannedInvoice[] = [];


app.post("/scan", async (req: Request, res: Response) => {
  try {
    const { image, mimeType, demo } = req.body;

    // Only return demo data when explicitly requested
    if (demo === true) {
      return res.json(getDemoData());
    }

    // Make sure an image was provided
    if (!image) {
      return res.status(400).json({
        success: false,
        error: "Please upload an invoice."
      });
    }

    // Extract actual invoice data using Gemini
    const result = await scanInvoice(
      image,
      mimeType || "image/png"
    );

    return res.json(result);

  } catch (err: unknown) {
    console.error("Scan error:", err);

    return res.status(500).json({
      success: false,
      error: "Invoice extraction failed."
    });
  }
});

app.post('/analyze', (req: Request, res: Response) => {
  try {
    const { invoiceAmount, termsDays, discountTerms, customerName } = req.body;
    const result = analyzeInvoice(Number(invoiceAmount), Number(termsDays), discountTerms);
    scannedInvoices.push({ customerName, invoiceAmount, termsDays, costOfFloat: result.costOfFloat.estimatedCost, industry: req.body.industry });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/negotiate', (req: Request, res: Response) => {
  try {
    const { invoiceAmount, currentDays, proposedDays, invoicesPerYear, customerName, industry } = req.body;
    const result = calcNegotiationImpact(Number(invoiceAmount), Number(currentDays), Number(proposedDays), Number(invoicesPerYear) || 12);

    const context = retrieveRelevantInvoices(scannedInvoices, customerName || '', industry);

    res.json({ success: true, ...result, retrievedContext: context.summary, historyCount: context.matchedInvoices.length });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/letter', (req: Request, res: Response) => {
  try {
    const { customerName, invoiceAmount, currentDays, proposedDays, annualSavings, industry } = req.body;
    const context = retrieveRelevantInvoices(scannedInvoices, customerName, industry);
    let letterText = buildLeverageLetter(customerName, invoiceAmount, currentDays, proposedDays, annualSavings);

    if (context.matchedInvoices.length > 0) {
      letterText += `\n\n(Based on this relationship's history: ${context.summary})`;
    }

    res.json({ success: true, letterText, retrievedContext: context.summary });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/rank', (req: Request, res: Response) => {
  try {
    res.json({ success: true, ranking: rankCustomers(scannedInvoices) });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/buffer', async (req: Request, res: Response) => {
  try {
    const { monthlyAmount, months = 12, accountId } = req.body;
    const balances = [];
    let running = 0;
    for (let i = 1; i <= months; i++) {
      running = Math.round((running + Number(monthlyAmount)) * 100) / 100;
      balances.push({ month: i, deposit: Number(monthlyAmount), balance: running });
    }
    if (accountId) {
      await recordDeposit(accountId, monthlyAmount);
    }
    res.json({ success: true, balances });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Stub running on http://localhost:${PORT}`));

export default app;