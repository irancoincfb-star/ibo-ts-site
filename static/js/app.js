/**
 * IBO-TS QUANTITATIVE TRADING PLATFORM
 * Core Frontend Client Engine v2.5.0
 * Pure Vanilla JS, Google Identity Services, Live USDT/TMN Converter & Multi-Exchange Vault
 */

const state = {
  token: localStorage.getItem('ibots_token') || null,
  user: null,
  subscription: null,
  usdtTomanRate: 263300,
  usdtTimerSeconds: 60,
  usdtTimerInterval: null,
  botAddonActive: false,
  currentTimeframe: 'all',
  pnlData: null,
  exchangeBalances: {},
  depositWallets: null,
  pricingPlans: [
    { code: '1w', title: 'اشتراک هفتگی پایه (افتتاحیه)', days: 7, baseUsdt: 10, addonUsdt: 15, tag: 'افتتاحیه — ۷ روزه', icon: 'bi-lightning-charge' },
    { code: '1m', title: 'اشتراک ۱ ماهه طلایی VIP (افتتاحیه)', days: 30, baseUsdt: 30, addonUsdt: 15, tag: 'افتتاحیه — محبوب‌ترین', popular: true, icon: 'bi-gem', isVip: true },
    { code: '3m', title: 'اشتراک ۳ ماهه کوانتوم (افتتاحیه)', days: 90, baseUsdt: 75, addonUsdt: 15, tag: 'افتتاحیه — ۱۵% تخفیف', icon: 'bi-stars' },
    { code: '6m', title: 'اشتراک ۶ ماهه الماس دایموند (افتتاحیه)', days: 180, baseUsdt: 120, addonUsdt: 15, tag: 'افتتاحیه — ۲۵% تخفیف', icon: 'bi-diamond-fill', isDiamond: true },
    { code: '1y', title: 'اشتراک سالانه صندوق‌های سرمایه‌گذاری و ولث (افتتاحیه)', days: 365, baseUsdt: 200, addonUsdt: 15, tag: 'افتتاحیه — ۴۰% تخفیف طلایی', icon: 'bi-bank2' }
  ]
};

// Market logo URL: official per-symbol library (daily Bitunix market scan).
// Used next to EVERY symbol name in feeds, histories and notifications.
function symLogo(symbol) {
  let b = String(symbol || '').trim().toUpperCase();
  if (!b || b.includes('CONNECT') || b.includes('IDLE') || b.includes('STOP')) return '';
  for (const q of ['USDT', 'USDC', 'USD', 'BUSD']) {
    if (b.endsWith(q) && b.length > q.length) { b = b.slice(0, -q.length); break; }
  }
  b = b.replace(/[^A-Z0-9]/g, '').toLowerCase();
  return b ? `/static/assets/symbols/${b}.png` : '';
}

function symLogoImg(symbol, cls = 'sym-logo') {
  const url = symLogo(symbol);
  if (!url) return '';
  return `<img class="${cls}" src="${url}" alt="" loading="lazy" onerror="this.onerror=null;this.src='https://assets.coincap.io/assets/icons/generic@2x.png'">`;
}

// Official USDT deposit wallets (single source of truth = backend /subscriptions/plans)
window.IBO_DEPOSIT_WALLETS = {
  USDT_TRC20: 'TQa1Tzz3yre7CJE9D2QHioNtPy9hhFkepo',
  USDT_BEP20: '0xc2dc78853861644e973Dc4602181fa20cccb7319',
  USDT_TON: 'UQC0DjJDyRR8oqtcyIhOXjeLePT9ysmgKZV-SlvzLqFzlDDn'
};

// Pull pricing plans + official deposit wallets from backend DB (seed-driven)
async function fetchPricingPlans() {
  try {
    const res = await fetch('/api/v1/subscriptions/plans');
    const data = await res.json();
    if (res.ok && data.status === 'success' && Array.isArray(data.plans) && data.plans.length) {
      const icons = { '1w': 'bi-lightning-charge', '1m': 'bi-gem', '3m': 'bi-stars', '6m': 'bi-diamond-fill', '1y': 'bi-bank2' };
      state.pricingPlans = data.plans.map(p => ({
        code: p.code,
        title: p.title_fa,
        days: p.duration_days,
        baseUsdt: p.base_price_usdt,
        addonUsdt: p.bot_addon_price_usdt,
        tag: p.discount_label || '',
        popular: !!p.is_popular,
        icon: icons[p.code] || 'bi-lightning-charge',
        isDiamond: p.code === '6m',
        isVip: p.code === '1m'
      }));
      if (data.deposit_wallets) {
        state.depositWallets = data.deposit_wallets;
        window.IBO_DEPOSIT_WALLETS = data.deposit_wallets;
      }
      if (state.pricingPlans.length) renderPricingCards();
    }
  } catch (e) {
    console.warn('Plans fetch fallback to static list:', e);
  }
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
  // APK build detection (WebView UA "IBO-TS-App/…") — drives UI affordances
  document.documentElement.classList.toggle(
    'ibots-apk', /IBO-TS-App/i.test(navigator.userAgent || ''));
  initSplash();
  initAOS();
  // Entry from any other page's "ورود" link → open the auth modal right away
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('auth') === 'login') {
      history.replaceState({}, '', location.pathname);
      openAuthModal('login');
    }
    if (params.get('auth') === 'ok') {
      history.replaceState({}, '', location.pathname);
      handleGoogleRedirectReturn();
    }
  } catch (e) {}
  checkAuth();
  initTelegramWebApp();
  startUsdtRateEngine();
  startCountdown();
  fetchPerformanceAnalytics('all');
  fetchEngineStatus();
  setInterval(() => fetchPerformanceAnalytics('all'), 1800000);
  setInterval(fetchEngineStatus, 30000);
  initFAQAccordion();
  initGoogleIdentity();
  fetchPricingPlans();
});

