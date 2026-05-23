const { Client, GatewayIntentBits } = require('discord.js');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
    const GUILD_ID = process.env.DISCORD_GUILD_ID;

    if (!BOT_TOKEN || !GUILD_ID) {
        return res.status(500).json({ error: "Variables manquantes sur Vercel." });
    }

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildPresences
        ]
    });

    try {
        await client.login(BOT_TOKEN);
        const guild = await client.guilds.fetch(GUILD_ID);
        const membersFetch = await guild.members.fetch({ withPresences: true });
        
        const membersList = membersFetch.map(m => {
            const roles = m.roles.cache
                .filter(r => r.name !== '@everyone')
                .map(r => ({
                    name: r.name,
                    color: r.hexColor
                }));

            return {
                id: m.id,
                nickname: m.displayName,
                username: m.user.username,
                avatar: m.user.displayAvatarURL({ dynamic: true, size: 128 }),
                status: m.presence ? m.presence.status : 'offline',
                roles: roles
            };
        });

        client.destroy();
        res.status(200).json(membersList);

    } catch (error) {
        console.error(error);
        if (client) client.destroy();
        res.status(500).json({ error: "Erreur Discord API." });
    }
};
