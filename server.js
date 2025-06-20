const express = require('express');
const fs = require('fs');
const cors = require('cors');
const app = express();
const PORT = 3000;
const TOKENS_FILE = 'tokens.json';

app.use(cors());
app.use(express.json());

// Helper: read tokens from file
function readTokens() {
  if (!fs.existsSync(TOKENS_FILE)) return [];
  return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
}

// Helper: write tokens to file
function writeTokens(tokens) {
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}

// POST /api/token - save new token with data
app.post('/api/token', (req, res) => {
  const { token, uses, username, data } = req.body;
  // Token: 3-4 znaki, tylko litery/cyfry
  if (!token || !/^[A-Za-z0-9]{3,4}$/.test(token)) {
    return res.status(400).json({ success: false, error: 'Token musi mieć 3-4 znaki (litery lub cyfry).' });
  }
  if (!uses || !username) {
    return res.status(400).json({ success: false, error: 'Brak wymaganych danych.' });
  }
  let tokens = readTokens();
  if (tokens.find(t => t.token === token)) {
    return res.status(400).json({ success: false, error: 'Token już istnieje.' });
  }
  tokens.push({ token, uses, username, data: data || {} });
  writeTokens(tokens);
  res.json({ success: true });
});

// GET /api/tokens - list all tokens with usernames
app.get('/api/tokens', (req, res) => {
  const tokens = readTokens();
  res.json(tokens.map(t => ({ token: t.token, username: t.username, uses: t.uses })));
});

// POST /api/validate - validate token
app.post('/api/validate', (req, res) => {
  const { token } = req.body;
  let tokens = readTokens();
  let t = tokens.find(t => t.token === token);
  if (!t || t.uses < 1) {
    return res.json({ valid: false });
  }
  res.json({ valid: true });
});

// GET /api/card?token=... - get data for token and decrease uses
app.get('/api/card', (req, res) => {
  const { token } = req.query;
  let tokens = readTokens();
  let idx = tokens.findIndex(t => t.token === token);
  if (idx === -1 || tokens[idx].uses < 1) {
    return res.status(404).json({ error: 'Nieprawidłowy lub zużyty token.' });
  }
  const data = tokens[idx].data || {};
  tokens[idx].uses -= 1;
  writeTokens(tokens);
  res.json({ username: tokens[idx].username, data });
});

app.listen(PORT, () => {
  console.log(`API działa na http://localhost:${PORT}`);
});
