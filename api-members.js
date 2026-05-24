module.exports = async (req, res) => {
    // Config Headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const token = process.env.DISCORD_BOT_TOKEN;
    const guildId = process.env.DISCORD_GUILD_ID;

    if (!token || !guildId) {
        return res.status(500).json({ 
            error: "Missing Configuration", 
            details: "DISCORD_BOT_TOKEN or DISCORD_GUILD_ID is not set in Vercel." 
        });
    }

    try {
        // 1. Récupérer les informations du serveur (pour le nom du serveur)
        const guildRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
            headers: { 'Authorization': `Bot ${token}` }
        });

        if (!guildRes.ok) {
            const errText = await guildRes.text();
            throw new Error(`Discord Guild API responded with status ${guildRes.status}: ${errText}`);
        }
        const guildData = await guildRes.json();

        // 2. Récupérer la liste des rôles du serveur pour faire la correspondance des couleurs plus tard
        const rolesRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
            headers: { 'Authorization': `Bot ${token}` }
        });
        const allRoles = rolesRes.ok ? await rolesRes.json() : [];
        const rolesMap = new Map(allRoles.map(r => [r.id, { name: r.name, color: '#' + r.color.toString(16).padStart(6, '0') }]));

        // 3. Récupérer la liste des membres (limité aux 1000 premiers membres par défaut via API)
        const membersRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`, {
            headers: { 'Authorization': `Bot ${token}` }
        });

        if (!membersRes.ok) {
            const errText = await membersRes.text();
            throw new Error(`Discord Members API responded with status ${membersRes.status}: ${errText}`);
        }
        const membersData = await membersRes.json();

        // 4. Structurer les données proprement pour ton script.js
        const memberList = membersData.map(m => {
            // Associer et trier les rôles du membre par position
            const memberRoles = (m.roles || [])
                .map(roleId => {
                    const found = rolesMap.get(roleId);
                    const fullRole = allRoles.find(r => r.id === roleId);
                    return {
                        name: found ? found.name : 'Unknown',
                        color: found ? found.color : '#666666',
                        position: fullRole ? fullRole.position : 0
                    };
                })
                .sort((a, b) => b.position - a.position);

            // Gérer l'avatar de l'utilisateur (fallback sur l'avatar par défaut de Discord s'il n'en a pas)
            let avatarUrl = "https://discord.com/assets/c09a1f2c4e3434665332.svg";
            if (m.user.avatar) {
                avatarUrl = `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png?size=128`;
            }

            return {
                id: m.user.id,
                username: m.user.username,
                nickname: m.nick || m.user.global_name || m.user.username,
                avatar: avatarUrl,
                status: "online", // Par défaut "online" via HTTP (l'API HTTP basique ne donne pas le statut live instantané sans passer par Gateway)
                roles: memberRoles.map(r => ({ name: r.name, color: r.color })),
                joinedAt: m.joined_at
            };
        });

        return res.status(200).json({
            serverName: guildData.name,
            memberCount: memberList.length,
            members: memberList
        });

    } catch (error) {
        console.error("Backend Error Details:", error.message);
        return res.status(500).json({ 
            error: "Failed to fetch Discord data via HTTP", 
            details: error.message 
        });
    }
};