// ==================== SPLASH (video-backed; activates only when asset exists) ====================
async function initSplash() {
  try {
    const ov = document.getElementById('appSplash');
    const v = document.getElementById('splashVideo');
    if (!ov || !v) return;
    let videoShown = false;
    let closed = false;

    const close = () => {
      if (closed) return;
      closed = true;
      ov.style.opacity = '0';                 // smooth fade-out
      setTimeout(() => {                      // then release the page
        ov.style.display = 'none';
        try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {}
      }, 520);
    };

    // Slow-network guard: logo splash alone still completes gracefully
    const cap = setTimeout(close, 3800);

    try {
      const r = await fetch('/static/assets/splash/splash.mp4', { method: 'HEAD' });
      if (r.status === 200) {
        v.addEventListener('canplay', () => {
          if (closed) return;
          videoShown = true;
          v.style.display = 'block';
          requestAnimationFrame(() => { v.style.opacity = '1'; });
          v.play().catch(() => {});
        }, { once: true });
        v.src = '/static/assets/splash/splash.mp4?v=' + Math.floor(Date.now() / 600000);
        v.addEventListener('error', () => { if (!videoShown) close(); }, { once: true });
      } else {
        clearTimeout(cap);
        setTimeout(close, 1600); // pure-brand splash, then release
      }
    } catch (e) {
      clearTimeout(cap);
      setTimeout(close, 1600);
    }

    ov.addEventListener('click', () => { clearTimeout(cap); close(); }, { once: true });
  } catch (e) { /* optional splash disabled */ }
}

// Subtle Scroll-Reveal Animation
function initAOS() {  const elements = document.querySelectorAll('[data-fade]');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });
  elements.forEach(el => observer.observe(el));
}

// ==================== AUTHENTICATION & HEADER STATE ====================
function checkAuth() {
  const token = localStorage.getItem('ibots_token');
  const authNav = document.getElementById('authNavContainer');
  
  if (token) {
    state.token = token;
    if (authNav) {
      authNav.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <button class="btn btn-emerald btn-sm" onclick="showDashboardView()">
            <i class="bi bi-speedometer2"></i> داشبورد معاملاتی <i class="bi bi-lightning-charge-fill" style="color: #FDE047;"></i>
          </button>
          <button class="btn btn-outline btn-sm" onclick="handleLogout()" title="خروج از حساب">
            <i class="bi bi-box-arrow-right"></i>
          </button>
        </div>
      `;
    }
    fetchUserProfile();
    fetchCurrentSubscription();
  } else {
    state.token = null;
    state.user = null;
    state.subscription = null;
    if (authNav) {
      authNav.innerHTML = `
        <button class="btn btn-primary btn-sm" onclick="openAuthModal('login')">
          <i class="bi bi-person-fill-lock"></i> ورود و ثبت‌نام
        </button>
      `;
    }
  }
}

async function fetchUserProfile() {
  if (!state.token) return;
  try {
    const res = await fetch('/api/v1/auth/me', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (res.ok) {
      const data = await res.json();
      state.user = data.user;
      const greetingEl = document.getElementById('dashboardUserEmail');
      if (greetingEl && state.user) {
        greetingEl.innerText = state.user.email;
      }
    } else if (res.status === 401) {
      handleLogout();
    }
  } catch (e) {
    console.error('Profile fetch failed:', e);
  }
}

async function fetchCurrentSubscription() {
  if (!state.token) return;
  try {
    const res = await fetch('/api/v1/subscriptions/current', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (res.ok) {
      const data = await res.json();
      state.subscription = data.subscription;
      renderDashboardAccessState();
    }
  } catch (e) {
    console.error('Subscription check failed:', e);
  }
}

function handleLogout() {
  localStorage.removeItem('ibots_token');
  state.token = null;
  state.user = null;
  state.subscription = null;
  checkAuth();
  updateTelegramCard(null);
  showToast('با موفقیت از حساب کاربری خارج شدید.', 'info');
  // Return to landing page view
  const dashEl = document.getElementById('dashboardSection');
  if (dashEl) dashEl.classList.remove('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==================== TELEGRAM (MINI APP + SIGNAL ALERTS) ====================
const TG_WEBAPP = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;

function initTelegramWebApp() {
  if (TG_WEBAPP) {
    try { TG_WEBAPP.ready(); TG_WEBAPP.expand(); } catch (e) {}
  }
  if (!state.token) {
    tryTelegramAutoLogin();   // Mini App: one-tap login via signed initData
    updateTelegramCard(null);
    return;
  }
  (async () => {
    if (TG_WEBAPP && TG_WEBAPP.initData) {
      try {
        await fetch('/api/v1/telegram/link-initdata', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${state.token}`,
            'X-Telegram-Init-Data': TG_WEBAPP.initData
          }
        });
      } catch (e) { console.warn('Telegram initData link failed:', e); }
    }
    refreshTelegramCard();
  })();
}

function updateTelegramCard(me) {
  const statusEl = document.getElementById('telegramCardStatus');
  const linkBtn = document.getElementById('telegramLinkBtn');
  const unlinkBtn = document.getElementById('telegramUnlinkBtn');
  if (!statusEl || !linkBtn) return;
  if (!state.token) {
    statusEl.innerText = 'برای اتصال، ابتدا وارد حساب کاربری شوید.';
    linkBtn.style.display = 'none';
    if (unlinkBtn) unlinkBtn.style.display = 'none';
    return;
  }
  if (me && me.linked) {
    const who = me.tg_username ? '@' + me.tg_username : 'حساب تلگرام شما';
    const sub = (me.subscription && me.subscription.active)
      ? ` | اشتراک فعال تا ${String(me.subscription.expires_at).slice(0, 10)}`
      : ' | بدون اشتراک فعال';
    statusEl.innerText = `متصل به ${who}${sub}`;
    linkBtn.style.display = 'none';
    if (unlinkBtn) unlinkBtn.style.display = 'inline-flex';
  } else {
    statusEl.innerText = 'هنوز متصل نیست — سیگنال‌ها فقط برای مشترکین فعال ارسال می‌شود.';
    linkBtn.style.display = 'inline-flex';
    if (unlinkBtn) unlinkBtn.style.display = 'none';
  }
}

