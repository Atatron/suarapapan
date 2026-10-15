import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Jika web/.env.local berisi GEMINI_API_KEY, /api dilayani oleh fungsi yang sama
// dengan di Vercel (web/api/*.js). Jika tidak, /api diteruskan ke server ML
// Python (IndoBERT + Ollama) seperti biasa.
function apiGemini() {
  return {
    name: 'suarapapan-api-gemini',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const nama = { '/api/parse': 'parse', '/api/kesehatan': 'kesehatan', '/api/transkripsi': 'transkripsi' }[req.url?.split('?')[0]];
        if (!nama) return next();
        try {
          const modul = await server.ssrLoadModule(`/api/${nama}.js`);
          const fungsi = modul[req.method];
          if (!fungsi) { res.statusCode = 405; return res.end(); }
          const potongan = [];
          for await (const p of req) potongan.push(p);
          const badan = potongan.length ? Buffer.concat(potongan) : undefined;
          const jawab = await fungsi(new Request(`http://lokal${req.url}`, { method: req.method, headers: req.headers, body: badan }));
          res.statusCode = jawab.status;
          jawab.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await jawab.arrayBuffer()));
        } catch (e) {
          next(e);
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.GEMINI_API_KEY) process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
  if (env.GEMINI_MODEL) process.env.GEMINI_MODEL = env.GEMINI_MODEL;
  const pakaiGemini = Boolean(env.GEMINI_API_KEY);
  return {
    plugins: [react(), pakaiGemini && apiGemini()].filter(Boolean),
    server: {
      port: 5173,
      strictPort: true,
      host: '127.0.0.1',
      // SUARAPAPAN_API=https://suarapapan.vercel.app → pakai server online (Gemini)
      // dari tampilan lokal, tanpa kunci di laptop.
      proxy: pakaiGemini ? undefined
        : env.SUARAPAPAN_API
          ? { '/api': { target: env.SUARAPAPAN_API, changeOrigin: true, secure: true } }
          : { '/api': 'http://127.0.0.1:8000' },
    },
  };
});
