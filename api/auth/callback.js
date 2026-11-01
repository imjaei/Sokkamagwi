// 카카오 로그인 콜백: 인가 코드 → 토큰 → 닉네임 → 세션 쿠키
import { redirect, siteUrl, cookie, sign, verify, getCookies, redis } from '../../lib/server.js';

export default async function handler(req, res) {
  const base = siteUrl(req);
  try {
    const q = new URL(req.url, base).searchParams;
    if (q.get('error')) return redirect(res, '/?login=cancel#app');
    const st = verify(getCookies(req).skm_st);
    if (!st || st.state !== q.get('state')) return redirect(res, '/?login=fail#app');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.KAKAO_REST_API_KEY || '',
      redirect_uri: `${base}/api/auth/callback`,
      code: q.get('code') || '',
    });
    if (process.env.KAKAO_CLIENT_SECRET) body.set('client_secret', process.env.KAKAO_CLIENT_SECRET);
    const tr = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body,
    });
    const tok = await tr.json();
    if (!tok.access_token) return redirect(res, '/?login=fail#app');

    const ur = await fetch('https://kapi.kakao.com/v2/user/me', { headers: { Authorization: `Bearer ${tok.access_token}` } });
    const me = await ur.json();
    if (!me.id) return redirect(res, '/?login=fail#app');
    const uid = `k${me.id}`;
    const nick = (me.kakao_account?.profile?.nickname || '까비친구').slice(0, 20);
    await redis('HSET', `u:${uid}`, 'nick', nick, 'lastLogin', Date.now());
    await redis('HSETNX', `u:${uid}`, 'createdAt', Date.now());

    res.setHeader('Set-Cookie', [
      cookie('skm_s', sign({ uid, nick, exp: Date.now() + 30 * 864e5 }), 30 * 86400),
      cookie('skm_st', '', 0),
    ]);
    redirect(res, '/?login=ok#app');
  } catch (e) {
    console.error('kakao callback', e);
    redirect(res, '/?login=fail#app');
  }
}
