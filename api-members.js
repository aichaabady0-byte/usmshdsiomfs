const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages
    ]
});

// Connexion automatique du bot unique
let isReady = false;
client.login(process.env.DISCORD_TOKEN);
client.once('ready', () => { isReady = true; });

module.exports = async (req, res) => {
    if (!isReady) {
        return res.status(503).json({ error: "Bot starting up, try again." });
    }

    const guild = client.guilds.cache.get(process.env.GUILD_ID);
    if (!guild) return res.status(404).json({ error: "Guild not found" });

    // --- INTERACTION ACTION POST (Envoi message / Modération) ---
    if (req.method === 'POST') {
        const { action, channelId, content, userId } = req.body;

        try {
            if (action === 'sendMessage') {
                const channel = await client.channels.fetch(channelId);
                await channel.send(content);
                return res.json({ success: true });
            }

            if (action === 'kick') {
                const member = await guild.members.fetch(userId);
                await member.kick("Kicked from USMS Web Interface");
                return res.json({ success: true });
            }

            if (action === 'ban') {
                await guild.members.ban(userId, { reason: "Banned from USMS Web Interface" });
                return res.json({ success: true });
            }

            if (action === 'timeout') {
                const member = await guild.members.fetch(userId);
                await member.timeout(60 * 1000 * 10, "Muted 10m via Web Interface"); // 10 minutes
                return res.json({ success: true });
            }
        } catch (err) {
            return res.status(500).json({ error: "Discord API action failed", details: err.message });
        }
    }

    // --- INTERACTION PAR DÉFAUT GET (Récupération des membres et des salons) ---
    try {
        const membersList = await guild.members.fetch({ withPresences: true });
        const channelsList = await guild.channels.fetch();

        const dataChannels = channelsList.map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            parentId: c.parentId,
            position: c.position
        }));

        const dataMembers = membersList.map(m => ({
            id: m.id,
            username: m.user.username,
            nickname: m.displayName,
            avatar: m.user.displayAvatarURL({ extension: 'png' }),
            status: m.presence ? m.presence.status : 'offline',
            roles: m.roles.cache.filter(r => r.name !== '@everyone').map(r => ({ name: r.name, color: r.hexColor }))
        }));

        return res.status(200).json({
            guildInfo: { name: guild.name, id: guild.id, rolesCount: guild.roles.cache.size },
            channels: dataChannels,
            members: dataMembers
        });
    } catch (error) {
        return res.status(500).json({ error: "Fetch failed", details: error.message });
    }
};
