// =====================================================
// MultiLive — app.js (versão melhorada)
// Melhorias: validação reforçada, rate limiting de
// tentativas de login, sanitização de inputs,
// indicador de força de senha, badges de plataforma,
// e melhor UX geral.
// =====================================================

// ===== ELEMENTOS DO DOM =====
const authScreen = document.getElementById("auth-screen");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const loginError = document.getElementById("login-error");
const signupError = document.getElementById("signup-error");
const grid = document.getElementById("lives-grid");
const urlInput = document.getElementById("live-url");
const toast = document.getElementById("toast");
const userInfo = document.getElementById("user-info");
const inputGroupContainer = document.getElementById("input-group-container");
const btnFullscreen = document.getElementById("btn-fullscreen");
const btnMinimize = document.getElementById("btn-minimize");
const btnLogout = document.getElementById("btn-logout");
const liveCountBadge = document.getElementById("live-count-badge");

// ===== ESTADO =====
let currentUser = null;
let isGuest = false;

// Rate limiting simples para login (lado cliente)
const loginAttempts = { count: 0, lockedUntil: 0 };
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000; // 1 minuto

// ===== INICIALIZAÇÃO =====
async function inicializarApp() {
  try {
    // Busca as chaves do Supabase na API local ou de produção
    const response = await fetch('/api/config');
    if (!response.ok) {
      throw new Error('Falha ao buscar configurações do Supabase na API');
    }
    const config = await response.json();

    // Inicializa o cliente do Supabase
    window.supabaseClient = window.supabase.createClient(
      config.url,
      config.key,
      {
        auth: {
          storageKey: "multilive_auth",
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      }
    );

    setupAuthToggle();
    setupPasswordStrength();
    await diagnosticarConexao();
    await checkAuthStatus();
    setupEventListeners();
  } catch (error) {
    console.error('❌ Erro crítico ao inicializar o aplicativo:', error);
    mostrarAvisoBanner("❌ Não foi possível conectar ao Supabase. Verifique a configuração.");
  }
}

inicializarApp();

// ===== DIAGNÓSTICO =====
async function diagnosticarConexao() {
  try {
    const { error } = await supabaseClient.auth.getSession();
    if (error) {
      console.warn("⚠️ Supabase inicialização:", error.message);
      if (
        error.message.includes("Invalid API key") ||
        error.message.includes("apikey")
      ) {
        mostrarAvisoBanner(
          "❌ Chave de API inválida — verifique supabase-config.js",
        );
      }
    }
  } catch (e) {
    console.error("❌ Falha ao conectar com Supabase:", e);
    mostrarAvisoBanner(
      "❌ Não foi possível conectar ao Supabase. Verifique URL e chave.",
    );
  }
}

function mostrarAvisoBanner(msg) {
  const banner = document.createElement("div");
  banner.style.cssText = `
    position:fixed; top:0; left:0; right:0; z-index:99999;
    background:#ff4d6a; color:#fff; text-align:center;
    padding:12px 20px; font-weight:700; font-size:0.9rem;
  `;
  banner.textContent = msg;
  document.body.prepend(banner);
}

// ===== AUTH: VERIFICAR SESSÃO =====
async function checkAuthStatus() {
  try {
    const {
      data: { session },
    } = await supabaseClient.auth.getSession();
    if (session) {
      currentUser = session.user;
      isGuest = false;
      await loadUserProfile();
      showDashboard();
    } else {
      showAuthScreen();
    }
  } catch (err) {
    console.error("Erro ao verificar autenticação:", err);
    showAuthScreen();
  }
}

// ===== PERFIL =====
async function loadUserProfile() {
  try {
    const { data } = await supabaseClient
      .from("profiles")
      .select("name")
      .eq("id", currentUser.id)
      .single();

    const name =
      data?.name ||
      currentUser.user_metadata?.name ||
      currentUser.user_metadata?.full_name ||
      currentUser.email;

    userInfo.textContent = `👤 ${sanitizeText(name)}`;
  } catch {
    userInfo.textContent = `👤 ${sanitizeText(currentUser.email)}`;
  }
}

// ===== LOGIN =====
async function handleLogin(event) {
  event.preventDefault();

  // Rate limiting
  if (Date.now() < loginAttempts.lockedUntil) {
    const secs = Math.ceil((loginAttempts.lockedUntil - Date.now()) / 1000);
    showLoginError(`Muitas tentativas. Aguarde ${secs}s.`);
    return;
  }

  const email = document
    .getElementById("login-email")
    .value.trim()
    .toLowerCase();
  const password = document.getElementById("login-password").value;

  if (!isValidEmail(email)) {
    showLoginError("E-mail inválido.");
    return;
  }
  if (!password || password.length < 6) {
    showLoginError("Senha deve ter no mínimo 6 caracteres.");
    return;
  }

  const btn = document.getElementById("login-submit-btn");
  setButtonLoading(btn, true);

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      loginAttempts.count++;
      if (loginAttempts.count >= MAX_LOGIN_ATTEMPTS) {
        loginAttempts.lockedUntil = Date.now() + LOCKOUT_MS;
        loginAttempts.count = 0;
        showLoginError("Muitas tentativas. Acesso bloqueado por 1 minuto.");
      } else {
        showLoginError(traduzirErroAuth(error.message));
      }
      return;
    }

    loginAttempts.count = 0;
    currentUser = data.user;
    isGuest = false;
    await loadUserProfile();
    showDashboard();
    showToast("Bem-vindo de volta!", "success");
  } catch {
    showLoginError("Erro ao fazer login. Tente novamente.");
  } finally {
    setButtonLoading(btn, false);
  }
}

