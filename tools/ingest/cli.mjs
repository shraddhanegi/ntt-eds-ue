#!/usr/bin/env node
import { config as loadEnv } from 'dotenv';
import { Command } from 'commander';
import { runIngest, normalizeIngestOptions, assertIngestOptions } from './lib/ingest-run.mjs';

loadEnv();

const program = new Command();
program
  .name('eds-ingest')
  .description('Scrape an external URL and generate EDS plain HTML content for DA and/or UE')
  .option('--url <url>', 'Source page URL to ingest')
  .requiredOption(
    '--target <target>',
    'Authoring destination: local | da | aem | both',
  )
  .option('--franchise <slug>', 'Franchise site slug')
  .option('--site-template <id>', 'Site template from config/site-templates.json')
  .option('--theme <class>', 'Reuse a parent theme instead of scraping colors')
  .option('--generate-theme', 'Scrape theme CSS even when --theme is set', false)
  .option('--init-franchise-only', 'Scaffold franchise without ingesting a URL', false)
  .option('--no-validate', 'Skip source-vs-EDS validation')
  .option('--validate-threshold <n>', 'Validation pass score 0–1', '0.8')
  .option('--validate-max-passes <n>', 'Max validation fix passes per page', '3')
  .option('--crawl', 'Discover and ingest same-site links', false)
  .option('--sitemap', 'Discover pages from sitemap.xml', false)
  .option('--sitemap-url <url>', 'Override sitemap URL')
  .option('--max-pages <n>', 'Maximum additional pages to crawl', '10')
  .option('--no-export-metadata', 'Skip metadata-seo.csv/json export')
  .option('--package-aem', 'Create content ZIP for UE handoff', false)
  .option('--push-aem', 'Upload package to AEM Cloud', false)
  .option('--config <path>', 'Path to ingest.config.json')
  .option('--project <name>', 'Project folder name')
  .parse(process.argv);

const opts = normalizeIngestOptions(program.opts());

try {
  assertIngestOptions(opts);
} catch (err) {
  program.error(err.message);
}

runIngest(opts)
  .then((result) => {
    // eslint-disable-next-line no-console
    console.log('\n[ingest] Done.');
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[ingest] Failed:', err.message);
    process.exit(1);
  });
