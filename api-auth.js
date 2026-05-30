const { createClient } = require('@vercel/kv');

const kv = (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) 
  ? createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN }) 
  : null;

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth?action=callback`;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

module.exports = async (req, res) => {
    const { action, code } = req.query;

    // 1. ACTION DE LOGIN : Redirige l'utilisateur vers la page de connexion officielle Discord
    if (action === 'login') {
        // Remplacer cette URL par ton lien Generated URL obtenu sur l'interface Discord Dev
        const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=1507809245163294811&response_type=code&redirect_uri=https%3A%2F%2Fusmscord.blabchat.space%2Fapi%2Fauth%3Faction%3Dcallback&scope=identify`;
        return res.redirect(discordAuthUrl);
    }

    // 2. ACTION DE CALLBACK : Discord renvoie l'utilisateur ici avec un code temporaire
    if (action === 'callback' && code) {
        try {
            // Échange du code contre un Access Token utilisateur
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
            if (!tokenData.access_token) throw new Error('Impossible d\'obtenir l\'Access Token utilisateur');

            // Récupération de l'identité Discord basique (@me) de l'utilisateur connecté
            const userResponse = await fetch('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
            });
            const userData = await userResponse.json();

            // SÉCURITÉ REQUISES : On interroge l'API Discord avec notre token de Bot pour savoir si l'user est dans le serveur
            const guildMemberResponse = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userData.id}`, {
                headers: { Authorization: `Bot ${BOT_TOKEN}` },
            });

            if (!guildMemberResponse.ok) {
                return res.status(403).send("<h1>Accès Refusé</h1><p>Tu dois obligatoirement faire partie du serveur Discord officiel pour vous connecter.</p><a href='/'>Retour à l'accueil</a>");
            }

            const memberData = await guildMemberResponse.json();

            // On charge tous les rôles du serveur pour mapper les IDs des rôles du membre avec leurs vrais noms/couleurs
            const rolesResponse = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/roles`, {
                headers: { Authorization: `Bot ${BOT_TOKEN}` },
            });
            const allRoles = rolesResponse.ok ? await rolesResponse.json() : [];
            const userRoles = (memberData.roles || []).map(rId => {
                const found = allRoles.find(r => r.id === rId);
                return found ? { name: found.name, color: '#' + found.color.toString(16).padStart(6, '0') } : null;
            }).filter(Boolean);

            // Construction de l'objet de session utilisateur final
            const sessionUser = {
                id: userData.id,
                username: userData.username,
                nickname: memberData.nick || userData.global_name || userData.username,
                avatar: userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : "https://discord.com/assets/c09a1f2c4e3434665332.svg",
                joinedAt: memberData.joined_at,
                roles: userRoles
            };

            // Enregistrement de l'utilisateur dans un cookie HTTP sécurisé d'une durée de 24h
            res.setHeader('Set-Cookie', `usms_user=${encodeURIComponent(JSON.stringify(sessionUser))}; Path=/; Max-Age=86400; SameSite=Lax`);
            return res.redirect('/');

        } catch (error) {
            return res.status(500).send(`<h1>Erreur d'authentification</h1><p>${error.message}</p>`);
        }
    }

    // 3. ACTION DE LOGOUT : Efface le cookie de session pour déconnecter l'utilisateur
    if (action === 'logout') {
        res.setHeader('Set-Cookie', 'usms_user=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
        return res.redirect('/');
    }

    return res.status(400).json({ error: "Action invalide demandée." });
};
