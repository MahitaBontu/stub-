"use strict";

const BENCHMARK_RATE = 0.095;
const INVOICES_PER_YEAR = 12;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const DEMO_CURRENT_ID = "inv-2048";
const SCREEN_IDS = {
  landing: "screen-landing",
  scan: "screen-scan",
  review: "screen-review",
  results: "screen-results",
  negotiation: "screen-negotiation",
  letter: "screen-letter",
  ranking: "screen-ranking",
  error: "screen-error"
};
const FLOW_STEPS = {
  scan: 0,
  review: 1,
  results: 2,
  negotiation: 3,
  letter: 4
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric"
});

const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric"
});

const state = {
  screen: "landing",
  current: null,
  session: [],
  proposedDays: 30,
  uploadName: "",
  scanTimers: [],
  scanning: false,
  clockTimer: null,
  copyTimer: null,
  toastTimer: null
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const els = {
  flowbar: $("#flowbar"),
  flowKicker: $("#flow-kicker"),
  flowSession: $("#flow-session"),
  steps: $$(".step"),
  sessionPill: $("#session-pill"),
  restartButton: $("#restart-button"),
  invoiceFile: $("#invoice-file"),
  dropzone: $("#dropzone"),
  scanIdle: $("#scan-idle"),
  scanLoading: $("#scan-loading"),
  scanFileLabel: $("#scan-file-label"),
  reviewForm: $("#review-form"),
  formError: $("#form-error"),
  reviewSourceNote: $("#review-source-note"),
  reviewSourceLabel: $("#review-source-label"),
  fieldCustomer: $("#field-customer"),
  fieldAmount: $("#field-amount"),
  fieldTerms: $("#field-terms"),
  fieldDueDate: $("#field-due-date"),
  fieldDiscount: $("#field-discount"),
  flagCustomer: $("#flag-customer"),
  flagDiscount: $("#flag-discount"),
  helperCustomer: $("#helper-customer"),
  helperDiscount: $("#helper-discount"),
  snapshotAmount: $("#snapshot-amount"),
  snapshotCustomer: $("#snapshot-customer"),
  snapshotTerms: $("#snapshot-terms"),
  snapshotDue: $("#snapshot-due"),
  snapshotDiscount: $("#snapshot-discount"),
  invoiceContext: $("#invoice-context"),
  exactAmount: $("#exact-amount"),
  exactCopy: $("#exact-copy"),
  exactFootnote: $("#exact-footnote"),
  estimateAmount: $("#estimate-amount"),
  estimateCopy: $("#estimate-copy"),
  benchmarkComparison: $("#benchmark-comparison"),
  estimateDays: $("#estimate-days"),
  timelineIssued: $("#timeline-issued"),
  timelineDue: $("#timeline-due"),
  clockValue: $("#clock-value"),
  clockRate: $("#clock-rate"),
  clockTotal: $("#clock-total"),
  currentTermsLabel: $("#current-terms-label"),
  proposedTermsLabel: $("#proposed-terms-label"),
  termsSlider: $("#terms-slider"),
  rangeLabels: $("#range-labels"),
  sliderHelper: $("#slider-helper"),
  freedCash: $("#freed-cash"),
  annualSavings: $("#annual-savings"),
  draftLetterButton: $("#draft-letter-button"),
  letterOutput: $("#letter-output"),
  letterCustomer: $("#letter-customer"),
  letterCurrent: $("#letter-current"),
  letterProposed: $("#letter-proposed"),
  letterAnnual: $("#letter-annual"),
  copyLetterButton: $("#copy-letter-button"),
  copyLetterLabel: $("#copy-letter-label"),
  rankingSessionCount: $("#ranking-session-count"),
  rankingSummary: $("#ranking-summary"),
  rankCustomers: $("#rank-customers"),
  rankInvoices: $("#rank-invoices"),
  rankTotal: $("#rank-total"),
  rankBoard: $("#rank-board"),
  rankingList: $("#ranking-list"),
  rankingEmpty: $("#ranking-empty"),
  errorTitle: $("#error-title"),
  errorMessage: $("#error-message"),
  errorDetail: $("#error-detail"),
  toast: $("#toast")
};

function makeDemoInvoices() {
  return [
    {
      id: DEMO_CURRENT_ID,
      number: "INV-2048",
      customer: "Ridgeline Fabrication",
      amount: 48000,
      termsDays: 75,
      dueDate: "2026-10-28",
      discountTerms: "",
      confidence: { customer: true, discountTerms: true },
      source: "demo"
    },
    {
      id: "inv-1981",
      number: "INV-1981",
      customer: "Ridgeline Fabrication",
      amount: 32500,
      termsDays: 90,
      dueDate: "2026-10-30",
      discountTerms: "",
      confidence: {},
      source: "demo"
    },
    {
      id: "inv-2072",
      number: "INV-2072",
      customer: "Juniper Studio",
      amount: 26750,
      termsDays: 30,
      dueDate: "2026-10-24",
      discountTerms: "2/10 Net 30",
      confidence: {},
      source: "demo"
    },
    {
      id: "inv-2117",
      number: "INV-2117",
      customer: "Harbor & Pine",
      amount: 18400,
      termsDays: 30,
      dueDate: "2026-10-18",
      discountTerms: "",
      confidence: {},
      source: "demo"
    }
  ];
}

function formatMoney(value) {
  return moneyFormatter.format(Number.isFinite(value) ? value : 0);
}

function parseDate(isoDate) {
  return new Date(`${isoDate}T12:00:00`);
}

function formatShortDate(isoDate) {
  if (!isoDate) return "—";
  const date = parseDate(isoDate);
  return Number.isNaN(date.getTime()) ? "—" : shortDateFormatter.format(date);
}

function formatFullDate(isoDate) {
  if (!isoDate) return "—";
  const date = parseDate(isoDate);
  return Number.isNaN(date.getTime()) ? "—" : fullDateFormatter.format(date);
}

function isValidDate(isoDate) {
  return /^\d{4}-\d{2}-\d{2}$/.test(isoDate) && !Number.isNaN(parseDate(isoDate).getTime());
}

function issueDateFor(invoice) {
  const due = parseDate(invoice.dueDate);
  if (Number.isNaN(due.getTime())) return "";
  due.setDate(due.getDate() - invoice.termsDays);
  return due.toISOString().slice(0, 10);
}

function calcCostOfFloat(invoiceAmount, daysUntilPaid, rate = BENCHMARK_RATE) {
  return invoiceAmount * (daysUntilPaid / 365) * rate;
}

function calcFreedCash(invoiceAmount, currentDays, proposedDays) {
  const daysSaved = Math.max(0, currentDays - proposedDays);
  return invoiceAmount * (daysSaved / 365);
}

function calcAnnualSavings(invoiceAmount, currentDays, proposedDays, invoicesPerYear = INVOICES_PER_YEAR) {
  const currentCost = calcCostOfFloat(invoiceAmount, currentDays);
  const proposedCost = calcCostOfFloat(invoiceAmount, proposedDays);
  return Math.max(0, currentCost - proposedCost) * invoicesPerYear;
}

function defaultProposedDays(currentDays) {
  const minimum = currentDays > 10 ? 10 : 1;
  if (currentDays <= minimum) return currentDays;
  return Math.max(minimum, Math.min(30, currentDays - 10));
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function benchmarkLabel(days) {
  const multiple = days / 30;
  if (multiple >= 1.15) {
    return `${multiple.toFixed(1).replace(".0", "")}× the usual Net 30 wait`;
  }
  if (multiple <= 0.85) {
    return `${multiple.toFixed(1).replace(".0", "")}× shorter than Net 30`;
  }
  return "In line with the usual Net 30 wait";
}

function rankCustomers(invoices) {
  const groups = new Map();

  invoices.forEach((invoice) => {
    const customer = (invoice.customer || "").trim() || "Unnamed customer";
    const key = customer.toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, {
        customer,
        count: 0,
        amount: 0,
        floatCost: 0,
        termsTotal: 0,
        termsMin: invoice.termsDays,
        termsMax: invoice.termsDays
      });
    }

    const group = groups.get(key);
    group.count += 1;
    group.amount += invoice.amount;
    group.floatCost += calcCostOfFloat(invoice.amount, invoice.termsDays);
    group.termsTotal += invoice.termsDays;
    group.termsMin = Math.min(group.termsMin, invoice.termsDays);
    group.termsMax = Math.max(group.termsMax, invoice.termsDays);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      averageTerms: group.termsTotal / group.count
    }))
    .sort((a, b) => b.floatCost - a.floatCost);
}

