import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { selectEvidence, UNKNOWN } from '../src/retrieval.js';
import { extractiveAnswer } from '../src/generator.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const corpus = JSON.parse(readFileSync(path.join(root, 'data/index.json'), 'utf8'));
const cases = JSON.parse(readFileSync(path.join(root, 'data/eval_questions.json'), 'utf8'));
const rows = cases.map(item => {
  const fact = selectEvidence(item.question, corpus.facts);
  const actual = fact?.id || null;
  const answer = extractiveAnswer(fact);
  return { question: item.question, expected_id: item.expected_id, actual_id: actual, passed: actual === item.expected_id && (actual ? !!fact.source_url : answer === UNKNOWN), answer, source_url: fact?.source_url || 'https://www.future.co.jp/recruit/recruit/rec-fresh/' };
});
const passed = rows.filter(row => row.passed).length;
const answerable = rows.filter(row => row.expected_id !== null);
const unanswerable = rows.filter(row => row.expected_id === null);
const answerablePassed = answerable.filter(row => row.passed).length;
const abstentionPassed = unanswerable.filter(row => row.passed).length;
const falseAnswers = unanswerable.filter(row => row.actual_id !== null).length;
const report = { evaluated_at: new Date().toISOString(), corpus_checked_at: corpus.checked_at, mode: 'APIキーなし・ルール検索', total: rows.length, passed, accuracy: passed / rows.length, answerable: { total: answerable.length, passed: answerablePassed }, unanswerable: { total: unanswerable.length, abstained: abstentionPassed, false_answers: falseAnswers }, rows };
writeFileSync(path.join(root, 'EVALUATION.json'), JSON.stringify(report, null, 2) + '\n');
const markdown = `# 評価結果\n\n- 実行モード: APIキーなし・ルール検索\n- 参照確認日: ${corpus.checked_at}\n- 全体: ${passed}/${rows.length} 一致 (${Math.round(100 * passed / rows.length)}%)\n- 回答可能な質問: ${answerablePassed}/${answerable.length} 正しい根拠ID\n- 回答不能な質問: ${abstentionPassed}/${unanswerable.length} 棄権、誤回答 ${falseAnswers} 件\n- 判定: 期待する根拠IDへの検索一致、根拠なし時の棄権、出典URLの存在。未知の質問への精度は保証しません。\n\n| 質問 | 期待 | 実際 | 判定 |\n|---|---|---|---|\n${rows.map(row => `| ${row.question} | ${row.expected_id || '棄権'} | ${row.actual_id || '棄権'} | ${row.passed ? '✓' : '✗'} |`).join('\n')}\n\nAPI経由の根拠選定はAPIキーがないため未評価です。\n`;
writeFileSync(path.join(root, 'EVALUATION.md'), markdown);
console.log(`${passed}/${rows.length} passed`);
if (passed !== rows.length) process.exitCode = 1;
