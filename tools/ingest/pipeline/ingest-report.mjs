import fs from 'fs/promises';
import path from 'path';
import { defaultOutputRoot } from '../lib/project-root.mjs';

/**
 * Write ingest-report.json summarizing a site ingest run.
 * @param {object} report Report payload
 * @param {object} [config] Ingest config
 * @returns {Promise<string>} Absolute path to written report
 */
export async function writeIngestReport(report, config = {}) {
  const outputRoot = config.outputRoot || defaultOutputRoot(config);
  const reportPath = path.join(outputRoot, 'ingest-report.json');
  await fs.mkdir(outputRoot, { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return reportPath;
}
