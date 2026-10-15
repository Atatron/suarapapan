import { kunciGemini } from './_urai.js';

// Bentuknya sama dengan /api/kesehatan di ml/serve.py, ditambah "gemini".
export function GET() {
  return Response.json({ server: true, ollama: false, indobert: false, gemini: Boolean(kunciGemini()) });
}
