export default async function handler(req, res) {
  const { code } = req.query;
  const clientId = process.env.OAUTH_CLIENT_ID;
  const clientSecret = process.env.OAUTH_CLIENT_SECRET;

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      res.status(400).send(`OAuth error: ${tokenData.error_description || tokenData.error}`);
      return;
    }

    // Hand the token to the studio page via the URL fragment (never sent to the server on the next request).
    res.writeHead(302, { Location: `/studio/#gh_token=${tokenData.access_token}` });
    res.end();
  } catch (err) {
    res.status(500).send('OAuth callback failed: ' + err.message);
  }
}
