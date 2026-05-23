const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const admin = require('firebase-admin');

// 1. INITIALISATION FIREBASE
try {
    if (!admin.apps.length) {
        if (!process.env.FIREBASE_DATABASE_URL) {
            throw new Error("Variable FIREBASE_DATABASE_URL manquante.");
        }
        admin.initializeApp({
            databaseURL: process.env.FIREBASE_DATABASE_URL
        });
    }
} catch (firebaseError) {
    console.error("Firebase Init Error:", firebaseError);
}

module.exports = async (req, res) => {
    // Vérification de sécurité Firebase
    if (!admin.apps.length) {
        return res.status(500).json({ error: "Firebase non initialisé." });
    }

    // 2. INSTANCIATION DU CLIENT DISCORD UNIQUE POUR CETTE REQUÊTE
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildPresences,
            GatewayIntentBits.GuildMessages
        ]
    });

    try {
        // Promisification de la connexion rapide
        await new Promise((resolve, reject) => {
            client.login(process.env.DISCORD_TOKEN).catch(reject);
            client.once('ready', resolve);
            // Sécurité : Si au bout de 6 secondes Discord ne répond pas, on lâche l'affaire
            setTimeout(() => reject(new Error("Discord timeout")), 6000);
        });

        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (!guild) {
            client.destroy();
            return res.status(404).json({ error: "Serveur Discord introuvable." });
        }

        const db = admin.database();

        // ==========================================
        // TRAITEMENT MÉTHODE POST (ENVOI DE MESSAGE)
        // ==========================================
        if (req.method === 'POST') {
            const { action, channelId, content, username, userId } = req.body;

            if (action === 'sendMessage') {
                const channel = await client.channels.fetch(channelId);
                if (channel && channel.type === ChannelType.GuildText) {
                    await channel.send(`[WEB USER] ${username}: ${content}`);
                }

                await db.ref(`messages/${channelId}`).push().set({
                    author: username,
                    text: content,
                    timestamp: Date.now(),
                    badges: username.toLowerCase() === "fufu" ? ["Admin"] : []
                });

                client.destroy(); // Toujours éteindre le client après usage
                return res.status(200).json({ success: true });
            }

            // Actions de modération rapides
            const member = userId ? await guild.members.fetch(userId).catch(() => null) : null;
            if (member) {
                if (action === 'kick') await member.kick("Via USMS Web");
                if (action === 'ban') await guild.members.ban(userId, { reason: "Via USMS Web" });
                if (action === 'timeout') await member.timeout(10 * 60 * 1000, "Via USMS Web");
                client.destroy();
                return res.status(200).json({ success: true });
            }
            
            client.destroy();
            return res.status(400).json({ error: "Action inconnue ou membre introuvable." });
        }

        // ==========================================
        // TRAITEMENT MÉTHODE GET (CHARGEMENT DU SITE)
        // ==========================================
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

        const dataMembers = membersList.map(m => ({
            id: m.id,
            username: m.user.username,
            nickname: m.displayName || m.user.username,
            avatar: m.user.displayAvatarURL({ extension: 'png', size: 128 }),
            status: m.presence?.status || 'offline',
            roles: m.roles.cache
                .filter(r => r.name !== '@everyone')
                .map(r => ({ name: r.name, color: r.hexColor }))
        }));

        // Envoi des données + config au front-end
        res.status(200).json({
            guildInfo: { name: guild.name, id: guild.id, rolesCount: guild.roles.cache.size },
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

    } catch (err) {
        console.error("Crash général de la fonction :", err);
        res.status(500).json({ error: "Erreur interne du serveur", details: err.message });
    } finally {
        // Sécurité absolue pour éviter les fuites de mémoire sur Vercel
        if (client) client.destroy();
    }
};