async function refreshTelegramCard() {
  if (!state.token) { updateTelegramCard(null); return; }
  try {
    const res = await fetch('/api/v1/telegram/me', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (res.ok) updateTelegramCard(await res.json());
  } catch (e) { console.warn('Telegram status failed:', e); }
}

async function connectTelegram() {
  if (!state.token) { openAuthModal('login'); return; }
  try {
    const res = await fetch('/api/v1/telegram/link-code', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await res.json();
    if (res.ok && data.deep_link) {
      if (TG_WEBAPP && TG_WEBAPP.openTelegramLink) TG_WEBAPP.openTelegramLink(data.deep_link);
      else window.open(data.deep_link, '_blank');
      showToast('در تلگرام دکمه Start را بزنید تا اتصال کامل شود.', 'info');
    } else {
      showToast(data.detail || 'ساخت لینک اتصال ناموفق بود.', 'error');
    }
  } catch (e) { showToast('خطا در ارتباط با سرور', 'error'); }
}

async function unlinkTelegram() {
  if (!state.token) return;
  try {
    const res = await fetch('/api/v1/telegram/unlink', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (res.ok) {
      showToast('اتصال تلگرام قطع شد.', 'info');
      refreshTelegramCard();
    }
  } catch (e) { showToast('خطا در ارتباط با سرور', 'error'); }
}

// Modal open/close
function openAuthModal(view = 'login') {
  const modal = document.getElementById('authModal');
  if (modal) {
    modal.classList.add('active');
    switchAuthView(view);
    if (view === 'login') initTelegramLogin();
  }
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('active');
}

function switchAuthView(view) {
  const views = ['loginView', 'registerView', 'otpView'];
  views.forEach(v => {
    const el = document.getElementById(v);
    if (el) el.style.display = 'none';
  });

  const activeEl = document.getElementById(`${view}View`);
  if (activeEl) activeEl.style.display = 'block';
}

// ==================== GOOGLE IDENTITY SERVICES (OFFICIAL SSO) ====================
async function initGoogleIdentity() {
  try {
    const res = await fetch('/api/v1/auth/google/config');
    const { client_id } = await res.json();

    if (window.google && window.google.accounts && client_id) {
      window.google.accounts.id.initialize({
        client_id: client_id,
        callback: handleGoogleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true
      });

      const container = document.getElementById('gsiButtonRenderContainer');
      const customBtn = document.getElementById('googleLoginBtn');
      if (container) {
        window.google.accounts.id.renderButton(container, {
          type: 'standard',
          shape: 'rectangular',
          theme: 'outline',
          text: 'signin_with',
          size: 'large',
          logo_alignment: 'left',
          width: 340
        });
        if (customBtn) customBtn.style.display = 'none';
      }
    }
  } catch (err) {
    console.warn('Google Identity initialization notice:', err);
  }
}

// Triggered when user selects a Google account via official GIS
async function handleGoogleCredentialResponse(response) {
  if (!response || !response.credential) return;
  showToast('در حال تایید هویت امن با سرورهای گوگل...', 'info');

  try {
    const res = await fetch('/api/v1/auth/google/verify-credential', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      localStorage.setItem('ibots_token', data.token);
      state.token = data.token;
      state.user = data.user;
      closeAuthModal();
      checkAuth();
      showToast('ورود موفقیت‌آمیز با حساب رسمی گوگل انجام شد.', 'success');
      showDashboardView();
    } else {
      showToast(data.detail || 'اعتبارسنجی حساب گوگل ناموفق بود.', 'error');
    }
  } catch (err) {
    showToast('خطا در برقراری ارتباط با سرور احراز هویت گوگل', 'error');
  }
}

// Manual trigger button for Google OAuth
function triggerGoogleSignIn() {
  if (window.google && window.google.accounts && window.google.accounts.id) {
    window.google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed()) {
        const reason = notification.getNotDisplayedReason();
        console.warn('Google One-Tap not displayed:', reason);
        showToast('لطفاً دکمه اختصاصی ورود گوگل را انتخاب نمایید یا کوکی‌های مرورگر را بررسی فرمایید.', 'info');
      } else if (notification.isSkippedMoment()) {
        console.warn('Google One-Tap skipped:', notification.getSkippedReason());
      }
    });
  }
}

// ============ GOOGLE OAUTH2 REDIRECT FLOW (fallback — works on mirror host) ============
function onGoogleRedirectSignIn() {
  showToast('انتقال به صفحه امن ورود گوگل...', 'info');
  location.href = '/api/v1/auth/google/start';
}

async function handleGoogleRedirectReturn() {
  try {
    const res = await fetch('/api/v1/auth/session-resolve', { credentials: 'same-origin' });
    if (!res.ok) return;
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('ibots_token', data.token);
      state.token = data.token;
      state.user = data.user;
      closeAuthModal();
      checkAuth();
      showToast('ورود موفقیت‌آمیز با حساب رسمی گوگل انجام شد.', 'success');
      showDashboardView();
    }
  } catch (err) {
    console.warn('session-resolve notice:', err);
  }
}

// (duplicate tail of old triggerGoogleSignIn removed)

// ==================== TELEGRAM LOGIN (WIDGET + MINI APP) ====================
let tgWidgetLoading = false;

async function initTelegramLogin() {
  if (tgWidgetLoading) return;
  tgWidgetLoading = true;
  try {
    const res = await fetch('/api/v1/telegram/health');
    const h = await res.json();
    if (!h.enabled || !h.bot_username) { tgWidgetLoading = false; return; }
    const sec = document.getElementById('tgLoginSection');
    const wrap = document.getElementById('tgLoginWrap');
    const box = document.getElementById('tgLoginWidget');
    if (!sec || !wrap || !box || box.childElementCount > 0) { tgWidgetLoading = false; return; }
    sec.style.display = 'block';
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://telegram.org/js/telegram-widget.js?22';
    s.setAttribute('data-telegram-login', String(h.bot_username).replace(/^@/, ''));
    s.setAttribute('data-size', 'large');
    s.setAttribute('data-userpic', 'false');
    s.setAttribute('data-radius', '10');
    s.setAttribute('data-request-access', 'write');   // Telegram asks "allow messages" -> opens the bot chat automatically
    s.setAttribute('data-onauth', 'onTelegramAuth(user)');
    box.appendChild(s);
    // Size the invisible widget iframe over the styled button so it covers it
    const sizeIframe = () => {
      const f = box.querySelector('iframe');
      if (!f) return;
      const w = wrap.clientWidth || 340, hh = wrap.clientHeight || 52;
      const iw = f.offsetWidth || 270, ih = f.offsetHeight || 60;
      const sc = Math.max(w / iw, hh / ih);
      f.style.position = 'absolute';
      f.style.left = '50%';
      f.style.top = '50%';
      f.style.transform = `translate(-50%, -50%) scale(${sc})`;
    };
    new MutationObserver(sizeIframe).observe(box, { childList: true, subtree: true, attributes: true, attributeFilter: ['width', 'height', 'style'] });
    setTimeout(sizeIframe, 300);
    setTimeout(sizeIframe, 1200);
  } catch (e) {
    console.warn('Telegram widget init:', e);
    tgWidgetLoading = false;
  }
}

