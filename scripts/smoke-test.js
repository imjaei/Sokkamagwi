// 외부 서비스(Redis·카카오·토스·Claude)를 가짜로 바꿔 API 흐름을 한 번에 점검하는 스크립트
// 실행: npm run check
process.env.SESSION_SECRET = 'x'.repeat(40);
process.env.KV_REST_API_URL = 'https://redis.mock';
process.env.KV_REST_API_TOKEN = 't';
process.env.KAKAO_REST_API_KEY = 'kakao';
process.env.TOSS_CLIENT_KEY = 'test_ck';
process.env.TOSS_SECRET_KEY = 'test_sk';
process.env.ANTHROPIC_API_KEY = 'sk-test';
process.env.SITE_URL = 'https://sok.example';

const db = new Map();
let lastPrompt = '';
globalThis.fetch = async (url, opt = {}) => {
  const ok = (j, status = 200) => ({ ok: status < 400, status, json: async () => j });
  if (url === 'https://redis.mock') {
    const [cmd, ...a] = JSON.parse(opt.body);
    const h = k => (db.get(k) || {});
    switch (cmd) {
      case 'GET': return ok({ result: db.has(a[0]) ? String(db.get(a[0])) : null });
      case 'SET': db.set(a[0], a[1]); return ok({ result: 'OK' });
      case 'INCR': { const n = (+db.get(a[0]) || 0) + 1; db.set(a[0], n); return ok({ result: n }); }
      case 'HSET': { const o = h(a[0]); for (let i = 1; i < a.length; i += 2) o[a[i]] = a[i + 1]; db.set(a[0], o); return ok({ result: 1 }); }
      case 'HSETNX': { const o = h(a[0]); if (!(a[1] in o)) o[a[1]] = a[2]; db.set(a[0], o); return ok({ result: 1 }); }
      case 'HINCRBY': { const o = h(a[0]); o[a[1]] = String((+o[a[1]] || 0) + +a[2]); db.set(a[0], o); return ok({ result: +o[a[1]] }); }
      case 'HGETALL': return ok({ result: Object.entries(h(a[0])).flat() });
      case 'DEL': a.forEach(k => db.delete(k)); return ok({ result: a.length });
      default: return ok({ result: 1 });
    }
  }
  if (url.startsWith('https://kauth.kakao.com/oauth/token')) return ok({ access_token: 'at' });
  if (url.startsWith('https://kapi.kakao.com/v2/user/me')) return ok({ id: 42, kakao_account: { profile: { nickname: '재이' } } });
  if (url.startsWith('https://api.tosspayments.com/v1/payments/confirm')) return ok({ status: 'DONE', method: '카드' });
  if (url.startsWith('https://api.anthropic.com/v1/messages')) {
    lastPrompt = JSON.parse(opt.body).messages[0].content;
    const isChat = lastPrompt.includes('###판단###');
    const text = isChat ? '###판단###\n분위기: 진지\n###답장###\n그냥 좀 멍해\n###까비###\n이유: 슬퍼서요\n추천: 밥은 먹었어?'
      : '```json\n{"type":"밀당 장인형","summary":"요약","care":[],"speech":"존댓말","verdict":"결론","secrets":[]}\n```';
    return ok({ content: [{ type: 'text', text }] });
  }
  throw new Error('unexpected fetch ' + url);
};

function mockRes() {
  const r = { statusCode: 200, headers: {}, body: '' };
  r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; };
  r.status = c => { r.statusCode = c; return r; };
  r.end = b => { r.body = b || ''; };
  return r;
}
function req(url, { method = 'GET', cookie = '', body } = {}) {
  return { url, method, headers: { host: 'sok.example', cookie }, body };
}
function cookiesFrom(res) {
  const c = [].concat(res.headers['set-cookie'] || []);
  return c.map(x => x.split(';')[0]).filter(x => !x.endsWith('=')).join('; ');
}
const call = async (path, file, opts) => { const m = await import(file); const res = mockRes(); await m.default(req(path, opts), res); return res; };
const assert = (c, m) => { if (!c) { console.error('✗', m); process.exit(1); } console.log('✓', m); };

