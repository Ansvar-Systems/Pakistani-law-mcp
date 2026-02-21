#!/usr/bin/env tsx
/**
 * Pakistani Law MCP -- Real legislation ingestion from The Pakistan Code.
 *
 * Source portal: https://pakistancode.gov.pk/english/index.php
 * Method:
 * 1) Fetch law detail page
 * 2) Resolve official PDF URL
 * 3) Download PDF and extract text via pdftotext
 * 4) Parse sections/provisions and definitions
 * 5) Write data/seed/*.json
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
const SEED_DIR = path.resolve(__dirname, '../data/seed');
const PAKISTAN_CODE_BASE = 'https://pakistancode.gov.pk/english';

interface TargetLaw {
  order: number;
  fileName: string;
  id: string;
  title: string;
  titleEn: string;
  shortName: string;
  lawPath: string;
  actNo: string;
  promulgationDate: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
}

const TARGET_LAWS: TargetLaw[] = [
  {
    order: 1,
    fileName: '01-electronic-transactions-ordinance-2002.json',
    id: 'pk-eto-2002',
    title: 'Electronic Transactions Ordinance, 2002',
    titleEn: 'Electronic Transactions Ordinance, 2002',
    shortName: 'ETO 2002',
    lawPath: 'UY2FqaJw1-apaUY2Fqa-apaUY2Fta5Y%3D-sg-jjjjjjjjjjjjj',
    actNo: 'LI of 2002',
    promulgationDate: '2002-09-11',
    status: 'in_force',
  },
  {
    order: 2,
    fileName: '02-prevention-of-electronic-crimes-act-2016.json',
    id: 'pk-peca-2016',
    title: 'Prevention of Electronic Crimes Act, 2016',
    titleEn: 'Prevention of Electronic Crimes Act, 2016',
    shortName: 'PECA 2016',
    lawPath: 'UY2FqaJw1-apaUY2Fqa-apaUY2Jvbp8%3D-sg-jjjjjjjjjjjjj',
    actNo: 'XL of 2016',
    promulgationDate: '2016-08-22',
    status: 'in_force',
  },
  {
    order: 3,
    fileName: '03-pakistan-telecommunication-reorganization-act-1996.json',
    id: 'pk-pta-1996',
    title: 'Pakistan Telecommunication (Re-organization) Act, 1996',
    titleEn: 'Pakistan Telecommunication (Re-organization) Act, 1996',
    shortName: 'PTA Act 1996',
    lawPath: 'UY2FqaJw1-apaUY2Fqa-apqWaw%3D%3D-sg-jjjjjjjjjjjjj',
    actNo: 'XVII of 1996',
    promulgationDate: '1996-12-01',
    status: 'in_force',
  },
  {
    order: 4,
    fileName: '04-right-of-access-to-information-act-2017.json',
    id: 'pk-rtia-2017',
    title: 'Right of Access to Information Act, 2017',
    titleEn: 'Right of Access to Information Act, 2017',
    shortName: 'RTI Act 2017',
    lawPath: 'UY2FqaJw1-apaUY2Fqa-apaUY2Noa5c%3D-sg-jjjjjjjjjjjjj',
    actNo: 'XX of 2017',
    promulgationDate: '2017-02-17',
    status: 'in_force',
  },
  {
    order: 5,
    fileName: '05-payment-systems-and-electronic-fund-transfers-act-2007.json',
    id: 'pk-payment-systems-2007',
    title: 'Payment Systems and Electronic Fund Transfers Act, 2007',
    titleEn: 'Payment Systems and Electronic Fund Transfers Act, 2007',
    shortName: 'PSEFT Act 2007',
    lawPath: 'UY2FqaJw1-apaUY2Fqa-apaUY2FsaZY%3D-sg-jjjjjjjjjjjjj',
    actNo: 'IV of 2007',
    promulgationDate: '2007-12-01',
    status: 'in_force',
  },
  {
    order: 6,
    fileName: '06-pemra-ordinance-2002.json',
    id: 'pk-pemra-2002',
    title: 'Pakistan Electronic Media Regulatory Authority Ordinance (PEMRA), 2002',
    titleEn: 'Pakistan Electronic Media Regulatory Authority Ordinance (PEMRA), 2002',
    shortName: 'PEMRA 2002',
    lawPath: 'UY2FqaJw1-apaUY2Fqa-apaUY2FrbZ8%3D-sg-jjjjjjjjjjjjj',
    actNo: 'XIII of 2002',
    promulgationDate: '2002-03-10',
    status: 'in_force',
  },
  {
    order: 7,
    fileName: '07-investigation-for-fair-trial-act-2013.json',
    id: 'pk-investigation-fair-trial-2013',
    title: 'Investigation for fair Trial Act, 2013',
    titleEn: 'Investigation for Fair Trial Act, 2013',
    shortName: 'Fair Trial Act 2013',
    lawPath: 'UY2FqaJw1-apaUY2Fqa-apaUY2FqbZw%3D-sg-jjjjjjjjjjjjj',
    actNo: 'I of 2013',
    promulgationDate: '2013-02-22',
    status: 'in_force',
  },
  {
    order: 8,
    fileName: '08-competition-act-2010.json',
    id: 'pk-competition-act-2010',
    title: 'Competition Act, 2010',
    titleEn: 'Competition Act, 2010',
    shortName: 'Competition Act 2010',
    lawPath: 'UY2FqaJw1-apaUY2Fqa-apaUY2FsbJk%3D-sg-jjjjjjjjjjjjj',
    actNo: 'XIX of 2010',
    promulgationDate: '2010-10-13',
    status: 'in_force',
  },
  {
    order: 9,
    fileName: '09-state-bank-of-pakistan-act-1956.json',
    id: 'pk-sbp-act-1956',
    title: 'State Bank of Pakistan (SBP) Act, 1956',
    titleEn: 'State Bank of Pakistan (SBP) Act, 1956',
    shortName: 'SBP Act 1956',
    lawPath: 'UY2FqaJw1-apaUY2Fqa-ap%2BbZw%3D%3D-sg-jjjjjjjjjjjjj',
    actNo: 'XXXIII of 1956',
    promulgationDate: '1956-04-18',
    status: 'in_force',
  },
  {
    order: 10,
    fileName: '10-federal-investigation-agency-act-1974.json',
    id: 'pk-fia-act-1974',
    title: 'Federal Investigation Agency Act (FIA), 1974',
    titleEn: 'Federal Investigation Agency Act (FIA), 1974',
    shortName: 'FIA Act 1974',
    lawPath: 'UY2FqaJw1-apaUY2Fqa-bpuUY2Zr-sg-jjjjjjjjjjjjj',
    actNo: 'VIII of 1975',
    promulgationDate: '1975-01-13',
    status: 'in_force',
  },
];

function parseArgs(): { limit: number | null; skipFetch: boolean } {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let skipFetch = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = Number.parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skip-fetch') {
      skipFetch = true;
    }
  }

  return { limit, skipFetch };
}

function ensureDirs(): void {
  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });
}

function clearExistingSeedJson(): void {
  for (const file of fs.readdirSync(SEED_DIR)) {
    if (file.endsWith('.json')) {
      fs.unlinkSync(path.join(SEED_DIR, file));
    }
  }
}

async function ingestLaw(target: TargetLaw, skipFetch: boolean): Promise<ParsedAct> {
  const lawUrl = `${PAKISTAN_CODE_BASE}/${target.lawPath}`;
  const htmlPath = path.join(SOURCE_DIR, `${target.id}.html`);
  const pdfPath = path.join(SOURCE_DIR, `${target.id}.pdf`);
  const txtPath = path.join(SOURCE_DIR, `${target.id}.txt`);

  let html: string;
  if (skipFetch && fs.existsSync(htmlPath)) {
    html = fs.readFileSync(htmlPath, 'utf-8');
  } else {
    const page = await fetchText(lawUrl);
    if (page.status !== 200) {
      throw new Error(`Law page HTTP ${page.status}: ${lawUrl}`);
    }
    html = page.body;
    fs.writeFileSync(htmlPath, html);
  }

  const pdfUrl = parseLawPagePdfUrl(html);
  if (!pdfUrl) {
    throw new Error(`No official PDF link found on law page: ${lawUrl}`);
  }

  if (!(skipFetch && fs.existsSync(pdfPath))) {
    const pdf = await fetchBinary(pdfUrl);
    if (pdf.status !== 200) {
      throw new Error(`PDF HTTP ${pdf.status}: ${pdfUrl}`);
    }
    fs.writeFileSync(pdfPath, pdf.body);
  }

  const text = extractTextFromPdf(pdfPath);
  fs.writeFileSync(txtPath, text);

  const provisions = parseProvisionsFromPdfText(text);
  if (provisions.length === 0) {
    throw new Error(`No provisions parsed from PDF: ${pdfUrl}`);
  }

  const definitions = extractDefinitions(provisions);

  return {
    id: target.id,
    type: 'statute',
    title: target.title,
    title_en: target.titleEn,
    short_name: target.shortName,
    status: target.status,
    issued_date: target.promulgationDate,
    in_force_date: target.promulgationDate,
    url: lawUrl,
    description: `Official consolidated text of ${target.title} (${target.actNo}) published by The Pakistan Code.`,
    provisions,
    definitions,
  };
}

async function main(): Promise<void> {
  const { limit, skipFetch } = parseArgs();
  const selected = limit ? TARGET_LAWS.slice(0, limit) : TARGET_LAWS;

  console.log('Pakistani Law MCP -- Real Data Ingestion');
  console.log('=======================================\n');
  console.log('Source: https://pakistancode.gov.pk/english/index.php');
  console.log('Method: HTML scrape (law pages) + official PDF text extraction');
  console.log(`Target laws: ${selected.length}`);
  if (skipFetch) console.log('Mode: --skip-fetch (reuse downloaded HTML/PDF files)');
  console.log('');

  ensureDirs();
  clearExistingSeedJson();

  let ok = 0;
  let failed = 0;
  let totalProvisions = 0;
  let totalDefinitions = 0;

  for (const target of selected) {
    process.stdout.write(`Ingesting [${target.order}] ${target.shortName}... `);
    try {
      const act = await ingestLaw(target, skipFetch);
      const outPath = path.join(SEED_DIR, target.fileName);
      fs.writeFileSync(outPath, `${JSON.stringify(act, null, 2)}\n`);

      totalProvisions += act.provisions.length;
      totalDefinitions += act.definitions.length;
      ok++;

      console.log(`OK (${act.provisions.length} provisions, ${act.definitions.length} definitions)`);
    } catch (error) {
      failed++;
      console.log(`FAILED (${error instanceof Error ? error.message : String(error)})`);
    }
  }

  console.log('\nIngestion summary');
  console.log('-----------------');
  console.log(`Successful laws: ${ok}`);
  console.log(`Failed laws:     ${failed}`);
  console.log(`Provisions:      ${totalProvisions}`);
  console.log(`Definitions:     ${totalDefinitions}`);
  console.log(`Seed directory:  ${SEED_DIR}`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error('Fatal ingestion error:', error);
  process.exit(1);
});
