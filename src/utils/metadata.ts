/**
 * Response metadata utilities for Pakistani Law MCP.
 */

import type Database from '@ansvar/mcp-sqlite';

export interface ResponseMetadata {
  data_source: string;
  jurisdiction: string;
  disclaimer: string;
  freshness?: string;
  note?: string;
  query_strategy?: string;
}

export interface ToolResponse<T> {
  results: T;
  _metadata: ResponseMetadata;
}

export function generateResponseMetadata(
  db: InstanceType<typeof Database>,
): ResponseMetadata {
  let freshness: string | undefined;
  try {
    const row = db.prepare(
      "SELECT value FROM db_metadata WHERE key = 'built_at'"
    ).get() as { value: string } | undefined;
    if (row) freshness = row.value;
  } catch {
    // Ignore
  }

  return {
    data_source: 'Pakistan Code (pakistancode.gov.pk) — National Database and Registration Authority (NADRA) / Ministry of Law and Justice',
    jurisdiction: 'PK',
    disclaimer:
      'This data is sourced from official Pakistani legal sources under public domain. ' +
      'The authoritative versions are maintained by the Ministry of Law and Justice of Pakistan. ' +
      'Always verify with the official Pakistan Code portal (pakistancode.gov.pk).',
    freshness,
  };
}
