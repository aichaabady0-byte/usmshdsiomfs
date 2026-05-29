document.addEventListener("DOMContentLoaded", () => {
    // Éléments UI Globaux
    const tabs = document.querySelectorAll('#nav-tabs .tab');
    const pages = document.querySelectorAll('.page-content');
    const membersGrid = document.getElementById('members-grid');
    const videosGrid = document.getElementById('videos-grid');
    const searchInput = document.getElementById('search-input');
    
    // Auth & Admin Elements
    const authBtn = document.getElementById('discord-auth-btn');
    const userStatusText = document.getElementById('user-status-text');
    const publishBox = document.getElementById('publish-box');
    const fufuAdminBox = document.getElementById('fufu-admin-box');
    const adminUserSelect = document.getElementById('admin-user-select');
    
    // Inspection profil
    const profileDetailZone = document.getElementById('profile-detail-zone');
    const modalBody = document.getElementById('modal-body');

    // Base de données simulée (Pour que tout tourne côté client sans crash)
    let allMembers = [];
    let verifiedUsersList = ['fufu']; // Liste de pseudos avec icône vérifiée
    let currentUser = null; 

    // Données Vidéos initiales (Style 2006)
    let videoData = [
        {
            id: 1,
            title: "USMS Retro Presentation Video",
            url: "https://www.w3schools.com/html/mov_bbb.mp4",
            thumbnail: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=300",
            creator: { username: "fufu", nickname: "Fufu (Admin)", joinedAt: "2025-01-10", roles: [{name:"Admin", color:"#FF0000"}] },
            likes: 42,
            dislikes: 2,
            comments: [{ author: "RetroGuy", text: "Incredible project! I love it." }]
        }
    ];

    // GESTION DES ONGLETS
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            pages.forEach(p => p.classList.remove('active-page'));
            
            tab.classList.add('active');
            document.getElementById(tab.dataset.target).classList.add('active-page');
        });
    });

    // SIMULATION CONNEXION DISCORD
    authBtn.addEventListener('click', () => {
        if (!currentUser) {
            // Simulation : On connecte l'utilisateur en tant que membre ou Fufu
            const choice = prompt("Enter username to login (Type 'fufu' to test Admin permissions):", "Fufu");
            if (!choice) return;

            currentUser = {
                username: choice.toLowerCase(),
                nickname: choice,
                joinedAt: new Date().toISOString(),
                roles: choice.toLowerCase() === 'fufu' ? [{name: "Admin", color: "#FF0000"}] : [{name: "Member", color: "#000000"}]
            };

            userStatusText.innerText = `Connected as: ${currentUser.nickname}`;
            authBtn.innerText = "Disconnect";
            publishBox.style.display = "block"; // Autorise la publication

            // Active l'administration si c'est Fufu
            if (currentUser.username === 'fufu') {
                fufuAdminBox.style.display = "block";
                populateAdminSelect();
            }
        } else {
            currentUser = null;
            userStatusText.innerText = "Not connected";
            authBtn.innerText = "Connect with Discord";
            publishBox.style.display = "none";
            fufuAdminBox.style.display = "none";
        }
        renderVideos();
    });

    // CHARGEMENT DE L'API DES MEMBRES DISCORD
    async function fetchDiscordMembers() {
        try {
            const res = await fetch('/api/members');
            if(res.ok) {
                const data = await res.json();
                allMembers = data.members || [];
                renderMembersGrid(allMembers);
                populateAdminSelect();
            }
        } catch(e) {
            console.error("API Members loading failed, using fallback mock users.");
            allMembers = [
                { id: "1", username: "fufu", nickname: "Fufu", avatar: "logo.png", joinedAt: "2026-01-01", roles:[{name:"Admin", color:"#FF0000"}] },
                { id: "2", username: "blabchat", nickname: "BlabChatter", avatar: "logo.png", joinedAt: "2026-03-15", roles:[{name:"Modo", color:"#00FF00"}] }
            ];
            renderMembersGrid(allMembers);
        }
    }

    function renderMembersGrid(list) {
        membersGrid.innerHTML = "";
        list.forEach(m => {
            const card = document.createElement('div');
            card.classList.add('member-card');
            
            const isVerified = verifiedUsersList.includes(m.username.toLowerCase());
            const verifiedBadge = isVerified ? `<span class="verified-badge">✓</span>` : "";

            let color = m.roles && m.roles.length > 0 ? m.roles[0].color : "#666";
            if (color.toLowerCase() === '#ffffff' || color.toLowerCase() === '#000000') color = '#000000';

            card.innerHTML = `
                <img class="card-avatar" src="${m.avatar || 'logo.png'}" alt="avatar">
                <div class="card-name">${m.nickname} ${verifiedBadge}</div>
                <div style="color:${color}; font-size:10px;">${m.roles && m.roles.length > 0 ? m.roles[0].name : 'No Role'}</div>
            `;
            card.addEventListener('click', () => displayInspectionCard(m));
            membersGrid.appendChild(card);
        });
    }

    // FONCTION INSPECTION COMMUNE DE PROFIL
    function displayInspectionCard(member) {
        let dateStr = member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : "N/A";
        const isVerified = verifiedUsersList.includes(member.username.toLowerCase());
        
        modalBody.innerHTML = `
            <div class="profile-header">
                <img class="modal-avatar" src="${member.avatar || 'logo.png'}">
                <div>
                    <h2><strong>${member.nickname}</strong> ${isVerified ? '<span class="verified-badge">✓ Verified</span>':''}</h2>
                    <span>@${member.username}</span>
                </div>
            </div>
            <div class="modal-row"><span class="modal-label">Join Date:</span><div>${dateStr}</div></div>
            <div class="modal-row"><span class="modal-label">Top Roles:</span><div>
                ${member.roles ? member.roles.map(r => `<span class="modal-role-badge" style="color:${r.color==='#ffffff'?'#000':r.color};">${r.name}</span>`).join('') : 'None'}
            </div></div>
        `;
        profileDetailZone.style.display = "block";
        profileDetailZone.scrollIntoView({ behavior: 'smooth' });
    }

    // RENDU DES VIDÉOS (HOME)
    function renderVideos() {
        videosGrid.innerHTML = "";
        videoData.forEach(vid => {
            const card = document.createElement('div');
            card.classList.add('video-card');
            
            const isVerified = verifiedUsersList.includes(vid.creator.username.toLowerCase());
            
            card.innerHTML = `
                <div class="video-thumb-container">
                    <img class="video-thumb" src="${vid.thumbnail}" alt="thumb">
                </div>
                <div class="video-title">${vid.title}</div>
                <div class="video-author">By: ${vid.creator.nickname} ${isVerified ? '<span class="verified-badge">✓</span>':''}</div>
            `;
            card.addEventListener('click', () => openVideoPlayer(vid));
            videosGrid.appendChild(card);
        });
    }

    // OUVERTURE DU LECTEUR VIDEOS ET LIKES/COMMENTAIRES
    function openVideoPlayer(vid) {
        document.getElementById('video-player-zone').style.display = "block";
        document.getElementById('player-video-title').innerText = vid.title;
        
        const videoElement = document.getElementById('main-video-element');
        videoElement.src = vid.url;
        
        const creatorNameZone = document.getElementById('player-creator-name');
        creatorNameZone.innerText = vid.creator.nickname;
        
        // Clic sur le créateur de la vidéo pour inspecter ses infos (Rôle, Join Date)
        creatorNameZone.onclick = () => displayInspectionCard(vid.creator);

        // Mise à jour des likes
        const likeCountEl = document.getElementById('like-count');
        likeCountEl.innerText = vid.likes;

        document.getElementById('like-btn').onclick = () => { vid.likes++; likeCountEl.innerText = vid.likes; };
        document.getElementById('dislike-btn').onclick = () => { alert("Disliked recorded (Only total likes count is visible)."); };

        // Afficher les commentaires
        const commentsList = document.getElementById('comments-list');
        const appendComments = () => {
            commentsList.innerHTML = vid.comments.map(c => `<p style="margin-bottom:4px;"><strong>${c.author}:</strong> ${c.text}</p>`).join('');
        };
        appendComments();

        // Zone écriture de commentaire si connecté
        const commentZone = document.getElementById('add-comment-zone');
        if (currentUser) {
            commentZone.style.display = "block";
            document.getElementById('submit-comment-btn').onclick = () => {
                const input = document.getElementById('new-comment-text');
                if(!input.value.trim()) return;
                vid.comments.push({ author: currentUser.nickname, text: input.value });
                input.value = "";
                appendComments();
            };
        } else {
            commentZone.style.display = "none";
        }

        document.getElementById('video-player-zone').scrollIntoView({ behavior: 'smooth' });
    }

    // FORMULAIRE DE PUBLICATION DE NOUVELLE VIDEO
    document.getElementById('publish-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const title = document.getElementById('vid-title').value;
        const url = document.getElementById('vid-url').value;
        let thumb = document.getElementById('vid-thumb').value;

        if (!thumb) thumb = "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=300";

        videoData.push({
            id: videoData.length + 1,
            title: title,
            url: url,
            thumbnail: thumb,
            creator: currentUser,
            likes: 0,
            dislikes: 0,
            comments: []
        });

        document.getElementById('publish-form').reset();
        renderVideos();
        alert("Your video has been published successfully on the feed!");
    });

    // REMPLISSAGE DU FORMULAIRE ADMIN POUR FUFU
    function populateAdminSelect() {
        adminUserSelect.innerHTML = '<option value="">Select a member...</option>';
        allMembers.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.username;
            opt.innerText = m.nickname;
            adminUserSelect.appendChild(opt);
        });
    }

    // ACTION BOUTON VÉRIFIÉ DU COMPTE ADMIN DE FUFU
    document.getElementById('admin-verify-btn').addEventListener('click', () => {
        const selectedTarget = adminUserSelect.value;
        if(!selectedTarget) return alert("Please select a target member first.");

        if(verifiedUsersList.includes(selectedTarget.toLowerCase())) {
            verifiedUsersList = verifiedUsersList.filter(u => u !== selectedTarget.toLowerCase());
            alert(`Verified badge removed from ${selectedTarget}`);
        } else {
            verifiedUsersList.push(selectedTarget.toLowerCase());
            alert(`Verified badge granted to ${selectedTarget}! ✓`);
        }
        renderMembersGrid(allMembers);
        renderVideos();
    });

    // MOTEUR DE RECHERCHE GLOBAL
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        
        // Filtre les membres
        const filteredMembers = allMembers.filter(m => m.nickname.toLowerCase().includes(query) || m.username.toLowerCase().includes(query));
        renderMembersGrid(filteredMembers);

        // Filtre les vidéos
        const originVideos = [...videoData];
        videoData = videoData.filter(v => v.title.toLowerCase().includes(query));
        renderVideos();
        videoData = originVideos; // Restaure
    });

    // Initialisation
    fetchDiscordMembers();
    renderVideos();
});
