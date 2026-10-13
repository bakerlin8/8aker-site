// GitHub sign-in for the editors has been retired (2026-10-13). Studio uses Google sign-in only.
import { errorPage } from './_session.js';
export default function handler(req, res) { errorPage(res, 410, 'GitHub 登入已停用，請改用 Google 登入。'); }
