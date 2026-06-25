// Vercel serverless function — keeps the Anthropic API key server-side.
// The frontend calls POST /api/claude with { userText, system } and never
// sees the key. This file runs in Vercel's Node.js runtime.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const { userText, system } = req.body || {};
    if (!userText) {
      res.status(400).json({ error: "Missing userText" });
      return;
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "Server is missing ANTHROPIC_API_KEY" });
      return;
    }

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 900,
        system,
        messages: [{ role: "user", content: userText }],
      }),
    });

    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