// Callback invoked by the Telegram Login Widget (data-onauth) after user consent
window.onTelegramAuth = async function (user) {
  showToast('در حال تایید هویت تلگرام...', 'info');
  try {
    const res = await fetch('/api/v1/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    });
    const data = await res.json();
    if (res.ok && data.token) {
      localStorage.setItem('ibots_token', data.token);
      state.token = data.token;
      state.user = data.user;
      closeAuthModal();
      checkAuth();
      showToast('ورود با تلگرام انجام شد. خوش آمدید!', 'success');
      showDashboardView();
      showTelegramConnectGuide();
    } else {
      showToast(data.detail || 'ورود با تلگرام ناموفق بود.', 'error');
    }
  } catch (e) {
    showToast('خطا در برقراری ارتباط با سرور احراز هویت تلگرام', 'error');
  }
};

// Guide: web-widget login does not guarantee the bot chat exists; show how to open it
function showTelegramConnectGuide() {
  const bot = (window.__IBO_BOT_USERNAME || 'IBOTradingSignalsBot').replace(/^@/, '');
  let ov = document.getElementById('tgConnectGuide');
  if (ov) { ov.classList.add('active'); return; }
  ov = document.createElement('div');
  ov.id = 'tgConnectGuide';
  ov.className = 'modal-overlay active';
  ov.innerHTML = `
    <div class="modal-container-box" style="max-width:420px;">
      <button class="modal-close-btn" onclick="document.getElementById('tgConnectGuide').remove()">&times;</button>
      <div class="modal-head-center">
        <h3 class="modal-head-title">اتصال به ربات تلگرام</h3>
        <p class="modal-head-desc">حساب شما به IBO-TS متصل شد ✅<br>برای دریافت سیگنال‌ها و تاریخچه معاملات در تلگرام، ربات را باز کنید و <b>START</b> را بزنید.</p>
      </div>
      <a href="https://t.me/${bot}" class="btn btn-primary" style="width:100%; justify-content:center; text-decoration:none; margin-bottom:0.75rem;">
        <i class="bi bi-telegram"></i> باز کردن ربات تلگرام
      </a>
      <p style="text-align:center; font-size:0.8rem; color:var(--text-muted); margin:0;">ارسال سیگنال‌ها فقط با اشتراک فعال انجام می‌شود.</p>
    </div>`;
  ov.addEventListener('click', function (e) {
    if (e.target === ov) ov.remove();
  });
  document.body.appendChild(ov);
}

// Mini App: seamless one-tap login via signed initData when no session exists
async function tryTelegramAutoLogin() {
  if (!TG_WEBAPP || !TG_WEBAPP.initData || localStorage.getItem('ibots_token')) return;
  try {
    const res = await fetch('/api/v1/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ init_data: TG_WEBAPP.initData })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      localStorage.setItem('ibots_token', data.token);
      state.token = data.token;
      state.user = data.user;
      checkAuth();
      refreshTelegramCard();
      showToast('ورود خودکار با حساب تلگرام انجام شد.', 'success');
      showDashboardView();
    } else {
      console.warn('tg auto-login rejected:', data.detail || res.status);
    }
  } catch (e) {
    console.warn('tg auto-login error:', e);
  }
}

// ==================== MANUAL EMAIL & OTP REGISTRATION ====================
async function handleRegister(e) {
  e.preventDefault();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const fullName = document.getElementById('regFullName').value.trim();

  if (!email || !password) {
    showToast('لطفاً ایمیل و رمز عبور را وارد فرمایید.', 'error');
    return;
  }

  showToast('در حال پردازش و صدور کد تایید ۶ رقمی...', 'info');
  try {
    const res = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName })
    });
    const data = await res.json();
    if (res.ok) {
      document.getElementById('otpTargetEmail').innerText = email;
      document.getElementById('otpInputEmail').value = email;
      switchAuthView('otp');
      showToast(data.message, 'success');
    } else {
      showToast(data.detail || 'خطا در ثبت‌نام کاربر', 'error');
    }
  } catch (err) {
    showToast('خطای ارتباط با سرور', 'error');
  }
}

function fillOtpInput(code) {
  const digits = document.querySelectorAll('.otp-digit');
  const codeStr = String(code);
  digits.forEach((input, idx) => {
    if (codeStr[idx]) input.value = codeStr[idx];
  });
}

async function handleEmailLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    showToast('لطفاً ایمیل و کلمه عبور را وارد نمایید.', 'error');
    return;
  }

  showToast('در حال بررسی اطلاعات کاربری...', 'info');
  try {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      localStorage.setItem('ibots_token', data.token);
      state.token = data.token;
      state.user = data.user;
      closeAuthModal();
      checkAuth();
      showToast('ورود با موفقیت انجام شد.', 'success');
      showDashboardView();
    } else {
      showToast(data.detail || 'ایمیل یا کلمه عبور نادرست است.', 'error');
    }
  } catch (err) {
    showToast('خطای ارتباط با سرور', 'error');
  }
}

async function handleVerifyOtp(e) {
  e.preventDefault();
  const email = document.getElementById('otpInputEmail').value.trim();
  const digits = Array.from(document.querySelectorAll('.otp-digit')).map(i => i.value).join('');

  if (digits.length !== 6) {
    showToast('لطفاً کد تایید ۶ رقمی را به صورت کامل وارد فرمایید.', 'error');
    return;
  }

  showToast('در حال اعتبارسنجی کد...', 'info');
  try {
    const res = await fetch('/api/v1/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code: digits })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      localStorage.setItem('ibots_token', data.token);
      state.token = data.token;
      state.user = data.user;
      closeAuthModal();
      checkAuth();
      showToast('حساب کاربری با موفقیت فعال شد. خوش آمدید!', 'success');
      showDashboardView();
    } else {
      showToast(data.detail || 'کد تایید نامعتبر یا منقضی شده است.', 'error');
    }
  } catch (err) {
    showToast('خطای ارتباط با سرور', 'error');
  }
}

// Auto-advance OTP input digits
function initOtpInputs() {
  const inputs = document.querySelectorAll('.otp-digit');
  inputs.forEach((input, index) => {
    input.addEventListener('input', (e) => {
      if (input.value.length === 1 && index < inputs.length - 1) {
        inputs[index + 1].focus();
      }
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !input.value && index > 0) {
        inputs[index - 1].focus();
      }
    });
  });
}

// ==================== LIVE USDT RATE & REFRESH ENGINE ====================
function startUsdtRateEngine() {
  fetchLiveUsdtRate();
  // Live countdown timer ticking every 1 second
  if (state.usdtTimerInterval) clearInterval(state.usdtTimerInterval);
  state.usdtTimerInterval = setInterval(() => {
    state.usdtTimerSeconds--;
    const timerEl = document.getElementById('usdtTimerCountdown');
    if (timerEl) {
      timerEl.innerText = state.usdtTimerSeconds;
    }
    if (state.usdtTimerSeconds <= 0) {
      fetchLiveUsdtRate();
    }
  }, 1000);
}

