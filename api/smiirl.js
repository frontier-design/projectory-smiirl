import { list } from "@vercel/blob";

const FORMS = {
  "combo-convo": {
    url: () => process.env.APPS_SCRIPT_URL_COMBO_CONVO,
    query: "mode=answers",
  },
  "venting-machine": {
    url: () => process.env.APPS_SCRIPT_URL_VENTING_MACHINE,
    query: () =>
      `action=randomResponse&key=${process.env.VENTING_MACHINE_API_KEY || ""}`,
  },
  "laser-focus": {
    url: () => process.env.APPS_SCRIPT_URL_LASER_FOCUS,
    query: "mode=output",
  },
};

async function getActiveForm() {
  try {
    const { blobs } = await list({
      prefix: "active-form",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    if (blobs.length > 0) {
      const response = await fetch(blobs[0].url);
      const data = await response.json();
      if (data.form && FORMS[data.form]) return data.form;
    }
  } catch {
    // fall through to default
  }
  return "combo-convo";
}

async function fetchCount(formKey) {
  const form = FORMS[formKey];
  if (!form) return { count: null, error: "Unknown form" };

  const scriptUrl = form.url();
  if (!scriptUrl) return { count: null, error: "Env var not set" };

  const qs = typeof form.query === "function" ? form.query() : form.query;
  const url = `${scriptUrl}?${qs}`;
  const response = await fetch(url);

  if (!response.ok) return { count: null, error: `HTTP ${response.status}` };

  const data = await response.json();
  if (Array.isArray(data)) return { count: data.length };
  if (typeof data.totalAnswers === "number")
    return { count: data.totalAnswers };
  if (typeof data.totalWords === "number") return { count: data.totalWords };
  if (data.ok && typeof data.count === "number") return { count: data.count };
  return { count: null, error: data.error || "Unexpected format" };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).end();

  const activeForm = await getActiveForm();
  const { count, error } = await fetchCount(activeForm);
  const number = count ?? (Number(process.env.FALLBACK_COUNT) || null);

  if (number === null) {
    return res
      .status(503)
      .json({ error: "No count available", apiError: error });
  }

  res.setHeader("Cache-Control", "s-maxage=5, stale-while-revalidate=10");

  return res.status(200).json({ number });
}
