# Pakistani Law MCP

Pakistani law database for cybersecurity compliance via Model Context Protocol (MCP).

## Features

- **Full-text search** across legislation provisions (FTS5 with BM25 ranking)
- **Article-level retrieval** for specific legal provisions
- **Citation validation** to prevent hallucinated references
- **Currency checks** to verify if laws are still in force

## Quick Start

### Claude Code (Remote)
```bash
claude mcp add pakistani-law --transport http https://pakistani-law-mcp.vercel.app/mcp
```

### Local (npm)
```bash
npx @ansvar/pakistani-law-mcp
```

## Data Sources

Real legislation ingested from The Pakistan Code (official federal law portal): https://pakistancode.gov.pk/english/index.php

- 1030 laws indexed from official A-Z listing
- 1018 laws ingested into seed corpus from official linked PDFs
- 12 laws skipped (official PDF missing or non-extractable text), documented in `REAL_INGESTION_REPORT.md`

## License

Apache-2.0
