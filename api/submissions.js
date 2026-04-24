/**
 * Smiirl-compatible endpoint: returns {"number": N}
 *
 * Query params:
 *   ?form=combo-convo       (default)
 *   ?form=venting-machine
 *   ?form=laser-focus
 */

const FORMS = {
  "combo-convo": {
    url: () => process.env.APPS_SCRIPT_URL_COMBO_CONVO,
    query: "mode=answers",
  },
  "venting-machine": {
    url: () => process.env.APPS_SCRIPT_URL_VENTING_MACHINE,
    query: () => `action=randomResponse&key=${process.env.VENTING_MACHINE_API_KEY || ""}`,
  },
  "laser-focus": {
    url: () => process.env.APPS_SCRIPT_URL_LASER_FOCUS,
    query: "mode=output",
  },
};

const FALLBACK_COUNT = Number(process.env.FALLBACK_COUNT) || null;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  const formKey = req.query.form || "combo-convo";
  const form = FORMS[formKey];

  if (!form) {
    return res.status(400).json({
      error: `Unknown form: ${formKey}`,
      available: Object.keys(FORMS),
    });
  }

  const scriptUrl = form.url();
  let count = null;
  let apiError = null;

  if (!scriptUrl) {
    apiError = `Env var not set for form "${formKey}".`;
  } else {
    try {
      const qs = typeof form.query === "function" ? form.query() : form.query;
      const url = `${scriptUrl}?${qs}`;
      const response = await fetch(url);
      if (!response.ok) {
        apiError = `Apps Script returned ${response.status}`;
      } else {
        const data = await response.json();
        if (Array.isArray(data)) {
          count = data.length;
        } else if (typeof data.totalAnswers === "number") {
          count = data.totalAnswers;
        } else if (typeof data.totalWords === "number") {
          count = data.totalWords;
        } else if (data.ok && typeof data.count === "number") {
          count = data.count;
        } else if (data.error) {
          apiError = data.error;
        } else {
          apiError = "Unexpected response format from Apps Script";
        }
      }
    } catch (err) {
      apiError = err.message;
    }
  }

  const number = count ?? FALLBACK_COUNT;

  if (number === null) {
    return res.status(503).json({
      error: "No submission count available",
      hint: `Set the env var for "${formKey}" or FALLBACK_COUNT.`,
      apiError,
    });
  }

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "s-maxage=5, stale-while-revalidate=10");

  return res.status(200).json({
    number,
    form: formKey,
    source: count !== null ? "api" : "fallback",
    ...(apiError && { apiError }),
  });
}
