const { createClient } = require('@vercel/kv');

const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth?action=callback`;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

module.exports = async (req, res) => {
    const { action, code } = req.query;

    // 1. Redirection vers Discord Login
if (action === 'login') {
    // Colle ici l'URL générée que tu as copiée depuis l'interface de l'image_c96fd4.png
    const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=1507809245163294811&response_type=code&redirect_uri=https%3A%2F%2Fusmscord.blabchat.space%2Fapi%2Fauth%3Faction%3Dcallback&scope=identify`;
    return res.redirect(discordAuthUrl);
}

    // 2. Callback de Discord
    if (action === 'callback' && code) {
        try {
            // Échange du code contre un Access Token
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
            if (!tokenData.access_token) throw new Error('Failed to get access token');

            // Récupération du profil de l'utilisateur
            const userResponse = await fetch('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
            });
            const userData = await userResponse.json();

            // VÉRIFICATION : Est-il sur le serveur Discord ? (Via l'API Bot pour éviter d'avoir à redemander l'autorisation de guilde)
            const guildMemberResponse = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userData.id}`, {
                headers: { Authorization: `Bot ${BOT_TOKEN}` },
            });

            if (!guildMemberResponse.ok) {
                return res.status(403).send("<h1>Access Denied</h1><p>You must be a member of the official Discord server to log in.</p><a href='/'>Back to Home</a>");
            }

            const memberData = await guildMemberResponse.json();

            // On récupère ses rôles sur le serveur
            const rolesResponse = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/roles`, {
                headers: { Authorization: `Bot ${BOT_TOKEN}` },
            });
            const allRoles = rolesResponse.ok ? await rolesResponse.json() : [];
            const userRoles = (memberData.roles || []).map(rId => {
                const found = allRoles.find(r => r.id === rId);
                return found ? { name: found.name, color: '#' + found.color.toString(16).padStart(6, '0') } : null;
            }).filter(Boolean);

            // Création de notre session utilisateur
            const sessionUser = {
                id: userData.id,
                username: userData.username,
                nickname: memberData.nick || userData.global_name || userData.username,
                avatar: userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : "https://discord.com/assets/c09a1f2c4e3434665332.svg",
                joinedAt: memberData.joined_at,
                roles: userRoles
            };

            // On génère un cookie de session très simple
            res.setHeader('Set-Cookie', `usms_user=${encodeURIComponent(JSON.stringify(sessionUser))}; Path=/; Max-Age=86400; SameSite=Lax`);
            return res.redirect('/');

        } catch (error) {
            return res.status(500).json({ error: "Auth failed", details: error.message });
        }
    }

    // 3. Déconnexion
    if (action === 'logout') {
        res.setHeader('Set-Cookie', 'usms_user=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
        return res.redirect('/');
    }

    return res.status(400).json({ error: "Invalid action" });
};