function upsertSessionInvoice(invoice) {
  const index = state.session.findIndex((item) => item.id === invoice.id);
  if (index >= 0) {
    state.session[index] = invoice;
  } else {
    state.session.push(invoice);
  }
}

function seedDemoSession() {
  makeDemoInvoices().forEach((invoice) => {
    if (!state.session.some((item) => item.id === invoice.id)) {
      state.session.push(invoice);
    }
  });
}

function showScreen(name, options = {}) {
  if (state.screen === "results" && name !== "results") {
    stopClock();
  }

  Object.entries(SCREEN_IDS).forEach(([key, id]) => {
    const screen = document.getElementById(id);
    if (!screen) return;
    const active = key === name;
    screen.hidden = !active;
    screen.classList.toggle("is-active", active);
  });

  state.screen = name;
  updateHeader();
  updateFlowbar(name);
  window.scrollTo(0, 0);

  if (name === "results") {
    startClock();
  }

  if (options.focus !== false) {
    const activeScreen = document.getElementById(SCREEN_IDS[name]);
    const heading = activeScreen ? activeScreen.querySelector("h1") : null;
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  }
}

function updateHeader() {
  const count = state.session.length;
  els.sessionPill.hidden = count === 0;
  els.sessionPill.textContent = pluralize(count, "invoice");
  els.restartButton.hidden = !state.current && count === 0;
  els.flowSession.textContent = count > 0 ? pluralize(count, "invoice") : "";
}

