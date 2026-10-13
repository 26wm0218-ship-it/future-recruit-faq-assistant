const transport = window.APP_TRANSPORT || {
  meta: async () => { const response = await fetch('/api/meta'); return response.json(); },
  ask: async question => {
    const response = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '通信に失敗しました');
    return data;
  }
};

const conversation = document.querySelector('#conversation');
const welcome = document.querySelector('#welcome');
const form = document.querySelector('#ask-form');
const input = document.querySelector('#question');
const send = document.querySelector('#send');
const clear = document.querySelector('#clear');
const count = document.querySelector('#question-count');
let busy = false;

function updateCount() {
  count.textContent = `${input.value.length} / 300文字`;
}

function message(role, text, data = null) {
  const article = document.createElement('article');
  article.className = `message ${role}`;
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'user' ? 'Q' : 'A';
  const body = document.createElement('div');
  body.className = 'message-body';
  const label = document.createElement('div');
  label.className = 'message-label';
  label.textContent = role === 'user' ? 'あなた' : '非公式デモ';
  if (data) {
    const status = document.createElement('span');
    status.className = `answer-status ${data.status === 'answered' ? 'supported' : 'unknown'}`;
    status.textContent = data.status === 'answered' ? (data.retrieval_method === 'ai' ? 'AIが根拠を選定' : '公開情報から回答') : '確認できない質問';
    label.append(status);
  }
  const paragraph = document.createElement('p');
  if (role === 'assistant' && data?.status === 'answered') {
    const breakAt = text.indexOf('。');
    const summary = breakAt >= 0 ? text.slice(0, breakAt + 1) : text;
    const detail = breakAt >= 0 ? text.slice(breakAt + 1).trim() : '';
    const heading = document.createElement('span');
    heading.className = 'answer-part-label';
    heading.textContent = '回答';
    const lead = document.createElement('strong');
    lead.className = 'answer-lead';
    lead.textContent = summary;
    paragraph.append(heading, lead);
    if (detail) {
      const note = document.createElement('span');
      note.className = 'answer-detail';
      note.textContent = detail;
      paragraph.append(note);
    }
  } else {
    paragraph.textContent = text;
  }
  body.append(label, paragraph);
  if (data?.sources?.length) {
    const sourceBox = document.createElement('div');
    sourceBox.className = 'source-box';
    const sourceLabel = document.createElement('span');
    sourceLabel.textContent = data.status === 'answered' ? '根拠となる公式ページ' : '確認対象の公式ページ';
    sourceBox.append(sourceLabel);
    for (const source of data.sources) {
      const link = document.createElement('a');
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = source.url;
      link.title = source.title || source.url;
      sourceBox.append(link);
    }
    body.append(sourceBox);
  }
  article.append(avatar, body);
  conversation.append(article);
  conversation.scrollTop = conversation.scrollHeight;
  return { article, paragraph };
}

async function ask(question) {
  question = question.trim();
  if (busy || question.length < 2 || question.length > 300) return;
  busy = true;
  send.disabled = true;
  clear.disabled = true;
  welcome.hidden = true;
  message('user', question);
  input.value = '';
  input.style.height = 'auto';
  updateCount();
  const pending = message('assistant', '公開情報を確認しています…');
  pending.article.classList.add('pending');
  try {
    const result = await transport.ask(question);
    pending.article.remove();
    message('assistant', result.answer, result);
  } catch (error) {
    pending.paragraph.textContent = `回答を取得できませんでした。${error.message}`;
    pending.article.classList.remove('pending');
  } finally {
    busy = false;
    send.disabled = false;
    clear.disabled = false;
    input.focus();
  }
}

form.addEventListener('submit', event => { event.preventDefault(); ask(input.value); });
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 144)}px`;
  updateCount();
});
input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
    event.preventDefault();
    ask(input.value);
  }
});
document.querySelectorAll('[data-question]').forEach(button => button.addEventListener('click', () => ask(button.dataset.question)));
clear.addEventListener('click', () => {
  conversation.querySelectorAll('.message').forEach(node => node.remove());
  welcome.hidden = false;
  input.focus();
});
transport.meta().then(meta => {
  document.querySelector('#mode').textContent = meta.mode;
  document.querySelector('#checked').textContent = `参照確認日 ${meta.checked_at} · ${meta.fact_count}件の要約`;
  document.querySelector('#ai-note').hidden = !meta.mode.includes('AI');
}).catch(() => { document.querySelector('#mode').textContent = '接続確認中'; });