async function fetchLiveUsdtRate(isManual = false) {
  if (isManual) {
    showToast('در حال استعلام لحظه‌ای نرخ تتر از دفتر سفارشات...', 'info');
  }
  try {
    const res = await fetch('/api/v1/market/usdt-rate');
    if (res.ok) {
      const data = await res.json();
      state.usdtTomanRate = data.usdt_toman || 263300;
      state.usdtTimerSeconds = data.seconds_until_refresh || 60;

      const rateDisplay = document.getElementById('liveUsdtRateDisplay');
      if (rateDisplay) {
        rateDisplay.innerText = state.usdtTomanRate.toLocaleString('en-US');
      }
      renderPricingCards();
      if (isManual) {
        showToast('نرخ تتر و محاسبات ریالی با موفقیت به‌روزرسانی شد.', 'success');
      }
    }
  } catch (e) {
    console.error('USDT rate fetch error:', e);
  }
}

// ==================== BOT ADDON & PRICING CALCULATOR ====================
function toggleBotAddon(checked) {
  state.botAddonActive = checked;
  renderPricingCards();
  const label = checked ? 'افزونه اتوتریدر فعال شد (+مبلغ به پلن‌ها اضافه گردید)' : 'افزونه اتوتریدر غیرفعال شد (حالت فقط سیگنال)';
  showToast(label, 'info');
}

function renderPricingCards() {
  const container = document.getElementById('pricingCardsGrid');
  if (!container) return;

  container.innerHTML = state.pricingPlans.map(plan => {
    const totalUsdt = plan.baseUsdt + (state.botAddonActive ? plan.addonUsdt : 0);
    const totalToman = totalUsdt * state.usdtTomanRate;
    const formattedToman = totalToman.toLocaleString('en-US');

    const planGradients = {
      '1w': 'linear-gradient(135deg, rgba(79, 70, 229, 0.08), rgba(255, 255, 255, 0.98))',
      '1m': 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(255, 255, 255, 0.98))',
      '3m': 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(255, 255, 255, 0.98))',
      '6m': 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(255, 255, 255, 0.98))',
      '1y': 'linear-gradient(135deg, rgba(147, 51, 234, 0.12), rgba(255, 255, 255, 0.98))'
    };

    return `
      <div class="plan-card ${plan.popular ? 'popular' : ''} ${plan.isVip ? 'plan-vip' : ''} ${plan.isDiamond ? 'plan-diamond' : ''}" data-code="${plan.code}" style="background: ${planGradients[plan.code] || '#FFFFFF'};">
        <span class="plan-badge-top">${plan.tag}</span>
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
          <i class="bi ${plan.icon}" style="font-size: 1.4rem; color: var(--brand-indigo);"></i>
          <h3 class="plan-title" style="margin: 0;">${plan.title}</h3>
        </div>
        <p class="plan-duration"><i class="bi bi-clock-history"></i> دوره اعتبار: <span class="mono font-bold">${plan.days}</span> روز</p>
        
        <div class="plan-pricing-box">
          <div class="plan-usdt-amount mono">$${totalUsdt}</div>
          <div class="plan-toman-amount">معادل <span class="mono">${formattedToman}</span> تومان</div>
          ${state.botAddonActive ? `<div style="font-size: 0.74rem; color: var(--brand-indigo); font-weight: 800; margin-top: 4px;"><i class="bi bi-robot"></i> شامل افزونه اتوتریدر +$${plan.addonUsdt}</div>` : ''}
        </div>

        <ul class="plan-features-list">
          <li><i class="bi bi-check-circle-fill"></i> سیگنال‌های بلادرنگ و نامحدود</li>
          <li><i class="bi bi-check-circle-fill"></i> ارسال پوش‌نوتیفیکیشن لحظه‌ای</li>
          <li><i class="bi bi-check-circle-fill"></i> پایش ۹ صرافی بین‌المللی</li>
          <li><i class="bi bi-check-circle-fill"></i> پایش ۹ صرافی معتبر ایرانی</li>
          ${state.botAddonActive 
            ? `<li style="color: var(--brand-indigo); font-weight: 800;"><i class="bi bi-robot" style="color: var(--brand-indigo);"></i> اتصال مستقیم ربات اتوتریدر با API</li>`
            : `<li style="color: var(--text-muted);"><i class="bi bi-dash-circle"></i> بدون اتصال ربات معامله‌گر</li>`
          }
          <li><i class="bi bi-check-circle-fill"></i> مدیریت سرمایه ریاضیاتی از ۱٪ تا ۱۰۰٪</li>
          <li><i class="bi bi-check-circle-fill"></i> پشتیبانی اولویت‌دار اختصاصی</li>
        </ul>

        <button class="btn ${plan.popular ? 'btn-emerald' : 'btn-primary'} btn-sm" onclick="selectPlanToPurchase('${plan.code}')">
          <i class="bi bi-lightning-charge-fill"></i> انتخاب و فعال‌سازی
        </button>
      </div>
    `;
  }).join('');
}

function selectPlanToPurchase(planCode) {
  if (!state.token) {
    showToast('جهت خرید اشتراک ابتدا باید وارد حساب کاربری خود شوید.', 'info');
    openAuthModal('login');
    return;
  }
  const plan = state.pricingPlans.find(p => p.code === planCode);
  if (!plan) return;
  if (window.openBuyPopup) window.openBuyPopup(planCode, state.botAddonActive);
}

// ==================== 4 INSTITUTIONAL FINANCIAL CHARTS (CHART.JS) ====================
const chartInstances = {
  donut: null,
  equity: null,
  histogram: null,
  drawdown: null
};


async function fetchEngineStatus() {
  try {
    const res = await fetch('/api/v1/signals/engine-status');
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success' && data.scanner) {
        const sc = data.scanner;
        const badge = document.getElementById('terminalStatusBadge');
        if (badge) {
          badge.innerText = `STATUS: ${sc.is_running ? 'LIVE' : 'IDLE'} | CYCLE: ${sc.cycle || 0}`;
          badge.style.color = sc.is_running ? '#10B981' : '#F43F5E';
        }
        const tCycles = document.getElementById('terminalTotalCycles');
        if (tCycles) {
          tCycles.innerText = (sc.cycle || 0).toLocaleString('fa-IR');
        }
        // Update the hero badge pill if it exists
        const heroBadge = document.querySelector('.hero-badge-pill span:last-child');
        if (heroBadge && sc.total_markets) {
          heroBadge.innerText = `موتور اسکن و اجرای الگوریتمی فعال بر روی ${sc.total_markets} بازار بلادرنگ`;
        }
      }
    }
  } catch (e) {
    console.error('Engine status fetch failed:', e);
  }
}


