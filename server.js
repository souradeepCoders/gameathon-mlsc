require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const path = require('path'); // <-- NEW: This forces Vercel to find your folders

const app = express();
app.use(express.json());

// --- NEW: Bulletproof Static File Serving for Vercel ---
app.use(express.static(path.join(__dirname, 'public')));

// Explicitly send the index.html file when someone opens the site
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI);

// --- SCHEMAS ---
const playerSchema = new mongoose.Schema({
    name: String, email: String, phone: String, role: String, points: { type: Number, default: 0 }
});

const teamSchema = new mongoose.Schema({
    teamId: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    players: [playerSchema],
    score: { type: Number, default: 0 } 
});

const matchSchema = new mongoose.Schema({
    gameName: String, teamA: String, teamB: String
});

const Team = mongoose.model('Team', teamSchema);
const Match = mongoose.model('Match', matchSchema);

// --- ROUTES ---
app.post('/login', async (req, res) => {
    try {
        const { teamId, password } = req.body;
        if (teamId === 'admin' && password === process.env.ADMIN_PASSWORD) {
            return res.json({ success: true, role: 'admin' });
        }
        const team = await Team.findOne({ teamId });
        if (!team || !(await bcrypt.compare(password, team.password))) {
            return res.status(401).json({ error: "Invalid ID or Password." });
        }
        res.json({ success: true, role: 'player', teamData: team });
    } catch (error) { res.status(500).json({ error: "Internal Server Error." }); }
});

app.post('/register', async (req, res) => {
    try {
        const { teamId, password, p1, p2, p3 } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const playersData = [
            { name: p1.name, email: p1.email, phone: p1.phone, role: 'Leader', points: 0 },
            { name: p2.name, email: p2.email, phone: p2.phone, role: 'Member', points: 0 },
            { name: p3.name, email: p3.email, phone: p3.phone, role: 'Member', points: 0 }
        ];
        const newTeam = new Team({ teamId, password: hashedPassword, players: playersData });
        await newTeam.save();
        res.status(201).json({ message: "Team registered successfully!" });
    } catch (error) { res.status(400).json({ error: "Registration failed. Team ID might already exist." }); }
});

app.get('/teams', async (req, res) => {
    try {
        const teams = await Team.find({}, 'teamId players score').sort({ score: -1 });
        res.json(teams);
    } catch (error) { res.status(500).json({ error: "Failed to fetch teams." }); }
});

app.post('/update-score', async (req, res) => {
    try {
        const { teamId, playerIndex, scoreToAdd } = req.body;
        const team = await Team.findOne({ teamId });
        if (!team) return res.status(404).json({ error: "Team not found." });
        team.players[playerIndex].points += scoreToAdd;
        team.score += scoreToAdd;
        await team.save();
        res.json({ message: "Points awarded successfully!" });
    } catch (error) { res.status(500).json({ error: "Failed to update score." }); }
});

app.post('/start-match', async (req, res) => {
    try {
        const newMatch = new Match(req.body);
        await newMatch.save();
        res.json({ message: "Match started!" });
    } catch (error) { res.status(500).json({ error: "Failed to start match." }); }
});

app.get('/active-matches', async (req, res) => {
    try {
        const matches = await Match.find({});
        res.json(matches);
    } catch (error) { res.status(500).json({ error: "Failed to fetch matches." }); }
});

app.post('/end-match', async (req, res) => {
    try {
        await Match.findByIdAndDelete(req.body.matchId);
        res.json({ message: "Match ended!" });
    } catch (error) { res.status(500).json({ error: "Failed to end match." }); }
});

// --- VERCEL EXPORT ---
module.exports = app;

// Keep local hosting working for your laptop testing
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}