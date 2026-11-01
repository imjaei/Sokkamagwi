// 토스페이먼츠 successUrl: 금액·주문자 검증 → 결제 승인 → 이용권 부여
import { redirect, getSession, redis, getUser, CONFIG, siteUrl } from '../../lib/server.js';

export default async function handler(req, res) {
  const q = new URL(req.url, siteUrl(req)).searchParams;
  const paymentKey = q.get('paymentKey'), orderId = q.get('orderId'), amount = +q.get('amount');
  const fail = (code) => redirect(res, `/?pay=fail&code=${encodeURIComponent(code)}#app`);
  try {
    const s = getSession(req);
    if (!s) return fail('login_required');
    const raw = await redis('GET', `order:${orderId}`);
    if (!raw) return fail('order_not_found');
    const order = JSON.parse(raw);
    if (order.uid !== s.uid) return fail('order_mismatch');
    if (order.status === 'done') return redirect(res, '/?pay=ok#app');
    if (amount !== order.amount) return fail('amount_mismatch');

    const auth = 'Basic ' + Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString('base64');
    const r = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'application/json', 'Idempotency-Key': orderId },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    const pay = await r.json();
    if (!r.ok || pay.status !== 'DONE') return fail(pay.code || 'confirm_failed');

    const u = await getUser(s.uid);
    const from = Math.max(Date.now(), +u.paidUntil || 0);
    const until = from + CONFIG.PAID_DAYS * 864e5;
    await redis('HSET', `u:${s.uid}`, 'paidUntil', until);
    await redis('SET', `order:${orderId}`, JSON.stringify({ ...order, status: 'done', paymentKey, method: pay.method, doneAt: Date.now() }));
    await redis('PERSIST', `order:${orderId}`);
    await redis('LPUSH', `pays:${s.uid}`, orderId);
    redirect(res, '/?pay=ok#app');
  } catch (e) {
    console.error('confirm', e);
    fail('server_error');
  }
}
