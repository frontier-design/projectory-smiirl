const FALLBACK_COUNT = Number(process.env.FOLLOWER_COUNT) || null;
const LINKEDIN_URL =
  process.env.LINKEDIN_URL || process.env.LINKEDIN_COMPANY_URL || "";

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

function companyVanityFromUrl(urlString) {
  try {
    const u = new URL(urlString);
    const parts = u.pathname.split("/").filter(Boolean);
    const i = parts.indexOf("company");
    if (i >= 0 && parts[i + 1]) {
      return decodeURIComponent(parts[i + 1]).toLowerCase();
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Pick the most common value — LinkedIn embeds the real org count many times;
 * feed/sidebar noise is often a single stray number. If multiple values tie for
 * top frequency, treat as ambiguous (caller should not trust plain-text matches).
 */
function modeInt(values) {
  const freq = new Map();
  for (const n of values) {
    if (!Number.isFinite(n) || n <= 0) continue;
    freq.set(n, (freq.get(n) || 0) + 1);
  }
  if (!freq.size) return { value: null, ambiguous: false };

  let bestCount = 0;
  for (const c of freq.values()) {
    if (c > bestCount) bestCount = c;
  }
  const winners = [...freq.keys()].filter((n) => freq.get(n) === bestCount);
  return {
    value: winners[0],
    ambiguous: winners.length > 1,
  };
}

function collectAll(re, html) {
  const out = [];
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(html)) !== null) {
    const digits = String(m[1]).replace(/[^\d]/g, "");
    if (digits) out.push(Number(digits));
  }
  return out;
}

/**
 * LinkedIn HTML mixes many "followers" strings (feed, similar pages). The first
 * regex match is often wrong. Prefer org-specific JSON keys and counts tied to
 * this company's publicIdentifier, then the mode of embedded followerCount ints.
 */
function extractFollowerCount(html, pageUrl) {
  const vanity = companyVanityFromUrl(pageUrl);

  const memberMatches = collectAll(
    /"memberFollowersCount"\s*:\s*(\d+)/gi,
    html,
  );
  if (memberMatches.length) {
    const { value, ambiguous } = modeInt(memberMatches);
    if (value !== null && !ambiguous) return value;
  }

  if (vanity) {
    const esc = vanity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const forward = new RegExp(
      `"publicIdentifier"\\s*:\\s*"${esc}"[\\s\\S]{0,40000}?"followerCount"\\s*:\\s*(\\d+)`,
      "i",
    );
    const fm = html.match(forward);
    if (fm) return Number(fm[1]);
    const backward = new RegExp(
      `"followerCount"\\s*:\\s*(\\d+)[\\s\\S]{0,40000}?"publicIdentifier"\\s*:\\s*"${esc}"`,
      "i",
    );
    const bm = html.match(backward);
    if (bm) return Number(bm[1]);
  }

  const fromFollowerCountKey = collectAll(
    /"followerCount"\s*:\s*(\d+)/gi,
    html,
  );
  if (fromFollowerCountKey.length) {
    const { value, ambiguous } = modeInt(fromFollowerCountKey);
    if (value !== null && !ambiguous) return value;
  }

  const fromFollowersKey = collectAll(
    /"followers"\s*:\s*"?(?:about\s*)?([\d,\.]+)"?/gi,
    html,
  );
  if (fromFollowersKey.length) {
    const { value, ambiguous } = modeInt(fromFollowersKey);
    if (value !== null && !ambiguous) return value;
  }

  const plain = collectAll(/([\d,\.]+)\s+followers/gi, html);
  if (plain.length) {
    const { value, ambiguous } = modeInt(plain);
    if (value !== null && !ambiguous) return value;
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
    return {
      error: `HTTP ${res.status}`,
      status: res.status,
      body: text.slice(0, 200),
    };
  }

  const html = await res.text();
  const count = extractFollowerCount(html, url);
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
      if (typeof result.count === "number") {
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