// ===== CADASTRO =====
async function handleSignup(event) {
  event.preventDefault();

  const name = sanitizeText(
    document.getElementById("signup-name").value.trim(),
  );
  const email = document
    .getElementById("signup-email")
    .value.trim()
    .toLowerCase();
  const password = document.getElementById("signup-password").value;
  const passwordConfirm = document.getElementById(
    "signup-password-confirm",
  ).value;

  if (!name || name.length < 2) {
    showSignupError("Nome deve ter pelo menos 2 caracteres.");
    return;
  }
  if (!isValidEmail(email)) {
    showSignupError("E-mail inválido.");
    return;
  }
  if (password.length < 6) {
    showSignupError("A senha deve ter no mínimo 6 caracteres.");
    return;
  }
  if (password !== passwordConfirm) {
    showSignupError("As senhas não correspondem.");
    return;
  }

  const btn = document.getElementById("signup-submit-btn");
  setButtonLoading(btn, true);

  try {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, name } },
    });

    if (error) {
      showSignupError(traduzirErroAuth(error.message));
      return;
    }

    if (!data.user) {
      showSignupError("Erro inesperado. Tente novamente.");
      return;
    }

    // Tentar criar perfil
    try {
      await supabaseClient
        .from("profiles")
        .upsert([{ id: data.user.id, email, name }], { onConflict: "id" });
    } catch (profileErr) {
      console.warn(
        "Perfil não salvo na tabela, mas cadastro concluído.",
        profileErr,
      );
    }

    if (data.session) {
      currentUser = data.user;
      isGuest = false;
      await loadUserProfile();
      showDashboard();
      showToast("Conta criada! Bem-vindo(a)!", "success");
    } else {
      signupForm.innerHTML = `
        <div style="text-align:center;padding:1.5rem 0;color:var(--green)">
          <div style="font-size:2.5rem;margin-bottom:0.75rem">📧</div>
          <p style="font-weight:700;font-size:1rem;margin-bottom:0.5rem">Conta criada!</p>
          <p style="color:var(--muted);font-size:0.88rem">
            Enviamos um link de confirmação para <strong>${email}</strong>.<br>
            Confirme seu e-mail e depois faça o login.
          </p>
        </div>
      `;
      showToast("Verifique seu e-mail para confirmar a conta.", "success");
    }
  } catch (err) {
    const msg = err?.message || "Erro desconhecido";
    if (msg.includes("fetch") || msg.includes("NetworkError")) {
      showSignupError("Sem conexão com o servidor. Verifique sua internet.");
    } else {
      showSignupError(traduzirErroAuth(msg));
    }
  } finally {
    setButtonLoading(btn, false);
  }
}

