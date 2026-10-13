export const UNKNOWN = '公開情報では確認できません';

export const normalize = value => String(value).normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');

function matchTerms(query, terms) {
  return terms.map(normalize).filter(term => term.length >= 2 && query.includes(term));
}

function evidenceCoverage(query, terms) {
  // 挨拶・助詞などを除いた質問のうち、照合した語が説明できる割合。
  const semantic = query.replace(/(?:教えてください|教えて|できますか|ありますか|でしょうか|何ですか|ですか|について|どんな)/g, '')
    .replace(/[はがのをにでもか]/g, '');
  if (!semantic) return 0;
  let remainder = semantic;
  for (const term of [...new Set(terms)].sort((a, b) => b.length - a.length)) remainder = remainder.replaceAll(term, '');
  return 1 - remainder.length / semantic.length;
}

export function mustAbstain(question, facts) {
  const query = normalize(question);
  if (/(?:20\d{2}|\d{2})年度?/.test(query)) return true;
  const genericSubjects = new Set(['選考', '応募', '新卒']);
  const topics = new Map();
  for (const fact of facts) {
    const matched = fact.intent.subjects.map(normalize).filter(term =>
      term.length >= 2 && !genericSubjects.has(term) && query.includes(term));
    if (matched.length) topics.set(fact.id, matched);
  }
  if (topics.size < 2) return false;
  const oneFactCoversAll = facts.some(fact => [...topics].every(([id, terms]) =>
    id === fact.id || terms.some(term => normalize(fact.answer).includes(term))));
  return !oneFactCoversAll;
}

export function search(question, facts, limit = 5) {
  const query = normalize(question);
  if (query.length < 2 || mustAbstain(question, facts)) return [];
  return facts.map(fact => {
    const subjects = matchTerms(query, fact.intent.subjects);
    const aspects = matchTerms(query, fact.intent.aspects);
    if (!subjects.length || !aspects.length) return null;
    if (evidenceCoverage(query, [...subjects, ...aspects]) < 0.45) return null;
    const score = Math.max(...subjects.map(s => s.length)) * 2 + Math.max(...aspects.map(s => s.length));
    return { fact, score, matched_subjects: subjects, matched_aspects: aspects };
  }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, limit);
}

export function selectEvidence(question, facts) {
  const hits = search(question, facts);
  // 高精度優先: 対象と尋ねている項目の両方が一致し、候補が一つだけのとき回答する。
  if (hits.length !== 1) return null;
  const query = normalize(question);
  const genericSubjects = new Set(['選考', '応募', '新卒', '研修']);
  const otherTopic = facts.some(fact => fact.id !== hits[0].fact.id && fact.intent.subjects.some(subject => {
    const term = normalize(subject);
    return term.length >= 2 && !genericSubjects.has(term) && query.includes(term);
  }));
  return otherTopic ? null : hits[0].fact;
}
