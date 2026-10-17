require('dotenv').config();
const express = require('express');
const cors = require('cors');

const { scanInvoice, getDemoData } = require('./prompts');
const { analyzeInvoice, calcNegotiationImpact, buildLeverageLetter, rankCustomers } = require('./findings');
const { recordDeposit } = require('./nessie');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// in-memory session storage for scanned invoices (no database needed for the demo)
let scannedInvoices = [];

app.post('/scan', async (req, res) => {
  try {
    const { image, mimeType, demo } = req.body;
    if (demo || !image) return res.json(getDemoData());
    const result = await scanInvoice(image, mimeType || 'image/png');
    res.json(result);
  } catch (err) {
    console.error('Scan error:', err.message);
    res.json(getDemoData());
  }
});

app.post('/analyze', (req, res) => {
  try {
    const { invoiceAmount, termsDays, discountTerms, customerName } = req.body;
    const result = analyzeInvoice(Number(invoiceAmount), Number(termsDays), discountTerms);
    scannedInvoices.push({ customerName, invoiceAmount, termsDays, costOfFloat: result.costOfFloat.estimatedCost });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/negotiate', (req, res) => {
  try {
    const { invoiceAmount, currentDays, proposedDays, invoicesPerYear } = req.body;
    const result = calcNegotiationImpact(Number(invoiceAmount), Number(currentDays), Number(proposedDays), Number(invoicesPerYear) || 12);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/letter', (req, res) => {
  try {
    const { customerName, invoiceAmount, currentDays, proposedDays, annualSavings } = req.body;
    const letterText = buildLeverageLetter(customerName, invoiceAmount, currentDays, proposedDays, annualSavings);
    res.json({ success: true, letterText });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/rank', (req, res) => {
  try {
    res.json({ success: true, ranking: rankCustomers(scannedInvoices) });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Stub running on http://localhost:${PORT}`));

module.exports = app;