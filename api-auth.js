const { createClient } = require('@vercel/kv');

const kv = (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) 
  ? createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN }) 
  : null;

const CLIENT_ID = process.env.DISCORD_CLIENT_ID ? process.env.DISCORD_CLIENT_ID.trim() : "";
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET ? process.env.DISCORD_CLIENT_SECRET.trim() : "";
const GUILD_ID = process.env.DISCORD_GUILD_ID ? process.env.DISCORD_GUILD_ID.trim() : "";
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN ? process.env.DISCORD_BOT_TOKEN.trim() : "";

const REDIRECT_URI = "https://usmscord.blabchat.space/api/auth?action=callback";

module.exports = async (req, res) => {
    const { action, code } = req.query;

    if (action === 'login') {
        const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=1507809245163294811&response_type=code&redirect_uri=https%3A%2F%2Fusmscord.blabchat.space%2Fapi%2Fauth%3Faction%3Dcallback&scope=identify`;
        return res.redirect(discordAuthUrl);
    }

    if (action === 'callback') {
        if (!code) return res.status(400).send("<h1>Erreur</h1><p>Code manquant.</p>");

        try {
            const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
                method: 'POST',
                body: new URLSearchParams({
                    client_id: CLIENT_ID,
                    client_secret: CLIENT_SECRET,
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: REDIRECT_URI,
                }),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });

            const tokenData = await tokenResponse.json();
            if (!tokenData.access_token) return res.status(400).send("<h1>Erreur Token Discord</h1>");

            const userResponse = await fetch('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
            });
            const userData = await userResponse.json();

            const guildMemberResponse = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userData.id}`, {
                headers: { Authorization: `Bot ${BOT_TOKEN}` },
            });

            if (!guildMemberResponse.ok) {
                return res.status(403).send("<h1>Accès Refusé</h1><p>Tu dois faire partie du serveur Discord.</p>");
            }

            const memberData = await guildMemberResponse.json();

            const rolesResponse = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/roles`, {
                headers: { Authorization: `Bot ${BOT_TOKEN}` },
            });
            const allRoles = rolesResponse.ok ? await rolesResponse.json() : [];
            const userRoles = (memberData.roles || []).map(rId => {
                const found = allRoles.find(r => r.id === rId);
                return found ? { name: found.name, color: '#' + found.color.toString(16).padStart(6, '0') } : null;
            }).filter(Boolean);

            // Session propre
            const sessionUser = {
                id: userData.id,
                username: userData.username,
                nickname: memberData.nick || userData.global_name || userData.username,
                avatar: userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : "https://discord.com/assets/c09a1f2c4e3434665332.svg",
                joinedAt: memberData.joined_at,
                roles: userRoles
            };

            res.setHeader('Set-Cookie', `usms_user=${encodeURIComponent(JSON.stringify(sessionUser))}; Path=/; Max-Age=86400; SameSite=Lax`);
            return res.redirect('/');

        } catch (error) {
            return res.status(500).send(`<h1>Erreur Interne</h1><p>${error.message}</p>`);
        }
    }

    if (action === 'logout') {
        res.setHeader('Set-Cookie', 'usms_user=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
        return res.redirect('/');
    }
};
