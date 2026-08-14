const API_BASE = window.location.origin;

const form = document.getElementById('ingest-form');
const phaseList = document.getElementById('phase-list');
const statusPanel = document.getElementById('status-panel');
const statusBadge = document.getElementById('status-badge');
const logOutput = document.getElementById('log-output');
const resultSummary = document.getElementById('result-summary');
const submitBtn = document.getElementById('submit-btn');
const resetBtn = document.getElementById('reset-btn');

/** @type {object|null} */
let uiConfig = null;

/**
 * Fetch JSON from ingest API.
 * @param {string} path API path
 * @returns {Promise<object>}
 */
async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

/**
 * Populate select element options.
 * @param {HTMLSelectElement} select Select element
 * @param {Array<{value:string,label:string}>} options Options
 * @param {string} [placeholder='']
 */
function fillSelect(select, options, placeholder = '') {
  select.innerHTML = '';
  if (placeholder) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = placeholder;
    select.append(opt);
  }
  options.forEach(({ value, label }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    select.append(opt);
  });
}

/**
 * Load UI config and franchise list.
 */
async function initForm() {
  uiConfig = await apiGet('/api/config');

  phaseList.innerHTML = uiConfig.phases.map((phase) => (
    `<li><strong>${phase.id}. ${phase.label}</strong> — ${phase.description}</li>`
  )).join('');

  fillSelect(form.target, uiConfig.targets);
  fillSelect(
    form.siteTemplate,
    uiConfig.siteTemplates.map((item) => ({ value: item.id, label: item.label })),
    '— Auto —',
  );
  fillSelect(
    form.theme,
    uiConfig.themes.map((theme) => ({ value: theme, label: theme })),
    '— Scrape from source —',
  );

  const franchiseSelect = form.existingFranchise;
  uiConfig.franchises.forEach((franchise) => {
    const opt = document.createElement('option');
    opt.value = franchise.slug;
    opt.textContent = `${franchise.label || franchise.slug}${franchise.sourceUrl ? '' : ' (no stored URL)'}`;
    franchiseSelect.append(opt);
  });
}

/**
 * Apply stored franchise settings when an existing site is selected.
 */
async function onFranchiseSelected() {
  const slug = form.existingFranchise.value;
  if (!slug) return;

  form.franchise.value = slug;
  try {
    const franchise = await apiGet(`/api/franchise/${encodeURIComponent(slug)}`);
    if (franchise.sourceUrl) form.url.value = franchise.sourceUrl;
    if (franchise.siteTemplate) form.siteTemplate.value = franchise.siteTemplate;
    if (franchise.theme) form.theme.value = franchise.theme;
  } catch (err) {
    logOutput.textContent = `Could not load franchise: ${err.message}`;
    statusPanel.hidden = false;
  }
}

/**
 * When site template changes, suggest default theme.
 */
function onTemplateChange() {
  const templateId = form.siteTemplate.value;
  const template = uiConfig?.siteTemplates?.find((item) => item.id === templateId);
  if (template?.defaultTheme && !form.theme.value) {
    form.theme.value = template.defaultTheme;
  }
}

/**
 * Build API payload from form data.
 * @returns {object}
 */
function buildPayload() {
  const discovery = form.discovery.value;
  const initFranchiseOnly = form.initFranchiseOnly.checked;

  return {
    url: form.url.value.trim(),
    target: form.target.value,
    project: form.project.value.trim(),
    franchise: form.franchise.value.trim(),
    siteTemplate: form.siteTemplate.value,
    theme: form.theme.value,
    generateTheme: form.generateTheme.checked,
    initFranchiseOnly,
    crawl: discovery === 'crawl',
    sitemap: discovery === 'sitemap',
    sitemapUrl: form.sitemapUrl.value.trim(),
    maxPages: Number.parseInt(form.maxPages.value, 10) || 5,
    validate: form.validate.checked,
    validateThreshold: Number.parseFloat(form.validateThreshold.value) || 0.8,
    validateMaxPasses: Number.parseInt(form.validateMaxPasses.value, 10) || 3,
    exportMetadata: form.exportMetadata.checked,
    packageAem: form.packageAem.checked,
    pushAem: form.pushAem.checked,
  };
}

/**
 * Render job logs.
 * @param {object} job Job status
 */
