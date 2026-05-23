const { Client, GatewayIntentBits } = require('discord.js');
const admin = require('firebase-admin');

// Initialisation de Firebase Admin dans ton API Vercel
if (!admin.apps.length) {
    admin.initializeApp({
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });
}
const db = admin.database();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages
    ]
});

let isReady = false;
client.login(process.env.DISCORD_TOKEN);
client.once('ready', () => { isReady = true; });

module.exports = async (req, res) => {
    if (!isReady) return res.status(503).json({ error: "Bot starting up..." });
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    // --- SI L'UTILISATEUR ENVOIE UN MESSAGE DEPUIS LE SITE ---
    if (req.method === 'POST') {
        const { action, channelId, content, username } = req.body;

        try {
            if (action === 'sendMessage') {
                // 1. On envoie sur le vrai Discord
                const channel = await client.channels.fetch(channelId);
                await channel.send(`[WEB USER] ${username}: ${content}`);

                // 2. On double-sauvegarde dans la Firebase Database depuis l'API
                const msgRef = db.ref(`messages/${channelId}`).push();
                await msgRef.set({
                    author: username,
                    text: content,
                    timestamp: Date.now()
                });

                return res.json({ success: true });
            }
            
            // ... (reste des actions de modération kick/ban)
        } catch (err) {
            return res.status(500).json({ error: "API Action failed", details: err.message });
        }
    }

    // --- LE RESTE DU CODE GET (MEMBRES ET SALONS) ---
    // ...
};
