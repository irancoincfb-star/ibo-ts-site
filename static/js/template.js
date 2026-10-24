/* IBO-TS shared page chrome: identical site-header (+ mobile hamburger),
   site-footer and the floating bottom dock on EVERY page including home.
   Pages include: <script src="/static/js/template.js?..."></script>
   Options (set BEFORE include):
     window.__IBO_TPL = { header: false }          // page ships its own header
     window.__IBO_TPL = { footer: false }          // page ships its own footer
     window.__IBO_TPL = { dock: false }            // page opt-out of the bottom dock
   Logo/branding same assets as the SPA => one visual identity everywhere. */
(function () {
  'use strict';
  if (window.__IBO_TPL_LOADED) return;
  window.__IBO_TPL_LOADED = true;

  const V = '20261022a';
  const opts = Object.assign({ header: true, footer: true, dock: true }, window.__IBO_TPL || {});

  // APK build flag (WebView UA "IBO-TS-App/…") — hides PWA-specific affordances via CSS
  document.documentElement.classList.toggle('ibots-apk', /IBO-TS-App/i.test(navigator.userAgent || ''));

  // Myket build: apply myket-hide/myket-only rules on EVERY page (not only index/pricing)
  try {
    if (window.IboApp && IboApp.getMarket && IboApp.getMarket() === 'myket') {
      document.documentElement.classList.add('ibots-myket');
    }
  } catch (e) {}

  function path() {
    let p = (location.pathname || '/').replace(/\.html$/, '');
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    return p || '/';
  }

  function el(html) {
    const d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstElementChild;
  }

  /* ─────────────── header (desktop nav + mobile hamburger) ─────────────── */
  function buildHeader() {
    const h = el(
      '<header class="site-header tpl-header">' +
        '<div class="container header-container">' +
          '<a href="/" class="brand-wrapper">' +
            '<img src="/static/assets/ibots_logo_transparent.png" alt="IBO-TS Logo" class="brand-logo-img">' +
            '<div class="brand-text-block">' +
              '<span class="brand-name">IBO-TS</span>' +
              '<span class="brand-sub">QUANTITATIVE TRADING PLATFORM</span>' +
            '</div>' +
          '</a>' +
          '<nav class="main-nav tpl-main-nav">' +
            '<a href="/performance" class="nav-link">کارنامه و عملکرد</a>' +
            '<a href="/signals" class="nav-link">سیگنال‌ها</a>' +
            '<a href="/pricing" class="nav-link">پلن‌های اشتراک</a>' +
            '<a href="/features" class="nav-link">امکانات</a>' +
            '<a href="/faq" class="nav-link">سوالات متداول</a>' +
            '<a href="/support" class="nav-link">پشتیبانی</a>' +
          '</nav>' +
          '<div class="header-actions">' +
            '<button type="button" class="tpl-burger" aria-label="منو" aria-expanded="false">' +
              '<span></span><span></span><span></span>' +
            '</button>' +
            '<div id="tplAuthContainer"></div>' +
          '</div>' +
        '</div>' +
      '</header>');
    document.body.insertBefore(h, document.body.firstChild);

    // Same auth-aware CTA as home: token in localStorage => داشبورد else ورود
    const c = document.getElementById('tplAuthContainer');
    const token = (function () { try { return localStorage.getItem('ibots_token'); } catch (e) { return null; } })();
    if (token) {
      c.innerHTML = '<div style="display: flex; align-items: center; gap: 0.5rem;">' +
        '<a href="/" class="btn btn-emerald btn-sm"><i class="bi bi-speedometer2"></i> داشبورد معاملاتی</a>' +
        '<a href="#" onclick="if(window.handleLogout){handleLogout();return false;}" class="btn btn-outline btn-sm" title="خروج از حساب"><i class="bi bi-box-arrow-right"></i> خروج</a></div>';
    } else {
      c.innerHTML = '<a href="/?auth=login" class="btn btn-primary btn-sm"><i class="bi bi-person-fill-lock"></i> ورود و ثبت‌نام</a>';
    }

    // Mobile hamburger sheet — available on every page (≤992px styles apply)
    const burger = h.querySelector('.tpl-burger');
    if (burger) {
      burger.addEventListener('click', function () {
        const open = document.body.classList.toggle('tpl-menu-open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.addEventListener('click', function (ev) {
        if (!document.body.classList.contains('tpl-menu-open')) return;
        if (ev.target.closest('.tpl-menu-sheet') || ev.target.closest('.tpl-burger')) return;
        document.body.classList.remove('tpl-menu-open');
        burger.setAttribute('aria-expanded', 'false');
      });
      buildMenuSheet();
    }
  }

  if (typeof window.handleLogout !== 'function') {
    window.handleLogout = function () {
      var t = null;
      try { t = localStorage.getItem('ibots_token'); localStorage.removeItem('ibots_token'); } catch (e) {}
      try {
        var x = new XMLHttpRequest();
        x.open('POST', '/api/v1/auth/logout', true);
        if (t) x.setRequestHeader('Authorization', 'Bearer ' + t);
        x.send();
      } catch (e) {}
      setTimeout(function () { location.href = '/'; }, 200);
    };
  }

  function buildMenuSheet() {
    const token = (function () { try { return localStorage.getItem('ibots_token'); } catch (e) { return null; } })();
    const authCmd = token
      ? '<a href="/" class="tpl-menu-link"><i class="bi bi-speedometer2"></i> داشبورد معاملاتی</a>' +
        '<a href="/" class="tpl-menu-link tpl-api-logout" onclick="if(window.handleLogout){handleLogout();return false;}"><i class="bi bi-box-arrow-right"></i> خروج از حساب</a>'
      : '<a href="/?auth=login" class="tpl-menu-link"><i class="bi bi-person-fill-lock"></i> ورود و ثبت‌نام</a>';
    const sheet = el(
      '<div class="tpl-menu-sheet" role="dialog" aria-label="فهرست اصلی">' +
        '<div class="tpl-menu-head"><img src="/static/assets/ibots_logo_transparent.png" alt="IBO-TS">' +
          '<div><span class="brand-name">IBO-TS</span><span class="brand-sub">QUANTITATIVE TRADING PLATFORM</span></div>' +
        '</div>' +
        '<nav class="tpl-menu-links">' +
          '<a href="/" class="tpl-menu-link"><i class="bi bi-house-door-fill"></i> خانه</a>' +
          '<a href="/performance" class="tpl-menu-link"><i class="bi bi-graph-up-arrow"></i> کارنامه و عملکرد</a>' +
          '<a href="/signals" class="tpl-menu-link"><i class="bi bi-broadcast-pin"></i> سیگنال‌ها</a>' +
          '<a href="/pricing" class="tpl-menu-link"><i class="bi bi-gem"></i> پلن‌های اشتراک</a>' +
          '<a href="/features" class="tpl-menu-link"><i class="bi bi-stars"></i> امکانات</a>' +
          '<a href="/faq" class="tpl-menu-link"><i class="bi bi-patch-question"></i> سوالات متداول</a>' +
          '<a href="/support" class="tpl-menu-link"><i class="bi bi-headset"></i> پشتیبانی</a>' +
          '<a href="/download" class="tpl-menu-link tpl-menu-apkhide"><i class="bi bi-android2"></i> دانلود اپلیکیشن اندروید</a>' +
        '</nav>' +
        '<div class="tpl-menu-auth">' + authCmd + '</div>' +
      '</div>');
    sheet.addEventListener('click', function (ev) {
      if (ev.target.closest('a')) {
        document.body.classList.remove('tpl-menu-open');
        const b = document.querySelector('.tpl-burger');
        if (b) b.setAttribute('aria-expanded', 'false');
      }
    });
    document.body.appendChild(sheet);
  }

  /* ─────────────── footer ─────────────── */
  function buildFooter() {
    const f = el(
      '<footer class="site-footer tpl-footer">' +
        '<div class="container">' +
          '<div class="footer-top-grid">' +
            '<div>' +
              '<div class="brand-wrapper" style="margin-bottom:1rem;">' +
                '<img src="/static/assets/ibots_logo_transparent.png" alt="IBO-TS" style="height:40px;">' +
                '<span class="brand-name">IBO-TS</span>' +
              '</div>' +
              '<p style="font-size:.88rem;color:var(--text-muted);line-height:1.8;">سامانه پردازش ابری و الگوریتمی سیگنال‌های معاملاتی بازارهای مالی متصل به ۱۸ صرافی رسمی. مدیریت منظم ریسک و انضباط کامل معاملاتی.</p>' +
            '</div>' +
            '<div>' +
              '<h4 class="footer-col-title">دسترسی سریع</h4>' +
              '<ul class="footer-links-list">' +
                '<li><a href="/features">امکانات سامانه</a></li>' +
                '<li><a href="/performance">کارنامه عملکرد</a></li>' +
                '<li><a href="/pricing">پلن‌های اشتراک</a></li>' +
                '<li><a href="/download" class="tpl-apkhide">دانلود اپلیکیشن اندروید</a></li>' +
              '</ul>' +
            '</div>' +
            '<div>' +
              '<h4 class="footer-col-title">قوانین و امنیت</h4>' +
              '<ul class="footer-links-list">' +
                '<li><a href="/privacy">حریم خصوصی داده‌ها</a></li>' +
                '<li><a href="/terms">شرایط استفاده و قوانین</a></li>' +
                '<li><a href="/faq">پرسش‌های متداول</a></li>' +
                '<li><a href="/support">ارتباط با پشتیبانی</a></li>' +
              '</ul>' +
            '</div>' +
            '<div>' +
              '<h4 class="footer-col-title">بیانیه ریسک</h4>' +
              '<p style="font-size:.78rem;color:var(--text-muted);line-height:1.7;">معاملات در بازارهای مالی و دارایی‌های دیجیتال دارای ریسک ذاتی نوسانات قیمتی است. هیچ عملکرد گذشته‌ای تضمین‌کننده قطعی آینده نیست. کاربران باید مدیریت سرمایه مسئولانه را در اولویت قرار دهند.</p>' +
            '</div>' +
          '</div>' +
          '<div class="footer-bottom-bar">' +
            '<span>© 2026 IBO-TS Financial Technologies. کلیه حقوق محفوظ است.</span>' +
            '<span>پشتیبانی تلگرام: @IBOTradingSignalsBot | دامنه رسمی: ibo-ts.com</span>' +
          '</div>' +
        '</div>' +
      '</footer>');
    document.body.appendChild(f);
    f.style.paddingBottom = '2rem';
  }

  /* ─────────────── floating bottom dock ─────────────── */
  function buildDock() {
    const p = path();
    const wrap = el('<div class="tpl-dock-fixed"></div>');
    const dock = el('<nav class="tpl-dock" aria-label="ناوبری اصلی"></nav>');

    const apk = document.documentElement.classList.contains('ibots-apk');
    const item = function (n, center) {
      const a = document.createElement('a');
      if (!center && !n) return a;
      a.href = (n && typeof n === 'object') ? n.href : '#';
      a.className = center ? 'tpl-dock-item tpl-dock-center' : 'tpl-dock-item';
      if (center) {
        a.href = '/';
        a.setAttribute('aria-label', 'خانه');
        a.innerHTML = '<i class="bi bi-house-door" aria-hidden="true"></i><b>خانه</b>';
        if (p === '/' || p === '/index.html') a.classList.add('tpl-active');
      } else {
        a.innerHTML = '<i class="bi ' + n.icon + '"></i><b>' + n.label + '</b>';
        if (p === n.href) a.classList.add('tpl-active');
      }
      return a;
    };

    if (apk) {
      dock.appendChild(item({ href: '/features', icon: 'bi-grid-1x2', label: 'امکانات' }));
      dock.appendChild(item({ href: '/signals', icon: 'bi-activity', label: 'سیگنال' }));
      dock.appendChild(item(null, true)); // HOME — centered absolutely
      dock.appendChild(item({ href: '/pricing', icon: 'bi-tag', label: 'تعرفه' }));
      const token = (function () { try { return localStorage.getItem('ibots_token'); } catch (e) { return null; } })();
      if (token) {
        const logoutLink = document.createElement('a');
        logoutLink.href = '#';
        logoutLink.className = 'tpl-dock-item';
        logoutLink.setAttribute('aria-label', 'خروج از حساب');
        logoutLink.innerHTML = '<i class="bi bi-box-arrow-right"></i><b>خروج</b>';
        logoutLink.onclick = function (ev) { ev.preventDefault(); if (window.handleLogout) handleLogout(); };
        dock.appendChild(logoutLink);
      } else {
        const spacer = document.createElement('a');
        spacer.className = 'tpl-dock-item';
        spacer.setAttribute('aria-hidden', 'true');
        spacer.style.visibility = 'hidden';
        spacer.style.pointerEvents = 'none';
        dock.appendChild(spacer);
      }
    } else {
      dock.appendChild(item({ href: '/features', icon: 'bi-grid-1x2', label: 'امکانات' }));
      dock.appendChild(item({ href: '/signals', icon: 'bi-activity', label: 'سیگنال' }));
      dock.appendChild(item(null, true)); // HOME
      dock.appendChild(item({ href: '/pricing', icon: 'bi-tag', label: 'تعرفه' }));
      dock.appendChild(item({ href: '/download', icon: 'bi-phone', label: 'اپلیکیشن' }));
    }

    wrap.appendChild(dock);
    document.body.appendChild(wrap);
    const f = document.querySelector('.site-footer');
    if (f) f.style.marginBottom = '6.5rem';
    else document.body.style.paddingBottom = '6.5rem';
  }

  /* ─────────────── boot ─────────────── */
  function boot() {
    if (opts.header) buildHeader();
    if (opts.footer) buildFooter();
    if (opts.dock) buildDock();
    if (opts.header) {
      // Google OAuth redirect-flow fallback link (added by app.js on home)
      const go = document.getElementById('googleOAuthStart');
      if (go) { go.style.display = 'block'; }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
