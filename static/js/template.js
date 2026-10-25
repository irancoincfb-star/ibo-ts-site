/* IBO-TS shared page chrome: identical site-header (+ mobile hamburger),
   site-footer and the floating bottom dock on EVERY page including home.
   Pages include: <script src="/static/js/template.js?..."></script>
   Options (set BEFORE include):
     window.__IBO_TPL = { header: false }          // page ships its own header
     window.__IBO_TPL = { footer: false }          // page ships its own footer
     window.__IBO_TPL = { dock: false }            // page opt-out of the bottom dock
   Logo/branding same assets as the SPA => one visual identity everywhere.
   v20261025b: RGB glass nav (header+dock matched), grouped icon menu,
   dock shortcuts -> کارنامه + داشبورد معاملاتی, profile chip. */
(function () {
  'use strict';
  if (window.__IBO_TPL_LOADED) return;
  window.__IBO_TPL_LOADED = true;

  const V = '20261025b';
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

  function getToken() {
    try { return localStorage.getItem('ibots_token'); } catch (e) { return null; }
  }

  function el(html) {
    const d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstElementChild;
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'IB';
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }

  // Canonical SPA route for a path (home page never acts on sub-paths)
  function isActive(href) {
    if (!href) return false;
    const route = href.split('#')[0];
    const p = path();
    if (route === '/') return p === '/' || p === '/index.html';
    return p === route;
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
          '<nav class="main-nav tpl-main-nav" aria-label="ناوبری دسکتاپ">' +
            '<a href="/performance" class="nav-link"><i class="bi bi-trophy-fill" aria-hidden="true"></i><span>کارنامه و عملکرد</span></a>' +
            '<a href="/signals" class="nav-link"><i class="bi bi-broadcast-pin" aria-hidden="true"></i><span>سیگنال‌ها</span></a>' +
            '<a href="/pricing" class="nav-link"><i class="bi bi-gem" aria-hidden="true"></i><span>پلن‌های اشتراک</span></a>' +
            '<a href="/features" class="nav-link"><i class="bi bi-grid-1x2-fill" aria-hidden="true"></i><span>امکانات</span></a>' +
            '<a href="/faq" class="nav-link"><i class="bi bi-patch-question-fill" aria-hidden="true"></i><span>سوالات متداول</span></a>' +
            '<a href="/support" class="nav-link"><i class="bi bi-headset" aria-hidden="true"></i><span>پشتیبانی</span></a>' +
          '</nav>' +
          '<div class="header-actions">' +
            '<button type="button" class="tpl-burger" aria-label="منو" aria-expanded="false" aria-controls="tplMenuSheet">' +
              '<span class="tpl-burger-glyph" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' +
            '</button>' +
            '<div id="tplAuthContainer"></div>' +
          '</div>' +
        '</div>' +
      '</header>');
    document.body.insertBefore(h, document.body.firstChild);

    // Same auth-aware CTA as home: token in localStorage => profile+dashboard else ورود
    const c = document.getElementById('tplAuthContainer');
    const token = getToken();
    if (token) {
      c.innerHTML =
        '<div class="tpl-header-auth">' +
          '<a href="/#profile" class="tpl-profile-chip" title="پروفایل کاربری" aria-label="پروفایل کاربری">' +
            '<img alt="" hidden><span class="tpl-chip-initials">IB</span>' +
          '</a>' +
          '<a href="/#dashboard" class="btn btn-emerald btn-sm tpl-btn-flex"><i class="bi bi-speedometer2"></i> <span class="tpl-btn-label">داشبورد معاملاتی</span></a>' +
          '<a href="#" onclick="if(window.handleLogout){handleLogout();return false;}" class="btn btn-outline btn-sm tpl-btn-flex" title="خروج از حساب" aria-label="خروج از حساب"><i class="bi bi-box-arrow-right"></i> <span class="tpl-btn-label">خروج</span></a>' +
        '</div>';
      loadProfileChip();
    } else {
      c.innerHTML = '<a href="/#login" class="btn btn-primary btn-sm tpl-btn-flex"><i class="bi bi-person-fill-lock"></i> <span class="tpl-btn-label">ورود و ثبت‌نام</span></a>';
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
      document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && document.body.classList.contains('tpl-menu-open')) {
          document.body.classList.remove('tpl-menu-open');
          burger.setAttribute('aria-expanded', 'false');
        }
      });
      buildMenuSheet();
    }
  }

  // Live avatar/initials for the header profile chip (identity preview)
  function loadProfileChip() {
    const token = getToken();
    if (!token) return;
    fetch('/api/v1/auth/me', { headers: { 'Authorization': 'Bearer ' + token } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.user) return;
        const name = d.user.first_name ? ((d.user.last_name ? d.user.first_name + ' ' + d.user.last_name : d.user.first_name)) : (d.user.full_name || d.user.email || '');
        document.querySelectorAll('.tpl-profile-chip').forEach(function (chip) {
          const img = chip.querySelector('img');
          const ini = chip.querySelector('.tpl-chip-initials');
          if (d.user.avatar_url && img) {
            img.onerror = function () { img.style.display = 'none'; if (ini) ini.style.display = ''; };
            img.onload = function () { img.style.display = 'block'; if (ini) ini.style.display = 'none'; };
            img.src = d.user.avatar_url;
          }
          if (ini && !d.user.avatar_url) ini.textContent = initials(name);
          chip.title = 'پروفایل کاربری — ' + name;
          chip.setAttribute('aria-label', 'پروفایل کاربری — ' + name);
        });
      })
      .catch(function () {});
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

  /* ─────────────── categorized mobile menu sheet ─────────────── */
  function menuGroup(title, icon, links) {
    let html = '<section class="tpl-menu-group">' +
      '<h3 class="tpl-menu-group-title"><i class="bi ' + icon + '" aria-hidden="true"></i> ' + title + '</h3>' +
      '<div class="tpl-menu-group-links">';
    links.forEach(function (l) {
      const cls = 'tpl-menu-link' + (l.cls ? ' ' + l.cls : '') +
        (l.href.indexOf('#') === -1 && isActive(l.href) ? ' tpl-menu-active' : '');
      html += '<a href="' + l.href + '" class="' + cls + '"><i class="bi ' + l.icon + '" aria-hidden="true"></i><span>' + l.label + '</span></a>';
    });
    return html + '</div></section>';
  }

  function buildMenuSheet() {
    const token = getToken();
    const authCmd = token
      ? '<div class="tpl-menu-user">' +
          '<a href="/#profile" class="tpl-menu-link"><i class="bi bi-person-vcard-fill"></i><span>پروفایل کاربری</span></a>' +
          '<a href="/#dashboard" class="tpl-menu-link"><i class="bi bi-speedometer2"></i><span>داشبورد معاملاتی</span></a>' +
          '<a href="#" class="tpl-menu-link tpl-api-logout" onclick="if(window.handleLogout){handleLogout();return false;}"><i class="bi bi-box-arrow-right"></i><span>خروج از حساب</span></a>' +
        '</div>'
      : '<div class="tpl-menu-user">' +
          '<a href="/#login" class="tpl-menu-link"><i class="bi bi-person-fill-lock"></i><span>ورود و ثبت‌نام</span></a>' +
        '</div>';

    const sheet = el(
      '<div class="tpl-menu-sheet" id="tplMenuSheet" role="dialog" aria-label="فهرست اصلی">' +
        '<div class="tpl-menu-head"><img src="/static/assets/ibots_logo_transparent.png" alt="IBO-TS">' +
          '<div><span class="brand-name">IBO-TS</span><span class="brand-sub">QUANTITATIVE TRADING PLATFORM</span></div>' +
          '<button type="button" class="tpl-menu-close" aria-label="بستن منو"><i class="bi bi-x-lg" aria-hidden="true"></i></button>' +
        '</div>' +
        '<div class="tpl-menu-scroll">' +
          menuGroup('معاملات', 'bi-graph-up-arrow', [
            { href: '/', label: 'خانه', icon: 'bi-house-door-fill' },
            { href: '/signals', label: 'سیگنال‌ها', icon: 'bi-broadcast-pin' },
            { href: '/performance', label: 'کارنامه و عملکرد', icon: 'bi-trophy-fill' },
            { href: '/features', label: 'امکانات سامانه', icon: 'bi-grid-1x2-fill' },
            { href: '/#dashboard', label: 'داشبورد معاملاتی', icon: 'bi-speedometer2' }
          ]) +
          menuGroup('اشتراک و اپلیکیشن', 'bi-gem', [
            { href: '/pricing', label: 'پلن‌های اشتراک', icon: 'bi-tags-fill' },
            { href: '/download', label: 'دانلود اپلیکیشن اندروید', icon: 'bi-android2', cls: 'tpl-menu-apkhide' }
          ]) +
          menuGroup('راهنما و پشتیبانی', 'bi-headset', [
            { href: '/faq', label: 'سوالات متداول', icon: 'bi-patch-question-fill' },
            { href: '/support', label: 'ارتباط با پشتیبانی', icon: 'bi-life-preserver' },
            { href: '/about', label: 'درباره ما', icon: 'bi-building' },
            { href: '/ai', label: 'راهنمای هوش مصنوعی', icon: 'bi-robot' }
          ]) +
          menuGroup('قوانین و حریم خصوصی', 'bi-shield-check', [
            { href: '/privacy', label: 'حریم خصوصی داده‌ها', icon: 'bi-shield-lock-fill' },
            { href: '/terms', label: 'شرایط استفاده و قوانین', icon: 'bi-file-earmark-text-fill' }
          ]) +
        '</div>' +
        '<div class="tpl-menu-auth">' + authCmd + '</div>' +
      '</div>');
    sheet.addEventListener('click', function (ev) {
      if (ev.target.closest('.tpl-menu-close') || ev.target.closest('a')) {
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
              '<h2 class="footer-col-title">دسترسی سریع</h2>' +
              '<ul class="footer-links-list">' +
                '<li><a href="/features">امکانات سامانه</a></li>' +
                '<li><a href="/performance">کارنامه عملکرد</a></li>' +
                '<li><a href="/pricing">پلن‌های اشتراک</a></li>' +
                '<li><a href="/download" class="tpl-apkhide">دانلود اپلیکیشن اندروید</a></li>' +
              '</ul>' +
            '</div>' +
            '<div>' +
              '<h2 class="footer-col-title">قوانین و امنیت</h2>' +
              '<ul class="footer-links-list">' +
                '<li><a href="/privacy">حریم خصوصی داده‌ها</a></li>' +
                '<li><a href="/terms">شرایط استفاده و قوانین</a></li>' +
                '<li><a href="/about">درباره ما</a></li>' +
                '<li><a href="/faq">پرسش‌های متداول</a></li>' +
                '<li><a href="/support">ارتباط با پشتیبانی</a></li>' +
              '</ul>' +
            '</div>' +
            '<div>' +
              '<h2 class="footer-col-title">بیانیه ریسک</h2>' +
              '<p style="font-size:.78rem;color:var(--text-muted);line-height:1.7;">معاملات در بازارهای مالی و دارایی‌های دیجیتال دارای ریسک ذاتی نوسانات قیمتی است. هیچ عملکرد گذشته‌ای تضمین‌کننده قطعی آینده نیست. کاربران باید مدیریت سرمایه مسئولانه را در اولویت قرار دهند.</p>' +
            '</div>' +
          '</div>' +
          '<div class="footer-bottom-bar">' +
            '<span>© 2026 IBO-TS Financial Technologies. کلیه حقوق محفوظ است.</span>' +
            '<span>پشتیبانی تلگرام: @IBOTradingSignalsBot | دامنه رسمی: ibo-ts.com | <a href="/llms.txt" style="color:inherit">llms.txt</a></span>' +
          '</div>' +
        '</div>' +
      '</footer>');
    document.body.appendChild(f);
    f.style.paddingBottom = '2rem';
  }

  /* ─────────────── floating bottom dock (RGB glass) ─────────────── */
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
        a.innerHTML = '<i class="bi ' + n.icon + '" aria-hidden="true"></i><b>' + n.label + '</b>';
        if (n.aria) a.setAttribute('aria-label', n.aria);
        if (n.href.indexOf('#') === -1 && isActive(n.href)) a.classList.add('tpl-active');
      }
      return a;
    };

    // Dock 1: کارنامه و عملکرد — Dock 2: ورود به داشبورد معاملاتی (login-gated via /#dashboard)
    const slotPerf = { href: '/performance', icon: 'bi-trophy-fill', label: 'کارنامه', aria: 'کارنامه و عملکرد' };
    const slotDash = { href: '/#dashboard', icon: 'bi-speedometer2', label: 'داشبورد معاملاتی', aria: 'ورود به داشبورد معاملاتی' };

    if (apk) {
      dock.appendChild(item(slotPerf));
      dock.appendChild(item(slotDash));
      dock.appendChild(item(null, true)); // HOME — centered absolutely
      dock.appendChild(item({ href: '/pricing', icon: 'bi-tag', label: 'تعرفه' }));
      const token = getToken();
      if (token) {
        const logoutLink = document.createElement('a');
        logoutLink.href = '#';
        logoutLink.className = 'tpl-dock-item';
        logoutLink.setAttribute('aria-label', 'خروج از حساب');
        logoutLink.innerHTML = '<i class="bi bi-box-arrow-right" aria-hidden="true"></i><b>خروج</b>';
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
      dock.appendChild(item(slotPerf));
      dock.appendChild(item(slotDash));
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

  /* ─────────────── anime-style burst on icon tap (nav + dock + menu) ─────────────── */
  function bindBurst() {
    document.addEventListener('click', function (ev) {
      const t = ev.target.closest('.tpl-dock-item, .tpl-menu-link, .nav-link, .tpl-profile-chip');
      if (!t) return;
      t.classList.remove('tpl-burst');
      void t.offsetWidth; // restart animation
      t.classList.add('tpl-burst');
      window.setTimeout(function () { t.classList.remove('tpl-burst'); }, 750);
    }, { passive: true });
  }

  /* ─────────────── boot ─────────────── */
  function boot() {
    if (opts.header) buildHeader();
    if (opts.footer) buildFooter();
    if (opts.dock) buildDock();
    bindBurst();
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
