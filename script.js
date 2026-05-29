document.addEventListener("DOMContentLoaded", () => {
    const tabs = document.querySelectorAll('#nav-tabs .tab');
    const pages = document.querySelectorAll('.page-content');
    const membersGrid = document.getElementById('members-grid');
    const videosGrid = document.getElementById('videos-grid');
    const searchInput = document.getElementById('search-input');
    
    const authBtn = document.getElementById('discord-auth-btn');
    const userStatusText = document.getElementById('user-status-text');
    const publishBox = document.getElementById('publish-box');
    const fufuAdminBox = document.getElementById('fufu-admin-box');
    const adminUserSelect = document.getElementById('admin-user-select');
    
    const profileDetailZone = document.getElementById('profile-detail-zone');
    const modalBody = document.getElementById('modal-body');

    let allMembers = [];
    let verifiedUsersList = [];
    let videoData = [];
    let currentUser = null;

    // 1. LIRE LE COOKIE DE CONNEXION DISCORD
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
    }

    const userCookie = getCookie('usms_user');
    if (userCookie) {
        currentUser = JSON.parse(userCookie);
        userStatusText.innerText = `Welcome, ${currentUser.nickname}`;
        authBtn.innerText = "Log Out";
        publishBox.style.display = "block";

        if (currentUser.username.toLowerCase() === 'fufu') {
            fufuAdminBox.style.display = "block";
        }
    }

    authBtn.addEventListener('click', () => {
        if (!currentUser) {
            window.location.href = '/api/auth?action=login'; // VRAIE REDIRECTION DISCORD
        } else {
            window.location.href = '/api/auth?action=logout'; // LOGOUT
        }
    });

    // 2. CHANGER D'ONGLET
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            pages.forEach(p => p.classList.remove('active-page'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.target).classList.add('active-page');
        });
    });

    // 3. CHARGER LES VIDÉOS ET LES MEMBRES DEPUIS LA BDD REELLE
    async function loadContent() {
        try {
            // Vidéos
            const vidRes = await fetch('/api/videos');
            const vidJson = await vidRes.json();
            videoData = vidJson.videos || [];
            verifiedUsersList = vidJson.verifiedUsers || ['fufu'];
            renderVideos();

            // Membres Discord
            const memRes = await fetch('/api/members');
            const memJson = await memRes.json();
            allMembers = memJson.members || [];
            renderMembersGrid(allMembers);
            populateAdminSelect();
        } catch (e) {
            console.error("Error connecting to real DB api:", e);
        }
    }

    function renderMembersGrid(list) {
        membersGrid.innerHTML = "";
        list.forEach(m => {
            const card = document.createElement('div');
            card.classList.add('member-card');
            const isVerified = verifiedUsersList.includes(m.username.toLowerCase());

            let color = m.roles && m.roles.length > 0 ? m.roles[0].color : "#666";
            if (color.toLowerCase() === '#ffffff') color = '#000000';

            card.innerHTML = `
                <img class="card-avatar" src="${m.avatar}" alt="avatar">
                <div class="card-name">${m.nickname} ${isVerified ? '<span class="verified-badge">✓</span>':''}</div>
                <div style="color:${color}; font-size:10px;">${m.roles && m.roles.length > 0 ? m.roles[0].name : 'No Role'}</div>
            `;
            card.addEventListener('click', () => displayInspectionCard(m));
            membersGrid.appendChild(card);
        });
    }

    function renderVideos() {
        videosGrid.innerHTML = "";
        if (videoData.length === 0) {
            videosGrid.innerHTML = "<div class='loading'>No videos published yet.</div>";
            return;
        }
        videoData.forEach(vid => {
            const card = document.createElement('div');
            card.classList.add('video-card');
            const isVerified = verifiedUsersList.includes(vid.creator.username.toLowerCase());
            
            card.innerHTML = `
                <div class="video-thumb-container">
                    <img class="video-thumb" src="${vid.thumbnail || 'logo.png'}" alt="thumb">
                </div>
                <div class="video-title">${vid.title}</div>
                <div class="video-author">By: ${vid.creator.nickname} ${isVerified ? '<span class="verified-badge">✓</span>':''}</div>
            `;
            card.addEventListener('click', () => openVideoPlayer(vid));
            videosGrid.appendChild(card);
        });
    }

    function openVideoPlayer(vid) {
        document.getElementById('video-player-zone').style.display = "block";
        document.getElementById('player-video-title').innerText = vid.title;
        
        const videoElement = document.getElementById('main-video-element');
        videoElement.src = vid.url;
        videoElement.play();
        
        const creatorNameZone = document.getElementById('player-creator-name');
        creatorNameZone.innerText = vid.creator.nickname;
        creatorNameZone.onclick = () => displayInspectionCard(vid.creator);

        const likeCountEl = document.getElementById('like-count');
        likeCountEl.innerText = vid.likes || 0;

        document.getElementById('like-btn').onclick = async () => {
            const res = await fetch('/api/videos', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ action: 'like', videoId: vid.id })
            });
            if(res.ok) { vid.likes++; likeCountEl.innerText = vid.likes; }
        };

        const commentsList = document.getElementById('comments-list');
        const renderComments = () => {
            commentsList.innerHTML = (vid.comments || []).map(c => `<p style="margin-bottom:4px;"><strong>${c.author}:</strong> ${c.text}</p>`).join('');
        };
        renderComments();

        const commentZone = document.getElementById('add-comment-zone');
        if (currentUser) {
            commentZone.style.display = "block";
            document.getElementById('submit-comment-btn').onclick = async () => {
                const input = document.getElementById('new-comment-text');
                if(!input.value.trim()) return;

                const newComment = { author: currentUser.nickname, text: input.value };
                const res = await fetch('/api/videos', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ action: 'comment', videoId: vid.id, comment: newComment })
                });

                if(res.ok) {
                    if(!vid.comments) vid.comments = [];
                    vid.comments.push(newComment);
                    input.value = "";
                    renderComments();
                }
            };
        } else {
            commentZone.style.display = "none";
        }
        document.getElementById('video-player-zone').scrollIntoView({ behavior: 'smooth' });
    }

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
            <div class="modal-row"><span class="modal-label">Roles:</span><div>
                ${member.roles ? member.roles.map(r => `<span class="modal-role-badge" style="color:${r.color}; border-color:${r.color};">${r.name}</span>`).join('') : 'None'}
            </div></div>
        `;
        profileDetailZone.style.display = "block";
        profileDetailZone.scrollIntoView({ behavior: 'smooth' });
    }

    // PUBLIER UNE VRAIE VIDÉO (MP4 OU AUTRE)
    document.getElementById('publish-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if(!currentUser) return;

        const title = document.getElementById('vid-title').value;
        const url = document.getElementById('vid-url').value;
        let thumb = document.getElementById('vid-thumb').value || "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=300";

        const newVideo = {
            id: Date.now(),
            title: title,
            url: url,
            thumbnail: thumb,
            creator: currentUser,
            likes: 0,
            comments: []
        };

        const res = await fetch('/api/videos', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: 'upload', video: newVideo })
        });

        if(res.ok) {
            document.getElementById('publish-form').reset();
            loadContent();
            alert("Video online!");
        }
    });

    function populateAdminSelect() {
        adminUserSelect.innerHTML = '<option value="">Select a member...</option>';
        allMembers.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.username;
            opt.innerText = m.nickname;
            adminUserSelect.appendChild(opt);
        });
    }

    // PANEL FUFU (AJOUTER / RETIRER LA VÉRIFICATION DANS LA BDD)
    document.getElementById('admin-verify-btn').addEventListener('click', async () => {
        const selectedTarget = adminUserSelect.value;
        if(!selectedTarget) return alert("Select someone.");

        const isCurrentlyVerified = verifiedUsersList.includes(selectedTarget.toLowerCase());
        
        const res = await fetch('/api/videos', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                action: 'toggle-verify',
                targetUser: selectedTarget.toLowerCase(),
                isVerified: !isCurrentlyVerified
            })
        });

        if(res.ok) {
            alert("Verification updated in database!");
            loadContent();
        }
    });

    loadContent();
});
