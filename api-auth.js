const { createClient } = require('@vercel/kv');

// Initialisation de Vercel KV
const kv = (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) 
  ? createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN }) 
  : null;

// Nettoyage et configuration des variables d'environnement
const CLIENT_ID = process.env.DISCORD_CLIENT_ID ? process.env.DISCORD_CLIENT_ID.trim() : "";
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET ? process.env.DISCORD_CLIENT_SECRET.trim() : "";
const GUILD_ID = process.env.DISCORD_GUILD_ID ? process.env.DISCORD_GUILD_ID.trim() : "";
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN ? process.env.DISCORD_BOT_TOKEN.trim() : "";

const REDIRECT_URI = "https://usmscord.blabchat.space/api/auth?action=callback";

module.exports = async (req, res) => {
    const { action, code } = req.query;

    // 1. DIRECTION LE LOGIN DISCORD
    if (action === 'login') {
        const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=1507809245163294811&response_type=code&redirect_uri=https%3A%2F%2Fusmscord.blabchat.space%2Fapi%2Fauth%3Faction%3Dcallback&scope=identify`;
        return res.redirect(discordAuthUrl);
    }

    // 2. RETOUR DE DISCORD (CALLBACK)
    if (action === 'callback') {
        if (!code) {
            return res.status(400).send("<h1>Erreur</h1><p>Aucun code d'authentification n'a été renvoyé par Discord.</p><a href='/'>Retour</a>");
        }

        try {
            // Échange du code temporaire contre l'Access Token
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
            
            if (!tokenData.access_token) {
                return res.status(400).send(`
                    <h1>Erreur d'authentification</h1>
                    <p>Discord a refusé de délivrer l'Access Token.</p>
                    <p><strong>Réponse brute de Discord :</strong> <code>${JSON.stringify(tokenData)}</code></p>
                    <p><strong>URL de redirection envoyée :</strong> <code>${REDIRECT_URI}</code></p>
                    <a href="/">Retourner à l'accueil</a>
                `);
            }

            // Récupération des infos de l'utilisateur connecté (@me)
            const userResponse = await fetch('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
            });
            const userData = await userResponse.json();

            // Vérification : Le membre est-il présent sur le serveur Discord ?
            const guildMemberResponse = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userData.id}`, {
                headers: { Authorization: `Bot ${BOT_TOKEN}` },
            });

            if (!guildMemberResponse.ok) {
                return res.status(403).send("<h1>Accès Refusé</h1><p>Tu dois faire partie du serveur Discord officiel pour te connecter ici.</p><a href='/'>Retour à l'accueil</a>");
            }

            const memberData = await guildMemberResponse.json();

            // Récupération et mappage des rôles avec leurs couleurs respectives
            const rolesResponse = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/roles`, {
                headers: { Authorization: `Bot ${BOT_TOKEN}` },
            });
            const allRoles = rolesResponse.ok ? await rolesResponse.json() : [];
            const userRoles = (memberData.roles || []).map(rId => {
                const found = allRoles.find(r => r.id === rId);
                return found ? { name: found.name, color: '#' + found.color.toString(16).padStart(6, '0') } : null;
            }).filter(Boolean);

            // Préparation de l'objet de session
            const sessionUser = {
                id: userData.id,
                username: userData.username,
                nickname: memberData.nick || userData.global_name || userData.username,
                avatar: userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : "https://discord.com/assets/c09a1f2c4e3434665332.svg",
                joinedAt: memberData.joined_at,
                roles: userRoles
            };

            // ATTRIBUTION AUTOMATIQUE DU RÔLE ADMIN POUR FUFUOFFICIAL_
            if (userData.username.toLowerCase() === 'fufuofficial_') {
                if (!sessionUser.roles) sessionUser.roles = [];
                sessionUser.roles.unshift({ name: "Admin 👑", color: "#FF0000" });
            }

            // Création du cookie de session (valable 24 heures)
            res.setHeader('Set-Cookie', `usms_user=${encodeURIComponent(JSON.stringify(sessionUser))}; Path=/; Max-Age=86400; SameSite=Lax`);
            return res.redirect('/');

        } catch (error) {
            return res.status(500).send(`<h1>Erreur Interne</h1><p>${error.message}</p>`);
        }
    }

    // 3. ACTION DE LOGOUT
    if (action === 'logout') {
        res.setHeader('Set-Cookie', 'usms_user=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
        return res.redirect('/');
    }

    return res.status(400).json({ error: "Action inconnue." });
};