function updateFlowbar(name) {
  const stepIndex = FLOW_STEPS[name];
  const visible = Number.isInteger(stepIndex);
  els.flowbar.hidden = !visible;
  if (!visible) return;

  els.flowKicker.textContent = state.current ? state.current.number : "New invoice";
  els.steps.forEach((step) => {
    const index = Number(step.dataset.step);
    step.classList.toggle("is-done", index < stepIndex);
    step.classList.toggle("is-active", index === stepIndex);
    if (index === stepIndex) {
      step.setAttribute("aria-current", "step");
    } else {
      step.removeAttribute("aria-current");
    }
  });
}

function clearScanTimers() {
  state.scanTimers.forEach((timer) => window.clearTimeout(timer));
  state.scanTimers = [];
  state.scanning = false;
}

function setScanStep(step) {
  [0, 1, 2].forEach((index) => {
    const item = document.getElementById(`scan-step-${index}`);
    if (!item) return;
    item.classList.toggle("is-done", index < step);
    item.classList.toggle("is-active", index === step);
    if (index === step) {
      item.setAttribute("aria-current", "step");
    } else {
      item.removeAttribute("aria-current");
    }
  });
}

function prepareScanIdle() {
  clearScanTimers();
  els.scanLoading.hidden = true;
  els.scanIdle.hidden = false;
  els.invoiceFile.value = "";
  setScanStep(0);
}

function startScan(mode, fileName = "") {
  clearScanTimers();
  state.scanning = true;
  state.uploadName = mode === "upload" ? fileName : "";

  if (mode === "upload") {
    const uploadInvoice = {
      id: `inv-upload-${Date.now()}`,
      number: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
      customer: "Ridgeline Fabrication",
      amount: 48000,
      termsDays: 75,
      dueDate: "2026-10-28",
      discountTerms: "",
      confidence: { customer: true, discountTerms: true },
      source: "upload"
    };
    state.current = uploadInvoice;
  }

  showScreen("scan");
  els.scanIdle.hidden = true;
  els.scanLoading.hidden = false;
  els.scanFileLabel.textContent = mode === "demo"
    ? "Loading the demo invoice — Net 75, no discount."
    : `Reading “${fileName}”`;

  setScanStep(0);
  state.scanTimers.push(window.setTimeout(() => setScanStep(1), 420));
  state.scanTimers.push(window.setTimeout(() => setScanStep(2), 860));
  state.scanTimers.push(window.setTimeout(() => {
    clearScanTimers();
    if (!state.current) {
      showError("We couldn’t read that invoice.", "Try another file or use the demo invoice instead.", "");
      return;
    }
    populateReview(state.current);
    showScreen("review");
  }, 1380));
}

function runDemo() {
  seedDemoSession();
  state.current = state.session.find((invoice) => invoice.id === DEMO_CURRENT_ID) || state.session[0];
  updateHeader();
  startScan("demo");
}

function handleFile(file) {
  if (!file) return;

  const typeAllowed = file.type.startsWith("image/") || file.type === "application/pdf" || /\.(png|jpe?g|webp|pdf)$/i.test(file.name);
  if (!typeAllowed) {
    showError(
      "We couldn’t read that invoice.",
      "That file type isn’t supported. Try a JPG, PNG, WebP, or PDF.",
      file.name
    );
    els.invoiceFile.value = "";
    return;
  }

  if (file.size > MAX_FILE_BYTES) {
    showError(
      "That invoice is too large.",
      "The limit is 10 MB. Try compressing the image or exporting a smaller PDF.",
      `${file.name} · ${(file.size / (1024 * 1024)).toFixed(1)} MB`
    );
    els.invoiceFile.value = "";
    return;
  }

  startScan("upload", file.name);
}

function showError(title, message, detail) {
  clearScanTimers();
  stopClock();
  els.errorTitle.textContent = title;
  els.errorMessage.textContent = message;
  els.errorDetail.textContent = detail || "";
  els.errorDetail.hidden = !detail;
  showScreen("error");
}

