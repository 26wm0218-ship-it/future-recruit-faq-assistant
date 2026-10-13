import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(path.join(root, '..', 'future-recruit-faq-demo.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if (!script) throw new Error('オフラインHTMLにスクリプトがありません');
const core = script.split('window.APP_TRANSPORT =')[0];
const cases = JSON.parse(readFileSync(path.join(root, 'data/eval_questions.json'), 'utf8'));

test('オフライン版は外部アセット不要でスクリプトを解釈できる', () => {
  new vm.Script(script);
  assert.doesNotMatch(html, /href="\/ui\.css"|src="\/app\.js"/);
});

test('オフライン版も全評価質問でWeb版と同じ根拠を選ぶ', () => {
  for (const item of cases) {
    const context = vm.createContext({});
    const actual = vm.runInContext(`${core}\nselectEvidence(${JSON.stringify(item.question)}, corpus.facts)?.id ?? null`, context, { timeout: 1000 });
    assert.equal(actual, item.expected_id, item.question);
  }
});
