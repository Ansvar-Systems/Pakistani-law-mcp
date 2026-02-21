/**
 * Fetches legislation resources from The Pakistan Code.
 *
 * Strategy:
 * - Fetch law detail pages from pakistancode.gov.pk (HTML)
 * - Resolve the official PDF URL embedded on each law page
 * - Download PDFs with conservative rate limiting (1.5s between requests)
 */

const USER_AGENT = 'Pakistani-Law-MCP/1.0 (official-ingestion; contact: hello@ansvar.ai)';
const MIN_DELAY_MS = 1500;

let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function enforceRateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestAt;
  if (elapsed < MIN_DELAY_MS) {
    await sleep(MIN_DELAY_MS - elapsed);
  }
  lastRequestAt = Date.now();
}

export interface FetchTextResult {
  status: number;
  body: string;
  contentType: string;
  url: string;
}

export interface FetchBinaryResult {
  status: number;
  body: Buffer;
  contentType: string;
  url: string;
}

export async function fetchText(url: string, maxRetries = 2): Promise<FetchTextResult> {
  await enforceRateLimit();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });

    if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
      await sleep((attempt + 1) * 2000);
      continue;
    }

    const body = await response.text();
    return {
      status: response.status,
      body,
      contentType: response.headers.get('content-type') ?? '',
      url: response.url,
    };
  }

  throw new Error(`Failed to fetch text URL after retries: ${url}`);
}

export async function fetchBinary(url: string, maxRetries = 2): Promise<FetchBinaryResult> {
  await enforceRateLimit();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/pdf,application/octet-stream,*/*',
      },
      redirect: 'follow',
    });

    if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
      await sleep((attempt + 1) * 2000);
      continue;
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      status: response.status,
      body: Buffer.from(arrayBuffer),
      contentType: response.headers.get('content-type') ?? '',
      url: response.url,
    };
  }

  throw new Error(`Failed to fetch binary URL after retries: ${url}`);
}
