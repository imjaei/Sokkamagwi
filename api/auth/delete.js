// 회원 탈퇴: 회원 정보·이용 기록 삭제 (결제 기록은 전자상거래법상 보관 기간 동안 주문 단위로 남김)
import { json, getSession, cookie, redis, kstDay } from '../../lib/server.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  const s = getSession(req);
  if (s) {
    try {
      await redis('DEL', `u:${s.uid}`, `chat:${s.uid}:${kstDay()}`);
    } catch (e) { console.error('delete', e); }
  }
  res.setHeader('Set-Cookie', cookie('skm_s', '', 0));
  json(res, 200, { ok: true });
}