// ===== VISITANTE =====
async function continueAsGuest() {
  isGuest = true;
  currentUser = null;
  userInfo.textContent = "👁️ Visitante";
  showDashboard();
  await renderLives();
}

// ===== LOGOUT =====
async function handleLogout() {
  if (
    !confirm(
      isGuest ? "Sair do modo visitante?" : "Tem certeza que deseja sair?",
    )
  )
    return;

  try {
    if (!isGuest) await supabaseClient.auth.signOut();
    currentUser = null;
    isGuest = false;
    grid.innerHTML = "";
    showAuthScreen();
    showToast("Até logo!", "success");
  } catch {
    showToast("Erro ao sair. Tente novamente.", "error");
  }
}

// ===== TELAS =====
function showAuthScreen() {
  authScreen.classList.remove("hidden");
  document.getElementById("main-header").style.display = "none";
  document.getElementById("main-content").style.display = "none";
  document.getElementById("mini-header").style.display = "none";
  document.getElementById("exit-fs").style.display = "none";
  switchAuthMode("login");
}

function showDashboard() {
  authScreen.classList.add("hidden");
  document.getElementById("main-header").style.display = "flex";
  document.getElementById("main-content").style.display = "flex";

  if (isGuest) {
    inputGroupContainer.style.display = "none";
    btnFullscreen.style.display = "none";
    btnMinimize.style.display = "none";
    btnLogout.style.display = "flex";
    btnLogout.textContent = "Sair da visita";
  } else {
    inputGroupContainer.style.display = "flex";
    btnFullscreen.style.display = "flex";
    btnMinimize.style.display = "flex";
    btnLogout.style.display = "flex";
    btnLogout.textContent = "Sair";
  }

  renderLives();
}

// ===== ERROS =====
function showLoginError(message) {
  loginError.textContent = message;
  loginError.classList.add("show");
  setTimeout(() => loginError.classList.remove("show"), 4000);
}

function showSignupError(message) {
  signupError.textContent = message;
  signupError.classList.add("show");
  setTimeout(() => signupError.classList.remove("show"), 4000);
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
  urlInput?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") addLive();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "F11") {
      e.preventDefault();
      toggleFullscreen();
    }
    if (
      e.key === "Escape" &&
      document.body.classList.contains("fullscreen-mode")
    ) {
      toggleFullscreen();
    }
  });

  let lastScroll = 0;
  window.addEventListener(
    "scroll",
    () => {
      const cur = window.scrollY;
      if (cur > lastScroll && cur > 80) {
        document.body.classList.add("header-hidden");
      } else {
        document.body.classList.remove("header-hidden");
      }
      lastScroll = cur <= 0 ? 0 : cur;
    },
    { passive: true },
  );

  // Fechar com Escape ao pressionar fora do fullscreen
  document.addEventListener("fullscreenchange", () => {
    if (
      !document.fullscreenElement &&
      document.body.classList.contains("fullscreen-mode")
    ) {
      document.body.classList.remove("fullscreen-mode");
      updateGridLayout();
    }
  });
}

function switchAuthMode(mode) {
  const lf = document.getElementById("login-form");
  const sf = document.getElementById("signup-form");
  const lt = document.getElementById("login-tab");
  const st = document.getElementById("signup-tab");

  if (mode === "signup") {
    lf.classList.add("hidden");
    sf.classList.remove("hidden");
    lt.classList.remove("active");
    st.classList.add("active");
    lt.setAttribute("aria-selected", "false");
    st.setAttribute("aria-selected", "true");
  } else {
    sf.classList.add("hidden");
    lf.classList.remove("hidden");
    st.classList.remove("active");
    lt.classList.add("active");
    st.setAttribute("aria-selected", "false");
    lt.setAttribute("aria-selected", "true");
  }
}

function setupAuthToggle() {
  document
    .getElementById("login-tab")
    .addEventListener("click", () => switchAuthMode("login"));
  document
    .getElementById("signup-tab")
    .addEventListener("click", () => switchAuthMode("signup"));
}