function populateReview(invoice) {
  state.current = invoice;
  els.fieldCustomer.value = invoice.customer || "";
  els.fieldAmount.value = Number.isFinite(invoice.amount) ? invoice.amount : "";
  els.fieldTerms.value = Number.isFinite(invoice.termsDays) ? invoice.termsDays : "";
  els.fieldDueDate.value = invoice.dueDate || "";
  els.fieldDiscount.value = invoice.discountTerms || "";

  clearReviewErrors();

  const customerFlag = Boolean(invoice.confidence && invoice.confidence.customer);
  const discountFlag = Boolean(invoice.confidence && invoice.confidence.discountTerms);
  els.flagCustomer.hidden = !customerFlag;
  els.flagDiscount.hidden = !discountFlag;
  $('.field[data-field="customer"]').classList.toggle("is-flagged", customerFlag);
  $('.field[data-field="discountTerms"]').classList.toggle("is-flagged", discountFlag);
  els.helperCustomer.textContent = customerFlag
    ? "Not fully read — confirm the customer name."
    : "Who is this invoice from?";
  els.helperDiscount.textContent = discountFlag
    ? "No discount clause detected. Leave blank if there isn’t one."
    : "Leave blank if the invoice has no discount clause. Stub will never guess one.";

  if (invoice.source === "upload") {
    const sourceName = state.uploadName ? `“${state.uploadName}”` : "the uploaded file";
    els.reviewSourceNote.textContent = `Prototype reading from ${sourceName} — the fields are sample values, not a live Gemini read. Confirm everything before continuing.`;
    els.reviewSourceLabel.textContent = "Upload preview";
  } else {
    els.reviewSourceNote.textContent = "Demo invoice loaded. Confirm the fields before running the numbers.";
    els.reviewSourceLabel.textContent = "Demo invoice";
  }

  const currentNumber = invoice.number || "New invoice";
  els.reviewSourceLabel.setAttribute("title", currentNumber);
  syncReviewSnapshot();
}

function clearReviewErrors() {
  els.formError.hidden = true;
  els.formError.replaceChildren();
  $$(".field", els.reviewForm).forEach((field) => {
    field.classList.remove("is-invalid");
    const input = field.querySelector("input");
    const error = field.querySelector(".field-error");
    if (input) input.removeAttribute("aria-invalid");
    if (error) {
      error.hidden = true;
      error.textContent = "";
    }
  });
}

function fieldParts(name) {
  const field = $(`.field[data-field="${name}"]`, els.reviewForm);
  return {
    field,
    input: field ? field.querySelector("input") : null,
    error: field ? field.querySelector(".field-error") : null
  };
}

function clearFieldError(name) {
  const { field, input, error } = fieldParts(name);
  if (field) field.classList.remove("is-invalid");
  if (input) input.removeAttribute("aria-invalid");
  if (error) {
    error.hidden = true;
    error.textContent = "";
  }
  if (els.formError && !$$(".field.is-invalid", els.reviewForm).length) {
    els.formError.hidden = true;
  }
}

function setFieldError(name, message) {
  const { field, input, error } = fieldParts(name);
  if (field) field.classList.add("is-invalid");
  if (input) input.setAttribute("aria-invalid", "true");
  if (error) {
    error.textContent = message;
    error.hidden = false;
  }
}

function readReviewForm() {
  const amountValue = els.fieldAmount.value.trim();
  const termsValue = els.fieldTerms.value.trim();

  return {
    customer: els.fieldCustomer.value.trim(),
    amount: amountValue === "" ? NaN : Number(amountValue),
    termsDays: termsValue === "" ? NaN : Number(termsValue),
    dueDate: els.fieldDueDate.value,
    discountTerms: els.fieldDiscount.value.trim()
  };
}

function validateReview(data) {
  const errors = [];

  if (!data.customer) {
    errors.push(["customer", "Enter the customer name."]);
  } else if (data.customer.length < 2) {
    errors.push(["customer", "Use at least 2 characters."]);
  }

  if (!Number.isFinite(data.amount) || data.amount <= 0) {
    errors.push(["amount", "Enter an amount greater than $0."]);
  } else if (data.amount > 10000000) {
    errors.push(["amount", "That amount is too large. Check the invoice total."]);
  }

  if (!Number.isInteger(data.termsDays) || data.termsDays < 1 || data.termsDays > 365) {
    errors.push(["termsDays", "Enter whole days between 1 and 365."]);
  }

  if (!data.dueDate) {
    errors.push(["dueDate", "Choose the invoice due date."]);
  } else if (!isValidDate(data.dueDate)) {
    errors.push(["dueDate", "Enter a valid due date."]);
  }

  if (data.discountTerms.length > 60) {
    errors.push(["discountTerms", "Keep the discount terms under 60 characters."]);
  }

  return errors;
}

function validateField(name, data) {
  const errors = validateReview(data);
  const match = errors.find(([field]) => field === name);
  if (match) {
    setFieldError(name, match[1]);
    return false;
  }
  clearFieldError(name);
  return true;
}

function focusField(name) {
  const { input } = fieldParts(name);
  if (input) input.focus();
}

