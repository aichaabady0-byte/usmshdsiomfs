import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getDatabase, ref, set, get, child, push, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

document.addEventListener("DOMContentLoaded", () => {
    
    // Éléments HTML structurels
    const usersList = document.getElementById('users-list');
    const detailsBox = document.getElementById('details-box');
    const langSelect = document.getElementById('lang-select');
    const channelsTree = document.getElementById('channels-tree');
    
    // Éléments de vues (Panels de droite)
    const viewProfile = document.getElementById('view-profile');
    const viewChat = document.getElementById('view-chat');
    const viewAdmin = document.getElementById('view-admin');
    const btnConfigWebsite = document.getElementById('btn-config-website');

    // Éléments Chat & Firebase
    const chatMessages = document.getElementById('chat-messages');
    const chatInputText = document.getElementById('chat-input-text');
    const btnSendMessage = document.getElementById('btn-send-message');
    const activeChannelName = document.getElementById('active-channel-name');

    let allMembers = [];
    let currentLang = 'en';
    let activeChannelId = null;
    let currentUserData = null;
    
    // Variables Firebase qui seront initialisées dynamiquement
    let auth, database;

    // --- SYSTÈME D'ONGLETS DE LA SIDEBAR GAUCHE ---
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(btn.getAttribute('data-target')).classList.add('active');
        });
    });

    btnConfigWebsite.addEventListener('click', () => {
        switchView(viewAdmin);
    });

    function switchView(targetView) {
        viewProfile.classList.add('hidden');
        viewChat.classList.add('hidden');
        viewAdmin.classList.add('hidden');
        targetView.classList.remove('hidden');
    }

    const translations = {
        en: { tagline: "Broadcast Yourself™", loading: "Loading...", noRole: "No role", status: { online: "Online", idle: "Idle", dnd: "Do Not Disturb", offline: "Offline" } },
        fr: { tagline: "Broadcast Yourself™", loading: "Chargement...", noRole: "Aucun rôle", status: { online: "En ligne", idle: "Absent", dnd: "Ne pas déranger", offline: "Hors ligne" } },
        zh: { tagline: "Broadcast Yourself™", loading: "正在加载...", noRole: "无身份组", status: { online: "在线", idle: "闲置", dnd: "请勿打扰", offline: "离线" } }
    };

    // --- CHARGEMENT INITIAL (FETCH CONFIG + DISCORD) ---
    async function initRetroHub() {
        try {
            if (usersList) usersList.innerHTML = `<li>${translations[currentLang].loading}</li>`;
            
            const response = await fetch('/api-members');
            const data = await response.json();
            
            if (data.error) return;

            // INITIALISATION DYNAMIQUE DE FIREBASE VIA L'API VERCEL
            if (data.firebaseConfig) {
                const app = initializeApp(data.firebaseConfig);
                auth = getAuth(app);
                database = getDatabase(app);
                setupAuthListener(); // On lance l'écoute des comptes une fois Firebase prêt
            }

            // Remplissage infos serveur
            if(data.guildInfo) {
                document.getElementById('srv-name').innerText = data.guildInfo.name || "USMS Server";
                document.getElementById('srv-id').innerText = data.guildInfo.id || "0000";
                document.getElementById('srv-roles').innerText = data.guildInfo.rolesCount || "0";
            }

            if(data.channels) renderChannels(data.channels);

            allMembers = data.members || data;
            renderList(allMembers);
        } catch (error) {
            console.error(error);
        }
    }

    function renderChannels(channels) {
        if (!channelsTree) return;
        channelsTree.innerHTML = "";

        const categories = channels.filter(c => c.type === 4).sort((a,b) => a.position - b.position);
        const textChannels = channels.filter(c => c.type === 0).sort((a,b) => a.position - b.position);

        categories.forEach(cat => {
            const catDiv = document.createElement('div');
            catDiv.classList.add('category-row');
            catDiv.innerHTML = `<i class="fa-solid fa-caret-down"></i> ${cat.name}`;
            channelsTree.appendChild(catDiv);

            const children = textChannels.filter(c => c.parentId === cat.id);
            children.forEach(chan => {
                const chanLink = document.createElement('a');
                chanLink.classList.add('channel-click');
                chanLink.innerHTML = `<i class="fa-solid fa-hashtag"></i> ${chan.name}`;
                chanLink.addEventListener('click', () => selectChannel(chan));
                channelsTree.appendChild(chanLink);
            });
        });
    }

    function selectChannel(channel) {
        document.querySelectorAll('.channel-click').forEach(el => el.classList.remove('active'));
        activeChannelId = channel.id;
        activeChannelName.innerText = channel.name;
        switchView(viewChat);
        if (database) listenToChannelMessages(channel.id);
    }

    function renderList(members) {
        if (!usersList) return;
        usersList.innerHTML = ""; 

        const sortedMembers = [...members].sort((a, b) => {
            const aHasRoles = a.roles && a.roles.length > 0;
            const bHasRoles = b.roles && b.roles.length > 0;
            return (aHasRoles && !bHasRoles) ? -1 : (!aHasRoles && bHasRoles) ? 1 : 0;
        });

        sortedMembers.forEach(member => {
            const li = document.createElement('li');
            li.classList.add('user-item');
            const mainRoleName = member.roles.length > 0 ? member.roles[0].name : translations[currentLang].noRole;
            const isBot = member.username.toLowerCase().includes('bot') || mainRoleName.toLowerCase().includes('bot');
            const botBadge = isBot ? `<span class="app-badge">APP</span>` : '';

            li.innerHTML = `
                <img class="mini-avatar" src="${member.avatar}" alt="avatar" onerror="this.src='https://discord.com/assets/c09a43a372ba40e85774.png'">
                <div class="user-info">
                    <span class="nickname">${member.nickname} ${botBadge}</span>
                    <span class="role-tag">${mainRoleName}</span>
                </div>
            `;
            li.addEventListener('click', () => { switchView(viewProfile); selectUser(member, li); });
            usersList.appendChild(li);
        });
    }

    function selectUser(member, element) {
        if (!detailsBox) return;
        document.querySelectorAll('.user-item').forEach(item => item.classList.remove('active'));
        element.classList.add('active');
        const t = translations[currentLang];
        const isBot = member.username.toLowerCase().includes('bot');
        const botBadge = isBot ? `<span class="app-badge">APP</span>` : '';

        const rolesHtml = member.roles.map(role => {
            const roleColor = role.color || '#99aab5';
            const isWhite = roleColor.toLowerCase() === '#ffffff' || roleColor.toLowerCase() === '#fff';
            return `<span class="discord-role" style="background-color: ${roleColor}; color: ${isWhite ? '#000':'#fff'};">${role.name}</span>`;
        }).join(' ');

        detailsBox.innerHTML = `
            <div class="profile-header">
                <img class="big-avatar" src="${member.avatar}" alt="Avatar">
                <div class="profile-title"><h2>${member.nickname} ${botBadge}</h2><span>@${member.username}</span></div>
            </div>
            <div class="info-row"><span class="info-label">Status:</span> <strong>${t.status[member.status] || member.status}</strong></div>
            <div class="info-row"><span class="info-label">ID:</span> <span style="font-family:monospace;">${member.id}</span></div>
            <div class="info-row"><span class="info-label">Roles:</span><div class="roles-container">${rolesHtml || `<span>${t.noRole}</span>`}</div></div>
        `;
    }

    // --- MESSAGERIE EN TEMPS RÉEL ---
    function listenToChannelMessages(channelId) {
        const messagesRef = ref(database, `messages/${channelId}`);
        onValue(messagesRef, (snapshot) => {
            chatMessages.innerHTML = "";
            if (snapshot.exists()) {
                const data = snapshot.val();
                Object.values(data).forEach(msg => {
                    const line = document.createElement('div');
                    line.classList.add('chat-line');
                    
                    let badgeCode = "";
                    if (msg.author.toLowerCase() === "fufu") {
                        badgeCode = ` <i class="fa-solid fa-circle-check" style="color:#0099e5;" title="Verified"></i><span class="web-badge" style="background:red;">Admin</span>`;
                    } else if (msg.badges) {
                        msg.badges.forEach(b => { badgeCode += ` <span class="web-badge">${b}</span>`; });
                    }

                    line.innerHTML = `<span class="chat-tag-bot">[WEB USER]</span> <span class="chat-author">${msg.author}</span>${badgeCode}: <span>${msg.text}</span>`;
                    chatMessages.appendChild(line);
                });
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        });
    }

    btnSendMessage.addEventListener('click', sendTextMessage);
    chatInputText.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendTextMessage(); });

    async function sendTextMessage() {
        const text = chatInputText.value.trim();
        if(!text || !activeChannelId || !currentUserData || !database) return;

        const msgData = {
            author: currentUserData.username,
            text: text,
            timestamp: Date.now(),
            badges: currentUserData.badges || []
        };

        await push(ref(database, `messages/${activeChannelId}`), msgData);
        chatInputText.value = "";

        fetch('/api-members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'sendMessage',
                channelId: activeChannelId,
                content: `[WEB USER] ${currentUserData.username}: ${text}`,
                username: currentUserData.username
            })
        }).catch(err => console.error(err));
    }

    // --- GESTION DES COMPTES AUTH ---
    const btnRegister = document.getElementById('btn-register');
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    const authError = document.getElementById('auth-error');

    btnRegister.addEventListener('click', async () => {
        if (!auth || !database) return;
        const user = document.getElementById('auth-username').value.trim();
        const pass = document.getElementById('auth-password').value.trim();
        if(!user || !pass) return;

        const userCheck = await get(child(ref(database), `users/${user.toLowerCase()}`));
        if (userCheck.exists()) {
            authError.innerText = "Username already taken.";
            return;
        }

        try {
            const fakeEmail = `${user.toLowerCase()}@usmscord.retro`;
            const userCredential = await createUserWithEmailAndPassword(auth, fakeEmail, pass);
            
            const isFufu = user.toLowerCase() === "fufu";
            const newUserData = {
                username: user,
                uid: userCredential.user.uid,
                isAdmin: isFufu,
                badges: isFufu ? ["Admin"] : []
            };

            await set(ref(database, `users/${user.toLowerCase()}`), newUserData);
            authError.innerText = "";
        } catch (err) {
            authError.innerText = "Error during registration.";
        }
    });

    btnLogin.addEventListener('click', async () => {
        if (!auth) return;
        const user = document.getElementById('auth-username').value.trim();
        const pass = document.getElementById('auth-password').value.trim();
        if(!user || !pass) return;

        try {
            const fakeEmail = `${user.toLowerCase()}@usmscord.retro`;
            await signInWithEmailAndPassword(auth, fakeEmail, pass);
            authError.innerText = "";
        } catch (err) {
            authError.innerText = "Invalid credentials.";
        }
    });

    if (btnLogout) btnLogout.addEventListener('click', () => { if (auth) signOut(auth); });

    function setupAuthListener() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                const emailPrefix = user.email.split('@')[0];
                const snapshot = await get(child(ref(database), `users/${emailPrefix}`));
                if(snapshot.exists()) {
                    currentUserData = snapshot.val();
                    
                    document.getElementById('auth-logged-out').classList.add('hidden');
                    document.getElementById('auth-logged-in').classList.remove('hidden');
                    document.getElementById('current-user-display').innerText = currentUserData.username;
                    
                    const badgeSpan = document.getElementById('user-verified-badge');
                    if(currentUserData.username.toLowerCase() === 'fufu') {
                        badgeSpan.innerHTML = ` <i class="fa-solid fa-circle-check" style="color:#0099e5;"></i> <i class="fa-solid fa-user-shield" style="color:red;"></i>`;
                    } else {
                        badgeSpan.innerHTML = "";
                    }

                    chatInputText.disabled = false;
                    btnSendMessage.disabled = false;

                    if (currentUserData.isAdmin === true) btnConfigWebsite.classList.remove('hidden');
                    else btnConfigWebsite.classList.add('hidden');
                }
            } else {
                currentUserData = null;
                document.getElementById('auth-logged-out').classList.remove('hidden');
                document.getElementById('auth-logged-in').classList.add('hidden');
                btnConfigWebsite.classList.add('hidden');
                chatInputText.disabled = true;
                btnSendMessage.disabled = true;
                switchView(viewProfile);
            }
        });
    }

    // --- PANEL D'ADMINISTRATION ---
    document.getElementById('btn-execute-mod').addEventListener('click', () => {
        const userId = document.getElementById('mod-target-id').value.trim();
        const action = document.getElementById('mod-action').value;
        if(!userId) return;

        fetch('/api-members', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action, userId: userId })
        }).then(res => alert("Action sent to Discord bot.")).catch(err => console.error(err));
    });

    document.getElementById('btn-give-badge').addEventListener('click', async () => {
        if (!database) return;
        const targetUser = document.getElementById('badge-target-user').value.trim().toLowerCase();
        const badge = document.getElementById('badge-name').value.trim();
        if(!targetUser || !badge) return;

        const snap = await get(child(ref(database), `users/${targetUser}`));
        if(snap.exists()){
            const u = snap.val();
            if(!u.badges) u.badges = [];
            u.badges.push(badge);
            await set(ref(database, `users/${targetUser}`), u);
            alert("Badge given!");
        }
    });

    document.getElementById('btn-give-admin').addEventListener('click', async () => {
        if (!database) return;
        const targetUser = document.getElementById('badge-target-user').value.trim().toLowerCase();
        if(!targetUser) return;

        const snap = await get(child(ref(database), `users/${targetUser}`));
        if(snap.exists()){
            const u = snap.val();
            u.isAdmin = true;
            await set(ref(database, `users/${targetUser}`), u);
            alert("User promoted to Web Admin!");
        }
    });

    if (langSelect) {
        langSelect.addEventListener('change', (e) => {
            currentLang = e.target.value;
            const flagImg = document.getElementById('current-flag');
            const flagUrls = { en: "https://flagcdn.com/16x12/us.png", fr: "https://flagcdn.com/16x12/fr.png", zh: "https://flagcdn.com/16x12/cn.png" };
            if (flagImg && flagUrls[currentLang]) flagImg.src = flagUrls[currentLang];
            if (allMembers.length > 0) renderList(allMembers);
        });
    }

    initRetroHub();
});
