#!/usr/bin/env node
/**
 * Local API + static UI for EDS URL Ingest (Tools > General).
 * Authors use the browser form instead of the terminal.
 */
import { config as loadEnv } from 'dotenv';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { getIngestUiConfig, runIngest } from './lib/ingest-run.mjs';
import { resolveFranchiseForUpdate } from './lib/franchise-site.mjs';

import { uiStaticDir } from './lib/project-root.mjs';

loadEnv();

const port = Number.parseInt(process.env.INGEST_UI_PORT || '3002', 10);
const uiDir = uiStaticDir();

/** @type {Map<string, object>} */
const jobs = new Map();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/**
 * Send JSON response with CORS headers.
 * @param {import('http').ServerResponse} res Response
 * @param {number} status HTTP status
 * @param {object} body JSON body
 */
function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

/**
 * Parse JSON request body.
 * @param {import('http').IncomingMessage} req Request
 * @returns {Promise<object>}
 */
async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

/**
 * Serve static UI asset.
 * @param {import('http').IncomingMessage} req Request
 * @param {import('http').ServerResponse} res Response
 */
async function serveStatic(req, res) {
  let reqPath = decodeURIComponent(req.url?.split('?')[0] || '/');
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.normalize(path.join(uiDir, reqPath.replace(/^\//, '')));
  if (!filePath.startsWith(uiDir)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: 'Not found' });
  }
}

/**
 * Start background ingest job.
 * @param {object} options Ingest options from UI
 * @returns {string} Job id
 */
function startJob(options) {
  const id = randomUUID();
  const job = {
    id,
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    logs: [],
    result: null,
    error: null,
  };
  jobs.set(id, job);

  runIngest(options, {
    onLog: (entry) => {
      job.logs.push(entry);
    },
  })
    .then((result) => {
      job.status = 'completed';
      job.result = result;
      job.finishedAt = new Date().toISOString();
    })
    .catch((err) => {
      job.status = 'failed';
      job.error = err.message;
      job.finishedAt = new Date().toISOString();
      job.logs.push({
        level: 'error',
        message: err.message,
        time: new Date().toISOString(),
      });
    });

  return id;
}

const server = http.createServer(async (req, res) => {
  const { method } = req;
  const url = req.url?.split('?')[0] || '/';

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (method === 'GET' && url === '/api/config') {
    sendJson(res, 200, await getIngestUiConfig());
    return;
  }

  if (method === 'GET' && url.startsWith('/api/franchise/')) {
    const slug = decodeURIComponent(url.replace('/api/franchise/', ''));
    const franchise = await resolveFranchiseForUpdate(slug);
    if (!franchise) {
      sendJson(res, 404, { error: 'Franchise not found' });
      return;
    }
    sendJson(res, 200, franchise);
    return;
  }

  if (method === 'GET' && url.startsWith('/api/jobs/')) {
    const id = url.replace('/api/jobs/', '');
    const job = jobs.get(id);
    if (!job) {
      sendJson(res, 404, { error: 'Job not found' });
      return;
    }
    sendJson(res, 200, job);
    return;
  }

  if (method === 'POST' && url === '/api/ingest') {
    try {
      const body = await readJsonBody(req);
      const jobId = startJob(body);
      sendJson(res, 202, { jobId, message: 'Ingest started' });
    } catch (err) {
      sendJson(res, 400, { error: err.message });
    }
    return;
  }

  if (method === 'GET' && (url === '/' || url.startsWith('/eds-ingest') || url.endsWith('.css') || url.endsWith('.js') || url.endsWith('.html'))) {
    await serveStatic(req, res);
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[ingest-ui] EDS URL Ingest tool ready`);
  // eslint-disable-next-line no-console
  console.log(`[ingest-ui] Open: http://localhost:${port}/`);
  // eslint-disable-next-line no-console
  console.log('[ingest-ui] Tools > General > EDS URL Ingest');
});