function showFormErrors(errors) {
  clearReviewErrors();
  errors.forEach(([name, message]) => setFieldError(name, message));

  els.formError.replaceChildren();
  const title = document.createElement("strong");
  title.textContent = errors.length === 1 ? "One field needs a check." : `${errors.length} fields need a check.`;
  const list = document.createElement("ul");

  errors.forEach(([name, message]) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    const anchorName = name === "termsDays" ? "terms" : name === "dueDate" ? "due-date" : name === "discountTerms" ? "discount" : name;
    link.href = `#field-${anchorName}`;
    link.textContent = `${name === "termsDays" ? "Payment terms" : name === "dueDate" ? "Due date" : name === "discountTerms" ? "Early-payment discount" : `${name.charAt(0).toUpperCase()}${name.slice(1)}`} — ${message}`;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      focusField(name);
    });
    item.append(link);
    list.append(item);
  });

  els.formError.append(title, list);
  els.formError.hidden = false;
}

function handleReviewSubmit(event) {
  event.preventDefault();
  const data = readReviewForm();
  const errors = validateReview(data);

  if (errors.length > 0) {
    showFormErrors(errors);
    focusField(errors[0][0]);
    return;
  }

  const invoice = state.current || {
    id: `inv-upload-${Date.now()}`,
    number: `INV-${Math.floor(1000 + Math.random() * 9000)}`,
    source: "upload"
  };

  invoice.customer = data.customer;
  invoice.amount = data.amount;
  invoice.termsDays = data.termsDays;
  invoice.dueDate = data.dueDate;
  invoice.discountTerms = data.discountTerms;
  invoice.confidence = {};

  state.current = invoice;
  upsertSessionInvoice(invoice);
  state.proposedDays = defaultProposedDays(invoice.termsDays);
  updateHeader();
  renderResults();
  showScreen("results");
}

function syncReviewSnapshot() {
  const data = readReviewForm();
  els.snapshotAmount.textContent = Number.isFinite(data.amount) && data.amount > 0 ? formatMoney(data.amount) : "—";
  els.snapshotCustomer.textContent = data.customer || "Unnamed customer";
  els.snapshotTerms.textContent = Number.isInteger(data.termsDays) && data.termsDays > 0 ? `Net ${data.termsDays}` : "—";
  els.snapshotDue.textContent = isValidDate(data.dueDate) ? formatFullDate(data.dueDate) : "—";
  els.snapshotDiscount.textContent = data.discountTerms || "None";
}

function renderResults() {
  const invoice = state.current;
  if (!invoice) return;

  const costOfFloat = calcCostOfFloat(invoice.amount, invoice.termsDays);
  const issueDate = issueDateFor(invoice);

  els.invoiceContext.textContent = `${invoice.number || "Invoice"} · ${invoice.customer}`;
  els.exactAmount.textContent = formatMoney(invoice.amount);
  els.exactCopy.textContent = `${formatMoney(invoice.amount)} is tied up with ${invoice.customer} for ${invoice.termsDays} days after each invoice.`;
  const discountLine = invoice.discountTerms ? ` Discount clause: ${invoice.discountTerms}.` : "";
  els.exactFootnote.textContent = `Principal due ${formatFullDate(invoice.dueDate)}. This is not an estimate.${discountLine}`;
  els.estimateAmount.textContent = formatMoney(costOfFloat);
  els.estimateCopy.innerHTML = `Cost of float is what the wait costs you. At the <strong>9.5%</strong> national average cost of capital — a standard estimate of what cash could earn — ${invoice.termsDays} days of delay comes to this estimate.`;
  els.benchmarkComparison.textContent = benchmarkLabel(invoice.termsDays);
  els.estimateDays.textContent = `${invoice.termsDays}-day wait`;
  els.timelineIssued.textContent = issueDate ? `Issued ${formatShortDate(issueDate)}` : "Issued";
  els.timelineDue.textContent = `Due ${formatShortDate(invoice.dueDate)}`;
  els.clockTotal.textContent = formatMoney(costOfFloat);

  const secondsInTerm = invoice.termsDays * 86400;
  const perSecond = secondsInTerm > 0 ? costOfFloat / secondsInTerm : 0;
  els.clockValue.textContent = `$${perSecond > 0 ? "0.000000" : "0.00"}`;
  els.clockRate.textContent = perSecond > 0
    ? `≈ ${formatMoney(perSecond * 3600)} per hour`
    : "No cost to show at these inputs";
}

function stopClock() {
  if (state.clockTimer) {
    window.clearInterval(state.clockTimer);
    state.clockTimer = null;
  }
}

function startClock() {
  stopClock();
  const invoice = state.current;
  if (!invoice) return;

  const costOfFloat = calcCostOfFloat(invoice.amount, invoice.termsDays);
  const secondsInTerm = invoice.termsDays * 86400;
  const perSecond = secondsInTerm > 0 ? costOfFloat / secondsInTerm : 0;
  const startedAt = performance.now();

  const tick = () => {
    const elapsed = (performance.now() - startedAt) / 1000;
    els.clockValue.textContent = `$${(perSecond * elapsed).toFixed(6)}`;
  };

  tick();
  state.clockTimer = window.setInterval(tick, 80);
}

