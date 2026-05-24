const { Client, GatewayIntentBits } = require('discord.js');

// Initialisation avec les bons intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

let isReady = false;
client.once('ready', () => { isReady = true; });

// CORRECTION : Utilisation exacte de la variable DISCORD_BOT_TOKEN de ton image_71b668.png
client.login(process.env.DISCORD_BOT_TOKEN).catch(err => console.error("Discord Login Error:", err));

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (!isReady) {
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        // CORRECTION : Utilisation exacte de la variable DISCORD_GUILD_ID de ton image_71b668.png
        const guildId = process.env.DISCORD_GUILD_ID;
        const guild = await client.guilds.fetch(guildId);
        
        if (!guild) {
            return res.status(500).json({ error: "Guild not found. Check DISCORD_GUILD_ID env variable." });
        }

        // Récupération des membres avec leurs présences
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
                joinedAt: m.joinedAt // Récupération de la vraie date de join Discord !
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
