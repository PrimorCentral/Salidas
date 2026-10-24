/* SALIDAS · js/login-estaciones.js — Partículas del fondo del login según la
 * estación del año (solo decoración).
 *
 *   Primavera (21 mar – 20 jun): flores de cerezo, pétalos y mariposas
 *   Verano    (21 jun – 22 sep): soles pequeños y pompas que suben
 *   Otoño     (23 sep – 7 dic):  hojas de arce que caen balanceándose
 *   Navidad   (8 dic – 6 ene):   nieve, copos, estrellas y bolas de árbol
 *   Invierno  (7 ene – 20 mar):  copos de nieve de seis brazos y nieve fina
 *
 * Interactivo: al pasar el ratón (o el dedo) las partículas se apartan, y un
 * clic/toque fuera del panel de login suelta un puñado más.
 *
 * Va con JavaScript (canvas + requestAnimationFrame) y NO con animaciones CSS
 * a propósito: en los PCs del trabajo con los "efectos de animación" de
 * Windows desactivados las animaciones CSS no salen (ver styles.css, login).
 * Se para sola mientras el login está oculto o la pestaña no se ve.
 *
 * Para probar una estación concreta: añadir ?estacion=primavera (verano,
 * otono, invierno, navidad) a la dirección de la app. */
(function () {
  const caja = document.getElementById('login-polvo');
  const pantalla = document.getElementById('login-screen');
  if (!caja || !pantalla) return;

  const lienzo = document.createElement('canvas');
  lienzo.className = 'login-estaciones';
  caja.appendChild(lienzo);
  const cx = lienzo.getContext('2d');
  if (!cx) return;

  // Temas: tinte suave sobre la foto, cantidad de partículas y qué tipos
  // salen (con su peso: más peso = salen más).
  const TEMAS = {
    primavera: { tinte: 'rgba(237,147,177,.10)', n: 34, tipos: [['flor', 5], ['petalo', 4], ['mariposa', 1]] },
    verano:    { tinte: 'rgba(250,199,117,.12)', n: 30, tipos: [['sol', 2], ['pompa', 3]] },
    otono:     { tinte: 'rgba(216,90,48,.10)',   n: 28, tipos: [['arce', 3], ['hojita', 1]] },
    invierno:  { tinte: 'rgba(133,183,235,.10)', n: 80, tipos: [['copo', 1], ['nieve', 4]] },
    navidad:   { tinte: 'rgba(226,75,74,.06)',   n: 70, tipos: [['nieve', 8], ['copo', 2], ['estrella', 2], ['bola', 1]] }
  };
  const TAMANOS = {
    flor: [5, 8], petalo: [3, 5], mariposa: [7, 10], sol: [6, 10], pompa: [4, 10],
    arce: [9, 15], hojita: [5, 8], copo: [6, 11], nieve: [1.2, 3], estrella: [4, 7], bola: [4, 6]
  };
  const SUBEN = { sol: 1, pompa: 1 };

  function estacionDeHoy() {
    try {
      const forzada = new URLSearchParams(location.search).get('estacion');
      if (forzada && TEMAS[forzada]) return forzada;
    } catch (e) { /* sin parámetro */ }
    const hoy = new Date();
    const md = (hoy.getMonth() + 1) * 100 + hoy.getDate(); // 24 oct -> 1024
    if (md >= 1208 || md <= 106) return 'navidad';
    if (md <= 320) return 'invierno';
    if (md <= 620) return 'primavera';
    if (md <= 922) return 'verano';
    return 'otono';
  }

  const tema = TEMAS[estacionDeHoy()];

  // Etiqueta con la estación actual, abajo a la derecha de la foto.
  const ICONOS = {
    primavera: '<circle cx="12" cy="12" r="2.2"/><path d="M12 9.8c-1.5-3-1-5.8 0-6.8 1 1 1.5 3.8 0 6.8zM14.1 11.3c2.7-1.9 5.5-2 6.8-1.3-.5 1.3-2.9 2.8-6.8 1.3zM13.3 14c1.2 3.1.6 5.9-.6 6.7-.8-1.2-.9-4 .6-6.7zM10.7 14c-1.5 2.7-1.4 5.5-.6 6.7-1.2-.8-1.8-3.6-.6-6.7zM9.9 11.3c-3.9 1.5-6.3 0-6.8-1.3 1.3-.7 4.1-.6 6.8 1.3z"/>',
    verano:    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    otono:     '<path d="M12 3l1.6 3.4 2.6-1.2-.4 3.6 3.6-.6-1.4 2.6 2.4 1.4-3.4 1.6.8 2.6-3.4-.8L12 18l-2.4-2.4-3.4.8.8-2.6-3.4-1.6 2.4-1.4L4.6 8.2l3.6.6-.4-3.6 2.6 1.2z"/><path d="M12 13v8"/>',
    invierno:  '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M12 5l-2-2M12 5l2-2M12 19l-2 2M12 19l2 2"/>',
    navidad:   '<path d="M12 2l1.2 2.6 2.8.3-2.1 1.9.6 2.8L12 8.2 9.5 9.6l.6-2.8L8 4.9l2.8-.3z"/><path d="M12 9l-5 7h3l-4 4h12l-4-4h3z"/>'
  };
  const NOMBRES = { primavera: 'Primavera', verano: 'Verano', otono: 'Otoño', invierno: 'Invierno', navidad: 'Navidad' };
  const hero = pantalla.querySelector('.login-hero');
  if (hero) {
    const est = estacionDeHoy();
    const etiqueta = document.createElement('div');
    etiqueta.className = 'login-estacion login-entra';
    etiqueta.style.animationDelay = '1.6s';
    etiqueta.setAttribute('aria-hidden', 'true');
    etiqueta.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#f2b765" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICONOS[est] + '</svg>' + NOMBRES[est];
    hero.appendChild(etiqueta);
  }
  let W = 0, H = 0, ps = [];
  const raton = { x: -999, y: -999 };

  const azar = function (a) { return a[Math.floor(Math.random() * a.length)]; };
  function elegirTipo() {
    let total = 0;
    tema.tipos.forEach(function (t) { total += t[1]; });
    let r = Math.random() * total;
    for (const t of tema.tipos) { if ((r -= t[1]) < 0) return t[0]; }
    return tema.tipos[0][0];
  }

  function nueva(x, y, repartida) {
    const k = elegirTipo();
    const sube = SUBEN[k];
    const z = TAMANOS[k];
    const p = {
      k: k,
      x: x != null ? x : Math.random() * W,
      y: y != null ? y : (repartida ? Math.random() * H : (sube ? H + 20 : -20)),
      fase: Math.random() * 6.28, giro: Math.random() * 6.28, vg: (Math.random() - 0.5) * 0.04,
      ex: 0, ey: 0, a: 0.7 + Math.random() * 0.3,
      r: z[0] + Math.random() * (z[1] - z[0])
    };
    p.vy = sube ? -(0.3 + Math.random() * 0.5)
      : k === 'mariposa' ? 0.15
      : k === 'nieve' ? 0.5 + Math.random() * 0.8
      : 0.4 + Math.random() * 0.6;
    p.c = (k === 'flor' || k === 'petalo') ? azar(['#f4c0d1', '#fbeaf0', '#ed93b1'])
      : k === 'mariposa' ? azar(['#fac775', '#85b7eb', '#f4c0d1'])
      : (k === 'arce' || k === 'hojita') ? azar(['#d85a30', '#ef9f27', '#ba7517', '#a32d2d'])
      : k === 'bola' ? azar(['#e24b4a', '#378add', '#ef9f27'])
      : '#fff';
    return p;
  }

  function ajustarTamano() {
    const r = pantalla.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!r.width || !r.height) return;
    const primeraVez = !W;
    W = r.width; H = r.height;
    lienzo.width = Math.round(W * dpr); lienzo.height = Math.round(H * dpr);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (primeraVez) { ps = []; for (let i = 0; i < tema.n; i++) ps.push(nueva(null, null, true)); }
  }

  // ---------- Dibujo de cada forma ----------
  function hojaArce(r) {
    const pts = [[0,-1],[.18,-.55],[.45,-.7],[.38,-.3],[.85,-.38],[.7,-.12],[.95,.1],[.5,.18],[.55,.45],[.12,.3],[0,.55],[-.12,.3],[-.55,.45],[-.5,.18],[-.95,.1],[-.7,-.12],[-.85,-.38],[-.38,-.3],[-.45,-.7],[-.18,-.55]];
    cx.beginPath();
    pts.forEach(function (q, i) { if (i) cx.lineTo(q[0] * r, q[1] * r); else cx.moveTo(q[0] * r, q[1] * r); });
    cx.closePath(); cx.fill();
    cx.strokeStyle = 'rgba(60,20,5,.55)'; cx.lineWidth = 1.2;
    cx.beginPath(); cx.moveTo(0, -r * 0.6); cx.lineTo(0, r * 1.05); cx.stroke();
  }
  function copo(r) {
    cx.strokeStyle = '#fff'; cx.lineWidth = 1.3; cx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      cx.save(); cx.rotate(i * Math.PI / 3); cx.beginPath();
      cx.moveTo(0, 0); cx.lineTo(0, -r);
      cx.moveTo(0, -r * .5); cx.lineTo(r * .28, -r * .75); cx.moveTo(0, -r * .5); cx.lineTo(-r * .28, -r * .75);
      cx.moveTo(0, -r * .78); cx.lineTo(r * .18, -r * .95); cx.moveTo(0, -r * .78); cx.lineTo(-r * .18, -r * .95);
      cx.stroke(); cx.restore();
    }
  }
  function flor(r, c) {
    cx.fillStyle = c;
    for (let i = 0; i < 5; i++) {
      cx.save(); cx.rotate(i * Math.PI * 2 / 5);
      cx.beginPath(); cx.ellipse(0, -r * .6, r * .42, r * .6, 0, 0, 6.28); cx.fill(); cx.restore();
    }
    cx.fillStyle = '#ef9f27'; cx.beginPath(); cx.arc(0, 0, r * .25, 0, 6.28); cx.fill();
  }
  function mariposa(r, c, f) {
    const s = 0.25 + 0.75 * Math.abs(Math.sin(f * 6)); // aleteo
    cx.fillStyle = c; cx.save(); cx.scale(s, 1);
    cx.beginPath(); cx.ellipse(-r * .55, -r * .3, r * .55, r * .45, -.4, 0, 6.28); cx.ellipse(r * .55, -r * .3, r * .55, r * .45, .4, 0, 6.28); cx.fill();
    cx.beginPath(); cx.ellipse(-r * .4, r * .35, r * .35, r * .3, .4, 0, 6.28); cx.ellipse(r * .4, r * .35, r * .35, r * .3, -.4, 0, 6.28); cx.fill();
    cx.restore();
    cx.fillStyle = '#2c2c2a'; cx.fillRect(-1, -r * .6, 2, r * 1.2);
  }
  function sol(r) {
    cx.fillStyle = '#fac775'; cx.strokeStyle = '#fac775'; cx.lineWidth = 1.6; cx.lineCap = 'round';
    cx.beginPath(); cx.arc(0, 0, r * .5, 0, 6.28); cx.fill();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      cx.beginPath(); cx.moveTo(Math.cos(a) * r * .7, Math.sin(a) * r * .7); cx.lineTo(Math.cos(a) * r, Math.sin(a) * r); cx.stroke();
    }
  }
  function pompa(r) {
    cx.strokeStyle = 'rgba(181,212,244,.8)'; cx.lineWidth = 1;
    cx.beginPath(); cx.arc(0, 0, r, 0, 6.28); cx.stroke();
    cx.strokeStyle = 'rgba(255,255,255,.8)';
    cx.beginPath(); cx.arc(0, 0, r * .65, 3.6, 4.5); cx.stroke();
  }
  function estrella(r) {
    cx.fillStyle = '#fac775'; cx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * .42 : r, a = -Math.PI / 2 + i * Math.PI / 5;
      cx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    cx.closePath(); cx.fill();
  }
  function bola(r, c) {
    cx.fillStyle = c; cx.beginPath(); cx.arc(0, 0, r, 0, 6.28); cx.fill();
    cx.fillStyle = '#d3d1c7'; cx.fillRect(-r * .35, -r * 1.35, r * .7, r * .45);
    cx.fillStyle = 'rgba(255,255,255,.55)'; cx.beginPath(); cx.arc(-r * .35, -r * .3, r * .25, 0, 6.28); cx.fill();
  }

  function dibujar(p, tm) {
    const k = p.k;
    cx.save(); cx.translate(p.x, p.y); cx.globalAlpha = p.a;
    if (k !== 'mariposa' && k !== 'bola' && k !== 'pompa') cx.rotate(p.giro);
    if (k === 'bola') cx.rotate(Math.sin(p.fase * 2) * 0.4);
    if (k === 'arce' || k === 'hojita') { cx.scale(0.55 + 0.45 * Math.cos(p.fase * 1.7), 1); cx.fillStyle = p.c; hojaArce(p.r); }
    else if (k === 'copo') copo(p.r);
    else if (k === 'nieve') { cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(0, 0, p.r, 0, 6.28); cx.fill(); }
    else if (k === 'flor') flor(p.r, p.c);
    else if (k === 'petalo') { cx.scale(1, 0.5 + 0.5 * Math.abs(Math.sin(p.giro * 2))); cx.fillStyle = p.c; cx.beginPath(); cx.ellipse(0, 0, p.r, p.r * .55, 0, 0, 6.28); cx.fill(); }
    else if (k === 'mariposa') mariposa(p.r, p.c, p.fase);
    else if (k === 'sol') sol(p.r);
    else if (k === 'pompa') pompa(p.r);
    else if (k === 'estrella') { cx.globalAlpha = p.a * (0.6 + 0.4 * Math.abs(Math.sin(tm / 500 + p.fase))); estrella(p.r); }
    else if (k === 'bola') bola(p.r, p.c);
    cx.restore();
  }

  // ---------- Bucle ----------
  let enMarcha = false;
  function loginVisible() {
    // (offsetParent no vale aquí: #login-screen es position: fixed)
    return !document.hidden && getComputedStyle(pantalla).display !== 'none';
  }
  function bucle(tm) {
    if (!loginVisible()) { enMarcha = false; return; }
    if (!W) ajustarTamano();
    cx.clearRect(0, 0, W, H);
    cx.fillStyle = tema.tinte; cx.fillRect(0, 0, W, H);
    for (const p of ps) {
      p.fase += 0.012; p.giro += p.vg;
      const dx = p.x - raton.x, dy = p.y - raton.y, d = Math.hypot(dx, dy);
      if (d < 95 && d > 0.1) { const f = (95 - d) / 95 * 2.4; p.ex += dx / d * f; p.ey += dy / d * f; }
      p.ex *= 0.92; p.ey *= 0.92;
      let vx = Math.sin(p.fase) * ((p.k === 'arce' || p.k === 'hojita') ? 1.2 : (p.k === 'flor' || p.k === 'petalo') ? 0.7 : 0.35);
      let vy = p.vy;
      if (p.k === 'mariposa') { vx = Math.sin(p.fase * 0.7) * 1.2; vy = Math.sin(p.fase * 1.9) * 0.8 + 0.05; }
      p.x += vx + p.ex; p.y += vy + p.ey;
      if (p.vy > 0 && p.y > H + 30) Object.assign(p, nueva());
      if (p.vy < 0 && p.y < -30) Object.assign(p, nueva());
      if (p.x < -30) p.x = W + 30;
      if (p.x > W + 30) p.x = -30;
      if (p.k === 'mariposa' && (p.y < -30 || p.y > H + 30)) p.y = Math.random() * H;
      dibujar(p, tm);
    }
    if (ps.length > tema.n * 2) ps.splice(tema.n, ps.length - tema.n * 2);
    requestAnimationFrame(bucle);
  }
  function arrancar() {
    if (enMarcha || !loginVisible()) return;
    enMarcha = true;
    requestAnimationFrame(bucle);
  }

  // ---------- Interacción ----------
  function posicion(clientX, clientY) {
    const r = pantalla.getBoundingClientRect();
    raton.x = clientX - r.left; raton.y = clientY - r.top;
  }
  pantalla.addEventListener('mousemove', function (e) { posicion(e.clientX, e.clientY); });
  pantalla.addEventListener('mouseleave', function () { raton.x = raton.y = -999; });
  pantalla.addEventListener('touchmove', function (e) {
    if (e.touches[0]) posicion(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  pantalla.addEventListener('touchend', function () { raton.x = raton.y = -999; }, { passive: true });
  pantalla.addEventListener('click', function (e) {
    // En el panel (usuario, contraseña, Entrar) no se sueltan partículas.
    if (e.target.closest && e.target.closest('.login-panel')) return;
    const r = pantalla.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    for (let i = 0; i < 10; i++) {
      const p = nueva(x, y), a = Math.random() * 6.28, v = 2 + Math.random() * 3;
      p.ex = Math.cos(a) * v; p.ey = Math.sin(a) * v; ps.push(p);
    }
  });

  window.addEventListener('resize', ajustarTamano);
  document.addEventListener('visibilitychange', arrancar);
  // Al cerrar sesión (sesion.js vuelve a mostrar el login) se reanuda.
  new MutationObserver(arrancar).observe(pantalla, { attributes: true, attributeFilter: ['style'] });

  ajustarTamano();
  arrancar();
})();
