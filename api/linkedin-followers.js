// Set LINKEDIN_URL in .env.local to any company or profile page, e.g.
// LINKEDIN_URL=https://www.linkedin.com/company/your-company
// LINKEDIN_URL=https://www.linkedin.com/in/your-handle
// Legacy: LINKEDIN_COMPANY_URL is still read if LINKEDIN_URL is unset.

function parseFollowerCountFromHtml(html) {
  const patterns = [
    /"followerCount":\s*(\d+)/i,
    /"followers":\s*"?(?:about\s*)?([\d,\.]+)"?/i,
    /([\d,\.]+)\s+followers/gi,
    /([\d,\.]+)\s+Follower/gi,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (!match) continue;

    const raw = match[1];
    const digits = String(raw).replace(/[^\d]/g, "");
    if (digits) return Number(digits);
  }

  return null;
}

function resolveLinkedInPageUrl() {
  const raw = process.env.LINKEDIN_URL || process.env.LINKEDIN_COMPANY_URL;
  if (!raw || !String(raw).trim()) {
    return {
      error:
        "Missing LINKEDIN_URL. Add it to .env.local (see comment at top of this file).",
    };
  }

  let urlString = String(raw).trim();
  if (!/^https?:\/\//i.test(urlString)) {
    urlString = `https://${urlString}`;
  }

  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return { error: "LINKEDIN_URL is not a valid URL." };
  }

  const host = parsed.hostname.toLowerCase();
  if (!host.endsWith("linkedin.com")) {
    return { error: "LINKEDIN_URL must use a linkedin.com hostname." };
  }

  return { url: parsed.toString() };
}

export default async function handler(req, res) {
  try {
    const resolved = resolveLinkedInPageUrl();
    if (resolved.error) {
      return res.status(400).json({ error: resolved.error });
    }

    const linkedinUrl = resolved.url;

    const response = await fetch(linkedinUrl, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        referer: "https://www.google.com/",
      },
    });

    if (!response.ok) {
      return res.status(500).json({
        error: "Failed to fetch LinkedIn page",
        status: response.status,
      });
    }

    const html = await response.text();
    const number = parseFollowerCountFromHtml(html);

    if (typeof number !== "number" || Number.isNaN(number)) {
      return res.status(500).json({
        error: "Could not extract follower count",
      });
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Cache-Control",
      "s-maxage=1800, stale-while-revalidate=3600",
    );

    return res.status(200).json({ number, url: linkedinUrl });
  } catch (error) {
    return res.status(500).json({
      error: "Internal error",
      details: error.message,
    });
  }
}
