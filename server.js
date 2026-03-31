require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());
app.use(express.static('public')); // Back to normal static serving

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI);

// --- NEW SCHEMAS (Individual Logins) ---
const playerSchema = new mongoose.Schema({
    playerId: { type: String, required: true }, 
    password: { type: String, required: true }, 
    name: String, email: String, phone: String, role: String, points: { type: Number, default: 0 }
});

const teamSchema = new mongoose.Schema({
    teamId: { type: String, required: true, unique: true },
    players: [playerSchema],
    score: { type: Number, default: 0 } 
});

const matchSchema = new mongoose.Schema({ gameName: String, teamA: String, teamB: String });

const Team = mongoose.model('Team', teamSchema);
const Match = mongoose.model('Match', matchSchema);

// Auto-Generators
const generatePassword = () => Math.random().toString(36).slice(-6).toUpperCase();
const generatePlayerId = (teamId, playerNum) => `${teamId}-P${playerNum}`;

// --- ROUTES ---
app.post('/login', async (req, res) => {
    try {
        const { loginId, password } = req.body;
        
        if (loginId === 'admin' && password === process.env.ADMIN_PASSWORD) {
            return res.json({ success: true, role: 'admin' });
        }
        
        const team = await Team.findOne({ "players.playerId": loginId });
        if (!team) return res.status(401).json({ error: "Invalid ID or Password." });
        
        const player = team.players.find(p => p.playerId === loginId);
        if (!player || !(await bcrypt.compare(password, player.password))) {
            return res.status(401).json({ error: "Invalid ID or Password." });
        }
        
        res.json({ success: true, role: 'player', teamData: team, currentPlayer: player });
    } catch (error) { res.status(500).json({ error: "Internal Server Error." }); }
});

app.post('/register', async (req, res) => {
    try {
        const { teamId, p1, p2, p3 } = req.body;
        
        const rawPass1 = generatePassword(); const rawPass2 = generatePassword(); const rawPass3 = generatePassword();
        const id1 = generatePlayerId(teamId, 1); const id2 = generatePlayerId(teamId, 2); const id3 = generatePlayerId(teamId, 3);

        const playersData = [
            { playerId: id1, password: await bcrypt.hash(rawPass1, 10), name: p1.name, email: p1.email, phone: p1.phone, role: 'Leader', points: 0 },
            { playerId: id2, password: await bcrypt.hash(rawPass2, 10), name: p2.name, email: p2.email, phone: p2.phone, role: 'Member', points: 0 },
            { playerId: id3, password: await bcrypt.hash(rawPass3, 10), name: p3.name, email: p3.email, phone: p3.phone, role: 'Member', points: 0 }
        ];

        const newTeam = new Team({ teamId, players: playersData });
        await newTeam.save();
        
        res.status(201).json({ 
            message: "Team registered successfully!",
            credentials: [
                { name: p1.name, id: id1, pass: rawPass1 },
                { name: p2.name, id: id2, pass: rawPass2 },
                { name: p3.name, id: id3, pass: rawPass3 }
            ]
        });
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

// Standard Server Boot
const PORT = process.env.PORT || 3000;
// Add '0.0.0.0' so Replit allows mobile phones to connect
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
