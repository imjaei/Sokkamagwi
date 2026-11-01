// AI 호출 프록시: 로그인·이용권·횟수를 서버에서 확인하고, 프롬프트도 서버에서 만든다
import { json, getSession, readBody, entitlements, useChat, dailyLimit, claude, parseJSON, CONFIG } from '../lib/server.js';
import { freePrompt, personaPrompt, deepPrompt, chatPrompt, cleanTalk, moodOf } from '../lib/prompts.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  const s = getSession(req);
  if (!s) return json(res, 401, { error: 'login_required' });
  let body;
  try { body = await readBody(req); } catch { return json(res, 413, { error: 'prompt_too_large' }); }
  const kind = body.kind, data = body.data || {};
  try {
    if (kind === 'free' || kind === 'persona') {
      if (!(await dailyLimit(s.uid, 'an', CONFIG.ANALYSES_PER_DAY))) return json(res, 429, { error: 'daily_limit' });
      const prompt = kind === 'free' ? freePrompt(data) : personaPrompt(data);
      const text = await claude(CONFIG.MODEL_FAST, prompt, kind === 'free' ? 1500 : 3500);
      const out = parseJSON(text);
      if (!out) return json(res, 502, { error: 'invalid_json' });
      return json(res, 200, { result: out });
    }
    if (kind === 'deep') {
      const ent = await entitlements(s.uid);
      if (!ent.paid) return json(res, 402, { error: 'not_paid' });
      if (!(await dailyLimit(s.uid, 'deep', CONFIG.DEEP_PER_DAY))) return json(res, 429, { error: 'daily_limit' });
      const text = await claude(CONFIG.MODEL_DEEP, deepPrompt(data), 6000);
      const out = parseJSON(text);
      if (!out) return json(res, 502, { error: 'invalid_json' });
      return json(res, 200, { result: out });
    }
    if (kind === 'chat') {
      const ent = await entitlements(s.uid);
      if (ent.chat.left <= 0) return json(res, 402, { error: 'quota', chat: ent.chat });
      const tk = cleanTalk(data.tk);
      if (!tk.log.length || tk.log[tk.log.length - 1].w !== 'me') return json(res, 400, { error: 'bad_request' });
      const mood = moodOf(tk);
      const text = await claude(CONFIG.MODEL_CHAT, chatPrompt(tk), 1500);
      await useChat(s.uid, ent.paid);
      const after = await entitlements(s.uid);
      return json(res, 200, { text, mood, chat: after.chat });
    }
    json(res, 400, { error: 'bad_request' });
  } catch (e) {
    console.error('ai', kind, e.message);
    json(res, e.code === 'rate_limited' ? 429 : 502, { error: e.code || 'upstream_error' });
  }
}
