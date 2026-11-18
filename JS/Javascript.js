/* ====================================================================
   SANTUARIO CARMESÍ v3 — Kevin & Dominic
   Mejoras: crop con cuadricula tactil, edicion video completa, Spotify auto,
   15 juegos nuevos, chat, filtros env/recib, constelaciones masivas
   ==================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  // ================= CONFIGURACIÓN FIREBASE + CLOUDINARY =================
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCgensFor92VXDMcQypSu_6JfxpTb-oURII",
    authDomain: "santuario-carmesi.firebaseapp.com",
    projectId: "santuario-carmesi",
    storageBucket: "santuario-carmesi.appspot.com",
    messagingSenderId: "986324978755",
    appId: "1:986324978755:web:2b15ebcaa3428ca45098f6"
  };
  const CLOUDINARY_CONFIG = { cloudName: "", uploadPreset: "santuario" };

  // Inicializar Firebase de forma segura (NO bloquea la app si falla)
  let fbDB = null, fbReady = false;
  try {
    if (typeof firebase !== "undefined") {
      firebase.initializeApp(FIREBASE_CONFIG);
      fbDB = firebase.firestore();
      fbReady = true;
      console.log("Firebase conectado");
    }
  } catch (e) { console.log("Firebase no disponible, usando local:", e.message); }

  const CLOUDINARY_ENABLED = CLOUDINARY_CONFIG.cloudName.length > 3;

  // Sincronizar con Firestore en segundo plano (no bloquea)
  function fbSyncKey(key) {
    if (!fbDB) return;
    try {
      const value = localStorage.getItem(key);
      if (value) fbDB.collection("santuario").doc(key).set({ value, timestamp: Date.now() }).catch(()=>{});
    } catch(e) {}
  }

  function fbDownloadAllData() {
    if (!fbDB) return Promise.resolve();
    return fbDB.collection("santuario").get().then((snapshot) => {
      snapshot.forEach((doc) => {
        const key = doc.id;
        if (!localStorage.getItem(key)) localStorage.setItem(key, doc.data().value);
      });
    }).catch(() => {});
  }

  function fbListenChat(cb) {
    if (!fbDB) return;
    fbDB.collection("santuario").doc("kd_chat_messages").onSnapshot((doc) => {
      if (doc.exists) { localStorage.setItem("kd_chat_messages", doc.data().value); cb(); }
    }).catch?.(()=>{});
  }

  function fbListenProfiles(cb) {
    if (!fbDB) return;
    ["kd_profile_kevin", "kd_profile_dominic"].forEach((key) => {
      fbDB.collection("santuario").doc(key).onSnapshot((doc) => {
        if (doc.exists) { localStorage.setItem(key, doc.data().value); cb(); }
      }).catch?.(()=>{});
    });
  }

  // Cloudinary media upload
  const FbMediaStore = {
    async save(id, data) {
      if (!CLOUDINARY_ENABLED) return false;
      try {
        const formData = new FormData();
        formData.append("file", data);
        formData.append("upload_preset", CLOUDINARY_CONFIG.uploadPreset);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/auto/upload`, { method: "POST", body: formData });
        const result = await res.json();
        if (result.secure_url && fbDB) {
          fbDB.collection("media").doc(id).set({ url: result.secure_url }).catch(()=>{});
        }
        return result.secure_url || false;
      } catch (e) { return false; }
    },
    async get(id) {
      if (!CLOUDINARY_ENABLED || !fbDB) return null;
      try {
        const doc = await fbDB.collection("media").doc(id).get();
        if (doc.exists) return doc.data().url;
      } catch (e) {}
      return null;
    },
    async delete(id) { if (fbDB) { try { await fbDB.collection("media").doc(id).delete(); } catch(e){} } }
  };

  // Override localStorage.setItem para sincronizar con Firebase
  if (fbReady) {
    const _origSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key, value) {
      _origSetItem(key, value);
      if (key && key.startsWith("kd_") && !key.startsWith("kd_content_cleaned")) {
        try { fbSyncKey(key); } catch(e) {}
      }
    };
  }

  let currentUser = null, currentMode = "editor";
  const VALID_USERS = ["Kevin", "Dominic"];
  const VALID_PASS = "27-1-2026";
  const otherUser = (u) => (u === "Kevin" ? "Dominic" : "Kevin");
  const editKey = (s) => `kd_${s}_for_${otherUser(currentUser).toLowerCase()}`;
  const viewKey = (s) => `kd_${s}_for_${currentUser.toLowerCase()}`;
  const profileKey = (p) => `kd_profile_${p.toLowerCase()}`;

  // ================= INDEXEDDB =================
  const MediaStore = {
    dbName: "kd_sanctuary_v3", storeName: "media", db: null, ready: null,
    init() { if (this.ready) return this.ready; this.ready = new Promise((res, rej) => { const r = indexedDB.open(this.dbName, 1); r.onupgradeneeded = (e) => { const db = e.target.result; if (!db.objectStoreNames.contains(this.storeName)) db.createObjectStore(this.storeName, { keyPath: "id" }); }; r.onsuccess = (e) => { this.db = e.target.result; res(); }; r.onerror = () => rej(r.error); }); return this.ready; },
    save(id, data) { return new Promise((res, rej) => { if (!this.db) return rej(); const tx = this.db.transaction(this.storeName, "readwrite"); tx.objectStore(this.storeName).put({ id, data }); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); },
    get(id) { return new Promise((res, rej) => { if (!this.db) return rej(); const tx = this.db.transaction(this.storeName, "readonly"); const r = tx.objectStore(this.storeName).get(id); r.onsuccess = () => res(r.result ? r.result.data : null); r.onerror = () => rej(r.error); }); },
    delete(id) { return new Promise((res, rej) => { if (!this.db) return rej(); const tx = this.db.transaction(this.storeName, "readwrite"); tx.objectStore(this.storeName).delete(id); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
  };
  MediaStore.init();

  // Override MediaStore para usar Firebase Storage además de IndexedDB
  if (fbReady) {
    const _origMediaSave = MediaStore.save.bind(MediaStore);
    const _origMediaGet = MediaStore.get.bind(MediaStore);
    const _origMediaDelete = MediaStore.delete.bind(MediaStore);
    MediaStore.save = async function(id, data) { try { await _origMediaSave(id, data); } catch(e){} try { await FbMediaStore.save(id, data); } catch(e){} };
    MediaStore.get = async function(id) { try { const u = await FbMediaStore.get(id); if (u) return u; } catch(e){} return _origMediaGet(id); };
    MediaStore.delete = async function(id) { try { await _origMediaDelete(id); } catch(e){} try { await FbMediaStore.delete(id); } catch(e){} };
  }

  // ================= DOM =================
  const loginScreen = document.getElementById("login-screen"), mainApp = document.getElementById("main-app");
  const loginForm = document.getElementById("login-form"), passwordInput = document.getElementById("password-input");
  const loginError = document.getElementById("login-error"), welcomeUser = document.getElementById("welcome-user");
  const profileModeLabel = document.getElementById("profile-mode-label"), profileBadge = document.getElementById("profile-badge");
  const modeIndicator = document.getElementById("mode-indicator"), modeIndicatorText = document.getElementById("mode-indicator-text");
  const logoutBtn = document.getElementById("logout-btn");
  const mobileMenuBtn = document.getElementById("mobile-menu-btn"), navLinksContainer = document.getElementById("nav-links");
  const navButtons = document.querySelectorAll(".nav-btn[data-target]");
  const tabSections = document.querySelectorAll(".tab-section");

  // ================= LOGIN =================
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const sel = document.querySelector('input[name="username"]:checked');
    const modeR = document.querySelector('input[name="mode"]:checked');
    const pass = passwordInput.value.trim();
    if (!sel) { loginError.textContent = "Selecciona Kevin o Dominic."; return; }
    if (!pass) { loginError.textContent = "Ingresa la fecha."; return; }
    const user = sel.value, mode = modeR ? modeR.value : "editor";
    if (VALID_USERS.includes(user) && pass === VALID_PASS) {
      sessionStorage.setItem("gothic_user", user); sessionStorage.setItem("gothic_mode", mode);
      loginError.textContent = ""; unlockApp(user, mode);
    } else { loginError.textContent = "Fecha incorrecta."; passwordInput.value = ""; }
  });

  function unlockApp(user, mode) {
    currentUser = user; currentMode = mode;
    welcomeUser.textContent = user;
    const other = otherUser(user);
    profileModeLabel.textContent = `${user} → ${other}`;
    const dot = profileBadge.querySelector(".dot");
    dot.style.background = user === "Kevin" ? "var(--profile-kevin)" : "var(--profile-dominic)";
    profileBadge.style.display = "inline-flex";
    modeIndicatorText.textContent = mode === "editor" ? "✎ Editor" : "👁 Lectura";
    modeIndicator.className = "mode-badge " + mode;
    document.body.classList.toggle("reader-mode", mode === "reader");
    loginScreen.classList.add("hidden"); mainApp.classList.remove("hidden");
    // Firebase: sincronizar en segundo plano (NO bloquear la app si falla)
    if (fbReady) {
      fbDownloadAllData().then(() => {
        try { fbListenChat(() => renderChat()); } catch(e){}
        try { fbListenProfiles(() => renderProfiles()); } catch(e){}
      }).catch(e => console.error("Firebase sync error (no bloquea):", e));
    }
    initProfileContextBanner(); renderProfiles(); initAllSections();
    drawConstellationMap(); drawMaze(); startConstellationAnimation(); renderChat();
  }

  logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem("gothic_user"); sessionStorage.removeItem("gothic_mode");
    currentUser = null; currentMode = "editor";
    mainApp.classList.add("hidden"); loginScreen.classList.remove("hidden");
    passwordInput.value = ""; navLinksContainer.classList.remove("open");
    profileBadge.style.display = "none"; document.body.classList.remove("reader-mode");
    stopConstellationAnimation();
  });

  // ================= NAVEGACIÓN + MENÚ HAMBURGUESA ARREGLADO =================
  let tabHistory = [];
  // El botón hamburguesa SOLO abre/cierra el menú principal
  mobileMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    navLinksContainer.classList.toggle("open");
  });
  // Cerrar menú al hacer clic fuera (solo móvil)
  document.addEventListener("click", (e) => {
    if (window.innerWidth <= 1120 && navLinksContainer.classList.contains("open")) {
      if (!navLinksContainer.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
        navLinksContainer.classList.remove("open");
      }
    }
  });

  // Dropdowns: solo se abren con clic en el trigger (no con hover en móvil)
  document.querySelectorAll(".dropdown-trigger").forEach((trigger) => {
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const parent = trigger.parentElement;
      // Cerrar otros dropdowns
      document.querySelectorAll(".nav-dropdown").forEach((d) => { if (d !== parent) d.classList.remove("open"); });
      parent.classList.toggle("open");
    });
  });

  // Pausar todos los videos y Spotify al cambiar de pestaña
  function pauseAllMedia() {
    document.querySelectorAll("video").forEach((v) => { try { v.pause(); } catch(e){} });
    // Spotify: remover y volver a añadir src para forzar detención
    document.querySelectorAll(".spotify-embed iframe").forEach((f) => {
      const src = f.src;
      f.src = "about:blank";
      setTimeout(() => { f.src = src; }, 50);
    });
  }

  // Pausar al salir de la página o cambiar de pestaña del navegador
  document.addEventListener("visibilitychange", () => { if (document.hidden) pauseAllMedia(); });
  window.addEventListener("blur", () => pauseAllMedia());
  window.addEventListener("beforeunload", () => pauseAllMedia());

  let cameFromArcade = false;

  // Rastrear TODOS los intervals para poder limpiarlos al salir de juegos
  const allIntervals = new Set();
  const allTimeouts = new Set();
  const _origSetInterval = window.setInterval.bind(window);
  const _origSetTimeout = window.setTimeout.bind(window);
  window.setInterval = function(fn, delay, ...args) { const id = _origSetInterval(fn, delay, ...args); allIntervals.add(id); return id; };
  window.setTimeout = function(fn, delay, ...args) { const id = _origSetTimeout(fn, delay, ...args); allTimeouts.add(id); return id; };
  // Override clearInterval to remove from tracking
  const _origClearInterval = window.clearInterval.bind(window);
  window.clearInterval = function(id) { allIntervals.delete(id); _origClearInterval(id); };

  function stopAllGames() {
    // Limpiar TODOS los intervals y timeouts
    allIntervals.forEach((id) => _origClearInterval(id));
    allIntervals.clear();
    allTimeouts.forEach((id) => clearTimeout(id));
    allTimeouts.clear();
    document.onkeydown = null;
    // Recrear intervals persistentes necesarios
    _origSetInterval(updateCounter, 1000);
    _origSetInterval(checkChatUpdates, 3000);
  }

  window.switchTab = function (targetId) {
    pauseAllMedia();
    stopAllGames();
    const current = document.querySelector(".tab-section.active");
    if (current && current.id !== targetId) tabHistory.push(current.id);
    navButtons.forEach((b) => b.classList.toggle("active", b.dataset.target === targetId));
    tabSections.forEach((s) => s.classList.toggle("active", s.id === targetId));
    navLinksContainer.classList.remove("open");
    document.querySelectorAll(".nav-dropdown").forEach((d) => d.classList.remove("open"));
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (targetId === "constelaciones") { drawConstellationMap(); startConstellationAnimation(); }
    else stopConstellationAnimation();
    if (targetId === "laberinto") drawMaze();
    if (targetId === "fotos") renderPhotos();
    if (targetId === "videos") renderVideos();
    if (targetId === "canciones") renderSongs();
    if (targetId === "sorpresas") renderSorpresas();
    if (targetId === "perfiles") renderProfiles();
    if (targetId === "chat") renderChat();
  };

  window.goBack = function () {
    // Si venimos del arcade, volver a él
    if (cameFromArcade) {
      cameFromArcade = false;
      openGamesArcade();
      return;
    }
    if (tabHistory.length > 0) {
      const prev = tabHistory.pop();
      const current = document.querySelector(".tab-section.active");
      if (current) tabHistory.push(current.id);
      switchTabInternal(prev); tabHistory.pop();
    } else switchTab("inicio");
  };

  function switchTabInternal(id) {
    navButtons.forEach((b) => b.classList.toggle("active", b.dataset.target === id));
    tabSections.forEach((s) => s.classList.toggle("active", s.id === id));
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (id === "constelaciones") { drawConstellationMap(); startConstellationAnimation(); }
    if (id === "laberinto") drawMaze();
  }

  navButtons.forEach((b) => b.addEventListener("click", () => switchTab(b.dataset.target)));

  // ================= CONTEXTO =================
  function initProfileContextBanner() {
    const b = document.getElementById("profile-context-banner");
    if (!b || !currentUser) return;
    const o = otherUser(currentUser);
    const mt = currentMode === "editor" ? `Editas lo que <strong>${o}</strong> verá.` : `Modo lectura: ves lo que <strong>${o}</strong> preparó.`;
    b.innerHTML = `Estás en el perfil de <strong>${currentUser}</strong>. ${mt}`;
  }
  function setSectionContext(id) {
    const el = document.getElementById(id);
    if (!el || !currentUser) return;
    const o = otherUser(currentUser);
    if (currentMode === "reader") el.innerHTML = `<div class="editor-context-tag">Modo lectura — ves lo que <span class="editor-name">${o}</span> preparó</div>`;
    else el.innerHTML = `<div class="editor-context-tag">Ves lo que <span class="editor-name">${o}</span> preparó · Editas para <span class="editor-name">${o}</span></div>`;
  }

  // ================= FILTROS (Todas/Enviadas/Recibidas) =================
  let mediaFilters = { fotos: "all", videos: "all", canciones: "all" };

  function renderFilterBar(containerId, section, renderFn) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = "";
    const modes = [["all", "Todas"], ["sent", "Enviadas"], ["received", "Recibidas"]];
    modes.forEach(([key, label]) => {
      const btn = document.createElement("button");
      btn.className = "filter-btn" + (mediaFilters[section] === key ? " active" : "");
      btn.textContent = label;
      btn.addEventListener("click", () => { mediaFilters[section] = key; renderFn(); });
      el.appendChild(btn);
    });
  }

  // ================= PERFILES =================
  const DEFAULT_PROFILES = { Kevin: { photo:"",info:"",obsession:"",location:"",phone:"",instagram:"",tiktok:"" }, Dominic: { photo:"",info:"",obsession:"",location:"",phone:"",instagram:"",tiktok:"" } };
  function getProfile(p) { const s = localStorage.getItem(profileKey(p)); if (s) try { return { ...DEFAULT_PROFILES[p], ...JSON.parse(s) }; } catch(e){} localStorage.setItem(profileKey(p), JSON.stringify(DEFAULT_PROFILES[p])); return DEFAULT_PROFILES[p]; }
  function saveProfile(p, d) { localStorage.setItem(profileKey(p), JSON.stringify(d)); }

  function renderProfiles() {
    const grid = document.getElementById("profiles-grid");
    if (!grid || !currentUser) return; grid.innerHTML = "";
    VALID_USERS.forEach((person) => {
      const profile = getProfile(person);
      const isEditable = person === currentUser && currentMode === "editor";
      const card = document.createElement("div");
      card.className = `cathedral-frame profile-card ${isEditable ? "editable" : "read-only"}`;
      const role = person === "Kevin" ? "♚" : "♛";
      const tag = isEditable ? `Tu perfil — edita libremente` : currentMode === "reader" ? `Perfil (lectura)` : `Perfil de ${person}`;
      const photoButtons = isEditable ? `
        <div style="display:flex;gap:0.5rem;justify-content:center;margin-top:0.8rem;flex-wrap:wrap;">
          <label class="btn-crimson" style="font-size:0.75rem;padding:0.5rem 0.8rem;cursor:pointer;">
            <span>📷 Cambiar foto</span>
            <input type="file" accept="image/*" data-person="${person}" data-action="upload" style="display:none;">
          </label>
          <button class="btn-outline" style="font-size:0.75rem;padding:0.5rem 0.8rem;" onclick="editProfilePhoto('${person}')">✎ Editar foto actual</button>
          ${profile.photo ? `<button class="btn-outline" style="font-size:0.75rem;padding:0.5rem 0.8rem;color:var(--crimson-glow);" onclick="deleteProfilePhoto('${person}')">✕ Eliminar foto</button>` : ""}
        </div>` : "";
      card.innerHTML = `<div class="profile-banner-tag ${isEditable ? "" : "readonly"}">${tag}</div><div class="profile-avatar-wrap">${profile.photo ? `<img src="${profile.photo}" alt="${person}">` : `<span class="profile-avatar-placeholder">${person === "Kevin" ? "♚" : "♛"}</span>`}</div><h3 class="profile-name">${person}</h3><p class="profile-role">${role}</p>${photoButtons}<div class="profile-info-list">${pf("Información","info",profile.info,isEditable)}${pf("Obsesión","obsession",profile.obsession,isEditable)}${pf("Ubicación","location",profile.location,isEditable)}${pf("Teléfono","phone",profile.phone,isEditable,"tel")}</div><div class="profile-social-row">${sf("Instagram","instagram",profile.instagram,isEditable)}${sf("TikTok","tiktok",profile.tiktok,isEditable)}</div>`;
      if (isEditable) {
        const fi = card.querySelector('input[data-action="upload"]');
        if (fi) fi.addEventListener("change", async (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = async () => { const id = `profile_${person.toLowerCase()}_photo`; await MediaStore.save(id, r.result); profile.photo = r.result; saveProfile(person, profile); renderProfiles(); }; r.readAsDataURL(f); });
        card.querySelectorAll(".profile-info-value.editable-input").forEach((inp) => inp.addEventListener("blur", () => { profile[inp.dataset.field] = inp.value.trim(); saveProfile(person, profile); }));
        card.querySelectorAll(".social-input").forEach((inp) => inp.addEventListener("blur", () => { profile[inp.dataset.field] = inp.value.trim(); saveProfile(person, profile); }));
      }
      grid.appendChild(card);
    });
  }

  window.editProfilePhoto = async function (person) {
    const profile = getProfile(person);
    if (!profile.photo) { alert("No hay foto de perfil para editar. Sube una primero."); return; }
    // Crear un item temporal para el editor de fotos
    const tempItem = { mediaId: `profile_${person.toLowerCase()}_photo`, date: "Perfil", title: "Foto de Perfil", desc: "", from: currentUser };
    const tempArr = []; // No array needed, we save directly
    // Abrir el editor de fotos con la foto de perfil
    photoEdit.item = { mediaId: `profile_${person.toLowerCase()}_photo`, idx: -1 };
    photoEdit.arr = null; // No array, save directly to profile
    photoEdit.isProfilePhoto = true;
    photoEdit.person = person;
    photoStickers = [];
    ["edit-brightness","edit-contrast","edit-saturate","edit-scale"].forEach((id) => document.getElementById(id).value = 100);
    document.getElementById("edit-rotate").value = 0;
    if (document.getElementById("edit-hue")) document.getElementById("edit-hue").value = 0;
    if (document.getElementById("edit-sepia")) document.getElementById("edit-sepia").value = 0;
    initStickerPicker();
    const src = await MediaStore.get(`profile_${person.toLowerCase()}_photo`);
    if (!src) { alert("No se pudo cargar la foto."); return; }
    const img = new Image();
    img.onload = () => { photoEdit.img = img; renderEditPreview(); initCropOverlay(); };
    img.src = src;
    document.getElementById("photo-edit-modal").classList.remove("hidden");
  };

  window.deleteProfilePhoto = function (person) {
    if (!confirm("¿Eliminar tu foto de perfil?")) return;
    const profile = getProfile(person);
    profile.photo = "";
    saveProfile(person, profile);
    try { MediaStore.delete(`profile_${person.toLowerCase()}_photo`); } catch(e){}
    renderProfiles();
  };
  function pf(label, field, value, editable, person, type="text") {
    if (editable) return `<div class="profile-info-row"><span class="profile-info-label">${label}</span><input type="${type}" class="profile-info-value editable-input" data-field="${field}" value="${esc(value)}" placeholder="${label}..."></div>`;
    return `<div class="profile-info-row"><span class="profile-info-label">${label}</span><span class="profile-info-value">${value || "—"}</span></div>`;
  }
  function sf(label, field, value, editable) {
    const g = field === "instagram" ? "◉" : "♪";
    if (editable) return `<div class="social-btn"><span class="social-glyph">${g}</span><span>${label}:</span><input type="text" class="social-input" data-field="${field}" value="${esc(value)}" placeholder="@usuario" style="background:transparent;border:none;border-bottom:1px dashed rgba(184,0,0,0.4);color:var(--white-pure);font-family:'Cinzel',serif;font-size:0.8rem;outline:none;width:110px;padding:0.2rem;"></div>`;
    if (value) { const h = value.startsWith("http") ? value : `https://${field==="instagram"?"instagram.com":"tiktok.com"}/${value.replace("@","")}`; return `<a href="${h}" target="_blank" class="social-btn"><span class="social-glyph">${g}</span> ${label}</a>`; }
    return `<span class="social-btn"><span class="social-glyph">${g}</span> ${label}: —</span>`;
  }
  function esc(s) { return String(s||"").replace(/"/g,"&quot;").replace(/</g,"&lt;"); }

  // ================= CHAT =================
  function getChatMessages() { return JSON.parse(localStorage.getItem("kd_chat_messages") || "[]"); }
  function saveChatMessages(msgs) { localStorage.setItem("kd_chat_messages", JSON.stringify(msgs)); }
  function getChatClearedTime() { return parseInt(localStorage.getItem(`kd_chat_cleared_${currentUser.toLowerCase()}`) || "0"); }

  function getChatAvatar(sender) {
    const profile = getProfile(sender);
    if (profile.photo) return `<img src="${profile.photo}" alt="${sender}">`;
    return `<span class="chat-avatar-placeholder">${sender === "Kevin" ? "♚" : "♛"}</span>`;
  }

  async function renderChat() {
    const container = document.getElementById("chat-messages");
    if (!container || !currentUser) return;
    const msgs = getChatMessages();
    const clearedTime = getChatClearedTime();
    // Filtrar mensajes posteriores al tiempo de vaciado del usuario actual
    const visibleMsgs = msgs.filter(m => m.timestamp > clearedTime);
    container.innerHTML = "";
    if (!visibleMsgs.length) {
      container.innerHTML = `<div class="chat-empty"><span class="empty-glyph">✉</span>No hay mensajes ${clearedTime ? "después de vaciar" : "aún"}. ¡Escribe el primero!</div>`;
      return;
    }
    for (let i = 0; i < visibleMsgs.length; i++) {
      const m = visibleMsgs[i];
      const realIdx = msgs.indexOf(m);
      const div = document.createElement("div");
      div.className = `chat-message from-${m.sender.toLowerCase()}`;
      const time = new Date(m.timestamp).toLocaleString("es-ES", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
      let mediaHtml = "";
      if (m.mediaId && m.mediaType) {
        const src = await MediaStore.get(m.mediaId);
        if (src) {
          if (m.mediaType === "photo") mediaHtml = `<div class="chat-media" onclick="openLightbox('${src}')"><img src="${src}" alt="foto"></div>`;
          else if (m.mediaType === "video") mediaHtml = `<div class="chat-media"><video controls src="${src}" style="max-width:250px;"></video></div>`;
          else if (m.mediaType === "audio") mediaHtml = `<div class="chat-media"><audio controls src="${src}"></audio></div>`;
          else if (m.mediaType === "file") mediaHtml = `<a class="chat-media-file" href="${src}" download="${m.fileName||'documento'}">❒ ${m.fileName||'Documento'}</a>`;
        }
      }
      const textHtml = m.text ? `<div class="chat-text">${esc(m.text).replace(/\n/g,"<br>")}</div>` : "";
      const delBtn = currentMode === "editor" ? `<button class="evidence-delete" style="position:static;display:inline-flex;width:auto;height:auto;font-size:0.65rem;padding:0.2rem 0.5rem;margin-top:0.3rem;" onclick="deleteChatMsg(${realIdx})">✕ Eliminar</button>` : "";
      div.innerHTML = `<div class="chat-avatar">${getChatAvatar(m.sender)}</div><div class="chat-bubble"><div class="chat-sender">${m.sender}</div>${textHtml}${mediaHtml}<div class="chat-time">${time}</div>${delBtn}</div>`;
      container.appendChild(div);
    }
    container.scrollTop = container.scrollHeight;
  }

  window.clearChat = function () {
    if (!confirm("¿Vaciar el chat para ti? Los mensajes se ocultarán solo para ti, no para la otra persona.")) return;
    localStorage.setItem(`kd_chat_cleared_${currentUser.toLowerCase()}`, Date.now().toString());
    renderChat();
  };

  window.deleteChatMsg = function (idx) {
    const msgs = getChatMessages();
    msgs.splice(idx, 1);
    saveChatMessages(msgs);
    renderChat();
  };

  // Auto-actualizar chat cuando cambian los datos (otra pestaña/dispositivo)
  window.addEventListener("storage", (e) => {
    if (e.key === "kd_chat_messages" || e.key === `kd_chat_cleared_${currentUser?.toLowerCase()}` || e.key?.startsWith("kd_profile_")) {
      renderChat();
    }
  });

  // Auto-actualizar chat solo cuando hay mensajes nuevos (no rompe audios reproduciéndose)
  let lastChatCount = -1;
  function checkChatUpdates() {
    if (!currentUser || !document.getElementById("chat")?.classList.contains("active")) return;
    const msgs = getChatMessages();
    const clearedTime = getChatClearedTime();
    const visibleCount = msgs.filter(m => m.timestamp > clearedTime).length;
    if (visibleCount !== lastChatCount) {
      lastChatCount = visibleCount;
      renderChat();
    }
  }
  setInterval(checkChatUpdates, 3000);

  document.getElementById("chat-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text) return;
    const msgs = getChatMessages();
    msgs.push({ sender: currentUser, text, timestamp: Date.now() });
    saveChatMessages(msgs);
    input.value = "";
    renderChat();
  });

  // Chat media attachments
  async function sendChatMedia(file, mediaType) {
    if (!currentUser || !file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const id = `chat_media_${Date.now()}_${Math.random().toString(36).substr(2,5)}`;
      await MediaStore.save(id, reader.result);
      const msgs = getChatMessages();
      msgs.push({ sender: currentUser, text: "", timestamp: Date.now(), mediaId: id, mediaType, fileName: file.name });
      saveChatMessages(msgs);
      renderChat();
    };
    reader.readAsDataURL(file);
  }

  document.getElementById("chat-photo-input").addEventListener("change", (e) => { if (e.target.files[0]) sendChatMedia(e.target.files[0], "photo"); e.target.value = ""; });
  document.getElementById("chat-video-input").addEventListener("change", (e) => { if (e.target.files[0]) sendChatMedia(e.target.files[0], "video"); e.target.value = ""; });
  document.getElementById("chat-audio-input").addEventListener("change", (e) => { if (e.target.files[0]) sendChatMedia(e.target.files[0], "audio"); e.target.value = ""; });
  document.getElementById("chat-file-input").addEventListener("change", (e) => { if (e.target.files[0]) sendChatMedia(e.target.files[0], "file"); e.target.value = ""; });

  // Voice note recording
  let voiceRecorder = null, voiceChunks = [], voiceRecording = false;
  window.toggleVoiceRecording = async function () {
    if (voiceRecording) {
      if (voiceRecorder) voiceRecorder.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceRecorder = new MediaRecorder(stream);
      voiceChunks = [];
      voiceRecorder.ondataavailable = (e) => { if (e.data.size > 0) voiceChunks.push(e.data); };
      voiceRecorder.onstop = async () => {
        const blob = new Blob(voiceChunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = async () => {
          const id = `chat_voice_${Date.now()}`;
          await MediaStore.save(id, reader.result);
          const msgs = getChatMessages();
          msgs.push({ sender: currentUser, text: "", timestamp: Date.now(), mediaId: id, mediaType: "audio", fileName: "nota-de-voz.webm" });
          saveChatMessages(msgs);
          renderChat();
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
        voiceRecording = false;
        document.getElementById("chat-voice-btn").classList.remove("recording");
      };
      voiceRecorder.start();
      voiceRecording = true;
      document.getElementById("chat-voice-btn").classList.add("recording");
    } catch (err) { alert("No se pudo acceder al micrófono."); }
  };

  // ================= MODAL & CORAZONES =================
  const sacredModal = document.getElementById("sacred-modal");
  const modalIcon = document.getElementById("modal-icon"), modalTitle = document.getElementById("modal-title");
  const modalBodyText = document.getElementById("modal-body-text"), modalActions = document.getElementById("modal-actions");
  const heartsRain = document.getElementById("hearts-rain-container");

  window.spawnHeartsRain = function (count = 65) {
    const syms = ["♥","❤","❥","❣"];
    for (let i = 0; i < count; i++) setTimeout(() => { const h = document.createElement("span"); h.className = "falling-heart"; h.textContent = syms[Math.floor(Math.random()*syms.length)]; h.style.left = `${Math.random()*100}vw`; h.style.fontSize = `${Math.random()*26+16}px`; const d = Math.random()*2.5+2.5; h.style.animationDuration = `${d}s`; h.style.color = Math.random()>0.3 ? "#e60000" : "#ffffff"; heartsRain.appendChild(h); setTimeout(() => h.remove(), d*1000); }, i*40);
  };
  window.spawnHeartsOnly = function () { spawnHeartsRain(80); };
  window.openSacredModal = function ({ icon, title, text, actionsHTML, withHearts = false }) {
    modalIcon.textContent = icon; modalTitle.textContent = title; modalBodyText.textContent = text;
    modalActions.innerHTML = actionsHTML || ""; sacredModal.classList.remove("hidden");
    if (withHearts) spawnHeartsRain(65);
  };
  window.closeSacredModal = function () { sacredModal.classList.add("hidden"); };

  const LOVE_MESSAGES = ["Si algún día dudas de todo, recuerda que mi corazón te pertenece desde el 27 de enero de 2026.","Eres mi lugar seguro, mi calma y mi persona favorita.","Te amo hoy, mañana y en cada vida.","No importa qué tan difícil sea el día, pensar en ti lo transforma todo.","Eres el mejor capítulo de mi historia.","Kevin † Dominic: dos almas unidas para siempre.","Cada latido lleva tu nombre grabado en carmesí."];
  window.triggerLoveEmergency = function () {
    const m = LOVE_MESSAGES[Math.floor(Math.random()*LOVE_MESSAGES.length)];
    openSacredModal({ icon:"♥", title:"Mensaje Amoroso de Emergencia", text:`"${m}"`, withHearts:true, actionsHTML:`<button class="btn-crimson" onclick="triggerLoveEmergency()">♥ Otro</button><button class="btn-outline" onclick="closeSacredModal()">Cerrar</button>` });
  };

  // ================= LIGHTBOX =================
  const lightbox = document.getElementById("lightbox"), lightboxImg = document.getElementById("lightbox-img");
  window.openLightbox = function (src) { if (src) { lightboxImg.src = src; lightbox.classList.remove("hidden"); } };
  window.closeLightbox = function () { lightbox.classList.add("hidden"); lightboxImg.src = ""; };
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeLightbox(); closeSacredModal(); closePhotoEdit(); closeVideoEdit(); closeGamesArcade(); } });

  // ================= TIEMPO =================
  const startDate = new Date(2026, 0, 27, 0, 0, 0);
  function updateCounter() {
    const n = new Date(); const d = n - startDate;
    if (d>=0) {
      const ts = Math.floor(d/1000), tm = Math.floor(ts/60), th = Math.floor(tm/60);
      const days = Math.floor(th/24);
      document.getElementById("days").textContent = days;
      document.getElementById("hours").textContent = String(th%24).padStart(2,"0");
      document.getElementById("minutes").textContent = String(tm%60).padStart(2,"0");
      document.getElementById("seconds").textContent = String(ts%60).padStart(2,"0");
      document.getElementById("total-hours").textContent = th.toLocaleString("es-ES");
      // Stats adicionales
      const extraStats = document.getElementById("time-extra-stats");
      if (extraStats) {
        const weeks = Math.floor(days / 7);
        const months = (days / 30.44).toFixed(1);
        const heartbeats = (ts * 72).toLocaleString("es-ES");
        const breaths = (tm * 16).toLocaleString("es-ES");
        const daysUntilAnniv = 365 - (days % 365);
        const progressPct = ((days % 365) / 365 * 100).toFixed(1);
        extraStats.innerHTML = `
          <div class="time-stat-card"><div class="stat-icon">⧗</div><div class="stat-num">${days}</div><div class="stat-name">Días juntos</div></div>
          <div class="time-stat-card"><div class="stat-icon">✦</div><div class="stat-num">${weeks}</div><div class="stat-name">Semanas</div></div>
          <div class="time-stat-card"><div class="stat-icon">❖</div><div class="stat-num">${months}</div><div class="stat-name">Meses</div></div>
          <div class="time-stat-card"><div class="stat-icon">♥</div><div class="stat-num">${heartbeats}</div><div class="stat-name">Latidos compartidos</div></div>
          <div class="time-stat-card"><div class="stat-icon">✶</div><div class="stat-num">${th.toLocaleString("es-ES")}</div><div class="stat-name">Horas totales</div></div>
          <div class="time-stat-card"><div class="stat-icon">☼</div><div class="stat-num">${tm.toLocaleString("es-ES")}</div><div class="stat-name">Minutos eternos</div></div>
          <div class="time-stat-card"><div class="stat-icon">♛</div><div class="stat-num">${daysUntilAnniv}</div><div class="stat-name">Días para aniversario</div></div>
          <div class="time-stat-card"><div class="stat-icon">⥁</div><div class="stat-num">${progressPct}%</div><div class="stat-name">Progreso del año</div></div>
        `;
        const fill = document.getElementById("time-progress-fill");
        if (fill) fill.style.width = progressPct + "%";
      }
    }
  }
  updateCounter(); setInterval(updateCounter, 1000);

  // ================= CARTA =================
  function initLetter() {
    const lc = document.getElementById("letter-content"), ss = document.getElementById("save-status");
    if (!lc || !currentUser) return;
    const mk = editKey("letter"), tk = viewKey("letter");
    const container = lc.parentElement;
    let rb = document.getElementById("letter-received-box");
    if (!rb) { rb = document.createElement("div"); rb.id = "letter-received-box"; rb.style.cssText = "margin-bottom:2rem;padding:1.5rem;border:1px dashed var(--crimson-blood);background:rgba(5,5,5,0.5);"; container.insertBefore(rb, container.querySelector(".letter-header").nextSibling); }
    const tl = localStorage.getItem(tk) || "";
    const o = otherUser(currentUser);
    if (tl) rb.innerHTML = `<span class="editor-context-tag">Carta de <span class="editor-name">${o}</span></span><div style="min-height:200px;font-size:clamp(1.1rem,2.2vw,1.3rem);line-height:1.9;color:var(--white-silver);white-space:pre-wrap;padding:1rem;">${tl}</div>`;
    else rb.innerHTML = `<span class="editor-context-tag">Carta de <span class="editor-name">${o}</span></span><p class="empty-state-msg"><span class="empty-glyph">✒</span>${o} aún no ha escrito una carta.</p>`;
    const sm = localStorage.getItem(mk);
    container.querySelector(".letter-header h2").textContent = `Tu Carta para ${o}`;
    lc.innerHTML = sm || "";
    if (currentMode === "reader") { lc.removeAttribute("contenteditable"); lc.style.pointerEvents = "none"; }
    else { lc.setAttribute("contenteditable", "true"); lc.style.pointerEvents = "auto"; }
    lc.oninput = () => { localStorage.setItem(mk, lc.innerHTML); ss.textContent = "Guardando..."; clearTimeout(window._ls); window._ls = setTimeout(() => ss.textContent = "", 2000); };
  }

  // ================= TABLA PERIÓDICA (118) =================
  const LOVE_ELEMENTS = [
    {sym:"Am",name:"Amor Primordial",mass:"∞",desc:"El elemento fundacional."},
    {sym:"Et",name:"Eternidad",mass:"∞+",desc:"Duración sin fin."},
    {sym:"Lu",name:"Luz",mass:"100%",desc:"Iluminas mis días."},
    {sym:"Bl",name:"Belleza",mass:"99.9",desc:"Tu esencia deslumbra."},
    {sym:"Bs",name:"Beso",mass:"∞",desc:"Catalizador del alma."},
    {sym:"Cf",name:"Confianza",mass:"24/7",desc:"Transparencia total."},
    {sym:"Ca",name:"Cariño",mass:"100%",desc:"Suavidad mutua."},
    {sym:"Od",name:"Odisea",mass:"27.01",desc:"Viaje juntos."},
    {sym:"Fi",name:"Fidelidad",mass:"100%",desc:"Jamás se rompe."},
    {sym:"Nu",name:"Nuestro",mass:"2",desc:"Solo de los dos."},
    {sym:"Sp",name:"Sorpresa",mass:"∞",desc:"Detalles inesperados."},
    {sym:"Mg",name:"Magia",mass:"∞",desc:"Lo inexplicable."},
    {sym:"Al",name:"Alma",mass:"1",desc:"Esencia eterna."},
    {sym:"So",name:"Sonrisa",mass:"100%",desc:"Mi favorita."},
    {sym:"Pa",name:"Pasión",mass:"1000°",desc:"Fuego carmesí."},
    {sym:"Ab",name:"Abrazo",mass:"30s+",desc:"Refugio curativo."},
    {sym:"Cm",name:"Compañía",mass:"24/7",desc:"Presentes siempre."},
    {sym:"Ah",name:"Anhelo",mass:"∞",desc:"Deseo profundo."},
    {sym:"Pv",name:"Providencia",mass:"100%",desc:"Guía divina."},
    {sym:"Co",name:"Corazón",mass:"1",desc:"Late con tu nombre."},
    {sym:"Ec",name:"Encuentro",mass:"27.01",desc:"Almas halladas."},
    {sym:"Te",name:"Ternura",mass:"100%",desc:"Delicadeza."},
    {sym:"Vi",name:"Vínculo",mass:"∞",desc:"Irrompible."},
    {sym:"Cu",name:"Cuidado",mass:"24/7",desc:"Atención constante."},
    {sym:"Mr",name:"Misterio",mass:"∞",desc:"Profundidad."},
    {sym:"Ho",name:"Hogar",mass:"1",desc:"A tu lado."},
    {sym:"Cr",name:"Caricias",mass:"∞",desc:"Lenguaje silencioso."},
    {sym:"No",name:"Nostalgia",mass:"∞",desc:"Dulce recuerdo."},
    {sym:"Cp",name:"Cómplice",mass:"2",desc:"Complicidad."},
    {sym:"Za",name:"Zafiro",mass:"1",desc:"Pureza."},
    {sym:"Ge",name:"Gentileza",mass:"100%",desc:"Fineza."},
    {sym:"Gr",name:"Gratitud",mass:"∞",desc:"Agradecimiento."},
    {sym:"Ao",name:"Armonía",mass:"100%",desc:"Sincronía."},
    {sym:"Su",name:"Sueños",mass:"∞",desc:"Metas compartidas."},
    {sym:"Bn",name:"Bondad",mass:"100%",desc:"Nobleza."},
    {sym:"Ka",name:"Karma",mass:"∞",desc:"Destino cruzado."},
    {sym:"Re",name:"Refugio",mass:"1",desc:"Abrazo eterno."},
    {sym:"Eg",name:"Entrega",mass:"100%",desc:"Donación total."},
    {sym:"Yi",name:"Yin",mass:"1",desc:"Mitad complementaria."},
    {sym:"Ci",name:"Cielo",mass:"∞",desc:"Firmamento."},
    {sym:"Nd",name:"Nido",mass:"1",desc:"Hogar cálido."},
    {sym:"Mi",name:"Milagro",mass:"∞",desc:"Encontrarnos."},
    {sym:"Ta",name:"Tacto",mass:"100%",desc:"Sensibilidad."},
    {sym:"Ru",name:"Rumor",mass:"∞",desc:"Susurro del alma."},
    {sym:"Rm",name:"Romance",mass:"∞",desc:"Poesía eterna."},
    {sym:"Po",name:"Promesa",mass:"∞",desc:"Juramento."},
    {sym:"Pl",name:"Plenitud",mass:"100%",desc:"Completo contigo."},
    {sym:"Ch",name:"Chispa",mass:"1",desc:"Destello inicial."},
    {sym:"Ic",name:"Inocencia",mass:"100%",desc:"Pureza."},
    {sym:"Es",name:"Estrella",mass:"∞",desc:"Luz guía."},
    {sym:"Af",name:"Afecto",mass:"100%",desc:"Cariño."},
    {sym:"Tq",name:"Te Quiero",mass:"∞",desc:"Declaración pura."},
    {sym:"Yo",name:"Yo",mass:"1",desc:"Entrega total."},
    {sym:"Xe",name:"Xenia",mass:"∞",desc:"Hospitalidad del alma."},
    {sym:"Ce",name:"Ceremonia",mass:"1",desc:"Ritual sagrado."},
    {sym:"Br",name:"Brisa",mass:"∞",desc:"Aliento suave."},
    {sym:"La",name:"Latido",mass:"72",desc:"Ritmo del corazón."},
    {sym:"Cq",name:"Conquista",mass:"∞",desc:"Ganarnos diario."},
    {sym:"Pc",name:"Primicia",mass:"1",desc:"Primer momento."},
    {sym:"Nb",name:"Nobleza",mass:"100%",desc:"Dignidad."},
    {sym:"Pd",name:"Prometido",mass:"∞",desc:"Compromiso eterno."},
    {sym:"Sa",name:"Sabiduría",mass:"∞",desc:"Conocimiento mutuo."},
    {sym:"Ex",name:"Éxtasis",mass:"100%",desc:"Gozo pleno."},
    {sym:"Gu",name:"Guía",mass:"1",desc:"Luz que guía."},
    {sym:"Ts",name:"Tesoro",mass:"∞",desc:"Lo que vales."},
    {sym:"De",name:"Deseo",mass:"∞",desc:"Atracción magnética."},
    {sym:"Hn",name:"Honor",mass:"100%",desc:"Respeto sagrado."},
    {sym:"Er",name:"Erotismo",mass:"∞",desc:"Intimidad pasional."},
    {sym:"Tg",name:"Tregua",mass:"1",desc:"Paz en tu abrazo."},
    {sym:"It",name:"Intimidad",mass:"100%",desc:"Espacio sagrado."},
    {sym:"Ld",name:"Lealtad",mass:"100%",desc:"Inquebrantable."},
    {sym:"Hu",name:"Huella",mass:"∞",desc:"Marca imborrable."},
    {sym:"Tn",name:"Trino",mass:"∞",desc:"Canto de tu voz."},
    {sym:"Vo",name:"Voluntad",mass:"100%",desc:"Elegirnos diario."},
    {sym:"Rc",name:"Rencuentro",mass:"∞",desc:"Alegría de volver."},
    {sym:"Os",name:"Osadía",mass:"100%",desc:"Amar sin miedo."},
    {sym:"Id",name:"Idolatría",mass:"∞",desc:"Devoción absoluta."},
    {sym:"Pe",name:"Perdón",mass:"100%",desc:"Gracia sin rencor."},
    {sym:"Or",name:"Oración",mass:"∞",desc:"Ruego por ti."},
    {sym:"Ma",name:"Marca",mass:"∞",desc:"Señal indeleble."},
    {sym:"Tl",name:"Talento",mass:"100%",desc:"Brillantez tuya."},
    {sym:"Pi",name:"Pilar",mass:"1",desc:"Columna de mi vida."},
    {sym:"Ba",name:"Bálsamo",mass:"100%",desc:"Consuelo curativo."},
    {sym:"Pf",name:"Perfección",mass:"100%",desc:"Sin defecto."},
    {sym:"An",name:"Añoranza",mass:"∞",desc:"Deseo cuando no estás."},
    {sym:"Rs",name:"Reposo",mass:"1",desc:"Descanso en ti."},
    {sym:"Fe",name:"Fe",mass:"100%",desc:"Certeza absoluta."},
    {sym:"Ri",name:"Ritual",mass:"1",desc:"Ceremonias íntimas."},
    {sym:"Ac",name:"Acción",mass:"100%",desc:"Amor con hechos."},
    {sym:"Tm",name:"Templo",mass:"1",desc:"Santuario nuestro."},
    {sym:"Pq",name:"Privilegio",mass:"1",desc:"Honor de tenerte."},
    {sym:"Un",name:"Universo",mass:"∞",desc:"Todo lo que somos."},
    {sym:"Nf",name:"Ninfa",mass:"1",desc:"Musa etérea."},
    {sym:"Pn",name:"Plenilunio",mass:"∞",desc:"Luna plena."},
    {sym:"Au",name:"Aurora",mass:"1",desc:"Amanecer dorado."},
    {sym:"Cz",name:"Cúpula",mass:"1",desc:"Techo sagrado."},
    {sym:"Bd",name:"Boda",mass:"1",desc:"Sueño futuro."},
    {sym:"Ct",name:"Cantar",mass:"∞",desc:"Melodía del alma."},
    {sym:"En",name:"Ensueño",mass:"∞",desc:"Vivir enamorado."},
    {sym:"Fu",name:"Fuerza",mass:"100%",desc:"Poder que me das."},
    {sym:"Me",name:"Memoria",mass:"∞",desc:"Archivo sagrado."},
    {sym:"Nm",name:"Nimbo",mass:"1",desc:"Halo de luz."},
    {sym:"Lr",name:"Lauro",mass:"1",desc:"Corona de victoria."},
    {sym:"Rt",name:"Rostro",mass:"1",desc:"Reflejo de tu alma."},
    {sym:"Du",name:"Dulzura",mass:"100%",desc:"Suavidad miel."},
    {sym:"Sd",name:"Seducción",mass:"∞",desc:"Arte magnético."},
    {sym:"Bj",name:"Brújula",mass:"1",desc:"Orienta hacia ti."},
    {sym:"Hi",name:"Himno",mass:"1",desc:"Canto sagrado."},
    {sym:"Mv",name:"Maravilla",mass:"∞",desc:"Lo que eres."},
    {sym:"Dc",name:"Dedicación",mass:"100%",desc:"Entrega constante."},
    {sym:"Ro",name:"Rocío",mass:"∞",desc:"Frescor matutino."},
    {sym:"Cd",name:"Cordero",mass:"1",desc:"Inocencia pura."},
    {sym:"Ni",name:"Niño",mass:"1",desc:"Niño interior."},
    {sym:"Fl",name:"Florecer",mass:"∞",desc:"Florecimiento."},
    {sym:"Mu",name:"Música",mass:"∞",desc:"Armonía juntos."},
    {sym:"Lm",name:"Llamarada",mass:"∞",desc:"Fuego de pasión."},
    {sym:"Tf",name:"Triunfo",mass:"1",desc:"Victoria de encontrarnos."},
    {sym:"Og",name:"Omega",mass:"∞",desc:"Principio y fin: nuestro amor."}
  ];

  function renderPeriodicTable() {
    const g = document.getElementById("periodic-grid");
    if (!g) return; g.innerHTML = "";
    LOVE_ELEMENTS.forEach((el, i) => {
      const c = document.createElement("div");
      c.className = "pt-cell" + (i === 0 ? " active-element" : "");
      c.innerHTML = `<div class="pt-num"><span>${i+1}</span><span>${el.mass}</span></div><div class="pt-sym">${el.sym}</div><div class="pt-name">${el.name}</div>`;
      c.addEventListener("click", () => {
        document.querySelectorAll(".pt-cell").forEach((x) => x.classList.remove("active-element"));
        c.classList.add("active-element");
        document.getElementById("pt-selected-symbol").textContent = el.sym;
        document.getElementById("pt-selected-name").textContent = `${el.name} (N.º ${i+1})`;
        document.getElementById("pt-selected-desc").textContent = el.desc;
      });
      g.appendChild(c);
    });
  }

  // ================= EXPEDIENTE =================
  function renderEvidencias() {
    setSectionContext("expediente-context");
    const list = document.getElementById("dossier-evidence-list");
    if (!list || !currentUser) return;
    const viewed = JSON.parse(localStorage.getItem(viewKey("evidencias")) || "[]");
    const edited = JSON.parse(localStorage.getItem(editKey("evidencias")) || "[]");
    list.innerHTML = "";
    const all = []; viewed.forEach((t) => all.push({text:t,from:"view"})); edited.forEach((t,i) => all.push({text:t,from:"edit",idx:i}));
    if (!all.length) { list.innerHTML = `<p class="empty-state-msg" style="grid-column:1/-1"><span class="empty-glyph">❒</span>Aún no hay evidencias.</p>`; return; }
    all.forEach((e, i) => {
      const tag = e.from === "view" ? `De ${otherUser(currentUser)}` : `Tuya para ${otherUser(currentUser)}`;
      const card = document.createElement("div"); card.className = "evidence-card";
      card.innerHTML = `<span class="evidence-tag">Evidencia #${i+1}</span><p class="card-desc">${e.text}</p><span class="editor-context-tag">${tag}</span>${e.from==="edit"&&currentMode==="editor"?`<button class="evidence-delete" data-idx="${e.idx}">✕ Eliminar</button>`:""}`;
      if (e.from === "edit" && currentMode === "editor") card.querySelector(".evidence-delete").addEventListener("click", () => { const d = JSON.parse(localStorage.getItem(editKey("evidencias"))||"[]"); d.splice(e.idx,1); localStorage.setItem(editKey("evidencias"),JSON.stringify(d)); renderEvidencias(); });
      list.appendChild(card);
    });
  }
  document.getElementById("form-evidencia").addEventListener("submit", (e) => { e.preventDefault(); if (!currentUser||currentMode==="reader") return; const v = document.getElementById("evidencia-texto").value.trim(); if (!v) return; const d = JSON.parse(localStorage.getItem(editKey("evidencias"))||"[]"); d.push(v); localStorage.setItem(editKey("evidencias"),JSON.stringify(d)); renderEvidencias(); e.target.reset(); });

  // ================= CONSTELACIONES MASIVAS Y ANIMADAS =================
  const REAL_CONSTELLATIONS = [
    { name:"Orión", stars:[{x:0.12,y:0.35},{x:0.15,y:0.45},{x:0.16,y:0.5},{x:0.17,y:0.55},{x:0.20,y:0.65},{x:0.10,y:0.40},{x:0.22,y:0.42}], lines:[[0,1],[1,2],[2,3],[3,4],[5,1],[6,3]] },
    { name:"Osa Mayor", stars:[{x:0.30,y:0.20},{x:0.36,y:0.22},{x:0.42,y:0.25},{x:0.48,y:0.28},{x:0.52,y:0.22},{x:0.56,y:0.18},{x:0.60,y:0.20}], lines:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6]] },
    { name:"Casiopea", stars:[{x:0.72,y:0.18},{x:0.76,y:0.22},{x:0.80,y:0.18},{x:0.84,y:0.22},{x:0.88,y:0.18}], lines:[[0,1],[1,2],[2,3],[3,4]] },
    { name:"Cisne", stars:[{x:0.50,y:0.60},{x:0.52,y:0.65},{x:0.54,y:0.70},{x:0.56,y:0.75},{x:0.48,y:0.68},{x:0.58,y:0.68}], lines:[[0,1],[1,2],[2,3],[1,4],[1,5]] },
    { name:"Leo", stars:[{x:0.25,y:0.70},{x:0.28,y:0.72},{x:0.31,y:0.70},{x:0.34,y:0.68},{x:0.36,y:0.72},{x:0.38,y:0.78}], lines:[[0,1],[1,2],[2,3],[3,4],[4,5]] },
    { name:"Lira", stars:[{x:0.65,y:0.55},{x:0.67,y:0.60},{x:0.69,y:0.58},{x:0.66,y:0.65},{x:0.68,y:0.63}], lines:[[0,1],[1,2],[2,3],[3,4],[4,0]] },
    { name:"Escorpio", stars:[{x:0.08,y:0.75},{x:0.12,y:0.78},{x:0.16,y:0.80},{x:0.20,y:0.82},{x:0.24,y:0.80},{x:0.28,y:0.78}], lines:[[0,1],[1,2],[2,3],[3,4],[4,5]] },
    { name:"Dragón", stars:[{x:0.40,y:0.10},{x:0.45,y:0.12},{x:0.50,y:0.08},{x:0.55,y:0.12},{x:0.58,y:0.16},{x:0.62,y:0.14}], lines:[[0,1],[1,2],[2,3],[3,4],[4,5]] }
  ];

  let constAnimId = null, bgStars = [], shootingStars = [], nebulae = [], constMouse = {x:0,y:0};
  const STAR_COUNT = 600;

  function initConstellationBg() {
    bgStars = Array.from({length: STAR_COUNT}, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.5 + 0.3,
      twinkle: Math.random() * Math.PI * 2,
      twinkleSpeed: Math.random() * 0.04 + 0.01,
      color: Math.random() > 0.88 ? "#e60000" : (Math.random() > 0.5 ? "#ffffff" : "#d4d4d4"),
      drift: { x: (Math.random()-0.5)*0.0002, y: (Math.random()-0.5)*0.0002 }
    }));
    nebulae = [
      { x:0.2, y:0.3, r:0.28, color:"rgba(117,0,0,0.18)", drift:0 },
      { x:0.7, y:0.6, r:0.32, color:"rgba(59,0,0,0.2)", drift:0 },
      { x:0.5, y:0.5, r:0.22, color:"rgba(184,0,0,0.1)", drift:0 },
      { x:0.85, y:0.25, r:0.2, color:"rgba(230,0,0,0.08)", drift:0 },
      { x:0.15, y:0.75, r:0.25, color:"rgba(117,0,0,0.12)", drift:0 },
      { x:0.6, y:0.15, r:0.18, color:"rgba(184,0,0,0.07)", drift:0 },
      { x:0.35, y:0.85, r:0.22, color:"rgba(59,0,0,0.15)", drift:0 },
      { x:0.9, y:0.7, r:0.2, color:"rgba(230,0,0,0.06)", drift:0 }
    ];
  }
  initConstellationBg();

  function getCelebrationStars() {
    const cel = JSON.parse(localStorage.getItem("kd_celebrations") || "[]");
    return cel.map((c, i) => {
      const angle = (i / Math.max(cel.length, 1)) * Math.PI * 2;
      return { x: 0.5 + Math.cos(angle) * 0.32, y: 0.5 + Math.sin(angle) * 0.25, date: c.dateText || "", title: c.title || "", pulse: i * 0.5 };
    });
  }

  function drawConstellationMap() {
    const canvas = document.getElementById("constellation-canvas");
    if (!canvas) return;
    const wrap = canvas.parentElement;
    canvas.width = wrap.clientWidth; canvas.height = wrap.clientHeight;
  }

  function startConstellationAnimation() {
    const canvas = document.getElementById("constellation-canvas");
    if (!canvas) return;
    if (constAnimId) cancelAnimationFrame(constAnimId);
    const ctx = canvas.getContext("2d");

    function render() {
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Nebulae con movimiento
      nebulae.forEach((n) => {
        n.drift += 0.0015;
        const nx = (n.x + Math.sin(n.drift) * 0.03) * w;
        const ny = (n.y + Math.cos(n.drift) * 0.03) * h;
        const grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, n.r * w);
        grad.addColorStop(0, n.color); grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
      });

      // Estrellas de fondo con titileo, drift y parallax
      bgStars.forEach((s) => {
        s.twinkle += s.twinkleSpeed;
        s.x += s.drift.x; s.y += s.drift.y;
        if (s.x > 1) s.x = 0; if (s.x < 0) s.x = 1;
        if (s.y > 1) s.y = 0; if (s.y < 0) s.y = 1;
        const opacity = 0.3 + Math.abs(Math.sin(s.twinkle)) * 0.7;
        const px = s.x * w + constMouse.x * (s.r * 10);
        const py = s.y * h + constMouse.y * (s.r * 10);
        ctx.fillStyle = s.color; ctx.globalAlpha = opacity;
        ctx.beginPath(); ctx.arc(px, py, s.r, 0, Math.PI * 2); ctx.fill();
        if (s.r > 1) { ctx.globalAlpha = opacity * 0.25; ctx.beginPath(); ctx.arc(px, py, s.r * 4, 0, Math.PI * 2); ctx.fill(); }
      });
      ctx.globalAlpha = 1;

      // Constelaciones
      REAL_CONSTELLATIONS.forEach((con) => {
        ctx.strokeStyle = "rgba(184,0,0,0.3)"; ctx.lineWidth = 1.2;
        ctx.shadowColor = "#e60000"; ctx.shadowBlur = 5;
        con.lines.forEach(([a, b]) => {
          const sa = con.stars[a], sb = con.stars[b];
          ctx.beginPath(); ctx.moveTo(sa.x * w, sa.y * h); ctx.lineTo(sb.x * w, sb.y * h); ctx.stroke();
        });
        ctx.shadowBlur = 0;
        con.stars.forEach((s) => {
          ctx.fillStyle = "rgba(255,255,255,0.8)";
          ctx.beginPath(); ctx.arc(s.x * w, s.y * h, 2, 0, Math.PI * 2); ctx.fill();
        });
        ctx.fillStyle = "rgba(212,212,212,0.5)"; ctx.font = "11px Cinzel, serif"; ctx.textAlign = "center";
        ctx.fillText(con.name, con.stars[0].x * w, con.stars[0].y * h - 10);
      });

      // Estrellas fugaces
      if (Math.random() < 0.015 && shootingStars.length < 3) {
        shootingStars.push({ x: Math.random() * w * 0.6, y: Math.random() * h * 0.4, vx: Math.random() * 10 + 5, vy: Math.random() * 5 + 2, life: 1, trail: [] });
      }
      shootingStars = shootingStars.filter((ss) => {
        ss.trail.push({ x: ss.x, y: ss.y });
        if (ss.trail.length > 15) ss.trail.shift();
        ss.x += ss.vx; ss.y += ss.vy; ss.life -= 0.018;
        ctx.strokeStyle = `rgba(230,0,0,${ss.life})`; ctx.lineWidth = 2.5;
        ctx.shadowColor = "#e60000"; ctx.shadowBlur = 10;
        ctx.beginPath();
        ss.trail.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
        ctx.stroke(); ctx.shadowBlur = 0;
        return ss.life > 0 && ss.x < w && ss.y < h;
      });

      // Estrellas de celebraciones (brillantes, pulsantes)
      getCelebrationStars().forEach((cs) => {
        cs.pulse += 0.06;
        const ps = 5 + Math.sin(cs.pulse) * 2.5;
        const px = cs.x * w, py = cs.y * h;
        const gg = ctx.createRadialGradient(px, py, 0, px, py, ps * 6);
        gg.addColorStop(0, "rgba(230,0,0,0.9)"); gg.addColorStop(0.3, "rgba(184,0,0,0.4)"); gg.addColorStop(1, "transparent");
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(px, py, ps * 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#ffffff"; ctx.shadowColor = "#e60000"; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.arc(px, py, ps, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(px - ps * 4, py); ctx.lineTo(px + ps * 4, py);
        ctx.moveTo(px, py - ps * 4); ctx.lineTo(px, py + ps * 4); ctx.stroke();
      });

      constAnimId = requestAnimationFrame(render);
    }
    render();

    canvas.onclick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const cx = (e.clientX - rect.left) / rect.width;
      const cy = (e.clientY - rect.top) / rect.height;
      getCelebrationStars().forEach((cs) => {
        if (Math.hypot(cs.x - cx, cs.y - cy) < 0.05) {
          document.getElementById("star-date").textContent = cs.date || "—";
          document.getElementById("star-title").textContent = cs.title || "Celebración";
          document.getElementById("star-desc").textContent = "Estrella de una celebración especial.";
          spawnHeartsRain(15);
        }
      });
    };
    canvas.onmousemove = (e) => {
      const rect = canvas.getBoundingClientRect();
      constMouse.x = ((e.clientX - rect.left) / rect.width - 0.5) * 0.6;
      constMouse.y = ((e.clientY - rect.top) / rect.height - 0.5) * 0.6;
    };
    canvas.ontouchmove = (e) => {
      e.preventDefault();
      const t = e.touches[0]; const rect = canvas.getBoundingClientRect();
      constMouse.x = ((t.clientX - rect.left) / rect.width - 0.5) * 0.6;
      constMouse.y = ((t.clientY - rect.top) / rect.height - 0.5) * 0.6;
    };
  }
  function stopConstellationAnimation() { if (constAnimId) { cancelAnimationFrame(constAnimId); constAnimId = null; } }

  // ================= CELEBRACIONES =================
  function getCelebrations() { try { return JSON.parse(localStorage.getItem("kd_celebrations") || "[]"); } catch(e){ return []; } }
  function saveCelebrations(d) { localStorage.setItem("kd_celebrations", JSON.stringify(d)); }
  function renderCelebrations() {
    setSectionContext("celebraciones-context");
    const grid = document.getElementById("celebraciones-grid");
    if (!grid) return; const cel = getCelebrations(); const today = new Date(); today.setHours(0,0,0,0);
    grid.innerHTML = "";
    if (!cel.length) { grid.innerHTML = `<p class="empty-state-msg" style="grid-column:1/-1"><span class="empty-glyph">✠</span>Aún no hay celebraciones.</p>`; return; }
    cel.forEach((c, idx) => {
      let nd = new Date(today.getFullYear(), c.month, c.day);
      if (nd < today) nd.setFullYear(today.getFullYear() + 1);
      const dd = Math.ceil((nd - today) / (1000*60*60*24));
      const msg = dd === 0 ? "¡ES HOY! ♥" : `Faltan ${dd} días`;
      const card = document.createElement("div");
      card.className = "cathedral-frame celebration-card";
      card.innerHTML = `${currentMode==="editor"?`<button class="celebration-delete" data-idx="${idx}">✕</button>`:""}<div><div class="celebration-icon">${c.icon||"✠"}</div><span class="date-tag">${c.dateText}</span><h3 class="card-title" style="margin-top:0.9rem;">${c.title}</h3><p class="card-desc">${c.desc}</p></div><div class="celebration-countdown">${msg}</div>`;
      if (currentMode === "editor") card.querySelector(".celebration-delete").addEventListener("click", () => { const d = getCelebrations(); d.splice(idx,1); saveCelebrations(d); renderCelebrations(); });
      grid.appendChild(card);
    });
  }
  document.getElementById("form-celebracion").addEventListener("submit", (e) => {
    e.preventDefault(); if (currentMode === "reader") return;
    const mes = parseInt(document.getElementById("celebracion-mes").value, 10);
    const dia = parseInt(document.getElementById("celebracion-dia").value, 10);
    if (isNaN(mes) || isNaN(dia)) { alert("Mes/día inválidos."); return; }
    const d = getCelebrations();
    d.push({ icon: document.getElementById("celebracion-icono").value.trim()||"✠", title: document.getElementById("celebracion-nombre").value.trim(), dateText: document.getElementById("celebracion-fecha-texto").value.trim(), month: mes, day: dia, desc: document.getElementById("celebracion-desc").value.trim() });
    saveCelebrations(d); renderCelebrations(); e.target.reset();
  });

  // ================= LISTAS SIMPLES (vacío + filtros cruzados) =================
  function getCross(s) { return { viewed: JSON.parse(localStorage.getItem(viewKey(s))||"[]"), edited: JSON.parse(localStorage.getItem(editKey(s))||"[]") }; }

  function renderNumbered(section, gridId, ctxId) {
    setSectionContext(ctxId);
    const grid = document.getElementById(gridId); if (!grid||!currentUser) return;
    const { viewed, edited } = getCross(section); grid.innerHTML = "";
    const all = []; viewed.forEach((t) => all.push({text:t,from:"view"})); edited.forEach((t,i) => all.push({text:t,from:"edit",idx:i}));
    if (!all.length) { grid.innerHTML = `<p class="empty-state-msg" style="grid-column:1/-1"><span class="empty-glyph">❖</span>Aún no hay entradas.</p>`; return; }
    all.forEach((e, i) => {
      const tag = e.from==="view"?`De ${otherUser(currentUser)}`:`Tuya para ${otherUser(currentUser)}`;
      const card = document.createElement("div"); card.className = "cathedral-frame reason-card";
      card.innerHTML = `<div class="reason-number">${i+1}</div><p class="reason-quote">"${e.text}"</p><span class="editor-context-tag">${tag}</span>${e.from==="edit"&&currentMode==="editor"?`<button class="evidence-delete" data-idx="${e.idx}">✕</button>`:""}`;
      if (e.from==="edit"&&currentMode==="editor") card.querySelector(".evidence-delete").addEventListener("click", () => { const d = JSON.parse(localStorage.getItem(editKey(section))||"[]"); d.splice(e.idx,1); localStorage.setItem(editKey(section),JSON.stringify(d)); renderNumbered(section,gridId,ctxId); });
      grid.appendChild(card);
    });
  }
  function renderBadged(section, gridId, ctxId, label) {
    setSectionContext(ctxId);
    const grid = document.getElementById(gridId); if (!grid||!currentUser) return;
    const { viewed, edited } = getCross(section); grid.innerHTML = "";
    const all = []; viewed.forEach((t) => all.push({text:t,from:"view"})); edited.forEach((t,i) => all.push({text:t,from:"edit",idx:i}));
    if (!all.length) { grid.innerHTML = `<p class="empty-state-msg" style="grid-column:1/-1"><span class="empty-glyph">❖</span>Aún no hay entradas.</p>`; return; }
    all.forEach((e, i) => {
      const tag = e.from==="view"?`De ${otherUser(currentUser)}`:`Tuya para ${otherUser(currentUser)}`;
      const card = document.createElement("div"); card.className = "cathedral-frame curiosity-card";
      card.innerHTML = `<span class="curiosity-badge">${label} #${i+1}</span><p class="card-desc">${e.text}</p><span class="editor-context-tag">${tag}</span>${e.from==="edit"&&currentMode==="editor"?`<button class="evidence-delete" data-idx="${e.idx}">✕</button>`:""}`;
      if (e.from==="edit"&&currentMode==="editor") card.querySelector(".evidence-delete").addEventListener("click", () => { const d = JSON.parse(localStorage.getItem(editKey(section))||"[]"); d.splice(e.idx,1); localStorage.setItem(editKey(section),JSON.stringify(d)); renderBadged(section,gridId,ctxId,label); });
      grid.appendChild(card);
    });
  }
  function bindForm(fid, iid, section, fn) {
    const f = document.getElementById(fid); if (!f) return;
    f.addEventListener("submit", (e) => { e.preventDefault(); if (!currentUser||currentMode==="reader") return; const v = document.getElementById(iid).value.trim(); if (!v) return; const d = JSON.parse(localStorage.getItem(editKey(section))||"[]"); d.push(v); localStorage.setItem(editKey(section),JSON.stringify(d)); fn(); f.reset(); });
  }

  const renderRazones = () => renderNumbered("razones","razones-grid","razones-context");
  const renderNunca = () => renderNumbered("nunca_olvidar","nunca-grid","nunca-context");
  const renderGracias = () => renderBadged("gracias","gracias-grid","gracias-context","Gratitud");
  bindForm("form-razon","razon-texto","razones",renderRazones);
  bindForm("form-nunca","nunca-texto","nunca_olvidar",renderNunca);
  bindForm("form-gracias","gracias-texto","gracias",renderGracias);

  function renderObj(section, gridId, ctxId, cardFn) {
    setSectionContext(ctxId);
    const grid = document.getElementById(gridId); if (!grid||!currentUser) return;
    const { viewed, edited } = getCross(section); grid.innerHTML = "";
    const all = []; viewed.forEach((i) => all.push({...i,from:"view"})); edited.forEach((i,idx) => all.push({...i,from:"edit",idx}));
    if (!all.length) { const g = section==="admiro"?"♛":section==="parejas"?"❧":section==="logros"?"♔":section==="recuerdos"?"⚜":section==="salidas"?"✠":section==="recuerdan"?"✿":"❖"; grid.innerHTML = `<p class="empty-state-msg" style="grid-column:1/-1"><span class="empty-glyph">${g}</span>Aún no hay entradas.</p>`; return; }
    all.forEach((item) => {
      const tag = item.from==="view"?`De ${otherUser(currentUser)}`:`Tuya para ${otherUser(currentUser)}`;
      const div = document.createElement("div"); div.innerHTML = cardFn(item, tag);
      grid.appendChild(div.firstChild);
      if (item.from==="edit"&&currentMode==="editor") { const db = grid.lastElementChild.querySelector(".evidence-delete"); if (db) db.addEventListener("click", () => { const d = JSON.parse(localStorage.getItem(editKey(section))||"[]"); d.splice(item.idx,1); localStorage.setItem(editKey(section),JSON.stringify(d)); renderObj(section,gridId,ctxId,cardFn); }); }
    });
  }

  function renderAdmiro() { renderObj("admiro","admiro-grid","admiro-context",(i,t) => `<div class="cathedral-frame reason-card"><div class="reason-number">♛</div><h3 class="card-title">${i.titulo}</h3><p class="card-desc">${i.detalle}</p><span class="editor-context-tag">${t}</span>${i.from==="edit"&&currentMode==="editor"?`<button class="evidence-delete" data-idx="${i.idx}">✕</button>`:""}</div>`); }
  document.getElementById("form-admiro").addEventListener("submit", (e) => { e.preventDefault(); if (!currentUser||currentMode==="reader") return; const d = JSON.parse(localStorage.getItem(editKey("admiro"))||"[]"); d.push({titulo:document.getElementById("admiro-titulo").value.trim(),detalle:document.getElementById("admiro-detalle").value.trim()}); localStorage.setItem(editKey("admiro"),JSON.stringify(d)); renderAdmiro(); e.target.reset(); });

  function renderParejas() { renderObj("parejas","parejas-grid","parejas-context",(i,t) => `<div class="cathedral-frame outing-card"><div class="outing-header"><span class="date-tag">${i.origen}</span><span class="outing-sigil">❧</span></div><h3 class="card-title">${i.nombres}</h3><p class="card-desc">${i.motivo}</p><span class="editor-context-tag">${t}</span>${i.from==="edit"&&currentMode==="editor"?`<button class="evidence-delete" data-idx="${i.idx}">✕</button>`:""}</div>`); }
  document.getElementById("form-pareja").addEventListener("submit", (e) => { e.preventDefault(); if (!currentUser||currentMode==="reader") return; const d = JSON.parse(localStorage.getItem(editKey("parejas"))||"[]"); d.unshift({nombres:document.getElementById("pareja-nombres").value.trim(),origen:document.getElementById("pareja-origen").value.trim(),motivo:document.getElementById("pareja-motivo").value.trim()}); localStorage.setItem(editKey("parejas"),JSON.stringify(d)); renderParejas(); e.target.reset(); });

  function renderLogros() { renderObj("logros","logros-grid","logros-context",(i,t) => `<div class="cathedral-frame outing-card"><div class="outing-header"><span class="date-tag">${i.fecha}</span><span class="outing-sigil">♔</span></div><h3 class="card-title">${i.titulo}</h3><p class="card-desc">${i.desc}</p><span class="editor-context-tag">${t}</span>${i.from==="edit"&&currentMode==="editor"?`<button class="evidence-delete" data-idx="${i.idx}">✕</button>`:""}</div>`); }
  document.getElementById("form-logro").addEventListener("submit", (e) => { e.preventDefault(); if (!currentUser||currentMode==="reader") return; const d = JSON.parse(localStorage.getItem(editKey("logros"))||"[]"); d.unshift({titulo:document.getElementById("logro-titulo").value.trim(),fecha:document.getElementById("logro-fecha").value.trim(),desc:document.getElementById("logro-desc").value.trim()}); localStorage.setItem(editKey("logros"),JSON.stringify(d)); renderLogros(); e.target.reset(); });

  function renderRecuerdos() {
    setSectionContext("recuerdos-context");
    const c = document.getElementById("recuerdos-accordion"); if (!c||!currentUser) return;
    const { viewed, edited } = getCross("recuerdos"); c.innerHTML = "";
    const all = []; viewed.forEach((i) => all.push({...i,from:"view"})); edited.forEach((i,idx) => all.push({...i,from:"edit",idx}));
    if (!all.length) { c.innerHTML = `<p class="empty-state-msg"><span class="empty-glyph">⚜</span>Aún no hay recuerdos.</p>`; return; }
    all.forEach((item, idx) => {
      const tag = item.from==="view"?`De ${otherUser(currentUser)}`:`Tuya para ${otherUser(currentUser)}`;
      const div = document.createElement("div"); div.className = "accordion-item" + (idx===0?" open":"");
      div.innerHTML = `<button class="accordion-header"><div class="accordion-title-wrap"><span class="accordion-date">${item.fecha} · ${tag}</span><span class="accordion-title">${item.titulo}</span></div><span class="accordion-icon">▼</span></button><div class="accordion-body">${item.texto}</div>${item.from==="edit"&&currentMode==="editor"?`<div style="padding:0 1.8rem 1.4rem;"><button class="evidence-delete" data-idx="${item.idx}">✕ Eliminar</button></div>`:""}`;
      div.querySelector(".accordion-header").addEventListener("click", () => div.classList.toggle("open"));
      if (item.from==="edit"&&currentMode==="editor") div.querySelector(".evidence-delete").addEventListener("click", () => { const d = JSON.parse(localStorage.getItem(editKey("recuerdos"))||"[]"); d.splice(item.idx,1); localStorage.setItem(editKey("recuerdos"),JSON.stringify(d)); renderRecuerdos(); });
      c.appendChild(div);
    });
  }
  document.getElementById("form-recuerdo").addEventListener("submit", (e) => { e.preventDefault(); if (!currentUser||currentMode==="reader") return; const d = JSON.parse(localStorage.getItem(editKey("recuerdos"))||"[]"); d.unshift({titulo:document.getElementById("recuerdo-titulo").value.trim(),fecha:document.getElementById("recuerdo-fecha").value.trim(),texto:document.getElementById("recuerdo-texto").value.trim()}); localStorage.setItem(editKey("recuerdos"),JSON.stringify(d)); renderRecuerdos(); e.target.reset(); });

  function renderSalidas() { renderObj("salidas","salidas-grid","salidas-context",(i,t) => `<div class="cathedral-frame outing-card"><div class="outing-header"><span class="date-tag">${i.fecha}</span><span class="outing-sigil">✠</span></div><h3 class="card-title">${i.lugar}</h3><p class="card-desc">${i.desc}</p><span class="editor-context-tag">${t}</span>${i.from==="edit"&&currentMode==="editor"?`<button class="evidence-delete" data-idx="${i.idx}">✕</button>`:""}</div>`); }
  document.getElementById("form-salida").addEventListener("submit", (e) => { e.preventDefault(); if (!currentUser||currentMode==="reader") return; const d = JSON.parse(localStorage.getItem(editKey("salidas"))||"[]"); d.unshift({lugar:document.getElementById("salida-lugar").value.trim(),fecha:document.getElementById("salida-fecha").value.trim(),desc:document.getElementById("salida-desc").value.trim()}); localStorage.setItem(editKey("salidas"),JSON.stringify(d)); renderSalidas(); e.target.reset(); });

  function renderPlanes() {
    setSectionContext("planes-context");
    const list = document.getElementById("planes-list"); if (!list||!currentUser) return;
    const { viewed, edited } = getCross("planes"); list.innerHTML = "";
    const all = []; viewed.forEach((i) => all.push({...i,from:"view"})); edited.forEach((i,idx) => all.push({...i,from:"edit",idx}));
    if (!all.length) { list.innerHTML = `<p class="empty-state-msg" style="grid-column:1/-1"><span class="empty-glyph">✩</span>Aún no hay planes.</p>`; return; }
    all.forEach((item) => {
      const tag = item.from==="view"?`De ${otherUser(currentUser)}`:`Tuya para ${otherUser(currentUser)}`;
      const card = document.createElement("div"); card.className = "plan-card" + (item.done?" completed":"");
      const delBtn = item.from==="edit"&&currentMode==="editor" ? `<button class="evidence-delete" style="position:static;flex-shrink:0;margin-left:0.5rem;" data-idx="${item.idx}">✕</button>` : "";
      card.innerHTML = `<div class="plan-check">✓</div><div style="flex:1"><span class="plan-text">${item.texto}</span><br><span class="editor-context-tag">${tag}</span></div>${delBtn}`;
      if (item.from==="edit"&&currentMode==="editor") {
        card.style.cursor = "pointer";
        card.querySelector(".plan-check").addEventListener("click", (e) => { e.stopPropagation(); const d = JSON.parse(localStorage.getItem(editKey("planes"))||"[]"); d[item.idx].done = !d[item.idx].done; localStorage.setItem(editKey("planes"),JSON.stringify(d)); renderPlanes(); });
        const db = card.querySelector(".evidence-delete");
        if (db) db.addEventListener("click", (e) => { e.stopPropagation(); const d = JSON.parse(localStorage.getItem(editKey("planes"))||"[]"); d.splice(item.idx,1); localStorage.setItem(editKey("planes"),JSON.stringify(d)); renderPlanes(); });
      }
      list.appendChild(card);
    });
  }
  document.getElementById("form-plan").addEventListener("submit", (e) => { e.preventDefault(); if (!currentUser||currentMode==="reader") return; const d = JSON.parse(localStorage.getItem(editKey("planes"))||"[]"); d.push({texto:document.getElementById("plan-texto").value.trim(),done:false}); localStorage.setItem(editKey("planes"),JSON.stringify(d)); renderPlanes(); e.target.reset(); });

  function renderRecuerdan() { renderObj("recuerdan","recuerdan-grid","recuerdan-context",(i,t) => `<div class="cathedral-frame curiosity-card"><span class="curiosity-badge">${i.categoria}</span><h3 class="card-title">${i.cosa}</h3><p class="card-desc">${i.motivo}</p><span class="editor-context-tag">${t}</span>${i.from==="edit"&&currentMode==="editor"?`<button class="evidence-delete" data-idx="${i.idx}">✕</button>`:""}</div>`); }
  document.getElementById("form-recuerda").addEventListener("submit", (e) => { e.preventDefault(); if (!currentUser||currentMode==="reader") return; const d = JSON.parse(localStorage.getItem(editKey("recuerdan"))||"[]"); d.unshift({cosa:document.getElementById("recuerda-cosa").value.trim(),categoria:document.getElementById("recuerda-categoria").value.trim(),motivo:document.getElementById("recuerda-motivo").value.trim()}); localStorage.setItem(editKey("recuerdan"),JSON.stringify(d)); renderRecuerdan(); e.target.reset(); });

  // ================= FOTOS (1000) con FILTROS y CROP MEJORADO =================
  const PHOTO_LIMIT = 1000, PHOTOS_PER_PAGE = 12;
  let fotosPage = 1;
  function loadFotos() { return { edited: JSON.parse(localStorage.getItem(editKey("fotos"))||"[]"), viewed: JSON.parse(localStorage.getItem(viewKey("fotos"))||"[]") }; }
  function renderFotosCounter(edited) { const el = document.getElementById("fotos-counter"); if (!el||!currentUser) return; const { viewed } = loadFotos(); const pct = Math.min(100,(edited.length/PHOTO_LIMIT)*100); el.innerHTML = `<span class="counter-label">Tuyas: ${edited.length}/${PHOTO_LIMIT} · Recibidas: ${viewed.length}</span><span class="counter-value">${edited.length}<span class="counter-max"> / ${PHOTO_LIMIT}</span></span><div class="counter-progress"><div class="counter-progress-fill" style="width:${pct}%"></div></div>`; }

  function renderPhotos() {
    setSectionContext("fotos-context");
    renderFilterBar("fotos-filter", "fotos", renderPhotos);
    const { edited, viewed } = loadFotos();
    renderFotosCounter(edited);
    const gallery = document.getElementById("photo-gallery"); if (!gallery||!currentUser) return;
    gallery.innerHTML = "";

    // Aplicar filtro
    let all = [];
    const f = mediaFilters.fotos;
    if (f === "all" || f === "sent") edited.forEach((item, i) => all.push({...item, from:"edit", idx:i}));
    if (f === "all" || f === "received") viewed.forEach((item) => all.push({...item, from:"view"}));

    const items = [];
    if (edited.length < PHOTO_LIMIT && currentMode === "editor" && (f === "all" || f === "sent")) items.push({type:"add"});
    all.forEach((item) => items.push({type:"photo", data:item}));

    const totalPages = Math.max(1, Math.ceil(items.length / PHOTOS_PER_PAGE));
    if (fotosPage > totalPages) fotosPage = totalPages;
    const start = (fotosPage - 1) * PHOTOS_PER_PAGE;
    const pageItems = items.slice(start, start + PHOTOS_PER_PAGE);

    if (!all.length) { gallery.innerHTML = `<p class="empty-state-msg" style="grid-column:1/-1"><span class="empty-glyph">❑</span>${f==="received"?"No has recibido fotos.":f==="sent"?"No has enviado fotos.":"Sube tu primera foto."}</p>`; }

    pageItems.forEach((entry) => {
      if (entry.type === "add") {
        const c = document.createElement("div"); c.className = "cathedral-frame media-card"; c.style.borderStyle = "dashed";
        c.innerHTML = `<div class="arch-frame" style="cursor:pointer;border-style:dashed;"><label class="upload-prompt" style="cursor:pointer;"><span class="upload-glyph">❑</span><span>Subir foto</span><input type="file" accept="image/*"></label></div><h3 class="card-title">Nueva Foto</h3><p class="card-desc">Quedan ${PHOTO_LIMIT - edited.length}.</p>`;
        c.querySelector('input[type="file"]').addEventListener("change", async (e) => { const file = e.target.files[0]; if (!file) return; const r = new FileReader(); r.onload = async () => { const id = `foto_${currentUser.toLowerCase()}_${Date.now()}`; await MediaStore.save(id, r.result); edited.push({mediaId:id,date:"Fecha",title:"Nuevo Recuerdo",desc:"Descripción...",from:currentUser}); localStorage.setItem(editKey("fotos"),JSON.stringify(edited)); renderPhotos(); }; r.readAsDataURL(file); });
        gallery.appendChild(c); return;
      }
      const item = entry.data;
      const editable = item.from === "edit" && currentMode === "editor";
      const originBadge = `<span class="media-origin-badge ${item.from==='edit'?'sent':'received'}">${item.from==='edit'?'Enviada por ti':'Recibida de '+otherUser(currentUser)}</span>`;
      const card = document.createElement("div"); card.className = `cathedral-frame media-card${item.from==='view'?' from-view':''}`;
      card.innerHTML = `${editable?`<button class="media-edit-btn">✎</button><button class="media-delete-btn">✕</button>`:""}<div class="card-top-bar"><span class="date-tag" ${editable?'contenteditable="true"':''}>${item.date}</span></div><div class="arch-frame" data-media="${item.mediaId||""}"><span class="upload-glyph">⏳</span></div><h3 class="card-title" ${editable?'contenteditable="true"':''}>${item.title}</h3><p class="card-desc" ${editable?'contenteditable="true"':''}>${item.desc}</p>${originBadge}`;
      if (item.mediaId) MediaStore.get(item.mediaId).then((src) => { const fr = card.querySelector(".arch-frame"); if (src) { fr.innerHTML = `<img src="${src}" alt="${item.title}"><div class="frame-overlay"><span>Ampliar</span></div>`; fr.addEventListener("click", () => openLightbox(src)); } else fr.innerHTML = `<span class="upload-glyph">⚠</span>`; });
      if (editable) {
        const de = card.querySelector(".date-tag"), te = card.querySelector(".card-title"), ce = card.querySelector(".card-desc");
        [de,te,ce].forEach((el) => el.addEventListener("blur", () => { edited[item.idx].date = de.textContent.trim(); edited[item.idx].title = te.textContent.trim(); edited[item.idx].desc = ce.textContent.trim(); localStorage.setItem(editKey("fotos"),JSON.stringify(edited)); }));
        card.querySelector(".media-edit-btn").addEventListener("click", () => openPhotoEdit(item, edited));
        card.querySelector(".media-delete-btn").addEventListener("click", async () => { if (!confirm("¿Eliminar?")) return; if (item.mediaId) await MediaStore.delete(item.mediaId); edited.splice(item.idx,1); localStorage.setItem(editKey("fotos"),JSON.stringify(edited)); renderPhotos(); });
      }
      gallery.appendChild(card);
    });
    renderPagination("fotos-pagination", fotosPage, totalPages, (p) => { fotosPage = p; renderPhotos(); });
  }

  // ================= EDITOR DE FOTOS con CROP DRAGGABLE =================
  let photoEdit = { item:null, arr:null, img:null, rotation:0, flipH:1, flipV:1, editMode:"adjust", isProfilePhoto:false, person:null };
  let cropState = { x:0, y:0, w:0, h:0, active:false, drag:null, aspect:"free" };

  async function openPhotoEdit(item, arr) {
    photoEdit.item = item; photoEdit.arr = arr; photoEdit.rotation = 0; photoEdit.flipH = 1; photoEdit.flipV = 1; photoEdit.editMode = "adjust";
    photoStickers = [];
    ["edit-brightness","edit-contrast","edit-saturate","edit-scale"].forEach((id) => document.getElementById(id).value = 100);
    document.getElementById("edit-rotate").value = 0;
    if (document.getElementById("edit-hue")) document.getElementById("edit-hue").value = 0;
    if (document.getElementById("edit-sepia")) document.getElementById("edit-sepia").value = 0;
    initStickerPicker();
    const src = item.mediaId ? await MediaStore.get(item.mediaId) : null;
    if (!src) { alert("No se pudo cargar."); return; }
    const img = new Image();
    img.onload = () => { photoEdit.img = img; renderEditPreview(); initCropOverlay(); };
    img.src = src;
    document.getElementById("photo-edit-modal").classList.remove("hidden");
  }

  window.setEditMode = function (mode) {
    photoEdit.editMode = mode;
    document.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    document.getElementById("adjust-controls").style.display = mode === "adjust" ? "grid" : "none";
    document.getElementById("crop-controls").style.display = mode === "crop" ? "grid" : "none";
    document.getElementById("sticker-controls").style.display = mode === "stickers" ? "grid" : "none";
    document.getElementById("crop-overlay").style.display = mode === "crop" ? "block" : "none";
    // Limpiar overlays de stickers al cambiar de modo
    if (mode !== "stickers") { document.querySelectorAll(".sticker-overlay-item").forEach((el) => el.remove()); }
    if (mode === "crop") initCropOverlay();
    if (mode === "stickers") renderStickerOverlays();
  };

  function initCropOverlay() {
    const canvas = document.getElementById("edit-photo-canvas");
    const overlay = document.getElementById("crop-overlay");
    if (!canvas.width) return;
    // Inicializar recorte a 80% centrado
    if (!cropState.w) { cropState.x = canvas.width * 0.1; cropState.y = canvas.height * 0.1; cropState.w = canvas.width * 0.8; cropState.h = canvas.height * 0.8; }
    updateCropOverlay();
    // Eventos drag (mouse + touch)
    const startDrag = (clientX, clientY, target) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
      cropState.drag = { startX: clientX, startY: clientY, origX: cropState.x, origY: cropState.y, origW: cropState.w, origH: cropState.h, handle: target.dataset.handle || "move", scaleX, scaleY };
    };
    overlay.addEventListener("mousedown", (e) => { e.preventDefault(); startDrag(e.clientX, e.clientY, e.target); });
    overlay.addEventListener("touchstart", (e) => { e.preventDefault(); const t = e.touches[0]; startDrag(t.clientX, t.clientY, e.target); });
    document.addEventListener("mousemove", dragCrop);
    document.addEventListener("touchmove", dragCropTouch, { passive: false });
    document.addEventListener("mouseup", endDrag);
    document.addEventListener("touchend", endDrag);
  }

  function dragCrop(e) { if (!cropState.drag) return; doDrag(e.clientX, e.clientY); }
  function dragCropTouch(e) { if (!cropState.drag) return; e.preventDefault(); const t = e.touches[0]; doDrag(t.clientX, t.clientY); }
  function doDrag(cx, cy) {
    const d = cropState.drag; const canvas = document.getElementById("edit-photo-canvas");
    const dx = (cx - d.startX) * d.scaleX, dy = (cy - d.startY) * d.scaleY;
    if (d.handle === "move") { cropState.x = Math.max(0, Math.min(canvas.width - cropState.w, d.origX + dx)); cropState.y = Math.max(0, Math.min(canvas.height - cropState.h, d.origY + dy)); }
    else {
      let nx = d.origX, ny = d.origY, nw = d.origW, nh = d.origH;
      if (d.handle.includes("l")) { nx = d.origX + dx; nw = d.origW - dx; }
      if (d.handle.includes("r")) { nw = d.origW + dx; }
      if (d.handle.includes("t")) { ny = d.origY + dy; nh = d.origH - dy; }
      if (d.handle.includes("b")) { nh = d.origH + dy; }
      // Mantener aspecto si fijado
      if (cropState.aspect !== "free") {
        const ar = cropState.aspect === "1:1" ? 1 : cropState.aspect === "4:3" ? 4/3 : 16/9;
        if (Math.abs(dx) > Math.abs(dy)) nh = nw / ar; else nw = nh * ar;
        if (d.handle.includes("t")) ny = d.origY + (d.origH - nh);
      }
      // Mínimo y límites
      if (nw > 30 && nh > 30 && nx >= 0 && ny >= 0 && nx + nw <= canvas.width && ny + nh <= canvas.height) { cropState.x = nx; cropState.y = ny; cropState.w = nw; cropState.h = nh; }
    }
    updateCropOverlay();
  }
  function endDrag() { cropState.drag = null; }

  function updateCropOverlay() {
    const canvas = document.getElementById("edit-photo-canvas");
    const overlay = document.getElementById("crop-overlay");
    const rect = canvas.getBoundingClientRect();
    const container = document.getElementById("crop-container");
    if (!container) return;
    // Escalar a tamaño display
    const scaleX = rect.width / canvas.width, scaleY = rect.height / canvas.height;
    overlay.style.left = (cropState.x * scaleX) + "px";
    overlay.style.top = (cropState.y * scaleY) + "px";
    overlay.style.width = (cropState.w * scaleX) + "px";
    overlay.style.height = (cropState.h * scaleY) + "px";
  }

  // Stickers state
  let photoStickers = [];
  const STICKER_EMOJIS = ["♥","❤","❥","❣","♛","♚","✠","❖","✧","⚜","✿","❀","★","✦","☀","☾","✨","🌹","💋","💍","💘","💕","💞","👑","🔥","⚡","💎","🎀","🎁","🎶","💌","💒"];

  window.renderEditPreview = function () {
    const canvas = document.getElementById("edit-photo-canvas");
    const ctx = canvas.getContext("2d");
    const img = photoEdit.img; if (!img) return;
    const br = document.getElementById("edit-brightness").value;
    const ct = document.getElementById("edit-contrast").value;
    const sa = document.getElementById("edit-saturate").value;
    const sc = document.getElementById("edit-scale").value / 100;
    const ro = parseFloat(document.getElementById("edit-rotate").value) + photoEdit.rotation;
    const hue = document.getElementById("edit-hue") ? document.getElementById("edit-hue").value : 0;
    const sepia = document.getElementById("edit-sepia") ? document.getElementById("edit-sepia").value : 0;
    document.getElementById("edit-brightness-val").textContent = br + "%";
    document.getElementById("edit-contrast-val").textContent = ct + "%";
    document.getElementById("edit-saturate-val").textContent = sa + "%";
    document.getElementById("edit-scale-val").textContent = (sc*100).toFixed(0) + "%";
    document.getElementById("edit-rotate-val").textContent = ro + "°";
    if (document.getElementById("edit-hue-val")) document.getElementById("edit-hue-val").textContent = hue + "°";
    if (document.getElementById("edit-sepia-val")) document.getElementById("edit-sepia-val").textContent = sepia + "%";
    const ang = ro * Math.PI / 180;
    const w = img.width * sc, h = img.height * sc;
    const sin = Math.abs(Math.sin(ang)), cos = Math.abs(Math.cos(ang));
    canvas.width = Math.max(1, w * cos + h * sin); canvas.height = Math.max(1, w * sin + h * cos);
    ctx.filter = `brightness(${br}%) contrast(${ct}%) saturate(${sa}%) hue-rotate(${hue}deg) sepia(${sepia}%)`;
    ctx.save(); ctx.translate(canvas.width/2, canvas.height/2); ctx.rotate(ang);
    ctx.scale(photoEdit.flipH * sc, photoEdit.flipV * sc);
    ctx.drawImage(img, -img.width/2, -img.height/2); ctx.restore(); ctx.filter = "none";
    // Render stickers onto canvas
    photoStickers.forEach((s) => {
      ctx.font = `${s.size}px serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(s.emoji, s.x, s.y);
    });
    // Reset crop si cambió el tamaño
    cropState.w = 0; if (photoEdit.editMode === "crop") setTimeout(initCropOverlay, 50);
    if (photoEdit.editMode === "stickers") renderStickerOverlays();
  };

  function renderStickerOverlays() {
    const container = document.getElementById("crop-container");
    if (!container) return;
    container.querySelectorAll(".sticker-overlay-item").forEach((el) => el.remove());
    const canvas = document.getElementById("edit-photo-canvas");
    if (!canvas || !canvas.width) return;
    const cRect = canvas.getBoundingClientRect();
    const contRect = container.getBoundingClientRect();
    // Offset del canvas dentro del container
    const offsetX = cRect.left - contRect.left;
    const offsetY = cRect.top - contRect.top;
    const scaleX = cRect.width / canvas.width;
    const scaleY = cRect.height / canvas.height;
    photoStickers.forEach((s, i) => {
      const el = document.createElement("div");
      el.className = "sticker-overlay-item";
      el.style.fontSize = (s.size * scaleX) + "px";
      el.style.left = (offsetX + s.x * scaleX - s.size * scaleX / 2) + "px";
      el.style.top = (offsetY + s.y * scaleY - s.size * scaleY / 2) + "px";
      el.textContent = s.emoji;
      const delBtn = document.createElement("button");
      delBtn.className = "sticker-delete";
      delBtn.textContent = "✕";
      delBtn.addEventListener("click", (ev) => { ev.stopPropagation(); photoStickers.splice(i, 1); renderStickerOverlays(); });
      el.appendChild(delBtn);
      el.dataset.idx = i;
      container.appendChild(el);
    });
  }

  // Drag de stickers: manejadores globales únicos
  let stickerDragInfo = null;
  document.addEventListener("mousemove", (e) => {
    if (!stickerDragInfo) return;
    const canvas = document.getElementById("edit-photo-canvas");
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
    const dx = (e.clientX - stickerDragInfo.cx) * scaleX;
    const dy = (e.clientY - stickerDragInfo.cy) * scaleY;
    photoStickers[stickerDragInfo.idx].x = stickerDragInfo.ox + dx;
    photoStickers[stickerDragInfo.idx].y = stickerDragInfo.oy + dy;
    renderStickerOverlays();
  });
  document.addEventListener("touchmove", (e) => {
    if (!stickerDragInfo) return;
    e.preventDefault();
    const t = e.touches[0];
    const canvas = document.getElementById("edit-photo-canvas");
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
    const dx = (t.clientX - stickerDragInfo.cx) * scaleX;
    const dy = (t.clientY - stickerDragInfo.cy) * scaleY;
    photoStickers[stickerDragInfo.idx].x = stickerDragInfo.ox + dx;
    photoStickers[stickerDragInfo.idx].y = stickerDragInfo.oy + dy;
    renderStickerOverlays();
  }, { passive: false });
  document.addEventListener("mouseup", () => { if (stickerDragInfo) { stickerDragInfo = null; renderEditPreview(); } });
  document.addEventListener("touchend", () => { if (stickerDragInfo) { stickerDragInfo = null; renderEditPreview(); } });

  // Inicializar drag en overlays de stickers (delegación de eventos)
  document.addEventListener("mousedown", (e) => {
    const el = e.target.closest(".sticker-overlay-item");
    if (!el || el.classList.contains("sticker-delete")) return;
    const idx = parseInt(el.dataset.idx);
    const canvas = document.getElementById("edit-photo-canvas");
    const rect = canvas.getBoundingClientRect();
    stickerDragInfo = { idx, cx: e.clientX, cy: e.clientY, ox: photoStickers[idx].x, oy: photoStickers[idx].y };
    e.preventDefault();
  });
  document.addEventListener("touchstart", (e) => {
    const el = e.target.closest(".sticker-overlay-item");
    if (!el || e.target.classList.contains("sticker-delete")) return;
    const idx = parseInt(el.dataset.idx);
    const canvas = document.getElementById("edit-photo-canvas");
    stickerDragInfo = { idx, cx: e.touches[0].clientX, cy: e.touches[0].clientY, ox: photoStickers[idx].x, oy: photoStickers[idx].y };
    e.preventDefault();
  }, { passive: false });

  function initStickerPicker() {
    const picker = document.getElementById("sticker-picker");
    if (!picker) return;
    picker.innerHTML = "";
    STICKER_EMOJIS.forEach((emoji) => {
      const btn = document.createElement("button");
      btn.className = "sticker-btn";
      btn.textContent = emoji;
      btn.addEventListener("click", () => {
        const canvas = document.getElementById("edit-photo-canvas");
        photoStickers.push({ emoji, x: canvas.width / 2, y: canvas.height / 2, size: 60 });
        renderStickerOverlays();
        renderEditPreview();
      });
      picker.appendChild(btn);
    });
  }

  window.rotatePhoto = function (deg) { const s = document.getElementById("edit-rotate"); s.value = parseFloat(s.value) + deg; renderEditPreview(); };
  window.flipPhoto = function (axis) { if (axis==="h") photoEdit.flipH *= -1; else photoEdit.flipV *= -1; renderEditPreview(); };

  window.cropSetAspect = function (a) { cropState.aspect = a; if (a !== "free") { const canvas = document.getElementById("edit-photo-canvas"); const ar = a==="1:1"?1:a==="4:3"?4/3:16/9; cropState.w = Math.min(canvas.width * 0.8, canvas.height * 0.8 * ar); cropState.h = cropState.w / ar; cropState.x = (canvas.width - cropState.w) / 2; cropState.y = (canvas.height - cropState.h) / 2; updateCropOverlay(); } };

  window.cropReset = function () { cropState.w = 0; initCropOverlay(); };

  window.cropApply = function () {
    const canvas = document.getElementById("edit-photo-canvas");
    const ctx = canvas.getContext("2d");
    const temp = document.createElement("canvas");
    temp.width = cropState.w; temp.height = cropState.h;
    temp.getContext("2d").drawImage(canvas, cropState.x, cropState.y, cropState.w, cropState.h, 0, 0, cropState.w, cropState.h);
    const img = new Image();
    img.onload = () => { photoEdit.img = img; photoEdit.rotation = 0; photoEdit.flipH = 1; photoEdit.flipV = 1; document.getElementById("edit-rotate").value = 0; cropState.w = 0; renderEditPreview(); };
    img.src = temp.toDataURL();
  };

  window.resetPhotoEdit = function () { photoEdit.rotation = 0; photoEdit.flipH = 1; photoEdit.flipV = 1; photoStickers = []; ["edit-brightness","edit-contrast","edit-saturate","edit-scale"].forEach((id) => document.getElementById(id).value = 100); document.getElementById("edit-rotate").value = 0; if (document.getElementById("edit-hue")) document.getElementById("edit-hue").value = 0; if (document.getElementById("edit-sepia")) document.getElementById("edit-sepia").value = 0; cropState.w = 0; document.querySelectorAll(".sticker-overlay-item").forEach((el) => el.remove()); renderEditPreview(); };

  window.savePhotoEdit = async function () {
    const canvas = document.getElementById("edit-photo-canvas");
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    if (photoEdit.item.mediaId) await MediaStore.save(photoEdit.item.mediaId, dataUrl);
    // Si es foto de perfil, actualizar el perfil
    if (photoEdit.isProfilePhoto && photoEdit.person) {
      const profile = getProfile(photoEdit.person);
      profile.photo = dataUrl;
      saveProfile(photoEdit.person, profile);
      photoEdit.isProfilePhoto = false;
      photoEdit.person = null;
      closePhotoEdit();
      renderProfiles();
      openSacredModal({ icon:"✓", title:"Foto de Perfil Guardada", text:"La foto de perfil se ha editado y guardado.", actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal()">Continuar</button>` });
      return;
    }
    closePhotoEdit();
    renderPhotos();
    openSacredModal({ icon:"✓", title:"Foto Guardada", text:"La foto se ha editado y guardado correctamente.", actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal()">Continuar</button>` });
  };

  window.closePhotoEdit = function (e) { if (e) e.stopPropagation(); document.getElementById("photo-edit-modal").classList.add("hidden"); cropState = { x:0, y:0, w:0, h:0, active:false, drag:null, aspect:"free" }; };

  // ================= VIDEOS (1000) con EDICIÓN COMPLETA =================
  const VIDEO_LIMIT = 1000, VIDEOS_PER_PAGE = 6;
  let videosPage = 1;
  function loadVideos() { return { edited: JSON.parse(localStorage.getItem(editKey("videos"))||"[]"), viewed: JSON.parse(localStorage.getItem(viewKey("videos"))||"[]") }; }
  function renderVideosCounter(edited) { const el = document.getElementById("videos-counter"); if (!el||!currentUser) return; const { viewed } = loadVideos(); const pct = Math.min(100,(edited.length/VIDEO_LIMIT)*100); el.innerHTML = `<span class="counter-label">Tuyos: ${edited.length}/${VIDEO_LIMIT} · Recibidos: ${viewed.length}</span><span class="counter-value">${edited.length}<span class="counter-max"> / ${VIDEO_LIMIT}</span></span><div class="counter-progress"><div class="counter-progress-fill" style="width:${pct}%"></div></div>`; }

  let videoEdit = { item:null, arr:null, flipH:1, flipV:1, stickers:[] };

  function renderVideos() {
    setSectionContext("videos-context");
    renderFilterBar("videos-filter", "videos", renderVideos);
    const { edited, viewed } = loadVideos();
    renderVideosCounter(edited);
    const gallery = document.getElementById("video-gallery"); if (!gallery||!currentUser) return;
    gallery.innerHTML = "";
    let all = []; const f = mediaFilters.videos;
    if (f === "all" || f === "sent") edited.forEach((item, i) => all.push({...item, from:"edit", idx:i}));
    if (f === "all" || f === "received") viewed.forEach((item) => all.push({...item, from:"view"}));
    const items = [];
    if (edited.length < VIDEO_LIMIT && currentMode === "editor" && (f === "all" || f === "sent")) items.push({type:"add"});
    all.forEach((item) => items.push({type:"video", data:item}));
    const totalPages = Math.max(1, Math.ceil(items.length / VIDEOS_PER_PAGE));
    if (videosPage > totalPages) videosPage = totalPages;
    const start = (videosPage - 1) * VIDEOS_PER_PAGE;
    const pageItems = items.slice(start, start + VIDEOS_PER_PAGE);
    if (!all.length) { gallery.innerHTML = `<p class="empty-state-msg" style="grid-column:1/-1"><span class="empty-glyph">▷</span>${f==="received"?"No has recibido videos.":f==="sent"?"No has enviado videos.":"Sube tu primer video."}</p>`; }
    pageItems.forEach((entry) => {
      if (entry.type === "add") {
        const c = document.createElement("div"); c.className = "cathedral-frame media-card"; c.style.borderStyle = "dashed";
        c.innerHTML = `<div class="video-frame" style="cursor:pointer;border-style:dashed;"><label class="upload-prompt" style="cursor:pointer;"><span class="upload-glyph">▷</span><span>Subir video</span><input type="file" accept="video/*"></label></div><h3 class="card-title">Nuevo Video</h3><p class="card-desc">Máx 500MB. Quedan ${VIDEO_LIMIT - edited.length}.</p>`;
        c.querySelector('input[type="file"]').addEventListener("change", async (e) => { const file = e.target.files[0]; if (!file) return; if (file.size > 500*1024*1024) { alert("Video demasiado grande (máx 500MB)."); return; } const r = new FileReader(); r.onload = async () => { const id = `video_${currentUser.toLowerCase()}_${Date.now()}`; await MediaStore.save(id, r.result); edited.push({mediaId:id,date:"Fecha",title:"Nuevo Video",desc:"Descripción...",from:currentUser,trimStart:0,trimEnd:0,speed:1,size:100,muted:true,loop:false,rotation:0,flipH:1,flipV:1,brightness:100,contrast:100,saturate:100,hue:0,sepia:0,cropX:50,cropY:50,cropZoom:100,stickers:[]}); localStorage.setItem(editKey("videos"),JSON.stringify(edited)); renderVideos(); }; r.readAsDataURL(file); });
        gallery.appendChild(c); return;
      }
      const item = entry.data;
      const editable = item.from === "edit" && currentMode === "editor";
      const originBadge = `<span class="media-origin-badge ${item.from==='edit'?'sent':'received'}">${item.from==='edit'?'Enviado por ti':'Recibido de '+otherUser(currentUser)}</span>`;
      const card = document.createElement("div"); card.className = `cathedral-frame media-card${item.from==='view'?' from-view':''}`;
      card.innerHTML = `${editable?`<button class="media-edit-btn">✎</button><button class="media-delete-btn">✕</button>`:""}<div class="card-top-bar"><span class="date-tag" ${editable?'contenteditable="true"':''}>${item.date}</span></div><div class="video-frame" data-media="${item.mediaId||""}"><span class="upload-glyph">⏳</span></div><h3 class="card-title" ${editable?'contenteditable="true"':''}>${item.title}</h3><p class="card-desc" ${editable?'contenteditable="true"':''}>${item.desc}</p>${originBadge}`;
      if (item.mediaId) MediaStore.get(item.mediaId).then((src) => {
        const fr = card.querySelector(".video-frame");
        if (src) {
          // Crear contenedor de video con controles personalizados (SIN botón de volumen)
          const wrapper = document.createElement("div");
          wrapper.style.cssText = "position:relative;width:100%;height:100%;overflow:hidden;";
          const v = document.createElement("video");
          // AUDIO ELIMINADO DEFINITIVAMENTE: muted siempre, sin controls nativos
          v.setAttribute("muted", "muted");
          v.muted = true;
          v.playsInline = true;
          v.preload = "metadata";
          if (item.loop) v.loop = true;
          v.playbackRate = item.speed || 1;
          // Sin v.controls = true para ocultar controles nativos (incluido volumen)
          let transform = "";
          if (item.rotation) transform += ` rotate(${item.rotation}deg)`;
          if (item.flipH === -1) transform += " scaleX(-1)";
          if (item.flipV === -1) transform += " scaleY(-1)";
          if (item.size && item.size !== 100) transform += ` scale(${item.size/100})`;
          if (item.cropZoom && item.cropZoom > 100) transform += ` scale(${item.cropZoom/100})`;
          const cropX = item.cropX || 50, cropY = item.cropY || 50;
          if (transform) { v.style.transform = transform.trim(); v.style.transformOrigin = `${cropX}% ${cropY}%`; }
          let filter = "";
          if (item.brightness && item.brightness !== 100) filter += ` brightness(${item.brightness}%)`;
          if (item.contrast && item.contrast !== 100) filter += ` contrast(${item.contrast}%)`;
          if (item.saturate && item.saturate !== 100) filter += ` saturate(${item.saturate}%)`;
          if (item.hue) filter += ` hue-rotate(${item.hue}deg)`;
          if (item.sepia) filter += ` sepia(${item.sepia}%)`;
          if (filter) v.style.filter = filter.trim();
          v.style.width = "100%"; v.style.height = "100%"; v.style.objectFit = "cover";
          v.src = src;
          // Reforzar muted
          const applyMuted = () => { v.muted = true; v.setAttribute("muted", "muted"); v.playbackRate = item.speed || 1; };
          v.addEventListener("loadedmetadata", applyMuted);
          v.addEventListener("canplay", applyMuted);
          v.addEventListener("play", applyMuted);
          // Trim
          if (item.trimEnd > 0) {
            v.addEventListener("timeupdate", () => { if (v.currentTime >= item.trimEnd) { if (item.loop) { v.currentTime = item.trimStart || 0; v.play().catch(()=>{}); } else v.pause(); } });
            v.addEventListener("loadedmetadata", () => { if (item.trimStart > 0) v.currentTime = item.trimStart; });
          }
          wrapper.appendChild(v);
          // Botón play/pause personalizado (sin volumen)
          const playBtn = document.createElement("div");
          playBtn.style.cssText = "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:60px;height:60px;border-radius:50%;background:rgba(184,0,0,0.7);border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:1.8rem;color:#fff;cursor:pointer;z-index:5;transition:opacity 0.3s;";
          playBtn.innerHTML = "▶";
          playBtn.addEventListener("click", (ev) => { ev.stopPropagation(); if (v.paused) { v.play().catch(()=>{}); playBtn.innerHTML = "⏸"; playBtn.style.opacity = "0"; } else { v.pause(); playBtn.innerHTML = "▶"; playBtn.style.opacity = "1"; } });
          wrapper.appendChild(playBtn);
          v.addEventListener("play", () => { playBtn.innerHTML = "⏸"; playBtn.style.opacity = "0"; });
          v.addEventListener("pause", () => { playBtn.innerHTML = "▶"; playBtn.style.opacity = "1"; });
          v.addEventListener("ended", () => { playBtn.innerHTML = "▶"; playBtn.style.opacity = "1"; });
          // Barra de progreso personalizada (sin volumen)
          const progressBar = document.createElement("div");
          progressBar.style.cssText = "position:absolute;bottom:0;left:0;right:0;height:6px;background:rgba(0,0,0,0.6);cursor:pointer;z-index:5;";
          const progressFill = document.createElement("div");
          progressFill.style.cssText = "height:100%;width:0%;background:var(--crimson-glow);transition:width 0.1s;";
          progressBar.appendChild(progressFill);
          progressBar.addEventListener("click", (ev) => { ev.stopPropagation(); const rect = progressBar.getBoundingClientRect(); const pct = (ev.clientX - rect.left) / rect.width; v.currentTime = pct * v.duration; });
          wrapper.appendChild(progressBar);
          v.addEventListener("timeupdate", () => { if (v.duration) progressFill.style.width = (v.currentTime / v.duration * 100) + "%"; });
          // Añadir stickers guardados como overlays
          if (item.stickers && item.stickers.length) {
            item.stickers.forEach((s) => {
              const stEl = document.createElement("div");
              stEl.style.cssText = `position:absolute;font-size:${s.size}px;left:${s.x}%;top:${s.y}%;transform:translate(-50%,-50%);pointer-events:none;z-index:4;text-shadow:0 0 8px rgba(0,0,0,0.8);`;
              stEl.textContent = s.emoji;
              wrapper.appendChild(stEl);
            });
          }
          fr.innerHTML = ""; fr.appendChild(wrapper);
        } else fr.innerHTML = `<span class="upload-glyph">⚠</span>`;
      });
      if (editable) {
        const de = card.querySelector(".date-tag"), te = card.querySelector(".card-title"), ce = card.querySelector(".card-desc");
        [de,te,ce].forEach((el) => el.addEventListener("blur", () => { edited[item.idx].date = de.textContent.trim(); edited[item.idx].title = te.textContent.trim(); edited[item.idx].desc = ce.textContent.trim(); localStorage.setItem(editKey("videos"),JSON.stringify(edited)); }));
        card.querySelector(".media-edit-btn").addEventListener("click", () => openVideoEdit(item, edited));
        card.querySelector(".media-delete-btn").addEventListener("click", async () => { if (!confirm("¿Eliminar?")) return; if (item.mediaId) await MediaStore.delete(item.mediaId); edited.splice(item.idx,1); localStorage.setItem(editKey("videos"),JSON.stringify(edited)); renderVideos(); });
      }
      gallery.appendChild(card);
    });
    renderPagination("videos-pagination", videosPage, totalPages, (p) => { videosPage = p; renderVideos(); });
  }

  // ================= EDITOR DE VIDEO (con transforms de foto) =================
  async function openVideoEdit(item, arr) {
    videoEdit.item = item; videoEdit.arr = arr;
    const src = item.mediaId ? await MediaStore.get(item.mediaId) : null;
    if (!src) { alert("No se pudo cargar."); return; }
    const v = document.getElementById("edit-video-preview");
    v.src = src;
    // Cargar valores guardados
    document.getElementById("vedit-brightness").value = item.brightness || 100;
    document.getElementById("vedit-contrast").value = item.contrast || 100;
    document.getElementById("vedit-saturate").value = item.saturate || 100;
    document.getElementById("vedit-scale").value = item.size || 100;
    document.getElementById("vedit-rotate").value = item.rotation || 0;
    if (document.getElementById("vedit-hue")) document.getElementById("vedit-hue").value = item.hue || 0;
    if (document.getElementById("vedit-sepia")) document.getElementById("vedit-sepia").value = item.sepia || 0;
    if (document.getElementById("vedit-cropx")) document.getElementById("vedit-cropx").value = item.cropX || 50;
    if (document.getElementById("vedit-cropy")) document.getElementById("vedit-cropy").value = item.cropY || 50;
    if (document.getElementById("vedit-cropzoom")) document.getElementById("vedit-cropzoom").value = item.cropZoom || 100;
    videoEdit.stickers = item.stickers || [];
    initVideoStickerPicker();
    document.getElementById("video-trim-start").value = item.trimStart || 0;
    document.getElementById("video-trim-end").value = item.trimEnd || 0;
    document.getElementById("video-speed").value = item.speed || 1;
    // Muted checkbox removed - all videos muted
    document.getElementById("video-loop").checked = !!item.loop;
    videoEdit.flipH = item.flipH || 1; videoEdit.flipV = item.flipV || 1;
    v.onloadedmetadata = () => { document.getElementById("video-duration").textContent = v.duration.toFixed(1) + "s"; if (!item.trimEnd) document.getElementById("video-trim-end").value = v.duration.toFixed(1); applyVideoFilters(); };
    applyVideoFilters();
    document.getElementById("video-edit-modal").classList.remove("hidden");
  }

  window.setVideoEditMode = function (mode) {
    document.querySelectorAll('[data-vmode]').forEach((b) => b.classList.toggle("active", b.dataset.vmode === mode));
    document.getElementById("vadjust-controls").style.display = mode === "adjust" ? "grid" : "none";
    document.getElementById("vcrop-controls").style.display = mode === "crop" ? "grid" : "none";
    document.getElementById("vsticker-controls").style.display = mode === "stickers" ? "grid" : "none";
  };

  function initVideoStickerPicker() {
    const picker = document.getElementById("vsticker-picker");
    if (!picker) return;
    picker.innerHTML = "";
    STICKER_EMOJIS.forEach((emoji) => {
      const btn = document.createElement("button");
      btn.className = "sticker-btn";
      btn.textContent = emoji;
      btn.addEventListener("click", () => {
        if (!videoEdit.stickers) videoEdit.stickers = [];
        videoEdit.stickers.push({ emoji, x: 50, y: 50, size: 40 });
        renderVideoStickers();
      });
      picker.appendChild(btn);
    });
    renderVideoStickers();
  }

  function renderVideoStickers() {
    const wrap = document.getElementById("video-preview-wrap");
    if (!wrap) return;
    wrap.querySelectorAll(".vsticker").forEach((el) => el.remove());
    if (!videoEdit.stickers) return;
    videoEdit.stickers.forEach((s, i) => {
      const el = document.createElement("div");
      el.className = "sticker-overlay-item vsticker";
      el.style.cssText = `position:absolute;font-size:${s.size}px;left:${s.x}%;top:${s.y}%;transform:translate(-50%,-50%);cursor:move;z-index:10;`;
      el.textContent = s.emoji;
      el.dataset.idx = i;
      const del = document.createElement("button");
      del.className = "sticker-delete";
      del.textContent = "✕";
      del.addEventListener("click", (ev) => { ev.stopPropagation(); videoEdit.stickers.splice(i, 1); renderVideoStickers(); });
      el.appendChild(del);
      // Drag
      let drag = null;
      el.addEventListener("mousedown", (ev) => { if (ev.target === del) return; drag = { x: ev.clientX, y: ev.clientY, ox: s.x, oy: s.y }; ev.preventDefault(); });
      el.addEventListener("touchstart", (ev) => { if (ev.target === del) return; drag = { x: ev.touches[0].clientX, y: ev.touches[0].clientY, ox: s.x, oy: s.y }; ev.preventDefault(); }, { passive: false });
      document.addEventListener("mousemove", (ev) => { if (!drag) return; const rect = wrap.getBoundingClientRect(); s.x = Math.max(0, Math.min(100, drag.ox + (ev.clientX - drag.x) / rect.width * 100)); s.y = Math.max(0, Math.min(100, drag.oy + (ev.clientY - drag.y) / rect.height * 100)); el.style.left = s.x + "%"; el.style.top = s.y + "%"; });
      document.addEventListener("touchmove", (ev) => { if (!drag) return; ev.preventDefault(); const t = ev.touches[0]; const rect = wrap.getBoundingClientRect(); s.x = Math.max(0, Math.min(100, drag.ox + (t.clientX - drag.x) / rect.width * 100)); s.y = Math.max(0, Math.min(100, drag.oy + (t.clientY - drag.y) / rect.height * 100)); el.style.left = s.x + "%"; el.style.top = s.y + "%"; }, { passive: false });
      document.addEventListener("mouseup", () => { drag = null; });
      document.addEventListener("touchend", () => { drag = null; });
      wrap.appendChild(el);
    });
  }

  window.applyVideoFilters = function () {
    const v = document.getElementById("edit-video-preview");
    const br = document.getElementById("vedit-brightness").value;
    const ct = document.getElementById("vedit-contrast").value;
    const sa = document.getElementById("vedit-saturate").value;
    const sc = document.getElementById("vedit-scale").value;
    const ro = document.getElementById("vedit-rotate").value;
    const hue = document.getElementById("vedit-hue") ? document.getElementById("vedit-hue").value : 0;
    const sepia = document.getElementById("vedit-sepia") ? document.getElementById("vedit-sepia").value : 0;
    const cropX = document.getElementById("vedit-cropx") ? document.getElementById("vedit-cropx").value : 50;
    const cropY = document.getElementById("vedit-cropy") ? document.getElementById("vedit-cropy").value : 50;
    const cropZoom = document.getElementById("vedit-cropzoom") ? document.getElementById("vedit-cropzoom").value : 100;
    document.getElementById("vedit-brightness-val").textContent = br + "%";
    document.getElementById("vedit-contrast-val").textContent = ct + "%";
    document.getElementById("vedit-saturate-val").textContent = sa + "%";
    document.getElementById("vedit-scale-val").textContent = sc + "%";
    document.getElementById("vedit-rotate-val").textContent = ro + "°";
    if (document.getElementById("vedit-hue-val")) document.getElementById("vedit-hue-val").textContent = hue + "°";
    if (document.getElementById("vedit-sepia-val")) document.getElementById("vedit-sepia-val").textContent = sepia + "%";
    if (document.getElementById("vedit-cropx-val")) document.getElementById("vedit-cropx-val").textContent = cropX + "%";
    if (document.getElementById("vedit-cropy-val")) document.getElementById("vedit-cropy-val").textContent = cropY + "%";
    if (document.getElementById("vedit-cropzoom-val")) document.getElementById("vedit-cropzoom-val").textContent = cropZoom + "%";
    let transform = `rotate(${ro}deg)`;
    if (videoEdit.flipH === -1) transform += " scaleX(-1)";
    if (videoEdit.flipV === -1) transform += " scaleY(-1)";
    transform += ` scale(${sc/100})`;
    // Aplicar zoom de recorte
    if (cropZoom > 100) transform += ` scale(${cropZoom/100})`;
    v.style.transform = transform;
    v.style.transformOrigin = `${cropX}% ${cropY}%`;
    v.style.filter = `brightness(${br}%) contrast(${ct}%) saturate(${sa}%) hue-rotate(${hue}deg) sepia(${sepia}%)`;
  };

  window.videoRotate = function (deg) { const s = document.getElementById("vedit-rotate"); s.value = parseFloat(s.value) + deg; applyVideoFilters(); };
  window.videoFlip = function (axis) { if (axis==="h") videoEdit.flipH *= -1; else videoEdit.flipV *= -1; applyVideoFilters(); };

  window.saveVideoEdit = function () {
    if (!videoEdit.item) return;
    // FIX: actualizar el elemento ORIGINAL en el array por índice (no la copia)
    const idx = videoEdit.item.idx;
    if (idx === undefined || !videoEdit.arr[idx]) { alert("Error: no se encontró el video."); return; }
    const orig = videoEdit.arr[idx];
    orig.brightness = parseInt(document.getElementById("vedit-brightness").value);
    orig.contrast = parseInt(document.getElementById("vedit-contrast").value);
    orig.saturate = parseInt(document.getElementById("vedit-saturate").value);
    orig.size = parseInt(document.getElementById("vedit-scale").value);
    orig.rotation = parseFloat(document.getElementById("vedit-rotate").value);
    orig.flipH = videoEdit.flipH;
    orig.flipV = videoEdit.flipV;
    orig.trimStart = parseFloat(document.getElementById("video-trim-start").value) || 0;
    orig.trimEnd = parseFloat(document.getElementById("video-trim-end").value) || 0;
    orig.speed = parseFloat(document.getElementById("video-speed").value) || 1;
    // Audio eliminado definitivamente: siempre muted = true
    orig.muted = true;
    orig.loop = document.getElementById("video-loop").checked;
    // Guardar hue y sepia si existen
    orig.hue = document.getElementById("vedit-hue") ? parseInt(document.getElementById("vedit-hue").value) : 0;
    orig.sepia = document.getElementById("vedit-sepia") ? parseInt(document.getElementById("vedit-sepia").value) : 0;
    // Guardar recorte
    orig.cropX = document.getElementById("vedit-cropx") ? parseInt(document.getElementById("vedit-cropx").value) : 50;
    orig.cropY = document.getElementById("vedit-cropy") ? parseInt(document.getElementById("vedit-cropy").value) : 50;
    orig.cropZoom = document.getElementById("vedit-cropzoom") ? parseInt(document.getElementById("vedit-cropzoom").value) : 100;
    // Guardar stickers
    orig.stickers = videoEdit.stickers || [];
    localStorage.setItem(editKey("videos"), JSON.stringify(videoEdit.arr));
    closeVideoEdit();
    renderVideos();
    openSacredModal({ icon:"✓", title:"Video Guardado", text:"Los cambios se han guardado. El video se muestra sin audio.", actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal()">Continuar</button>` });
  };

  window.closeVideoEdit = function (e) { if (e) e.stopPropagation(); document.getElementById("video-edit-modal").classList.add("hidden"); const v = document.getElementById("edit-video-preview"); v.pause(); v.src = ""; };

  // ================= CANCIONES (500) con SPOTIFY AUTO =================
  const SONG_LIMIT = 500, SONGS_PER_PAGE = 8;
  let songsPage = 1;
  function loadSongs() { return { edited: JSON.parse(localStorage.getItem(editKey("canciones"))||"[]"), viewed: JSON.parse(localStorage.getItem(viewKey("canciones"))||"[]") }; }
  function renderSongsCounter(edited) { const el = document.getElementById("canciones-counter"); if (!el||!currentUser) return; const { viewed } = loadSongs(); const pct = Math.min(100,(edited.length/SONG_LIMIT)*100); el.innerHTML = `<span class="counter-label">Tuyas: ${edited.length}/${SONG_LIMIT} · Recibidas: ${viewed.length}</span><span class="counter-value">${edited.length}<span class="counter-max"> / ${SONG_LIMIT}</span></span><div class="counter-progress"><div class="counter-progress-fill" style="width:${pct}%"></div></div>`; }

  window.addSongFromSpotify = async function () {
    if (!currentUser || currentMode === "reader") return;
    const urlInput = document.getElementById("spotify-url-input");
    const status = document.getElementById("spotify-status");
    const url = urlInput.value.trim();
    if (!url) return;
    const edited = JSON.parse(localStorage.getItem(editKey("canciones")) || "[]");
    if (edited.length >= SONG_LIMIT) { alert("Límite alcanzado."); return; }
    status.style.display = "block"; status.textContent = "Buscando en Spotify...";
    try {
      // Usar oEmbed de Spotify (no requiere autenticación)
      const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const res = await fetch(oembedUrl);
      if (!res.ok) throw new Error("No encontrado");
      const data = await res.json();
      const title = data.title || "Canción desconocida";
      const cover = data.thumbnail_url || "";
      // Guardar cover en IndexedDB si existe
      let coverId = "";
      if (cover) { coverId = `song_cover_${currentUser.toLowerCase()}_${Date.now()}`; try { const imgRes = await fetch(cover); const blob = await imgRes.blob(); const reader = new FileReader(); await new Promise((r) => { reader.onload = async () => { await MediaStore.save(coverId, reader.result); r(); }; reader.readAsDataURL(blob); }); } catch(e) {} }
      // Extraer track ID para embed
      const trackMatch = url.match(/track\/([a-zA-Z0-9]+)/);
      const trackId = trackMatch ? trackMatch[1] : "";
      const embedUrl = trackId ? `https://open.spotify.com/embed/track/${trackId}` : url;
      edited.push({ mediaId: coverId, titulo: title, artista: "", spotify: url, embedUrl, dedicatoria: "Con amor.", from: currentUser });
      localStorage.setItem(editKey("canciones"), JSON.stringify(edited));
      status.textContent = "¡Añadida!";
      urlInput.value = "";
      setTimeout(() => { status.style.display = "none"; }, 1500);
      renderSongs();
    } catch (err) {
      // Si falla oEmbed, añadir manualmente
      edited.push({ mediaId: "", titulo: "Canción manual", artista: "", spotify: url, embedUrl: "", dedicatoria: "Con amor.", from: currentUser });
      localStorage.setItem(editKey("canciones"), JSON.stringify(edited));
      status.textContent = "Añadida (sin metadata).";
      urlInput.value = "";
      setTimeout(() => { status.style.display = "none"; }, 1500);
      renderSongs();
    }
  };

  function renderSongs() {
    setSectionContext("canciones-context");
    renderFilterBar("canciones-filter", "canciones", renderSongs);
    const { edited, viewed } = loadSongs();
    renderSongsCounter(edited);
    const grid = document.getElementById("songs-grid"); if (!grid||!currentUser) return;
    grid.innerHTML = "";
    let all = []; const f = mediaFilters.canciones;
    if (f === "all" || f === "sent") edited.forEach((item, i) => all.push({...item, from:"edit", idx:i}));
    if (f === "all" || f === "received") viewed.forEach((item) => all.push({...item, from:"view"}));
    const items = all.slice();
    const totalPages = Math.max(1, Math.ceil(items.length / SONGS_PER_PAGE));
    if (songsPage > totalPages) songsPage = totalPages;
    const start = (songsPage - 1) * SONGS_PER_PAGE;
    const pageItems = items.slice(start, start + SONGS_PER_PAGE);
    if (!all.length) { grid.innerHTML = `<p class="empty-state-msg" style="grid-column:1/-1"><span class="empty-glyph">♫</span>${f==="received"?"No has recibido canciones.":f==="sent"?"No has enviado canciones.":"Pega un link de Spotify arriba."}</p>`; }
    pageItems.forEach((item) => {
      const editable = item.from === "edit" && currentMode === "editor";
      const originBadge = `<span class="media-origin-badge ${item.from==='edit'?'sent':'received'}">${item.from==='edit'?'Enviada por ti':'Recibida de '+otherUser(currentUser)}</span>`;
      const card = document.createElement("div"); card.className = "cathedral-frame song-card";
      // Embed con tema rojo: usar theme=3 (alto contraste) y contenedor rojo
      const embedUrlWithTheme = item.embedUrl ? item.embedUrl + "?theme=0" : "";
      const embedHtml = embedUrlWithTheme ? `<div class="spotify-embed" style="background:#750000;border:1px solid var(--crimson-glow);border-radius:8px;overflow:hidden;"><iframe src="${embedUrlWithTheme}" allowfullscreen allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" style="filter:hue-rotate(-10deg) saturate(1.3);"></iframe></div>` : "";
      card.innerHTML = `${editable?`<button class="media-delete-btn">✕</button>`:""}<div class="vinyl-showcase"><div class="album-cover" data-media="${item.mediaId||""}"><span class="upload-glyph">♫</span></div><div class="vinyl-disc"><div class="vinyl-label">K†D</div></div></div><div class="song-details"><h3 class="card-title">${item.titulo}</h3><p class="card-desc">${item.artista||""}</p><p class="card-desc" style="font-style:italic;color:var(--crimson-glow);margin-top:0.4rem;">${item.dedicatoria||""}</p>${embedHtml}<a href="${item.spotify}" target="_blank" class="btn-crimson"><span>♫ Abrir en Spotify</span></a>${originBadge}</div>`;
      if (item.mediaId) MediaStore.get(item.mediaId).then((src) => { const c = card.querySelector(".album-cover"); if (src) c.innerHTML = `<img src="${src}" alt="${item.titulo}">`; });
      if (editable) card.querySelector(".media-delete-btn").addEventListener("click", async () => { if (!confirm("¿Eliminar?")) return; if (item.mediaId) await MediaStore.delete(item.mediaId); edited.splice(item.idx,1); localStorage.setItem(editKey("canciones"),JSON.stringify(edited)); renderSongs(); });
      grid.appendChild(card);
    });
    renderPagination("canciones-pagination", songsPage, totalPages, (p) => { songsPage = p; renderSongs(); });
  }

  // ================= SORPRESAS =================
  const SORPRESA_PLATFORMS = ["Canva","YouTube","TikTok","Instagram","Spotify","Pinterest","Google Drive","Otro"];
  function renderSorpresas() {
    setSectionContext("sorpresas-context");
    const grid = document.getElementById("sorpresas-grid"); if (!grid||!currentUser) return;
    const viewed = JSON.parse(localStorage.getItem(viewKey("sorpresas"))||"[]");
    const edited = JSON.parse(localStorage.getItem(editKey("sorpresas"))||"[]");
    grid.innerHTML = "";
    const all = []; viewed.forEach((i) => all.push({...i,from:"view"})); edited.forEach((i,idx) => all.push({...i,from:"edit",idx}));
    if (!all.length && currentMode !== "editor") { grid.innerHTML = `<p class="empty-state-msg" style="grid-column:1/-1"><span class="empty-glyph">✦</span>${otherUser(currentUser)} no ha añadido sorpresas.</p>`; }
    else if (!all.length) { grid.innerHTML = `<p class="empty-state-msg" style="grid-column:1/-1"><span class="empty-glyph">✦</span>Añade tu primera sorpresa.</p>`; }
    all.forEach((item) => {
      const tag = item.from==="view"?`De ${otherUser(currentUser)}`:`Tuya para ${otherUser(currentUser)}`;
      const editable = item.from==="edit"&&currentMode==="editor";
      const card = document.createElement("div"); card.className = "cathedral-frame sorpresa-card";
      const g = { Canva:"✦",YouTube:"▷",TikTok:"♪",Instagram:"◉",Spotify:"♫",Pinterest:"✿","Google Drive":"❒",Otro:"❖" }[item.platform]||"✦";
      card.innerHTML = `${editable?`<button class="media-delete-btn">✕</button>`:""}<div class="sorpresa-glyph">${g}</div>${editable?`<input type="text" class="sorpresa-title" value="${esc(item.title)}" placeholder="Título..."><select class="sorpresa-platform-select">${SORPRESA_PLATFORMS.map((p)=>`<option ${p===item.platform?"selected":""}>${p}</option>`).join("")}</select><textarea class="sorpresa-desc" rows="2" placeholder="Descripción...">${item.desc||""}</textarea><input type="url" class="sorpresa-link-input" value="${esc(item.url)}" placeholder="https://..."><button class="sorpresa-save-btn" data-idx="${item.idx}">✓ Guardar Link</button><a href="${item.url||"#"}" target="_blank" class="sorpresa-open-btn">⟶ Abrir</a><div class="sorpresa-saved-indicator" data-idx="${item.idx}"></div>`:`<h3 class="card-title">${item.title}</h3><p class="card-desc">${item.desc||""}</p><span class="editor-context-tag">${tag}</span><div class="sorpresa-preview"><iframe src="${item.url||''}" style="width:100%;height:120px;border:0;" loading="lazy" sandbox></iframe></div><a href="${item.url||"#"}" target="_blank" class="sorpresa-open-btn">⟶ Abrir ${item.platform}</a>`}${editable?`<span class="editor-context-tag">${tag}</span>`:""}`;
      if (editable) {
        const te = card.querySelector(".sorpresa-title"), pe = card.querySelector(".sorpresa-platform-select"), de = card.querySelector(".sorpresa-desc"), ue = card.querySelector(".sorpresa-link-input");
        const sv = () => { edited[item.idx].title = te.value.trim(); edited[item.idx].platform = pe.value; edited[item.idx].desc = de.value.trim(); edited[item.idx].url = ue.value.trim(); localStorage.setItem(editKey("sorpresas"),JSON.stringify(edited)); };
        [te,pe,de,ue].forEach((el) => el.addEventListener("blur", sv));
        pe.addEventListener("change", sv);
        const saveBtn = card.querySelector(".sorpresa-save-btn");
        if (saveBtn) saveBtn.addEventListener("click", () => {
          edited[item.idx].title = te.value.trim(); edited[item.idx].platform = pe.value; edited[item.idx].desc = de.value.trim(); edited[item.idx].url = ue.value.trim();
          localStorage.setItem(editKey("sorpresas"),JSON.stringify(edited));
          const ind = card.querySelector(".sorpresa-saved-indicator");
          if (ind) { ind.textContent = "✓ Guardado correctamente"; setTimeout(() => { ind.textContent = ""; }, 2000); }
        });
        card.querySelector(".media-delete-btn").addEventListener("click", () => { edited.splice(item.idx,1); localStorage.setItem(editKey("sorpresas"),JSON.stringify(edited)); renderSorpresas(); });
      }
      grid.appendChild(card);
    });
    if (currentMode === "editor") {
      const add = document.createElement("div"); add.className = "cathedral-frame sorpresa-card sorpresa-add-card";
      add.innerHTML = `<div><div class="sorpresa-glyph">+</div><h3 class="card-title">Añadir Sorpresa</h3><p class="card-desc">Clic para añadir link</p></div>`;
      add.addEventListener("click", () => { const d = JSON.parse(localStorage.getItem(editKey("sorpresas"))||"[]"); d.push({title:"Nueva Sorpresa",platform:"Otro",desc:"",url:""}); localStorage.setItem(editKey("sorpresas"),JSON.stringify(d)); renderSorpresas(); });
      grid.appendChild(add);
    }
  }

  // ================= PAGINACIÓN =================
  function renderPagination(id, cur, total, cb) {
    const el = document.getElementById(id); if (!el) return; el.innerHTML = "";
    if (total <= 1) return;
    const prev = document.createElement("button"); prev.className = "page-btn"; prev.textContent = "◀"; prev.disabled = cur === 1; prev.addEventListener("click", () => cb(cur-1)); el.appendChild(prev);
    let sp = Math.max(1, cur-2), ep = Math.min(total, sp+4); if (ep-sp < 4) sp = Math.max(1, ep-4);
    for (let p = sp; p <= ep; p++) { const b = document.createElement("button"); b.className = "page-btn" + (p===cur?" active":""); b.textContent = p; b.addEventListener("click", () => cb(p)); el.appendChild(b); }
    const next = document.createElement("button"); next.className = "page-btn"; next.textContent = "▶"; next.disabled = cur === total; next.addEventListener("click", () => cb(cur+1)); el.appendChild(next);
    const info = document.createElement("span"); info.className = "page-info"; info.textContent = `Página ${cur} de ${total}`; el.appendChild(info);
  }

  // ================= MENU RETRO DE JUEGOS =================
  const GAMES_LIST = [
    {id:"buscaminas",icon:"✸",name:"Buscaminas",desc:"Despeja casillas, evita bombas de amor"},
    {id:"laberinto",icon:"❖",name:"Laberinto del Amor",desc:"Guía a Kevin hasta Dominic"},
    {id:"sopa",icon:"◉",name:"Sopa de Letras",desc:"Encuentra palabras ocultas"},
    {id:"quiz",icon:"♛",name:"Quiz del Amor",desc:"20 preguntas sobre ustedes"},
    {id:"memoria",icon:"❖",name:"Memoria Carmesí",desc:"Encuentra los pares de símbolos"},
    {id:"ahorcado",icon:"⚜",name:"Ahorcado",desc:"Adivina palabras de amor"},
    {id:"tresraya",icon:"✦",name:"Tres en Raya",desc:"K vs D clásico"},
    {id:"conecta4",icon:"❍",name:"Conecta Cuatro",desc:"Conecta 4 en línea"},
    {id:"simon",icon:"◈",name:"Simón Carmesí",desc:"Memoriza secuencias de luz"},
    {id:"adivina",icon:"✦",name:"Adivina el Número",desc:"1 a 100 con pistas"},
    {id:"rps",icon:"✊",name:"Piedra Papel Tijera",desc:"Vs el Santuario"},
    {id:"ruleta",icon:"❂",name:"Ruleta de Retos",desc:"Gira para retos románticos"},
    {id:"rompecabezas",icon:"◰",name:"Rompecabezas",desc:"Ordena números 1-8"},
    {id:"dado",icon:"⚄",name:"Dado de la Verdad",desc:"Preguntas honestas"},
    {id:"snake",icon:"⥁",name:"Serpiente Carmesí",desc:"Come estrellas sin chocar"},
    {id:"g2048",icon:"▣",name:"2048 Carmesí",desc:"Combina números hasta 2048"},
    {id:"reversi",icon:"◐",name:"Reversi",desc:"Rodea y conquista fichas"},
    {id:"reaccion",icon:"⚡",name:"Test de Reacción",desc:"Clic cuando se ponga rojo"},
    {id:"hanoi",icon:"⋁",name:"Torres de Hanoi",desc:"Mueve discos entre palos"},
    {id:"anagrama",icon:"⟲",name:"Anagrama",desc:"Descifra palabras mezcladas"},
    {id:"matematicas",icon:"≠",name:"Matemáticas Rápidas",desc:"Resuelve en 30 segundos"},
    {id:"trivia",icon:"❓",name:"Trivia Rápida",desc:"Preguntas generales"},
    {id:"colores",icon:"◉",name:"Colores Carmesí",desc:"Encuentra el color diferente"},
    {id:"dardos",icon:"⊕",name:"Dardos del Amor",desc:"Lanza al centro del corazón"},
    {id:"adivinapalabra",icon:"❖",name:"Adivina la Palabra",desc:"Con pistas"},
    {id:"orden",icon:"①",name:"Orden Numérico",desc:"Clica números en orden"},
    {id:"doble",icon:"⚄",name:"Doble Dado",desc:"Saca dobles para ganar"},
    {id:"buscaminas",icon:"✸",name:"Buscaminas Pro",desc:"Versión extendida"},
    // 21 juegos nuevos
    {id:"pong",icon:"◣",name:"Pong Carmesí",desc:"Rebota la pelota"},
    {id:"breakout",icon:"▦",name:"Ladrillos",desc:"Destruye todos los ladrillos"},
    {id:"minigolf",icon:"⛳",name:"Mini Golf",desc:"Mete la pelota en el hoyo"},
    {id:"sudoku4",icon:"▦",name:"Sudoku 4x4",desc:"Completa el sudoku"},
    {id:"wordhide",icon:"❖",name:"Palabra Oculta",desc:"Encuentra la palabra"},
    {id:"magicsquare",icon:"⊡",name:"Cuadrado Mágico",desc:"Suma 15 en cada línea"},
    {id:"sequence",icon:"①",name:"Secuencia",desc:"Memoriza la secuencia"},
    {id:"catchstar",icon:"★",name:"Atrapa Estrellas",desc:"Atrapa estrellas que caen"},
    {id:"horse race",icon:"♞",name:"Carrera",desc:"Caballo que llega primero"},
    {id:"dicepoker",icon:"⚅",name:"Dados Poker",desc:"Mejor mano de dados"},
    {id:"blackjack",icon:"♣",name:"Blackjack",desc:"Llega a 21 sin pasarte"},
    {id:"numroulette",icon:"⊙",name:"Ruleta Numérica",desc:"Apuesta al número"},
    {id:"findpair",icon:"❖",name:"Encuentra el Par",desc:"Encuentra dos iguales"},
    {id:"quicksum",icon:"+",name:"Suma Rápida",desc:"Suma lo más rápido posible"},
    {id:"cardmemory",icon:"♠",name:"Cartas Memoria",desc:"Memoriza las cartas"},
    {id:"minimaze2",icon:"⬚",name:"Mini Laberinto 2",desc:"Otro laberinto más corto"},
    {id:"basket",icon:"❍",name:"Canasta",desc:"Encesta pelotas"},
    {id:"latinsquare",icon:"⊞",name:"Cuadrado Latino",desc:"Completa sin repetir"},
    {id:"reactionpro",icon:"⚡",name:"Reacción Pro",desc:"5 rondas de reacción"},
    {id:"colormatch",icon:"◉",name:"Match de Color",desc:"Empareja colores"},
    {id:"numberhunt",icon:"⌕",name:"Caza Números",desc:"Encuentra el número"},
    {id:"memorynum",icon:"③",name:"Memoria Numérica",desc:"Memoriza números y repítelos"},
    {id:"tetris",icon:"▣",name:"Mini Tetris",desc:"Coloca piezas sin llenar"},
    // 21 juegos adicionales
    {id:"slots",icon:"🎰",name:"Tragamonedas",desc:"Gira y gana"},
    {id:"coinflip",icon:"◐",name:"Cara o Cruz",desc:"Adivina la moneda"},
    {id:"warcards",icon:"⚔",name:"Guerra de Cartas",desc:"Carta más alta gana"},
    {id:"highlow",icon:"↑",name:"Mayor o Menor",desc:"¿La próxima es mayor?"},
    {id:"speedtap",icon:"⚡",name:"Toque Rápido",desc:"Toca lo más rápido posible"},
    {id:"whackamole",icon:"⚒",name:"Golpea al Topo",desc:"Pega los topos"},
    {id:"luckywheel",icon:"❂",name:"Rueda Suerte",desc:"Gira por premios"},
    {id:"treasure",icon:"⚜",name:"Caza Tesoro",desc:"Encuentra el tesoro"},
    {id:"fortune",icon:"❖",name:"Galleta Fortuna",desc:"Tu destino de amor"},
    {id:"lovecalc",icon:"♥",name:"Calculadora Amor",desc:"% de compatibilidad"},
    {id:"diceduel",icon:"⚅",name:"Duelo Dados",desc:"Tú vs Santuario"},
    {id:"wordscramble",icon:"❖",name:"Palabras Mezcladas",desc:"Ordena las letras"},
    {id:"numpuzzle",icon:"⊞",name:"Puzzle Numérico",desc:"Completa el patrón"},
    {id:"colorquiz",icon:"◉",name:"Quiz de Colores",desc:"¿Qué color es?"},
    {id:"arrowdodge",icon:"➤",name:"Esquiva Flechas",desc:"Evita las flechas"},
    {id:"bubblepop",icon:"❍",name:"Revienta Burbujas",desc:"Ponche burbujas rápido"},
    {id:"memorycards2",icon:"❖",name:"Memoria Pro",desc:"Más cartas, más retos"},
    {id:"quickmath2",icon:"÷",name:"Mate Mixta",desc:"Suma, resta, multiplica"},
    {id:"lucky7",icon:"7",name:"Lucky 7",desc:"Consigue el 7"},
    {id:"match3",icon:"❖",name:"Match 3",desc:" junta 3 iguales"},
    {id:"tapduel",icon:"⚡",name:"Duelo de Toques",desc:"60s de clics"}
  ];

  window.openGamesArcade = function () {
    const grid = document.getElementById("games-arcade-grid");
    grid.innerHTML = "";
    // Eliminar duplicados por id
    const seen = new Set();
    const unique = GAMES_LIST.filter((g) => { if (seen.has(g.id)) return false; seen.add(g.id); return true; });
    unique.forEach((g) => {
      const card = document.createElement("div"); card.className = "game-arcade-card";
      card.innerHTML = `<div class="game-arcade-icon">${g.icon}</div><div class="game-arcade-name">${g.name}</div><div class="game-arcade-desc">${g.desc}</div><div class="game-arcade-play">▶ Jugar</div>`;
      card.addEventListener("click", () => { closeGamesArcade(); cameFromArcade = true; switchTab(g.id); });
      grid.appendChild(card);
    });
    document.getElementById("games-arcade").classList.remove("hidden");
    // Asegurar que el botón cerrar funcione
    const closeBtn = document.querySelector(".games-arcade-close");
    if (closeBtn) {
      closeBtn.onclick = function(ev) { ev.stopPropagation(); ev.preventDefault(); document.getElementById("games-arcade").classList.add("hidden"); return false; };
    }
  };
  window.closeGamesArcade = function (e) { if (e) { e.stopPropagation(); e.preventDefault(); } document.getElementById("games-arcade").classList.add("hidden"); };

  // ================= JUEGOS ORIGINALES =================
  // Buscaminas
  const MS_SIZE=8, MS_BOMBS=10; let msBoard=[];
  const DARES=["¡BOOM! Un beso largo.","¡EXPLOSIÓN! Abrazo 30s.","¡BOMBA! Cita sorpresa.","¡TRAMPA! 3 razones para amarme.","¡CORAZÓN! Masaje relajante.","¡RETO! Mi dulce favorito.","¡DESTELLO! Beso frente y labios."];
  window.initMinesweeper=function(){const g=document.getElementById("minesweeper-grid");g.innerHTML="";msBoard=Array.from({length:MS_SIZE},()=>Array.from({length:MS_SIZE},()=>({bomb:false,revealed:false,count:0})));let p=0;while(p<MS_BOMBS){const r=Math.floor(Math.random()*MS_SIZE),c=Math.floor(Math.random()*MS_SIZE);if(!msBoard[r][c].bomb){msBoard[r][c].bomb=true;p++;}}for(let r=0;r<MS_SIZE;r++)for(let c=0;c<MS_SIZE;c++){if(msBoard[r][c].bomb)continue;let n=0;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){const nr=r+dr,nc=c+dc;if(nr>=0&&nr<MS_SIZE&&nc>=0&&nc<MS_SIZE&&msBoard[nr][nc].bomb)n++;}msBoard[r][c].count=n;}for(let r=0;r<MS_SIZE;r++)for(let c=0;c<MS_SIZE;c++){const cell=document.createElement("div");cell.className="ms-cell";cell.dataset.r=r;cell.dataset.c=c;cell.addEventListener("click",()=>revealMs(r,c));g.appendChild(cell);}};
  function revealMs(r,c){if(r<0||r>=MS_SIZE||c<0||c>=MS_SIZE)return;const d=msBoard[r][c];if(d.revealed)return;d.revealed=true;const cl=document.querySelector(`.ms-cell[data-r="${r}"][data-c="${c}"]`);cl.classList.add("revealed");if(d.bomb){cl.classList.add("bomb-exploded");cl.textContent="✸";openSacredModal({icon:"✸♥",title:"¡Bomba!",text:DARES[Math.floor(Math.random()*DARES.length)],withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal()">Aceptar ♥</button>`});return;}if(d.count>0){cl.textContent=d.count;cl.style.color=d.count===1?"#fff":"#e60000";}else{cl.textContent="·";for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)revealMs(r+dr,c+dc);}}

  // Laberinto
  const MAZE_GRID=[[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],[1,0,0,0,1,0,0,0,0,0,1,0,0,0,1],[1,0,1,0,1,0,1,1,1,0,1,0,1,0,1],[1,0,1,0,0,0,1,0,0,0,0,0,1,0,1],[1,0,1,1,1,1,1,0,1,1,1,1,1,0,1],[1,0,0,0,0,0,0,0,1,0,0,0,0,0,1],[1,1,1,1,1,0,1,1,1,0,1,1,1,0,1],[1,0,0,0,1,0,0,0,0,0,1,0,0,0,1],[1,0,1,0,1,1,1,1,1,0,1,0,1,1,1],[1,0,1,0,0,0,0,0,1,0,0,0,0,0,1],[1,0,1,1,1,1,1,0,1,1,1,1,1,0,1],[1,0,0,0,0,0,1,0,0,0,0,0,1,0,1],[1,0,1,1,1,0,1,1,1,1,1,0,1,0,1],[1,0,0,0,1,0,0,0,0,0,0,0,0,2,1],[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]];
  let playerPos={x:1,y:1};
  window.initMaze=function(){playerPos={x:1,y:1};drawMaze();};
  function drawMaze(){const m=document.getElementById("maze-canvas");if(!m)return;const ctx=m.getContext("2d");const cs=m.width/MAZE_GRID.length;ctx.clearRect(0,0,m.width,m.height);for(let r=0;r<MAZE_GRID.length;r++)for(let c=0;c<MAZE_GRID[r].length;c++){const v=MAZE_GRID[r][c];if(v===1){ctx.fillStyle="#3b0000";ctx.fillRect(c*cs,r*cs,cs,cs);ctx.strokeStyle="#750000";ctx.strokeRect(c*cs,r*cs,cs,cs);}else{ctx.fillStyle="#060606";ctx.fillRect(c*cs,r*cs,cs,cs);}if(v===2){ctx.font=`${cs*0.72}px serif`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle="#e60000";ctx.fillText("♛",c*cs+cs/2,r*cs+cs/2);}}ctx.font=`${cs*0.75}px serif`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillStyle="#fff";ctx.fillText("♚",playerPos.x*cs+cs/2,playerPos.y*cs+cs/2);}
  window.moveMazePlayer=function(dx,dy){const nx=playerPos.x+dx,ny=playerPos.y+dy;if(MAZE_GRID[ny]&&MAZE_GRID[ny][nx]!==undefined&&MAZE_GRID[ny][nx]!==1){playerPos={x:nx,y:ny};drawMaze();if(MAZE_GRID[ny][nx]===2)openSacredModal({icon:"♛♥♚",title:"¡Ganaste!",text:"Kevin y Dominic siempre se encuentran. ♥",withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initMaze();">Otra vez</button>`});}};
  document.addEventListener("keydown",(e)=>{const l=document.getElementById("laberinto");if(!l||!l.classList.contains("active"))return;if(e.key==="ArrowUp"){e.preventDefault();moveMazePlayer(0,-1);}if(e.key==="ArrowDown"){e.preventDefault();moveMazePlayer(0,1);}if(e.key==="ArrowLeft"){e.preventDefault();moveMazePlayer(-1,0);}if(e.key==="ArrowRight"){e.preventDefault();moveMazePlayer(1,0);}});

  // Sopa
  const WS_WORDS=["KEVIN","DOMINIC","AMOR","ETERNIDAD","CARMESI","ALMAS","SIEMPRE","FAMILIA"];
  const WS_SIZE=12;let wsBoard=[],foundWords=new Set(),isSelecting=false,selectionStart=null,currentSelection=[];
  window.initWordSearch=function(){const g=document.getElementById("wordsearch-grid"),l=document.getElementById("wordsearch-list"),s=document.getElementById("wordsearch-status");foundWords.clear();s.textContent="";wsBoard=Array.from({length:WS_SIZE},()=>Array(WS_SIZE).fill(""));const dirs=[[0,1],[1,0],[1,1]];WS_WORDS.forEach((w)=>{let pl=false,at=0;while(!pl&&at<200){at++;const dir=dirs[Math.floor(Math.random()*dirs.length)];const r=Math.floor(Math.random()*WS_SIZE),c=Math.floor(Math.random()*WS_SIZE);const er=r+dir[0]*(w.length-1),ec=c+dir[1]*(w.length-1);if(er>=0&&er<WS_SIZE&&ec>=0&&ec<WS_SIZE){let ok=true;for(let i=0;i<w.length;i++){const ch=wsBoard[r+dir[0]*i][c+dir[1]*i];if(ch&&ch!==w[i]){ok=false;break;}}if(ok){for(let i=0;i<w.length;i++)wsBoard[r+dir[0]*i][c+dir[1]*i]=w[i];pl=true;}}}});const f="ABCDEFGHIJKLMNOPQRSTUVWXYZ";for(let r=0;r<WS_SIZE;r++)for(let c=0;c<WS_SIZE;c++)if(!wsBoard[r][c])wsBoard[r][c]=f[Math.floor(Math.random()*f.length)];g.innerHTML="";for(let r=0;r<WS_SIZE;r++)for(let c=0;c<WS_SIZE;c++){const cell=document.createElement("div");cell.className="ws-cell";cell.textContent=wsBoard[r][c];cell.dataset.r=r;cell.dataset.c=c;cell.addEventListener("pointerdown",(e)=>{e.preventDefault();isSelecting=true;selectionStart={r,c};updSel({r,c});});cell.addEventListener("pointerenter",()=>{if(isSelecting&&selectionStart)updSel({r,c});});g.appendChild(cell);}l.innerHTML="";WS_WORDS.forEach((w)=>{const li=document.createElement("li");li.id=`ws-word-${w}`;li.textContent=w;l.appendChild(li);});};
  function updSel(end){document.querySelectorAll(".ws-cell.selected").forEach((el)=>el.classList.remove("selected"));currentSelection=[];const dr=end.r-selectionStart.r,dc=end.c-selectionStart.c;const steps=Math.max(Math.abs(dr),Math.abs(dc));if(steps===0){currentSelection.push(selectionStart);}else if(dr===0||dc===0||Math.abs(dr)===Math.abs(dc)){const sr=dr===0?0:dr/Math.abs(dr),sc=dc===0?0:dc/Math.abs(dc);for(let i=0;i<=steps;i++)currentSelection.push({r:selectionStart.r+sr*i,c:selectionStart.c+sc*i});}currentSelection.forEach(({r,c})=>{const el=document.querySelector(`.ws-cell[data-r="${r}"][data-c="${c}"]`);if(el)el.classList.add("selected");});}
  document.addEventListener("pointerup",()=>{if(!isSelecting)return;isSelecting=false;const fwd=currentSelection.map(({r,c})=>wsBoard[r][c]).join("");const bwd=fwd.split("").reverse().join("");const m=WS_WORDS.find((w)=>w===fwd||w===bwd);if(m&&!foundWords.has(m)){foundWords.add(m);currentSelection.forEach(({r,c})=>{const el=document.querySelector(`.ws-cell[data-r="${r}"][data-c="${c}"]`);if(el)el.classList.add("found");});const li=document.getElementById(`ws-word-${m}`);if(li)li.classList.add("found-word");if(foundWords.size===WS_WORDS.length){document.getElementById("wordsearch-status").textContent="¡Todas! ♥";spawnHeartsRain(45);}}document.querySelectorAll(".ws-cell.selected").forEach((el)=>el.classList.remove("selected"));currentSelection=[];});

  // Quiz
  const QUIZ=[{q:"¿Fecha de inicio?",opts:["27 Ene 2026","14 Feb 2026","27 Dic 2025","1 Ene 2026"],ans:0},{q:"¿Quiénes son?",opts:["Kevin y Dominic","Romeo y Julieta","Kevin y Alex","Dominic y Dante"],ans:0},{q:"¿Cumpleaños Kevin?",opts:["21 Jul","23 Mar","27 Ene","31 Oct"],ans:1},{q:"¿Cumpleaños Dominic?",opts:["23 Mar","25 Dic","21 Jul","3 Oct"],ans:2},{q:"¿Colores santuario?",opts:["Azul/Plata","Negro/Carmesí/Blanco","Morado/Dorado","Verde/Negro"],ans:1},{q:"¿K†D significa?",opts:["Iniciales unidas","Código","Fecha","Banda"],ans:0},{q:"¿Qué hacemos juntos?",opts:["Hablar por horas","Estar lejos","No hablar","Silencio"],ans:0},{q:"¿Tiempo desde 27/01?",opts:["Suma eternidad","Se detuvo","No importa","Borra"],ans:0},{q:"¿Nuestra conexión?",opts:["Profunda","Pasajera","Común","Distante"],ans:0},{q:"¿Bomba en buscaminas?",opts:["Reto de amor","Pierdes","Cierra","Nada"],ans:0},{q:"¿Lugar relación?",opts:["Prioritario","Secundario","Temporal","Pasatiempo"],ans:0},{q:"¿Mal día?",opts:["Apoyarnos","Alejarnos","Enojarnos","Fingir"],ans:0},{q:"¿Promesa?",opts:["Elegirnos","Olvidar","Separarnos","No planear"],ans:0},{q:"¿Flores amarillas?",opts:["Tu sonrisa","Tristeza","Despedida","Otoño"],ans:0},{q:"¿Carta contiene?",opts:["Devoción","Compras","Manual","Noticias"],ans:0},{q:"¿Valor fundamental?",opts:["Lealtad","Desconfianza","Orgullo","Indiferencia"],ans:0},{q:"¿Abrazo nuestro?",opts:["Refugio","Frío","Incómodo","Corto"],ans:0},{q:"¿Palabra que nos define?",opts:["Devoción","Costumbre","Duda","Rutina"],ans:0},{q:"¿Carmesí simboliza?",opts:["Pasión eterna","Tristeza","Frialdad","Olvido"],ans:0},{q:"¿Duración?",opts:["Eternidad","Meses","Un año","Hoy"],ans:0}];
  let qi=0,cc=0,ic=0;
  const qav=document.getElementById("quiz-active-view"),qrv=document.getElementById("quiz-result-view");
  function renderQuizQ(){const c=QUIZ[qi];document.getElementById("quiz-progress-text").textContent=`${qi+1} de ${QUIZ.length}`;document.getElementById("quiz-progress-fill").style.width=`${((qi+1)/QUIZ.length)*100}%`;document.getElementById("quiz-question-text").textContent=c.q;const o=document.getElementById("quiz-options");o.innerHTML="";["A","B","C","D"].forEach((l,i)=>{const b=document.createElement("button");b.className="quiz-option-btn";b.innerHTML=`<strong>${l}.</strong> <span>${c.opts[i]}</span>`;b.addEventListener("click",()=>handleQ(i,b));o.appendChild(b);});}
  function handleQ(si,btn){const c=QUIZ[qi];const all=document.getElementById("quiz-options").querySelectorAll(".quiz-option-btn");all.forEach((b)=>b.disabled=true);if(si===c.ans){cc++;btn.classList.add("correct");}else{ic++;btn.classList.add("wrong");all[c.ans].classList.add("correct");}setTimeout(()=>{qi++;if(qi<QUIZ.length)renderQuizQ();else{qav.classList.add("hidden");qrv.classList.remove("hidden");document.getElementById("score-correct").textContent=cc;document.getElementById("score-incorrect").textContent=ic;document.getElementById("quiz-final-message").textContent=cc>=18?"¡Almas gemelas!":cc>=12?"¡Bien!":"Repasa.";}},850);}
  window.restartQuiz=function(){qi=0;cc=0;ic=0;qrv.classList.add("hidden");qav.classList.remove("hidden");renderQuizQ();};

  // Memoria
  const MEM=["♥","♛","✠","❖","✧","⚜","✿","❣"];let mb=[],mf=[],mm=0,mv=0;
  window.initMemory=function(){mb=[...MEM,...MEM].sort(()=>Math.random()-0.5);mf=[];mm=0;mv=0;document.getElementById("mem-pairs").textContent="0/"+MEM.length;document.getElementById("mem-moves").textContent="0";const g=document.getElementById("memory-grid");g.innerHTML="";mb.forEach((s,i)=>{const c=document.createElement("div");c.className="memory-card";c.innerHTML=`<span class="memory-symbol">${s}</span>`;c.addEventListener("click",()=>flipMem(i,c));g.appendChild(c);});};
  function flipMem(i,card){if(mf.length>=2||card.classList.contains("flipped")||card.classList.contains("matched"))return;card.classList.add("flipped");mf.push({i,card,sym:mb[i]});if(mf.length===2){mv++;document.getElementById("mem-moves").textContent=mv;setTimeout(()=>{if(mf[0].sym===mf[1].sym){mf[0].card.classList.add("matched");mf[1].card.classList.add("matched");mm++;document.getElementById("mem-pairs").textContent=mm+"/"+MEM.length;if(mm===MEM.length)openSacredModal({icon:"❖",title:"¡Victoria!",text:"Completaste los pares.",withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initMemory();">Otra</button>`});}else{mf[0].card.classList.remove("flipped");mf[1].card.classList.remove("flipped");}mf=[];},700);}}

  // Ahorcado
  const AH_WORDS=["KEVIN","DOMINIC","AMOR","ETERNIDAD","CARMESI","SANTUARIO","CORAZON","ALMAS"];let aw="",ag=[],awr=0,awi=0;
  window.initHangman=function(){aw=AH_WORDS[awi%AH_WORDS.length];awi++;ag=[];awr=0;document.getElementById("ah-intentos").textContent=6-awr;document.getElementById("ah-palabra-num").textContent=((awi-1)%AH_WORDS.length+1)+"/"+AH_WORDS.length;renderAH();const l=document.getElementById("ah-letters");l.innerHTML="";"ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("").forEach((c)=>{const b=document.createElement("button");b.className="hangman-letter-btn";b.textContent=c;b.addEventListener("click",()=>guessAH(c,b));l.appendChild(b);});};
  function guessAH(c,btn){if(ag.includes(c))return;ag.push(c);btn.disabled=true;if(aw.includes(c))btn.classList.add("correct");else{btn.classList.add("wrong");awr++;}document.getElementById("ah-intentos").textContent=6-awr;renderAH();if(awr>=6)openSacredModal({icon:"⚜",title:"Ahorcado",text:`Era: ${aw}. Castigo: beso.`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initHangman();">Otra</button>`});else if([...aw].every((c)=>ag.includes(c)))openSacredModal({icon:"⚜",title:"¡Ganaste!",text:`${aw}. Premio: abrazo.`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initHangman();">Otra</button>`});}
  function renderAH(){const st=["","+\n|\n|\n|","+-+\n|\n|\n|","+-+\n|\nO\n|\n|","+-+\n|\nO\n/|\n|","+-+\n|\nO\n/|\\\n|","+-+\n|\nO\n/|\\\n/"];document.getElementById("ah-figure").textContent=st[awr]||st[6];document.getElementById("ah-display").textContent=[...aw].map((c)=>ag.includes(c)?c:"_").join(" ");}

  // Tres en raya
  let ttt=Array(9).fill(""),tttT="k",tttS={k:0,d:0};
  window.initTicTacToe=function(){ttt=Array(9).fill("");tttT="k";document.getElementById("ttt-turno").textContent="♚";document.getElementById("ttt-msg").textContent="";const g=document.getElementById("ttt-grid");g.innerHTML="";ttt.forEach((v,i)=>{const c=document.createElement("div");c.className="ttt-cell"+(v?" taken":"");c.textContent=v==="k"?"♚":v==="d"?"♛":"";c.addEventListener("click",()=>tttMove(i,c));g.appendChild(c);});};
  function tttMove(i,cell){if(ttt[i]||tttT!=="k")return;ttt[i]="k";cell.classList.add("taken");cell.textContent="♚";if(checkTTT("k")){document.getElementById("ttt-msg").textContent="¡Kevin gana! ♚";tttS.k++;document.getElementById("ttt-k").textContent=tttS.k;openSacredModal({icon:"♚",title:"Tres en Raya",text:"¡Kevin gana!",withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initTicTacToe();">Otra</button>`});return;}if(!ttt.includes("")){document.getElementById("ttt-msg").textContent="Empate.";return;}tttT="d";document.getElementById("ttt-turno").textContent="♛";setTimeout(()=>{const e=ttt.map((v,i)=>v?"":i).filter((x)=>x!=="");const m=e[Math.floor(Math.random()*e.length)];ttt[m]="d";const dc=document.querySelectorAll(".ttt-cell")[m];dc.classList.add("taken");dc.textContent="♛";if(checkTTT("d")){document.getElementById("ttt-msg").textContent="¡Dominic gana! ♛";tttS.d++;document.getElementById("ttt-d").textContent=tttS.d;openSacredModal({icon:"♛",title:"Tres en Raya",text:"¡Dominic gana!",withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initTicTacToe();">Otra</button>`});return;}tttT="k";document.getElementById("ttt-turno").textContent="♚";},500);}
  function checkTTT(p){const w=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];return w.some((x)=>x.every((i)=>ttt[i]===p));}

  // Conecta 4
  let c4=Array(42).fill(0),c4T=1;
  window.initConnect4=function(){c4=Array(42).fill(0);c4T=1;document.getElementById("c4-turno").textContent="K";document.getElementById("c4-msg").textContent="";const g=document.getElementById("c4-grid");g.innerHTML="";c4.forEach((v,i)=>{const c=document.createElement("div");c.className="c4-cell"+(v===1?" k":v===2?" d":"");c.addEventListener("click",()=>c4Drop(i%7));g.appendChild(c);});};
  function c4Drop(col){for(let r=5;r>=0;r--){const i=r*7+col;if(!c4[i]){c4[i]=c4T;document.querySelectorAll(".c4-cell")[i].classList.add(c4T===1?"k":"d");if(c4Win(c4T)){document.getElementById("c4-msg").textContent=`¡${c4T===1?"Kevin":"Dominic"} gana!`;openSacredModal({icon:"❍",title:"Conecta 4",text:`¡${c4T===1?"Kevin":"Dominic"} conectó 4!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initConnect4();">Otra</button>`});return;}c4T=c4T===1?2:1;document.getElementById("c4-turno").textContent=c4T===1?"K":"D";return;}}}
  function c4Win(p){for(let r=0;r<6;r++)for(let c=0;c<7;c++){const i=r*7+c;if(c4[i]!==p)continue;if(c<=3&&c4[i+1]===p&&c4[i+2]===p&&c4[i+3]===p)return true;if(r<=2&&c4[i+7]===p&&c4[i+14]===p&&c4[i+21]===p)return true;if(c<=3&&r<=2&&c4[i+8]===p&&c4[i+16]===p&&c4[i+24]===p)return true;if(c>=3&&r<=2&&c4[i+6]===p&&c4[i+12]===p&&c4[i+18]===p)return true;}return false;}

  // Simón
  let ss=[],sus=[],sp=false,sr=0;
  window.initSimon=function(){ss=[];sus=[];sr=0;sp=false;document.getElementById("simon-ronda").textContent="0";document.getElementById("simon-msg").textContent="Observa...";document.querySelectorAll(".simon-pad").forEach((p)=>p.onclick=()=>simonClick(parseInt(p.dataset.pad)));simonNext();};
  function simonNext(){sus=[];sr++;document.getElementById("simon-ronda").textContent=sr;ss.push(Math.floor(Math.random()*4));sp=true;let i=0;const iv=setInterval(()=>{if(i>=ss.length){clearInterval(iv);sp=false;document.getElementById("simon-msg").textContent="Tu turno.";return;}simonFlash(ss[i]);i++;},600);}
  function simonFlash(pad){const e=document.querySelector(`.simon-pad.s${pad+1}`);e.classList.add("lit");setTimeout(()=>e.classList.remove("lit"),300);}
  function simonClick(pad){if(sp)return;simonFlash(pad);sus.push(pad);if(sus[sus.length-1]!==ss[sus.length-1]){document.getElementById("simon-msg").textContent=`Error. Ronda ${sr}.`;openSacredModal({icon:"◈",title:"Simón",text:`Llegaste a ronda ${sr}.`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initSimon();">Otra</button>`});return;}if(sus.length===ss.length){document.getElementById("simon-msg").textContent="¡Bien!";setTimeout(()=>simonNext(),800);}}

  // Adivina número
  let adT=0,adI=0;
  window.initAdivina=function(){adT=Math.floor(Math.random()*100)+1;adI=0;document.getElementById("ad-intentos").textContent="0";document.getElementById("ad-feedback").textContent="Número 1-100...";document.getElementById("ad-input").value="";};
  window.makeGuess=function(){const v=parseInt(document.getElementById("ad-input").value,10);if(!v||v<1||v>100)return;adI++;document.getElementById("ad-intentos").textContent=adI;const f=document.getElementById("ad-feedback");if(v===adT){f.textContent=`¡Correcto! Era ${adT} en ${adI} intentos.`;openSacredModal({icon:"✦",title:"Adivina",text:`¡${adI} intentos!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initAdivina();">Otra</button>`});}else if(v<adT)f.textContent="↑ Más alto...";else f.textContent="↓ Más bajo...";document.getElementById("ad-input").value="";};

  // RPS
  let rpsY=0,rpsC=0;
  window.playRPS=function(c){const ch=["piedra","papel","tijera"];const cpu=ch[Math.floor(Math.random()*3)];const g={piedra:"✊",papel:"✋",tijera:"✌"};let r;if(c===cpu)r="Empate: "+g[c];else if((c==="piedra"&&cpu==="tijera")||(c==="papel"&&cpu==="piedra")||(c==="tijera"&&cpu==="papel")){r="¡Ganaste! "+g[c]+" vence "+g[cpu];rpsY++;}else{r="Perdiste. "+g[cpu]+" vence "+g[c];rpsC++;}document.getElementById("rps-you").textContent=rpsY;document.getElementById("rps-cpu").textContent=rpsC;document.getElementById("rps-result").textContent=r;};

  // Ruleta
  const RDARES=["Beso apasionado","Abrazo 30s","Carta de amor","Masaje","Cantar","Cita sorpresa","3 razones","Baile","Poema","Foto divertida"];let rSpinning=false;
  window.spinRoulette=function(){if(rSpinning)return;rSpinning=true;const w=document.getElementById("roulette-wheel");const deg=1080+Math.floor(Math.random()*360);w.style.transform=`rotate(${deg}deg)`;document.getElementById("roulette-result").textContent="Girando...";setTimeout(()=>{const d=RDARES[Math.floor(Math.random()*RDARES.length)];document.getElementById("roulette-result").textContent="Reto: "+d;rSpinning=false;spawnHeartsRain(20);},4200);};

  // Rompecabezas
  let pzB=[1,2,3,4,5,6,7,8,0],pzM=0;
  window.initPuzzle=function(){pzB=[1,2,3,4,5,6,7,8,0];for(let i=0;i<100;i++){const e=pzB.indexOf(0);const n=pzN(e);const s=n[Math.floor(Math.random()*n.length)];[pzB[e],pzB[s]]=[pzB[s],pzB[e]];}pzM=0;document.getElementById("pz-moves").textContent="0";document.getElementById("pz-msg").textContent="";renderPuzzle();};
  function pzN(i){const r=Math.floor(i/3),c=i%3;const n=[];if(r>0)n.push(i-3);if(r<2)n.push(i+3);if(c>0)n.push(i-1);if(c<2)n.push(i+1);return n;}
  function renderPuzzle(){const g=document.getElementById("puzzle-grid");g.innerHTML="";pzB.forEach((v,i)=>{const t=document.createElement("div");t.className="puzzle-tile"+(v===0?" empty":"");t.textContent=v||"";if(v!==0)t.addEventListener("click",()=>pzMove(i));g.appendChild(t);});}
  function pzMove(i){const e=pzB.indexOf(0);if(pzN(e).includes(i)){[pzB[i],pzB[e]]=[pzB[e],pzB[i]];pzM++;document.getElementById("pz-moves").textContent=pzM;renderPuzzle();if(pzB.every((v,i)=>v===(i+1)%9)){document.getElementById("pz-msg").textContent="¡"+pzM+" movimientos!";openSacredModal({icon:"◰",title:"Rompecabezas",text:`¡${pzM} movimientos!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initPuzzle();">Otra</button>`});}}}

  // Dado verdad
  const DQ=["¿Cuál fue el momento exacto en que te enamoraste?","¿Qué te atrae físicamente de mí?","¿Recuerdo favorito nuestro?","¿Qué harías si me pierdo una hora?","¿Miedo sobre nuestra relación?","¿Canción que te recuerda a mí?","¿Detalle que te hace sonreír?","¿Cita ideal?","¿Qué admiras de mi carácter?","¿Promesa para hoy?"];
  window.rollDice=function(){const f=["⚀","⚁","⚂","⚃","⚄","⚅"];const v=Math.floor(Math.random()*6);const d=document.getElementById("dice-display");d.textContent=f[v];d.style.animation="none";void d.offsetWidth;d.style.animation="diceRoll 0.6s";document.getElementById("dice-question").textContent="Pregunta: "+DQ[Math.floor(Math.random()*DQ.length)];};

  // ================= 15 JUEGOS NUEVOS =================
  // Serpiente
  let snakeBody=[],snakeDir={x:1,y:0},snakeFood={x:0,y:0},snakeScore=0,snakeInterval=null;
  const SNAKE_SIZE=15;
  window.initSnake=function(){snakeBody=[{x:7,y:7}];snakeDir={x:1,y:0};snakeScore=0;document.getElementById("snake-score").textContent="0";placeFood();if(snakeInterval)clearInterval(snakeInterval);snakeInterval=setInterval(snakeTick,200);renderSnake();};
  function placeFood(){snakeFood={x:Math.floor(Math.random()*SNAKE_SIZE),y:Math.floor(Math.random()*SNAKE_SIZE)};}
  function snakeTick(){const h=snakeBody[0];const nh={x:h.x+snakeDir.x,y:h.y+snakeDir.y};if(nh.x<0||nh.x>=SNAKE_SIZE||nh.y<0||nh.y>=SNAKE_SIZE||snakeBody.some((s)=>s.x===nh.x&&s.y===nh.y)){clearInterval(snakeInterval);openSacredModal({icon:"⥁",title:"Serpiente",text:`Puntos: ${snakeScore}`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initSnake();">Otra</button>`});return;}snakeBody.unshift(nh);if(nh.x===snakeFood.x&&nh.y===snakeFood.y){snakeScore++;document.getElementById("snake-score").textContent=snakeScore;placeFood();}else snakeBody.pop();renderSnake();}
  function renderSnake(){const g=document.getElementById("snake-grid");g.innerHTML="";for(let i=0;i<SNAKE_SIZE*SNAKE_SIZE;i++){const c=document.createElement("div");c.className="snake-cell";const x=i%SNAKE_SIZE,y=Math.floor(i/SNAKE_SIZE);if(snakeBody[0]&&snakeBody[0].x===x&&snakeBody[0].y===y)c.classList.add("head");else if(snakeBody.some((s)=>s.x===x&&s.y===y))c.classList.add("body");else if(snakeFood.x===x&&snakeFood.y===y)c.classList.add("food");g.appendChild(c);}}
  window.snakeDir=function(dx,dy){if(Math.abs(dx)!==Math.abs(0))snakeDir={x:dx,y:0};else snakeDir={x:0,y:dy};};
  document.addEventListener("keydown",(e)=>{const s=document.getElementById("snake");if(!s||!s.classList.contains("active"))return;if(e.key==="ArrowUp"){e.preventDefault();window.snakeDir(0,-1);}if(e.key==="ArrowDown"){e.preventDefault();window.snakeDir(0,1);}if(e.key==="ArrowLeft"){e.preventDefault();window.snakeDir(-1,0);}if(e.key==="ArrowRight"){e.preventDefault();window.snakeDir(1,0);}});

  // 2048
  let g2048Board=[],g2048Score=0;
  window.init2048=function(){g2048Board=Array.from({length:4},()=>Array(4).fill(0));g2048Score=0;document.getElementById("g2048-score").textContent="0";add2048Tile();add2048Tile();render2048();};
  function add2048Tile(){const empty=[];for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(!g2048Board[r][c])empty.push({r,c});if(!empty.length)return;const{r,c}=empty[Math.floor(Math.random()*empty.length)];g2048Board[r][c]=Math.random()<0.9?2:4;}
  function render2048(){const g=document.getElementById("g2048-grid");g.innerHTML="";for(let r=0;r<4;r++)for(let c=0;c<4;c++){const cell=document.createElement("div");cell.className="g2048-cell";const v=g2048Board[r][c];if(v){cell.classList.add("v"+v);cell.textContent=v;}g.appendChild(cell);}}
  window.move2048=function(dir){let moved=false;const b=g2048Board.map((r)=>[...r]);if(dir==="left")for(let r=0;r<4;r++){const row=b[r].filter((v)=>v);for(let i=0;i<row.length-1;i++)if(row[i]===row[i+1]){row[i]*=2;row.splice(i+1,1);g2048Score+=row[i];}while(row.length<4)row.push(0);b[r]=row;}else if(dir==="right")for(let r=0;r<4;r++){let row=b[r].filter((v)=>v).reverse();for(let i=0;i<row.length-1;i++)if(row[i]===row[i+1]){row[i]*=2;row.splice(i+1,1);g2048Score+=row[i];}while(row.length<4)row.push(0);b[r]=row.reverse();}else if(dir==="up"){for(let c=0;c<4;c++){let col=[b[0][c],b[1][c],b[2][c],b[3][c]].filter((v)=>v);for(let i=0;i<col.length-1;i++)if(col[i]===col[i+1]){col[i]*=2;col.splice(i+1,1);g2048Score+=col[i];}while(col.length<4)col.push(0);for(let r=0;r<4;r++)b[r][c]=col[r];}}else if(dir==="down"){for(let c=0;c<4;c++){let col=[b[0][c],b[1][c],b[2][c],b[3][c]].filter((v)=>v).reverse();for(let i=0;i<col.length-1;i++)if(col[i]===col[i+1]){col[i]*=2;col.splice(i+1,1);g2048Score+=col[i];}while(col.length<4)col.push(0);col.reverse();for(let r=0;r<4;r++)b[r][c]=col[r];}}for(let r=0;r<4;r++)for(let c=0;c<4;c++)if(b[r][c]!==g2048Board[r][c])moved=true;g2048Board=b;document.getElementById("g2048-score").textContent=g2048Score;if(moved){add2048Tile();render2048();if(g2048Board.some((r)=>r.includes(2048)))openSacredModal({icon:"▣",title:"2048",text:"¡Llegaste a 2048!",withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();">Seguir</button>`});let canMove=false;for(let r=0;r<4;r++)for(let c=0;c<4;c++){if(!g2048Board[r][c])canMove=true;if(r<3&&g2048Board[r][c]===g2048Board[r+1][c])canMove=true;if(c<3&&g2048Board[r][c]===g2048Board[r][c+1])canMove=true;}if(!canMove)openSacredModal({icon:"▣",title:"2048",text:`Game Over. Puntos: ${g2048Score}`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();init2048();">Otra</button>`});}};
  document.addEventListener("keydown",(e)=>{const g=document.getElementById("g2048");if(!g||!g.classList.contains("active"))return;if(e.key==="ArrowLeft"){e.preventDefault();move2048("left");}if(e.key==="ArrowRight"){e.preventDefault();move2048("right");}if(e.key==="ArrowUp"){e.preventDefault();move2048("up");}if(e.key==="ArrowDown"){e.preventDefault();move2048("down");}});

  // Reversi
  let revBoard=[],revTurn=1;
  window.initReversi=function(){revBoard=Array.from({length:8},()=>Array(8).fill(0));revBoard[3][3]=2;revBoard[3][4]=1;revBoard[4][3]=1;revBoard[4][4]=2;revTurn=1;document.getElementById("rev-msg").textContent="";renderReversi();};
  function renderReversi(){const g=document.getElementById("reversi-grid");g.innerHTML="";for(let r=0;r<8;r++)for(let c=0;c<8;c++){const cell=document.createElement("div");cell.className="reversi-cell";if(revBoard[r][c]){const d=document.createElement("div");d.className="disc "+(revBoard[r][c]===1?"k":"d");cell.appendChild(d);}cell.addEventListener("click",()=>revMove(r,c));g.appendChild(cell);}const k=revBoard.flat().filter((v)=>v===1).length;const d=revBoard.flat().filter((v)=>v===2).length;document.getElementById("rev-k").textContent=k;document.getElementById("rev-d").textContent=d;};
  function revMove(r,c){if(revBoard[r][c])return;const dirs=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];let flipped=false;for(const[dr,dc]of dirs){let nr=r+dr,nc=c+dc;const path=[];while(nr>=0&&nr<8&&nc>=0&&nc<8&&revBoard[nr][nc]===3-revTurn){path.push([nr,nc]);nr+=dr;nc+=dc;}if(path.length&&nr>=0&&nr<8&&nc>=0&&nc<8&&revBoard[nr][nc]===revTurn){path.forEach(([pr,pc])=>revBoard[pr][pc]=revTurn);flipped=true;}}if(flipped){revBoard[r][c]=revTurn;revTurn=3-revTurn;renderReversi();const total=revBoard.flat().filter((v)=>v).length;if(total===64||!revBoard.flat().includes(0)){const k=revBoard.flat().filter((v)=>v===1).length;const d=revBoard.flat().filter((v)=>v===2).length;openSacredModal({icon:"◐",title:"Reversi",text:k>d?"¡Kevin gana!":d>k?"¡Dominic gana!":"Empate",withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initReversi();">Otra</button>`});}}}

  // Reacción
  let rxState="waiting",rxTimeout=null,rxBest=null,rxStart=0;
  window.initReaction=function(){rxState="waiting";document.getElementById("rx-area").className="reaction-area waiting";document.getElementById("rx-area").textContent="Clic para empezar...";document.getElementById("rx-msg").textContent="";if(rxTimeout)clearTimeout(rxTimeout);document.getElementById("rx-area").onclick=startReaction;};
  function startReaction(){rxState="waiting";const area=document.getElementById("rx-area");area.className="reaction-area waiting";area.textContent="Espera el rojo...";const delay=Math.random()*3000+1000;rxTimeout=setTimeout(()=>{rxState="ready";area.className="reaction-area ready";area.textContent="¡CLIC AHORA!";rxStart=Date.now();},delay);area.onclick=()=>{if(rxState==="ready"){const t=Date.now()-rxStart;rxState="result";area.className="reaction-area result";area.textContent=t+"ms";document.getElementById("rx-msg").textContent="¡"+t+"ms!";if(!rxBest||t<rxBest){rxBest=t;document.getElementById("rx-best").textContent=t+"ms";}area.onclick=startReaction;}else if(rxState==="waiting"){clearTimeout(rxTimeout);area.className="reaction-area tooearly";area.textContent="¡Muy pronto! Clic para reintentar.";area.onclick=startReaction;}};}

  // Torres de Hanoi
  let hnTowers=[[],[],[]],hnSelected=-1,hnMoves=0,hnDiskColors=["#b80000","#e60000","#750000","#3b0000","#d4d4d4","#ffffff"];
  window.initHanoi=function(){hnTowers=[[],[],[]];hnSelected=-1;hnMoves=0;document.getElementById("hn-moves").textContent="0";document.getElementById("hn-msg").textContent="Clic en un palo para seleccionar.";for(let i=5;i>=1;i--)hnTowers[0].push(i);renderHanoi();};
  function renderHanoi(){const t=document.getElementById("hanoi-tower");t.innerHTML="";hnTowers.forEach((tower,i)=>{const peg=document.createElement("div");peg.className="hanoi-peg"+(hnSelected===i?" selected":"");tower.forEach((disk)=>{const d=document.createElement("div");d.className="hanoi-disk";d.style.width=(disk*30+20)+"px";d.style.background=hnDiskColors[disk-1];peg.appendChild(d);});peg.addEventListener("click",()=>hnClick(i));t.appendChild(peg);});}
  function hnClick(i){if(hnSelected===-1){if(hnTowers[i].length){hnSelected=i;renderHanoi();}}else{if(hnSelected===i){hnSelected=-1;renderHanoi();return;}const disk=hnTowers[hnSelected][hnTowers[hnSelected].length-1];const top=hnTowers[i][hnTowers[i].length-1];if(!top||disk<top){hnTowers[hnSelected].pop();hnTowers[i].push(disk);hnMoves++;document.getElementById("hn-moves").textContent=hnMoves;hnSelected=-1;renderHanoi();if(hnTowers[2].length===5){openSacredModal({icon:"⋁",title:"Hanoi",text:`¡${hnMoves} movimientos!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initHanoi();">Otra</button>`});}}else{hnSelected=-1;renderHanoi();}}}

  // Anagrama
  const ANA_WORDS=["AMOR","CORAZON","ETERNIDAD","SANTUARIO","CARMESI","ALMAS","BESO","ABRAZO","DEVOCION","PASION"];let anaWord="",anaIdx=0;
  window.initAnagrama=function(){anaWord=ANA_WORDS[anaIdx%ANA_WORDS.length];anaIdx++;document.getElementById("an-num").textContent=((anaIdx-1)%ANA_WORDS.length+1)+"/"+ANA_WORDS.length;const shuffled=anaWord.split("").sort(()=>Math.random()-0.5).join("");document.getElementById("an-display").textContent=shuffled;document.getElementById("an-input").value="";document.getElementById("an-msg").textContent="";};
  window.checkAnagrama=function(){const v=document.getElementById("an-input").value.trim().toUpperCase();if(v===anaWord){document.getElementById("an-msg").textContent="¡Correcto!";openSacredModal({icon:"⟲",title:"Anagrama",text:`¡${anaWord}!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initAnagrama();">Otra</button>`});}else{document.getElementById("an-msg").textContent="Incorrecto. Intenta de nuevo.";};};

  // Matemáticas
  let mtScore=0,mtTime=30,mtInterval=null,mtAnswer=0;
  window.initMath=function(){mtScore=0;mtTime=30;document.getElementById("mt-score").textContent="0";document.getElementById("mt-time").textContent="30";document.getElementById("mt-input").value="";if(mtInterval)clearInterval(mtInterval);nextMath();mtInterval=setInterval(()=>{mtTime--;document.getElementById("mt-time").textContent=mtTime;if(mtTime<=0){clearInterval(mtInterval);openSacredModal({icon:"≠",title:"Matemáticas",text:`¡Puntos: ${mtScore}!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initMath();">Otra</button>`});}},1000);};
  function nextMath(){const a=Math.floor(Math.random()*20)+1,b=Math.floor(Math.random()*20)+1;const op=["+","-","×"][Math.floor(Math.random()*3)];if(op==="+")mtAnswer=a+b;if(op==="-")mtAnswer=a-b;if(op==="×")mtAnswer=a*b;document.getElementById("mt-display").textContent=`${a} ${op} ${b}`;}
  window.checkMath=function(){const v=parseInt(document.getElementById("mt-input").value,10);if(v===mtAnswer){mtScore++;document.getElementById("mt-score").textContent=mtScore;document.getElementById("mt-input").value="";nextMath();}};

  // Trivia
  const TV_QS=[{q:"¿Capital de Francia?",opts:["París","Londres","Madrid","Roma"],ans:0},{q:"¿Cuántos continentes hay?",opts:["5","6","7","8"],ans:2},{q:"¿Color del cielo al atardecer?",opts:["Azul","Rojo","Verde","Negro"],ans:1},{q:"¿Planeta más cercano al sol?",opts:["Venus","Mercurio","Marte","Tierra"],ans:1},{q:"¿Cuántas patas tiene una araña?",opts:["6","8","10","4"],ans:1},{q:"¿Quién escribió Romeo y Julieta?",opts:["Cervantes","Shakespeare","García","Neruda"],ans:1},{q:"¿Año del primer hombre en la luna?",opts:["1965","1969","1972","1958"],ans:1},{q:"¿Metal líquido a temp. ambiente?",opts:["Mercurio","Hierro","Oro","Plata"],ans:0},{q:"¿Río más largo del mundo?",opts:["Nilo","Amazonas","Misisipi","Yangtsé"],ans:1},{q:"¿Cuántos colores tiene el arcoíris?",opts:["5","6","7","8"],ans:2}];
  let tvIdx=0,tvScore=0;
  window.initTrivia=function(){tvIdx=0;tvScore=0;document.getElementById("tv-score").textContent="0";nextTrivia();};
  function nextTrivia(){if(tvIdx>=TV_QS.length){openSacredModal({icon:"❓",title:"Trivia",text:`¡${tvScore} correctas de ${TV_QS.length}!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initTrivia();">Otra</button>`});return;}const q=TV_QS[tvIdx];document.getElementById("tv-question").textContent=q.q;const o=document.getElementById("tv-options");o.innerHTML="";q.opts.forEach((opt,i)=>{const b=document.createElement("button");b.className="trivia-opt-btn";b.textContent=opt;b.addEventListener("click",()=>{b.disabled=true;if(i===q.ans){b.classList.add("correct");tvScore++;document.getElementById("tv-score").textContent=tvScore;}else{b.classList.add("wrong");}setTimeout(()=>{tvIdx++;nextTrivia();},800);});o.appendChild(b);});}

  // Colores
  let clLevel=1,clBaseColor="",clDiffColor="";
  window.initColores=function(){clLevel=1;document.getElementById("cl-level").textContent="1";nextColor();};
  function nextColor(){const grid=document.getElementById("cl-grid");grid.innerHTML="";const count=Math.min(3+Math.floor(clLevel/2),9);const diff=Math.max(20-clLevel*2,5);clBaseColor=randomColor();clDiffColor=shiftColor(clBaseColor,diff);const diffIdx=Math.floor(Math.random()*count);for(let i=0;i<count;i++){const c=document.createElement("div");c.className="color-cell";c.style.background=i===diffIdx?clDiffColor:clBaseColor;c.addEventListener("click",()=>{if(i===diffIdx){clLevel++;document.getElementById("cl-level").textContent=clLevel;nextColor();}else{openSacredModal({icon:"◉",title:"Colores",text:`Nivel ${clLevel}.`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initColores();">Otra</button>`});}});grid.appendChild(c);}}
  function randomColor(){const h=Math.floor(Math.random()*360);return`hsl(${h},70%,45%)`;}
  function shiftColor(c,d){const m=c.match(/hsl\((\d+)/);const h=parseInt(m[1]);return`hsl(${(h+d)%360},70%,45%)`;}

  // Dardos
  let dtScore=0,dtDarts=5;
  window.initDardos=function(){dtScore=0;dtDarts=5;document.getElementById("dt-score").textContent="0";document.getElementById("dt-darts").textContent="5";const b=document.getElementById("dt-board");b.onclick=dtThrow;};
  function dtThrow(e){if(dtDarts<=0)return;const b=document.getElementById("dt-board");const rect=b.getBoundingClientRect();const cx=rect.width/2,cy=rect.height/2;const dx=e.clientX-rect.left-cx;const dy=e.clientY-rect.top-cy;const dist=Math.hypot(dx,dy);const max=rect.width/2;let pts=0;if(dist<max*0.1)pts=50;else if(dist<max*0.25)pts=25;else if(dist<max*0.5)pts=10;else if(dist<max*0.75)pts=5;else if(dist<max)pts=1;dtScore+=pts;dtDarts--;document.getElementById("dt-score").textContent=dtScore;document.getElementById("dt-darts").textContent=dtDarts;if(dtDarts<=0)openSacredModal({icon:"⊕",title:"Dardos",text:`¡${dtScore} puntos!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initDardos();">Otra</button>`});}

  // Adivina palabra
  const AW_WORDS=[{w:"SOL",h:"Estrella del día"},{w:"MAR",h:"Gran masa de agua"},{w:"FLOR",h:"Planta colorida"},{w:"LUNA",h:"Satélite de la Tierra"},{w:"BESO",h:"Muestra de amor"},{w:"ROSA",h:"Flor con espinas"},{w:"NOCHE",h:"Cuando oscurece"},{w:"FUEGO",h:"Calor y luz"},{w:"AMOR",h:"Sentimiento profundo"},{w:"SUEÑO",h:"Lo que tienes al dormir"}];let awW="",awI=5,awIdx=0;
  window.initAdivinaPalabra=function(){const item=AW_WORDS[awIdx%AW_WORDS.length];awIdx++;awW=item.w;awI=5;document.getElementById("aw-intentos").textContent=awI;document.getElementById("aw-hint").textContent="Pista: "+item.h;document.getElementById("aw-input").value="";document.getElementById("aw-msg").textContent="";};
  window.checkAdivinaPalabra=function(){const v=document.getElementById("aw-input").value.trim().toUpperCase();if(v===awW){document.getElementById("aw-msg").textContent="¡Correcto!";openSacredModal({icon:"❖",title:"Adivina",text:`¡${awW}!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initAdivinaPalabra();">Otra</button>`});}else{awI--;document.getElementById("aw-intentos").textContent=awI;document.getElementById("aw-msg").textContent="Incorrecto.";if(awI<=0)openSacredModal({icon:"❖",title:"Adivina",text:`Era: ${awW}`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initAdivinaPalabra();">Otra</button>`});}};

  // Orden numérico
  let orNums=[],orNext=1,orStart=0,orInterval=null;
  window.initOrden=function(){orNums=[];while(orNums.length<9){const n=Math.floor(Math.random()*90)+10;if(!orNums.includes(n))orNums.push(n);}orNums.sort((a,b)=>a-b);const shuffled=orNums.map((n)=>({n,r:Math.random()})).sort((a,b)=>a.r-b.r).map((x)=>x.n);orNext=1;orStart=Date.now();document.getElementById("or-next").textContent=orNums[0];if(orInterval)clearInterval(orInterval);orInterval=setInterval(()=>{document.getElementById("or-time").textContent=Math.floor((Date.now()-orStart)/1000);},1000);renderOrden(shuffled);};
  function renderOrden(nums){const g=document.getElementById("or-grid");g.innerHTML="";nums.forEach((n)=>{const c=document.createElement("div");c.className="color-cell";c.style.background="var(--crimson-abyss)";c.style.color="var(--white-pure)";c.style.fontFamily="'Cinzel Decorative',serif";c.style.fontSize="1.5rem";c.textContent=n;c.dataset.val=n;c.addEventListener("click",()=>{if(parseInt(c.dataset.val)===orNums[orNext-1]){c.style.visibility="hidden";orNext++;if(orNext<=9)document.getElementById("or-next").textContent=orNums[orNext-1];else{clearInterval(orInterval);const t=Math.floor((Date.now()-orStart)/1000);openSacredModal({icon:"①",title:"Orden",text:`¡${t}s!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initOrden();">Otra</button>`});}}else{clearInterval(orInterval);openSacredModal({icon:"①",title:"Orden",text:"Error. Número incorrecto.",withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initOrden();">Otra</button>`});}});g.appendChild(c);});}

  // Doble dado
  let dbDobles=0,dbTiros=0;
  window.rollDoble=function(){const f=["⚀","⚁","⚂","⚃","⚄","⚅"];const v1=Math.floor(Math.random()*6),v2=Math.floor(Math.random()*6);document.getElementById("db-d1").textContent=f[v1];document.getElementById("db-d2").textContent=f[v2];dbTiros++;if(v1===v2){dbDobles++;document.getElementById("db-msg").textContent=`¡Dobles de ${v1+1}!`;spawnHeartsRain(20);}else{document.getElementById("db-msg").textContent=`${v1+1} y ${v2+1}. Intenta de nuevo.`;}document.getElementById("db-dobles").textContent=dbDobles;document.getElementById("db-tiros").textContent=dbTiros;};

  // ================= 21 JUEGOS NUEVOS =================
  // Pong
  let pongInterval=null,pongScore=0,pongBall={x:200,y:150,vx:3,vy:2},pongPaddle={y:120};
  window.initPong=function(){pongScore=0;pongBall={x:200,y:150,vx:3,vy:2};pongPaddle={y:120};document.getElementById("pong-score").textContent="0";if(pongInterval)clearInterval(pongInterval);const c=document.getElementById("pong-canvas");const ctx=c.getContext("2d");c.onmousemove=(e)=>{const r=c.getBoundingClientRect();pongPaddle.y=Math.max(0,Math.min(c.height-60,(e.clientY-r.top)*c.height/r.height-30));};document.addEventListener("keydown",(e)=>{if(e.key==="ArrowUp")pongPaddle.y=Math.max(0,pongPaddle.y-20);if(e.key==="ArrowDown")pongPaddle.y=Math.min(c.height-60,pongPaddle.y+20);});pongInterval=setInterval(()=>{pongBall.x+=pongBall.vx;pongBall.y+=pongBall.vy;if(pongBall.y<=0||pongBall.y>=c.height)pongBall.vy*=-1;if(pongBall.x<=10&&pongBall.y>=pongPaddle.y&&pongBall.y<=pongPaddle.y+60){pongBall.vx*=-1.05;pongScore++;document.getElementById("pong-score").textContent=pongScore;}if(pongBall.x<=0){clearInterval(pongInterval);openSacredModal({icon:"◣",title:"Pong",text:`Puntos: ${pongScore}`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initPong();">Otra</button>`});}if(pongBall.x>=c.width)pongBall.vx*=-1;ctx.fillStyle="#030303";ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle="#b80000";ctx.fillRect(0,pongPaddle.y,8,60);ctx.fillStyle="#e60000";ctx.beginPath();ctx.arc(pongBall.x,pongBall.y,6,0,Math.PI*2);ctx.fill();},30);};

  // Breakout
  let brkInterval=null,brkScore=0,brkBall={x:200,y:300,vx:2,vy:-2},brkPaddle={x:160},brkBricks=[];
  window.initBreakout=function(){brkScore=0;brkBall={x:200,y:300,vx:2,vy:-2};brkPaddle={x:160};brkBricks=[];for(let r=0;r<4;r++)for(let c=0;c<8;c++)brkBricks.push({x:c*48+5,y:r*25+10,alive:true});document.getElementById("brk-score").textContent="0";if(brkInterval)clearInterval(brkInterval);const cv=document.getElementById("brk-canvas");const ctx=cv.getContext("2d");cv.onmousemove=(e)=>{const r=cv.getBoundingClientRect();brkPaddle.x=Math.max(0,Math.min(cv.width-80,(e.clientX-r.left)*cv.width/r.width-40));};brkInterval=setInterval(()=>{brkBall.x+=brkBall.vx;brkBall.y+=brkBall.vy;if(brkBall.x<=0||brkBall.x>=cv.width)brkBall.vx*=-1;if(brkBall.y<=0)brkBall.vy*=-1;if(brkBall.y>=cv.height-10&&brkBall.x>=brkPaddle.x&&brkBall.x<=brkPaddle.x+80)brkBall.vy*=-1;if(brkBall.y>=cv.height){clearInterval(brkInterval);openSacredModal({icon:"▦",title:"Ladrillos",text:`Puntos: ${brkScore}`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initBreakout();">Otra</button>`});}brkBricks.forEach((b)=>{if(b.alive&&brkBall.x>=b.x&&brkBall.x<=b.x+43&&brkBall.y>=b.y&&brkBall.y<=b.y+20){b.alive=false;brkBall.vy*=-1;brkScore++;document.getElementById("brk-score").textContent=brkScore;}});if(brkBricks.every((b)=>!b.alive)){clearInterval(brkInterval);openSacredModal({icon:"▦",title:"¡Victoria!",text:`¡Destruido todo! Puntos: ${brkScore}`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initBreakout();">Otra</button>`});}ctx.fillStyle="#030303";ctx.fillRect(0,0,cv.width,cv.height);brkBricks.forEach((b)=>{if(b.alive){ctx.fillStyle=b.y<35?"#e60000":b.y<70?"#b80000":"#750000";ctx.fillRect(b.x,b.y,43,20);}});ctx.fillStyle="#b80000";ctx.fillRect(brkPaddle.x,cv.height-8,80,6);ctx.fillStyle="#e60000";ctx.beginPath();ctx.arc(brkBall.x,brkBall.y,5,0,Math.PI*2);ctx.fill();},30);};

  // Mini Golf
  let golfBall={x:50,y:150,vx:0,vy:0},golfStrokes=0,golfHole={x:350,y:150},golfDragging=false,golfDragStart=null;
  window.initGolf=function(){golfBall={x:50,y:150,vx:0,vy:0};golfStrokes=0;document.getElementById("golf-strokes").textContent="0";document.getElementById("golf-msg").textContent="Arrastra desde la pelota para apuntar.";const c=document.getElementById("golf-canvas");const ctx=c.getContext("2d");const draw=()=>{ctx.fillStyle="#030303";ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle="#3b0000";ctx.beginPath();ctx.arc(golfHole.x,golfHole.y,12,0,Math.PI*2);ctx.fill();ctx.fillStyle="#e60000";ctx.beginPath();ctx.arc(golfBall.x,golfBall.y,7,0,Math.PI*2);ctx.fill();if(golfDragging&&golfDragStart){ctx.strokeStyle="#b80000";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(golfBall.x,golfBall.y);ctx.lineTo(golfDragStart.x,golfDragStart.y);ctx.stroke();}};c.onmousedown=(e)=>{const r=c.getBoundingClientRect();const mx=(e.clientX-r.left)*c.width/r.width,my=(e.clientY-r.top)*c.height/r.height;if(Math.hypot(mx-golfBall.x,my-golfBall.y)<20){golfDragging=true;golfDragStart={x:mx,y:my};}};c.onmousemove=(e)=>{if(golfDragging){const r=c.getBoundingClientRect();golfDragStart={x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height};draw();}};c.onmouseup=(e)=>{if(golfDragging){const r=c.getBoundingClientRect();const mx=(e.clientX-r.left)*c.width/r.width,my=(e.clientY-r.top)*c.height/r.height;golfBall.vx=(golfBall.x-mx)*0.1;golfBall.vy=(golfBall.y-my)*0.1;golfStrokes++;document.getElementById("golf-strokes").textContent=golfStrokes;golfDragging=false;golfDragStart=null;}};const anim=()=>{if(Math.abs(golfBall.vx)>0.1||Math.abs(golfBall.vy)>0.1){golfBall.x+=golfBall.vx;golfBall.y+=golfBall.vy;golfBall.vx*=0.98;golfBall.vy*=0.98;if(golfBall.x<7||golfBall.x>c.width-7)golfBall.vx*=-1;if(golfBall.y<7||golfBall.y>c.height-7)golfBall.vy*=-1;if(Math.hypot(golfBall.x-golfHole.x,golfBall.y-golfHole.y)<12){openSacredModal({icon:"⛳",title:"Mini Golf",text:`¡En el hoyo en ${golfStrokes} golpes!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initGolf();">Otra</button>`});golfBall={x:50,y:150,vx:0,vy:0};}}draw();requestAnimationFrame(anim);};anim();};

  // Sudoku 4x4
  let sdk4Board=[],sdk4Solution=[];
  window.initSudoku4=function(){const gen=()=>{const g=[[],[],[],[]];for(let i=0;i<4;i++)for(let j=0;j<4;j++)g[i][j]=((i*2+j+Math.floor(i/2))%4)+1;return g;};sdk4Solution=gen();sdk4Board=sdk4Solution.map((r)=>[...r]);for(let i=0;i<8;i++){const r=Math.floor(Math.random()*4),c=Math.floor(Math.random()*4);sdk4Board[r][c]=0;}const grid=document.getElementById("sudoku4-grid");grid.innerHTML="";for(let r=0;r<4;r++)for(let c=0;c<4;c++){const cell=document.createElement("div");cell.className="g2048-cell";cell.textContent=sdk4Board[r][c]||"";if(!sdk4Board[r][c]){cell.style.cursor="pointer";cell.dataset.r=r;cell.dataset.c=c;cell.addEventListener("click",()=>{sdk4Board[r][c]=((sdk4Board[r][c]||0)%4)+1;cell.textContent=sdk4Board[r][c];if(JSON.stringify(sdk4Board)===JSON.stringify(sdk4Solution)){document.getElementById("sudoku4-msg").textContent="¡Correcto!";openSacredModal({icon:"▦",title:"Sudoku",text:"¡Completado!",withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initSudoku4();">Otra</button>`});}});}grid.appendChild(cell);}};

  // Palabra Oculta (similar a anagrama con más palabras)
  const WH_WORDS=["SANTUARIO","CORAZON","ETERNIDAD","CARMESI","ALMAS","BESO","ABRAZO","DEVOCION","PASION","AMOR"];let whWord="",whIdx=0;
  window.initWordHide=function(){whWord=WH_WORDS[whIdx%WH_WORDS.length];whIdx++;document.getElementById("wh-num").textContent=((whIdx-1)%WH_WORDS.length+1)+"/"+WH_WORDS.length;const sh=whWord.split("").sort(()=>Math.random()-0.5).join("");document.getElementById("wh-display").textContent=sh;document.getElementById("wh-input").value="";document.getElementById("wh-msg").textContent="";};
  window.checkWordHide=function(){const v=document.getElementById("wh-input").value.trim().toUpperCase();if(v===whWord){document.getElementById("wh-msg").textContent="¡Correcto!";openSacredModal({icon:"❖",title:"Palabra",text:`¡${whWord}!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initWordHide();">Otra</button>`});}else{document.getElementById("wh-msg").textContent="Incorrecto.";};};

  // Cuadrado Mágico
  let magicBoard=[],magicNext=1;
  window.initMagicSquare=function(){magicBoard=[0,0,0,0,0,0,0,0,0];magicNext=1;document.getElementById("ms-msg").textContent="Coloca 1-9. Cada línea suma 15.";const grid=document.getElementById("ms-grid");grid.innerHTML="";for(let i=0;i<9;i++){const cell=document.createElement("div");cell.className="g2048-cell";cell.dataset.i=i;cell.addEventListener("click",()=>{if(magicBoard[i]===0&&magicNext<=9){magicBoard[i]=magicNext;cell.textContent=magicNext;magicNext++;if(magicNext>9){const rows=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];const ok=rows.every((r)=>r.reduce((s,i)=>s+magicBoard[i],0)===15);document.getElementById("ms-msg").textContent=ok?"¡Cuadrado mágico!":"No es mágico. Intenta otra distribución.";if(ok)openSacredModal({icon:"⊡",title:"Cuadrado Mágico",text:"¡Perfecto!",withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initMagicSquare();">Otra</button>`});}}});grid.appendChild(cell);}};

  // Secuencia
  let seqArr=[],seqLevel=1,seqShowing=false,seqUserIdx=0;
  window.initSequence=function(){seqArr=[];seqLevel=1;seqUserIdx=0;document.getElementById("seq-level").textContent="1";seqNext();};
  function seqNext(){seqUserIdx=0;seqArr.push(Math.floor(Math.random()*9));seqShowing=true;document.getElementById("seq-msg").textContent="Observa...";const grid=document.getElementById("seq-grid");grid.innerHTML="";for(let i=0;i<9;i++){const c=document.createElement("div");c.className="color-cell";c.style.background="#3b0000";c.textContent=i+1;c.addEventListener("click",()=>{if(seqShowing)return;const v=parseInt(c.textContent);if(v===seqArr[seqUserIdx]){seqUserIdx++;c.style.background="var(--crimson-vivid)";setTimeout(()=>c.style.background="#3b0000",200);if(seqUserIdx>=seqArr.length){seqLevel++;document.getElementById("seq-level").textContent=seqLevel;document.getElementById("seq-msg").textContent="¡Bien! Siguiente...";setTimeout(seqNext,800);}}else{document.getElementById("seq-msg").textContent=`Error. Nivel ${seqLevel}.`;openSacredModal({icon:"①",title:"Secuencia",text:`Llegaste al nivel ${seqLevel}.`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initSequence();">Otra</button>`});}});grid.appendChild(c);}let i=0;const iv=setInterval(()=>{if(i>=seqArr.length){clearInterval(iv);seqShowing=false;document.getElementById("seq-msg").textContent="Tu turno.";return;}const cell=grid.children[seqArr[i]];cell.style.background="var(--crimson-glow)";setTimeout(()=>cell.style.background="#3b0000",400);i++;},600);}

  // Atrapa Estrellas
  let csInterval=null,csScore=0,csStars=[],csBasket={x:180};
  window.initCatchStar=function(){csScore=0;csStars=[];csBasket={x:180};document.getElementById("cs-score").textContent="0";if(csInterval)clearInterval(csInterval);const c=document.getElementById("cs-canvas");const ctx=c.getContext("2d");c.onmousemove=(e)=>{const r=c.getBoundingClientRect();csBasket.x=Math.max(20,Math.min(c.width-20,(e.clientX-r.left)*c.width/r.width));};document.addEventListener("keydown",(e)=>{if(e.key==="ArrowLeft")csBasket.x=Math.max(20,csBasket.x-20);if(e.key==="ArrowRight")csBasket.x=Math.min(c.width-20,csBasket.x+20);});csInterval=setInterval(()=>{if(Math.random()<0.1)csStars.push({x:Math.random()*(c.width-20)+10,y:0,vy:Math.random()*2+1});csStars.forEach((s)=>s.y+=s.vy);csStars=csStars.filter((s)=>{if(s.y>=c.height-20&&Math.abs(s.x-csBasket.x)<25){csScore++;document.getElementById("cs-score").textContent=csScore;return false;}return s.y<c.height;});ctx.fillStyle="#030303";ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle="#e60000";ctx.font="20px serif";ctx.textAlign="center";csStars.forEach((s)=>{ctx.fillStyle="#e60000";ctx.fillText("★",s.x,s.y);});ctx.fillStyle="#b80000";ctx.fillRect(csBasket.x-25,c.height-15,50,10);},40);};

  // Carrera de caballos
  let hrInterval=null,hrHorses=[];
  window.initHorseRace=function(){const names=["♞ Rojo","♞ Blanco","♞ Oscuro","♞ Dorado"];hrHorses=names.map((n)=>({name:n,pos:0,speed:Math.random()*0.5+0.5}));const track=document.getElementById("hr-track");track.innerHTML="";hrHorses.forEach((h)=>{const row=document.createElement("div");row.style.cssText="display:flex;align-items:center;gap:0.5rem;border:1px solid var(--crimson-blood);padding:0.4rem;";row.innerHTML=`<span style="width:100px;">${h.name}</span><div style="flex:1;height:20px;background:var(--black-void);border:1px solid var(--crimson-blood);position:relative;"><div class="hr-bar" style="position:absolute;height:100%;background:var(--crimson-vivid);width:0%;"></div></div>`;track.appendChild(row);});if(hrInterval)clearInterval(hrInterval);document.getElementById("hr-msg").textContent="¡Carrera en marcha!";hrInterval=setInterval(()=>{hrHorses.forEach((h,i)=>{h.pos+=Math.random()*h.speed*2;if(h.pos>=100){clearInterval(hrInterval);document.getElementById("hr-msg").textContent=`¡Ganador: ${h.name}!`;openSacredModal({icon:"♞",title:"Carrera",text:`¡Ganó ${h.name}!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initHorseRace();">Otra</button>`});h.pos=100;}track.children[i].querySelector(".hr-bar").style.width=h.pos+"%";});},100);};

  // Dados Poker
  window.rollDicePoker=function(){const f=["⚀","⚁","⚂","⚃","⚄","⚅"];const dice=Array.from({length:5},()=>Math.floor(Math.random()*6)+1);document.getElementById("dp-dice").textContent=dice.map((v)=>f[v-1]).join(" ");const counts={};dice.forEach((v)=>counts[v]=(counts[v]||0)+1);const vals=Object.values(counts).sort((a,b)=>b-a);let result;if(vals[0]===5)result="¡Póker de 5!";else if(vals[0]===4)result="¡Póker de 4!";else if(vals[0]===3&&vals[1]===2)result="¡Full House!";else if(vals[0]===3)result="¡Trío!";else if(vals[0]===2&&vals[1]===2)result="¡Doble Par!";else if(vals[0]===2)result="Par";else result="Nada especial";document.getElementById("dp-result").textContent=result;};

  // Blackjack
  let bjDeck=[],bjYou=[],bjDealer=[],bjScore=0,bjDealerScore=0;
  window.initBlackjack=function(){bjDeck=[];for(let v=1;v<=13;v++)for(let s=0;s<4;s++)bjDeck.push(v);bjDeck.sort(()=>Math.random()-0.5);bjYou=[];bjDealer=[];bjScore=0;bjDealerScore=0;document.getElementById("bj-msg").textContent="";bjHit();bjHit();drawBJ();};
  function bjVal(c){return c>10?10:c;}
  function bjDraw(){bjScore=bjYou.reduce((s,c)=>s+bjVal(c),0);bjDealerScore=bjDealer.reduce((s,c)=>s+bjVal(c),0);document.getElementById("bj-you").textContent=bjScore;document.getElementById("bj-dealer").textContent=bjDealerScore;const f={1:"A",11:"J",12:"Q",13:"K"};document.getElementById("bj-cards").textContent=bjYou.map((c)=>f[c]||c).join(" ");}
  window.bjHit=function(){if(bjScore>=21)return;bjYou.push(bjDeck.pop());drawBJ();if(bjScore>21){document.getElementById("bj-msg").textContent="¡Te pasaste!";openSacredModal({icon:"♣",title:"Blackjack",text:"Te pasaste de 21.",withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initBlackjack();">Otra</button>`});}};
  window.bjStand=function(){while(bjDealerScore<17){bjDealer.push(bjDeck.pop());bjDealerScore=bjDealer.reduce((s,c)=>s+bjVal(c),0);}drawBJ();let msg;if(bjDealerScore>21||bjScore>bjDealerScore){msg="¡Ganaste!";openSacredModal({icon:"♣",title:"Blackjack",text:msg,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initBlackjack();">Otra</button>`});}else if(bjScore<bjDealerScore){msg="La casa gana.";openSacredModal({icon:"♣",title:"Blackjack",text:msg,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initBlackjack();">Otra</button>`});}else{msg="Empate.";openSacredModal({icon:"♣",title:"Blackjack",text:msg,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initBlackjack();">Otra</button>`});}document.getElementById("bj-msg").textContent=msg;};

  // Ruleta Numérica
  let nrPoints=100;
  window.spinNumRoulette=function(){const bet=parseInt(document.getElementById("nr-bet").value);const num=parseInt(document.getElementById("nr-num").value);if(!bet||bet>nrPoints||num===undefined||num<0||num>9){alert("Apuesta o número inválido.");return;}const result=Math.floor(Math.random()*10);let i=0;const spin=setInterval(()=>{document.getElementById("nr-display").textContent=Math.floor(Math.random()*10);i++;if(i>=15){clearInterval(spin);document.getElementById("nr-display").textContent=result;if(result===num){nrPoints+=bet*9;document.getElementById("nr-msg").textContent=`¡Correcto! +${bet*9}`;}else{nrPoints-=bet;document.getElementById("nr-msg").textContent=`Salió ${result}. -${bet}`;}document.getElementById("nr-points").textContent=nrPoints;if(nrPoints<=0){openSacredModal({icon:"⊙",title:"Ruleta",text:"Sin puntos.",withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();nrPoints=100;document.getElementById('nr-points').textContent=100;">Reiniciar</button>`});}}},80);};

  // Encuentra el Par
  let fpCards=[],fpFlipped=[],fpTries=0,fpMatched=0;
  window.initFindPair=function(){const syms=["♥","♛","✠","❖","✧","⚜"];fpCards=[...syms,...syms].sort(()=>Math.random()-0.5);fpFlipped=[];fpTries=0;fpMatched=0;document.getElementById("fp-tries").textContent="0";document.getElementById("fp-msg").textContent="";const grid=document.getElementById("fp-grid");grid.innerHTML="";fpCards.forEach((s,i)=>{const c=document.createElement("div");c.className="memory-card";c.innerHTML=`<span class="memory-symbol">${s}</span>`;c.addEventListener("click",()=>{if(fpFlipped.length>=2||c.classList.contains("flipped")||c.classList.contains("matched"))return;c.classList.add("flipped");fpFlipped.push({i,c,sym:s});if(fpFlipped.length===2){fpTries++;document.getElementById("fp-tries").textContent=fpTries;setTimeout(()=>{if(fpFlipped[0].sym===fpFlipped[1].sym){fpFlipped[0].c.classList.add("matched");fpFlipped[1].c.classList.add("matched");fpMatched++;if(fpMatched===syms.length){openSacredModal({icon:"❖",title:"¡Par!",text:`¡Encontraste todos en ${fpTries} intentos!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initFindPair();">Otra</button>`});}}else{fpFlipped[0].c.classList.remove("flipped");fpFlipped[1].c.classList.remove("flipped");}fpFlipped=[];},700);}});grid.appendChild(c);});};

  // Suma Rápida
  let qsRemain=10,qsA=0,qsB=0,qsStart=0,qsInterval=null;
  window.initQuickSum=function(){qsRemain=10;qsStart=Date.now();document.getElementById("qs-remain").textContent="10";if(qsInterval)clearInterval(qsInterval);qsInterval=setInterval(()=>{document.getElementById("qs-time").textContent=Math.floor((Date.now()-qsStart)/1000);},1000);nextQS();};
  function nextQS(){if(qsRemain<=0){clearInterval(qsInterval);const t=Math.floor((Date.now()-qsStart)/1000);openSacredModal({icon:"+",title:"Suma Rápida",text:`¡Completado en ${t}s!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initQuickSum();">Otra</button>`});return;}qsA=Math.floor(Math.random()*50)+1;qsB=Math.floor(Math.random()*50)+1;document.getElementById("qs-display").textContent=`${qsA} + ${qsB}`;document.getElementById("qs-input").value="";}
  window.checkQuickSum=function(){const v=parseInt(document.getElementById("qs-input").value);if(v===qsA+qsB){qsRemain--;document.getElementById("qs-remain").textContent=qsRemain;nextQS();}};

  // Cartas Memoria
  let cmCards=[],cmLevel=1;
  window.initCardMemory=function(){cmLevel=1;document.getElementById("cm-level").textContent="1";cmNext();};
  function cmNext(){const n=cmLevel+2;const suits=["♠","♥","♣","♦"];cmCards=Array.from({length:n},()=>suits[Math.floor(Math.random()*4)]+Math.floor(Math.random()*13+1));document.getElementById("cm-display").textContent=cmCards.join(" ");document.getElementById("cm-input").value="";document.getElementById("cm-msg").textContent="Memoriza...";setTimeout(()=>{document.getElementById("cm-display").textContent="? ".repeat(n);document.getElementById("cm-msg").textContent="Escribe las cartas separadas por espacio.";},cmLevel*1000+2000);}
  window.checkCardMemory=function(){const v=document.getElementById("cm-input").value.trim().split(/\s+/);if(v.length!==cmCards.length){document.getElementById("cm-msg").textContent="Cantidad incorrecta.";return;}const correct=v.every((c,i)=>c===cmCards[i]);if(correct){cmLevel++;document.getElementById("cm-level").textContent=cmLevel;openSacredModal({icon:"♠",title:"Cartas Memoria",text:`¡Nivel ${cmLevel}!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();cmNext();">Siguiente</button>`});}else{openSacredModal({icon:"♠",title:"Cartas",text:`Era: ${cmCards.join(" ")}`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initCardMemory();">Otra</button>`});}};

  // Mini Laberinto 2
  let mm2Grid=[[1,1,1,1,1,1,1],[1,0,0,0,0,0,1],[1,0,1,1,0,1,1],[1,0,0,0,0,0,1],[1,1,0,1,1,0,1],[1,0,0,0,0,2,1],[1,1,1,1,1,1,1]],mm2Pos={x:1,y:1},mm2Steps=0;
  window.initMiniMaze2=function(){mm2Pos={x:1,y:1};mm2Steps=0;document.getElementById("mm2-steps").textContent="0";drawMM2();};
  function drawMM2(){const c=document.getElementById("mm2-canvas");const ctx=c.getContext("2d");const cs=c.width/mm2Grid.length;ctx.clearRect(0,0,c.width,c.height);for(let r=0;r<mm2Grid.length;r++)for(let j=0;j<mm2Grid[r].length;j++){const v=mm2Grid[r][j];if(v===1){ctx.fillStyle="#3b0000";ctx.fillRect(j*cs,r*cs,cs,cs);}else{ctx.fillStyle="#060606";ctx.fillRect(j*cs,r*cs,cs,cs);}if(v===2){ctx.fillStyle="#e60000";ctx.font=`${cs*0.7}px serif`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("♛",j*cs+cs/2,r*cs+cs/2);}}ctx.fillStyle="#fff";ctx.font=`${cs*0.7}px serif`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("♚",mm2Pos.x*cs+cs/2,mm2Pos.y*cs+cs/2);}
  window.mm2Move=function(dx,dy){const nx=mm2Pos.x+dx,ny=mm2Pos.y+dy;if(mm2Grid[ny]&&mm2Grid[ny][nx]!==1){mm2Pos={x:nx,y:ny};mm2Steps++;document.getElementById("mm2-steps").textContent=mm2Steps;drawMM2();if(mm2Grid[ny][nx]===2)openSacredModal({icon:"⬚",title:"Laberinto",text:`¡Ganaste en ${mm2Steps} pasos!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initMiniMaze2();">Otra</button>`});}};

  // Canasta
  let bskScore=0,bskShots=5,bskBall={x:200,y:380,vy:0},bskHoop={x:200,y:80};
  window.initBasket=function(){bskScore=0;bskShots=5;bskBall={x:200,y:380,vy:0};document.getElementById("bsk-score").textContent="0";document.getElementById("bsk-shots").textContent="5";const c=document.getElementById("bsk-canvas");const ctx=c.getContext("2d");c.onclick=(e)=>{if(bskShots<=0||bskBall.vy!==0)return;const r=c.getBoundingClientRect();bskBall.vx=(e.clientX-r.left)*c.width/r.width-bskBall.x;bskBall.vy=-12;bskShots--;document.getElementById("bsk-shots").textContent=bskShots;};const anim=()=>{if(bskBall.vy<0||bskBall.y<c.height-20){bskBall.x+=bskBall.vx||0;bskBall.y+=bskBall.vy;bskBall.vy+=0.5;if(bskBall.y>=c.height-20){bskBall.y=c.height-20;bskBall.vy=0;bskBall.x=200;}if(Math.abs(bskBall.x-bskHoop.x)<25&&bskBall.y<100&&bskBall.vy>0){bskScore++;document.getElementById("bsk-score").textContent=bskScore;bskBall={x:200,y:380,vy:0};if(bskShots<=0){openSacredModal({icon:"❍",title:"Canasta",text:`¡${bskScore} puntos!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initBasket();">Otra</button>`});}}}ctx.fillStyle="#030303";ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle="#750000";ctx.fillRect(bskHoop.x-30,bskHoop.y-5,60,8);ctx.fillStyle="#e60000";ctx.beginPath();ctx.arc(bskBall.x,bskBall.y,12,0,Math.PI*2);ctx.fill();if(bskShots>0||bskBall.vy!==0)requestAnimationFrame(anim);};anim();};

  // Cuadrado Latino
  let lsBoard=[];
  window.initLatinSquare=function(){lsBoard=Array.from({length:4},()=>Array(4).fill(0));const sol=[[1,2,3,4],[3,4,1,2],[2,1,4,3],[4,3,2,1]];for(let i=0;i<6;i++){const r=Math.floor(Math.random()*4),c=Math.floor(Math.random()*4);lsBoard[r][c]=sol[r][c];}const grid=document.getElementById("ls-grid");grid.innerHTML="";for(let r=0;r<4;r++)for(let c=0;c<4;c++){const cell=document.createElement("div");cell.className="g2048-cell";cell.textContent=lsBoard[r][c]||"";if(!lsBoard[r][c]){cell.style.cursor="pointer";cell.dataset.r=r;cell.dataset.c=c;cell.addEventListener("click",()=>{lsBoard[r][c]=((lsBoard[r][c]||0)%4)+1;cell.textContent=lsBoard[r][c];checkLS();});}grid.appendChild(cell);}};
  function checkLS(){const ok=lsBoard.every((r)=>r.every((v)=>v!==0)&&new Set(r).size===4)&&[0,1,2,3].every((c)=>{const col=lsBoard.map((r)=>r[c]);return new Set(col).size===4;});if(ok){document.getElementById("ls-msg").textContent="¡Completado!";openSacredModal({icon:"⊞",title:"Cuadrado Latino",text:"¡Perfecto!",withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initLatinSquare();">Otra</button>`});}}

  // Reacción Pro
  let rprRound=0,rprTimes=[],rprTimeout=null,rprStart=0,rprState="waiting";
  window.initReactionPro=function(){rprRound=0;rprTimes=[];rprState="waiting";document.getElementById("rpr-round").textContent="0/5";document.getElementById("rpr-avg").textContent="—";document.getElementById("rpr-area").onclick=startRPR;document.getElementById("rpr-area").className="reaction-area waiting";document.getElementById("rpr-area").textContent="Clic para empezar...";};
  function startRPR(){rprRound++;if(rprRound>5){const avg=Math.round(rprTimes.reduce((a,b)=>a+b,0)/5);document.getElementById("rpr-msg").textContent=`Promedio: ${avg}ms`;openSacredModal({icon:"⚡",title:"Reacción Pro",text:`Promedio: ${avg}ms`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initReactionPro();">Otra</button>`});return;}document.getElementById("rpr-round").textContent=rprRound+"/5";const area=document.getElementById("rpr-area");rprState="waiting";area.className="reaction-area waiting";area.textContent="Espera...";rprTimeout=setTimeout(()=>{rprState="ready";area.className="reaction-area ready";area.textContent="¡CLIC!";rprStart=Date.now();},Math.random()*3000+1000);area.onclick=()=>{if(rprState==="ready"){const t=Date.now()-rprStart;rprTimes.push(t);rprState="result";area.className="reaction-area result";area.textContent=t+"ms";setTimeout(startRPR,1000);}else if(rprState==="waiting"){clearTimeout(rprTimeout);area.className="reaction-area tooearly";area.textContent="¡Pronto!";setTimeout(startRPR,1000);}};}

  // Match de Color
  let clmScore=0,clmTime=20,clmInterval=null,clmTarget="";
  window.initColorMatch=function(){clmScore=0;clmTime=20;if(clmInterval)clearInterval(clmInterval);document.getElementById("clm-score").textContent="0";document.getElementById("clm-time").textContent="20";clmInterval=setInterval(()=>{clmTime--;document.getElementById("clm-time").textContent=clmTime;if(clmTime<=0){clearInterval(clmInterval);openSacredModal({icon:"◉",title:"Color Match",text:`Puntos: ${clmScore}`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initColorMatch();">Otra</button>`});}},1000);nextCLM();};
  function nextCLM(){const colors=["#b80000","#e60000","#750000","#3b0000","#d4d4d4","#ffffff","#1a1a1a","#4a0000"];clmTarget=colors[Math.floor(Math.random()*colors.length)];document.getElementById("clm-target").style.background=clmTarget;const grid=document.getElementById("clm-grid");grid.innerHTML="";const shuffled=[...colors].sort(()=>Math.random()-0.5);shuffled.forEach((col)=>{const c=document.createElement("div");c.className="color-cell";c.style.background=col;c.addEventListener("click",()=>{if(col===clmTarget){clmScore++;document.getElementById("clm-score").textContent=clmScore;nextCLM();}});grid.appendChild(c);});}

  // Caza Números
  let nhTarget=0,nhStart=0,nhInterval=null;
  window.initNumberHunt=function(){nhTarget=Math.floor(Math.random()*90)+10;nhStart=Date.now();document.getElementById("nh-target").textContent=nhTarget;if(nhInterval)clearInterval(nhInterval);nhInterval=setInterval(()=>{document.getElementById("nh-time").textContent=Math.floor((Date.now()-nhStart)/1000);},1000);const grid=document.getElementById("nh-grid");grid.innerHTML="";const nums=Array.from({length:9},()=>Math.floor(Math.random()*90)+10);if(!nums.includes(nhTarget))nums[Math.floor(Math.random()*9)]=nhTarget;nums.sort(()=>Math.random()-0.5);nums.forEach((n)=>{const c=document.createElement("div");c.className="color-cell";c.style.background="#3b0000";c.style.color="var(--white-pure)";c.style.fontFamily="'Cinzel Decorative',serif";c.style.fontSize="1.3rem";c.textContent=n;c.addEventListener("click",()=>{if(n===nhTarget){clearInterval(nhInterval);const t=Math.floor((Date.now()-nhStart)/1000);openSacredModal({icon:"⌕",title:"Caza Números",text:`¡Encontrado en ${t}s!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initNumberHunt();">Otra</button>`});}else{c.style.visibility="hidden";}});grid.appendChild(c);});};

  // Memoria Numérica
  let mnSeq=[],mnLevel=1,mnShowing=false;
  window.initMemoryNum=function(){mnSeq=[];mnLevel=1;document.getElementById("mn-level").textContent="1";mnNext();};
  function mnNext(){mnSeq.push(Math.floor(Math.random()*10));mnShowing=true;document.getElementById("mn-display").textContent="...";document.getElementById("mn-input").value="";document.getElementById("mn-msg").textContent="Memoriza...";let i=0;const iv=setInterval(()=>{if(i>=mnSeq.length){clearInterval(iv);mnShowing=false;document.getElementById("mn-display").textContent="?";document.getElementById("mn-msg").textContent="Escribe los números en orden.";}else{document.getElementById("mn-display").textContent=mnSeq[i];i++;}},800);}
  window.checkMemoryNum=function(){if(mnShowing)return;const v=document.getElementById("mn-input").value.trim().replace(/\s/g,"");const ans=mnSeq.join("");if(v===ans){mnLevel++;document.getElementById("mn-level").textContent=mnLevel;document.getElementById("mn-msg").textContent="¡Correcto!";openSacredModal({icon:"③",title:"Memoria Numérica",text:`¡Nivel ${mnLevel}!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();mnNext();">Siguiente</button>`});}else{document.getElementById("mn-msg").textContent=`Incorrecto. Era: ${ans}`;openSacredModal({icon:"③",title:"Memoria",text:`Era: ${ans}`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initMemoryNum();">Otra</button>`});}};

  // Mini Tetris
  let ttGrid=[],ttPiece=null,ttLines=0,ttInterval=null,ttCtx=null;
  const TT_PIECES=[[[1,1,1,1]],[[1,1],[1,1]],[[0,1,0],[1,1,1]],[[1,0,0],[1,1,1]],[[0,0,1],[1,1,1]],[[1,1,0],[0,1,1]],[[0,1,1],[1,1,0]]];
  window.initTetris=function(){ttGrid=Array.from({length:20},()=>Array(10).fill(0));ttLines=0;document.getElementById("tt-lines").textContent="0";if(ttInterval)clearInterval(ttInterval);const c=document.getElementById("tt-canvas");ttCtx=c.getContext("2d");ttNewPiece();ttInterval=setInterval(ttTick,300);document.onkeydown=(e)=>{if(!document.getElementById("tetris")?.classList.contains("active"))return;if(e.key==="ArrowLeft"){e.preventDefault();ttPiece.x--;if(ttCollide())ttPiece.x++;}if(e.key==="ArrowRight"){e.preventDefault();ttPiece.x++;if(ttCollide())ttPiece.x--;}if(e.key==="ArrowDown"){e.preventDefault();ttTick();}if(e.key==="ArrowUp"){e.preventDefault();ttRotate();}};};
  function ttNewPiece(){ttPiece={shape:TT_PIECES[Math.floor(Math.random()*TT_PIECES.length)],x:4,y:0};if(ttCollide()){clearInterval(ttInterval);openSacredModal({icon:"▣",title:"Tetris",text:`¡${ttLines} líneas!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initTetris();">Otra</button>`});}}
  function ttCollide(){for(let r=0;r<ttPiece.shape.length;r++)for(let c=0;c<ttPiece.shape[r].length;c++)if(ttPiece.shape[r][c]){const x=ttPiece.x+c,y=ttPiece.y+r;if(x<0||x>=10||y>=20)return true;if(y>=0&&ttGrid[y][x])return true;}return false;}
  function ttMerge(){for(let r=0;r<ttPiece.shape.length;r++)for(let c=0;c<ttPiece.shape[r].length;c++)if(ttPiece.shape[r][c]&&ttPiece.y+r>=0)ttGrid[ttPiece.y+r][ttPiece.x+c]=1;}
  function ttRotate(){const old=ttPiece.shape;ttPiece.shape=old[0].map((_,i)=>old.map((r)=>r[i]).reverse());if(ttCollide())ttPiece.shape=old;}
  function ttTick(){ttPiece.y++;if(ttCollide()){ttPiece.y--;ttMerge();let cleared=0;for(let r=19;r>=0;r--)if(ttGrid[r].every((v)=>v)){ttGrid.splice(r,1);ttGrid.unshift(Array(10).fill(0));cleared++;r++;}if(cleared){ttLines+=cleared;document.getElementById("tt-lines").textContent=ttLines;}ttNewPiece();}ttDraw();}
  function ttDraw(){const c=document.getElementById("tt-canvas");if(!ttCtx)return;ttCtx.fillStyle="#030303";ttCtx.fillRect(0,0,c.width,c.height);const sz=20;for(let r=0;r<20;r++)for(let col=0;col<10;col++)if(ttGrid[r][col]){ttCtx.fillStyle="#b80000";ttCtx.fillRect(col*sz,r*sz,sz-1,sz-1);}if(ttPiece)for(let r=0;r<ttPiece.shape.length;r++)for(let col=0;col<ttPiece.shape[r].length;col++)if(ttPiece.shape[r][col]){ttCtx.fillStyle="#e60000";ttCtx.fillRect((ttPiece.x+col)*sz,(ttPiece.y+r)*sz,sz-1,sz-1);}}

  // ================= 21 JUEGOS ADICIONALES =================
  // Tragamonedas
  let slPoints=100;
  window.spinSlots=function(){if(slPoints<10)return;slPoints-=10;const syms=["♥","♛","✠","❖","✧","⚜"];const r=Array.from({length:3},()=>syms[Math.floor(Math.random()*syms.length)]);document.getElementById("sl-display").textContent=r.join(" ");if(r[0]===r[1]&&r[1]===r[2]){slPoints+=50;document.getElementById("sl-msg").textContent="¡TRIPLE! +50";}else if(r[0]===r[1]||r[1]===r[2]||r[0]===r[2]){slPoints+=15;document.getElementById("sl-msg").textContent="¡Par! +15";}else{document.getElementById("sl-msg").textContent="Sin suerte.";}document.getElementById("sl-points").textContent=slPoints;if(slPoints<=0)openSacredModal({icon:"✦",title:"Slots",text:"Sin puntos.",withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();slPoints=100;document.getElementById('sl-points').textContent=100;">Reiniciar</button>`});};
  // Cara o Cruz
  let cfScore=0;
  window.flipCoin=function(g){const r=Math.random()>0.5?"cara":"cruz";document.getElementById("cf-display").textContent=r==="cara"?"♚":"♛";if(r===g){cfScore++;document.getElementById("cf-msg").textContent="¡Correcto!";}else{document.getElementById("cf-msg").textContent="Incorrecto.";}document.getElementById("cf-score").textContent=cfScore;};
  // Guerra de Cartas
  let wcYou=0,wcCpu=0;
  window.drawWarCard=function(){const y=Math.floor(Math.random()*13)+1,c=Math.floor(Math.random()*13)+1;const f={1:"A",11:"J",12:"Q",13:"K"};document.getElementById("wc-cards").textContent=`Tú: ${f[y]||y} vs CPU: ${f[c]||c}`;if(y>c){wcYou++;document.getElementById("wc-msg").textContent="¡Ganaste!";}else if(y<c){wcCpu++;document.getElementById("wc-msg").textContent="Perdiste.";}else{document.getElementById("wc-msg").textContent="Empate.";}document.getElementById("wc-you").textContent=wcYou;document.getElementById("wc-cpu").textContent=wcCpu;if(wcYou>=5||wcCpu>=5)openSacredModal({icon:"⚔",title:"Guerra",text:wcYou>wcCpu?"¡Ganaste la guerra!":"La CPU ganó.",withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();wcYou=0;wcCpu=0;document.getElementById('wc-you').textContent=0;document.getElementById('wc-cpu').textContent=0;">Otra</button>`});};
  // Mayor o Menor
  let hlCurrent=0,hlStreak=0;
  window.initHighLow=function(){hlCurrent=Math.floor(Math.random()*13)+1;hlStreak=0;document.getElementById("hl-streak").textContent="0";document.getElementById("hl-card").textContent=hlCurrent;document.getElementById("hl-msg").textContent="";};
  window.hlGuess=function(g){const next=Math.floor(Math.random()*13)+1;const correct=(g==="higher"&&next>hlCurrent)||(g==="lower"&&next<hlCurrent);document.getElementById("hl-card").textContent=next;if(correct){hlStreak++;document.getElementById("hl-msg").textContent="¡Correcto!";}else{document.getElementById("hl-msg").textContent="Incorrecto.";openSacredModal({icon:"↑",title:"Mayor/Menor",text:`Racha: ${hlStreak}`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initHighLow();">Otra</button>`});return;}hlCurrent=next;document.getElementById("hl-streak").textContent=hlStreak;};
  // Toque Rápido
  let stTaps=0,stTime=10,stInterval=null;
  window.initSpeedTap=function(){stTaps=0;stTime=10;document.getElementById("st-taps").textContent="0";document.getElementById("st-time").textContent="10";if(stInterval)clearInterval(stInterval);const area=document.getElementById("st-area");area.className="reaction-area ready";area.textContent="¡CLIC RÁPIDO!";area.onclick=()=>{stTaps++;document.getElementById("st-taps").textContent=stTaps;};stInterval=setInterval(()=>{stTime--;document.getElementById("st-time").textContent=stTime;if(stTime<=0){clearInterval(stInterval);area.onclick=null;area.className="reaction-area result";area.textContent=`¡${stTaps} clics!`;openSacredModal({icon:"⚡",title:"Toque Rápido",text:`¡${stTaps} clics en 10s!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initSpeedTap();">Otra</button>`});}},1000);};
  // Golpea al Topo
  let waScore=0,waTime=20,waInterval=null;
  window.initWhackAMole=function(){waScore=0;waTime=20;document.getElementById("wa-score").textContent="0";document.getElementById("wa-time").textContent="20";if(waInterval)clearInterval(waInterval);const grid=document.getElementById("wa-grid");grid.innerHTML="";for(let i=0;i<9;i++){const c=document.createElement("div");c.className="memory-card";c.style.cursor="pointer";c.addEventListener("click",()=>{if(c.textContent==="♞"){waScore++;document.getElementById("wa-score").textContent=waScore;c.textContent="";c.classList.remove("flipped");}});grid.appendChild(c);}waInterval=setInterval(()=>{waTime--;document.getElementById("wa-time").textContent=waTime;if(waTime<=0){clearInterval(waInterval);openSacredModal({icon:"⚒",title:"Topos",text:`¡${waScore} puntos!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initWhackAMole();">Otra</button>`});return;}const cells=grid.children;Array.from(cells).forEach(c=>{c.textContent="";c.classList.remove("flipped");});const idx=Math.floor(Math.random()*9);cells[idx].textContent="♞";cells[idx].classList.add("flipped");},800);};
  // Rueda de la Suerte
  const LW_PRIZES=["Un beso","Un abrazo","Una carta","Una cita","Un masaje","Cantar","3 razones","Un baile","Un poema","Una foto"];
  window.spinLuckyWheel=function(){const prize=LW_PRIZES[Math.floor(Math.random()*LW_PRIZES.length)];document.getElementById("lw-display").textContent="...";setTimeout(()=>{document.getElementById("lw-display").textContent="❖ "+prize+" ❖";spawnHeartsRain(15);},1000);};
  // Caza del Tesoro
  let trTries=5,trTreasure=0;
  window.initTreasure=function(){trTries=5;trTreasure=Math.floor(Math.random()*9);document.getElementById("tr-tries").textContent="5";document.getElementById("tr-msg").textContent="";const grid=document.getElementById("tr-grid");grid.innerHTML="";for(let i=0;i<9;i++){const c=document.createElement("div");c.className="color-cell";c.style.background="#3b0000";c.style.fontSize="1.5rem";c.textContent="⚜";c.addEventListener("click",()=>{if(i===trTreasure){c.style.background="var(--crimson-glow)";c.textContent="⚜";document.getElementById("tr-msg").textContent="¡Tesoro encontrado!";openSacredModal({icon:"⚜",title:"Tesoro",text:"¡Encontraste el tesoro!",withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initTreasure();">Otra</button>`});}else{trTries--;document.getElementById("tr-tries").textContent=trTries;c.style.visibility="hidden";if(trTries<=0){openSacredModal({icon:"⚜",title:"Tesoro",text:"Sin intentos.",withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initTreasure();">Otra</button>`});}}});grid.appendChild(c);}};
  // Galleta de la Fortuna
  const FT_MSGS=["El amor que buscas está más cerca de lo que crees.","Tu corazón pronto recibirá una sorpresa inesperada.","La paciencia dará frutos de amor muy pronto.","Alguien piensa en ti en este preciso momento.","Tu sonrisa iluminará el día de alguien especial.","Un viaje inesperado traerá romance.","El destino tiene una sorpresa hermosa reservada para ti.","Pronto recibirás noticias que te harán muy feliz."];
  window.openFortune=function(){const msg=FT_MSGS[Math.floor(Math.random()*FT_MSGS.length)];document.getElementById("ft-display").textContent="❖";document.getElementById("ft-msg").textContent="...";setTimeout(()=>{document.getElementById("ft-msg").textContent=msg;spawnHeartsRain(10);},800);};
  // Calculadora de Amor
  window.calcLove=function(){const n1=document.getElementById("lc-name1").value.trim(),n2=document.getElementById("lc-name2").value.trim();if(!n1||!n2)return;const combined=(n1+n2).toLowerCase();let hash=0;for(let i=0;i<combined.length;i++)hash=((hash<<5)-hash)+combined.charCodeAt(i);const pct=Math.abs(hash)%100+1;document.getElementById("lc-result").textContent=pct+"%";document.getElementById("lc-msg").textContent=pct>=80?"¡Almas gemelas!":pct>=60?"¡Buena compatibilidad!":pct>=40?"Hay potencial.":"Sigan intentando.";if(pct>=80)spawnHeartsRain(30);};
  // Duelo de Dados
  let ddYou=0,ddCpu=0;
  window.rollDiceDuel=function(){const f=["⚀","⚁","⚂","⚃","⚄","⚅"];const y=Math.floor(Math.random()*6),c=Math.floor(Math.random()*6);document.getElementById("dd-d1").textContent=f[y];document.getElementById("dd-d2").textContent=f[c];if(y+1>c+1){ddYou++;document.getElementById("dd-msg").textContent="¡Ganaste!";}else if(y+1<c+1){ddCpu++;document.getElementById("dd-msg").textContent="Perdiste.";}else{document.getElementById("dd-msg").textContent="Empate.";}document.getElementById("dd-you").textContent=ddYou;document.getElementById("dd-cpu").textContent=ddCpu;if(ddYou>=5||ddCpu>=5)openSacredModal({icon:"⚅",title:"Duelo",text:ddYou>ddCpu?"¡Ganaste!":"La CPU ganó.",withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();ddYou=0;ddCpu=0;document.getElementById('dd-you').textContent=0;document.getElementById('dd-cpu').textContent=0;">Otra</button>`});};
  // Palabras Mezcladas
  const WS_WORDS2=["CORAZON","ETERNIDAD","SANTUARIO","DEVOCION","CARMESI","BESO","ABRAZO","PASION","ROMANCE","ALMAS"];let wsWord="",wsIdx=0;
  window.initWordScramble=function(){wsWord=WS_WORDS2[wsIdx%WS_WORDS2.length];wsIdx++;document.getElementById("ws-num").textContent=((wsIdx-1)%WS_WORDS2.length+1)+"/"+WS_WORDS2.length;const sh=wsWord.split("").sort(()=>Math.random()-0.5).join("");document.getElementById("ws-display").textContent=sh;document.getElementById("ws-input").value="";document.getElementById("ws-msg").textContent="";};
  window.checkWordScramble=function(){const v=document.getElementById("ws-input").value.trim().toUpperCase();if(v===wsWord){document.getElementById("ws-msg").textContent="¡Correcto!";openSacredModal({icon:"❖",title:"Palabra",text:`¡${wsWord}!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initWordScramble();">Otra</button>`});}else{document.getElementById("ws-msg").textContent="Incorrecto.";};};
  // Puzzle Numérico
  let npAnswer=0,npPattern="";
  window.initNumPuzzle=function(){const a=Math.floor(Math.random()*10)+1,d=Math.floor(Math.random()*5)+1;npPattern=`${a}, ${a+d}, ${a+2*d}, ?`;npAnswer=a+3*d;document.getElementById("np-display").textContent=npPattern;document.getElementById("np-input").value="";document.getElementById("np-msg").textContent="";};
  window.checkNumPuzzle=function(){const v=parseInt(document.getElementById("np-input").value);if(v===npAnswer){document.getElementById("np-msg").textContent="¡Correcto!";openSacredModal({icon:"⊞",title:"Puzzle",text:"¡Correcto!",withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initNumPuzzle();">Otra</button>`});}else{document.getElementById("np-msg").textContent="Incorrecto.";};};
  // Quiz de Colores
  let cqScore=0;
  const CQ_COLORS=[{n:"Rojo",h:"#b80000"},{n:"Blanco",h:"#ffffff"},{n:"Negro",h:"#000000"},{n:"Gris",h:"#808080"},{n:"Carmesí",h:"#e60000"},{n:"Plata",h:"#d4d4d4"}];
  function nextCQ(){const target=CQ_COLORS[Math.floor(Math.random()*CQ_COLORS.length)];document.getElementById("cq-color").style.background=target.h;const opts=[target,...CQ_COLORS.filter(c=>c.n!==target.n)].sort(()=>Math.random()-0.5).slice(0,4);const grid=document.getElementById("cq-options");grid.innerHTML="";opts.forEach(c=>{const b=document.createElement("button");b.className="trivia-opt-btn";b.textContent=c.n;b.addEventListener("click",()=>{if(c.n===target.n){cqScore++;document.getElementById("cq-score").textContent=cqScore;nextCQ();}else{b.style.opacity="0.3";}});grid.appendChild(b);});}
  window.initColorMatch=function(){cqScore=0;document.getElementById("cq-score").textContent="0";nextCQ();};
  // Esquiva Flechas
  let adInterval=null,adPlayer={x:200,y:150},adArrows=[],adTime=0,adStart=0;
  window.initArrowDodge=function(){adPlayer={x:200,y:150};adArrows=[];adStart=Date.now();if(adInterval)clearInterval(adInterval);const c=document.getElementById("ad-canvas");const ctx=c.getContext("2d");document.onkeydown=(e)=>{if(e.key==="ArrowLeft")adPlayer.x=Math.max(10,adPlayer.x-15);if(e.key==="ArrowRight")adPlayer.x=Math.min(c.width-10,adPlayer.x+15);if(e.key==="ArrowUp")adPlayer.y=Math.max(10,adPlayer.y-15);if(e.key==="ArrowDown")adPlayer.y=Math.min(c.height-10,adPlayer.y+15);};adInterval=setInterval(()=>{adTime=Math.floor((Date.now()-adStart)/1000);document.getElementById("ad-time").textContent=adTime;if(Math.random()<0.15)adArrows.push({x:Math.random()*c.width,y:-10,vy:Math.random()*3+2});adArrows.forEach(a=>a.y+=a.vy);adArrows=adArrows.filter(a=>{if(Math.hypot(a.x-adPlayer.x,a.y-adPlayer.y)<15){clearInterval(adInterval);openSacredModal({icon:"➤",title:"Esquiva",text:`Sobreviviste ${adTime}s`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initArrowDodge();">Otra</button>`});return false;}return a.y<c.height;});ctx.fillStyle="#030303";ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle="#e60000";ctx.beginPath();ctx.arc(adPlayer.x,adPlayer.y,8,0,Math.PI*2);ctx.fill();ctx.fillStyle="#b80000";adArrows.forEach(a=>{ctx.fillRect(a.x-2,a.y-5,4,10);});},30);};
  // Revienta Burbujas
  let bpScore=0,bpTime=15,bpInterval=null;
  window.initBubblePop=function(){bpScore=0;bpTime=15;document.getElementById("bp-score").textContent="0";document.getElementById("bp-time").textContent="15";if(bpInterval)clearInterval(bpInterval);const grid=document.getElementById("bp-grid");grid.innerHTML="";for(let i=0;i<16;i++){const c=document.createElement("div");c.className="memory-card";c.style.cursor="pointer";c.innerHTML=`<span class="memory-symbol" style="display:block;color:var(--crimson-vivid);">❍</span>`;c.addEventListener("click",()=>{if(c.style.visibility!=="hidden"){bpScore++;document.getElementById("bp-score").textContent=bpScore;c.style.visibility="hidden";}});grid.appendChild(c);}bpInterval=setInterval(()=>{bpTime--;document.getElementById("bp-time").textContent=bpTime;if(bpTime<=0){clearInterval(bpInterval);openSacredModal({icon:"❍",title:"Burbujas",text:`¡${bpScore} burbujas!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initBubblePop();">Otra</button>`});}},1000);};
  // Memoria Pro (10 pares)
  let mc2Cards=[],mc2Flipped=[],mc2Moves=0,mc2Matched=0;
  window.initMemoryCards2=function(){const syms=["♥","❤","❥","❣","♛","♚","✠","❖","✧","⚜"];mc2Cards=[...syms,...syms].sort(()=>Math.random()-0.5);mc2Flipped=[];mc2Moves=0;mc2Matched=0;document.getElementById("mc2-pairs").textContent="0/10";document.getElementById("mc2-moves").textContent="0";const grid=document.getElementById("mc2-grid");grid.innerHTML="";mc2Cards.forEach((s,i)=>{const c=document.createElement("div");c.className="memory-card";c.innerHTML=`<span class="memory-symbol">${s}</span>`;c.addEventListener("click",()=>{if(mc2Flipped.length>=2||c.classList.contains("flipped")||c.classList.contains("matched"))return;c.classList.add("flipped");mc2Flipped.push({i,c,sym:s});if(mc2Flipped.length===2){mc2Moves++;document.getElementById("mc2-moves").textContent=mc2Moves;setTimeout(()=>{if(mc2Flipped[0].sym===mc2Flipped[1].sym){mc2Flipped[0].c.classList.add("matched");mc2Flipped[1].c.classList.add("matched");mc2Matched++;document.getElementById("mc2-pairs").textContent=mc2Matched+"/10";if(mc2Matched===10)openSacredModal({icon:"❖",title:"Memoria Pro",text:`¡${mc2Moves} movimientos!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initMemoryCards2();">Otra</button>`});}else{mc2Flipped[0].c.classList.remove("flipped");mc2Flipped[1].c.classList.remove("flipped");}mc2Flipped=[];},700);}});grid.appendChild(c);});};
  // Mate Mixta
  let qm2Score=0,qm2Time=30,qm2Interval=null,qm2Answer=0,qm2Op="";
  window.initQuickMath2=function(){qm2Score=0;qm2Time=30;document.getElementById("qm2-score").textContent="0";document.getElementById("qm2-time").textContent="30";if(qm2Interval)clearInterval(qm2Interval);nextQM2();qm2Interval=setInterval(()=>{qm2Time--;document.getElementById("qm2-time").textContent=qm2Time;if(qm2Time<=0){clearInterval(qm2Interval);openSacredModal({icon:"÷",title:"Mate Mixta",text:`¡${qm2Score} puntos!`,withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initQuickMath2();">Otra</button>`});}},1000);};
  function nextQM2(){const a=Math.floor(Math.random()*20)+1,b=Math.floor(Math.random()*20)+1;const ops=["+","-","×","÷"];qm2Op=ops[Math.floor(Math.random()*4)];if(qm2Op==="+")qm2Answer=a+b;if(qm2Op==="-")qm2Answer=a-b;if(qm2Op==="×")qm2Answer=a*b;if(qm2Op==="÷"){const r=a*b;qm2Answer=a;document.getElementById("qm2-display").textContent=`${r} ${qm2Op} ${b} = ?`;return;}document.getElementById("qm2-display").textContent=`${a} ${qm2Op} ${b} = ?`;document.getElementById("qm2-input").value="";}
  window.checkQuickMath2=function(){const v=parseInt(document.getElementById("qm2-input").value);if(v===qm2Answer){qm2Score++;document.getElementById("qm2-score").textContent=qm2Score;nextQM2();}};
  // Lucky 7
  let l7Tries=0,l7Sevens=0;
  window.rollLucky7=function(){const r=Math.floor(Math.random()*10)+1;document.getElementById("l7-display").textContent=r;l7Tries++;if(r===7){l7Sevens++;document.getElementById("l7-msg").textContent="¡LUCKY 7!";spawnHeartsRain(20);}else{document.getElementById("l7-msg").textContent=`Salió ${r}.`;}document.getElementById("l7-tries").textContent=l7Tries;document.getElementById("l7-sevens").textContent=l7Sevens;};
  // Match 3
  let m3Grid=[],m3Score=0;
  window.initMatch3=function(){m3Score=0;document.getElementById("m3-score").textContent="0";const syms=["♥","♛","✠","❖","✧","⚜"];m3Grid=Array.from({length:36},()=>syms[Math.floor(Math.random()*6)]);renderM3();};
  function renderM3(){const grid=document.getElementById("m3-grid");grid.innerHTML="";m3Grid.forEach((s,i)=>{const c=document.createElement("div");c.className="g2048-cell";c.textContent=s;c.style.cursor="pointer";c.addEventListener("click",()=>{const row=Math.floor(i/6),col=i%6;const matches=[i];for(let c2=col+1;c2<6;c2++){const ni=row*6+c2;if(m3Grid[ni]===s)matches.push(ni);else break;}for(let c2=col-1;c2>=0;c2--){const ni=row*6+c2;if(m3Grid[ni]===s)matches.push(ni);else break;}for(let r2=row+1;r2<6;r2++){const ni=r2*6+col;if(m3Grid[ni]===s)matches.push(ni);else break;}for(let r2=row-1;r2>=0;r2--){const ni=r2*6+col;if(m3Grid[ni]===s)matches.push(ni);else break;}if(matches.length>=3){m3Score+=matches.length;document.getElementById("m3-score").textContent=m3Score;matches.forEach(mi=>{m3Grid[mi]=["♥","♛","✠","❖","✧","⚜"][Math.floor(Math.random()*6)];});renderM3();}});grid.appendChild(c);});};
  // Duelo de Toques
  let tdYou=0,tdCpu=0,tdTime=60,tdInterval=null;
  window.initTapDuel=function(){tdYou=0;tdCpu=0;tdTime=60;document.getElementById("td-you").textContent="0";document.getElementById("td-cpu").textContent="0";document.getElementById("td-time").textContent="60";if(tdInterval)clearInterval(tdInterval);const area=document.getElementById("td-area");area.className="reaction-area ready";area.textContent="¡CLIC!";area.onclick=()=>{tdYou++;document.getElementById("td-you").textContent=tdYou;};tdInterval=setInterval(()=>{tdTime--;tdCpu+=Math.floor(Math.random()*3);document.getElementById("td-cpu").textContent=tdCpu;document.getElementById("td-time").textContent=tdTime;if(tdTime<=0){clearInterval(tdInterval);area.onclick=null;area.className="reaction-area result";area.textContent=`Tú: ${tdYou} | CPU: ${tdCpu}`;openSacredModal({icon:"⚡",title:"Duelo",text:tdYou>tdCpu?"¡Ganaste!":tdYou<tdCpu?"La CPU ganó.":"Empate.",withHearts:true,actionsHTML:`<button class="btn-crimson" onclick="closeSacredModal();initTapDuel();">Otra</button>`});}},1000);};

  // ================= ATMÓSFERA =================
  const cursorGlow=document.getElementById("cursor-glow");
  document.addEventListener("mousemove",(e)=>{cursorGlow.style.left=`${e.clientX}px`;cursorGlow.style.top=`${e.clientY}px`;});
  const canvas=document.getElementById("atmosphere-canvas");const ctx=canvas.getContext("2d");
  let width=canvas.width=window.innerWidth,height=canvas.height=window.innerHeight;
  window.addEventListener("resize",()=>{width=canvas.width=window.innerWidth;height=canvas.height=window.innerHeight;});
  const petals=Array.from({length:35},()=>({x:Math.random()*width,y:Math.random()*height,size:Math.random()*7+4,speedY:Math.random()*1.1+0.4,speedX:Math.random()*0.7-0.35,angle:Math.random()*Math.PI*2,spin:Math.random()*0.025-0.012,color:Math.random()>0.5?"#750000":"#3b0000"}));
  const embers=Array.from({length:32},()=>({x:Math.random()*width,y:Math.random()*height,radius:Math.random()*2+0.8,speedY:-(Math.random()*0.9+0.3),alpha:Math.random()*0.7+0.2}));
  function animateAtm(){ctx.clearRect(0,0,width,height);petals.forEach((p)=>{p.y+=p.speedY;p.x+=p.speedX+Math.sin(p.angle)*0.3;p.angle+=p.spin;if(p.y>height){p.y=-10;p.x=Math.random()*width;}ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.angle);ctx.fillStyle=p.color;ctx.beginPath();ctx.ellipse(0,0,p.size,p.size*0.55,0,0,Math.PI*2);ctx.fill();ctx.restore();});embers.forEach((em)=>{em.y+=em.speedY;em.x+=Math.sin(em.y*0.02)*0.3;if(em.y<-10){em.y=height+10;em.x=Math.random()*width;}ctx.save();ctx.fillStyle=`rgba(230,0,0,${em.alpha})`;ctx.shadowColor="#e60000";ctx.shadowBlur=8;ctx.beginPath();ctx.arc(em.x,em.y,em.radius,0,Math.PI*2);ctx.fill();ctx.restore();});requestAnimationFrame(animateAtm);}
  animateAtm();

  // ================= INIT =================
  function initAllSections() {
    // Limpieza una sola vez: eliminar todo el contenido predefinido de las secciones de texto
    if (!localStorage.getItem("kd_content_cleaned_v2")) {
      const sectionsToClean = [
        "kd_evidencias_for_kevin", "kd_evidencias_for_dominic",
        "kd_celebraciones",
        "kd_recuerdos_for_kevin", "kd_recuerdos_for_dominic",
        "kd_nunca_olvidar_for_kevin", "kd_nunca_olvidar_for_dominic",
        "kd_logros_for_kevin", "kd_logros_for_dominic",
        "kd_admiro_for_kevin", "kd_admiro_for_dominic",
        "kd_gracias_for_kevin", "kd_gracias_for_dominic",
        "kd_parejas_for_kevin", "kd_parejas_for_dominic",
        "kd_salidas_for_kevin", "kd_salidas_for_dominic",
        "kd_planes_for_kevin", "kd_planes_for_dominic",
        "kd_razones_for_kevin", "kd_razones_for_dominic",
        "kd_recuerdan_for_kevin", "kd_recuerdan_for_dominic"
      ];
      sectionsToClean.forEach((key) => localStorage.removeItem(key));
      localStorage.setItem("kd_content_cleaned_v2", "1");
    }

    renderPeriodicTable(); initLetter(); renderEvidencias(); renderCelebrations();
    renderRazones(); renderNunca(); renderGracias(); renderAdmiro(); renderParejas(); renderLogros();
    renderRecuerdos(); renderSalidas(); renderPlanes(); renderRecuerdan();
    fotosPage=1; renderPhotos(); videosPage=1; renderVideos(); songsPage=1; renderSongs();
    renderSorpresas(); renderChat();
    initMinesweeper(); drawMaze(); initWordSearch(); renderQuizQ();
    initMemory(); initHangman(); initTicTacToe(); initConnect4();
    initSimon(); initAdivina(); initPuzzle();
  }

  const savedUser=sessionStorage.getItem("gothic_user");
  const savedMode=sessionStorage.getItem("gothic_mode")||"editor";
  if (savedUser&&VALID_USERS.includes(savedUser)) unlockApp(savedUser,savedMode);
});