function openNegotiation() {
  if (!state.current) return;
  if (!Number.isFinite(state.proposedDays)) {
    state.proposedDays = defaultProposedDays(state.current.termsDays);
  }
  renderNegotiation();
  showScreen("negotiation");
}

function renderNegotiation() {
  const invoice = state.current;
  if (!invoice) return;

  const minimum = invoice.termsDays > 10 ? 10 : 1;
  const maximum = invoice.termsDays;
  state.proposedDays = clamp(Math.round(state.proposedDays || defaultProposedDays(invoice.termsDays)), minimum, maximum);

  els.currentTermsLabel.textContent = `Net ${invoice.termsDays}`;
  els.termsSlider.min = String(minimum);
  els.termsSlider.max = String(maximum);
  els.termsSlider.value = String(state.proposedDays);
  els.termsSlider.disabled = maximum <= minimum;
  els.termsSlider.setAttribute("aria-valuetext", `Net ${state.proposedDays}`);

  const labels = Array.from(new Set([minimum, 30, maximum])).filter((value) => value >= minimum && value <= maximum).sort((a, b) => a - b);
  const thumbSize = 25;
  els.rangeLabels.replaceChildren();
  labels.forEach((value) => {
    const label = document.createElement("span");
    const fraction = maximum > minimum ? (value - minimum) / (maximum - minimum) : 0;
    label.textContent = `Net ${value}`;
    if (value === minimum) {
      label.style.left = "0";
    } else if (value === maximum) {
      label.style.right = "0";
    } else {
      label.style.left = `calc(${(fraction * 100).toFixed(4)}% + ${(thumbSize / 2 - thumbSize * fraction).toFixed(2)}px)`;
      label.style.transform = "translateX(-50%)";
    }
    els.rangeLabels.append(label);
  });

  updateNegotiation();
}

function updateNegotiation() {
  const invoice = state.current;
  if (!invoice) return;

  const minimum = Number(els.termsSlider.min);
  const maximum = Number(els.termsSlider.max);
  const proposed = clamp(Number(els.termsSlider.value), minimum, maximum);
  state.proposedDays = proposed;

  const freedCash = calcFreedCash(invoice.amount, invoice.termsDays, proposed);
  const annualSavings = calcAnnualSavings(invoice.amount, invoice.termsDays, proposed);
  const daysSaved = Math.max(0, invoice.termsDays - proposed);
  const progress = maximum > minimum ? ((proposed - minimum) / (maximum - minimum)) * 100 : 100;

  els.termsSlider.style.setProperty("--range-progress", `${progress}%`);
  els.termsSlider.setAttribute("aria-valuetext", `Net ${proposed}, ${daysSaved} days sooner`);
  els.proposedTermsLabel.textContent = `Net ${proposed}`;
  els.freedCash.textContent = formatMoney(freedCash);
  els.annualSavings.textContent = formatMoney(annualSavings);
  els.sliderHelper.textContent = daysSaved > 0
    ? `${daysSaved} days sooner — no change to the invoice amount.`
    : "Same terms — no impact to show.";

  const hasImpact = daysSaved > 0;
  els.draftLetterButton.disabled = !hasImpact;
  els.draftLetterButton.setAttribute("aria-disabled", String(!hasImpact));
}

function buildLeverageLetter() {
  const invoice = state.current;
  if (!invoice) return "";

  const proposed = state.proposedDays;
  const costOfFloat = calcCostOfFloat(invoice.amount, invoice.termsDays);
  const freedCash = calcFreedCash(invoice.amount, invoice.termsDays, proposed);
  const annualSavings = calcAnnualSavings(invoice.amount, invoice.termsDays, proposed);

  return `Hi ${invoice.customer} team,

I wanted to raise something practical about our payment terms. Our current Net ${invoice.termsDays} arrangement keeps ${formatMoney(invoice.amount)} tied up for ${invoice.termsDays} days after each invoice. At a 9.5% annual cost of capital — a standard estimate of what that cash could earn elsewhere — the delay costs us about ${formatMoney(costOfFloat)} per invoice.

We value working with you, and I think there is a straightforward improvement for both of us: moving to Net ${proposed} would free about ${formatMoney(freedCash)} in cash per invoice cycle. Across ${INVOICES_PER_YEAR} invoices a year, that is roughly ${formatMoney(annualSavings)} back into the business.

Would you be open to updating our terms to Net ${proposed} for future invoices? Happy to talk through what works on your side.

Thanks,
[Your name]`;
}

