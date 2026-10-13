import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { selectEvidence, UNKNOWN } from '../src/retrieval.js';
import { OpenAIResponsesGenerator, answerQuestion } from '../src/generator.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpus = JSON.parse(readFileSync(path.join(root, 'data/index.json'), 'utf8'));
const fallback = new OpenAIResponsesGenerator({ apiKey: '' });

test('根拠ありの回答に公式URLを付ける', async () => {
  const result = await answerQuestion('新人研修は何か月ですか？', corpus.facts, fallback, selectEvidence);
  assert.equal(result.evidence_id, 'training');
  assert.equal(result.status, 'answered');
  assert.match(result.sources[0].url, /^https:\/\/www\.future\.co\.jp\//);
});

test('根拠なし・年度指定・複数話題では回答を控える', async () => {
  for (const question of ['Tech選考の合格率は？', '2029年度の初任給は？', '初任給はいくらで研修期間はどれくらい？']) {
    const result = await answerQuestion(question, corpus.facts, fallback, selectEvidence);
    assert.equal(result.answer, UNKNOWN);
    assert.equal(result.status, 'unknown');
    assert.ok(result.sources[0].url);
  }
});

const aiResult = choice => ({ ok: true, json: async () => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(choice) }] }] }) });

test('AIは未知の言い換えを根拠IDへ結びつけ、回答本文は登録済み要約を使う', async () => {
  const question = 'Tech選考ではどのようなバックグラウンドの人を想定していますか？';
  assert.equal(selectEvidence(question, corpus.facts), null);
  const fact = corpus.facts.find(item => item.id === 'tech');
  let request;
  const fakeFetch = async (_url, options) => {
    request = JSON.parse(options.body);
    return aiResult({ decision: 'answer', evidence_id: 'tech', support_quote: fact.answer });
  };
  const generator = new OpenAIResponsesGenerator({ apiKey: 'test', fetchImpl: fakeFetch });
  const result = await answerQuestion(question, corpus.facts, generator, selectEvidence);
  assert.equal(result.evidence_id, 'tech');
  assert.equal(result.answer, fact.answer);
  assert.equal(result.retrieval_method, 'ai');
  assert.equal(request.text.format.type, 'json_schema');
  assert.equal(request.store, false);
});

test('AIが根拠にない詳細を選んだ場合や引用を偽った場合は棄権する', async () => {
  const fact = corpus.facts.find(item => item.id === 'tech');
  for (const [question, quote] of [
    ['Tech選考の合格率は？', fact.answer],
    ['Tech選考ではどのようなバックグラウンドの人を想定していますか？', '根拠にない引用']
  ]) {
    const generator = new OpenAIResponsesGenerator({ apiKey: 'test', fetchImpl: async () => aiResult({ decision: 'answer', evidence_id: 'tech', support_quote: quote }) });
    const result = await answerQuestion(question, corpus.facts, generator, selectEvidence);
    assert.equal(result.status, 'unknown');
    assert.equal(result.answer, UNKNOWN);
  }
});

test('複数話題・年度指定の質問をAIへ送らず棄権する', async () => {
  let calls = 0;
  const generator = new OpenAIResponsesGenerator({ apiKey: 'test', fetchImpl: async () => { calls++; return aiResult({ decision: 'answer', evidence_id: 'salary', support_quote: '募集要項に記載されたポテンシャル採用の初任給は月額375,000円です。' }); } });
  for (const question of ['初任給と研修期間は？', '2029年度の初任給は？']) {
    const result = await answerQuestion(question, corpus.facts, generator, selectEvidence);
    assert.equal(result.status, 'unknown');
  }
  assert.equal(calls, 0);
});

test('確実なルール一致ではAIを呼び出さない', async () => {
  let calls = 0;
  const generator = new OpenAIResponsesGenerator({ apiKey: 'test', fetchImpl: async () => { calls++; throw new Error('unexpected API call'); } });
  const result = await answerQuestion('新人研修は何か月ですか？', corpus.facts, generator, selectEvidence);
  assert.equal(result.retrieval_method, 'rules');
  assert.equal(calls, 0);
});
