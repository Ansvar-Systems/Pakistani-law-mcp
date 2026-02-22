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
import { execFileSync } from 'node:child_process';
import { createWorker } from 'tesseract.js';
import { fetchBinary, fetchText } from './lib/fetcher.js';
import {
  extractDefinitions,
  parseLawPagePdfUrl,
  extractTextFromPdf,
  parseProvisionsFromPdfText,
  type ParsedProvision,
  type ParsedAct,
} from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const INDEX_DIR = path.join(SOURCE_DIR, 'index');
const LAW_DIR = path.join(SOURCE_DIR, 'laws');
const PDF_DIR = path.join(SOURCE_DIR, 'pdfs');
const TXT_DIR = path.join(SOURCE_DIR, 'txt');
const EXTERNAL_DIR = path.join(SOURCE_DIR, 'external');
const OCR_DIR = path.join(SOURCE_DIR, 'ocr');
const OCR_CACHE_DIR = path.join(SOURCE_DIR, 'ocr-cache');
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

interface TextSource {
  text: string;
  sourceUrl: string;
  note?: string;
}

interface SourceFallback {
  type: 'official_law_path' | 'external_html';
  lawPath?: string;
  url?: string;
  note: string;
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

const SOURCE_FALLBACKS_BY_LAW_PATH: Record<string, SourceFallback> = {
  // Duplicate official entries where one law page points to a broken PDF endpoint.
  'UY2FqaJw1-apaUY2Fqa-apaUY2Npbpo%3D-sg-jjjjjjjjjjjjj': {
    type: 'official_law_path',
    lawPath: 'UY2FqaJw1-apaUY2Fqa-cJ0%3D-sg-jjjjjjjjjjjjj',
    note: 'Text sourced from equivalent official duplicate entry due broken PDF link on canonical entry.',
  },
  'UY2FqaJw1-apaUY2Fqa-apaUY2NpaJZl-sg-jjjjjjjjjjjjj': {
    type: 'official_law_path',
    lawPath: 'UY2FqaJw1-apaUY2Fqa-b5k%3D-sg-jjjjjjjjjjjjj',
    note: 'Text sourced from equivalent official duplicate entry due broken PDF link on canonical entry.',
  },
  // Non-official fallback mirrors used only when official PDF endpoint is unavailable.
  'UY2FqaJw1-apaUY2Fqa-apaUbA%3D%3D-sg-jjjjjjjjjjjjj': {
    type: 'external_html',
    url: 'https://nasirlawsite.com/laws/function.htm',
    note: 'Official PDF endpoint unavailable; text sourced from current public legal mirror.',
  },
  'UY2FqaJw1-apaUY2Fqa-cJid-sg-jjjjjjjjjjjjj': {
    type: 'external_html',
    url: 'https://nasirlawsite.com/laws/mvdo.htm',
    note: 'Official PDF endpoint unavailable; text sourced from current public legal mirror.',
  },
  'UY2FqaJw1-apaUY2Fqa-apaUY2Npb5w%3D-sg-jjjjjjjjjjjjj': {
    type: 'external_html',
    url: 'https://nasirlawsite.com/laws/rpa.htm',
    note: 'Official PDF endpoint unavailable; text sourced from current public legal mirror.',
  },
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
  fs.mkdirSync(EXTERNAL_DIR, { recursive: true });
  fs.mkdirSync(OCR_DIR, { recursive: true });
  fs.mkdirSync(OCR_CACHE_DIR, { recursive: true });
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

function buildDescriptionWithSourceNote(law: IndexedLaw, sourceNote?: string): string {
  const base = buildDescription(law);
  if (!sourceNote) return base;
  return `${base} ${sourceNote}`;
}

function decodeHtmlEntities(value: string): string {
  const named = value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');

  return named
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(Number.parseInt(digits, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)));
}

function extractExternalLawText(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let body = bodyMatch?.[1] ?? html;

  body = body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h1|h2|h3|h4|h5|h6|table|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  const decoded = decodeHtmlEntities(body).replace(/\u00a0/g, ' ');
  const normalized = decoded
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter(line => !/^(go to|index|home|ll\.?\s*b|directory)$/i.test(line));

  let text = normalized.join('\n').trim();
  const tailMarker = text.search(/\bGo to\b.*\bIndex\b/i);
  if (tailMarker >= 0) {
    text = text.slice(0, tailMarker).trim();
  }

  const anchor = text.search(/\b(?:ACT|ORDINANCE)\s+NO\./i);
  if (anchor > 0) {
    const titleStart = text.lastIndexOf('\n', Math.max(0, anchor - 320));
    if (titleStart >= 0) {
      text = text.slice(titleStart + 1).trim();
    }
  }

  return text;
}

function parseProvisionsFromText(rawText: string): ParsedProvision[] {
  const parsed = parseProvisionsFromPdfText(rawText);
  if (parsed.length > 0) return parsed;

  const fallback = rawText.replace(/\r/g, '').trim();
  if (fallback.length >= 10) {
    return [
      {
        provision_ref: 'sec0',
        section: '0',
        title: 'Section 0. Full text',
        content: fallback,
      },
    ];
  }

  return [];
}

async function ocrPdfToText(pdfPath: string, key: string): Promise<string> {
  const pageDir = path.join(OCR_DIR, key);
  fs.rmSync(pageDir, { recursive: true, force: true });
  fs.mkdirSync(pageDir, { recursive: true });

  const pagePrefix = path.join(pageDir, 'page');
  execFileSync('pdftoppm', ['-png', '-r', '300', pdfPath, pagePrefix], { stdio: 'ignore' });

  const pageFiles = fs.readdirSync(pageDir)
    .filter(file => file.endsWith('.png'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (pageFiles.length === 0) {
    throw new Error(`OCR failed to render pages for ${pdfPath}`);
  }

  const worker = await createWorker('eng', undefined, {
    cachePath: OCR_CACHE_DIR,
    logger: () => undefined,
  });

  try {
    let text = '';
    for (const pageFile of pageFiles) {
      const pagePath = path.join(pageDir, pageFile);
      const result = await worker.recognize(pagePath);
      text += `${result.data.text}\n\n`;
    }
    return text.trim();
  } finally {
    await worker.terminate();
    fs.rmSync(pageDir, { recursive: true, force: true });
  }
}

async function fetchOfficialTextFromLawPath(
  lawPath: string,
  cacheKey: string,
  skipFetch: boolean,
): Promise<TextSource> {
  const key = hashString(cacheKey);
  const lawUrl = `${PAKISTAN_CODE_BASE}/${lawPath}`;
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

  let text = extractTextFromPdf(pdfPath);
  if (text.trim().length < 20) {
    text = await ocrPdfToText(pdfPath, key);
  }

  if (text.trim().length < 10) {
    throw new Error(`No text extracted from PDF: ${pdfUrl}`);
  }

  fs.writeFileSync(txtPath, text);
  return { text, sourceUrl: lawUrl };
}

async function fetchExternalText(url: string, cacheKey: string, skipFetch: boolean): Promise<TextSource> {
  const key = hashString(cacheKey);
  const htmlPath = path.join(EXTERNAL_DIR, `${key}.html`);
  const txtPath = path.join(TXT_DIR, `${key}.txt`);

  let html: string;
  if (skipFetch && fs.existsSync(htmlPath)) {
    html = fs.readFileSync(htmlPath, 'utf-8');
  } else {
    const response = await fetchText(url, 5);
    if (response.status !== 200) {
      throw new Error(`External source HTTP ${response.status}: ${url}`);
    }
    html = response.body;
    fs.writeFileSync(htmlPath, html);
  }

  const text = extractExternalLawText(html);
  if (text.trim().length < 10) {
    throw new Error(`No law text extracted from external source: ${url}`);
  }

  fs.writeFileSync(txtPath, text);
  return { text, sourceUrl: url };
}

async function ingestOneLaw(
  law: IndexedLaw,
  id: string,
  skipFetch: boolean,
): Promise<ParsedAct> {
  const lawUrl = `${PAKISTAN_CODE_BASE}/${law.lawPath}`;

  const attempts: Array<() => Promise<TextSource>> = [
    () => fetchOfficialTextFromLawPath(law.lawPath, law.lawPath, skipFetch),
  ];

  const fallback = SOURCE_FALLBACKS_BY_LAW_PATH[law.lawPath];
  if (fallback?.type === 'official_law_path' && fallback.lawPath) {
    attempts.push(async () => ({
      ...(await fetchOfficialTextFromLawPath(
        fallback.lawPath!,
        `${law.lawPath}-official-fallback`,
        skipFetch,
      )),
      note: fallback.note,
    }));
  } else if (fallback?.type === 'external_html' && fallback.url) {
    attempts.push(async () => ({
      ...(await fetchExternalText(
        fallback.url!,
        `${law.lawPath}-external-fallback`,
        skipFetch,
      )),
      note: `${fallback.note} Source: ${fallback.url}.`,
    }));
  }

  let selectedSource: TextSource | null = null;
  let lastError: string | null = null;

  for (const attempt of attempts) {
    try {
      selectedSource = await attempt();
      break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  if (!selectedSource) {
    throw new Error(lastError ?? `Ingestion failed for ${law.title}`);
  }

  const provisions = parseProvisionsFromText(selectedSource.text);
  if (provisions.length === 0) {
    throw new Error(`No provisions parsed from source: ${selectedSource.sourceUrl}`);
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
    description: buildDescriptionWithSourceNote(law, selectedSource.note),
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
      const act = await ingestOneLaw(law, id, skipFetch);
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