function openLetter() {
  if (!state.current) return;
  const invoice = state.current;
  const proposed = state.proposedDays;
  const annualSavings = calcAnnualSavings(invoice.amount, invoice.termsDays, proposed);
  const letter = buildLeverageLetter();

  els.letterCustomer.textContent = invoice.customer;
  els.letterCurrent.textContent = `Net ${invoice.termsDays}`;
  els.letterProposed.textContent = `Net ${proposed}`;
  els.letterAnnual.textContent = formatMoney(annualSavings);
  els.letterOutput.value = letter;
  els.letterOutput.scrollTop = 0;
  resetCopyButton();
  showScreen("letter");
}

async function copyLetter() {
  const text = els.letterOutput.value;
  if (!text) return;

  let copied = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      copied = true;
    }
  } catch (error) {
    copied = false;
  }

  if (!copied) {
    try {
      els.letterOutput.focus();
      els.letterOutput.select();
      copied = document.execCommand("copy");
    } catch (error) {
      copied = false;
    }
  }

  if (copied) {
    els.copyLetterLabel.textContent = "Copied";
    showToast("Message copied to clipboard.");
    window.clearTimeout(state.copyTimer);
    state.copyTimer = window.setTimeout(resetCopyButton, 2200);
  } else {
    showToast("Couldn’t copy automatically — select the text and use Ctrl/Cmd+C.");
  }
}

function resetCopyButton() {
  if (els.copyLetterLabel) {
    els.copyLetterLabel.textContent = "Copy message";
  }
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  window.requestAnimationFrame(() => els.toast.classList.add("is-visible"));
  window.clearTimeout(state.toastTimer);
  state.toastTimer = window.setTimeout(() => {
    els.toast.classList.remove("is-visible");
    window.setTimeout(() => {
      els.toast.hidden = true;
    }, 200);
  }, 3200);
}

function renderRanking() {
  const invoiceCount = state.session.length;
  els.rankingSessionCount.textContent = pluralize(invoiceCount, "invoice");
  els.rankInvoices.textContent = String(invoiceCount);

  if (invoiceCount < 2) {
    els.rankingSummary.hidden = true;
    els.rankBoard.hidden = true;
    els.rankingEmpty.hidden = false;

    const title = els.rankingEmpty.querySelector("h2");
    const copy = els.rankingEmpty.querySelector("p");
    if (invoiceCount === 0) {
      title.textContent = "There’s nothing to rank yet.";
      copy.textContent = "Scan an invoice to see what a late payment costs you. Add a second customer’s invoice to compare the pattern across your business.";
    } else {
      title.textContent = "One invoice isn’t a pattern yet.";
      copy.textContent = "Scan a second customer’s invoice to see where your money is actually going. Or load the demo set to see a complete ranking.";
    }
    return;
  }

  const groups = rankCustomers(state.session);
  const totalCost = groups.reduce((sum, group) => sum + group.floatCost, 0);

  els.rankingSummary.hidden = false;
  els.rankBoard.hidden = false;
  els.rankingEmpty.hidden = true;
  els.rankCustomers.textContent = String(groups.length);
  els.rankTotal.textContent = formatMoney(totalCost);
  els.rankInvoices.textContent = String(invoiceCount);
  els.rankingList.replaceChildren();

  groups.forEach((group, index) => {
    const share = totalCost > 0 ? (group.floatCost / totalCost) * 100 : 0;
    const termsLabel = group.termsMin === group.termsMax
      ? `Net ${group.termsMin}`
      : `Net ${group.termsMin}–${group.termsMax}`;
    const averageTerms = Number.isInteger(group.averageTerms)
      ? String(group.averageTerms)
      : group.averageTerms.toFixed(1);

    const row = document.createElement("li");
    row.className = "rank-row";
    row.setAttribute("aria-label", `${group.customer}: ${formatMoney(group.floatCost)} estimated float cost across ${pluralize(group.count, "invoice")}.`);

    const position = document.createElement("span");
    position.className = "rank-position";
    position.textContent = String(index + 1).padStart(2, "0");

    const customer = document.createElement("div");
    customer.className = "rank-customer";
    const customerName = document.createElement("strong");
    customerName.textContent = group.customer;
    const customerMeta = document.createElement("span");
    customerMeta.textContent = `${pluralize(group.count, "invoice")} · ${termsLabel}`;
    customer.append(customerName, customerMeta);

    const terms = document.createElement("div");
    terms.className = "rank-metric rank-terms";
    const termsLabelEl = document.createElement("span");
    termsLabelEl.textContent = "Average terms";
    const termsValue = document.createElement("strong");
    termsValue.textContent = `${averageTerms} days`;
    terms.append(termsLabelEl, termsValue);

    const cost = document.createElement("div");
    cost.className = "rank-metric rank-cost";
    const costLabel = document.createElement("span");
    costLabel.textContent = "Est. float cost";
    const costValue = document.createElement("strong");
    costValue.textContent = formatMoney(group.floatCost);
    cost.append(costLabel, costValue);

    const shareCell = document.createElement("div");
    shareCell.className = "rank-share";
    const bar = document.createElement("span");
    bar.className = "rank-bar";
    const fill = document.createElement("i");
    fill.style.width = `${Math.max(2, share)}%`;
    bar.append(fill);
    const shareValue = document.createElement("span");
    shareValue.className = "rank-share-value";
    shareValue.textContent = `${Math.round(share)}%`;
    shareCell.append(bar, shareValue);

    row.append(position, customer, terms, cost, shareCell);
    els.rankingList.append(row);
  });
}