// ===== FORÇA DE SENHA =====
function setupPasswordStrength() {
  const pwInput = document.getElementById("signup-password");
  const bar = document.getElementById("password-strength");
  if (!pwInput || !bar) return;

  pwInput.addEventListener("input", () => {
    const v = pwInput.value;
    const score = calcPasswordStrength(v);
    const colors = ["", "#ff4d6a", "#ffb347", "#ffe066", "#3ddc84"];
    const widths = ["0%", "25%", "50%", "75%", "100%"];
    bar.style.setProperty("--strength", widths[score]);
    bar.style.setProperty("--strength-color", colors[score] || "transparent");
  });
}

function calcPasswordStrength(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

// ===== MOSTRAR/ESCONDER SENHA =====
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isHidden = input.type === "password";
  input.type = isHidden ? "text" : "password";
  btn.textContent = isHidden ? "🙈" : "👁";
  btn.setAttribute("aria-label", isHidden ? "Esconder senha" : "Mostrar senha");
}

// ===== FUNÇÕES PRINCIPAIS =====

async function addLive() {
  if (isGuest) {
    showToast("Faça login para adicionar lives.", "error");
    return;
  }

  const rawUrl = urlInput.value.trim();
  if (!rawUrl) {
    showToast("Cole um link do YouTube ou Twitch.", "error");
    return;
  }

  // Validação de URL antes de processar
  if (!isValidHttpUrl(rawUrl)) {
    showToast("URL inválida. Use um link completo (https://...).", "error");
    return;
  }

  const embedData = getEmbedUrl(rawUrl);
  if (!embedData) {
    showToast("Link não suportado. Use YouTube ou Twitch.", "error");
    return;
  }

  try {
    const { data: existing } = await supabaseClient
      .from("user_lives")
      .select("id")
      .eq("user_id", currentUser.id)
      .eq("embed_id", embedData.id)
      .single();

    if (existing) {
      showToast("Esta live já está no seu painel.", "error");
      return;
    }

    const { error } = await supabaseClient.from("user_lives").insert([
      {
        user_id: currentUser.id,
        url: rawUrl,
        type: embedData.type,
        embed_id: embedData.id,
      },
    ]);

    if (error) {
      showToast("Erro ao adicionar live.", "error");
      console.error(error);
      return;
    }

    urlInput.value = "";
    urlInput.focus();
    showToast("Live adicionada!", "success");
    await renderLives();
  } catch (err) {
    showToast("Erro ao adicionar live.", "error");
    console.error(err);
  }
}

async function removeLive(liveId) {
  if (isGuest) {
    showToast("Visitantes não podem remover lives.", "error");
    return;
  }

  try {
    const { error } = await supabaseClient
      .from("user_lives")
      .delete()
      .eq("id", liveId)
      .eq("user_id", currentUser.id); // garante que só remove a própria live

    if (error) {
      showToast("Erro ao remover live.", "error");
      return;
    }

    const container = document.getElementById(`live-${liveId}`);
    if (container) {
      container.style.animation = "fadeOut 0.25s ease-out both";
      setTimeout(() => {
        container.remove();
        updateGridLayout();
        updateLiveCountBadge();
      }, 250);
    }

    showToast("Live removida.", "success");
  } catch (err) {
    console.error("Erro ao remover live:", err);
  }
}

function refreshLive(id) {
  const iframe = document.querySelector(`iframe[data-id="${id}"]`);
  if (!iframe) return;
  const src = iframe.src;
  iframe.src = "";
  setTimeout(() => {
    iframe.src = src;
  }, 100);
}

function toggleFullscreen() {
  const isFS = document.body.classList.toggle("fullscreen-mode");

  if (isFS) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }

  updateGridLayout();
}

function toggleHeader() {
  document.body.classList.toggle("header-hidden");
}

