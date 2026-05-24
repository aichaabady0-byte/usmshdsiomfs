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

    if (btnConfigWebsite) {
        btnConfigWebsite.addEventListener('click', () => {
            switchView(viewAdmin);
        });
    }

    function switchView(targetView) {
        if (viewProfile) viewProfile.classList.add('hidden');
        if (viewChat) viewChat.classList.add('hidden');
        if (viewAdmin) viewAdmin.classList.add('hidden');
        if (targetView) targetView.classList.remove('hidden');
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
            
            if (!response.ok) {
                const textError = await response.text();
                console.error("Détails erreur serveur :", textError);
                if (usersList) usersList.innerHTML = `<li style="color:red;padding:10px;">Erreur de configuration.</li>`;
                return;
            }

            const data = await response.json();
            if (data.error) return;

            // INITIALISATION DE FIREBASE
            if (data.firebaseConfig) {
                const app = initializeApp(data.firebaseConfig);
                auth = getAuth(app);
                database = getDatabase(app);
                setupAuthListener();
                listenToGlobalData();
            }

        } catch (error) {
            console.error("Crash initialisation:", error);
            if (usersList) usersList.innerHTML = `<li style="color:red;">Erreur de connexion.</li>`;
        }
    }

    // Écoute les Salons et les Membres depuis Firebase de manière instantanée
    function listenToGlobalData() {
        if (!database) return;

        // 1. Charger les salons textuels
        onValue(ref(database, 'channels'), (snapshot) => {
            if (snapshot.exists()) {
                renderChannels(Object.values(snapshot.val()));
            } else {
                // Salons par défaut si Firebase est vide
                const defaultChannels = [
                    { id: "cat-1", name: "TEXT CHANNELS", type: 4, position: 1 },
                    { id: "general", name: "general", type: 0, parentId: "cat-1", position: 2 }
                ];
                renderChannels(defaultChannels);
            }
        });

        // 2. Charger les membres connectés
        onValue(ref(database, 'users'), (snapshot) => {
            if (snapshot.exists()) {
                allMembers = Object.values(snapshot.val()).map(u => ({
                    id: u.uid,
                    username: u.username,
                    nickname: u.username,
                    avatar: "https://discord.com/assets/c09a43a372ba40e85774.png",
                    status: "online",
                    roles: u.badges ? u.badges.map(b => ({ name: b, color: b === "Admin" ? "red" : "#0099e5" })) : []
                }));
                renderList(allMembers);
            }
        });
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
        if (activeChannelName) activeChannelName.innerText = channel.name;
        switchView(viewChat);
        if (database) listenToChannelMessages(channel.id);
    }

    function renderList(members) {
        if (!usersList) return;
        usersList.innerHTML = ""; 

        members.forEach(member => {
            const li = document.createElement('li');
            li.classList.add('user-item');
            const mainRoleName = member.roles.length > 0 ? member.roles[0].name : translations[currentLang].noRole;

            li.innerHTML = `
                <img class="mini-avatar" src="${member.avatar}" alt="avatar">
                <div class="user-info">
                    <span class="nickname">${member.nickname}</span>
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

        const rolesHtml = member.roles.map(role => {
            return `<span class="discord-role" style="background-color: ${role.color || '#0099e5'}; color: #fff;">${role.name}</span>`;
        }).join(' ');

        detailsBox.innerHTML = `
            <div class="profile-header">
                <img class="big-avatar" src="${member.avatar}" alt="Avatar">
                <div class="profile-title"><h2>${member.nickname}</h2><span>@${member.username}</span></div>
            </div>
            <div class="info-row"><span class="info-label">Status:</span> <strong>${t.status[member.status] || member.status}</strong></div>
            <div class="info-row"><span class="info-label">Roles:</span><div class="roles-container">${rolesHtml || `<span>${t.noRole}</span>`}</div></div>
        `;
    }

    // --- MESSAGERIE EN TEMPS RÉEL ---
    function listenToChannelMessages(channelId) {
        if (!chatMessages) return;
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
                        badgeCode = ` <i class="fa-solid fa-circle-check" style="color:#0099e5;" title="Verified"></i><span class="web-badge" style="background:red;color:white;padding:2px 4px;font-size:10px;border-radius:3px;margin-left:4px;">Admin</span>`;
                    } else if (msg.badges) {
                        msg.badges.forEach(b => { badgeCode += ` <span class="web-badge" style="background:#0099e5;color:white;padding:2px 4px;font-size:10px;border-radius:3px;margin-left:4px;">${b}</span>`; });
                    }

                    line.innerHTML = `<span class="chat-tag-bot">[WEB]</span> <span class="chat-author" style="font-weight:bold;">${msg.author}</span>${badgeCode}: <span>${msg.text}</span>`;
                    chatMessages.appendChild(line);
                });
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        });
    }

    if (btnSendMessage) btnSendMessage.addEventListener('click', sendTextMessage);
    if (chatInputText) {
        chatInputText.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendTextMessage(); });
    }

    async function sendTextMessage() {
        if(!chatInputText) return;
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
    }

    // --- GESTION DES COMPTES AUTH ---
    const btnRegister = document.getElementById('btn-register');
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    const authError = document.getElementById('auth-error');

    if (btnRegister) {
        btnRegister.addEventListener('click', async () => {
            if (!auth || !database) return;
            const user = document.getElementById('auth-username').value.trim();
            const pass = document.getElementById('auth-password').value.trim();
            if(!user || !pass) return;

            const userCheck = await get(child(ref(database), `users/${user.toLowerCase()}`));
            if (userCheck.exists()) {
                if (authError) authError.innerText = "Username already taken.";
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
                if (authError) authError.innerText = "";
            } catch (err) {
                if (authError) authError.innerText = "Password too short or network error.";
            }
        });
    }

    if (btnLogin) {
        btnLogin.addEventListener('click', async () => {
            if (!auth) return;
            const user = document.getElementById('auth-username').value.trim();
            const pass = document.getElementById('auth-password').value.trim();
            if(!user || !pass) return;

            try {
                const fakeEmail = `${user.toLowerCase()}@usmscord.retro`;
                await signInWithEmailAndPassword(auth, fakeEmail, pass);
                if (authError) authError.innerText = "";
            } catch (err) {
                if (authError) authError.innerText = "Invalid credentials.";
            }
        });
    }

    if (btnLogout) btnLogout.addEventListener('click', () => { if (auth) signOut(auth); });

    function setupAuthListener() {
        onAuthStateChanged(auth, async (user) => {
            const loggedOutDiv = document.getElementById('auth-logged-out');
            const loggedInDiv = document.getElementById('auth-logged-in');
            const userDisplay = document.getElementById('current-user-display');
            const badgeSpan = document.getElementById('user-verified-badge');

            if (user) {
                const emailPrefix = user.email.split('@')[0];
                const snapshot = await get(child(ref(database), `users/${emailPrefix}`));
                if(snapshot.exists()) {
                    currentUserData = snapshot.val();
                    
                    if (loggedOutDiv) loggedOutDiv.classList.add('hidden');
                    if (loggedInDiv) loggedInDiv.classList.remove('hidden');
                    if (userDisplay) userDisplay.innerText = currentUserData.username;
                    
                    if (badgeSpan) {
                        if(currentUserData.username.toLowerCase() === 'fufu') {
                            badgeSpan.innerHTML = ` <i class="fa-solid fa-circle-check" style="color:#0099e5;"></i> <i class="fa-solid fa-user-shield" style="color:red;"></i>`;
                        } else {
                            badgeSpan.innerHTML = "";
                        }
                    }

                    if (chatInputText) chatInputText.disabled = false;
                    if (btnSendMessage) btnSendMessage.disabled = false;

                    if (currentUserData.isAdmin === true && btnConfigWebsite) btnConfigWebsite.classList.remove('hidden');
                    else if (btnConfigWebsite) btnConfigWebsite.classList.add('hidden');
                }
            } else {
                currentUserData = null;
                if (loggedOutDiv) loggedOutDiv.classList.remove('hidden');
                if (loggedInDiv) loggedInDiv.classList.add('hidden');
                if (btnConfigWebsite) btnConfigWebsite.classList.add('hidden');
                if (chatInputText) chatInputText.disabled = true;
                if (btnSendMessage) btnSendMessage.disabled = true;
                switchView(viewProfile);
            }
        });
    }

    // --- PANEL D'ADMINISTRATION PROPRE ---
    const btnGiveBadge = document.getElementById('btn-give-badge');
    const btnGiveAdmin = document.getElementById('btn-give-admin');

    if (btnGiveBadge) {
        btnGiveBadge.addEventListener('click', async () => {
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
                alert("Badge attribué avec succès !");
            }
        });
    }

    if (btnGiveAdmin) {
        btnGiveAdmin.addEventListener('click', async () => {
            if (!database) return;
            const targetUser = document.getElementById('badge-target-user').value.trim().toLowerCase();
            if(!targetUser) return;

            const snap = await get(child(ref(database), `users/${targetUser}`));
            if(snap.exists()){
                const u = snap.val();
                u.isAdmin = true;
                await set(ref(database, `users/${targetUser}`), u);
                alert("Utilisateur promu Administrateur Web !");
            }
        });
    }

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