function renderJob(job) {
  logOutput.textContent = job.logs.map((entry) => {
    const prefix = entry.level === 'error' ? 'ERROR' : entry.level === 'warn' ? 'WARN' : 'INFO';
    return `[${prefix}] ${entry.message}`;
  }).join('\n');
  logOutput.scrollTop = logOutput.scrollHeight;

  if (job.status === 'running') {
    statusBadge.textContent = 'Running';
    statusBadge.className = 'eds-ingest-badge';
    return;
  }

  if (job.status === 'completed') {
    statusBadge.textContent = 'Completed';
    statusBadge.className = 'eds-ingest-badge is-success';
    resultSummary.hidden = false;

    const pages = job.result?.pages || [];
    const report = job.result?.report?.totals || {};
    const franchise = job.result?.franchise;
    const prefix = franchise?.publicPrefix || '/drafts/ingest';

    resultSummary.innerHTML = `
      <p><strong>Ingest finished successfully.</strong></p>
      <ul>
        <li>Pages ingested: ${pages.length || report.pages || 1}</li>
        <li>Avg validation score: ${report.avgValidationScore ?? 'n/a'}</li>
        <li>Assets: ${report.assets ?? 'n/a'}</li>
      </ul>
      ${pages[0]?.pagePublicPath ? `<p>Preview path: <code>${pages[0].pagePublicPath.replace(/\/index\.plain\.html$/, '/index')}</code></p>` : ''}
      ${franchise?.publicPrefix ? `<p>Franchise prefix: <code>${franchise.publicPrefix}</code></p>` : `<p>Content prefix: <code>${prefix}</code></p>`}
      <p>Run <code>npm run dev:drafts</code> locally, then open the preview path in your browser.</p>
    `;
    submitBtn.disabled = false;
    return;
  }

  statusBadge.textContent = 'Failed';
  statusBadge.className = 'eds-ingest-badge is-error';
  resultSummary.hidden = false;
  resultSummary.innerHTML = `<p><strong>Ingest failed:</strong> ${job.error || 'Unknown error'}</p>`;
  submitBtn.disabled = false;
}

/**
 * Poll job status until complete.
 * @param {string} jobId Job id
 */
async function pollJob(jobId) {
  const interval = window.setInterval(async () => {
    try {
      const job = await apiGet(`/api/jobs/${jobId}`);
      renderJob(job);
      if (job.status !== 'running') {
        window.clearInterval(interval);
      }
    } catch (err) {
      window.clearInterval(interval);
      statusBadge.textContent = 'Failed';
      statusBadge.className = 'eds-ingest-badge is-error';
      resultSummary.hidden = false;
      resultSummary.innerHTML = `<p><strong>Polling failed:</strong> ${err.message}</p>`;
      submitBtn.disabled = false;
    }
  }, 1500);
}

/**
 * Handle form submit.
 * @param {SubmitEvent} event Submit event
 */
async function onSubmit(event) {
  event.preventDefault();
  submitBtn.disabled = true;
  statusPanel.hidden = false;
  resultSummary.hidden = true;
  statusBadge.textContent = 'Starting';
  statusBadge.className = 'eds-ingest-badge';
  logOutput.textContent = 'Starting ingest…';

  const payload = buildPayload();
  if (payload.initFranchiseOnly) {
    payload.url = '';
  }

  try {
    const res = await fetch(`${API_BASE}/api/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Failed to start ingest');
    await pollJob(body.jobId);
  } catch (err) {
    statusBadge.textContent = 'Failed';
    statusBadge.className = 'eds-ingest-badge is-error';
    logOutput.textContent = err.message;
    submitBtn.disabled = false;
  }
}

form.addEventListener('submit', onSubmit);
form.existingFranchise.addEventListener('change', onFranchiseSelected);
form.siteTemplate.addEventListener('change', onTemplateChange);
form.initFranchiseOnly.addEventListener('change', () => {
  form.url.required = !form.initFranchiseOnly.checked;
});
resetBtn.addEventListener('click', () => {
  form.reset();
  form.project.value = 'ntt-eds-ue';
  form.maxPages.value = '5';
  form.validateThreshold.value = '0.8';
  form.validateMaxPasses.value = '3';
  form.validate.checked = true;
  form.exportMetadata.checked = true;
  statusPanel.hidden = true;
});

initForm().catch((err) => {
  statusPanel.hidden = false;
  logOutput.textContent = `Failed to load tool configuration: ${err.message}\n\nStart the ingest UI server with: npm run ingest:ui`;
});
