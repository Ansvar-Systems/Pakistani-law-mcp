## Pakistan Law MCP -- Real Ingestion (Full-Corpus Pass)

**Portal:** https://pakistancode.gov.pk/english/index.php  
**Method:** HTML index/law-page scrape + official PDF text extraction (`pdftotext`)  
**Language:** English (official portal corpus)

**Before (AI-seeded):**
- 10 documents, 103 provisions (synthetic)

**After (real data):**
- Indexed on portal: 1030 laws
- Ingested successfully: 1018 laws (real text)
- Not ingestible from source as of 2026-02-21: 12 laws (official PDF missing or 0 extractable text)
- Database: 1018 documents, 28022 provisions, 5683 definitions
- Database size: 57 MB

### Verification (character-by-character)
All checks below are exact string matches against text extracted directly from the official PDF linked on the law page:

1. Electronic Transactions Ordinance, 2002 -- Section 3 (`pk-eto-2002`, 240 chars): **MATCH**  
   https://pakistancode.gov.pk/english/UY2FqaJw1-apaUY2Fqa-apaUY2Fta5Y%3D-sg-jjjjjjjjjjjjj
2. Electronic Transactions Ordinance, 2002 -- Section 4 (`pk-eto-2002`, 308 chars): **MATCH**  
   https://pakistancode.gov.pk/english/UY2FqaJw1-apaUY2Fqa-apaUY2Fta5Y%3D-sg-jjjjjjjjjjjjj
3. Electronic Transactions Ordinance, 2002 -- Section 10 (`pk-eto-2002`, 406 chars): **MATCH**  
   https://pakistancode.gov.pk/english/UY2FqaJw1-apaUY2Fqa-apaUY2Fta5Y%3D-sg-jjjjjjjjjjjjj

### Hard-source failures (not fabricated)
The following laws could not be ingested from the official source. They were intentionally skipped to avoid fabricated text.

1. Capital Development Authority (Amendment) Ordinance, 2025 -- 0 extractable text
2. Federal Ministers and Ministers of State (Salaries, Allowance and Privileges) (Amendment) Ordinance, 2025 -- 0 extractable text
3. Government Management of Private Estates Act, 1892 -- official PDF URL returns 404
4. Marriage Functions (Ostentatious Displays) Ordinance, 1999 -- official PDF URL returns 404
5. Motor Vehicles (Drivers) Ordinance, 1942 -- official PDF URL returns 404
6. National Agri-trade and Food Safety Authority Ordinance, 2025 -- 0 extractable text
7. Petroleum Products (Petroleum Levy) (Amendment) Ordinance, 2025 -- 0 extractable text
8. Representation Of People Act, 1976 (repealed) -- official PDF URL returns 404
9. Suits Valuation Act, 1887 -- official PDF URL returns 404
10. Tax Laws (Amendment) Ordinance, 2025 -- 0 extractable text
11. Transfer of Railways (Amendment) Ordinance, 2025 -- 0 extractable text
12. Virtual Assets Ordinance, 2025 -- 0 extractable text

### Limitations
- Pakistan Code structured section endpoint access is blocked from this environment; ingestion relies on official linked PDFs only.
- Some portal entries reference broken PDF endpoints (404), so no official text is retrievable from this source path.
- Some PDFs are present but produce zero text with `pdftotext` (image-only/empty extract stream). OCR was not used.
