/**
 * Smiirl-compatible endpoint that returns {"number": N} with the LinkedIn
 * follower count for the company configured in LINKEDIN_URL.
 *
 * Strategy:
 *   1. Try scraping the live LinkedIn page (works from residential IPs,
 *      unreliable from datacenter IPs like Vercel).
 *   2. Fall back to FOLLOWER_COUNT env var (always works — update manually
 *      in the Vercel dashboard when scraping is blocked).
 *
 * Smiirl polls this URL every ~5 minutes and expects: {"number": 1682}
 */

const FALLBACK_COUNT = Number(process.env.FOLLOWER_COUNT) || null;
const LINKEDIN_URL =
  process.env.LINKEDIN_URL ||
  process.env.LINKEDIN_COMPANY_URL ||
  "";

function buildCookieHeader() {
  const raw = (process.env.LINKEDIN_COOKIE || "").trim();
  if (raw) return raw;
  const liAt = (process.env.LINKEDIN_LI_AT || "").trim();
  if (!liAt) return "";
  return liAt.includes("=") ? liAt : `li_at=${liAt}`;
}

const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "accept-encoding": "gzip, deflate",
  "cache-control": "no-cache",
  "sec-ch-ua": '"Google Chrome";v="131", "Chromium";v="131"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1",
};

function extractFollowerCount(html) {
  const patterns = [
    /"followerCount":\s*(\d+)/i,
    /"followers":\s*"?(?:about\s*)?([\d,\.]+)"?/i,
    /([\d,\.]+)\s+followers/gi,
    /([\d,\.]+)\s+Follower/gi,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(html);
    if (!match) continue;
    const digits = String(match[1]).replace(/[^\d]/g, "");
    if (digits && Number(digits) > 0) return Number(digits);
  }
  return null;
}

async function scrapeLinkedIn(url) {
  const cookie = buildCookieHeader();
  const headers = { ...BROWSER_HEADERS };
  if (cookie) headers.cookie = cookie;

  const res = await fetch(url, { redirect: "follow", headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { error: `HTTP ${res.status}`, status: res.status, body: text.slice(0, 200) };
  }

  const html = await res.text();
  const count = extractFollowerCount(html);
  if (count === null) {
    return { error: "Could not parse follower count from HTML" };
  }
  return { count };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  let liveCount = null;
  let scrapeError = null;

  if (LINKEDIN_URL) {
    try {
      const result = await scrapeLinkedIn(LINKEDIN_URL);
      if (result.count) {
        liveCount = result.count;
      } else {
        scrapeError = result.error;
      }
    } catch (err) {
      scrapeError = err.message;
    }
  }

  const number = liveCount || FALLBACK_COUNT;

  if (number === null) {
    return res.status(503).json({
      error: "No follower count available",
      hint: "Set FOLLOWER_COUNT=1682 in Vercel env vars as a fallback, or fix LINKEDIN_URL / LINKEDIN_LI_AT.",
      scrapeError,
    });
  }

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  return res.status(200).json({
    number,
    source: liveCount ? "live" : "fallback",
    ...(scrapeError && { scrapeError }),
  });
};
