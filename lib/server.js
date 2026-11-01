// 공통 서버 유틸: 세션 쿠키, Redis(Upstash REST), 이용권/횟수, Claude API 호출
import crypto from 'node:crypto';

export const CONFIG = {
  PRICE: 2900,                                   // 속마음 열기 가격(원)
  ORDER_NAME: '속까마귀 속마음 열기',
  FREE_CHATS: 3,                                 // 로그인 사용자 무료 AI 채팅 횟수(평생)
  PAID_DAILY: 15,                                // 결제 후 하루 AI 채팅 횟수
  PAID_DAYS: +(process.env.PAID_DAYS || 30),     // 결제 1번의 이용 기간(일)
  ANALYSES_PER_DAY: +(process.env.ANALYSES_PER_DAY || 20), // 무료 분석·말투 카드 하루 호출 한도
  DEEP_PER_DAY: +(process.env.DEEP_PER_DAY || 5),          // 정밀 분석 하루 호출 한도
  MODEL_FAST: process.env.MODEL_FAST || 'claude-sonnet-5-5',  // 무료 요약, 말투 카드
  MODEL_DEEP: process.env.MODEL_DEEP || 'claude-opus-5-5',    // 정밀 분석(유료)
  MODEL_CHAT: process.env.MODEL_CHAT || 'claude-opus-5-5',    // 그 사람 AI 채팅
};

/* ---------- 응답 헬퍼 ---------- */
export function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
export function redirect(res, url) {
  res.statusCode = 302;
  res.setHeader('Location', url);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}
export function siteUrl(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, '');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `https://${host}`;
}
export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > 3_000_000) throw new Error('too_large'); chunks.push(c); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return {}; }
}

/* ---------- 서명 쿠키 세션 ---------- */
function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET 환경변수를 32자 이상으로 설정하세요');
  return s;
}
export function sign(obj) {
  const p = Buffer.from(JSON.stringify(obj)).toString('base64url');
  const s = crypto.createHmac('sha256', secret()).update(p).digest('base64url');
  return `${p}.${s}`;
}
export function verify(tok) {
  if (!tok || typeof tok !== 'string') return null;
  const [p, s] = tok.split('.');
  if (!p || !s) return null;
  const e = crypto.createHmac('sha256', secret()).update(p).digest('base64url');
  const a = Buffer.from(s), b = Buffer.from(e);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const o = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    if (!o.exp || o.exp < Date.now()) return null;
    return o;
  } catch { return null; }
}
export function getCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(kv => {
    const i = kv.indexOf('=');
    if (i > 0) out[kv.slice(0, i).trim()] = decodeURIComponent(kv.slice(i + 1).trim());
  });
  return out;
}
export function cookie(name, value, maxAgeSec) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSec}`;
}
export function getSession(req) { return verify(getCookies(req).skm_s); }

/* ---------- Redis (Upstash REST / Vercel KV) ---------- */
export async function redis(...cmd) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Redis 환경변수가 없어요 (KV_REST_API_URL / KV_REST_API_TOKEN)');
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd.map(String)),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
export function kstDay(t = Date.now()) { return new Date(t + 9 * 3600e3).toISOString().slice(0, 10); }

export async function getUser(uid) {
  const arr = (await redis('HGETALL', `u:${uid}`)) || [];
  const o = {};
  for (let i = 0; i < arr.length; i += 2) o[arr[i]] = arr[i + 1];
  return o;
}
export async function entitlements(uid) {
  const u = await getUser(uid);
  const paidUntil = +u.paidUntil || 0;
  const paid = paidUntil > Date.now();
  if (paid) {
    const used = +(await redis('GET', `chat:${uid}:${kstDay()}`)) || 0;
    return { paid, paidUntil, chat: { left: Math.max(0, CONFIG.PAID_DAILY - used), max: CONFIG.PAID_DAILY, paid: true } };
  }
  const free = +u.freeUsed || 0;
  return { paid, paidUntil, chat: { left: Math.max(0, CONFIG.FREE_CHATS - free), max: CONFIG.FREE_CHATS, paid: false } };
}
export async function useChat(uid, paid) {
  if (paid) {
    const k = `chat:${uid}:${kstDay()}`;
    await redis('INCR', k); await redis('EXPIRE', k, 60 * 60 * 48);
  } else {
    await redis('HINCRBY', `u:${uid}`, 'freeUsed', 1);
  }
}
/* 하루 호출 한도: 넘으면 false */
export async function dailyLimit(uid, name, max) {
  const k = `rl:${name}:${uid}:${kstDay()}`;
  const n = await redis('INCR', k);
  if (n === 1) await redis('EXPIRE', k, 60 * 60 * 48);
  return n <= max;
}

/* ---------- Claude API ---------- */
export async function claude(model, prompt, maxTokens) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw Object.assign(new Error('ANTHROPIC_API_KEY 없음'), { code: 'server_config' });
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const code = r.status === 429 || r.status === 529 ? 'rate_limited' : 'upstream_error';
    throw Object.assign(new Error(j?.error?.message || `Claude API ${r.status}`), { code });
  }
  const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  if (!text.trim()) throw Object.assign(new Error('empty'), { code: 'empty_completion' });
  return text;
}
export function parseJSON(text) {
  try { return JSON.parse(text); } catch {}
  const f = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (f) { try { return JSON.parse(f[1]); } catch {} }
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(text.slice(a, b + 1)); } catch {} }
  return null;
}
