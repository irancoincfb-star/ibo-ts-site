/* IBO-TS premium purchase popup (shared: index + /pricing).
   Flow: 1) method tiles (کافه‌بازار / مایکت / ارز دیجیتال) with official logos
         2) bot-add-on pills (بله + قیمت افزوده / خیر فقط سیگنال) — price recalcs live
         3) crypto: 3 wallets with official network logos (TRON/BNB/TON) + USDT,
            live Toman conversion, copy, TxID → POST /subscriptions/crypto-verify.
   Live USDT→Toman: /api/v1/market/usdt-rate (wallex orderbook), 60s refresh. */
(function () {
  'use strict';
  if (window.__IBO_PURCHASE_LOADED) return;
  window.__IBO_PURCHASE_LOADED = true;

  const S = {
    plans: [], wallets: {}, rate: 0, plan: null, addon: false,
    method: null, network: 'USDT_TRC20', open: false, poll: null
  };

  /* ── official brand marks (self-hosted assets; never re-draw a brand) ──
     bazaar: webassets.cafebazaar.ir/images/home/logo.png
     myket:  myket.ir/core/images/logo/favicon/android-icon-192x192.png
     tron/bnb/ton: trustwallet/assets canonical marks
     usdt:   Tether official mark (existing symbols asset) */
  const brandImg = (src, size) =>
    '<img src="' + src + '" width="' + size + '" height="' + size + '" alt="" aria-hidden="true" draggable="false" ' +
    'style="display:block;flex:0 0 auto;object-fit:contain;" decoding="async">';
  const LOGO = {
    bazaar: brandImg('/static/assets/logos/bazaar.png', 32),
    myket:  brandImg('/static/assets/logos/myket.png', 32),
    crypto: brandImg('/static/assets/logos/usdt.png', 32),
    tron:   brandImg('/static/assets/logos/tron.png', 36),
    bnb:    brandImg('/static/assets/logos/bnb.png', 36),
    ton:    brandImg('/static/assets/logos/ton.png', 36),
    usdt:   brandImg('/static/assets/logos/usdt.png', 22)
  };

  const NETWORK_INFO = {
    USDT_TRC20: { logo: LOGO.tron, title: 'شبکه ترون (TRC-20)', sub: 'USDT روی شبکه TRON — کمترین کارمزد' },
    USDT_BEP20: { logo: LOGO.bnb,  title: 'شبکه BNB (BEP-20)',  sub: 'USDT روی زنجیره هوشمند BNB' },
    USDT_TON:   { logo: LOGO.ton,  title: 'شبکه TON',           sub: 'USDT روی The Open Network' }
  };
  const METHOD_INFO = {
    bazaar: { logo: LOGO.bazaar, title: 'پرداخت با درگاه کافه‌بازار', sub: 'کارت‌به‌کارت ریالی + درگاه امن بازار' },
    myket:  { logo: LOGO.myket,  title: 'پرداخت با درگاه مایکت',      sub: 'درگاه پرداخت امن مایکت' },
    crypto: { logo: LOGO.crypto, title: 'پرداخت با ارز دیجیتال',      sub: 'USDT (TRC20 / BEP20 / TON)' }
  };

  const fa = n => Number(n || 0).toLocaleString('en-US');
  const usdtF = n => '$' + (Math.round((Number(n) || 0) * 100) / 100);

  /* ── native market detection (Myket APK) ──
     Inside the Myket build ONLY Myket IAB may be offered (store policy).
     The native bridge exposes IboApp.getMarket() → "myket". */
  function nativeMarket() {
    try { return (window.IboApp && window.IboApp.getMarket) ? (IboApp.getMarket() || '') : ''; }
    catch (e) { return ''; }
  }
  const MARKET = nativeMarket();
  const IN_MYKET_APP = MARKET === 'myket';
  if (IN_MYKET_APP) document.documentElement.classList.add('ibots-myket');
  const skuFor = (planCode, addon) => 'ibo_plan_' + planCode + (addon ? '_bot' : '');
  const planFromSku = sku => {
    const m = /^ibo_plan_([a-z0-9]+)(_bot)?$/i.exec(sku || '');
    return m ? { code: m[1], addon: !!m[2] } : null;
  };
  let storePrice = '';
  const myketPrices = {};

  /* ── toast (standalone; parallels app.js showToast visuals) ── */
  function toast(msg, kind) {
    let c = document.getElementById('iboToastBox2');
    if (!c) {
      c = document.createElement('div');
      c.id = 'iboToastBox2';
      c.style.cssText = 'position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:4000;display:flex;flex-direction:column;gap:8px;align-items:center;';
      document.body.appendChild(c);
    }
    const t = document.createElement('div');
    t.style.cssText = 'background:#0F172A;color:#fff;padding:.8rem 1.2rem;border-radius:12px;font-size:.88rem;font-weight:700;' +
      'box-shadow:0 12px 30px -10px rgba(0,0,0,.5);max-width:min(92vw,480px);text-align:center;' +
      (kind === 'error' ? 'border:1.5px solid #E11D48;' : kind === 'success' ? 'border:1.5px solid #10B981;' : 'border:1.5px solid #4F46E5;');
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; setTimeout(function () { t.remove(); }, 420); }, 3600);
  }

  /* ── data ── */
  async function ensureData() {
    if (S.plans.length) return;
    try {
      const r = await fetch('/api/v1/subscriptions/plans');
      const d = await r.json();
      if (d && d.status === 'success') {
        S.plans = d.plans || [];
        S.wallets = d.deposit_wallets || {};
      }
    } catch (e) { toast('دریافت اطلاعات پلن‌ها ناموفق بود؛ اتصال را چک کنید.', 'error'); }
  }
  async function ensureRate() {
    try {
      const r = await fetch('/api/v1/market/usdt-rate');
      const d = await r.json();
      if (d && d.usdt_toman > 0) S.rate = d.usdt_toman;
    } catch (e) { /* keep last known rate */ }
  }
  const usdtTotal = () => (Number(S.plan.base_price_usdt) || 0) + (S.addon ? (Number(S.plan.bot_addon_price_usdt) || 0) : 0);
  const tomanOf = u => S.rate ? Math.round(u * S.rate) : null;

  function fmtToman(n) {
    if (n === null) return 'با استعلام نرخ لحظه‌ای';
    return fa(n) + ' تومان';
  }

  /* ── DOM ── */
  let MODAL = null;
  function buildDom() {
    MODAL = document.createElement('div');
    MODAL.id = 'iboBuyModal';
    MODAL.style.cssText = 'position:fixed;inset:0;z-index:2400;display:none;align-items:center;justify-content:center;padding:1rem;background:rgba(15,23,42,.65);';
    MODAL.innerHTML =
      '<div style="background:#fff;border-radius:22px;max-width:560px;width:100%;max-height:92vh;overflow-y:auto;position:relative;box-shadow:0 30px 70px -20px rgba(0,0,0,.45);">' +
        '<button id="pumClose" style="position:absolute;top:14px;inset-inline-start:14px;border:0;background:rgba(248,250,252,1);width:34px;height:34px;border-radius:10px;font-size:1.2rem;cursor:pointer;color:#64748B;">&times;</button>' +
        '<div style="padding:1.5rem 1.4rem 1.5rem;">' +
          '<div style="display:flex;align-items:center;gap:.7rem;margin-bottom:.4rem;">' +
            '<img src="/static/assets/ibots_logo_transparent.png" style="height:40px;" alt="IBO-TS">' +
            '<div><h3 id="pumPlanTitle" style="margin:0;font-size:1.05rem;font-weight:900;">—</h3>' +
            '<div style="font-size:.74rem;color:#64748B;">فعال‌سازی اشتراک رسمی سامانه IBO-TS</div></div>' +
          '</div>' +
          '<div style="background:#F8FAFC;border:1.5px solid #E2E8F0;border-radius:14px;padding:1rem;margin:0.9rem 0;text-align:center;">' +
            '<div style="font-size:.74rem;color:#64748B;">مبلغ قابل پرداخت:</div>' +
            '<div id="pumUsdt" class="mono" style="font-size:1.7rem;font-weight:900;color:#0F172A;">—</div>' +
            '<div id="pumToman" style="font-size:.9rem;font-weight:800;color:#10B981;margin-top:2px;">—</div>' +
          '</div>' +
          '<div id="pumSlot"></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(MODAL);
    MODAL.addEventListener('click', function (e) { if (e.target === MODAL) close(); });
    document.getElementById('pumClose').onclick = close;
  }

  function totalsRefresh() {
    const usd = document.getElementById('pumUsdt');
    const rial = document.getElementById('pumToman');
    if (IN_MYKET_APP) {
      usd.textContent = storePrice || '—';
      rial.textContent = storePrice ? 'قیمت رسمی درگاه مایکت' : 'قیمت نهایی در پنجره پرداخت مایکت نمایش داده می‌شود';
    } else {
      const u = usdtTotal();
      usd.textContent = usdtF(u);
      rial.textContent = '≈ ' + fmtToman(tomanOf(u));
    }
    const warn = document.getElementById('pumAddonNote');
    if (warn) warn.textContent = S.addon ? (IN_MYKET_APP ? 'قیمت نسخه با ربات در درگاه مایکت نمایش داده می‌شود' : 'شامل افزونه ربات: +' + usdtF(S.plan.bot_addon_price_usdt)) : '';
  }

  function addonPills() {
    return '' +
      '<div style="margin:.4rem 0 1rem;">' +
        '<div style="font-size:.8rem;font-weight:800;color:#0F172A;margin-bottom:.4rem;">افزودن ربات معامله‌گر خودکار؟</div>' +
        '<div style="display:flex;gap:.6rem;">' +
          '<button id="pumAddonNo"  style="flex:1;padding:.7rem;border-radius:12px;border:1.5px solid #E2E8F0;background:#fff;font-weight:800;cursor:pointer;">خیر — فقط سیگنال</button>' +
          '<button id="pumAddonYes" style="flex:1;padding:.7rem;border-radius:12px;border:1.5px solid #E2E8F0;background:#fff;font-weight:800;cursor:pointer;">' + (IN_MYKET_APP ? 'بله (با ربات معامله‌گر)' : 'بله (+$' + (S.plan.bot_addon_price_usdt || 0) + ')') + '</button>' +
        '</div>' +
        '<div id="pumAddonNote" style="font-size:.72rem;color:#4F46E5;margin-top:.45rem;font-weight:700;"></div>' +
      '</div>';
  }

  function setStep1() {
    S.method = null;
    storePrice = '';
    let methods;
    if (IN_MYKET_APP) {
      // APK: all three gateways available (Myket IAB + Bazaar store + Crypto wallet)
      methods =
        '<div style="font-size:.78rem;color:#64748B;margin-bottom:.55rem;">' +
        'خرید اشتراک در اپ: مایکت، بازار یا پرداخت ارز دیجیتال' +
        '</div>' +
        '<button class="pum-method" data-m="bazaar" style="display:flex;align-items:center;gap:.9rem;padding:1rem;border-radius:14px;border:1.5px solid #E2E8F0;background:#fff;cursor:pointer;text-align:start;">' +
        LOGO.bazaar + '<span><b style="display:block;">' + METHOD_INFO.bazaar.title + '</b><small style="color:#64748B;">' + METHOD_INFO.bazaar.sub + '</small></span></button>' +
        '<button class="pum-method" data-m="myket" style="display:flex;align-items:center;gap:.9rem;padding:1rem;border-radius:14px;border:1.5px solid #E2E8F0;background:#fff;cursor:pointer;text-align:start;">' +
        LOGO.myket + '<span><b style="display:block;">' + METHOD_INFO.myket.title + '</b><small style="color:#64748B;">' + METHOD_INFO.myket.sub + '</small></span></button>' +
        '<button class="pum-method" data-m="crypto" style="display:flex;align-items:center;gap:.9rem;padding:1rem;border-radius:14px;border:1.5px solid #E2E8F0;background:#fff;cursor:pointer;text-align:start;">' +
        LOGO.crypto + '<span><b style="display:block;">' + METHOD_INFO.crypto.title + '</b><small style="color:#64748B;">' + METHOD_INFO.crypto.sub + '</small></span></button>';
    } else {
      methods =
        '<button class="pum-method" data-m="bazaar" style="display:flex;align-items:center;gap:.9rem;padding:1rem;border-radius:14px;border:1.5px solid #E2E8F0;background:#fff;cursor:pointer;text-align:start;">' +
          LOGO.bazaar + '<span><b style="display:block;">' + METHOD_INFO.bazaar.title + '</b><small style="color:#64748B;">' + METHOD_INFO.bazaar.sub + '</small></span></button>' +
        '<button class="pum-method" data-m="myket"  style="display:flex;align-items:center;gap:.9rem;padding:1rem;border-radius:14px;border:1.5px solid #E2E8F0;background:#fff;cursor:pointer;text-align:start;">' +
          LOGO.myket + '<span><b style="display:block;">' + METHOD_INFO.myket.title + '</b><small style="color:#64748B;">' + METHOD_INFO.myket.sub + '</small></span></button>' +
        '<button class="pum-method" data-m="crypto" style="display:flex;align-items:center;gap:.9rem;padding:1rem;border-radius:14px;border:1.5px solid #E2E8F0;background:#fff;cursor:pointer;text-align:start;">' +
          LOGO.crypto + '<span><b style="display:block;">' + METHOD_INFO.crypto.title + '</b><small style="color:#64748B;">' + METHOD_INFO.crypto.sub + '</small></span></button>';
    }
    document.getElementById('pumSlot').innerHTML = '' +
      addonPills() +
      '<div style="font-size:.8rem;font-weight:800;color:#0F172A;margin-bottom:.5rem;">روش پرداخت را انتخاب کنید:</div>' +
      '<div style="display:grid;gap:.7rem;">' + methods + '</div>';

    document.getElementById('pumSlot').querySelectorAll('.pum-method').forEach(function (b) {
      b.onclick = function () { pickMethod(b.getAttribute('data-m')); };
    });
    document.getElementById('pumAddonNo').onclick = function () { S.addon = false; markAddon(); totalsRefresh(); refreshStorePrice(); };
    document.getElementById('pumAddonYes').onclick = function () { S.addon = true; markAddon(); totalsRefresh(); refreshStorePrice(); };
    markAddon();
    totalsRefresh();
    if (IN_MYKET_APP) refreshStorePrice();
  }

  function refreshStorePrice() {
    storePrice = '';
    const el = document.getElementById('pumStorePrice');
    if (el) el.textContent = '';
    try {
      if (window.IboApp && IboApp.getMyketProduct && S.plan) {
        IboApp.getMyketProduct(skuFor(S.plan.code, S.addon));
      }
    } catch (e) { /* bridge unavailable (web) */ }
  }

  function markAddon() {
    const y = document.getElementById('pumAddonYes'), no = document.getElementById('pumAddonNo');
    if (!y || !no) return;
    y.style.background = S.addon ? 'linear-gradient(135deg,#4F46E5,#2563EB)' : '#fff';
    y.style.color = S.addon ? '#fff' : '#0F172A';
    y.style.border = S.addon ? '1.5px solid #4F46E5' : '1.5px solid #E2E8F0';
    no.style.background = S.addon ? '#fff' : 'linear-gradient(135deg,#4F46E5,#2563EB)';
    no.style.color = S.addon ? '#0F172A' : '#fff';
    no.style.border = S.addon ? '1.5px solid #E2E8F0' : '1.5px solid #4F46E5';
  }

  function pickMethod(m) {
    S.method = m;
    if (m === 'crypto') { setStepCrypto(); return; }
    if (m === 'myket' && IN_MYKET_APP) { startMyketFlow(); return; }
    // Store gateways on the website: only REAL product links; no fake destinations.
    const links = window.__IBO_APP_LINKS || {};
    const url = links[m];
    if (url && /^https:\/\//.test(url)) { window.open(url, '_blank'); setStep1(); return; }
    const label = m === 'bazaar' ? 'کافه‌بازار' : 'مایکت';
    toast('پرداخت با درگاه ' + label + ' به‌زودی فعال می‌شود؛ در این لحظه از روش ارز دیجیتال استفاده کنید.', 'info');
  }

  async function startMyketFlow() {
    const auth = (function () { try { return localStorage.getItem('ibots_token'); } catch (e) { return null; } })();
    if (!auth) {
      toast('برای خرید اشتراک ابتدا وارد حساب کاربری شوید.', 'error');
      location.href = '/#login';
      return;
    }
    if (!window.IboApp || !IboApp.startMyketPurchase) {
      toast('درگاه مایکت در این نسخه در دسترس نیست؛ لطفاً از آخرین نسخه اپ استفاده کنید.', 'error');
      return;
    }
    const sku = skuFor(S.plan.code, S.addon);
    const payload = JSON.stringify({ plan_code: S.plan.code, has_bot_addon: S.addon, sku_id: sku });
    try {
      IboApp.startMyketPurchase(sku, payload);
      toast('در حال باز کردن درگاه پرداخت مایکت…', 'info');
    } catch (e) {
      toast('آغاز خرید مایکت ناموفق بود؛ دوباره تلاش کنید.', 'error');
    }
  }

  async function verifyMyketPurchase(purchaseToken, planCode, addon, sku, silent) {
    const auth = (function () { try { return localStorage.getItem('ibots_token'); } catch (e) { return null; } })();
    if (!auth) { if (!silent) location.href = '/#login'; return; }
    try {
      const r = await fetch('/api/v1/subscriptions/store-verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + auth },
        body: JSON.stringify({
          plan_code: planCode,
          store: 'myket',
          purchase_token: purchaseToken,
          has_bot_addon: !!addon,
          sku_id: sku
        })
      });
      const d = await r.json().catch(function () { return {}; });
      if (r.ok && d && (d.status === 'success' || d.success === true)) {
        toast('✓ خرید مایکت تأیید و اشتراک فعال شد.', 'success');
        close();
        if (window.fetchCurrentSubscription) window.fetchCurrentSubscription();
      } else if (r.status === 400 && /قبلاً/.test(JSON.stringify(d))) {
        toast('این خرید قبلاً فعال شده است.', 'info');
        close();
      } else if (r.status === 401) {
        toast('نشست شما منقضی شده؛ دوباره وارد شوید.', 'error');
        location.href = '/#login';
      } else if (r.status === 503) {
        toast('راستی‌آزمایی مایکت موقتاً در دسترس نیست؛ چند دقیقه بعد تلاش کنید.', 'error');
      } else {
        if (!silent) toast((d && (d.message || d.detail)) || 'خرید مایکت قابل تأیید نبود؛ با پشتیبانی تماس بگیرید.', 'error');
      }
    } catch (e) {
      if (!silent) toast('ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید.', 'error');
    }
  }

  function setStepCrypto() {
    const nets = Object.keys(S.wallets || {});
    document.getElementById('pumSlot').innerHTML = '' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.6rem;">' +
        '<b style="font-size:.86rem;">انتخاب شبکه و کیف‌پول واریز:</b>' +
        '<a href="#" onclick="pumBack()" style="font-size:.76rem;color:#4F46E5;font-weight:800;">بازگشت</a>' +
      '</div>' +
      '<div style="display:grid;gap:.6rem;">' +
        nets.map(function (k) {
          const info = NETWORK_INFO[k] || { logo: LOGO.usdt, title: k, sub: '' };
          return '<button class="pum-net" data-n="' + k + '" style="display:flex;align-items:center;gap:.8rem;padding:.85rem;border-radius:14px;border:1.5px solid #E2E8F0;background:#fff;cursor:pointer;text-align:start;">' +
            info.logo + '<span><b style="display:block;font-size:.85rem;">' + info.title + '</b><small style="color:#64748B;">' + info.sub + '</small></span></button>';
        }).join('') +
      '</div>' +
      '<div id="pumNetDetail" style="margin-top:.9rem;"></div>';

    document.getElementById('pumSlot').querySelectorAll('.pum-net').forEach(function (b) {
      b.onclick = function () { S.network = b.getAttribute('data-n'); renderNetDetail(); };
    });
    renderNetDetail();
  }

  function renderNetDetail() {
    const info = NETWORK_INFO[S.network] || { logo: LOGO.usdt, title: S.network, sub: '' };
    const addr = S.wallets[S.network] || 'آدرس در دسترس نیست — با پشتیبانی تماس بگیرید.';
    document.getElementById('pumNetDetail').innerHTML = '' +
      '<div style="display:flex;align-items:center;gap:.7rem;background:#F8FAFC;border:1.5px solid #E2E8F0;border-radius:14px;padding:.8rem;margin-bottom:.7rem;">' +
        info.logo +
        '<div style="flex:1;direction:ltr;font-size:.78rem;word-break:break-all;font-weight:700;color:#0F172A;">' + addr + '</div>' +
        '<button id="pumCopy" style="border:1.5px solid #E2E8F0;background:#fff;border-radius:10px;padding:.4rem .7rem;font-size:.75rem;font-weight:800;cursor:pointer;">کپی</button>' +
      '</div>' +
      '<div style="font-size:.72rem;color:#64748B;text-align:center;margin-bottom:.7rem;">' +
        'دقیقاً ' + usdtF(usdtTotal()) + ' USDT را روی همین شبکه واریز کنید. مبلغ ' + fmtToman(tomanOf(usdtTotal())) + '' +
      '</div>' +
      '<input id="pumTx" placeholder="TxID / Hash تراکنش واریزی" style="width:100%;padding:.85rem;border-radius:14px;border:1.5px solid #E2E8F0;font-size:.85rem;direction:ltr;font-family:monospace;">' +
      '<button id="pumSend" style="width:100%;margin-top:.7rem;padding:.9rem;border-radius:14px;border:0;background:linear-gradient(135deg,#10B981,#059669);color:#fff;font-weight:900;font-size:.95rem;cursor:pointer;">ثبت و راستی‌آزمایی واریز</button>';
    document.getElementById('pumCopy').onclick = function () {
      try { navigator.clipboard.writeText(addr); toast('آدرس کپی شد.', 'success'); } catch (e) {}
    };
    document.getElementById('pumSend').onclick = submitCrypto;
  }

  async function submitCrypto() {
    const txEl = document.getElementById('pumTx');
    const t = (txEl.value || '').trim();
    if (!t || t.length < 16) { toast('TxID واریز را کامل و صحیح وارد کنید.', 'error'); return; }
    const token = (function () { try { return localStorage.getItem('ibots_token'); } catch (e) { return null; } })();
    if (!token) {
      toast('برای ثبت تراکنش ابتدا وارد حساب کاربری شوید.', 'error');
      location.href = '/#login';
      return;
    }
    const btn = document.getElementById('pumSend');
    btn.disabled = true; btn.style.opacity = .65; btn.textContent = 'در حال بررسی تراکنش در بلاک‌چین…';
    try {
      const r = await fetch('/api/v1/subscriptions/crypto-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ plan_code: S.plan.code, has_bot_addon: S.addon, network: S.network, tx_hash: t })
      });
      const d = await r.json();
      if (r.ok && d && d.status === 'success') {
        toast('✓ تراکنش تأیید و اشتراک فعال شد.', 'success');
        close();
        if (window.fetchCurrentSubscription) window.fetchCurrentSubscription();
      } else if (r.status === 401) {
        toast('نشست شما منقضی شده؛ دوباره وارد شوید.', 'error'); location.href = '/#login';
      } else if (r.status === 404) {
        toast('پلن اشتراک یافت نشد؛ دوباره تلاش کنید.', 'error');
      } else {
        toast((d && (d.message || d.detail)) || 'تراکنش قابل تأیید نبود؛ دوباره تلاش کنید یا با پشتیبانی تماس بگیرید.', 'error');
      }
    } catch (e) {
      toast('ارتباط با سرور برقرار نشد؛ دوباره تلاش کنید.', 'error');
    }
    btn.disabled = false; btn.style.opacity = 1; btn.textContent = 'ثبت و راستی‌آزمایی واریز';
  }

  function setPlanByCode(code) {
    S.plan = S.plans.find(function (p) { return p.code === code; });
  }

  function paintPlan() {
    document.getElementById('pumPlanTitle').textContent =
      (S.plan ? S.plan.title_fa : '—') + ' (' + (S.plan ? S.plan.duration_days : '—') + ' روزه)';
  }

  window.pumBack = function () { setStep1(); };
  function open() {
    if (!MODAL) buildDom();
    MODAL.style.display = 'flex';
    S.open = true;
  }
  function close() {
    if (MODAL) MODAL.style.display = 'none';
    S.open = false;
  }

  /* API used by both pages' plan buttons */
  window.openBuyPopup = async function (code, botAddon) {
    await ensureData();
    setPlanByCode(code);
    if (!S.plan) { toast('پلن موردنظر یافت نشد؛ دوباره تلاش کنید.', 'error'); return; }
    S.addon = !!botAddon;
    open();            // builds the modal DOM on first use
    paintPlan();
    setStep1();
    await ensureRate();
    totalsRefresh();
  };

  /* ── native Myket callbacks (native bridge → JS) ── */
  window.onMyketProduct = function (info) {
    if (!info || !info.productId) return;
    const sku = info.productId;
    const cardPrice = document.querySelector('.mk-price[data-sku="' + sku + '"]');
    if (info.ok && info.price) {
      myketPrices[sku] = info.price;
      if (cardPrice) cardPrice.textContent = 'قیمت مایکت: ' + info.price;
    } else if (cardPrice && !myketPrices[sku]) {
      cardPrice.textContent = 'قیمت نهایی در پنجره پرداخت مایکت نمایش داده می‌شود';
    }
    if (!S.plan) return;
    if (sku === skuFor(S.plan.code, S.addon)) {
      storePrice = info.ok ? (info.price || '') : '';
      const el = document.getElementById('pumStorePrice');
      if (el) el.textContent = storePrice ? 'قیمت درگاه مایکت: ' + storePrice : '';
      totalsRefresh();
    }
  };

  window.iboRequestMyketPrices = async function () {
    if (!IN_MYKET_APP) return;
    await ensureData();
    (S.plans || []).forEach(function (p) {
      try { IboApp.getMyketProduct(skuFor(p.code, false)); } catch (e) {}
    });
  };

  window.onMyketPurchaseResult = function (res) {
    if (!res) return;
    if (!res.ok) {
      if (res.code === 1) return;                       // user canceled
      if (res.code === 7) {                              // already owned → recover it
        try { IboApp.syncMyketPurchases(); } catch (e) {}
        return;
      }
      toast('خرید مایکت انجام نشد (کد ' + (res.code || '—') + ').', 'error');
      return;
    }
    let planCode = S.plan ? S.plan.code : null;
    let addon = S.addon;
    try {
      const p = JSON.parse(res.developerPayload || '{}');
      if (p.plan_code) planCode = p.plan_code;
      if (typeof p.has_bot_addon === 'boolean') addon = p.has_bot_addon;
    } catch (e) { /* fall back to SKU mapping */ }
    if (!planCode) {
      const mapped = planFromSku(res.productId);
      if (mapped) { planCode = mapped.code; addon = mapped.addon; }
    }
    if (!planCode || !res.purchaseToken) {
      toast('اطلاعات خرید ناقص است؛ با پشتیبانی تماس بگیرید.', 'error');
      return;
    }
    verifyMyketPurchase(res.purchaseToken, planCode, addon, res.productId);
  };

  window.onMyketPendingPurchases = function (list) {
    if (!Array.isArray(list) || !list.length) return;
    list.forEach(function (p) {
      const mapped = planFromSku(p && p.productId);
      if (!mapped || !p.purchaseToken) return;
      verifyMyketPurchase(p.purchaseToken, mapped.code, mapped.addon, p.productId, true);
    });
  };

  /* keep toman fresh while the popup is open (60s), mirrors engine cadence */
  setInterval(async function () {
    if (!S.open) return;
    const had = S.rate;
    await ensureRate();
    if (S.rate && S.rate !== had) totalsRefresh();
  }, 60000);
})();
