import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectEvidence } from './retrieval.js';
import { OpenAIResponsesGenerator, answerQuestion } from './generator.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(root, 'data/index.json');
if (!existsSync(indexPath)) throw new Error('まず npm run ingest を実行してください');
const corpus = JSON.parse(readFileSync(indexPath, 'utf8'));
const generator = new OpenAIResponsesGenerator();
const port = Number(process.env.PORT || 3000);
const send = (res, status, data, type = 'application/json; charset=utf-8') => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof data === 'string' ? data : JSON.stringify(data));
};

export async function handleRequest(req, res, activeGenerator = generator) {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (req.method === 'GET' && pathname === '/') return send(res, 200, readFileSync(path.join(root, 'public/index.html'), 'utf8'), 'text/html; charset=utf-8');
  if (req.method === 'GET' && pathname === '/app.js') return send(res, 200, readFileSync(path.join(root, 'public/app.js'), 'utf8'), 'text/javascript; charset=utf-8');
  if (req.method === 'GET' && pathname === '/ui.css') return send(res, 200, readFileSync(path.join(root, 'public/ui.css'), 'utf8'), 'text/css; charset=utf-8');
  if (req.method === 'GET' && pathname === '/api/meta') return send(res, 200, { checked_at: corpus.checked_at, fact_count: corpus.facts.length, mode: activeGenerator.apiKey ? 'ルール検索 + AI根拠選定' : 'ルール検索のみ' });
  if (req.method === 'POST' && pathname === '/api/ask') {
    let raw = '';
    try {
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 4096) return send(res, 413, { error: '質問が長すぎます' });
      }
      const question = JSON.parse(raw).question;
      if (typeof question !== 'string' || question.trim().length < 2 || question.length > 300) return send(res, 400, { error: '2～300文字で質問してください' });
      return send(res, 200, await answerQuestion(question.trim(), corpus.facts, activeGenerator, selectEvidence));
    } catch { return send(res, 400, { error: 'リクエストを処理できませんでした' }); }
  }
  return send(res, 404, { error: 'Not found' });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createServer(handleRequest).listen(port, '127.0.0.1', () => console.log(`非公式デモ: http://127.0.0.1:${port}`));
}
