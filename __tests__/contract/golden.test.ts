/**
 * Golden contract tests for Pakistani Law MCP.
 * Validates core tool functionality against seed data.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import * as path from 'path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../../data/database.db');
const dbAvailable = existsSync(DB_PATH);

let db: InstanceType<typeof Database>;

beforeAll(() => {
  if (!dbAvailable) return;
  db = new Database(DB_PATH, { readonly: true });
  db.pragma('journal_mode = DELETE');
});

describe.skipIf(!dbAvailable)('Database integrity', () => {
  it('should have a full-corpus legal document set (excluding EU cross-refs)', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM legal_documents WHERE id != 'eu-cross-references'"
    ).get() as { cnt: number };
    expect(row.cnt).toBeGreaterThanOrEqual(1000);
  });

  it('should have a large real-data provision corpus', () => {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM legal_provisions').get() as { cnt: number };
    expect(row.cnt).toBeGreaterThanOrEqual(5000);
  });

  it('should have FTS index', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM provisions_fts WHERE provisions_fts MATCH 'data'"
    ).get() as { cnt: number };
    expect(row.cnt).toBeGreaterThanOrEqual(0);
  });
});

describe.skipIf(!dbAvailable)('Article retrieval', () => {
  it('should retrieve a provision by document_id and section', () => {
    const row = db.prepare(
      "SELECT content FROM legal_provisions WHERE document_id = 'pk-eto-2002' AND section = '1'"
    ).get() as { content: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.content.length).toBeGreaterThan(50);
  });
});

describe.skipIf(!dbAvailable)('Search', () => {
  it('should find results via FTS search', () => {
    const rows = db.prepare(
      "SELECT COUNT(*) as cnt FROM provisions_fts WHERE provisions_fts MATCH 'Pakistan'"
    ).get() as { cnt: number };
    expect(rows.cnt).toBeGreaterThan(0);
  });
});

describe.skipIf(!dbAvailable)('Negative tests', () => {
  it('should return no results for fictional document', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM legal_provisions WHERE document_id = 'fictional-law-2099'"
    ).get() as { cnt: number };
    expect(row.cnt).toBe(0);
  });

  it('should return no results for invalid section', () => {
    const row = db.prepare(
      "SELECT COUNT(*) as cnt FROM legal_provisions WHERE document_id = 'pk-eto-2002' AND section = '999ZZZ-INVALID'"
    ).get() as { cnt: number };
    expect(row.cnt).toBe(0);
  });
});

describe.skipIf(!dbAvailable)('Core 10 reference laws are present', () => {
  const expectedDocs = [
    'pk-eto-2002',
    'pk-peca-2016',
    'pk-pta-1996',
    'pk-rtia-2017',
    'pk-payment-systems-2007',
    'pk-pemra-2002',
    'pk-investigation-fair-trial-2013',
    'pk-competition-act-2010',
    'pk-sbp-act-1956',
    'pk-fia-act-1974',
  ];

  for (const docId of expectedDocs) {
    it(`should contain document: ${docId}`, () => {
      const row = db.prepare(
        'SELECT id FROM legal_documents WHERE id = ?'
      ).get(docId) as { id: string } | undefined;
      expect(row).toBeDefined();
      expect(row!.id).toBe(docId);
    });
  }
});

describe.skipIf(!dbAvailable)('list_sources', () => {
  it('should have db_metadata table', () => {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM db_metadata').get() as { cnt: number };
    expect(row.cnt).toBeGreaterThan(0);
  });
});
