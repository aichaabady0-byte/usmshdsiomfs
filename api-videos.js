const { createClient } = require('@vercel/kv');

const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    const method = req.method;

    try {
        // CHARGER LES VIDÉOS ET LES STATUTS VÉRIFIÉS
        let videos = (await kv.get('usms_videos')) || [];
        let verifiedUsers = (await kv.get('usms_verified')) || ['fufu'];

        if (method === 'GET') {
            return res.status(200).json({ videos, verifiedUsers });
        }

        if (method === 'POST') {
            const { action, video, videoId, comment, targetUser, isVerified } = req.body;

            // AJOUTER UNE VIDÉO
            if (action === 'upload') {
                videos.unshift(video); // Ajoute au début
                await kv.set('usms_videos', videos);
                return res.status(200).json({ success: true, videos });
            }

            // AJOUTER UN LIKE
            if (action === 'like') {
                videos = videos.map(v => v.id === videoId ? { ...v, likes: (v.likes || 0) + 1 } : v);
                await kv.set('usms_videos', videos);
                return res.status(200).json({ success: true, videos });
            }

            // AJOUTER UN COMMENTAIRE
            if (action === 'comment') {
                videos = videos.map(v => v.id === videoId ? { ...v, comments: [...(v.comments || []), comment] } : v);
                await kv.set('usms_videos', videos);
                return res.status(200).json({ success: true, videos });
            }

            // ACTION FUFU ADMIN (VÉRIFIER UN COMPTE)
            if (action === 'toggle-verify') {
                if (isVerified) {
                    if (!verifiedUsers.includes(targetUser)) verifiedUsers.push(targetUser);
                } else {
                    verifiedUsers = verifiedUsers.filter(u => u !== targetUser);
                }
                await kv.set('usms_verified', verifiedUsers);
                return res.status(200).json({ success: true, verifiedUsers });
            }
        }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
