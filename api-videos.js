const { createClient } = require('@vercel/kv');

const kv = (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) 
  ? createClient({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN }) 
  : null;

module.exports = async (req, res) => {
    // Config CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (!kv) {
        return res.status(500).json({ error: "Vercel KV non configuré dans les variables d'environnement." });
    }

    try {
        // GET : Récupère la liste des utilisateurs vérifiés depuis la DB
        if (req.method === 'GET') {
            const verifiedUsers = await kv.get('verified_users') || [];
            return res.status(200).json({ verifiedUsers });
        }

        // POST : Fufu active ou désactive la certification d'un membre
        if (req.method === 'POST') {
            const { action, targetUser, isVerified } = req.body;

            if (action === 'toggle-verify' && targetUser) {
                let verifiedUsers = await kv.get('verified_users') || [];
                
                // Nettoyage pour éviter les doublons ou casses différentes
                verifiedUsers = verifiedUsers.map(u => u.toLowerCase());
                const cleanTarget = targetUser.toLowerCase();

                if (isVerified) {
                    if (!verifiedUsers.includes(cleanTarget)) {
                        verifiedUsers.push(cleanTarget);
                    }
                } else {
                    verifiedUsers = verifiedUsers.filter(u => u !== cleanTarget);
                }

                await kv.set('verified_users', verifiedUsers);
                return res.status(200).json({ success: true, verifiedUsers });
            }
        }

        return res.status(400).json({ error: "Action ou méthode non supportée." });

    } catch (error) {
        return res.status(500).json({ error: "Erreur Base de Données KV", details: error.message });
    }
};
