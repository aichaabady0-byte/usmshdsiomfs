const { createClient } = require('@vercel/kv');

// On initialise le client proprement sans forcer le crash si les variables manquent
let kv;
if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    kv = createClient({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
    });
}

// Variables locales en mémoire au cas où KV n'est pas lié pour éviter l'erreur 500
let localVideos = [
    {
        id: 1,
        title: "USMS Retro Presentation Video",
        url: "https://www.w3schools.com/html/mov_bbb.mp4",
        thumbnail: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=300",
        creator: { username: "fufu", nickname: "Fufu (Admin)", joinedAt: "2026-01-10", roles: [{name:"Admin", color:"#FF0000"}] },
        likes: 42,
        comments: [{ author: "RetroGuy", text: "Incredible project! I love it." }]
    }
];
let localVerified = ['fufu'];

module.exports = async (req, res) => {
    // Config des headers CORS pour éviter les blocages navigateurs
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        let videos = localVideos;
        let verifiedUsers = localVerified;

        // Si Vercel KV est connecté, on pioche dedans
        if (kv) {
            try {
                const dbVideos = await kv.get('usms_videos');
                const dbVerified = await kv.get('usms_verified');
                if (dbVideos) videos = dbVideos;
                if (dbVerified) verifiedUsers = dbVerified;
            } catch (dbError) {
                console.error("Erreur de lecture KV, bascule sur la mémoire locale:", dbError);
            }
        }

        if (req.method === 'GET') {
            return res.status(200).json({ videos, verifiedUsers });
        }

        if (req.method === 'POST') {
            const { action, video, videoId, comment, targetUser, isVerified } = req.body;

            if (action === 'upload') {
                videos.unshift(video);
                if (kv) await kv.set('usms_videos', videos);
                else localVideos = videos;
                return res.status(200).json({ success: true, videos });
            }

            if (action === 'like') {
                videos = videos.map(v => v.id === videoId ? { ...v, likes: (v.likes || 0) + 1 } : v);
                if (kv) await kv.set('usms_videos', videos);
                else localVideos = videos;
                return res.status(200).json({ success: true, videos });
            }

            if (action === 'comment') {
                videos = videos.map(v => v.id === videoId ? { ...v, comments: [...(v.comments || []), comment] } : v);
                if (kv) await kv.set('usms_videos', videos);
                else localVideos = videos;
                return res.status(200).json({ success: true, videos });
            }

            if (action === 'toggle-verify') {
                if (isVerified) {
                    if (!verifiedUsers.includes(targetUser)) verifiedUsers.push(targetUser);
                } else {
                    verifiedUsers = verifiedUsers.filter(u => u !== targetUser);
                }
                if (kv) await kv.set('usms_verified', verifiedUsers);
                else localVerified = verifiedUsers;
                return res.status(200).json({ success: true, verifiedUsers });
            }
        }

        return res.status(405).json({ error: "Method not allowed" });

    } catch (globalError) {
        // Au lieu de crash en 500, on renvoie le texte de l'erreur pour la voir dans le navigateur
        return res.status(200).json({ 
            error: true, 
            message: globalError.message,
            videos: localVideos,
            verifiedUsers: localVerified
        });
    }
};
