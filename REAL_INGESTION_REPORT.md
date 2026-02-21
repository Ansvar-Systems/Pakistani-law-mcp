## Pakistan Law MCP - Real Ingestion Complete

**Portal:** https://pakistancode.gov.pk/english/index.php  
**Method:** HTML scrape of official law pages + official PDF text extraction (`pdftotext`)  
**Language:** English (official English portal texts)

**Before (AI-seeded):**
- 10 documents, 103 provisions (synthetic)

**After (real data):**
- 10 documents, 463 provisions (real)
- Database size: 1.246 MB

**Laws ingested:**
1. Electronic Transactions Ordinance, 2002 - 45 sections - https://pakistancode.gov.pk/english/UY2FqaJw1-apaUY2Fqa-apaUY2Fta5Y%3D-sg-jjjjjjjjjjjjj
2. Prevention of Electronic Crimes Act, 2016 - 72 sections - https://pakistancode.gov.pk/english/UY2FqaJw1-apaUY2Fqa-apaUY2Jvbp8%3D-sg-jjjjjjjjjjjjj
3. Pakistan Telecommunication (Re-organization) Act, 1996 - 60 sections - https://pakistancode.gov.pk/english/UY2FqaJw1-apaUY2Fqa-apqWaw%3D%3D-sg-jjjjjjjjjjjjj
4. Right of Access to Information Act, 2017 - 29 sections - https://pakistancode.gov.pk/english/UY2FqaJw1-apaUY2Fqa-apaUY2Noa5c%3D-sg-jjjjjjjjjjjjj
5. Payment Systems and Electronic Fund Transfers Act, 2007 - 74 sections - https://pakistancode.gov.pk/english/UY2FqaJw1-apaUY2Fqa-apaUY2FsaZY%3D-sg-jjjjjjjjjjjjj
6. Pakistan Electronic Media Regulatory Authority Ordinance (PEMRA), 2002 - 35 sections - https://pakistancode.gov.pk/english/UY2FqaJw1-apaUY2Fqa-apaUY2FrbZ8%3D-sg-jjjjjjjjjjjjj
7. Investigation for fair Trial Act, 2013 - 39 sections - https://pakistancode.gov.pk/english/UY2FqaJw1-apaUY2Fqa-apaUY2FqbZw%3D-sg-jjjjjjjjjjjjj
8. Competition Act, 2010 - 62 sections - https://pakistancode.gov.pk/english/UY2FqaJw1-apaUY2Fqa-apaUY2FsbJk%3D-sg-jjjjjjjjjjjjj
9. State Bank of Pakistan (SBP) Act, 1956 - 37 sections - https://pakistancode.gov.pk/english/UY2FqaJw1-apaUY2Fqa-ap%2BbZw%3D%3D-sg-jjjjjjjjjjjjj
10. Federal Investigation Agency Act (FIA), 1974 - 10 sections - https://pakistancode.gov.pk/english/UY2FqaJw1-apaUY2Fqa-bpuUY2Zr-sg-jjjjjjjjjjjjj

**Verification:**
- Electronic Transactions Ordinance, 2002 Sec 1: MATCH
- Prevention of Electronic Crimes Act, 2016 Sec 10: MATCH
- Right of Access to Information Act, 2017 Sec 5: MATCH

**Issues / Limitations:**
- Pakistan Code’s section-AJAX endpoint (`UY2FqaJw2.php`) is blocked from this environment; ingestion therefore uses official complete-law PDFs linked from law pages.
- Official PDF compilations include amendment notes/footnotes in some sections; these are preserved where present in extracted text.
- Some legacy PDFs include formatting artifacts (underscores and editorial markers), preserved from source extraction.

**Feasibility for full corpus expansion:**
- Full-corpus ingestion is feasible with the same pipeline because alphabetical index pages and per-law PDF links are structured consistently.
- Estimated effort for full ingestion:
  - Index crawling + target enumeration: 1-2 days
  - Batch PDF extraction/parsing + quality checks: 3-5 days
  - Validation and normalization pass: 2-3 days