// ===== DOM: ADICIONAR LIVE =====
function addLiveToDOM(live) {
  const container = document.createElement("div");
  container.className = "live-container";
  container.id = `live-${live.id}`;

  const platformClass = live.type === "youtube" ? "youtube" : "twitch";
  const platformLabel = live.type === "youtube" ? "▶ YouTube" : "🟣 Twitch";

  const controls = isGuest
    ? ""
    : `
    <button class="control-btn" onclick="refreshLive('${live.id}')" title="Recarregar" type="button" aria-label="Recarregar live">🔄</button>
    <button class="control-btn btn-remove" onclick="removeLive('${live.id}')" title="Remover" type="button" aria-label="Remover live">✕</button>
  `;

  // Sandbox no iframe: bloqueia pop-ups, scripts desnecessários, mas permite player
  container.innerHTML = `
    <span class="live-platform-badge ${platformClass}" aria-hidden="true">${platformLabel}</span>
    <div class="live-overlay">${controls}</div>
    <iframe
      data-id="${live.id}"
      src="${getEmbedSrc(live)}"
      allow="autoplay; encrypted-media; fullscreen"
      sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
      allowfullscreen
      loading="lazy"
      title="Live ${live.type} — ${live.embed_id}"
    ></iframe>
  `;

  grid.appendChild(container);
}

// ===== EMBED SRC =====
function getEmbedSrc(live) {
  if (live.type === "youtube") {
    return `https://www.youtube.com/embed/${encodeURIComponent(live.embed_id)}?modestbranding=1&rel=0`;
  }
  if (live.type === "twitch") {
    const parent = window.location.hostname || "localhost";
    return `https://player.twitch.tv/?channel=${encodeURIComponent(live.embed_id)}&parent=${encodeURIComponent(parent)}`;
  }
  return "";
}

// ===== EXTRAIR EMBED URL =====
function getEmbedUrl(url) {
  try {
    const u = new URL(url);

    // Apenas HTTPS
    if (u.protocol !== "https:") return null;

    // YouTube
    if (u.hostname === "www.youtube.com" || u.hostname === "youtube.com") {
      const videoId = u.searchParams.get("v");
      if (!videoId || !isValidVideoId(videoId)) return null;
      return { type: "youtube", id: videoId };
    }

    if (u.hostname === "youtu.be") {
      const videoId = u.pathname.slice(1).split("?")[0];
      if (!videoId || !isValidVideoId(videoId)) return null;
      return { type: "youtube", id: videoId };
    }

    // YouTube live com /live/
    if (
      (u.hostname === "www.youtube.com" || u.hostname === "youtube.com") &&
      u.pathname.startsWith("/live/")
    ) {
      const videoId = u.pathname.split("/live/")[1]?.split("?")[0];
      if (!videoId || !isValidVideoId(videoId)) return null;
      return { type: "youtube", id: videoId };
    }

    // Twitch
    if (u.hostname === "www.twitch.tv" || u.hostname === "twitch.tv") {
      const parts = u.pathname.split("/").filter(Boolean);
      const channel = parts[0];
      if (!channel || !isValidTwitchChannel(channel)) return null;
      return { type: "twitch", id: channel };
    }
  } catch {
    return null;
  }
  return null;
}

