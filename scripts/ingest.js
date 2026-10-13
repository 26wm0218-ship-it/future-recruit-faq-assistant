import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = JSON.parse(readFileSync(path.join(root, 'data/facts.json'), 'utf8'));
const rules = JSON.parse(readFileSync(path.join(root, 'data/intent_rules.json'), 'utf8'));
const allowed = new URL('https://www.future.co.jp/recruit/recruit/rec-fresh/');
if (!Array.isArray(input.facts) || input.facts.length < 10) throw new Error('10件以上の事実が必要です');
const ids = new Set();
for (const fact of input.facts) {
  if (ids.has(fact.id)) throw new Error(`重複ID: ${fact.id}`);
  ids.add(fact.id);
  if (!fact.question || !fact.answer || !fact.category || !Array.isArray(fact.terms) || !fact.terms.length) throw new Error(`不足項目: ${fact.id}`);
  const url = new URL(fact.source_url);
  if (url.origin !== allowed.origin || url.pathname !== allowed.pathname || url.search || !['#section2', '#section3'].includes(url.hash)) throw new Error(`許可外の出典URL: ${fact.id}`);
  if (fact.answer.length > 220) throw new Error(`要約が長すぎます: ${fact.id}`);
  if (!rules[fact.id] || !Array.isArray(rules[fact.id].subjects) || !rules[fact.id].subjects.length || !Array.isArray(rules[fact.id].aspects) || !rules[fact.id].aspects.length) throw new Error(`検索ルール不足: ${fact.id}`);
}
if (Object.keys(rules).length !== input.facts.length) throw new Error('検索ルールと事実の件数が一致しません');
const output = { checked_at: input.checked_at, source_policy: input.source_policy, facts: input.facts.map(fact => ({ ...fact, intent: rules[fact.id] })) };
mkdirSync(path.join(root, 'data'), { recursive: true });
writeFileSync(path.join(root, 'data/index.json'), JSON.stringify(output, null, 2) + '\n');
console.log(`${input.facts.length}件の公式ページ由来の短い要約を取り込みました`);
