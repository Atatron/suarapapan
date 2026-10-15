import { kunciGemini } from './_urai.js';

// Bentuknya sama dengan /api/kesehatan di ml/serve.py, ditambah "gemini" dan
// "suara" (transkripsi audio akurat tersedia).
export function GET() {
  const ada = Boolean(kunciGemini());
  return Response.json({ server: true, ollama: false, indobert: false, gemini: ada, suara: ada });
}
