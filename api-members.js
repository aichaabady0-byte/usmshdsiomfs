const { Client, GatewayIntentBits } = require('discord.js');

// Initialisation du client Discord en dehors du handler pour réutilisation (Performance)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

let isReady = false;
client.once('ready', () => { isReady = true; });
client.login(process.env.DISCORD_TOKEN).catch(err => console.error("Discord Login Error:", err));

module.exports = async (req, res) => {
    // Configuration des headers CORS obligatoires
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (!isReady) {
            // Attendre un court instant si le client n'est pas encore prêt
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        const guildId = process.env.GUILD_ID;
        const guild = await client.guilds.fetch(guildId);
        
        if (!guild) {
            return res.status(500).json({ error: "Guild not found. Check GUILD_ID env variable." });
        }

        // Récupérer tous les membres et forcer la mise à jour du cache des présences
        const members = await guild.members.fetch({ withPresences: true });
        
        const memberList = members.map(m => {
            // Récupérer les rôles triés par importance (hors @everyone)
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
                roles: roles
            };
        });

        return res.status(200).json({
            serverName: guild.name,
            memberCount: guild.memberCount,
            members: memberList
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Failed to fetch Discord members", details: error.message });
    }
};
