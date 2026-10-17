import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';

import { scanInvoice, getDemoData } from './prompts';
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
}
let scannedInvoices: ScannedInvoice[] = [];

app.post('/scan', async (req: Request, res: Response) => {
  try {
    const { image, mimeType, demo } = req.body;
    if (demo === true) {
  return res.json(getDemoData());
}

if (!image) {
  return res.status(400).json({
    success: false,
    error: "Please upload an invoice."
  });
}
    const result = await scanInvoice(image, mimeType || 'image/png');
    res.json(result);
  } catch (err: any) {
    console.error('Scan error:', err.message);
    res.json(getDemoData());
  }
});

app.post('/analyze', (req: Request, res: Response) => {
  try {
    const { invoiceAmount, termsDays, discountTerms, customerName } = req.body;
    const result = analyzeInvoice(Number(invoiceAmount), Number(termsDays), discountTerms);
    scannedInvoices.push({ customerName, invoiceAmount, termsDays, costOfFloat: result.costOfFloat.estimatedCost });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/negotiate', (req: Request, res: Response) => {
  try {
    const { invoiceAmount, currentDays, proposedDays, invoicesPerYear } = req.body;
    const result = calcNegotiationImpact(Number(invoiceAmount), Number(currentDays), Number(proposedDays), Number(invoicesPerYear) || 12);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/letter', (req: Request, res: Response) => {
  try {
    const { customerName, invoiceAmount, currentDays, proposedDays, annualSavings } = req.body;
    const letterText = buildLeverageLetter(customerName, invoiceAmount, currentDays, proposedDays, annualSavings);
    res.json({ success: true, letterText });
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