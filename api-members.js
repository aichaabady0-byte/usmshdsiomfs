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
            details: `Token present: ${!!token}, Guild ID present: ${!!guildId}` 
        });
    }

    try {
        // 1. Fetch du serveur
        const guildRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
            headers: { 'Authorization': `Bot ${token}` }
        });

        if (!guildRes.ok) {
            const errText = await guildRes.text();
            return res.status(500).json({ error: "Discord Guild API Error", details: errText, status: guildRes.status });
        }
        const guildData = await guildRes.json();

        // 2. Fetch des rôles
        const rolesRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
            headers: { 'Authorization': `Bot ${token}` }
        });
        const allRoles = rolesRes.ok ? await rolesRes.json() : [];
        const rolesMap = new Map(allRoles.map(r => [r.id, { name: r.name, color: '#' + r.color.toString(16).padStart(6, '0') }]));

        // 3. Fetch des membres (CORRIGÉ : plus de problème de guillemets ici)
        const membersRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members?limit=1000`, {
            headers: { 'Authorization': `Bot ${token}` }
        });

        if (!membersRes.ok) {
            const errText = await membersRes.text();
            return res.status(500).json({ error: "Discord Members API Error", details: errText, status: membersRes.status });
        }
        const membersData = await membersRes.json();

        // 4. Traitement des membres
        const memberList = membersData.map(m => {
            if (!m.user) return null;

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

            let avatarUrl = "https://discord.com/assets/c09a1f2c4e3434665332.svg";
            if (m.user.avatar) {
                avatarUrl = `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png?size=128`;
            }

            return {
                id: m.user.id,
                username: m.user.username,
                nickname: m.nick || m.user.global_name || m.user.username,
                avatar: avatarUrl,
                status: "online", 
                roles: memberRoles.map(r => ({ name: r.name, color: r.color })),
                joinedAt: m.joined_at
            };
        }).filter(Boolean);

        return res.status(200).json({
            serverName: guildData.name,
            memberCount: memberList.length,
            members: memberList
        });

    } catch (error) {
        return res.status(500).json({ 
            error: "Server Crash", 
            details: error.message 
        });
    }
};
