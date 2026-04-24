import { useState, useEffect, useRef } from "react";

const FORMS = [
  { key: "combo-convo", label: "Combo Convo" },
  { key: "venting-machine", label: "Venting Machine" },
  { key: "laser-focus", label: "Laser Focus" },
];

export default function App() {
  const [activeForm, setActiveForm] = useState(FORMS[0].key);
  const [savedForm, setSavedForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [count, setCount] = useState(null);
  const [source, setSource] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const activeFormRef = useRef(activeForm);
  activeFormRef.current = activeForm;

  useEffect(() => {
    fetch("/api/set-active")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.form) {
          setSavedForm(data.form);
          setActiveForm(data.form);
        }
      })
      .catch(() => null);
  }, []);

  async function saveToSmiirl() {
    setSaving(true);
    try {
      await fetch("/api/set-active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form: activeForm }),
      });
      setSavedForm(activeForm);
    } catch {
      // ignore on localhost
    }
    setSaving(false);
  }

  async function fetchCount(form) {
    try {
      const res = await fetch(`/api/submissions?form=${form}`);
      if (activeFormRef.current !== form) return;
      if (!res.ok) {
        setError(`API returned ${res.status}`);
        return;
      }
      const text = await res.text();
      if (!text) {
        setError("Empty response from API");
        return;
      }
      const data = JSON.parse(text);
      if (activeFormRef.current !== form) return;
      if (data.error) {
        setError(data.error);
      } else if (Array.isArray(data)) {
        setCount(data.length);
        setSource("api");
        setError(null);
        setLastUpdated(new Date());
      } else if (typeof data.totalAnswers === "number") {
        setCount(data.totalAnswers);
        setSource("api");
        setError(null);
        setLastUpdated(new Date());
      } else {
        setCount(data.number);
        setSource(data.source);
        setError(data.apiError || null);
        setLastUpdated(new Date());
      }
    } catch (err) {
      if (activeFormRef.current !== form) return;
      setError(err.message);
    }
  }

  useEffect(() => {
    setError(null);
    fetchCount(activeForm);
    const interval = setInterval(() => fetchCount(activeForm), 5_000);
    return () => clearInterval(interval);
  }, [activeForm]);

  const hasUnsavedChange = savedForm !== null && savedForm !== activeForm;

  return (
    <div className="container">
      <div className="form-picker">
        {FORMS.map((f) => (
          <button
            key={f.key}
            className={`form-btn ${activeForm === f.key ? "active" : ""}`}
            onClick={() => setActiveForm(f.key)}
          >
            {f.label}
            {savedForm === f.key && <span className="smiirl-badge">Smiirl</span>}
          </button>
        ))}
      </div>

      <div className="counter-card">
        {count !== null ? (
          <span className="count">{count.toLocaleString()}</span>
        ) : error ? (
          <span className="error-text">{error}</span>
        ) : (
          <span className="loading">Loading...</span>
        )}
      </div>

      <button
        className={`save-btn ${hasUnsavedChange ? "unsaved" : ""}`}
        onClick={saveToSmiirl}
        disabled={saving}
      >
        {saving
          ? "Saving..."
          : savedForm === activeForm
            ? "Saved to Smiirl"
            : "Save to Smiirl"}
      </button>

      {source && (
        <p className="source">
          Source: <span className={source === "api" ? "live" : "fallback"}>{source}</span>
        </p>
      )}

      {error && count !== null && (
        <p className="api-warning">API note: {error}</p>
      )}

      {lastUpdated && (
        <p className="updated">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}
