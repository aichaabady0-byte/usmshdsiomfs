const { Client, GatewayIntentBits } = require('discord.js');

module.exports = async (req, res) => {
    // Configuration CORS indispensable pour Vercel
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
    const GUILD_ID = process.env.DISCORD_GUILD_ID;

    if (!BOT_TOKEN || !GUILD_ID) {
        return res.status(500).json({ error: "Variables DISCORD_BOT_TOKEN ou DISCORD_GUILD_ID manquantes dans Vercel." });
    }

    // On initialise le client proprement pour une exécution Serverless rapide
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildPresences
        ]
    });

    // Sécurité pour éviter que la fonction Vercel tourne à l'infini en cas de bug
    const timeout = setTimeout(() => {
        client.destroy();
        return res.status(504).json({ error: "Discord a mis trop de temps à répondre." });
    }, 8000);

    try {
        // On attend que le bot se connecte à Discord
        await new Promise((resolve, reject) => {
            client.once('ready', resolve);
            client.once('error', reject);
            client.login(BOT_TOKEN).catch(reject);
        });

        // Récupération du serveur
        const guild = await client.guilds.fetch(GUILD_ID);
        if (!guild) {
            throw new Error("Serveur Discord introuvable. Vérifie l'ID.");
        }

        // Récupération des membres avec leurs statuts
        const membersFetch = await guild.members.fetch({ withPresences: true });
        
        // Formatage des données pour ton interface USMSCord
        const membersList = membersFetch.map(m => {
            const roles = m.roles.cache
                .filter(r => r.name !== '@everyone')
                .map(r => ({
                    name: r.name,
                    color: r.hexColor
                }));

            return {
                id: m.id,
                nickname: m.displayName || m.user.username,
                username: m.user.username,
                avatar: m.user.displayAvatarURL({ extension: 'png', size: 128 }),
                status: m.presence ? m.presence.status : 'offline',
                roles: roles
            };
        });

        // On nettoie et on coupe la connexion proprement
        clearTimeout(timeout);
        client.destroy();
        
        // On renvoie la liste au site
        return res.status(200).json(membersList);

    } catch (error) {
        console.error("Erreur détaillée du bot :", error);
        clearTimeout(timeout);
        try { client.destroy(); } catch(e) {}
        return res.status(500).json({ error: "Erreur interne", details: error.message });
    }
};