// ===== RENDERIZAR LIVES =====
async function renderLives() {
  grid.innerHTML = "";

  try {
    let lives = [];

    if (isGuest) {
      lives = await loadGenericLives();
    } else {
      const { data, error } = await supabaseClient
        .from("user_lives")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao carregar lives:", error);
      } else {
        lives = data || [];
      }
    }

    if (lives.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📺</div>
          <div class="empty-state-title">
            ${isGuest ? "Nenhuma live disponível no momento." : "Seu painel está vazio."}
          </div>
          <p class="empty-state-hint">
            ${isGuest ? "Crie uma conta para salvar suas lives favoritas." : "Cole um link do YouTube ou Twitch acima para começar."}
          </p>
        </div>
      `;
      updateLiveCountBadge(0);
      return;
    }

    lives.forEach(addLiveToDOM);
    updateLiveCountBadge(lives.length);
    updateGridLayout();
  } catch (err) {
    console.error("Erro ao renderizar lives:", err);
    grid.innerHTML = `<div class="empty-state"><p style="color:var(--red)">Erro ao carregar lives. Recarregue a página.</p></div>`;
  }
}

async function loadGenericLives() {
  try {
    const { data, error } = await supabaseClient
      .from("user_lives")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(6);

    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

// ===== BADGE DE CONTAGEM =====
function updateLiveCountBadge(count) {
  if (count === undefined) {
    count = document.querySelectorAll(".live-container").length;
  }
  if (!liveCountBadge) return;
  if (count > 0) {
    liveCountBadge.textContent = `${count} live${count !== 1 ? "s" : ""}`;
    liveCountBadge.classList.add("visible");
  } else {
    liveCountBadge.classList.remove("visible");
  }
}

// ===== LAYOUT DO GRID =====
function updateGridLayout() {
  const containers = document.querySelectorAll(".live-container");
  const count = containers.length;
  if (count === 0) return;

  if (document.body.classList.contains("fullscreen-mode")) {
    let cols, rows;

    if (count === 1) {
      cols = 1;
      rows = 1;
    } else if (count === 2) {
      cols = 2;
      rows = 1;
    } else if (count <= 4) {
      cols = 2;
      rows = 2;
    } else if (count <= 6) {
      cols = 3;
      rows = 2;
    } else if (count <= 9) {
      cols = 3;
      rows = 3;
    } else if (count <= 12) {
      cols = 4;
      rows = 3;
    } else {
      cols = Math.ceil(Math.sqrt(count));
      rows = Math.ceil(count / cols);
    }

    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.gridAutoRows = `calc(100vh / ${rows})`;
    grid.style.height = "100vh";
  } else {
    grid.style.gridTemplateColumns = "repeat(auto-fit, minmax(420px, 1fr))";
    grid.style.gridAutoRows = "auto";
    grid.style.height = "auto";
  }
}

// ===== TOAST =====
let toastTimer = null;
function showToast(message, type = "info") {
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3500);
}

// ===== UTILITÁRIOS DE SEGURANÇA =====

/** Remove HTML para evitar XSS ao exibir texto */
function sanitizeText(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim();
}

/** Valida formato de e-mail básico */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** Valida se é URL HTTPS válida */
function isValidHttpUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Valida ID de vídeo do YouTube (11 chars alfanuméricos + - _) */
function isValidVideoId(id) {
  return /^[A-Za-z0-9_-]{11}$/.test(id);
}

/** Valida nome de canal Twitch (alfanumérico + underscore, 4-25 chars) */
function isValidTwitchChannel(ch) {
  return /^[A-Za-z0-9_]{1,25}$/.test(ch);
}

/** Traduz erros do Supabase para PT-BR */
function traduzirErroAuth(msg) {
  if (!msg) return "Erro desconhecido.";
  if (
    msg.includes("Invalid login credentials") ||
    msg.includes("invalid_credentials")
  )
    return "E-mail ou senha incorretos.";
  if (msg.includes("Email not confirmed"))
    return "E-mail não confirmado. Verifique sua caixa de entrada.";
  if (msg.includes("Too many requests"))
    return "Muitas tentativas. Aguarde alguns minutos.";
  if (
    msg.includes("User already registered") ||
    msg.includes("already been registered")
  )
    return "Este e-mail já está cadastrado. Tente fazer login.";
  if (msg.includes("Invalid email")) return "E-mail inválido.";
  if (msg.includes("Password should be") || msg.includes("password"))
    return "A senha deve ter no mínimo 6 caracteres.";
  if (msg.includes("Unable to validate email"))
    return "Não foi possível validar o e-mail.";
  if (msg.includes("fetch") || msg.includes("NetworkError"))
    return "Sem conexão. Verifique sua internet.";
  return msg;
}

/** Controla estado de loading dos botões */
function setButtonLoading(btn, loading) {
  if (!btn) return;
  const label = btn.querySelector(".btn-label");
  const spinner = btn.querySelector(".btn-spinner");
  btn.disabled = loading;
  if (label) label.style.opacity = loading ? "0.5" : "1";
  if (spinner) spinner.classList.toggle("hidden", !loading);
}

// ===== ANIMAÇÃO DE SAÍDA =====
const style = document.createElement("style");
style.textContent = `
  @keyframes fadeOut {
    from { opacity:1; transform:scale(1); }
    to   { opacity:0; transform:scale(0.95); }
  }
`;
document.head.appendChild(style);
