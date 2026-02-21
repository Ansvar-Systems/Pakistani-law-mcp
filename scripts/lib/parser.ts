import { execFileSync } from 'node:child_process';

export interface ParsedProvision {
  provision_ref: string;
  chapter?: string;
  section: string;
  title: string;
  content: string;
}

export interface ParsedDefinition {
  term: string;
  definition: string;
  source_provision?: string;
}

export interface ParsedAct {
  id: string;
  type: 'statute';
  title: string;
  title_en: string;
  short_name: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issued_date: string;
  in_force_date: string;
  url: string;
  description: string;
  provisions: ParsedProvision[];
  definitions: ParsedDefinition[];
}

interface SectionMarker {
  rawSection: string;
  section: string;
  heading: string;
  line: string;
  index: number;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function parseLawPagePdfUrl(html: string): string | null {
  const absoluteMatch = html.match(/https:\/\/pakistancode\.gov\.pk\/pdffiles\/[^"'<> ]+\.pdf/i);
  if (absoluteMatch) {
    return absoluteMatch[0];
  }

  const relativeMatch = html.match(/(?:\.\.\/)?pdffiles\/[^"'<> ]+\.pdf/i);
  if (relativeMatch) {
    return `https://pakistancode.gov.pk/${relativeMatch[0].replace(/^\.?\//, '')}`;
  }

  return null;
}

export function extractTextFromPdf(pdfPath: string): string {
  // -layout keeps legal document structure/indentation, -nopgbrk avoids form-feed separators.
  return execFileSync('pdftotext', ['-layout', '-nopgbrk', pdfPath, '-'], {
    encoding: 'utf-8',
    maxBuffer: 100 * 1024 * 1024,
  });
}

function parseSectionMarkers(body: string): SectionMarker[] {
  const markerRegex = /^\s*(\d+[A-Z]?)\.\s+([^\n]{3,240})$/gm;
  const rawMarkers: SectionMarker[] = [];

  let match: RegExpExecArray | null;
  while ((match = markerRegex.exec(body)) !== null) {
    const rawSection = match[1].trim();
    const heading = match[2].trim();
    const line = match[0];
    const index = match.index;

    if (!/[A-Za-z]/.test(heading)) continue;
    if (/^page\s+\d+/i.test(heading)) continue;
    if (/^chapter\b/i.test(heading)) continue;
    if (/^contents$/i.test(heading)) continue;
    if (heading.length < 3) continue;

    rawMarkers.push({
      rawSection,
      section: rawSection,
      heading,
      line,
      index,
    });
  }

  for (let i = 0; i < rawMarkers.length; i++) {
    const current = rawMarkers[i];
    if (!/^\d{2,}$/.test(current.rawSection)) continue;

    const prevNumeric = i > 0 && /^\d+$/.test(rawMarkers[i - 1].rawSection)
      ? Number.parseInt(rawMarkers[i - 1].rawSection, 10)
      : null;
    const nextNumeric = i + 1 < rawMarkers.length && /^\d+$/.test(rawMarkers[i + 1].rawSection)
      ? Number.parseInt(rawMarkers[i + 1].rawSection, 10)
      : null;
    const currentNumeric = Number.parseInt(current.rawSection, 10);

    // PDF extraction occasionally turns inserted sections (e.g., "5A.") into merged numeric tokens.
    if (
      prevNumeric !== null
      && nextNumeric !== null
      && nextNumeric === prevNumeric + 1
      && currentNumeric > nextNumeric + 10
    ) {
      current.section = `${prevNumeric}A`;
    }
  }

  return rawMarkers;
}

function cleanProvisionContent(content: string): string {
  let text = content.replace(/\r/g, '');

  text = text
    .replace(/^\s*Page\s+\d+\s+of\s+\d+\s*$/gmi, '')
    .replace(/^\s*THE\s+[A-Z0-9 ,().'’\-]+(?:ACT|ORDINANCE)[A-Z0-9 ,().'’\-]*\s*$/gmi, '')
    .replace(/^\s*CHAPTER\s+[A-Z0-9\-]+\s*$/gmi, '')
    .replace(/^\s*[A-Z][A-Z \-]{4,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n');

  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  return lines.join('\n').trim();
}

function cleanSectionTitle(title: string): string {
  return title
    .replace(/\s+/g, ' ')
    .replace(/[.:—-]+$/g, '')
    .trim();
}

function splitHeadingAndInlineText(heading: string): { title: string; inlineText: string } {
  const normalized = heading.replace(/\s+/g, ' ').trim();

  let separatorIndex = -1;
  let separatorLength = 0;

  const dashMatch = /[:.]*\s*[—-]\s*/.exec(normalized);
  if (dashMatch && typeof dashMatch.index === 'number' && dashMatch.index > 0) {
    separatorIndex = dashMatch.index;
    separatorLength = dashMatch[0].length;
  } else {
    const underscoreIndex = normalized.indexOf('__');
    if (underscoreIndex > 0) {
      separatorIndex = underscoreIndex;
      separatorLength = 2;
    }
  }

  if (separatorIndex > 0) {
    return {
      title: cleanSectionTitle(normalized.slice(0, separatorIndex)),
      inlineText: normalized.slice(separatorIndex + separatorLength).trim(),
    };
  }

  return {
    title: cleanSectionTitle(normalized),
    inlineText: '',
  };
}

export function parseProvisionsFromPdfText(rawText: string): ParsedProvision[] {
  let text = rawText.replace(/\r/g, '');

  const actIndex = text.search(/ACT\s+NO\./i);
  if (actIndex >= 0) {
    text = text.slice(actIndex);
  }

  const markers = parseSectionMarkers(text);
  const provisions: ParsedProvision[] = [];

  for (let i = 0; i < markers.length; i++) {
    const current = markers[i];
    const next = markers[i + 1];
    const start = current.index + current.line.length;
    const end = next ? next.index : text.length;
    const rawContent = text.slice(start, end);
    const { title, inlineText } = splitHeadingAndInlineText(current.heading);
    const baseContent = cleanProvisionContent(rawContent);
    const content = inlineText ? `${inlineText}\n${baseContent}`.trim() : baseContent;

    if (content.length < 40) continue;

    const section = current.section;
    provisions.push({
      provision_ref: `sec${section.toLowerCase()}`,
      section,
      title: `Section ${section}. ${title}`,
      content,
    });
  }

  // Keep the richest version when duplicate section markers occur in amended compilations.
  const bySection = new Map<string, ParsedProvision>();
  for (const provision of provisions) {
    if (!bySection.has(provision.section)) {
      bySection.set(provision.section, provision);
    }
  }

  return Array.from(bySection.values());
}

export function extractDefinitions(provisions: ParsedProvision[]): ParsedDefinition[] {
  const definitions: ParsedDefinition[] = [];
  const seen = new Set<string>();

  for (const provision of provisions) {
    if (!/definition/i.test(provision.title)) continue;
    const text = provision.content;

    const clauseRegex = /\(\s*([a-z]{1,3})\s*\)\s*[“"']([^"”']{2,140})[”"']\s+(?:means|includes|shall mean)\s+([\s\S]*?)(?=\n\s*\(\s*[a-z]{1,3}\s*\)\s*[“"']|$)/gi;
    let clauseMatch: RegExpExecArray | null;

    while ((clauseMatch = clauseRegex.exec(text)) !== null) {
      const term = normalizeWhitespace(clauseMatch[2]);
      const definition = normalizeWhitespace(clauseMatch[3]);
      if (term.length < 2 || definition.length < 10) continue;

      const key = `${term.toLowerCase()}::${provision.provision_ref}`;
      if (seen.has(key)) continue;
      seen.add(key);

      definitions.push({
        term,
        definition,
        source_provision: provision.provision_ref,
      });
    }
  }

  return definitions;
}
