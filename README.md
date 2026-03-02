# Pakistani Law MCP Server

**The PLJLCCI alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fpakistani-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/pakistani-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/Pakistani-law-mcp?style=social)](https://github.com/Ansvar-Systems/Pakistani-law-mcp)
[![CI](https://github.com/Ansvar-Systems/Pakistani-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/Pakistani-law-mcp/actions/workflows/ci.yml)
[![Daily Data Check](https://github.com/Ansvar-Systems/Pakistani-law-mcp/actions/workflows/check-updates.yml/badge.svg)](https://github.com/Ansvar-Systems/Pakistani-law-mcp/actions/workflows/check-updates.yml)
[![Database](https://img.shields.io/badge/database-pre--built-green)](https://github.com/Ansvar-Systems/Pakistani-law-mcp)
[![Provisions](https://img.shields.io/badge/provisions-28%2C249-blue)](https://github.com/Ansvar-Systems/Pakistani-law-mcp)

Query **1,030 Pakistani statutes** -- from PECA and the Pakistan Penal Code to the Data Protection Act, Companies Act, and more -- directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing Pakistani legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

Pakistani legal research means navigating pakistancode.gov.pk, na.gov.pk, and the National Assembly's scattered PDF repositories. Whether you're:

- A **lawyer** validating citations in a brief or pleading before a High Court or the Supreme Court
- A **compliance officer** checking PECA obligations or PDPA requirements for your organisation
- A **legal tech developer** building tools on Pakistani law
- A **researcher** tracing legislative history across 1,030 statutes

...you shouldn't need dozens of browser tabs and manual PDF cross-referencing. Ask Claude. Get the exact provision. With context.

This MCP server makes Pakistani law **searchable, cross-referenceable, and AI-readable**.

---

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version -- zero dependencies, nothing to install.

**Endpoint:** `https://pakistani-law-mcp.vercel.app/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add pakistani-law --transport http https://pakistani-law-mcp.vercel.app/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** -- add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pakistani-law": {
      "type": "url",
      "url": "https://pakistani-law-mcp.vercel.app/mcp"
    }
  }
}
```

**GitHub Copilot** -- add to VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "pakistani-law": {
      "type": "http",
      "url": "https://pakistani-law-mcp.vercel.app/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/pakistani-law-mcp
```

**Claude Desktop** -- add to `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "pakistani-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/pakistani-law-mcp"]
    }
  }
}
```

**Cursor / VS Code:**

```json
{
  "mcp.servers": {
    "pakistani-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/pakistani-law-mcp"]
    }
  }
}
```

## Example Queries

Once connected, just ask naturally:

- *"What does PECA (Prevention of Electronic Crimes Act) say about cybercrime offences?"*
- *"Is the Personal Data Protection Act still in force?"*
- *"Find provisions about data breach notification in Pakistani law"*
- *"What international frameworks does Pakistan's PDPA align with?"*
- *"What does PPC Section 420 say about cheating and dishonestly inducing delivery of property?"*
- *"Search for anti-money laundering requirements under AMLA"*
- *"Validate the citation 'Section 9, PECA 2016'"*
- *"Build a legal stance on cybercrime liability under Pakistani law"*
- *پاکستان پینل کوڈ میں دھوکہ دہی کی کیا سزا ہے؟*
- *پی ای سی اے کے تحت ڈیٹا کی خلاف ورزی کے کیا نتائج ہیں؟*

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Statutes** | 1,030 statutes | Legislation sourced from pakistancode.gov.pk and na.gov.pk |
| **Provisions** | 28,249 sections | Full-text searchable with FTS5 |
| **Database Size** | Pre-built SQLite | Optimized, portable |
| **Freshness Checks** | Automated | Drift detection against official sources |

**Verified data only** -- every citation is validated against official sources (National Assembly, pakistancode.gov.pk). Zero LLM-generated content.

---

## Why This Works

**Verbatim Source Text (No LLM Processing):**
- All statute text is ingested from pakistancode.gov.pk and the National Assembly's official publications
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing -- the database contains statute text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 scoring (safe for context)
- Provision retrieval gives exact text by statute identifier + section number
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
pakistancode.gov.pk / na.gov.pk --> Parse --> SQLite --> FTS5 snippet() --> MCP response
                                      ^                       ^
                               Provision parser        Verbatim database query
```

### Traditional Research vs. This MCP

| Traditional Approach | This MCP Server |
|---------------------|-----------------|
| Search pakistancode.gov.pk by statute name | Search by plain language: *"cybercrime unauthorised access"* |
| Navigate multi-chapter statutes manually | Get the exact provision with context |
| Manual cross-referencing between statutes | `build_legal_stance` aggregates across sources |
| "Is this statute still in force?" -- check manually | `check_currency` tool -- answer in seconds |
| Find international alignment -- dig through external sources | `get_eu_basis` -- linked frameworks instantly |
| No API, no integration | MCP protocol -- AI-native |

**Traditional:** Search pakistancode.gov.pk --> Download PDF --> Ctrl+F --> Cross-reference between statutes --> Repeat

**This MCP:** *"What are the data protection obligations under PDPA and how do they compare with GDPR?"* --> Done.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 full-text search across 28,249 provisions with BM25 ranking. Supports quoted phrases, boolean operators, prefix wildcards |
| `get_provision` | Retrieve specific provision by statute identifier + section (e.g., "PECA 2016" + "9") |
| `check_currency` | Check if a statute is in force, amended, or repealed |
| `validate_citation` | Validate citation against database -- zero-hallucination check |
| `build_legal_stance` | Aggregate citations from multiple statutes for a legal topic |
| `format_citation` | Format citations per Pakistani conventions (full/short/pinpoint) |
| `list_sources` | List all available statutes with metadata, coverage scope, and data provenance |
| `about` | Server info, capabilities, dataset statistics, and coverage summary |

### International Law Alignment Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get EU or international frameworks that a Pakistani statute aligns with |
| `get_pakistani_implementations` | Find Pakistani laws aligning with an international framework or treaty |
| `search_eu_implementations` | Search international instruments with Pakistani alignment counts |
| `get_provision_eu_basis` | Get international law references for a specific provision |
| `validate_eu_compliance` | Check alignment status of Pakistani statutes against international standards |

---

## International Law Alignment

Pakistan is not an EU member state, but certain Pakistani laws have significant international alignment:

- **PDPA (Personal Data Protection Act)** draws heavily from GDPR principles -- data minimisation, purpose limitation, data subject rights
- **PECA (Prevention of Electronic Crimes Act, 2016)** aligns with the Budapest Convention on Cybercrime framework
- **AML/CFT legislation** aligns with FATF standards -- Pakistan has worked through FATF grey list requirements
- **Competition Act** reflects international competition law principles

Pakistan participates in OIC (Organisation of Islamic Cooperation) legal frameworks, SAARC (South Asian Association for Regional Cooperation) treaties, and bilateral trade agreements that shape domestic law.

The international alignment tools allow you to explore these relationships -- checking which Pakistani provisions correspond to international requirements, and vice versa.

> **Note:** Cross-references reflect alignment and treaty relationships, not transposition. Pakistan adopts its own legislative approach shaped by its federal structure, common law heritage, and constitutional framework.

---

## Data Sources & Freshness

All content is sourced from authoritative Pakistani legal databases:

- **[Pakistan Code](https://pakistancode.gov.pk/)** -- Federal Ministry of Law and Justice consolidated statutes
- **[National Assembly](https://na.gov.pk/)** -- Acts of Parliament

### Data Provenance

| Field | Value |
|-------|-------|
| **Authority** | Federal Ministry of Law and Justice, National Assembly of Pakistan |
| **Languages** | English (primary legislative language); Urdu translations where available |
| **Coverage** | Federal statutes -- provincial legislation not included in this release |
| **Source** | pakistancode.gov.pk, na.gov.pk |

### Automated Freshness Checks

A [GitHub Actions workflow](.github/workflows/check-updates.yml) monitors official sources for changes:

| Check | Method |
|-------|--------|
| **Statute amendments** | Drift detection against known provision anchors |
| **New statutes** | Comparison against official statute index |
| **Repealed statutes** | Status change detection |

**Verified data only** -- every citation is validated against official sources. Zero LLM-generated content.

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Socket.dev** | Supply chain attack detection | PRs |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from official Pakistani government sources. However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Court case coverage is not included** -- do not rely solely on this for case law research; consult PLD, SCMR, and other official reporters
> - **Verify critical citations** against primary sources before court filings
> - **Provincial legislation is not included** -- this covers federal statutes only; Sindh, Punjab, Balochistan, and KPK provincial laws require separate consultation
> - **Bilingual system** -- Pakistan's official language is Urdu but legislation is enacted in English; both are constitutionally valid

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [SECURITY.md](SECURITY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment. Consult Pakistan Bar Council (PBC) guidelines on use of AI tools in legal practice.

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/Pakistani-law-mcp
cd Pakistani-law-mcp
npm install
npm run build
npm test
```

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/index.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run ingest                    # Ingest statutes from official sources
npm run build:db                  # Rebuild SQLite database
npm run drift:detect              # Run drift detection against anchors
npm run check-updates             # Check for source updates
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Reliability:** 100% ingestion success rate across 1,030 statutes

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** -- MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** -- GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. `npx @ansvar/eu-regulations-mcp`

### [@ansvar/us-regulations-mcp](https://github.com/Ansvar-Systems/US_Compliance_MCP)
**Query US federal and state compliance laws** -- HIPAA, CCPA, SOX, GLBA, FERPA, and more. `npx @ansvar/us-regulations-mcp`

### [@ansvar/security-controls-mcp](https://github.com/Ansvar-Systems/security-controls-mcp)
**Query 261 security frameworks** -- ISO 27001, NIST CSF, SOC 2, CIS Controls, SCF, and more. `npx @ansvar/security-controls-mcp`

**70+ national law MCPs** covering Australia, Brazil, Canada, Croatia, Denmark, Finland, France, Germany, India, Ireland, Italy, Japan, Kenya, Latvia, Netherlands, Norway, Romania, Saudi Arabia, Singapore, Sweden, Switzerland, UAE, UK, and more.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Court case law expansion (PLD, SCMR reporters)
- Provincial legislation (Sindh, Punjab, KPK, Balochistan)
- Urdu-language provision text
- Historical statute versions and amendment tracking
- Regulations and statutory instruments

---

## Roadmap

- [x] Core statute database with FTS5 search
- [x] Full federal corpus ingestion (1,030 statutes, 28,249 provisions)
- [x] International law alignment tools
- [x] Vercel Streamable HTTP deployment
- [x] npm package publication
- [ ] Court case law (PLD, SCMR, CLC reporters)
- [ ] Provincial legislation (Sindh, Punjab, KPK, Balochistan)
- [ ] Urdu provision text
- [ ] Historical statute versions (amendment tracking)
- [ ] Regulations and statutory instruments

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{pakistani_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {Pakistani Law MCP Server: AI-Powered Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/Pakistani-law-mcp},
  note = {1,030 Pakistani federal statutes with 28,249 provisions}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

- **Statutes & Legislation:** Federal Ministry of Law and Justice, Pakistan (public domain government works)
- **International Metadata:** Public domain

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the global market. This MCP server started as our internal reference tool -- turns out everyone building compliance tools has the same research frustrations.

So we're open-sourcing it. Navigating 1,030 federal statutes shouldn't require a law degree.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
