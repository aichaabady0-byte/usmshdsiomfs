const { Client, GatewayIntentBits } = require('discord.js');

module.exports = async (req, res) => {
    // Gestion des headers CORS pour éviter les blocages de requêtes
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Vérification de sécurité des variables d'environnement configurées sur image_71b668.png
    if (!process.env.DISCORD_BOT_TOKEN || !process.env.DISCORD_GUILD_ID) {
        return res.status(500).json({ 
            error: "Missing Environment Variables", 
            details: "Please double check DISCORD_BOT_TOKEN and DISCORD_GUILD_ID in Vercel."
        });
    }

    // Création d'une nouvelle instance à chaque appel (Recommandé pour le Serverless Vercel)
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildPresences
        ]
    });

    try {
        // On crée une promesse qui attend que le bot se connecte et soit opérationnel
        await new Promise((resolve, reject) => {
            client.once('ready', () => resolve());
            client.login(process.env.DISCORD_BOT_TOKEN).catch(reject);
            
            // Timeout de sécurité si Discord met trop de temps à répondre (5 secondes)
            setTimeout(() => reject(new Error('Discord connection timeout')), 5000);
        });

        // Récupération du serveur (Guild)
        const guildId = process.env.DISCORD_GUILD_ID;
        const guild = await client.guilds.fetch(guildId);
        
        if (!guild) {
            client.destroy();
            return res.status(404).json({ error: "Guild not found. Verify your DISCORD_GUILD_ID." });
        }

        // Récupération des membres et de leurs statuts de présence
        const members = await guild.members.fetch({ withPresences: true });
        
        const memberList = members.map(m => {
            const roles = m.roles.cache
                .filter(r => r.name !== '@everyone')
                .sort((a, b) => b.position - a.position)
                .map(r => ({ name: r.name, color: r.hexColor }));

            return {
                id: m.id,
                username: m.user.username,
                nickname: m.displayName,
                avatar: m.user.displayAvatarURL({ extension: 'png', size: 128 }),
                status: m.presence ? m.presence.status : "offline",
                roles: roles,
                joinedAt: m.joinedAt
            };
        });

        // Fermeture propre de la connexion Discord avant de répondre
        client.destroy();

        return res.status(200).json({
            serverName: guild.name,
            memberCount: guild.memberCount,
            members: memberList
        });

    } catch (error) {
        // En cas de crash, on déconnecte le client pour éviter les fuites de mémoire
        try { client.destroy(); } catch(e) {}
        
        console.error("Backend Error:", error);
        return res.status(500).json({ 
            error: "Failed to fetch Discord members", 
            details: error.message 
        });
    }
};