const r1 = await call('/api/auth/kakao', '../api/auth/kakao.js');
const loc = new URL(r1.headers.location);
assert(r1.statusCode === 302 && loc.host === 'kauth.kakao.com', '카카오 인가 페이지로 이동');
const st = loc.searchParams.get('state');
const r2 = await call(`/api/auth/callback?code=c&state=${st}`, '../api/auth/callback.js', { cookie: cookiesFrom(r1) });
assert(r2.headers.location === '/?login=ok#app', '카카오 콜백 → 로그인 완료');
const sess = cookiesFrom(r2);
const r3 = await call('/api/me', '../api/me.js', { cookie: sess });
const me = JSON.parse(r3.body);
assert(me.user.nick === '재이' && me.chat.left === 3 && !me.paid, '내 정보: 무료 채팅 3번');
const r4 = await call('/api/ai', '../api/ai.js', { method: 'POST', cookie: sess, body: { kind: 'free', data: { stats: '{}', excerpt: '[1/1 10:00] 나: 안녕' } } });
assert(JSON.parse(r4.body).result.type === '밀당 장인형', '무료 분석 AI 호출');
const r5 = await call('/api/ai', '../api/ai.js', { method: 'POST', cookie: sess, body: { kind: 'deep', data: {} } });
assert(r5.statusCode === 402, '결제 전 정밀 분석 차단');
const tk = { yname: '오빠', style: {}, pairs: [], tail: [{ w: 'you', x: '어제 콩이 하늘나라 갔어', t: Date.now() - 864e5 }], log: [{ w: 'me', x: '오빠 괜찮아?', t: Date.now() }] };
for (let i = 0; i < 3; i++) await call('/api/ai', '../api/ai.js', { method: 'POST', cookie: sess, body: { kind: 'chat', data: { tk } } });
assert(lastPrompt.includes('지금 대화 분위기 경고'), '상실 대화에서 분위기 경고가 프롬프트에 들어감');
const r6 = await call('/api/ai', '../api/ai.js', { method: 'POST', cookie: sess, body: { kind: 'chat', data: { tk } } });
assert(r6.statusCode === 402 && JSON.parse(r6.body).error === 'quota', '무료 3번 뒤 채팅 차단');
const r7 = await call('/api/pay/order', '../api/pay/order.js', { method: 'POST', cookie: sess });
const order = JSON.parse(r7.body);
assert(order.amount === 2900 && order.orderId.startsWith('skm_'), '주문 생성(금액은 서버가 결정)');
const bad = await call(`/api/pay/confirm?paymentKey=p&orderId=${order.orderId}&amount=100`, '../api/pay/confirm.js', { cookie: sess });
assert(bad.headers.location.includes('amount_mismatch'), '금액 조작 차단');
const good = await call(`/api/pay/confirm?paymentKey=p&orderId=${order.orderId}&amount=2900`, '../api/pay/confirm.js', { cookie: sess });
assert(good.headers.location === '/?pay=ok#app', '결제 승인');
const me2 = JSON.parse((await call('/api/me', '../api/me.js', { cookie: sess })).body);
assert(me2.paid && me2.chat.left === 15, '결제 후 하루 15번');
const r8 = await call('/api/ai', '../api/ai.js', { method: 'POST', cookie: sess, body: { kind: 'chat', data: { tk } } });
assert(JSON.parse(r8.body).chat.left === 14 && JSON.parse(r8.body).mood.grief, '결제 후 채팅, 남은 횟수 차감');
const r9 = await call('/api/ai', '../api/ai.js', { method: 'POST', body: { kind: 'free', data: {} } });
assert(r9.statusCode === 401, '로그인 없이 AI 호출 차단');
console.log('\n모든 점검 통과');
