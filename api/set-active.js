import { put, list } from "@vercel/blob";

const VALID_FORMS = ["combo-convo", "venting-machine", "laser-focus"];

async function readActiveForm() {
  try {
    const { blobs } = await list({
      prefix: "active-form",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    if (blobs.length > 0) {
      const response = await fetch(blobs[0].url);
      const data = await response.json();
      if (data.form && VALID_FORMS.includes(data.form)) return data.form;
    }
  } catch {
    // fall through
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    const form = await readActiveForm();
    res.setHeader("Cache-Control", "s-maxage=5, stale-while-revalidate=10");
    return res.status(200).json({ form });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "GET or POST only" });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const form = body.form;

    if (!form || !VALID_FORMS.includes(form)) {
      return res.status(400).json({
        error: `Invalid form. Must be one of: ${VALID_FORMS.join(", ")}`,
      });
    }

    const blob = await put("active-form.json", JSON.stringify({ form }), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });

    return res.status(200).json({ ok: true, form, url: blob.url });
  } catch (err) {
    return res.status(500).json({ error: err.message, stack: err.stack });
  }
}
