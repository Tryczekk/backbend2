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
  // Zawsze zapisuj username (jeśli przesłany)
  tokens.push({ token, uses, username: username || '' });
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
    <div style="margin-bottom:20px;">
      <img src="${data.image || ''}" alt="Zdjęcie" style="max-width:160px;max-height:200px;border-radius:10px;box-shadow:0 2px 12px #0006;" />
    </div>
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

// --- GENERATOR DANYCH OSOBOWYCH ---
function generatePersonalData(imie, nazwisko, plec, dataUrodzenia) {
  // dataUrodzenia: 'dd.mm.rrrr'
  const [day, month, year] = dataUrodzenia.split('.').map(Number);

  // PESEL: YYMMDD + 4 cyfry + cyfra kontrolna
  let peselYear = year % 100;
  let peselMonth = month;
  if (year >= 2000 && year < 2100) peselMonth += 20;
  // YYMMDD
  const peselBase = [
    peselYear.toString().padStart(2, '0'),
    peselMonth.toString().padStart(2, '0'),
    day.toString().padStart(2, '0')
  ].join('');

  // 4 losowe cyfry: ostatnia nieparzysta (M) lub parzysta (K)
  let random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  let sexDigit;
  if (plec === 'M') {
    sexDigit = (2 * Math.floor(Math.random() * 5) + 1).toString(); // 1,3,5,7,9
  } else {
    sexDigit = (2 * Math.floor(Math.random() * 5)).toString(); // 0,2,4,6,8
  }
  const peselWithoutChecksum = peselBase + random + sexDigit;

  // Cyfra kontrolna
  const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(peselWithoutChecksum[i], 10) * weights[i];
  }
  const checksum = (10 - (sum % 10)) % 10;
  const pesel = peselWithoutChecksum + checksum;

  // Data wydania dowodu
  const wydanieDayAdd = Math.random() < 0.5 ? 4 : 8;
  let wydanieDay = day + wydanieDayAdd;
  const wydanieMonth = month;
  const wydanieYear = year;
  // Sprawdź ostatni dzień miesiąca
  const lastDay = new Date(wydanieYear, wydanieMonth, 0).getDate();
  if (wydanieDay > lastDay) wydanieDay = lastDay;
  const dataWydania = [
    wydanieDay.toString().padStart(2, '0'),
    wydanieMonth.toString().padStart(2, '0'),
    wydanieYear
  ].join('.');

  // Data ważności dowodu
  const dataWaznosci = [
    wydanieDay.toString().padStart(2, '0'),
    wydanieMonth.toString().padStart(2, '0'),
    (wydanieYear + 10)
  ].join('.');

  return {
    imie,
    nazwisko,
    plec,
    dataUrodzenia,
    pesel,
    dataWydania,
    dataWaznosci
  };
}

function parsePESEL(pesel) {
  if (!/^[0-9]{11}$/.test(pesel)) throw new Error('Nieprawidłowy PESEL');
  let year = parseInt(pesel.slice(0, 2), 10);
  let month = parseInt(pesel.slice(2, 4), 10);
  let day = parseInt(pesel.slice(4, 6), 10);

  let century = 1900;
  if (month > 80) { century = 1800; month -= 80; }
  else if (month > 60) { century = 2200; month -= 60; }
  else if (month > 40) { century = 2100; month -= 40; }
  else if (month > 20) { century = 2000; month -= 20; }

  year = century + year;
  const dataUrodzenia = [
    day.toString().padStart(2, '0'),
    month.toString().padStart(2, '0'),
    year
  ].join('.');

  const sex = (parseInt(pesel[9], 10) % 2 === 1) ? 'M' : 'K';

  return {
    dataUrodzenia,
    plec: sex
  };
}
