import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const CRITICAL_FONTS = ['FoundersGrotesk-Regular', 'FoundersGrotesk-Semibold'];

function criticalCssAndFonts(): Plugin {
  return {
    name: 'critical-css-and-fonts',
    enforce: 'post',
    transformIndexHtml(html, ctx) {
      if (!ctx.bundle) return html;

      const fontAssets = Object.keys(ctx.bundle).filter(
        (k) => k.endsWith('.woff2') && CRITICAL_FONTS.some((f) => k.includes(f))
      );

      const fontPreloads = fontAssets.map((asset) =>
        `<link rel="preload" href="/${asset}" as="font" type="font/woff2" crossorigin="anonymous">`
      ).join('\n  ');

      const cssEntry = Object.keys(ctx.bundle).find(
        (k) => k.endsWith('.css') && k.includes('index')
      );

      let criticalCss = `*{margin:0;padding:0;box-sizing:border-box}:root{--black:#0A0A0A;--gray:#ADADAD;--dark-gray:#35343F;--background-dark-gray:#1c1c1c;--linear-gradient:linear-gradient(90deg,#A72C4B 0%,#F37655 100%);--second-gradient:linear-gradient(90deg,#B34747,#D87A5A);--lime:#BCCE2D}body{background-color:#0A0A0A;color:#fff}`;

      if (cssEntry) {
        const chunk = ctx.bundle[cssEntry];
        if (chunk && 'source' in chunk) {
          const fullCss = String(chunk.source);
          const containerMatch = fullCss.match(/\._container_[a-z0-9_]+\{[^}]+\}/);
          if (containerMatch) criticalCss += containerMatch[0];
        }
      }

      const fontFaces = fontAssets.map((asset) => {
        const name = asset.includes('Regular') ? 'FounderGrotesk_Regular'
          : asset.includes('Semibold') ? 'FounderGrotesk_SemiBold' : '';
        if (!name) return '';
        return `@font-face{font-family:'${name}';src:url('/${asset}') format('woff2');font-display:swap}`;
      }).filter(Boolean).join('');

      criticalCss += fontFaces;
      criticalCss += `*{font-family:'FounderGrotesk_Regular',sans-serif}h1{font-family:'FounderGrotesk_SemiBold';font-size:80px}`;

      const inlineStyle = `<style>${criticalCss}</style>`;

      if (cssEntry) {
        html = html.replace(
          `<link rel="stylesheet" crossorigin href="/${cssEntry}">`,
          `${inlineStyle}\n  ${fontPreloads}\n  <link rel="stylesheet" href="/${cssEntry}" media="print" onload="this.media='all'">\n  <noscript><link rel="stylesheet" href="/${cssEntry}"></noscript>`
        );
      }

      return html;
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [react(), criticalCssAndFonts()],
  server: {
    proxy: {
      '/api/combo-convo-form': {
        target:
          'https://script.google.com/macros/s/AKfycbyBjqgKCilAgqqpy_HkuyrrJ0HaLka-Ch6yea-swOFSKnfRu7dPO7dTc4yLNx2gQ0ZR/exec',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(/^\/api\/combo-convo-form/, '')
      },
      '/api/venting-machine-form': {
        target:
          'https://script.google.com/macros/s/AKfycbz9PRZKGHPK6YMt-f8FXUY5vnsDVW8g2xyUI9NDoFyVuT-NH05UWqsLxhf-7NqvAzKfHA/exec',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/venting-machine-form/, '')
      },
      '/api/laser-focus-form': {
        target: 'https://script.google.com/macros/s/AKfycbyPHYnixWbW2tKp2gK0LkAupBk89LDTDwOdCDy_DltvOvtgkq115bwUgRIDlG1eknJS/exec',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/laser-focus-form/, ''),
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['access-control-allow-origin'] = '*';
            proxyRes.headers['access-control-allow-methods'] = 'GET,POST,OPTIONS';
            proxyRes.headers['access-control-allow-headers'] = 'Content-Type';
          });
        }
      },
    }
  },
  build: {
    outDir: 'docs',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-d3': ['d3'],
        },
      },
    },
  }
});