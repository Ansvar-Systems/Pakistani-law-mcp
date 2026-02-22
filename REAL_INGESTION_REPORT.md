## Pakistan Law MCP -- Real Ingestion (Full-Corpus Pass)

**Portal:** https://pakistancode.gov.pk/english/index.php  
**Primary method:** A-Z index crawl + official law-page PDFs + `pdftotext`  
**Updated:** 2026-02-22

**Before (AI-seeded):**
- 10 documents, 103 provisions (synthetic)

**After (real corpus):**
- Indexed on portal: 1030 laws
- Ingested into seed corpus: 1030 laws (100% indexed-law coverage)
- Database: 1030 documents, 28249 provisions, 5703 definitions
- Database size: 56.5 MB

### Ingestion path breakdown
- 1018 laws: direct text extraction from official Pakistan Code PDFs
- 7 laws: OCR of official image-only PDFs (no extractable text from `pdftotext`)
- 2 laws: equivalent official duplicate entries used because canonical PDF endpoints returned `404`
- 3 laws: current public legal mirror fallback used because canonical official PDF endpoints returned persistent `404`

### Verification (character-by-character)
Exact string containment checks against text extracted from the official linked PDF for Electronic Transactions Ordinance, 2002:

1. Section 3 (`pk-eto-2002`) -- **MATCH** (240 chars)  
   https://pakistancode.gov.pk/english/UY2FqaJw1-apaUY2Fqa-apaUY2Fta5Y%3D-sg-jjjjjjjjjjjjj
2. Section 4 (`pk-eto-2002`) -- **MATCH** (308 chars)  
   https://pakistancode.gov.pk/english/UY2FqaJw1-apaUY2Fqa-apaUY2Fta5Y%3D-sg-jjjjjjjjjjjjj
3. Section 10 (`pk-eto-2002`) -- **MATCH** (406 chars)  
   https://pakistancode.gov.pk/english/UY2FqaJw1-apaUY2Fqa-apaUY2Fta5Y%3D-sg-jjjjjjjjjjjjj

### Fallback provenance for previously non-ingestible laws
1. Capital Development Authority (Amendment) Ordinance, 2025 -- official PDF OCR
2. Federal Ministers and Ministers of State (Salaries, Allowance and Privileges) (Amendment) Ordinance, 2025 -- official PDF OCR
3. Government Management of Private Estates Act, 1892 -- official duplicate entry fallback (`cJ0%3D` path)
4. Marriage Functions (Ostentatious Displays) Ordinance, 1999 -- mirror fallback: https://nasirlawsite.com/laws/function.htm
5. Motor Vehicles (Drivers) Ordinance, 1942 -- mirror fallback: https://nasirlawsite.com/laws/mvdo.htm
6. National Agri-trade and Food Safety Authority Ordinance, 2025 -- official PDF OCR
7. Petroleum Products (Petroleum Levy) (Amendment) Ordinance, 2025 -- official PDF OCR
8. Representation Of People Act, 1976 (repealed) -- mirror fallback: https://nasirlawsite.com/laws/rpa.htm
9. Suits Valuation Act, 1887 -- official duplicate entry fallback (`b5k%3D` path)
10. Tax Laws (Amendment) Ordinance, 2025 -- official PDF OCR
11. Transfer of Railways (Amendment) Ordinance, 2025 -- official PDF OCR
12. Virtual Assets Ordinance, 2025 -- official PDF OCR

### Notes
- No legal text was fabricated.
- Canonical `url` in each seed remains the Pakistan Code law-page URL.
- When fallback ingestion was used, provenance was appended to the seed `description` field.
- OCR-derived texts can contain recognition noise; they were kept only where official sources were image-only and no structured text endpoint was accessible.
