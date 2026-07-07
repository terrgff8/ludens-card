/* ==========================================================
   動效層 — 全部 GSAP
   Fail-safe：內容 CSS 預設可見，只用 from/fromTo；
   GSAP 沒載入 → 直接 return，頁面是完整靜態頁。
   單一 gsap.matchMedia() 實例、三次 mm.add()：
     A: prefers-reduced-motion → 不註冊任何動畫
     B: 允許動效的所有裝置（含手機）→ 開機序列 + 待機掃描線
     C: 桌機（pointer:fine + >=768px）→ 磁吸 + 視差 + 頭像傾斜
   ========================================================== */
(function () {
  'use strict';
  if (!window.gsap) return;
  if (window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  const mm = gsap.matchMedia();

  /* ---- Context A：reduced motion，什麼都不做（CSS 端另有保險） ---- */
  mm.add('(prefers-reduced-motion: reduce)', function () {});

  /* ---- Context B：基準動效（含手機） ---- */
  mm.add('(prefers-reduced-motion: no-preference)', function () {
    // 開機序列（~1.6s，HUD 通電感）
    const boot = gsap.timeline({ defaults: { ease: 'power2.out' } });

    boot
      // 外框自己畫出來
      .from('.hud-bar', { scaleX: 0, duration: 0.5 })
      .from('.hud-corners span', { scale: 0, duration: 0.4, stagger: 0.05 }, 0.15)
      // 掃描線快速掃過，時間點對準頭像顯影
      .fromTo('.layer-scanline',
        { y: -160 },
        { y: function () { return window.innerHeight + 160; }, duration: 0.5, ease: 'power1.inOut' },
        0.25)
      // 頭像顯影（不動 clip-path — img 版頭像有八角 polygon，混插值會跳）
      .from('.avatar-frame', {
        autoAlpha: 0,
        scale: 1.06,
        duration: 0.6
      }, 0.35)
      // 姓名 / tagline（字距固定在 CSS，只動 opacity）
      .from('.name', { y: 12, autoAlpha: 0, duration: 0.45 }, 0.6)
      .from('.tagline', { autoAlpha: 0, duration: 0.4 }, 0.75)
      .from('.bio', { y: 8, autoAlpha: 0, duration: 0.4 }, 0.85)
      // 連結按鈕 stagger 進場
      .from('#link-list li', { y: 16, autoAlpha: 0, duration: 0.4, stagger: 0.07 }, 0.9)
      // 微註記閃爍進場
      .from('.hud-bar__id, .hud-bar__status, #spec', {
        keyframes: [
          { opacity: 0, duration: 0 },
          { opacity: 1, duration: 0.06 },
          { opacity: 0.3, duration: 0.06 },
          { opacity: 1, duration: 0.1 }
        ]
      }, 1.1);

    // 待機掃描線：每 7 秒低調掃一次
    const idle = gsap.timeline({ repeat: -1, repeatDelay: 7, delay: 4 });
    idle.fromTo('.layer-scanline',
      { y: -160, opacity: 0.5 },
      { y: function () { return window.innerHeight + 160; }, duration: 2.4, ease: 'none' });

    return function () {
      boot.kill();
      idle.kill();
    };
  });

  /* ---- Context C：桌機增強 ---- */
  mm.add('(prefers-reduced-motion: no-preference) and (pointer: fine) and (min-width: 768px)', function () {
    const cleanups = [];

    // 磁吸按鈕：quickTo 免 tween 重複配置，位移上限 ±6px
    document.querySelectorAll('.link-card').forEach(function (btn) {
      btn.style.willChange = 'transform';
      const xTo = gsap.quickTo(btn, 'x', { duration: 0.35, ease: 'power3' });
      const yTo = gsap.quickTo(btn, 'y', { duration: 0.35, ease: 'power3' });

      function onMove(e) {
        const r = btn.getBoundingClientRect();
        const relX = (e.clientX - r.left - r.width / 2) / (r.width / 2);
        const relY = (e.clientY - r.top - r.height / 2) / (r.height / 2);
        xTo(gsap.utils.clamp(-6, 6, relX * 6));
        yTo(gsap.utils.clamp(-6, 6, relY * 6));
      }
      function onLeave() { xTo(0); yTo(0); }

      btn.addEventListener('pointermove', onMove);
      btn.addEventListener('pointerleave', onLeave);
      cleanups.push(function () {
        btn.removeEventListener('pointermove', onMove);
        btn.removeEventListener('pointerleave', onLeave);
        btn.style.willChange = '';
        gsap.set(btn, { x: 0, y: 0 });
      });
    });

    // 捲動視差：頁面有足夠捲動距離才建 trigger
    if (window.ScrollTrigger &&
        document.documentElement.scrollHeight > window.innerHeight * 1.15) {
      const parallax = [
        ['.layer-grid',      { yPercent: -6 }],
        ['.hud-corners span', { yPercent: -12 }],
        ['.spec-notes',      { yPercent: -18 }],
        ['.avatar-frame',    { y: -20 }]
      ].map(function (pair) {
        return gsap.to(pair[0], Object.assign({}, pair[1], {
          ease: 'none',
          scrollTrigger: {
            trigger: document.body,
            start: 'top top',
            end: 'bottom bottom',
            scrub: true
          }
        }));
      });
      cleanups.push(function () {
        parallax.forEach(function (t) {
          if (t.scrollTrigger) t.scrollTrigger.kill();
          t.kill();
        });
      });
    }

    // 頭像指標傾斜 ±3deg
    const avatar = document.querySelector('.avatar-frame');
    if (avatar) {
      const rxTo = gsap.quickTo(avatar, 'rotationX', { duration: 0.4, ease: 'power2' });
      const ryTo = gsap.quickTo(avatar, 'rotationY', { duration: 0.4, ease: 'power2' });
      const zone = document.getElementById('identity');

      function onTilt(e) {
        const r = zone.getBoundingClientRect();
        const relX = (e.clientX - r.left - r.width / 2) / (r.width / 2);
        const relY = (e.clientY - r.top - r.height / 2) / (r.height / 2);
        ryTo(gsap.utils.clamp(-3, 3, relX * 3));
        rxTo(gsap.utils.clamp(-3, 3, -relY * 3));
      }
      function onTiltLeave() { rxTo(0); ryTo(0); }

      zone.addEventListener('pointermove', onTilt);
      zone.addEventListener('pointerleave', onTiltLeave);
      cleanups.push(function () {
        zone.removeEventListener('pointermove', onTilt);
        zone.removeEventListener('pointerleave', onTiltLeave);
        gsap.set(avatar, { rotationX: 0, rotationY: 0 });
      });
    }

    return function () {
      cleanups.forEach(function (fn) { fn(); });
    };
  });
})();
