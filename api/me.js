// 로그인 상태와 이용권·채팅 남은 횟수
import { json, getSession, entitlements } from '../lib/server.js';
export default async function handler(req, res) {
  const s = getSession(req);
  if (!s) return json(res, 200, { user: null });
  try {
    const ent = await entitlements(s.uid);
    json(res, 200, { user: { nick: s.nick }, ...ent });
  } catch (e) {
    console.error('me', e);
    json(res, 500, { error: 'server_error' });
  }
}