// ==================== COUNTDOWN (7-day promotion) ====================
function startCountdown() {
  const timerEl = document.getElementById('countdownTimer');
  if (!timerEl) return;
  // Target: 7 days from page load (marketing countdown)
  const target = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  function tick() {
    const now = new Date();
    const diff = Math.max(0, target - now);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);
    timerEl.innerText = `باقیمانده: ${days} روز ${hours} ساعت ${minutes} دقیقه ${seconds} ثانیه`;
    // Change color to red if less than 24 hours remain
    if (diff < 24 * 60 * 60 * 1000) {
      timerEl.style.color = '#FF4D4F';
      timerEl.style.animation = 'pulse 1s infinite';
    } else {
      timerEl.style.color = '#FFFFFF';
      timerEl.style.animation = 'none';
    }
  }
  tick();
  setInterval(tick, 1000);
}
async function fetchPerformanceAnalytics(timeframe = 'all') {
  state.currentTimeframe = timeframe;
  // Update UI Pills
  document.querySelectorAll('.tf-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tf') === timeframe);
  });

  try {
    const res = await fetch(`/api/v1/signals/performance?timeframe=${timeframe}`);
    if (res.ok) {
      const data = await res.json();
      state.pnlData = data;
      renderKPIValues(data.metrics);

      if ((data.metrics && data.metrics.total_trades === 0) && data.open_positions && data.open_positions.length > 0) {
        // Real live open signals visible for guests — no fake data
        const openTr = data.open_positions;
        const buyCount = openTr.filter(t => t.direction === 'BUY').length;
        const sellCount = openTr.filter(t => t.direction === 'SELL').length;
        renderDonutChart({ data:[buyCount, sellCount], labels:["BUY (فعال)","SELL (فعال)"], colors:["#10B981","#F43F5E"], win_rate: 0 });
        // Cumulative floating equity from open trades
        let cum = 0;
        const equityLive = openTr.map((t, i) => { cum += (t.live_pnl_pct || 0); return { trade_index: i+1, symbol: t.symbol, pnl: t.live_pnl_pct || 0, cumulative_equity: Math.round(cum * 10) / 10 }; });
        
        renderEquityChart(equityLive);
        const liveHist = {
          values: openTr.map(t => (t.live_pnl_pct || 0)),
          labels: openTr.map(t => t.symbol.replace("USDT","").replace("USDC",""))
        };
        renderHistogramChart(liveHist);
        // Drawdown empty state: show 0 line to indicate no historical peak yet
        renderDrawdownChart({ labels:["در حال جمع‌آوری داده"], drawdown_pct:[0] });
      } else {
        renderDonutChart(data.donut_chart);
        renderEquityChart(data.equity_curve);
        renderHistogramChart(data.histogram_chart);
        renderDrawdownChart(data.drawdown_chart);
      }
    }
  } catch (e) {
    console.error('Performance fetch failed:', e);
  }
}

function renderKPIValues(m) {
  if (!m) return;
  const elWin = document.getElementById('metricWinRate');
  const hWin = document.getElementById('heroWinRate');
  const valWin = m.total_trades > 0 ? `${m.win_rate_pct}%` : 'در حال ثبت';
  if (elWin) elWin.innerText = valWin;
  if (hWin) hWin.innerText = valWin;

  const elTotal = document.getElementById('metricTotalTrades');
  if (elTotal) elTotal.innerText = m.total_trades.toLocaleString('en-US');
  
  const elCum = document.getElementById('metricCumPnl');
  const tPnL = document.getElementById('terminalTotalPnL');
  const valPnL = `${m.cumulative_pnl_pct >= 0 ? '+' : ''}${m.cumulative_pnl_pct}%`;
  if (elCum) elCum.innerText = valPnL;
  if (tPnL) tPnL.innerText = valPnL;

  const elPf = document.getElementById('metricProfitFactor');
  const tPf = document.getElementById('terminalProfitFactor');
  if (elPf) elPf.innerText = m.profit_factor;
  if (tPf) tPf.innerText = m.profit_factor;
  const elBest = document.getElementById('metricBestTrade');
  if (elBest) elBest.innerText = m.best_trade_pct != null ? `${m.best_trade_pct >= 0 ? '+' : ''}${m.best_trade_pct}%` : '—';
  const elAvg = document.getElementById('metricAvgTrade');
  if (elAvg) elAvg.innerText = m.avg_trade_pct != null ? `${m.avg_trade_pct >= 0 ? '+' : ''}${m.avg_trade_pct}%` : '—';
}

