const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
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

// --- DANE UŻYTKOWNIKA (dokument) ---
const USERDATA_FILE = path.join(__dirname, 'userdata.json');
function readUserData() {
  if (!fs.existsSync(USERDATA_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(USERDATA_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}
function writeUserData(data) {
  fs.writeFileSync(USERDATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Zapisz dane dokumentu pod tokenem
app.post('/api/userdata', (req, res) => {
  const { token, data } = req.body;
  if (!token || !data) return res.status(400).json({ error: 'Token and data required' });
  let all = readUserData();
  all[token] = data;
  writeUserData(all);
  res.json({ success: true });
});
// Pobierz dane dokumentu po tokenie
app.get('/api/userdata/:token', (req, res) => {
  const token = req.params.token;
  let all = readUserData();
  if (!all[token]) return res.status(404).json({ error: 'Not found' });
  res.json(all[token]);
});

// Add new token
app.post('/api/token', (req, res) => {
  const { token, uses = 1, username = '' } = req.body;
  if (!token) return res.status(400).json({ error: 'Token required' });
  let tokens = readTokens();
  if (tokens.find(t => t.token === token)) {
    return res.status(409).json({ error: 'Token already exists' });
  }
  tokens.push({ token, uses, username });
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

// Get all tokens (for admin panel)
app.get('/api/tokens', (req, res) => {
  const tokens = readTokens();
  res.json(tokens);
});

// Usuń token
app.delete('/api/token/:token', (req, res) => {
  let tokens = readTokens();
  const tokenVal = req.params.token;
  const idx = tokens.findIndex(t => t.token === tokenVal);
  if (idx === -1) return res.status(404).json({ error: 'Token not found' });
  tokens.splice(idx, 1);
  writeTokens(tokens);
  res.json({ success: true });
});

// Reaktywuj token (ustaw uses na 1)
app.patch('/api/token/:token/reactivate', (req, res) => {
  let tokens = readTokens();
  const tokenVal = req.params.token;
  const idx = tokens.findIndex(t => t.token === tokenVal);
  if (idx === -1) return res.status(404).json({ error: 'Token not found' });
  tokens[idx].uses = 1;
  writeTokens(tokens);
  res.json({ success: true });
});

// Wyłącz token (ustaw uses na 0)
app.patch('/api/token/:token/disable', (req, res) => {
  let tokens = readTokens();
  const tokenVal = req.params.token;
  const idx = tokens.findIndex(t => t.token === tokenVal);
  if (idx === -1) return res.status(404).json({ error: 'Token not found' });
  tokens[idx].uses = 0;
  writeTokens(tokens);
  res.json({ success: true });
});

// Resetuj uses tokenu
app.patch('/api/token/:token/reset', (req, res) => {
  let tokens = readTokens();
  const tokenVal = req.params.token;
  const { uses } = req.body;
  const idx = tokens.findIndex(t => t.token === tokenVal);
  if (idx === -1) return res.status(404).json({ error: 'Token not found' });
  tokens[idx].uses = Number(uses);
  writeTokens(tokens);
  res.json({ success: true });
});

// Generowanie pliku card.html z danymi użytkownika
app.post('/api/generate-card', (req, res) => {
  const { token, data } = req.body;
  if (!token || !data) return res.status(400).json({ error: 'Token and data required' });

  // Przygotuj folder get/unikalny_id
  const getDir = path.join(__dirname, 'get', token);
  if (!fs.existsSync(getDir)) {
    fs.mkdirSync(getDir, { recursive: true });
  }

  // Szablon HTML (uproszczony, można rozbudować)
  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <title>mObywatel - Twój dowód</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="/assets/main.css">
    <link rel="stylesheet" href="/opcjecard/card.css">
</head>
<body>
    <h1>mDowód</h1>
    <p><b>Imię:</b> ${data.name || ''}</p>
    <p><b>Nazwisko:</b> ${data.surname || ''}</p>
    <p><b>Obywatelstwo:</b> ${data.nationality || ''}</p>
    <p><b>Data urodzenia:</b> ${data.birthday || ''}</p>
    <p><b>PESEL:</b> ${data.pesel || ''}</p>
    <p><b>Seria i numer:</b> ${data.seriesAndNumber || ''}</p>
    <p><b>Termin ważności:</b> ${data.expiryDate || ''}</p>
    <p><b>Data wydania:</b> ${data.givenDate || ''}</p>
    <p><b>Imię ojca:</b> ${data.fathersName || ''}</p>
    <p><b>Imię matki:</b> ${data.mothersName || ''}</p>
    <p><b>Nazwisko rodowe:</b> ${data.familyName || ''}</p>
    <p><b>Płeć:</b> ${data.sex || ''}</p>
    <p><b>Miejsce urodzenia:</b> ${data.birthPlace || ''}</p>
    <p><b>Kraj urodzenia:</b> ${data.countryOfBirth || ''}</p>
    <p><b>Adres:</b> ${data.address1 || ''} ${data.address2 || ''}</p>
    <p><b>Miasto:</b> ${data.city || ''}</p>
    <p><b>Data zameldowania:</b> ${data.homeDate || ''}</p>
    <p><b>Ostatnia aktualizacja:</b> ${data.update || ''}</p>
</body>
</html>`;

  // Zapisz plik card.html
  const filePath = path.join(getDir, 'card.html');
  fs.writeFileSync(filePath, html, 'utf8');

  // Zwróć link do pobrania
  const fileUrl = `/get/${token}/card.html`;
  res.json({ success: true, url: fileUrl });
});

// Serve static files (frontend)
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Token server running on http://localhost:${PORT}`);
});
