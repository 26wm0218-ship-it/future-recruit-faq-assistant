import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OpenAIResponsesGenerator, answerQuestion } from '../src/generator.js';
import { selectEvidence, UNKNOWN } from '../src/retrieval.js';

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY を設定してから実行してください。APIへの通信は行っていません。');
  process.exit(2);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpus = JSON.parse(readFileSync(path.join(root, 'data/index.json'), 'utf8'));
const cases = JSON.parse(readFileSync(path.join(root, 'data/ai_eval_questions.json'), 'utf8'));
const generator = new OpenAIResponsesGenerator();
const rows = [];

for (const item of cases) {
  const started = Date.now();
  const result = await answerQuestion(item.question, corpus.facts, generator, selectEvidence);
  rows.push({
    question: item.question,
    expected_id: item.expected_id,
    actual_id: result.evidence_id,
    retrieval_method: result.retrieval_method,
    passed: result.evidence_id === item.expected_id && (result.evidence_id ? result.sources.length > 0 : result.answer === UNKNOWN),
    answer: result.answer,
    source_url: result.sources[0].url,
    elapsed_ms: Date.now() - started
  });
}

const passed = rows.filter(row => row.passed).length;
const report = {
  evaluated_at: new Date().toISOString(),
  corpus_checked_at: corpus.checked_at,
  model: generator.model,
  total: rows.length,
  passed,
  accuracy: passed / rows.length,
  ai_selected: rows.filter(row => row.retrieval_method === 'ai').length,
  rows
};
writeFileSync(path.join(root, 'AI_EVALUATION.json'), JSON.stringify(report, null, 2) + '\n');
const markdown = `# API接続時の追加評価

- モデル: ${generator.model}
- 参照確認日: ${corpus.checked_at}
- 全体: ${passed}/${rows.length}
- AIが根拠を選定した件数: ${report.ai_selected}
- 判定: 期待する根拠IDか棄権、出典URL、回答本文の有無。人手による意味的妥当性確認は別途必要です。

| 質問 | 期待 | 実際 | 経路 | 判定 |
|---|---|---|---|---|
${rows.map(row => `| ${row.question} | ${row.expected_id || '棄権'} | ${row.actual_id || '棄権'} | ${row.retrieval_method} | ${row.passed ? '✓' : '✗'} |`).join('\n')}
`;
writeFileSync(path.join(root, 'AI_EVALUATION.md'), markdown);
console.log(`${passed}/${rows.length} passed; AI選定 ${report.ai_selected}件`);
if (passed !== rows.length) process.exitCode = 1;