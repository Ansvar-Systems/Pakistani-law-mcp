#!/usr/bin/env tsx
/**
 * Pakistani Law MCP -- Full real-data ingestion from The Pakistan Code.
 *
 * Source:
 *   - Index pages: https://pakistancode.gov.pk/english/LGu0xAD?alp={A-Z}&page=1&action=inactive
 *   - Law pages: https://pakistancode.gov.pk/english/{lawPath}
 *   - Official law PDFs resolved from each law page
 *
 * Workflow:
 *   1) Crawl A-Z official index pages
 *   2) Build unique law list (deduplicated by law path)
 *   3) Fetch each law page + official PDF
 *   4) Extract text with pdftotext
 *   5) Parse sections/provisions and definitions
 *   6) Write one JSON seed per law into data/seed/
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchBinary, fetchText } from './lib/fetcher.js';
import {
  extractDefinitions,
  extractTextFromPdf,
  parseLawPagePdfUrl,
  parseProvisionsFromPdfText,
  type ParsedAct,
} from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const INDEX_DIR = path.join(SOURCE_DIR, 'index');
const LAW_DIR = path.join(SOURCE_DIR, 'laws');
const PDF_DIR = path.join(SOURCE_DIR, 'pdfs');
const TXT_DIR = path.join(SOURCE_DIR, 'txt');
const SEED_DIR = path.resolve(__dirname, '../data/seed');
const MANIFEST_PATH = path.join(SOURCE_DIR, 'manifest.json');

const PAKISTAN_CODE_BASE = 'https://pakistancode.gov.pk/english';
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

type LawStatus = 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';

interface IndexedLaw {
  lawPath: string;
  title: string;
  titleEn: string;
  category?: string;
  actNo?: string;
  promulgationDate?: string;
  status: LawStatus;
  indexLetter: string;
}

interface IngestArgs {
  limit: number | null;
  start: number;
  skipFetch: boolean;
  append: boolean;
  resume: boolean;
}

const KNOWN_ID_BY_PATH: Record<string, string> = {
  'UY2FqaJw1-apaUY2Fqa-apaUY2Fta5Y%3D-sg-jjjjjjjjjjjjj': 'pk-eto-2002',
  'UY2FqaJw1-apaUY2Fqa-apaUY2Jvbp8%3D-sg-jjjjjjjjjjjjj': 'pk-peca-2016',
  'UY2FqaJw1-apaUY2Fqa-apqWaw%3D%3D-sg-jjjjjjjjjjjjj': 'pk-pta-1996',
  'UY2FqaJw1-apaUY2Fqa-apaUY2Noa5c%3D-sg-jjjjjjjjjjjjj': 'pk-rtia-2017',
  'UY2FqaJw1-apaUY2Fqa-apaUY2FsaZY%3D-sg-jjjjjjjjjjjjj': 'pk-payment-systems-2007',
  'UY2FqaJw1-apaUY2Fqa-apaUY2FrbZ8%3D-sg-jjjjjjjjjjjjj': 'pk-pemra-2002',
  'UY2FqaJw1-apaUY2Fqa-apaUY2FqbZw%3D-sg-jjjjjjjjjjjjj': 'pk-investigation-fair-trial-2013',
  'UY2FqaJw1-apaUY2Fqa-apaUY2FsbJk%3D-sg-jjjjjjjjjjjjj': 'pk-competition-act-2010',
  'UY2FqaJw1-apaUY2Fqa-ap%2BbZw%3D%3D-sg-jjjjjjjjjjjjj': 'pk-sbp-act-1956',
  'UY2FqaJw1-apaUY2Fqa-bpuUY2Zr-sg-jjjjjjjjjjjjj': 'pk-fia-act-1974',
};

function parseArgs(): IngestArgs {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let start = 0;
  let skipFetch = false;
  let append = false;
  let resume = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = Number.parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--start' && args[i + 1]) {
      start = Math.max(0, Number.parseInt(args[i + 1], 10));
      i++;
    } else if (args[i] === '--skip-fetch') {
      skipFetch = true;
    } else if (args[i] === '--append') {
      append = true;
    } else if (args[i] === '--resume') {
      resume = true;
    }
  }

  if (resume) {
    append = true;
  }

  return { limit, start, skipFetch, append, resume };
}

function ensureDirs(): void {
  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(INDEX_DIR, { recursive: true });
  fs.mkdirSync(LAW_DIR, { recursive: true });
  fs.mkdirSync(PDF_DIR, { recursive: true });
  fs.mkdirSync(TXT_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });
}

function clearExistingSeedJson(): void {
  for (const file of fs.readdirSync(SEED_DIR)) {
    if (file.endsWith('.json')) {
      fs.unlinkSync(path.join(SEED_DIR, file));
    }
  }
}

function loadUsedIdsFromSeedJson(): Set<string> {
  const used = new Set<string>();
  for (const file of fs.readdirSync(SEED_DIR)) {
    if (!file.endsWith('.json')) continue;
    const fullPath = path.join(SEED_DIR, file);
    try {
      const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf-8')) as { id?: string };
      if (typeof parsed.id === 'string' && parsed.id.trim()) {
        used.add(parsed.id.trim());
      }
    } catch {
      // Ignore malformed or partial files in append mode.
    }
  }
  return used;
}

function findHighestSeedOrder(): number {
  let highest = 0;
  for (const file of fs.readdirSync(SEED_DIR)) {
    const match = file.match(/^(\d{4})-.*\.json$/);
    if (!match) continue;
    const order = Number.parseInt(match[1], 10);
    if (Number.isFinite(order) && order > highest) {
      highest = order;
    }
  }
  return highest;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function hashString(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTitle(rawTitle: string): string {
  return stripHtml(rawTitle).replace(/\s+/g, ' ').trim();
}

function parsePromulgationDate(raw?: string): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw
    .replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, '$1')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const parsed = Date.parse(cleaned);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return new Date(parsed).toISOString().slice(0, 10);
}

function buildShortName(title: string): string {
  const acronym = title
    .split(/\s+/)
    .filter(token => /^[A-Za-z]/.test(token))
    .slice(0, 5)
    .map(token => token[0]!.toUpperCase())
    .join('');
  return acronym.length >= 3 ? acronym : title.slice(0, 48);
}

function parseIndexedLaws(letter: string, html: string): IndexedLaw[] {
  const entries: IndexedLaw[] = [];

  const entryRegex = /<a\s+href="(UY2FqaJw1-[^"]+)">([\s\S]*?)<\/a>[\s\S]*?<div class='accordion-section-content'[^>]*>([\s\S]*?)<\/div>/gi;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(html)) !== null) {
    const lawPath = match[1].trim();
    const rawTitle = match[2];
    const rawMeta = match[3];

    const title = normalizeTitle(rawTitle);
    const metaText = stripHtml(rawMeta);

    if (!title || !lawPath.startsWith('UY2FqaJw1-')) continue;

    const category = metaText.split('|')[0]?.trim() || undefined;
    const actNoMatch = metaText.match(/([A-Z0-9\-]+(?:\s+[A-Z0-9\-]+)?\s+of\s+\d{4})/i);
    const promulgationMatch = metaText.match(/Promulgation Date:\s*([^|]+)/i);
    const promulgationDate = parsePromulgationDate(promulgationMatch?.[1]?.trim());

    const repealed = /repeal|omitted|lapse/i.test(title) || /repeal|omitted|lapse/i.test(metaText);
    const status: LawStatus = repealed ? 'repealed' : 'in_force';

    entries.push({
      lawPath,
      title,
      titleEn: title,
      category,
      actNo: actNoMatch?.[1]?.trim(),
      promulgationDate,
      status,
      indexLetter: letter,
    });
  }

  return entries;
}

async function collectAllIndexedLaws(skipFetch: boolean): Promise<IndexedLaw[]> {
  const byPath = new Map<string, IndexedLaw>();

  for (const letter of LETTERS) {
    let page = 1;
    let totalEntriesForLetter = 0;
    let fetchedPages = 0;
    const seenForLetter = new Set<string>();

    while (true) {
      const indexPagePath = path.join(INDEX_DIR, `${letter}-${page}.html`);
      const legacyPageOnePath = path.join(INDEX_DIR, `${letter}.html`);
      const url = `${PAKISTAN_CODE_BASE}/LGu0xAD?alp=${letter}&page=${page}&action=inactive`;

      let html: string | null = null;

      if (skipFetch) {
        const cachedPath = page === 1 && fs.existsSync(legacyPageOnePath)
          ? legacyPageOnePath
          : indexPagePath;
        if (!fs.existsSync(cachedPath)) break;
        html = fs.readFileSync(cachedPath, 'utf-8');
      } else {
        const response = await fetchText(url, 5);
        if (response.status !== 200) {
          throw new Error(`Index page HTTP ${response.status}: ${url}`);
        }
        html = response.body;
        fs.writeFileSync(indexPagePath, html);
        if (page === 1) {
          fs.writeFileSync(legacyPageOnePath, html);
        }
      }

      if (!html) break;

      const parsed = parseIndexedLaws(letter, html);
      if (parsed.length === 0) break;

      fetchedPages++;
      totalEntriesForLetter += parsed.length;

      let newInThisPageForLetter = 0;
      for (const law of parsed) {
        if (!seenForLetter.has(law.lawPath)) {
          seenForLetter.add(law.lawPath);
          newInThisPageForLetter++;
        }
        if (!byPath.has(law.lawPath)) {
          byPath.set(law.lawPath, law);
        }
      }

      // Prevent endless paging when the portal serves a repeated page.
      if (page > 1 && newInThisPageForLetter === 0) {
        break;
      }

      page++;
    }

    console.log(
      `Indexed letter ${letter}: ${totalEntriesForLetter} entries across ${fetchedPages} page(s) `
      + `(${byPath.size} unique cumulative)`
    );
  }

  return Array.from(byPath.values()).sort((a, b) => a.title.localeCompare(b.title));
}

function resolveLawId(law: IndexedLaw, used: Set<string>): string {
  const known = KNOWN_ID_BY_PATH[law.lawPath];
  if (known) {
    used.add(known);
    return known;
  }

  const base = `pk-${slugify(law.title).slice(0, 80) || `law-${hashString(law.lawPath).slice(0, 8)}`}`;
  if (!used.has(base)) {
    used.add(base);
    return base;
  }

  const withHash = `${base}-${hashString(law.lawPath).slice(0, 6)}`;
  used.add(withHash);
  return withHash;
}

function buildDescription(law: IndexedLaw): string {
  const categoryPart = law.category ? ` (${law.category})` : '';
  const actPart = law.actNo ? ` (${law.actNo})` : '';
  return `Official consolidated text of ${law.title}${actPart} published by The Pakistan Code${categoryPart}.`;
}

async function ingestOneLaw(
  law: IndexedLaw,
  id: string,
  order: number,
  skipFetch: boolean,
): Promise<ParsedAct> {
  const key = hashString(law.lawPath);
  const lawUrl = `${PAKISTAN_CODE_BASE}/${law.lawPath}`;
  const lawHtmlPath = path.join(LAW_DIR, `${key}.html`);
  const pdfPath = path.join(PDF_DIR, `${key}.pdf`);
  const txtPath = path.join(TXT_DIR, `${key}.txt`);

  let lawHtml: string;
  if (skipFetch && fs.existsSync(lawHtmlPath)) {
    lawHtml = fs.readFileSync(lawHtmlPath, 'utf-8');
  } else {
    const page = await fetchText(lawUrl, 5);
    if (page.status !== 200) {
      throw new Error(`Law page HTTP ${page.status}: ${lawUrl}`);
    }
    lawHtml = page.body;
    fs.writeFileSync(lawHtmlPath, lawHtml);
  }

  const pdfUrl = parseLawPagePdfUrl(lawHtml);
  if (!pdfUrl) {
    throw new Error(`No PDF link resolved for: ${lawUrl}`);
  }

  if (!(skipFetch && fs.existsSync(pdfPath))) {
    const pdf = await fetchBinary(pdfUrl, 5);
    if (pdf.status !== 200) {
      throw new Error(`PDF HTTP ${pdf.status}: ${pdfUrl}`);
    }
    fs.writeFileSync(pdfPath, pdf.body);
  }

  const text = extractTextFromPdf(pdfPath);
  fs.writeFileSync(txtPath, text);

  const provisions = parseProvisionsFromPdfText(text);
  if (provisions.length === 0) {
    throw new Error(`No provisions parsed: ${pdfUrl}`);
  }
  const definitions = extractDefinitions(provisions);

  const issuedDate = law.promulgationDate ?? undefined;
  const shortName = buildShortName(law.title);

  return {
    id,
    type: 'statute',
    title: law.title,
    title_en: law.titleEn,
    short_name: shortName,
    status: law.status,
    issued_date: issuedDate,
    in_force_date: issuedDate,
    url: lawUrl,
    description: buildDescription(law),
    provisions,
    definitions,
  };
}

async function main(): Promise<void> {
  const { limit, start, skipFetch, append, resume } = parseArgs();
  ensureDirs();

  console.log('Pakistani Law MCP -- Full Real Ingestion');
  console.log('========================================\n');
  console.log('Source: https://pakistancode.gov.pk/english/index.php');
  console.log('Mode: A-Z federal law crawl + official PDF text extraction');
  if (start > 0) console.log(`Start offset: ${start}`);
  if (append) console.log('Mode: --append (keep existing seed files)');
  if (resume) console.log('Mode: --resume (continue after highest existing seed order)');
  if (skipFetch) console.log('Fetch mode: --skip-fetch (reuse cached HTML/PDF)');
  if (limit) console.log(`Limit: ${limit}`);
  console.log('');

  const indexed = await collectAllIndexedLaws(skipFetch);
  const highestSeedOrder = resume ? findHighestSeedOrder() : 0;
  const effectiveStart = Math.max(start, highestSeedOrder);
  if (effectiveStart > 0) {
    console.log(`Effective start offset: ${effectiveStart}`);
  }

  const sliceEnd = limit !== null ? effectiveStart + limit : undefined;
  const target = indexed.slice(effectiveStart, sliceEnd);

  console.log(`\nUnique laws discovered: ${indexed.length}`);
  console.log(`Laws selected for ingestion: ${target.length}\n`);

  if (!append) {
    clearExistingSeedJson();
  }

  const usedIds = append ? loadUsedIdsFromSeedJson() : new Set<string>();
  const manifest: {
    generated_at: string;
    total_indexed: number;
    total_selected: number;
    start_offset: number;
    append_mode: boolean;
    success: number;
    failed: number;
    failures: Array<{ lawPath: string; title: string; error: string }>;
  } = {
    generated_at: new Date().toISOString(),
    total_indexed: indexed.length,
    total_selected: target.length,
    start_offset: effectiveStart,
    append_mode: append,
    success: 0,
    failed: 0,
    failures: [],
  };

  let totalProvisions = 0;
  let totalDefinitions = 0;

  for (let i = 0; i < target.length; i++) {
    const law = target[i]!;
    const order = effectiveStart + i + 1;
    const id = resolveLawId(law, usedIds);
    const seedName = `${String(order).padStart(4, '0')}-${id.replace(/^pk-/, '')}.json`;
    const seedPath = path.join(SEED_DIR, seedName);

    process.stdout.write(`[${order}/${indexed.length}] ${law.title} ... `);
    try {
      const act = await ingestOneLaw(law, id, order, skipFetch);
      fs.writeFileSync(seedPath, `${JSON.stringify(act, null, 2)}\n`);

      totalProvisions += act.provisions.length;
      totalDefinitions += act.definitions.length;
      manifest.success++;

      console.log(`OK (${act.provisions.length} provisions, ${act.definitions.length} definitions)`);
    } catch (error) {
      manifest.failed++;
      const message = error instanceof Error ? error.message : String(error);
      manifest.failures.push({ lawPath: law.lawPath, title: law.title, error: message });
      console.log(`FAILED (${message})`);
    }
  }

  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log('\nIngestion summary');
  console.log('-----------------');
  console.log(`Indexed laws:     ${manifest.total_indexed}`);
  console.log(`Selected laws:    ${manifest.total_selected}`);
  console.log(`Successful laws:  ${manifest.success}`);
  console.log(`Failed laws:      ${manifest.failed}`);
  console.log(`Total provisions: ${totalProvisions}`);
  console.log(`Total definitions:${totalDefinitions}`);
  console.log(`Manifest:         ${MANIFEST_PATH}`);
  console.log(`Seed dir:         ${SEED_DIR}`);

  if (manifest.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error('Fatal ingestion error:', error);
  process.exit(1);
});
