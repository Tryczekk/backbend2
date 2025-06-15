const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());

const TOKENS_FILE = path.join(__dirname, 'tokens.json');

// Helper: read tokens from file
function readTokens() {
  if (!fs.existsSync(TOKENS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

// Helper: write tokens to file
function writeTokens(tokens) {
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf8');
}

// Add new token
app.post('/api/token', (req, res) => {
  const { token, uses = 1 } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });
  let tokens = readTokens();
  if (tokens.find(t => t.token === token)) {
    return res.status(409).json({ error: 'Token already exists' });
  }
  tokens.push({ token, uses });
  writeTokens(tokens);
  res.json({ success: true });
});

// Validate token
app.post('/api/validate', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });
  let tokens = readTokens();
  const found = tokens.find(t => t.token === token && t.uses > 0);
  if (found) {
    res.json({ valid: true, uses: found.uses });
  } else {
    res.json({ valid: false });
  }
});

// Use token (decrement uses)
app.post('/api/use', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });
  let tokens = readTokens();
  const idx = tokens.findIndex(t => t.token === token && t.uses > 0);
  if (idx === -1) return res.json({ success: false, error: 'Invalid or used up token' });
  tokens[idx].uses -= 1;
  writeTokens(tokens);
  res.json({ success: true, uses: tokens[idx].uses });
});

// Serve static files (frontend)
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Token server running on http://localhost:${PORT}`);
});