// 1. Sleek Donut Win Rate Chart
function renderDonutChart(donut) {
  const canvas = document.getElementById('donutChartCanvas');
  if (!canvas || typeof Chart === 'undefined') return;

  const tpVal = (donut && donut.data) ? (donut.data[0] || 0) : 0;
  const slVal = (donut && donut.data) ? (donut.data[1] || 0) : 0;
  const winRate = (donut && donut.win_rate != null)
    ? donut.win_rate
    : ((tpVal + slVal) > 0 ? ((tpVal / (tpVal + slVal)) * 100).toFixed(1) : 0);

  // Update center overlay metric
  const centerValEl = document.getElementById('donutCenterVal');
  if (centerValEl) centerValEl.innerText = `${winRate}%`;

  const tpCountEl = document.getElementById('donutTpCount');
  if (tpCountEl) tpCountEl.innerText = tpVal.toLocaleString('fa-IR');

  const slCountEl = document.getElementById('donutSlCount');
  if (slCountEl) slCountEl.innerText = slVal.toLocaleString('fa-IR');

  if (chartInstances.donut) {
    chartInstances.donut.data.datasets[0].data = [tpVal, slVal];
    chartInstances.donut.update('active');
    return;
  }

  const ctx = canvas.getContext('2d');
  chartInstances.donut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['معاملات سودده (TP)', 'معاملات حد ضرر (SL)'],
      datasets: [{
        data: [tpVal, slVal],
        backgroundColor: ['#10B981', '#F43F5E'],
        hoverBackgroundColor: ['#059669', '#E11D48'],
        borderWidth: 2,
        borderColor: '#FFFFFF',
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '74%',
      plugins: {
        legend: { display: false },
        tooltip: {
          rtl: true,
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          padding: 10,
          cornerRadius: 8,
          bodyFont: { family: 'Vazirmatn', size: 12 },
          callbacks: {
            label: function(ctx) {
              const val = ctx.raw || 0;
              const total = tpVal + slVal;
              const pct = ((val / total) * 100).toFixed(1);
              return ` ${ctx.label}: ${val.toLocaleString('fa-IR')} معامله (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// 2. Cumulative Equity Line Curve (Compound Growth)
function renderEquityChart(curve) {
  const canvas = document.getElementById('equityChartCanvas');
  if (!canvas || typeof Chart === 'undefined') return;

  const points = curve || [];
  if (points.length < 2) return;

  const labels = points.map(p => `معامله ${p.trade_index}`);
  const dataValues = points.map(p => p.cumulative_equity);

  if (chartInstances.equity) {
    chartInstances.equity.data.labels = labels;
    chartInstances.equity.data.datasets[0].data = dataValues;
    chartInstances.equity.update('active');
    return;
  }

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, 'rgba(79, 70, 229, 0.20)');
  gradient.addColorStop(1, 'rgba(79, 70, 229, 0.00)');

  chartInstances.equity = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'رشد تجمعی سرمایه',
        data: dataValues,
        borderColor: '#4F46E5',
        borderWidth: 2.2,
        backgroundColor: gradient,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: '#4F46E5',
        pointHoverBorderColor: '#FFFFFF',
        pointHoverBorderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index'
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          rtl: true,
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          padding: 10,
          cornerRadius: 8,
          titleFont: { family: 'Vazirmatn', size: 11 },
          bodyFont: { family: 'JetBrains Mono', size: 12 },
          callbacks: {
            label: function(ctx) {
              return ` اکوئیتی تجمعی: +${ctx.raw}%`;
            }
          }
        }
      },
      scales: {
        x: {
          display: true,
          grid: { display: false },
          ticks: {
            font: { family: 'JetBrains Mono', size: 9 },
            color: '#94A3B8',
            maxTicksLimit: 6
          }
        },
        y: {
          display: true,
          grid: {
            color: 'rgba(226, 232, 240, 0.6)'
          },
          ticks: {
            font: { family: 'JetBrains Mono', size: 10 },
            color: '#64748B',
            callback: function(v) { return `+${v}%`; }
          }
        }
      }
    }
  });
}

// 3. Periodic PnL Histogram (Return Distribution)
function renderHistogramChart(hist) {
  const canvas = document.getElementById('pnlHistogramCanvas');
  if (!canvas || typeof Chart === 'undefined') return;

  const values = (hist && hist.values) ? hist.values : [];
  const labels = (hist && hist.labels) ? hist.labels : values.map((_, i) => `T${i + 1}`);
  const bgColors = values.map(v => v >= 0 ? '#10B981' : '#F43F5E');

  if (chartInstances.histogram) {
    chartInstances.histogram.data.labels = labels;
    chartInstances.histogram.data.datasets[0].data = values;
    chartInstances.histogram.data.datasets[0].backgroundColor = bgColors;
    chartInstances.histogram.update('active');
    return;
  }

  const ctx = canvas.getContext('2d');
  chartInstances.histogram = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'بازدهی معامله (%)',
        data: values,
        backgroundColor: bgColors,
        borderRadius: 4,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          rtl: true,
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          padding: 8,
          cornerRadius: 8,
          bodyFont: { family: 'JetBrains Mono', size: 11 },
          callbacks: {
            label: function(ctx) {
              const v = ctx.raw;
              return ` سود/زیان: ${v > 0 ? '+' : ''}${v}%`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: 'JetBrains Mono', size: 9 },
            color: '#94A3B8',
            maxTicksLimit: 8
          }
        },
        y: {
          grid: { color: 'rgba(226, 232, 240, 0.6)' },
          ticks: {
            font: { family: 'JetBrains Mono', size: 10 },
            color: '#64748B',
            callback: function(v) { return `${v > 0 ? '+' : ''}${v}%`; }
          }
        }
      }
    }
  });
}

// 4. Max Drawdown & Risk Containment (Ceiling < 4.2%)
function renderDrawdownChart(dd) {
  const canvas = document.getElementById('drawdownChartCanvas');
  if (!canvas || typeof Chart === 'undefined') return;

  const values = (dd && dd.drawdown_pct) ? dd.drawdown_pct : [];
  const labels = (dd && dd.labels) ? dd.labels : values.map((_, i) => `P${i + 1}`);

  if (chartInstances.drawdown) {
    chartInstances.drawdown.data.labels = labels;
    chartInstances.drawdown.data.datasets[0].data = values;
    chartInstances.drawdown.update('active');
    return;
  }

  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, 'rgba(245, 158, 11, 0.0)');
  gradient.addColorStop(1, 'rgba(245, 158, 11, 0.18)');

  chartInstances.drawdown = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'میزان افت از سقف (Drawdown %)',
        data: values,
        borderColor: '#F59E0B',
        borderWidth: 2,
        backgroundColor: gradient,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: '#F59E0B'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          rtl: true,
          backgroundColor: 'rgba(15, 23, 42, 0.92)',
          padding: 8,
          cornerRadius: 8,
          bodyFont: { family: 'JetBrains Mono', size: 11 },
          callbacks: {
            label: function(ctx) { return ` افت از سقف: ${ctx.raw}%`; }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: 'JetBrains Mono', size: 9 },
            color: '#94A3B8',
            maxTicksLimit: 6
          }
        },
        y: {
          min: -5,
          max: 0,
          grid: { color: 'rgba(226, 232, 240, 0.6)' },
          ticks: {
            font: { family: 'JetBrains Mono', size: 10 },
            color: '#64748B',
            callback: function(v) { return `${v}%`; }
          }
        }
      }
    }
  });
}

// ==================== DASHBOARD VIEW & GATED ACCESS ====================
function showDashboardView() {
  if (!state.token) {
    openAuthModal('login');
    return;
  }
  const dashEl = document.getElementById('dashboardSection');
  if (dashEl) {
    dashEl.classList.add('active');
    dashEl.scrollIntoView({ behavior: 'smooth' });
    renderDashboardAccessState();
    refreshTelegramCard();
  }
}

function renderDashboardAccessState() {
  const lockEl = document.getElementById('dashboardLockScreen');
  const unlockedEl = document.getElementById('dashboardUnlockedContent');

  const hasSub = state.subscription && state.subscription.payment_status === 'active';

  if (!hasSub) {
    if (lockEl) lockEl.style.display = 'block';
    if (unlockedEl) unlockedEl.style.display = 'none';
  } else {
    if (lockEl) lockEl.style.display = 'none';
    if (unlockedEl) unlockedEl.style.display = 'block';
    fetchSubscribedSignalsFeed();
    fetchUserTradingSettings();
  }
}

async function fetchSubscribedSignalsFeed() {
  if (!state.token) return;
  try {
    const res = await fetch('/api/v1/signals/live?limit=15', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (res.ok) {
      const data = await res.json();
      const container = document.getElementById('unlockedSignalsTableBody');
      if (container && data.signals) {
        container.innerHTML = data.signals.map(s => `
          <tr>
            <td>${symLogoImg(s.symbol)}<span class="mono font-bold">${s.symbol}</span></td>
            <td><span class="badge-direction ${s.direction === 'BUY' ? 'badge-buy' : 'badge-sell'}">${s.direction}</span></td>
            <td class="mono">${s.entry_price}</td>
            <td class="mono" style="color: var(--profit-emerald);">${s.tp_price} (+${s.tp_pct}%)</td>
            <td class="mono" style="color: var(--loss-rose);">${s.sl_price} (-${s.sl_pct}%)</td>
            <td class="mono ${s.live_pnl_pct >= 0 ? 'text-emerald' : 'text-rose'}">${s.live_pnl_pct > 0 ? '+' : ''}${s.live_pnl_pct}%</td>
            <td><span style="font-size: 0.75rem; background: var(--canvas-subtle); padding: 2px 8px; border-radius: 4px;">${s.verification_note}</span></td>
          </tr>
        `).join('');
      }
    }
  } catch (e) {
    console.error('Signals fetch error:', e);
  }
}

async function fetchUserTradingSettings() {
  if (!state.token) return;
  try {
    const res = await fetch('/api/v1/trading/settings', {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (res.ok) {
      const data = await res.json();
      const slider = document.getElementById('capitalPctSlider');
      const valDisp = document.getElementById('capitalPctDisplay');
      if (slider && valDisp) {
        slider.value = data.settings.capital_allocation_pct || 1;
        valDisp.innerText = `${slider.value}%`;
      }
    }
  } catch (e) {}
}

async function updateCapitalAllocation(pct) {
  const valDisp = document.getElementById('capitalPctDisplay');
  if (valDisp) valDisp.innerText = `${pct}%`;

  if (!state.token) return;
  try {
    await fetch('/api/v1/trading/set-capital-pct', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ capital_allocation_pct: parseFloat(pct) })
    });
    showToast(`تخصیص سرمایه برای هر معامله به ${pct}% تغییر یافت.`, 'info');
  } catch (e) {}
}

async function triggerPanicKillSwitch() {
  if (!confirm('آیا از توقف اضطراری و بستن تمامی پوزیشن‌های باز در ۱۸ صرافی اطمینان دارید؟')) return;
  showToast('در حال بستن تمامی پوزیشن‌ها...', 'info');
  try {
    const res = await fetch('/api/v1/trading/panic-close-all', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (res.ok) {
      showToast('دستور توقف اضطراری اجرا گردید. تمامی پوزیشن‌ها بسته شدند.', 'success');
    }
  } catch (e) {
    showToast('خطا در اجرای توقف اضطراری', 'error');
  }
}

// ==================== SUPPORT & CONTACT FORM ====================
async function handleSupportMessageSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('contactName').value.trim();
  const email = document.getElementById('contactEmail').value.trim();
  const subject = document.getElementById('contactSubject').value.trim();
  const message = document.getElementById('contactMessage').value.trim();

  if (!email || !message) {
    showToast('لطفاً ایمیل و متن پیام خود را وارد فرمایید.', 'error');
    return;
  }

  showToast('در حال ارسال پیام به واحد پشتیبانی...', 'info');
  try {
    const res = await fetch('/api/v1/support/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender_email: email,
        sender_name: name || email.split('@')[0],
        subject: subject || 'درخواست راهنمایی در سامانه IBO-TS',
        message: message
      })
    });
    if (res.ok) {
      showToast('پیام شما با موفقیت به support@ibo-ts.com ارسال شد. همکاران ما به زودی پاسخ خواهند داد.', 'success');
      e.target.reset();
    } else {
      showToast('خطا در ارسال پیام به پشتیبانی', 'error');
    }
  } catch (e) {
    showToast('خطای ارتباط با سرور', 'error');
  }
}

// ==================== FAQ ACCORDION ====================
function initFAQAccordion() {
  document.querySelectorAll('.faq-question-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const parent = btn.parentElement;
      const isOpen = parent.classList.contains('active');
      document.querySelectorAll('.faq-item').forEach(item => item.classList.remove('active'));
      if (!isOpen) parent.classList.add('active');
    });
  });
}

// ==================== TOAST NOTIFIER ====================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="bi ${type === 'success' ? 'bi-check-circle-fill' : (type === 'error' ? 'bi-exclamation-octagon-fill' : 'bi-info-circle-fill')}"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4200);
}

function createToastContainer() {
  const c = document.createElement('div');
  c.id = 'toast-container';
  document.body.appendChild(c);
  return c;
}

// ==================== MOBILE NAVIGATION DRAWER ====================
function toggleMobileNav() {
  const drawer = document.getElementById('mobileNavDrawer');
  const backdrop = document.getElementById('mobileDrawerBackdrop');
  if (drawer && backdrop) {
    const isOpen = drawer.classList.contains('open');
    if (isOpen) {
      drawer.classList.remove('open');
      backdrop.classList.remove('open');
    } else {
      drawer.classList.add('open');
      backdrop.classList.add('open');
    }
  }
}

function closeMobileNav() {
  const drawer = document.getElementById('mobileNavDrawer');
  const backdrop = document.getElementById('mobileDrawerBackdrop');
  if (drawer) drawer.classList.remove('open');
  if (backdrop) backdrop.classList.remove('open');
}

// ==================== PWA INSTALL PROMPT ====================
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const pwaBtn = document.getElementById('pwaInstallBtn');
  if (pwaBtn) pwaBtn.style.display = 'inline-flex';
});

function triggerPwaInstall() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((choice) => {
      if (choice.outcome === 'accepted') {
        showToast('وب‌اپلیکیشن IBO-TS با موفقیت روی دستگاه شما نصب گردید.', 'success');
      }
      deferredInstallPrompt = null;
    });
  } else {
    showToast('جهت نصب وب‌اپلیکیشن، از منوی مرورگر خود گزینه Add to Home Screen را انتخاب فرمایید.', 'info');
  }
}

// Window Resize Handler with Chart.js Responsive Resizing
window.addEventListener('resize', () => {
  Object.values(chartInstances).forEach(chart => {
    if (chart && typeof chart.resize === 'function') {
      chart.resize();
    }
  });
});

