import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/server.js';
const fakeGenerator = { apiKey: '', generate: async (_, fact) => fact?.answer || '公開情報では確認できません' };

async function call(method, url, body = '') {
  const req = {
    method, url,
    async *[Symbol.asyncIterator]() { if (body) yield Buffer.from(body); }
  };
  const res = {
    status: null, headers: null, body: '',
    writeHead(status, headers) { this.status = status; this.headers = headers; },
    end(value) { this.body = value; }
  };
  await handleRequest(req, res, fakeGenerator);
  return res;
}

test('画面とメタ情報を返す', async () => {
  const page = await call('GET', '/');
  assert.equal(page.status, 200);
  assert.match(page.body, /非公式デモ/);
  const meta = await call('GET', '/api/meta');
  assert.equal(meta.status, 200);
  assert.equal(JSON.parse(meta.body).fact_count, 16);
  const style = await call('GET', '/ui.css');
  assert.equal(style.status, 200);
  assert.match(style.body, /focus-visible/);
});

test('質問APIは回答と棄権の両方にURLを付ける', async () => {
  for (const question of ['転勤はありますか？', '社員食堂のメニューは？']) {
    const response = await call('POST', '/api/ask', JSON.stringify({ question }));
    assert.equal(response.status, 200);
    const data = JSON.parse(response.body);
    assert.match(data.sources[0].url, /^https:\/\/www\.future\.co\.jp\//);
  }
});

test('不正な入力を400で拒否する', async () => {
  assert.equal((await call('POST', '/api/ask', '{')).status, 400);
  assert.equal((await call('POST', '/api/ask', JSON.stringify({ question: 'a' }))).status, 400);
});
