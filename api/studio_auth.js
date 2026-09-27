import { startAuth } from './_lib.js';
export default function handler(req, res) { startAuth(res, '/api/studio_callback'); }
