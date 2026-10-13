import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.resolve(root, '..', 'future-recruit-faq-demo.html');
const corpus = JSON.parse(readFileSync(path.join(root, 'data/index.json'), 'utf8'));
const style = readFileSync(path.join(root, 'public/ui.css'), 'utf8');
const retrieval = readFileSync(path.join(root, 'src/retrieval.js'), 'utf8').replace(/^export /gm, '');
const app = readFileSync(path.join(root, 'public/app.js'), 'utf8');
let html = readFileSync(path.join(root, 'public/index.html'), 'utf8');
html = html.replace('<link rel="stylesheet" href="/ui.css">', `<style>${style}</style>`);
html = html.replace('<script src="/app.js" defer></script>', `<script>
const corpus = ${JSON.stringify(corpus).replaceAll('<', '\\u003c')};
${retrieval}
window.APP_TRANSPORT = {
  meta: async () => ({ checked_at: corpus.checked_at, fact_count: corpus.facts.length, mode: 'オフライン · 根拠検索のみ' }),
  ask: async question => {
    const fact = selectEvidence(question, corpus.facts);
    return {
      answer: fact ? fact.answer : UNKNOWN,
      status: fact ? 'answered' : 'unknown',
      evidence_id: fact?.id || null,
      sources: [{ title: fact ? 'フューチャー株式会社 新卒採用情報' : '確認対象: フューチャー株式会社 新卒採用情報', url: fact?.source_url || 'https://www.future.co.jp/recruit/recruit/rec-fresh/' }]
    };
  }
};
${app}
</script>`);
writeFileSync(target, html);
mkdirSync(path.join(root, 'docs'), { recursive: true });
writeFileSync(path.join(root, 'docs/index.html'), html);
console.log(target);
