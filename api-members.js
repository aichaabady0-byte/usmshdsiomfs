const { Client, GatewayIntentBits } = require('discord.js');

module.exports = async (req, res) => {
    // Config CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
    const GUILD_ID = process.env.DISCORD_GUILD_ID;

    if (!BOT_TOKEN || !GUILD_ID) {
        return res.status(200).json({ 
            error: "Configuration manquante", 
            details: "Les variables DISCORD_BOT_TOKEN ou DISCORD_GUILD_ID ne sont pas configurées dans l'onglet Settings de Vercel." 
        });
    }

    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildPresences
        ]
    });

    try {
        // Connexion avec une limite de temps de 5 secondes max
        await Promise.race([
            client.login(BOT_TOKEN),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout de connexion Discord")), 5000))
        ]);

        // Attendre que le bot soit prêt
        if (!client.readyAt) {
            await new Promise((resolve) => client.once('ready', resolve));
        }

        const guild = await client.guilds.fetch(GUILD_ID);
        if (!guild) {
            client.destroy();
            return res.status(200).json({ error: "Serveur introuvable", details: "L'ID du serveur est incorrect ou le bot n'est pas dedans." });
        }

        const membersFetch = await guild.members.fetch({ withPresences: true });
        
        const membersList = membersFetch.map(m => ({
            id: m.id,
            nickname: m.displayName || m.user.username,
            username: m.user.username,
            avatar: m.user.displayAvatarURL({ extension: 'png', size: 128 }),
            status: m.presence ? m.presence.status : 'offline',
            roles: m.roles.cache
                .filter(r => r.name !== '@everyone')
                .map(r => ({ name: r.name, color: r.hexColor }))
        }));

        client.destroy();
        return res.status(200).json(membersList);

    } catch (error) {
        try { client.destroy(); } catch(e) {}
        // Au lieu de crash en 500, on renvoie l'erreur proprement au format JSON pour la voir sur le site
        return res.status(200).json({ 
            error: "Erreur d'exécution", 
            details: error.message 
        });
    }
};
