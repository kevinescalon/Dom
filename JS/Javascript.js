document.addEventListener("DOMContentLoaded", () => {
  const loginScreen = document.getElementById("login-screen");
  const mainApp = document.getElementById("main-app");
  const loginForm = document.getElementById("login-form");
  const passwordInput = document.getElementById("password-input");
  const loginError = document.getElementById("login-error");
  const welcomeUser = document.getElementById("welcome-user");
  const logoutBtn = document.getElementById("logout-btn");

  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const navLinksContainer = document.getElementById("nav-links");
  const navButtons = document.querySelectorAll(".nav-btn[data-target]");
  const tabSections = document.querySelectorAll(".tab-section");

  // ================= 1. LOGIN EXCLUSIVO =================
  const VALID_USERS = ["Kevin", "Dominic"];
  const VALID_PASS = "27-1-2026";

  const savedUser = sessionStorage.getItem("gothic_user");
  if (savedUser && VALID_USERS.includes(savedUser)) {
    unlockApp(savedUser);
  }

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const selectedRadio = document.querySelector('input[name="username"]:checked');
    const enteredPass = passwordInput.value.trim();

    if (!selectedRadio) {
      loginError.textContent = "Selecciona si eres Kevin o Dominic.";
      return;
    }

    const user = selectedRadio.value;
    if (VALID_USERS.includes(user) && enteredPass === VALID_PASS) {
      sessionStorage.setItem("gothic_user", user);
      loginError.textContent = "";
      unlockApp(user);
    } else {
      loginError.textContent = "Fecha incorrecta. El sello permanece intacto.";
      passwordInput.value = "";
    }
  });

  function unlockApp(user) {
    welcomeUser.textContent = user;
    loginScreen.classList.add("hidden");
    mainApp.classList.remove("hidden");
    drawConstellationMap();
    drawMaze();
  }

  logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem("gothic_user");
    mainApp.classList.add("hidden");
    loginScreen.classList.remove("hidden");
    passwordInput.value = "";
    navLinksContainer.classList.remove("open");
  });

  // ================= 2. NAVEGACIÓN =================
  mobileMenuBtn.addEventListener("click", () => {
    navLinksContainer.classList.toggle("open");
  });

  document.querySelectorAll(".dropdown-trigger").forEach((trigger) => {
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      trigger.parentElement.classList.toggle("open");
    });
  });

  window.switchTab = function (targetId) {
    navButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.target === targetId);
    });

    tabSections.forEach((sec) => {
      sec.classList.toggle("active", sec.id === targetId);
    });

    navLinksContainer.classList.remove("open");
    document.querySelectorAll(".nav-dropdown").forEach((d) => d.classList.remove("open"));
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (targetId === "constelaciones") drawConstellationMap();
    if (targetId === "laberinto") drawMaze();
  };

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.target);
    });
  });

  // ================= 3. MODAL SAGRADO & LLUVIA DE CORAZONES =================
  const sacredModal = document.getElementById("sacred-modal");
  const modalIcon = document.getElementById("modal-icon");
  const modalTitle = document.getElementById("modal-title");
  const modalBodyText = document.getElementById("modal-body-text");
  const modalActions = document.getElementById("modal-actions");
  const heartsRainContainer = document.getElementById("hearts-rain-container");

  window.spawnHeartsRain = function (count = 65) {
    const heartSymbols = ["♥", "❤", "❥", "❣"];
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const heart = document.createElement("span");
        heart.className = "falling-heart";
        heart.textContent = heartSymbols[Math.floor(Math.random() * heartSymbols.length)];
        heart.style.left = `${Math.random() * 100}vw`;
        heart.style.fontSize = `${Math.random() * 26 + 16}px`;
        const duration = Math.random() * 2.5 + 2.5;
        heart.style.animationDuration = `${duration}s`;
        heart.style.color = Math.random() > 0.3 ? "#e60000" : "#ffffff";

        heartsRainContainer.appendChild(heart);
        setTimeout(() => heart.remove(), duration * 1000);
      }, i * 40);
    }
  };

  window.openSacredModal = function ({ icon, title, text, actionsHTML, withHearts = false }) {
    modalIcon.textContent = icon;
    modalTitle.textContent = title;
    modalBodyText.textContent = text;
    modalActions.innerHTML = actionsHTML;
    sacredModal.classList.remove("hidden");
    if (withHearts) spawnHeartsRain(65);
  };

  window.closeSacredModal = function () {
    sacredModal.classList.add("hidden");
  };

  const LOVE_MESSAGES = [
    "Si algún día dudas de todo, recuerda que mi corazón te pertenece desde el 27 de enero de 2026.",
    "Eres mi lugar seguro, mi calma en medio de cualquier tormenta y mi persona favorita en el mundo.",
    "Te amo hoy, mañana y en cada vida en la que nuestras almas vuelvan a encontrarse.",
    "No importa qué tan difícil sea el día, pensar en ti lo transforma todo en luz.",
    "Eres el mejor capítulo de mi historia y el único lugar al que siempre quiero volver.",
    "Kevin † Dominic: dos almas unidas por un amor que ni el tiempo ni la distancia pueden romper.",
    "Cada latido mío lleva tu nombre grabado en carmesí."
  ];

  window.triggerLoveEmergency = function () {
    const randomMsg = LOVE_MESSAGES[Math.floor(Math.random() * LOVE_MESSAGES.length)];
    openSacredModal({
      icon: "♥",
      title: "Mensaje Amoroso de Emergencia",
      text: `"${randomMsg}"`,
      withHearts: true,
      actionsHTML: `
        <button type="button" class="btn-crimson" onclick="triggerLoveEmergency()">♥ Otro Mensaje y Más Corazones</button>
        <button type="button" class="btn-outline" onclick="closeSacredModal()">Cerrar</button>
      `
    });
  };

  // ================= 4. LIGHTBOX =================
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");

  window.openLightbox = function (frameEl) {
    const img = frameEl.querySelector("img");
    if (img && img.getAttribute("src")) {
      lightboxImg.src = img.src;
      lightbox.classList.remove("hidden");
    }
  };

  window.closeLightbox = function () {
    lightbox.classList.add("hidden");
    lightboxImg.src = "";
  };

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeLightbox();
      closeSacredModal();
    }
  });

  // ================= 5. CONTADOR DE TIEMPO =================
  const startDate = new Date(2026, 0, 27, 0, 0, 0);
  const daysEl = document.getElementById("days");
  const hoursEl = document.getElementById("hours");
  const minutesEl = document.getElementById("minutes");
  const secondsEl = document.getElementById("seconds");
  const totalHoursEl = document.getElementById("total-hours");

  function updateCounter() {
    const now = new Date();
    const diff = now - startDate;
    if (diff >= 0) {
      const totalSeconds = Math.floor(diff / 1000);
      const totalMinutes = Math.floor(totalSeconds / 60);
      const totalHours = Math.floor(totalMinutes / 60);
      const days = Math.floor(totalHours / 24);

      daysEl.textContent = days;
      hoursEl.textContent = String(totalHours % 24).padStart(2, "0");
      minutesEl.textContent = String(totalMinutes % 60).padStart(2, "0");
      secondsEl.textContent = String(totalSeconds % 60).padStart(2, "0");
      totalHoursEl.textContent = totalHours.toLocaleString("es-ES");
    }
  }
  updateCounter();
  setInterval(updateCounter, 1000);

  // ================= 6. AUTOGUARDADO DE CARTA =================
  const letterContent = document.getElementById("letter-content");
  const saveStatus = document.getElementById("save-status");
  const savedLetter = localStorage.getItem("gothic_love_letter");
  if (savedLetter) letterContent.innerHTML = savedLetter;

  letterContent.addEventListener("input", () => {
    localStorage.setItem("gothic_love_letter", letterContent.innerHTML);
    saveStatus.textContent = "Tinta guardada en el santuario...";
    setTimeout(() => (saveStatus.textContent = ""), 2000);
  });

  // ================= 7. TABLA PERIÓDICA DEL AMOR =================
  const LOVE_ELEMENTS = [
    { num: 1, sym: "Kd", mass: "27.01", name: "Kevin & Dominic", desc: "El enlace atómico primordial creado el 27 de enero de 2026. Indestructible ante cualquier fuerza externa." },
    { num: 2, sym: "Am", mass: "∞", name: "Amor Eterno", desc: "La energía fundamental que mantiene unidas nuestras almas en cada latido." },
    { num: 3, sym: "Le", mass: "100%", name: "Lealtad", desc: "Elemento noble que jamás se oxida ni se rompe, pase lo que pase." },
    { num: 4, sym: "Co", mass: "24/7", name: "Complicidad", desc: "Reacción instantánea cuando nos miramos y entendemos todo sin decir una palabra." },
    { num: 5, sym: "Pa", mass: "99.9", name: "Pasión", desc: "Fuego carmesí que enciende cada abrazo, cada beso y cada encuentro." },
    { num: 6, sym: "Cn", mass: "10.0", name: "Confianza", desc: "El escudo protector que nos permite ser totalmente transparentes el uno con el otro." },
    { num: 7, sym: "Te", mass: "365", name: "Ternura", desc: "La suavidad con la que cuidamos el corazón del otro en los días difíciles." },
    { num: 8, sym: "Ri", mass: "88.4", name: "Risas", desc: "Partículas de alegría pura que aparecen cada vez que estamos juntos." },
    { num: 9, sym: "Ab", mass: "77.2", name: "Abrazos", desc: "Refugio térmico inmediato capaz de curar cualquier cansancio del mundo." },
    { num: 10, sym: "Be", mass: "52.0", name: "Besos", desc: "Catalizador magnético que detiene el tiempo en segundos." },
    { num: 11, sym: "Dv", mass: "2026", name: "Devoción", desc: "Compromiso sagrado de elegirnos todos los días de nuestra vida." },
    { num: 12, sym: "Fu", mass: "∞+", name: "Futuro", desc: "Todos los sueños, viajes y metas que aún nos esperan por construir juntos." }
  ];

  const periodicGrid = document.getElementById("periodic-grid");
  LOVE_ELEMENTS.forEach((el, idx) => {
    const cell = document.createElement("div");
    cell.className = "pt-cell" + (idx === 0 ? " active-element" : "");
    cell.innerHTML = `
      <div class="pt-num"><span>${el.num}</span><span>${el.mass}</span></div>
      <div class="pt-sym">${el.sym}</div>
      <div class="pt-name">${el.name}</div>
    `;
    cell.addEventListener("click", () => {
      document.querySelectorAll(".pt-cell").forEach((c) => c.classList.remove("active-element"));
      cell.classList.add("active-element");
      document.getElementById("pt-selected-symbol").textContent = el.sym;
      document.getElementById("pt-selected-name").textContent = `${el.name} (N.º Atómico ${el.num})`;
      document.getElementById("pt-selected-desc").textContent = el.desc;
    });
    periodicGrid.appendChild(cell);
  });

  // ================= 8. EXPEDIENTE SECRETO (DETECTIVE) =================
  const defaultEvidencias = [
    "PRUEBA #01: Nadie más logra hacernos reír con tanta naturalidad incluso en los momentos más serios.",
    "PRUEBA #02: Nos apoyamos mutuamente en cada proyecto, meta y sueño sin dudarlo ni un segundo.",
    "PRUEBA #03: La química entre Kevin y Dominic supera cualquier estadística registrada desde el 27 de enero de 2026.",
    "PRUEBA #04: Sabemos escucharnos, pedir perdón cuando hace falta y cuidar lo nuestro como un tesoro sagrado."
  ];

  let evidenciasData = JSON.parse(localStorage.getItem("kd_evidencias")) || defaultEvidencias;
  const dossierList = document.getElementById("dossier-evidence-list");

  function renderEvidencias() {
    dossierList.innerHTML = "";
    evidenciasData.forEach((ev, idx) => {
      const card = document.createElement("div");
      card.className = "evidence-card";
      card.innerHTML = `
        <span class="evidence-tag">EVIDENCIA CLASIFICADA #0${idx + 1}</span>
        <p class="card-desc">${ev}</p>
      `;
      dossierList.appendChild(card);
    });
  }

  document.getElementById("form-evidencia").addEventListener("submit", (e) => {
    e.preventDefault();
    const val = document.getElementById("evidencia-texto").value.trim();
    if (!val) return;
    evidenciasData.push(val);
    localStorage.setItem("kd_evidencias", JSON.stringify(evidenciasData));
    renderEvidencias();
    e.target.reset();
  });
  renderEvidencias();

  // ================= 9. MAPA DE CONSTELACIONES (27 ENE -> HOY) =================
  const STAR_NODES = [
    { x: 0.08, y: 0.72, date: "27 de Enero, 2026", title: "Estrella Alfa: El Comienzo", desc: "El nacimiento oficial de nuestra historia. El punto de partida de nuestra constelación eterna." },
    { x: 0.22, y: 0.45, date: "14 de Febrero, 2026", title: "Estrella Beta: Primer San Valentín", desc: "Celebrando nuestro amor recién nacido con la certeza de que era el primero de muchos." },
    { x: 0.36, y: 0.62, date: "23 de Marzo, 2026", title: "Estrella Gamma: Cumpleaños de Kevin", desc: "Celebrando la vida del rey de este santuario y sumando recuerdos inolvidables." },
    { x: 0.52, y: 0.30, date: "Mayo — Junio, 2026", title: "Estrella Delta: Complicidad Profunda", desc: "Meses de confianza absoluta, conversaciones eternas y apoyo incondicional." },
    { x: 0.68, y: 0.52, date: "21 de Julio, 2026", title: "Estrella Épsilon: Cumpleaños de Dominic", desc: "Honrando el día en que nació la persona que ilumina todo este universo." },
    { x: 0.82, y: 0.28, date: "Octubre, 2026", title: "Estrella Zeta: Noches de Halloween", desc: "Viviendo nuestra estética oscura y romántica juntos bajo las estrellas de octubre." },
    { x: 0.93, y: 0.42, date: "Noviembre, 2026 (Hoy)", title: "Estrella Omega: Nuestro Presente", desc: "Casi 10 meses de amor inquebrantable, y nuestra constelación sigue expandiéndose hacia el infinito." }
  ];

  function drawConstellationMap() {
    const cCanvas = document.getElementById("constellation-canvas");
    if (!cCanvas) return;
    const cCtx = cCanvas.getContext("2d");
    const w = cCanvas.width;
    const h = cCanvas.height;

    cCtx.clearRect(0, 0, w, h);

    // Estrellas de fondo
    for (let i = 0; i < 95; i++) {
      const sx = (i * 97) % w;
      const sy = (i * 53) % h;
      cCtx.fillStyle = i % 5 === 0 ? "rgba(230, 0, 0, 0.55)" : "rgba(255, 255, 255, 0.3)";
      cCtx.beginPath();
      cCtx.arc(sx, sy, (i % 2) + 0.8, 0, Math.PI * 2);
      cCtx.fill();
    }

    // Líneas conectando las estrellas de la relación
    cCtx.strokeStyle = "#b80000";
    cCtx.lineWidth = 2;
    cCtx.shadowColor = "#e60000";
    cCtx.shadowBlur = 12;
    cCtx.beginPath();
    STAR_NODES.forEach((node, i) => {
      const px = node.x * w;
      const py = node.y * h;
      if (i === 0) cCtx.moveTo(px, py);
      else cCtx.lineTo(px, py);
    });
    cCtx.stroke();

    // Dibujar nodos estelares principales
    STAR_NODES.forEach((node, idx) => {
      const px = node.x * w;
      const py = node.y * h;

      cCtx.save();
      cCtx.fillStyle = idx === STAR_NODES.length - 1 ? "#e60000" : "#ffffff";
      cCtx.shadowColor = "#e60000";
      cCtx.shadowBlur = 18;
      cCtx.beginPath();
      cCtx.arc(px, py, 7, 0, Math.PI * 2);
      cCtx.fill();

      cCtx.font = "13px Cinzel, serif";
      cCtx.fillStyle = "#d4d4d4";
      cCtx.textAlign = "center";
      cCtx.fillText(node.date, px, py + 24);
      cCtx.restore();
    });
  }

  const cCanvasEl = document.getElementById("constellation-canvas");
  cCanvasEl.addEventListener("click", (e) => {
    const rect = cCanvasEl.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * cCanvasEl.width;
    const clickY = ((e.clientY - rect.top) / rect.height) * cCanvasEl.height;

    STAR_NODES.forEach((node) => {
      const dist = Math.hypot(clickX - node.x * cCanvasEl.width, clickY - node.y * cCanvasEl.height);
      if (dist < 32) {
        document.getElementById("star-date").textContent = node.date;
        document.getElementById("star-title").textContent = node.title;
        document.getElementById("star-desc").textContent = node.desc;
      }
    });
  });

  // ================= 10. CELEBRACIONES IMPORTANTES =================
  const CELEBRATIONS = [
    { icon: "♛", title: "Nuestro Aniversario", dateText: "27 de Enero", month: 0, day: 27, desc: "El día más sagrado de nuestro calendario: el inicio de Kevin & Dominic." },
    { icon: "🌻", title: "Día de las Flores Amarillas", dateText: "21 de Marzo / 21 de Septiembre", month: 2, day: 21, desc: "Para recordarte que nunca te faltarán flores ni detalles que iluminen tu sonrisa." },
    { icon: "♚", title: "Cumpleaños de Kevin", dateText: "23 de Marzo", month: 2, day: 23, desc: "El día en que nació el alma que da fuerza y hogar a este santuario." },
    { icon: "♛", title: "Cumpleaños de Dominic", dateText: "21 de Julio", month: 6, day: 21, desc: "La fecha en que llegó al mundo mi persona favorita en todo el universo." },
    { icon: "♥", title: "Día del Novio", dateText: "3 de Octubre", month: 9, day: 3, desc: "Un día dedicado a celebrar tu compañía, tu cariño y todo lo que eres para mí." },
    { icon: "🎃", title: "Halloween", dateText: "31 de Octubre", month: 9, day: 31, desc: "Nuestra noche favorita entre sombras, misterio, dulces y estética oscura." },
    { icon: "🎄", title: "Navidad Juntos", dateText: "25 de Diciembre", month: 11, day: 25, desc: "El mejor regalo bajo cualquier árbol siempre será tenerte a mi lado." }
  ];

  function renderCelebrations() {
    const grid = document.getElementById("celebraciones-grid");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    grid.innerHTML = "";
    CELEBRATIONS.forEach((cel) => {
      let nextDate = new Date(today.getFullYear(), cel.month, cel.day);
      if (nextDate < today) nextDate.setFullYear(today.getFullYear() + 1);
      const diffDays = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));
      const countdownMsg = diffDays === 0 ? "¡ES HOY! ♥" : `Faltan ${diffDays} días`;

      const card = document.createElement("div");
      card.className = "cathedral-frame celebration-card";
      card.innerHTML = `
        <div>
          <div class="celebration-icon">${cel.icon}</div>
          <span class="date-tag">${cel.dateText}</span>
          <h3 class="card-title" style="margin-top: 0.9rem;">${cel.title}</h3>
          <p class="card-desc">${cel.desc}</p>
        </div>
        <div class="celebration-countdown">${countdownMsg}</div>
      `;
      grid.appendChild(card);
    });
  }
  renderCelebrations();

  // ================= 11. COSAS QUE ADMIRO, AGRADECIMIENTOS, PAREJAS, NUNCA OLVIDAR, LOGROS =================
  function setupSimpleList({ storageKey, defaultItems, formId, inputId, gridId, type }) {
    let data = JSON.parse(localStorage.getItem(storageKey)) || defaultItems;
    const grid = document.getElementById(gridId);

    function render() {
      grid.innerHTML = "";
      data.forEach((item, idx) => {
        const card = document.createElement("div");
        if (type === "numbered") {
          card.className = "cathedral-frame reason-card";
          card.innerHTML = `<div class="reason-number">${idx + 1}</div><p class="reason-quote">"${item}"</p>`;
        } else {
          card.className = "cathedral-frame curiosity-card";
          card.innerHTML = `<span class="curiosity-badge">Gratitud #${idx + 1}</span><p class="card-desc">${item}</p>`;
        }
        grid.appendChild(card);
      });
    }

    document.getElementById(formId).addEventListener("submit", (e) => {
      e.preventDefault();
      const val = document.getElementById(inputId).value.trim();
      if (!val) return;
      data.push(val);
      localStorage.setItem(storageKey, JSON.stringify(data));
      render();
      e.target.reset();
    });

    render();
  }

  setupSimpleList({
    storageKey: "kd_razones",
    defaultItems: [
      "Por la forma en que tu mirada ilumina hasta mis días más oscuros.",
      "Porque contigo puedo ser completamente yo sin miedo ni máscaras.",
      "Por tu risa, que es mi sonido favorito en todo el universo.",
      "Por cómo me escuchas, me entiendes y me haces sentir en casa."
    ],
    formId: "form-razon",
    inputId: "razon-texto",
    gridId: "razones-grid",
    type: "numbered"
  });

  setupSimpleList({
    storageKey: "kd_nunca_olvidar",
    defaultItems: [
      "La emoción exacta de nuestro comienzo el 27 de enero de 2026.",
      "La primera vez que nos dijimos 'te amo' sintiéndolo con toda el alma.",
      "Nuestras llamadas y mensajes hasta altas horas de la madrugada sin querer despedirnos."
    ],
    formId: "form-nunca",
    inputId: "nunca-texto",
    gridId: "nunca-grid",
    type: "numbered"
  });

  setupSimpleList({
    storageKey: "kd_gracias",
    defaultItems: [
      "Gracias por escucharme con paciencia incluso cuando tengo mil cosas en la cabeza.",
      "Gracias por hacerme sentir amado, valorado y elegido todos los días.",
      "Gracias por cada detalle inesperado que transforma un día normal en uno inolvidable."
    ],
    formId: "form-gracias",
    inputId: "gracias-texto",
    gridId: "gracias-grid",
    type: "badge"
  });

  // Cosas que admiro de ti
  let admiroData = JSON.parse(localStorage.getItem("kd_admiro")) || [
    { titulo: "Tu Fuerza Interior", detalle: "La manera en que enfrentas los retos sin rendirte jamás." },
    { titulo: "Tu Corazón Noble", detalle: "Cómo te preocupas genuinamente por las personas que amas." },
    { titulo: "Tu Autenticidad", detalle: "No intentas encajar en moldes; brillas con tu propia esencia." }
  ];
  const admiroGrid = document.getElementById("admiro-grid");
  function renderAdmiro() {
    admiroGrid.innerHTML = "";
    admiroData.forEach((item, i) => {
      const card = document.createElement("div");
      card.className = "cathedral-frame reason-card";
      card.innerHTML = `
        <div class="reason-number">♛</div>
        <h3 class="card-title">${item.titulo}</h3>
        <p class="card-desc">${item.detalle}</p>
      `;
      admiroGrid.appendChild(card);
    });
  }
  document.getElementById("form-admiro").addEventListener("submit", (e) => {
    e.preventDefault();
    admiroData.push({
      titulo: document.getElementById("admiro-titulo").value.trim(),
      detalle: document.getElementById("admiro-detalle").value.trim()
    });
    localStorage.setItem("kd_admiro", JSON.stringify(admiroData));
    renderAdmiro();
    e.target.reset();
  });
  renderAdmiro();

  // Parejas a las que nos parecemos
  let parejasData = JSON.parse(localStorage.getItem("kd_parejas")) || [
    { nombres: "Morticia & Gómez Addams", origen: "La Familia Addams", motivo: "Por esa devoción absoluta, elegante, oscura y apasionada donde el otro siempre es el centro del universo." },
    { nombres: "Jack & Sally", origen: "El Extraño Mundo de Jack", motivo: "Dos almas destinadas a encontrarse en medio de la oscuridad y encajar a la perfección." }
  ];
  const parejasGrid = document.getElementById("parejas-grid");
  function renderParejas() {
    parejasGrid.innerHTML = "";
    parejasData.forEach((p) => {
      const card = document.createElement("div");
      card.className = "cathedral-frame outing-card";
      card.innerHTML = `
        <div class="outing-header"><span class="date-tag">${p.origen}</span><span class="outing-sigil">❧</span></div>
        <h3 class="card-title">${p.nombres}</h3>
        <p class="card-desc">${p.motivo}</p>
      `;
      parejasGrid.appendChild(card);
    });
  }
  document.getElementById("form-pareja").addEventListener("submit", (e) => {
    e.preventDefault();
    parejasData.unshift({
      nombres: document.getElementById("pareja-nombres").value.trim(),
      origen: document.getElementById("pareja-origen").value.trim(),
      motivo: document.getElementById("pareja-motivo").value.trim()
    });
    localStorage.setItem("kd_parejas", JSON.stringify(parejasData));
    renderParejas();
    e.target.reset();
  });
  renderParejas();

  // Nuestros Logros Juntos
  let logrosData = JSON.parse(localStorage.getItem("kd_logros")) || [
    { titulo: "Construir Nuestro Propio Santuario", fecha: "2026", desc: "Crear un espacio único solo para nosotros dos, lleno de recuerdos y detalles." },
    { titulo: "Superar Cada Día Malo Juntos", fecha: "Siempre", desc: "Demostrar que juntos somos más fuertes que cualquier obstáculo o distancia." }
  ];
  const logrosGrid = document.getElementById("logros-grid");
  function renderLogros() {
    logrosGrid.innerHTML = "";
    logrosData.forEach((l) => {
      const card = document.createElement("div");
      card.className = "cathedral-frame outing-card";
      card.innerHTML = `
        <div class="outing-header"><span class="date-tag">${l.fecha}</span><span class="outing-sigil">🏆</span></div>
        <h3 class="card-title">${l.titulo}</h3>
        <p class="card-desc">${l.desc}</p>
      `;
      logrosGrid.appendChild(card);
    });
  }
  document.getElementById("form-logro").addEventListener("submit", (e) => {
    e.preventDefault();
    logrosData.unshift({
      titulo: document.getElementById("logro-titulo").value.trim(),
      fecha: document.getElementById("logro-fecha").value.trim(),
      desc: document.getElementById("logro-desc").value.trim()
    });
    localStorage.setItem("kd_logros", JSON.stringify(logrosData));
    renderLogros();
    e.target.reset();
  });
  renderLogros();

  // Recuerdos Especiales (Desplegables)
  let recuerdosData = JSON.parse(localStorage.getItem("kd_recuerdos")) || [
    {
      titulo: "El día en que comenzó nuestra eternidad",
      fecha: "27 de Enero, 2026",
      texto: "El instante exacto en que nuestras almas decidieron caminar juntas. Desde ese día, cada hora tiene un significado distinto y cada sombra encontró su luz."
    }
  ];
  const recuerdosContainer = document.getElementById("recuerdos-accordion");
  function renderRecuerdos() {
    recuerdosContainer.innerHTML = "";
    recuerdosData.forEach((item, index) => {
      const div = document.createElement("div");
      div.className = "accordion-item" + (index === 0 ? " open" : "");
      div.innerHTML = `
        <button type="button" class="accordion-header">
          <div class="accordion-title-wrap">
            <span class="accordion-date">${item.fecha}</span>
            <span class="accordion-title">${item.titulo}</span>
          </div>
          <span class="accordion-icon">▼</span>
        </button>
        <div class="accordion-body">${item.texto}</div>
      `;
      div.querySelector(".accordion-header").addEventListener("click", () => div.classList.toggle("open"));
      recuerdosContainer.appendChild(div);
    });
  }
  document.getElementById("form-recuerdo").addEventListener("submit", (e) => {
    e.preventDefault();
    recuerdosData.unshift({
      titulo: document.getElementById("recuerdo-titulo").value.trim(),
      fecha: document.getElementById("recuerdo-fecha").value.trim(),
      texto: document.getElementById("recuerdo-texto").value.trim()
    });
    localStorage.setItem("kd_recuerdos", JSON.stringify(recuerdosData));
    renderRecuerdos();
    e.target.reset();
  });
  renderRecuerdos();

  // Salidas
  let salidasData = JSON.parse(localStorage.getItem("kd_salidas")) || [
    { lugar: "Nuestra Primera Cita Especial", fecha: "2026", desc: "Nervios, sonrisas imposibles de ocultar y la certeza de que no quería estar en ningún otro lugar." }
  ];
  const salidasGrid = document.getElementById("salidas-grid");
  function renderSalidas() {
    salidasGrid.innerHTML = "";
    salidasData.forEach((item) => {
      const card = document.createElement("div");
      card.className = "cathedral-frame outing-card";
      card.innerHTML = `
        <div class="outing-header"><span class="date-tag">${item.fecha}</span><span class="outing-sigil">🕯</span></div>
        <h3 class="card-title">${item.lugar}</h3>
        <p class="card-desc">${item.desc}</p>
      `;
      salidasGrid.appendChild(card);
    });
  }
  document.getElementById("form-salida").addEventListener("submit", (e) => {
    e.preventDefault();
    salidasData.unshift({
      lugar: document.getElementById("salida-lugar").value.trim(),
      fecha: document.getElementById("salida-fecha").value.trim(),
      desc: document.getElementById("salida-desc").value.trim()
    });
    localStorage.setItem("kd_salidas", JSON.stringify(salidasData));
    renderSalidas();
    e.target.reset();
  });
  renderSalidas();

  // Planes a futuro
  let planesData = JSON.parse(localStorage.getItem("kd_planes")) || [
    { texto: "Hacer un viaje juntos a un lugar inolvidable", done: false },
    { texto: "Celebrar nuestro primer aniversario el 27 de enero", done: false },
    { texto: "Tener una maratón nocturna de películas y comida favorita", done: false }
  ];
  const planesList = document.getElementById("planes-list");
  function renderPlanes() {
    planesList.innerHTML = "";
    planesData.forEach((plan, idx) => {
      const card = document.createElement("div");
      card.className = "plan-card" + (plan.done ? " completed" : "");
      card.innerHTML = `<div class="plan-check">✓</div><span class="plan-text">${plan.texto}</span>`;
      card.addEventListener("click", () => {
        planesData[idx].done = !planesData[idx].done;
        localStorage.setItem("kd_planes", JSON.stringify(planesData));
        renderPlanes();
      });
      planesList.appendChild(card);
    });
  }
  document.getElementById("form-plan").addEventListener("submit", (e) => {
    e.preventDefault();
    planesData.push({ texto: document.getElementById("plan-texto").value.trim(), done: false });
    localStorage.setItem("kd_planes", JSON.stringify(planesData));
    renderPlanes();
    e.target.reset();
  });
  renderPlanes();

  // Cosas que me recuerdan a ti
  let recuerdanData = JSON.parse(localStorage.getItem("kd_recuerdan")) || [
    { cosa: "La estética oscura y carmesí", categoria: "Esencia", motivo: "Porque tiene esa belleza profunda y magnética que siempre asocio contigo." },
    { cosa: "El número 27", categoria: "Fecha Sagrada", motivo: "Desde enero de 2026 quedó grabado para siempre en mi corazón." }
  ];
  const recuerdanGrid = document.getElementById("recuerdan-grid");
  function renderRecuerdan() {
    recuerdanGrid.innerHTML = "";
    recuerdanData.forEach((item) => {
      const card = document.createElement("div");
      card.className = "cathedral-frame curiosity-card";
      card.innerHTML = `
        <span class="curiosity-badge">${item.categoria}</span>
        <h3 class="card-title">${item.cosa}</h3>
        <p class="card-desc">${item.motivo}</p>
      `;
      recuerdanGrid.appendChild(card);
    });
  }
  document.getElementById("form-recuerda").addEventListener("submit", (e) => {
    e.preventDefault();
    recuerdanData.unshift({
      cosa: document.getElementById("recuerda-cosa").value.trim(),
      categoria: document.getElementById("recuerda-categoria").value.trim(),
      motivo: document.getElementById("recuerda-motivo").value.trim()
    });
    localStorage.setItem("kd_recuerdan", JSON.stringify(recuerdanData));
    renderRecuerdan();
    e.target.reset();
  });
  renderRecuerdan();

  // ================= 12. JUEGO: BUSCAMINAS ROMÁNTICO =================
  const MS_SIZE = 8;
  const MS_BOMBS = 10;
  let msBoard = [];
  const ROMANTIC_DARES = [
    "¡BOOM DE AMOR! Me debes un beso largo y apasionado.",
    "¡EXPLOSIÓN CARMESÍ! Me debes un abrazo fuerte de al menos 30 segundos.",
    "¡BOMBA DETONADA! Me debes una cita sorpresa planeada por ti.",
    "¡TRAMPA ROMÁNTICA! Me debes 3 razones por las que me amas ahora mismo.",
    "¡CORAZÓN EXPLOSIVO! Me debes un masaje relajante la próxima vez que nos veamos.",
    "¡RETO ACTIVADO! Me debes mi dulce o comida favorita en nuestra próxima salida.",
    "¡DESTELLO DE AMOR! Me debes un beso en la frente y otro en los labios."
  ];

  window.initMinesweeper = function () {
    const grid = document.getElementById("minesweeper-grid");
    grid.innerHTML = "";
    msBoard = Array.from({ length: MS_SIZE }, () =>
      Array.from({ length: MS_SIZE }, () => ({ bomb: false, revealed: false, count: 0 }))
    );

    let placed = 0;
    while (placed < MS_BOMBS) {
      const r = Math.floor(Math.random() * MS_SIZE);
      const c = Math.floor(Math.random() * MS_SIZE);
      if (!msBoard[r][c].bomb) {
        msBoard[r][c].bomb = true;
        placed++;
      }
    }

    for (let r = 0; r < MS_SIZE; r++) {
      for (let c = 0; c < MS_SIZE; c++) {
        if (msBoard[r][c].bomb) continue;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < MS_SIZE && nc >= 0 && nc < MS_SIZE && msBoard[nr][nc].bomb) count++;
          }
        }
        msBoard[r][c].count = count;
      }
    }

    for (let r = 0; r < MS_SIZE; r++) {
      for (let c = 0; c < MS_SIZE; c++) {
        const cell = document.createElement("div");
        cell.className = "ms-cell";
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.addEventListener("click", () => revealMsCell(r, c));
        grid.appendChild(cell);
      }
    }
  };

  function revealMsCell(r, c) {
    if (r < 0 || r >= MS_SIZE || c < 0 || c >= MS_SIZE) return;
    const data = msBoard[r][c];
    if (data.revealed) return;
    data.revealed = true;

    const cellEl = document.querySelector(`.ms-cell[data-r="${r}"][data-c="${c}"]`);
    cellEl.classList.add("revealed");

    if (data.bomb) {
      cellEl.classList.add("bomb-exploded");
      cellEl.textContent = "💣";
      const dare = ROMANTIC_DARES[Math.floor(Math.random() * ROMANTIC_DARES.length)];
      openSacredModal({
        icon: "💣♥",
        title: "¡Detonaste una Bomba de Amor!",
        text: dare,
        withHearts: true,
        actionsHTML: `<button type="button" class="btn-crimson" onclick="closeSacredModal()">Aceptar Reto ♥</button>`
      });
      return;
    }

    if (data.count > 0) {
      cellEl.textContent = data.count;
      cellEl.style.color = data.count === 1 ? "#ffffff" : "#e60000";
    } else {
      cellEl.textContent = "·";
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          revealMsCell(r + dr, c + dc);
        }
      }
    }
  }
  initMinesweeper();

  // ================= 13. JUEGO: LABERINTO DEL AMOR =================
  const MAZE_GRID = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,1,0,0,0,0,0,1,0,0,0,1],
    [1,0,1,0,1,0,1,1,1,0,1,0,1,0,1],
    [1,0,1,0,0,0,1,0,0,0,0,0,1,0,1],
    [1,0,1,1,1,1,1,0,1,1,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,1,0,0,0,0,0,1],
    [1,1,1,1,1,0,1,1,1,0,1,1,1,0,1],
    [1,0,0,0,1,0,0,0,0,0,1,0,0,0,1],
    [1,0,1,0,1,1,1,1,1,0,1,0,1,1,1],
    [1,0,1,0,0,0,0,0,1,0,0,0,0,0,1],
    [1,0,1,1,1,1,1,0,1,1,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,1,0,1],
    [1,0,1,1,1,0,1,1,1,1,1,0,1,0,1],
    [1,0,0,0,1,0,0,0,0,0,0,0,0,2,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ];
  let playerPos = { x: 1, y: 1 };

  window.initMaze = function () {
    playerPos = { x: 1, y: 1 };
    drawMaze();
  };

  function drawMaze() {
    const mCanvas = document.getElementById("maze-canvas");
    if (!mCanvas) return;
    const mCtx = mCanvas.getContext("2d");
    const cellSize = mCanvas.width / MAZE_GRID.length;

    mCtx.clearRect(0, 0, mCanvas.width, mCanvas.height);

    for (let r = 0; r < MAZE_GRID.length; r++) {
      for (let c = 0; c < MAZE_GRID[r].length; c++) {
        const val = MAZE_GRID[r][c];
        if (val === 1) {
          mCtx.fillStyle = "#3b0000";
          mCtx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
          mCtx.strokeStyle = "#750000";
          mCtx.strokeRect(c * cellSize, r * cellSize, cellSize, cellSize);
        } else {
          mCtx.fillStyle = "#060606";
          mCtx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
        }

        if (val === 2) {
          mCtx.font = `${cellSize * 0.72}px serif`;
          mCtx.textAlign = "center";
          mCtx.textBaseline = "middle";
          mCtx.fillStyle = "#e60000";
          mCtx.fillText("♛", c * cellSize + cellSize / 2, r * cellSize + cellSize / 2);
        }
      }
    }

    // Jugador (Kevin)
    mCtx.font = `${cellSize * 0.75}px serif`;
    mCtx.textAlign = "center";
    mCtx.textBaseline = "middle";
    mCtx.fillStyle = "#ffffff";
    mCtx.fillText("♚", playerPos.x * cellSize + cellSize / 2, playerPos.y * cellSize + cellSize / 2);
  }

  window.moveMazePlayer = function (dx, dy) {
    const nx = playerPos.x + dx;
    const ny = playerPos.y + dy;
    if (MAZE_GRID[ny] && MAZE_GRID[ny][nx] !== undefined && MAZE_GRID[ny][nx] !== 1) {
      playerPos = { x: nx, y: ny };
      drawMaze();

      if (MAZE_GRID[ny][nx] === 2) {
        openSacredModal({
          icon: "♛♥♚",
          title: "¡Ganaste!",
          text: "No importa cuántos muros o caminos oscuros existan, Kevin y Dominic siempre encuentran la forma de estar juntos. ♥",
          withHearts: true,
          actionsHTML: `<button type="button" class="btn-crimson" onclick="closeSacredModal(); initMaze();">Jugar de Nuevo</button>`
        });
      }
    }
  };

  document.addEventListener("keydown", (e) => {
    const labSection = document.getElementById("laberinto");
    if (!labSection || !labSection.classList.contains("active")) return;
    if (e.key === "ArrowUp") { e.preventDefault(); moveMazePlayer(0, -1); }
    if (e.key === "ArrowDown") { e.preventDefault(); moveMazePlayer(0, 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); moveMazePlayer(-1, 0); }
    if (e.key === "ArrowRight") { e.preventDefault(); moveMazePlayer(1, 0); }
  });

  // ================= 14. JUEGO: SOPA DE LETRAS =================
  const WS_WORDS = ["KEVIN", "DOMINIC", "27ENERO", "ETERNIDAD", "CARMESI", "ALMAS", "SIEMPRE", "AMOR"];
  const WS_SIZE = 12;
  let wsBoard = [];
  let foundWords = new Set();
  let isSelecting = false;
  let selectionStart = null;
  let currentSelection = [];

  window.initWordSearch = function () {
    const gridEl = document.getElementById("wordsearch-grid");
    const listEl = document.getElementById("wordsearch-list");
    const statusEl = document.getElementById("wordsearch-status");

    foundWords.clear();
    statusEl.textContent = "";
    wsBoard = Array.from({ length: WS_SIZE }, () => Array(WS_SIZE).fill(""));

    const directions = [[0, 1], [1, 0], [1, 1]];

    WS_WORDS.forEach((word) => {
      let placed = false;
      let attempts = 0;
      while (!placed && attempts < 200) {
        attempts++;
        const dir = directions[Math.floor(Math.random() * directions.length)];
        const row = Math.floor(Math.random() * WS_SIZE);
        const col = Math.floor(Math.random() * WS_SIZE);
        const endRow = row + dir[0] * (word.length - 1);
        const endCol = col + dir[1] * (word.length - 1);

        if (endRow >= 0 && endRow < WS_SIZE && endCol >= 0 && endCol < WS_SIZE) {
          let canPlace = true;
          for (let i = 0; i < word.length; i++) {
            const cellChar = wsBoard[row + dir[0] * i][col + dir[1] * i];
            if (cellChar !== "" && cellChar !== word[i]) {
              canPlace = false;
              break;
            }
          }
          if (canPlace) {
            for (let i = 0; i < word.length; i++) {
              wsBoard[row + dir[0] * i][col + dir[1] * i] = word[i];
            }
            placed = true;
          }
        }
      }
    });

    const filler = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    for (let r = 0; r < WS_SIZE; r++) {
      for (let c = 0; c < WS_SIZE; c++) {
        if (wsBoard[r][c] === "") wsBoard[r][c] = filler[Math.floor(Math.random() * filler.length)];
      }
    }

    gridEl.innerHTML = "";
    for (let r = 0; r < WS_SIZE; r++) {
      for (let c = 0; c < WS_SIZE; c++) {
        const cell = document.createElement("div");
        cell.className = "ws-cell";
        cell.textContent = wsBoard[r][c];
        cell.dataset.r = r;
        cell.dataset.c = c;

        cell.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          isSelecting = true;
          selectionStart = { r, c };
          updateSelection({ r, c });
        });

        cell.addEventListener("pointerenter", () => {
          if (isSelecting && selectionStart) updateSelection({ r, c });
        });

        gridEl.appendChild(cell);
      }
    }

    listEl.innerHTML = "";
    WS_WORDS.forEach((word) => {
      const li = document.createElement("li");
      li.id = `ws-word-${word}`;
      li.textContent = word;
      listEl.appendChild(li);
    });
  };

  function updateSelection(end) {
    document.querySelectorAll(".ws-cell.selected").forEach((el) => el.classList.remove("selected"));
    currentSelection = [];

    const dr = end.r - selectionStart.r;
    const dc = end.c - selectionStart.c;
    const steps = Math.max(Math.abs(dr), Math.abs(dc));

    if (steps === 0) {
      currentSelection.push(selectionStart);
    } else if (dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc)) {
      const stepR = dr === 0 ? 0 : dr / Math.abs(dr);
      const stepC = dc === 0 ? 0 : dc / Math.abs(dc);
      for (let i = 0; i <= steps; i++) {
        currentSelection.push({ r: selectionStart.r + stepR * i, c: selectionStart.c + stepC * i });
      }
    }

    currentSelection.forEach(({ r, c }) => {
      const el = document.querySelector(`.ws-cell[data-r="${r}"][data-c="${c}"]`);
      if (el) el.classList.add("selected");
    });
  }

  document.addEventListener("pointerup", () => {
    if (!isSelecting) return;
    isSelecting = false;

    const wordForward = currentSelection.map(({ r, c }) => wsBoard[r][c]).join("");
    const wordBackward = wordForward.split("").reverse().join("");
    const matched = WS_WORDS.find((w) => w === wordForward || w === wordBackward);

    if (matched && !foundWords.has(matched)) {
      foundWords.add(matched);
      currentSelection.forEach(({ r, c }) => {
        const el = document.querySelector(`.ws-cell[data-r="${r}"][data-c="${c}"]`);
        if (el) el.classList.add("found");
      });
      const li = document.getElementById(`ws-word-${matched}`);
      if (li) li.classList.add("found-word");

      if (foundWords.size === WS_WORDS.length) {
        document.getElementById("wordsearch-status").textContent = "¡Encontraste todas las palabras de nuestro santuario! ♥";
        spawnHeartsRain(45);
      }
    }

    document.querySelectorAll(".ws-cell.selected").forEach((el) => el.classList.remove("selected"));
    currentSelection = [];
  });
  initWordSearch();

  // ================= 15. JUEGO: QUIZ DE 20 PREGUNTAS =================
  const QUIZ_QUESTIONS = [
    { q: "¿En qué fecha exacta comenzó oficialmente nuestra historia?", opts: ["27 de Enero de 2026", "14 de Febrero de 2026", "27 de Diciembre de 2025", "1 de Enero de 2026"], ans: 0 },
    { q: "¿Quiénes son las únicas dos almas con llave a este Santuario?", opts: ["Kevin y Dominic", "Romeo y Julieta", "Kevin y Alex", "Dominic y Dante"], ans: 0 },
    { q: "¿Cuándo es el cumpleaños de Kevin?", opts: ["21 de Julio", "23 de Marzo", "27 de Enero", "31 de Octubre"], ans: 1 },
    { q: "¿Cuándo es el cumpleaños de Dominic?", opts: ["23 de Marzo", "25 de Diciembre", "21 de Julio", "3 de Octubre"], ans: 2 },
    { q: "¿Cuáles son los colores sagrados de nuestro Santuario?", opts: ["Azul y Plata", "Negro, Rojo Carmesí y Blanco", "Morado y Dorado", "Verde y Negro"], ans: 1 },
    { q: "¿Qué representa el símbolo K † D en nuestro emblema?", opts: ["Nuestras iniciales unidas para siempre", "Un código secreto", "Una fecha antigua", "Una banda"], ans: 0 },
    { q: "¿Qué es lo que más nos gusta hacer cuando estamos juntos?", opts: ["Ignorar el reloj y hablar por horas", "Estar lejos", "No escucharnos", "Estar en silencio"], ans: 0 },
    { q: "¿Qué pasa con el tiempo desde el 27 de enero de 2026?", opts: ["Se detuvo", "Cada segundo suma a nuestra eternidad", "No importa", "Se borra"], ans: 1 },
    { q: "¿Cómo describirías nuestra conexión?", opts: ["Pasajera", "Profunda, leal e inquebrantable", "Común y corriente", "Distante"], ans: 1 },
    { q: "¿Qué ocurre si detonas una bomba en el Buscaminas Romántico?", opts: ["Pierdes la cuenta", "Debes cumplir un reto de amor como un beso o abrazo", "Se cierra la página", "Nada"], ans: 1 },
    { q: "¿Qué lugar ocupa nuestra relación en nuestras vidas?", opts: ["Un rincón secundario", "Un santuario prioritario y protegido", "Algo temporal", "Un pasatiempo"], ans: 1 },
    { q: "¿Qué hacemos cuando uno de los dos tiene un mal día?", opts: ["Nos alejamos", "Nos apoyamos, escuchamos y damos fuerza", "Nos enojamos", "Fingimos"], ans: 1 },
    { q: "¿Cuál es nuestra mejor promesa a futuro?", opts: ["Olvidar el pasado", "Seguir eligiéndonos cada día pase lo que pase", "Separarnos pronto", "No hacer planes"], ans: 1 },
    { q: "¿Qué simbolizan las flores amarillas en nuestro calendario?", opts: ["Que nunca faltarán detalles que iluminen tu sonrisa", "Tristeza", "Despedida", "Otoño"], ans: 0 },
    { q: "¿Qué encontramos en la carta del Santuario?", opts: ["Una lista de compras", "Confesiones escritas con tinta y devoción", "Un manual", "Noticias"], ans: 1 },
    { q: "¿Qué valor es fundamental entre Kevin y Dominic?", opts: ["La desconfianza", "La lealtad y el amor sincero", "El orgullo", "La indiferencia"], ans: 1 },
    { q: "¿Cómo es un abrazo cuando nos vemos?", opts: ["Frío y rápido", "Un refugio donde todo está bien", "Incómodo", "Corto"], ans: 1 },
    { q: "¿Qué palabra define mejor lo que sentimos?", opts: ["Costumbre", "Devoción eterna", "Duda", "Rutina"], ans: 1 },
    { q: "¿Qué simbolizan las rosas y el carmesí en nuestro altar?", opts: ["Pasión, intensidad y amor eterno", "Tristeza", "Frialdad", "Olvido"], ans: 0 },
    { q: "¿Hasta cuándo durará lo nuestro?", opts: ["Un par de meses", "Por toda la eternidad", "Hasta el próximo año", "Solo hoy"], ans: 1 }
  ];

  let quizIndex = 0;
  let correctCount = 0;
  let incorrectCount = 0;

  const quizActiveView = document.getElementById("quiz-active-view");
  const quizResultView = document.getElementById("quiz-result-view");
  const quizProgressText = document.getElementById("quiz-progress-text");
  const quizProgressFill = document.getElementById("quiz-progress-fill");
  const quizQuestionText = document.getElementById("quiz-question-text");
  const quizOptionsEl = document.getElementById("quiz-options");

  function renderQuizQuestion() {
    const current = QUIZ_QUESTIONS[quizIndex];
    quizProgressText.textContent = `Pregunta ${quizIndex + 1} de ${QUIZ_QUESTIONS.length}`;
    quizProgressFill.style.width = `${((quizIndex + 1) / QUIZ_QUESTIONS.length) * 100}%`;
    quizQuestionText.textContent = current.q;

    quizOptionsEl.innerHTML = "";
    const letters = ["A", "B", "C", "D"];

    current.opts.forEach((optText, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quiz-option-btn";
      btn.innerHTML = `<strong>${letters[i]}.</strong> <span>${optText}</span>`;
      btn.addEventListener("click", () => handleQuizAnswer(i, btn));
      quizOptionsEl.appendChild(btn);
    });
  }

  function handleQuizAnswer(selectedIndex, clickedBtn) {
    const current = QUIZ_QUESTIONS[quizIndex];
    const allBtns = quizOptionsEl.querySelectorAll(".quiz-option-btn");
    allBtns.forEach((b) => (b.disabled = true));

    if (selectedIndex === current.ans) {
      correctCount++;
      clickedBtn.classList.add("correct");
    } else {
      incorrectCount++;
      clickedBtn.classList.add("wrong");
      allBtns[current.ans].classList.add("correct");
    }

    setTimeout(() => {
      quizIndex++;
      if (quizIndex < QUIZ_QUESTIONS.length) {
        renderQuizQuestion();
      } else {
        quizActiveView.classList.add("hidden");
        quizResultView.classList.remove("hidden");
        document.getElementById("score-correct").textContent = correctCount;
        document.getElementById("score-incorrect").textContent = incorrectCount;
        document.getElementById("quiz-final-message").textContent =
          correctCount >= 18
            ? "¡Almas gemelas absolutas! Conoces cada latido de nuestra historia."
            : correctCount >= 12
            ? "¡Gran resultado! Nuestro vínculo es fuerte y seguimos escribiendo más recuerdos."
            : "Toca repasar nuestros momentos juntos con una cita especial.";
      }
    }, 850);
  }

  window.restartQuiz = function () {
    quizIndex = 0;
    correctCount = 0;
    incorrectCount = 0;
    quizResultView.classList.add("hidden");
    quizActiveView.classList.remove("hidden");
    renderQuizQuestion();
  };
  renderQuizQuestion();

  // ================= 16. RESPLANDOR DE CURSOR Y ATMÓSFERA =================
  const cursorGlow = document.getElementById("cursor-glow");
  document.addEventListener("mousemove", (e) => {
    cursorGlow.style.left = `${e.clientX}px`;
    cursorGlow.style.top = `${e.clientY}px`;
  });

  const canvas = document.getElementById("atmosphere-canvas");
  const ctx = canvas.getContext("2d");
  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener("resize", () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const petals = Array.from({ length: 30 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    size: Math.random() * 7 + 4,
    speedY: Math.random() * 1.1 + 0.4,
    speedX: Math.random() * 0.7 - 0.35,
    angle: Math.random() * Math.PI * 2,
    spin: Math.random() * 0.025 - 0.012,
    color: Math.random() > 0.5 ? "#750000" : "#3b0000"
  }));

  const embers = Array.from({ length: 28 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: Math.random() * 2 + 0.8,
    speedY: -(Math.random() * 0.9 + 0.3),
    alpha: Math.random() * 0.7 + 0.2
  }));

  function animateAtmosphere() {
    ctx.clearRect(0, 0, width, height);

    petals.forEach((p) => {
      p.y += p.speedY;
      p.x += p.speedX + Math.sin(p.angle) * 0.3;
      p.angle += p.spin;
      if (p.y > height) { p.y = -10; p.x = Math.random() * width; }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    embers.forEach((em) => {
      em.y += em.speedY;
      em.x += Math.sin(em.y * 0.02) * 0.3;
      if (em.y < -10) { em.y = height + 10; em.x = Math.random() * width; }

      ctx.save();
      ctx.fillStyle = `rgba(230, 0, 0, ${em.alpha})`;
      ctx.shadowColor = "#e60000";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(em.x, em.y, em.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    requestAnimationFrame(animateAtmosphere);
  }
  animateAtmosphere();
});