/* IBO-TS shared page chrome: identical site-header (+ mobile hamburger),
   site-footer and the floating bottom dock on EVERY page including home.
   Pages include: <script src="/static/js/template.js?..."></script>
   Options (set BEFORE include):
     window.__IBO_TPL = { header: false }          // page ships its own header
     window.__IBO_TPL = { footer: false }          // page ships its own footer
     window.__IBO_TPL = { dock: false }            // page opt-out of the bottom dock
   Logo/branding same assets as the SPA => one visual identity everywhere.
   v20261025d: RGB glass nav (header+dock matched), grouped icon menu, dark mode, toast, onboarding, offline indicator,
   dock shortcuts -> کارنامه + داشبورد معاملاتی, profile chip. */
(function () {
  'use strict';
  if (window.__IBO_TPL_LOADED) return;
  window.__IBO_TPL_LOADED = true;

  const V = '20261025d';
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
            '<button type="button" class="tpl-theme-toggle" aria-label="تغییر تم" aria-pressed="false" title="تغییر تم (روشن/تیره)">' +
              '<i class="bi bi-sun-fill" aria-hidden="true"></i>' +
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
          '<a href="/settings" class="btn btn-outline btn-sm tpl-btn-flex" title="تنظیمات کاربر و کانفیگ ربات" aria-label="تنظیمات کاربر"><i class="bi bi-gear-fill"></i> <span class="tpl-btn-label">تنظیمات کاربر</span></a>' +
        '</div>';
      loadProfileChip();
    } else {
      // Blue login button removed — menu + dock provide access; header kept clean
      c.innerHTML = '<div class="tpl-header-auth" aria-label="دسترسی سریع"></div>';
    }

    // Brand logo also opens menu (clean alternative to burger)
    const brand = h.querySelector('.brand-wrapper');
    if (brand) {
      brand.addEventListener('click', function (ev) {
        if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
        ev.preventDefault();
        document.body.classList.toggle('tpl-menu-open');
      });
    }

    // Burger button opens/closes menu sheet
    const burger = h.querySelector('.tpl-burger');
    if (burger) {
      burger.addEventListener('click', function () {
        const open = document.body.classList.toggle('tpl-menu-open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.addEventListener('click', function (ev) {
        if (!document.body.classList.contains('tpl-menu-open')) return;
        if (ev.target.closest('.tpl-menu-sheet') || ev.target.closest('.tpl-burger') || ev.target.closest('.brand-wrapper')) return;
        document.body.classList.remove('tpl-menu-open');
        burger.setAttribute('aria-expanded', 'false');
      });
      document.addEventListener('keydown', function (ev) {
        if (ev.key === 'Escape' && document.body.classList.contains('tpl-menu-open')) {
          document.body.classList.remove('tpl-menu-open');
          burger.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // Theme Toggle (Dark/Light Mode)
    const themeToggle = h.querySelector('.tpl-theme-toggle');
    if (themeToggle) {
      // Initialize theme from localStorage or system preference
      function getTheme() {
        let saved = null;
        try { saved = localStorage.getItem('ibo-theme'); } catch (e) {}
        if (saved === 'dark' || saved === 'light') return saved;
        try {
          return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        } catch (e) {
          return 'light';
        }
      }

      function applyTheme(theme) {
        const isDark = theme === 'dark';
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.setAttribute('data-bs-theme', theme);
        document.documentElement.style.colorScheme = theme;
        try { localStorage.setItem('ibo-theme', theme); } catch (e) {}
        const icon = themeToggle.querySelector('i');
        if (icon) {
          icon.className = isDark ? 'bi bi-moon-stars-fill' : 'bi bi-sun-fill';
        }
        themeToggle.setAttribute('aria-pressed', isDark ? 'true' : 'false');
        themeToggle.setAttribute('aria-label', isDark ? 'تغییر به حالت روشن' : 'تغییر به حالت تاریک');
        themeToggle.title = isDark ? 'حالت روشن (Light)' : 'حالت تاریک (Dark)';
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', isDark ? '#070D18' : '#4F46E5');
        // Let charts / page widgets restyle themselves in the same tick.
        document.dispatchEvent(new CustomEvent('ibo:themechange', { detail: { theme: theme } }));
      }

      // Initialize
      applyTheme(getTheme());

      // Toggle on click
      themeToggle.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = current === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
      });
    }

    buildMenuSheet();
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
          '<a href="/settings" class="tpl-menu-link"><i class="bi bi-gear-fill"></i><span>تنظیمات کاربر و کانفیگ</span></a>' +
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
              '<p style="font-size:.88rem;color:var(--text-muted);line-height:1.8;">سامانه پردازش ابری و الگوریتمی سیگنال‌های معاملاتی بازارهای مالی متصل به 18 صرافی رسمی. مدیریت منظم ریسک و انضباط کامل معاملاتی.</p>' +
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
        const settingsLink = document.createElement('a');
        settingsLink.href = '/settings';
        settingsLink.className = 'tpl-dock-item';
        settingsLink.setAttribute('aria-label', 'تنظیمات کاربر و کانفیگ');
        settingsLink.innerHTML = '<i class="bi bi-gear-fill" aria-hidden="true"></i><b>تنظیمات</b>';
        dock.appendChild(settingsLink);
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

  /* ─────────────── Toast Notification System ─────────────── */
  function showToast(message, type = 'info', duration = 4000, action = null) {
    // Create toast container if not exists
    let container = document.getElementById('tpl-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'tpl-toast-container';
      container.setAttribute('role', 'region');
      container.setAttribute('aria-label', 'اعلان‌ها');
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      container.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 16px;
        left: 16px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
        max-width: 400px;
        margin: 0 auto;
      `;
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const toastId = 'toast-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    toast.id = toastId;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');

    const icons = {
      success: 'bi-check-circle-fill',
      error: 'bi-x-circle-fill',
      warning: 'bi-exclamation-triangle-fill',
      info: 'bi-info-circle-fill'
    };

    const bgColors = {
      success: 'var(--tpl-toast-bg-success)',
      error: 'var(--tpl-toast-bg-error)',
      warning: 'var(--tpl-toast-bg-warning)',
      info: 'var(--tpl-toast-bg-info)'
    };

    const borderColors = {
      success: 'var(--tpl-toast-border-success)',
      error: 'var(--tpl-toast-border-error)',
      warning: 'var(--tpl-toast-border-warning)',
      info: 'var(--tpl-toast-border-info)'
    };

    const textColors = {
      success: 'var(--tpl-toast-success)',
      error: 'var(--tpl-toast-error)',
      warning: 'var(--tpl-toast-warning)',
      info: 'var(--tpl-toast-info)'
    };

    const icon = icons[type] || icons.info;
    const bgColor = bgColors[type] || bgColors.info;
    const borderColor = borderColors[type] || borderColors.info;
    const textColor = textColors[type] || textColors.info;

    toast.style.cssText = `
      background: ${bgColor};
      border: 1.5px solid ${borderColor};
      border-radius: 12px;
      padding: 12px 16px;
      color: ${textColor};
      font-size: 0.875rem;
      font-weight: 600;
      line-height: 1.5;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.2), inset 0 0 0 1.5px ${borderColor};
      animation: tpl-toast-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      direction: rtl;
      text-align: right;
      pointer-events: auto;
    `;

    toast.innerHTML = `
      <i class="bi ${icons[type] || icons.info}" aria-hidden="true" style="font-size: 1.1rem; flex-shrink: 0; margin-top: 2px;"></i>
      <span style="flex: 1;">${message}</span>
      <button type="button" class="tpl-toast-close" aria-label="بستن" style="
        background: none;
        border: none;
        color: inherit;
        opacity: 0.6;
        cursor: pointer;
        padding: 4px;
        font-size: 1rem;
        line-height: 1;
        flex-shrink: 0;
        transition: opacity 0.2s;
      ">&times;</button>
    `;

    // Add action button if provided
    if (action && action.label && typeof action.onClick === 'function') {
      const actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.textContent = action.label;
      actionBtn.style.cssText = `
        margin-right: 8px;
        padding: 6px 12px;
        border-radius: 8px;
        border: 1.5px solid currentColor;
        background: transparent;
        color: inherit;
        font-weight: 700;
        font-size: 0.75rem;
        cursor: pointer;
        transition: background 0.2s, color 0.2s;
        flex-shrink: 0;
      `;
      actionBtn.onmouseover = () => { actionBtn.style.background = 'currentColor'; actionBtn.style.color = 'var(--tpl-bg-primary)'; };
      actionBtn.onmouseout = () => { actionBtn.style.background = 'transparent'; actionBtn.style.color = 'inherit'; };
      actionBtn.onclick = (e) => {
        e.stopPropagation();
        action.onClick();
        removeToast(toastId);
      };
      toast.appendChild(actionBtn);
    }

    // Add close button handler
    const closeBtn = toast.querySelector('.tpl-toast-close');
    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        removeToast(toast.id);
      };
    }

    // Click on toast to dismiss (optional)
    toast.onclick = () => removeToast(toast.id);

    // Add to container
    container.appendChild(toast);

    // Auto-remove after duration
    const timeoutId = setTimeout(() => removeToast(toastId), duration);

    // Store timeout ID for cleanup
    toast._timeoutId = timeoutId;

    function removeToast(id) {
      const toastEl = document.getElementById(id);
      if (!toastEl) return;
      clearTimeout(toastEl._timeoutId);
      toastEl.style.animation = 'tpl-toast-out 0.25s ease-in forwards';
      setTimeout(() => {
        if (toastEl.parentNode) toastEl.parentNode.removeChild(toastEl);
      }, 250);
    }

    return { id: toastId, remove: () => removeToast(toastId) };
  }

  // Convenience methods
  window.showToast = showToast;
  window.toast = {
    success: (msg, dur, act) => showToast(msg, 'success', dur, act),
    error: (msg, dur, act) => showToast(msg, 'error', dur, act),
    warning: (msg, dur, act) => showToast(msg, 'warning', dur, act),
    info: (msg, dur, act) => showToast(msg, 'info', dur, act),
  };

  /* ─────────────── Onboarding Flow (First-time User Guide) ─────────────── */
  function initOnboarding() {
    const hasSeenOnboarding = localStorage.getItem('ibo-onboarding-complete');
    if (hasSeenOnboarding) return;

    const steps = [
      {
        target: '.tpl-dock',
        title: 'نوار ناوبری پایین',
        content: 'از این نوار برای دسترسی سریع به کارنامه، داشبورد، تعرفه و اپلیکیشن استفاده کنید.',
        position: 'top'
      },
      {
        target: '.tpl-burger',
        title: 'منوی همبرگری',
        content: 'اینجا به تمام بخش‌های سایت دسترسی دارید: معاملات، اشتراک، راهنما و قوانین.',
        position: 'left'
      },
      {
        target: '.tpl-profile-chip',
        title: 'پروفایل کاربری',
        content: 'اینجا می‌توانید نام، آواتار، رمز عبور و تنظیمات حساب خود را مدیریت کنید.',
        position: 'left'
      }
    ];

    let currentStep = 0;
    let overlay = null;
    let tooltip = null;
    let highlight = null;

    function createOverlay() {
      overlay = document.createElement('div');
      overlay.id = 'tpl-onboarding-overlay';
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.7);
        z-index: 9998;
        animation: fadeIn 0.3s ease;
      `;
      document.body.appendChild(overlay);
    }

    function createTooltip(step) {
      tooltip = document.createElement('div');
      tooltip.id = 'tpl-onboarding-tooltip';
      tooltip.style.cssText = `
        position: fixed;
        z-index: 9999;
        max-width: 320px;
        background: var(--tpl-card-bg);
        border: 1.5px solid var(--tpl-card-border);
        border-radius: 16px;
        padding: 20px;
        box-shadow: var(--tpl-shadow-xl);
        direction: rtl;
        text-align: right;
        animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      `;

      tooltip.innerHTML = `
        <div style="display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px;">
          <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--tpl-rgb-grad); display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: white; font-weight: 900; font-size: 1.1rem;">
            ${step.index + 1}
          </div>
          <div style="flex: 1;">
            <h4 style="margin: 0 0 4px; font-size: 1rem; font-weight: 900; color: var(--tpl-text-primary);">${step.title}</h4>
            <p style="margin: 0; font-size: 0.875rem; color: var(--tpl-text-secondary); line-height: 1.6;">${step.content}</p>
          </div>
          <button type="button" class="tpl-onboarding-skip" aria-label="رد کردن" style="
            background: none; border: none; color: var(--tpl-text-muted); font-size: 1.25rem; cursor: pointer; padding: 4px; line-height: 1;
          ">&times;</button>
        </div>
        <p style="font-size: 0.75rem; color: var(--tpl-text-muted); margin: 12px 0 0; text-align: center;">
          مرحله ${step.index + 1} از ${3}
        </p>
        <div style="display: flex; gap: 8px; margin-top: 20px;">
          <button type="button" class="tpl-onboarding-prev" style="flex: 1; padding: 10px 16px; border-radius: 10px; border: 1.5px solid var(--tpl-border-medium); background: transparent; color: var(--tpl-text-secondary); font-weight: 700; font-size: 0.875rem; cursor: pointer;" ${step.index === 0 ? 'disabled style="opacity: 0.5; pointer-events: none;"' : ''}>
            قبلی
          </button>
          <button type="button" class="tpl-onboarding-next" style="flex: 1; padding: 10px 16px; border-radius: 10px; background: var(--tpl-rgb-grad); background-size: 200% 200%; animation: tpl-rgb-flow 8s ease-in-out infinite; color: white; font-weight: 800; font-size: 0.875rem; border: none; cursor: pointer;">
            ${step.index === 2 ? 'شروع کنید' : 'بعدی'}
          </button>
        </div>
      `;

      document.body.appendChild(tooltip);

      // Position tooltip relative to target
      positionTooltip(step);

      // Event listeners
      tooltip.querySelector('.tpl-onboarding-next').onclick = nextStep;
      tooltip.querySelector('.tpl-onboarding-prev').onclick = prevStep;
      tooltip.querySelector('.tpl-onboarding-skip').onclick = skipOnboarding;
    }

    function positionTooltip(step) {
      if (!tooltip || !step.target) return;
      const target = document.querySelector(step.target);
      if (!target) return nextStep();

      const rect = target.getBoundingClientRect();
      const tooltipRect = { width: 320, height: 280 }; // approximate
      let top, left;

      switch (step.position) {
        case 'top':
          top = rect.top - 300;
          left = rect.left + rect.width / 2 - 160;
          break;
        case 'left':
          top = rect.top + rect.height / 2 - 140;
          left = rect.left - 340;
          break;
        case 'right':
          top = rect.top + rect.height / 2 - 140;
          left = rect.right + 20;
          break;
        default:
          top = rect.top - 300;
          left = rect.left + rect.width / 2 - 160;
      }

      // Keep within viewport
      left = Math.max(16, Math.min(left, window.innerWidth - 336));
      top = Math.max(16, Math.min(top, window.innerHeight - 300));

      tooltip.style.top = top + 'px';
      tooltip.style.left = left + 'px';
    }

    function createHighlight(step) {
      const target = document.querySelector(step.target);
      if (!target) return;

      highlight = document.createElement('div');
      highlight.id = 'tpl-onboarding-highlight';
      highlight.style.cssText = `
        position: fixed;
        z-index: 9997;
        border-radius: 12px;
        border: 3px solid var(--tpl-accent-primary);
        box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.7);
        animation: pulse 1.5s ease-in-out infinite;
        pointer-events: none;
      `;
      document.body.appendChild(highlight);

      updateHighlight(step);
    }

    function updateHighlight(step) {
      if (!highlight) return;
      const target = document.querySelector(step.target);
      if (!target) return;
      const rect = target.getBoundingClientRect();
      highlight.style.top = (rect.top - 6) + 'px';
      highlight.style.left = (rect.left - 6) + 'px';
      highlight.style.width = (rect.width + 12) + 'px';
      highlight.style.height = (rect.height + 12) + 'px';
    }

    function showStep(index) {
      if (index >= 3) {
        completeOnboarding();
        return;
      }
      currentStep = index;
      const step = { ...steps[index], index };

      // Clean up previous
      if (tooltip) tooltip.remove();
      if (highlight) highlight.remove();

      createTooltip(step);
      createHighlight(step);
      updateHighlight({ target: steps[index].target });
    }

    function nextStep() {
      showStep(currentStep + 1);
    }

    function prevStep() {
      showStep(currentStep - 1);
    }

    function skipOnboarding() {
      completeOnboarding();
    }

    function completeOnboarding() {
      localStorage.setItem('ibo-onboarding-complete', 'true');
      cleanup();
    }

    function cleanup() {
      if (overlay) overlay.remove();
      if (tooltip) tooltip.remove();
      if (highlight) highlight.remove();
      document.body.style.overflow = '';
    }

    // Start onboarding
    createOverlay();
    showStep(0);
  }

  // Expose for manual trigger
  window.startOnboarding = initOnboarding;

  // Auto-start onboarding for new users (after a short delay)
  setTimeout(() => {
    if (!localStorage.getItem('ibo-onboarding-complete')) {
      initOnboarding();
    }
  }, 2000);

  /* ─────────────── Offline Indicator ─────────────── */
  function initOfflineIndicator() {
    // Create offline indicator element
    const indicator = document.createElement('div');
    indicator.id = 'tpl-offline-indicator';
    indicator.className = 'tpl-offline-indicator';
    indicator.innerHTML = '<i class="bi bi-wifi-off" aria-hidden="true"></i> <span>آفلاین هستید</span>';
    document.body.appendChild(indicator);

    function updateOnlineStatus() {
      const indicator = document.getElementById('tpl-offline-indicator');
      if (!indicator) return;
      
      if (navigator.onLine) {
        indicator.classList.remove('visible');
      } else {
        indicator.classList.add('visible');
      }
    }

    // Initial check
    updateOnlineStatus();

    // Listen for online/offline events
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
  }

  /* Icon-tap burst: a tiny RGB pop on dock / menu / header taps. */
  function bindBurst() {
    const selector = '.tpl-dock-item, .tpl-dock-center, .tpl-menu-link, .tpl-main-nav .nav-link, .tpl-burger';
    document.addEventListener('pointerdown', function (ev) {
      const item = ev.target.closest(selector);
      if (!item || item.classList.contains('tpl-burst')) return;
      item.classList.add('tpl-burst');
      setTimeout(function () { item.classList.remove('tpl-burst'); }, 760);
    }, { passive: true });
  }

  /* ─────────────── boot ─────────────── */
  function boot() {
    if (opts.header) buildHeader();
    if (opts.footer) buildFooter();
    if (opts.dock) buildDock();
    bindBurst();
    initOfflineIndicator();
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