function openRanking() {
  renderRanking();
  showScreen("ranking");
}

function seedDemoFromRanking() {
  seedDemoSession();
  if (!state.current) {
    state.current = state.session.find((invoice) => invoice.id === DEMO_CURRENT_ID) || state.session[0];
  }
  updateHeader();
  renderRanking();
  showToast("Demo invoices added to this session.");
}

function restart() {
  clearScanTimers();
  stopClock();
  window.clearTimeout(state.copyTimer);
  window.clearTimeout(state.toastTimer);
  state.current = null;
  state.session = [];
  state.proposedDays = 30;
  state.uploadName = "";
  els.reviewForm.reset();
  clearReviewErrors();
  els.letterOutput.value = "";
  resetCopyButton();
  els.toast.classList.remove("is-visible");
  els.toast.hidden = true;
  state.toastTimer = null;
  prepareScanIdle();
  updateHeader();
  showScreen("landing");
}

function goHome() {
  clearScanTimers();
  stopClock();
  updateHeader();
  showScreen("landing");
}

function handleAction(action) {
  switch (action) {
    case "home":
      goHome();
      break;
    case "restart":
      restart();
      break;
    case "choose-scan":
      prepareScanIdle();
      showScreen("scan");
      break;
    case "demo":
      runDemo();
      break;
    case "seed-demo":
      seedDemoFromRanking();
      break;
    case "back-landing":
      goHome();
      break;
    case "back-scan":
      prepareScanIdle();
      showScreen("scan");
      break;
    case "back-review":
      if (state.current) {
        populateReview(state.current);
        showScreen("review");
      } else {
        showScreen("landing");
      }
      break;
    case "back-results":
      if (state.current) {
        renderResults();
        showScreen("results");
      } else {
        showScreen("landing");
      }
      break;
    case "back-negotiation":
      if (state.current) {
        renderNegotiation();
        showScreen("negotiation");
      } else {
        showScreen("landing");
      }
      break;
    case "open-negotiation":
      openNegotiation();
      break;
    case "open-letter":
      if (state.proposedDays >= (state.current ? state.current.termsDays : 0)) break;
      openLetter();
      break;
    case "copy-letter":
      copyLetter();
      break;
    case "open-ranking":
      openRanking();
      break;
    default:
      break;
  }
}

document.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-action]");
  if (!trigger) return;
  handleAction(trigger.dataset.action);
});

els.invoiceFile.addEventListener("change", () => {
  handleFile(els.invoiceFile.files && els.invoiceFile.files[0]);
});

els.dropzone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    els.invoiceFile.click();
  }
});

["dragenter", "dragover"].forEach((type) => {
  els.dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    els.dropzone.classList.add("is-dragover");
  });
});

["dragleave", "drop"].forEach((type) => {
  els.dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    els.dropzone.classList.remove("is-dragover");
  });
});

els.dropzone.addEventListener("drop", (event) => {
  const file = event.dataTransfer && event.dataTransfer.files ? event.dataTransfer.files[0] : null;
  if (file) handleFile(file);
});

els.reviewForm.addEventListener("submit", handleReviewSubmit);

const reviewSubmitButton = $('#review-form button[type="submit"]');
if (reviewSubmitButton) {
  reviewSubmitButton.addEventListener("click", (event) => {
    event.preventDefault();
    handleReviewSubmit(event);
  });
}

els.reviewForm.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.target.tagName === "BUTTON") return;
  event.preventDefault();
  handleReviewSubmit(event);
});

els.reviewForm.addEventListener("input", (event) => {
  const field = event.target.closest(".field");
  if (!field) return;
  const name = field.dataset.field;
  clearFieldError(name);
  if (name === "customer") {
    els.flagCustomer.hidden = true;
    field.classList.remove("is-flagged");
    els.helperCustomer.textContent = "Who is this invoice from?";
  }
  if (name === "discountTerms") {
    els.flagDiscount.hidden = true;
    field.classList.remove("is-flagged");
  }
  syncReviewSnapshot();
});

els.reviewForm.addEventListener("focusout", (event) => {
  const field = event.target.closest(".field");
  if (!field || !field.querySelector("input")) return;
  const name = field.dataset.field;
  if (!name) return;
  validateField(name, readReviewForm());
});

els.termsSlider.addEventListener("input", updateNegotiation);

window.addEventListener("beforeunload", stopClock);

updateHeader();
prepareScanIdle();
