const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const admin = require('firebase-admin');

// 1. INITIALISATION SÉCURISÉE DE FIREBASE EN MODE SERVERLESS
try {
    if (!admin.apps.length) {
        if (!process.env.FIREBASE_DATABASE_URL) {
            throw new Error("La variable d'environnement FIREBASE_DATABASE_URL est manquante !");
        }
        admin.initializeApp({
            databaseURL: process.env.FIREBASE_DATABASE_URL
        });
    }
} catch (firebaseError) {
    console.error("Firebase Initialization Crash:", firebaseError);
}

// 2. CONFIGURATION DU BOT DISCORD
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages
    ]
});

let isReady = false;
let connectingPromise = null;

function connectDiscord() {
    if (isReady) return Promise.resolve();
    if (connectingPromise) return connectingPromise;

    connectingPromise = client.login(process.env.DISCORD_TOKEN)
        .then(() => {
            return new Promise((resolve) => {
                if (client.readyAt) {
                    isReady = true;
                    resolve();
                } else {
                    client.once('ready', () => {
                        isReady = true;
                        resolve();
                    });
                }
            });
        })
        .catch(err => {
            connectingPromise = null;
            console.error("Discord Login failed:", err);
            throw err;
        });

    return connectingPromise;
}

// Déclenchement de la connexion au chargement du fichier
connectDiscord();

// 3. HANDLER PRINCIPAL DE L'API VERCEL
module.exports = async (req, res) => {
    // Si l'initialisation Firebase a échoué en amont
    if (!admin.apps.length) {
        return res.status(500).json({ 
            error: "Firebase config error", 
            details: "FIREBASE_DATABASE_URL n'est pas configuré ou est invalide sur Vercel." 
        });
    }

    // EN SERVERLESS : On attend activement que le bot soit connecté avant de continuer
    try {
        await connectDiscord();
    } catch (authError) {
        return res.status(500).json({ error: "Discord authentication failed", details: authError.message });
    }

    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) {
        return res.status(404).json({ 
            error: "Guild Discord introuvable", 
            details: "Le GUILD_ID fourni ne correspond à aucun serveur accessible par le bot." 
        });
    }

    const db = admin.database();

    // ==========================================
    // TRAITEMENT DES ACTIONS (METHODE POST)
    // ==========================================
    if (req.method === 'POST') {
        const { action, channelId, content, username, userId } = req.body;

        try {
            if (action === 'sendMessage') {
                if (!channelId || !content || !username) {
                    return res.status(400).json({ error: "Missing parameters for sendMessage." });
                }

                const channel = await client.channels.fetch(channelId);
                if (!channel || channel.type !== ChannelType.GuildText) {
                    return res.status(400).json({ error: "Target channel is not a text channel." });
                }
                await channel.send(`[WEB USER] ${username}: ${content}`);

                const msgRef = db.ref(`messages/${channelId}`).push();
                const badges = username.toLowerCase() === "fufu" ? ["Admin"] : [];

                await msgRef.set({
                    author: username,
                    text: content,
                    timestamp: Date.now(),
                    badges: badges
                });

                return res.status(200).json({ success: true });
            }

            if (action === 'kick') {
                if (!userId) return res.status(400).json({ error: "Missing userId." });
                const member = await guild.members.fetch(userId);
                await member.kick("Expulsé via l'interface d'administration USMS");
                return res.status(200).json({ success: true });
            }

            if (action === 'ban') {
                if (!userId) return res.status(400).json({ error: "Missing userId." });
                await guild.members.ban(userId, { reason: "Banni via l'interface d'administration USMS" });
                return res.status(200).json({ success: true });
            }

            if (action === 'timeout') {
                if (!userId) return res.status(400).json({ error: "Missing userId." });
                const member = await guild.members.fetch(userId);
                await member.timeout(10 * 60 * 1000, "Mute 10 minutes via l'interface USMS");
                return res.status(200).json({ success: true });
            }

            return res.status(400).json({ error: "Unknown action." });

        } catch (err) {
            return res.status(500).json({ error: "Action execution failed", details: err.message });
        }
    }

    // ==========================================
    // LECTURE DES DONNÉES DU SERVEUR (METHODE GET)
    // ==========================================
    try {
        const membersList = await guild.members.fetch({ withPresences: true });
        const channelsList = await guild.channels.fetch();

        const dataChannels = channelsList
            .filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildCategory)
            .map(c => ({
                id: c.id,
                name: c.name,
                type: c.type === ChannelType.GuildText ? 0 : 4,
                parentId: c.parentId || null,
                position: c.position
            }));

        const dataMembers = membersList.map(m => {
            let status = 'offline';
            if (m.presence && m.presence.status) status = m.presence.status;

            return {
                id: m.id,
                username: m.user.username,
                nickname: m.displayName || m.user.username,
                avatar: m.user.displayAvatarURL({ extension: 'png', size: 128 }),
                status: status,
                roles: m.roles.cache
                    .filter(r => r.name !== '@everyone')
                    .map(r => ({ name: r.name, color: r.hexColor }))
            };
        });

        return res.status(200).json({
            guildInfo: {
                name: guild.name,
                id: guild.id,
                rolesCount: guild.roles.cache.size
            },
            channels: dataChannels,
            members: dataMembers,
            firebaseConfig: {
                apiKey: process.env.FIREBASE_API_KEY,
                authDomain: process.env.FIREBASE_AUTH_DOMAIN,
                databaseURL: process.env.FIREBASE_DATABASE_URL,
                projectId: process.env.FIREBASE_PROJECT_ID,
                storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
                messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
                appId: process.env.FIREBASE_APP_ID
            }
        });

    } catch (error) {
        return res.status(500).json({ error: "Failed to fetch Discord Guild data", details: error.message });
    }
};
