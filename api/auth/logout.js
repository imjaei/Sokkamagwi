import { json, cookie } from '../../lib/server.js';
export default function handler(req, res) {
  res.setHeader('Set-Cookie', cookie('skm_s', '', 0));
  json(res, 200, { ok: true });
}
