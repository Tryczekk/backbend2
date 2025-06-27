require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const UserToken = require('./models/UserToken');
const UserData = require('./models/UserData');

const app = express();
app.use(express.json());
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'));

// Middleware: autoryzacja przez token
async function tokenAuthMiddleware(req, res, next) {
    let token = req.headers['authorization'] || req.body.token || req.query.token;
    if (token && token.startsWith('Bearer ')) token = token.slice(7);
    if (!token) return res.status(401).json({ error: 'Brak tokenu' });
    const userToken = await UserToken.findOne({ token });
    if (!userToken) return res.status(403).json({ error: 'Nieprawidłowy token' });
    req.userToken = userToken;
    next();
}

// Endpoint: zapisz nowy token
app.post('/api/token', async (req, res) => {
    const { token, uses } = req.body;
    if (!token || !uses) return res.status(400).json({ error: 'Brak tokenu lub liczby użyć' });
    const existing = await UserToken.findOne({ token });
    if (existing) return res.status(409).json({ error: 'Token już istnieje' });
    const userToken = new UserToken({ token, uses });
    await userToken.save();
    res.json({ success: true });
});

// Endpoint: walidacja tokenu
app.post('/api/validate', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.json({ valid: false });
    const userToken = await UserToken.findOne({ token });
    res.json({ valid: !!userToken });
});

// Endpoint: pobierz dane użytkownika
app.get('/api/data', tokenAuthMiddleware, async (req, res) => {
    const data = await UserData.findOne({ token: req.userToken.token });
    res.json({ data: data ? data.data : null });
});

// Endpoint: zapisz dane użytkownika
app.post('/api/data', tokenAuthMiddleware, async (req, res) => {
    const { data } = req.body;
    let userData = await UserData.findOne({ token: req.userToken.token });
    if (!userData) {
        userData = new UserData({ token: req.userToken.token, data });
    } else {
        userData.data = data;
    }
    await userData.save();
    res.json({ message: 'Dane zapisane' });
});

// Endpoint: usuń dane użytkownika
app.delete('/api/data/delete', tokenAuthMiddleware, async (req, res) => {
    await UserData.deleteOne({ token: req.userToken.token });
    res.json({ message: 'Dane usunięte' });
});

// Endpoint: pobierz dane użytkownika po tokenie (np. dla card.html)
app.get('/api/card', async (req, res) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Brak tokenu' });
    const userData = await UserData.findOne({ token });
    if (!userData) return res.status(404).json({ error: 'Nie znaleziono danych' });
    res.json({ data: userData.data });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log('Server running on port', PORT));
