const { Client, GatewayIntentBits, ChannelType } = require('discord.js');
const admin = require('firebase-admin');

// 1. INITIALISATION UNIQUE DE FIREBASE EN MODE SERVERLESS
if (!admin.apps.length) {
    admin.initializeApp({
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });
}
const db = admin.database();

// 2. CONFIGURATION DU BOT DISCORD
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages
    ]
});

// Connexion automatique globale du bot
let isReady = false;
client.login(process.env.DISCORD_TOKEN);
client.once('ready', () => { 
    isReady = true; 
    console.log(`Bot Connecté sous le pseudo: ${client.user.tag}`);
});

// 3. HANDLER PRINCIPAL DE L'API VERCEL
module.exports = async (req, res) => {
    // Sécurité si le bot n'a pas fini son cycle de boot
    if (!isReady) {
        return res.status(503).json({ error: "Bot is starting up on Vercel, please refresh." });
    }

    // Récupération de la Guild via la variable d'environnement
    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) {
        return res.status(404).json({ error: "Guild / Server Discord introuvable. Vérifie ton GUILD_ID." });
    }

    // ==========================================
    // TRAITEMENT DES ACTIONS (METHODE POST)
    // ==========================================
    if (req.method === 'POST') {
        const { action, channelId, content, username, userId } = req.body;

        try {
            // ACTION A : Envoi de message (Relais Web -> Discord + Écriture Firebase)
            if (action === 'sendMessage') {
                if (!channelId || !content || !username) {
                    return res.status(400).json({ error: "Missing parameters for sendMessage." });
                }

                // 1. Envoi réel sur le salon Discord
                const channel = await client.channels.fetch(channelId);
                if (!channel || channel.type !== ChannelType.GuildText) {
                    return res.status(400).json({ error: "Target channel is not a text channel." });
                }
                await channel.send(`[WEB USER] ${username}: ${content}`);

                // 2. Double sauvegarde Firebase pour garder un historique instantané côté Web
                const msgRef = db.ref(`messages/${channelId}`).push();
                
                // Attribution du badge Admin de sécurité automatique si le pseudo est "Fufu"
                const badges = username.toLowerCase() === "fufu" ? ["Admin"] : [];

                await msgRef.set({
                    author: username,
                    text: content,
                    timestamp: Date.now(),
                    badges: badges
                });

                return res.status(200).json({ success: true });
            }

            // ACTION B : Modération - Expulser (Kick)
            if (action === 'kick') {
                if (!userId) return res.status(400).json({ error: "Missing userId." });
                const member = await guild.members.fetch(userId);
                await member.kick("Expulsé via l'interface d'administration USMS");
                return res.status(200).json({ success: true, message: "User kicked." });
            }

            // ACTION C : Modération - Bannir (Ban)
            if (action === 'ban') {
                if (!userId) return res.status(400).json({ error: "Missing userId." });
                await guild.members.ban(userId, { reason: "Banni via l'interface d'administration USMS" });
                return res.status(200).json({ success: true, message: "User banned." });
            }

            // ACTION D : Modération - Exclure Temporairement (Timeout / Mute)
            if (action === 'timeout') {
                if (!userId) return res.status(400).json({ error: "Missing userId." });
                const member = await guild.members.fetch(userId);
                // Exclusion temporaire fixée à 10 minutes (600 000 ms)
                await member.timeout(10 * 60 * 1000, "Mute 10 minutes via l'interface USMS");
                return res.status(200).json({ success: true, message: "User muted for 10m." });
            }

            return res.status(400).json({ error: "Unknown action requested." });

        } catch (err) {
            console.error("Error executing POST action:", err);
            return res.status(500).json({ error: "Discord API action failed", details: err.message });
        }
    }

    // ==========================================
    // LECTURE DES DONNÉES DU SERVEUR (METHODE GET)
    // ==========================================
    try {
        // Forcer la mise à jour du cache des membres et présences Discord
        const membersList = await guild.members.fetch({ withPresences: true });
        const channelsList = await guild.channels.fetch();

        // 1. Filtrer et formater les salons textuels (type 0) et les catégories (type 4)
        const dataChannels = channelsList
            .filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildCategory)
            .map(c => ({
                id: c.id,
                name: c.name,
                type: c.type === ChannelType.GuildText ? 0 : 4, // 0 pour Text, 4 pour Catégorie dans notre script.js
                parentId: c.parentId || null,
                position: c.position
            }));

        // 2. Filtrer et formater la liste des membres
        const dataMembers = membersList.map(m => {
            // Détermination du statut (online, idle, dnd, offline)
            let status = 'offline';
            if (m.presence && m.presence.status) {
                status = m.presence.status;
            }

            return {
                id: m.id,
                username: m.user.username,
                nickname: m.displayName || m.user.username,
                avatar: m.user.displayAvatarURL({ extension: 'png', size: 128 }),
                status: status,
                // On retire le rôle global @everyone pour la propreté de l'affichage
                roles: m.roles.cache
                    .filter(r => r.name !== '@everyone')
                    .map(r => ({
                        name: r.name,
                        color: r.hexColor
                    }))
            };
        });

        // 3. Envoi du package de données complet au format JSON
        return res.status(200).json({
            guildInfo: {
                name: guild.name,
                id: guild.id,
                rolesCount: guild.roles.cache.size
            },
            channels: dataChannels,
            members: dataMembers
        });

    } catch (error) {
        console.error("Error during GET execution:", error);
        return res.status(500).json({ error: "Failed to fetch data from Discord Guild", details: error.message });
    }
};
