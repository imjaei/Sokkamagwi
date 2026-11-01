// 결제 주문 만들기: 금액은 서버가 정하고 Redis에 기록
import crypto from 'node:crypto';
import { json, getSession, redis, getUser, CONFIG } from '../../lib/server.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method' });
  const s = getSession(req);
  if (!s) return json(res, 401, { error: 'login_required' });
  if (!process.env.TOSS_CLIENT_KEY) return json(res, 500, { error: 'server_config' });
  try {
    const orderId = 'skm_' + crypto.randomUUID().replace(/-/g, '').slice(0, 28);
    await redis('SET', `order:${orderId}`, JSON.stringify({ uid: s.uid, amount: CONFIG.PRICE, status: 'pending', at: Date.now() }), 'EX', 3600);
    const u = await getUser(s.uid);
    let ck = u.customerKey;
    if (!ck) { ck = 'ck_' + crypto.randomUUID(); await redis('HSET', `u:${s.uid}`, 'customerKey', ck); }
    json(res, 200, { orderId, amount: CONFIG.PRICE, orderName: CONFIG.ORDER_NAME, customerKey: ck, customerName: s.nick, clientKey: process.env.TOSS_CLIENT_KEY });
  } catch (e) {
    console.error('order', e);
    json(res, 500, { error: 'server_error' });
  }
}
