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
- 1030 laws ingested into the seed corpus (100% indexed-law coverage)
- 1018 laws ingested from direct official PDF text extraction (`pdftotext`)
- 7 laws ingested from OCR text of official image-only PDFs
- 2 laws ingested via equivalent official duplicate entries where canonical PDF endpoints were broken
- 3 laws ingested from current public mirror sources after official PDF endpoints returned persistent `404`

Fallback source details and per-law provenance are documented in `REAL_INGESTION_REPORT.md`.

## License

Apache-2.0
