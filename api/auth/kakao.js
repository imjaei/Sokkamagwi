// 카카오 로그인 시작: 카카오 인가 페이지로 보냄
import crypto from 'node:crypto';
import { redirect, siteUrl, cookie, sign } from '../../lib/server.js';

export default function handler(req, res) {
  const state = crypto.randomBytes(16).toString('hex');
  res.setHeader('Set-Cookie', cookie('skm_st', sign({ state, exp: Date.now() + 10 * 60e3 }), 600));
  const u = new URL('https://kauth.kakao.com/oauth/authorize');
  u.searchParams.set('client_id', process.env.KAKAO_REST_API_KEY || '');
  u.searchParams.set('redirect_uri', `${siteUrl(req)}/api/auth/callback`);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('state', state);
  redirect(res, u.toString());
}
