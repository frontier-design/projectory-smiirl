import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const FORM_QUERIES = {
  "combo-convo": () => "mode=answers",
  "venting-machine": (env) => `action=randomResponse&key=${env.VENTING_MACHINE_API_KEY || ""}`,
  "laser-focus": () => "mode=output",
};

const FORM_ENV_KEYS = {
  "combo-convo": "APPS_SCRIPT_URL_COMBO_CONVO",
  "venting-machine": "APPS_SCRIPT_URL_VENTING_MACHINE",
  "laser-focus": "APPS_SCRIPT_URL_LASER_FOCUS",
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api/submissions": {
          target: "https://script.google.com",
          changeOrigin: true,
          followRedirects: true,
          rewrite: (path) => {
            const url = new URL(path, "http://localhost");
            const form = url.searchParams.get("form") || "combo-convo";
            const envKey = FORM_ENV_KEYS[form];
            const scriptUrl = env[envKey] || "";
            if (!scriptUrl) return path;
            const parsed = new URL(scriptUrl);
            const queryFn = FORM_QUERIES[form];
            const query = queryFn ? queryFn(env) : "";
            return `${parsed.pathname}?${query}`;
          },
        },
      },
    },
  };
});
