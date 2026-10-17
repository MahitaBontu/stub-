function getDemoData() {
  return {
    success: true,
    data: {
      invoiceAmount: 8400,
      termsDays: 75,
      dueDate: '2026-03-01',
      discountTerms: null,
      customerName: 'Harborline Construction Co.',
      confidence: 'high'
    },
    source: 'demo'
  };
}

async function scanInvoice(image, mimeType) {
  return getDemoData();
}

module.exports = { scanInvoice, getDemoData };
