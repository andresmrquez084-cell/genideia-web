/* =========================================================================
   GENIDEIA Academy · capa de interacción premium
   Se carga después del script principal de index.html. No cambia los datos:
   lee `data`, `MODULES` y las funciones del panel, y agrega encima:
   intro, fondo animado, pestañas con indicador, portada con el recorrido de
   cada alumno, pizarra de clases (tablero, matriz y cronología), contadores,
   aparición al bajar, brillo que sigue al cursor y filtros del banco de problemas.
   ========================================================================= */
(function () {
  'use strict';
  if (typeof data === 'undefined' || typeof renderAll !== 'function') return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var esc = function (v) { return escapeHtml(v); };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('ac-ui-' + k); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('ac-ui-' + k, v); } catch (e) {} }
  };
  var MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

  document.documentElement.classList.add('ac-js');

  /* ---------- estado de cada módulo para cada alumno ---------- */
  function norm(st) {
    st = String(st || '').toLowerCase();
    if (/complet|finaliz|resuelt/.test(st)) return 'done';
    if (/pendiente|planific|^$/.test(st)) return 'todo';
    return 'now';
  }
  var LABEL = { done: 'Completado', now: 'En curso', todo: 'Pendiente' };
  function journey(s) {
    var plan = planForStudent(s.id), mods = modulesForStudent(s.id), sess = sessionsForStudent(s.id);
    return mods.map(function (m) {
      var list = sess.filter(function (x) { return x.moduleId === m.id; });
      var se = list[list.length - 1] || null;
      var st;
      if (plan) st = norm(m.state);
      else if (se) st = norm(se.status) === 'done' || norm(s.status) === 'done' ? 'done' : 'now'; // alumno finalizado: todo lo cursado cuenta como completado
      else st = Number(s.currentModule) === m.id && norm(s.status) !== 'done' ? 'now' : 'todo';
      return { m: m, se: se, st: st, s: s };
    });
  }
  function colorIdx(s) { var i = data.students.indexOf(s); return 'c' + ((i < 0 ? 0 : i) % 4 + 1); }
  function av(s) { return '<span class="ac-av ' + colorIdx(s) + '">' + esc(s.initials || (s.name || 'AL').slice(0, 2).toUpperCase()) + '</span>'; }
  function firstName(s) { return String(s.name || '').split(' ')[0]; }
  function fechaLarga(iso) { if (!iso) return ''; var p = iso.split('-'); return Number(p[2]) + ' de ' + MESES[Number(p[1]) - 1]; }
  function open(it) {
    if (it.se) { openSessionDetail(it.se.id); return; }
    showView('alumnos'); openStudentDetail(it.s.id);
  }

  /* ---------- fondo, halo e intro ---------- */
  document.body.insertAdjacentHTML('afterbegin',
    '<div class="ac-ambient" aria-hidden="true"><i class="b1"></i><i class="b2"></i><i class="b3"></i></div>' +
    '<div class="ac-grain" aria-hidden="true"></div><div class="ac-halo" aria-hidden="true"></div>');
  var logoSrc = ($('.top .logo img') || {}).getAttribute ? $('.top .logo img').getAttribute('src') : 'assets/academy-logo.svg';
  var introSeen = false;
  try { introSeen = sessionStorage.getItem('ac-intro') === '1'; sessionStorage.setItem('ac-intro', '1'); } catch (e) {}
  if (!reduce && !introSeen) {
    var intro = document.createElement('div');
    intro.className = 'ac-intro'; intro.setAttribute('aria-hidden', 'true');
    intro.innerHTML = '<div class="ac-intro-in"><img src="' + esc(logoSrc) + '" alt=""><b>GENIDEIA <span>ACADEMY</span></b><small>Sistema de aprendizaje aplicado</small><div class="ac-bar"><i></i></div></div>';
    document.body.appendChild(intro);
    setTimeout(function () { intro.classList.add('out'); setTimeout(function () { intro.remove(); }, 900); }, 1500);
  }

  var halo = $('.ac-halo');
  if (fine && !reduce) {
    var hx = innerWidth / 2, hy = innerHeight / 3, tx = hx, ty = hy, raf = 0;
    addEventListener('pointermove', function (e) {
      tx = e.clientX; ty = e.clientY; halo.classList.add('on');
      if (!raf) raf = requestAnimationFrame(loop);
      var c = e.target.closest && e.target.closest('.ac-spot');
      if (c) { var r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); }
    }, { passive: true });
    function loop() { hx += (tx - hx) * .14; hy += (ty - hy) * .14; halo.style.transform = 'translate(' + hx + 'px,' + hy + 'px)'; raf = Math.abs(tx - hx) + Math.abs(ty - hy) > .5 ? requestAnimationFrame(loop) : 0; }
  }

  /* ---------- barra de progreso del scroll ---------- */
  var top = $('.top');
  top.insertAdjacentHTML('beforeend', '<span class="ac-prog" aria-hidden="true"><i></i></span>');
  var progI = $('.ac-prog i');
  function onScroll() { var h = document.documentElement.scrollHeight - innerHeight; progI.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, scrollY / h) : 0) + ')'; }
  addEventListener('scroll', function () { onScroll(); if (typeof tip !== 'undefined') tip.classList.remove('on'); }, { passive: true });

  /* ---------- pestaña nueva "Pizarra" e indicador deslizante ---------- */
  var nav = $('.nav');
  var inicioBtn = $('.nav button[data-view="inicio"]');
  inicioBtn.insertAdjacentHTML('afterend', '<button data-view="pizarra" onclick="showView(\'pizarra\')">Pizarra<span class="ac-new">nuevo</span></button>');
  nav.insertAdjacentHTML('beforeend', '<span class="ac-ind" aria-hidden="true"></span>');
  var ind = $('.ac-ind');
  function moveInd() {
    var b = $('.nav button.active'); if (!b) return;
    ind.style.width = b.offsetWidth + 'px'; ind.style.transform = 'translateX(' + b.offsetLeft + 'px)';
    if (b.scrollIntoView && nav.scrollWidth > nav.clientWidth) { var l = b.offsetLeft - (nav.clientWidth - b.offsetWidth) / 2; nav.scrollTo({ left: l, behavior: reduce ? 'auto' : 'smooth' }); }
  }
  addEventListener('resize', moveInd);

  /* ---------- sección de la pizarra ---------- */
  $('#view-inicio').insertAdjacentHTML('afterend',
    '<section id="view-pizarra" class="view">' +
      '<div class="ac-board-head"><div><div class="eyebrow">Pizarra de clases</div><h1>Cada módulo, cada alumno, <span style="color:var(--s)">de un vistazo.</span></h1><p class="lead">Filtrá por alumno, buscá un tema y cambiá la vista. Cada tarjeta abre la sesión o el perfil del alumno.</p></div></div>' +
      '<div class="ac-tools"><div class="ac-chips" id="acChips"></div><div class="ac-right"><label class="ac-search"><input id="acQ" type="search" placeholder="Buscar módulo o tema" aria-label="Buscar en la pizarra"></label>' +
      '<div class="ac-seg" id="acSeg"><span class="ac-segi"></span><button data-v="tablero">Tablero</button><button data-v="matriz">Matriz</button><button data-v="tiempo">Cronología</button></div></div></div>' +
      '<div class="ac-sum" id="acSum"></div>' +
      '<div id="acBoard"></div>' +
    '</section>');

  /* ---------- portada del inicio ---------- */
  var inicio = $('#view-inicio');
  var oldHead = $('.page-head', inicio);
  var leadTxt = oldHead && $('.lead', oldHead) ? $('.lead', oldHead).textContent : '';
  if (oldHead) oldHead.classList.add('ac-hidden');
  inicio.insertAdjacentHTML('afterbegin',
    '<div class="ac-hero">' +
      '<div class="ac-hero-copy">' +
        '<div class="eyebrow">Panel general · Academy</div>' +
        '<h1 class="ac-split">Aprendizaje aplicado, <em>clase por clase.</em></h1>' +
        '<p class="lead">' + esc(leadTxt) + '</p>' +
        '<div class="ac-cta"><button class="btn primary" onclick="showView(\'pizarra\')">Ver la pizarra de clases</button><button class="btn ghost" onclick="showView(\'alumnos\')">Ver alumnos</button></div>' +
        '<div class="ac-live"><span class="ac-dot"></span><span id="acLive"></span></div>' +
      '</div>' +
      '<div class="ac-win" id="acHeroWin"></div>' +
    '</div>');

  // título que aparece palabra por palabra
  function splitTitle(h) {
    if (h.dataset.split) return; h.dataset.split = 1;
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (w) {
            if (!w) return;
            if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
            var o = document.createElement('span'); o.className = 'ac-w';
            var t = document.createElement('span'); t.textContent = w; t.style.transitionDelay = (i++ * .07) + 's';
            o.appendChild(t); frag.appendChild(o);
          });
          n.replaceWith(frag);
        } else walk(n);
      });
    })(h);
    setTimeout(function () { h.classList.add('ac-on'); }, introSeen || reduce ? 60 : 1500);
  }
  splitTitle($('.ac-hero h1'));

  /* ---------- recorrido de 8 módulos (portada y perfil del alumno) ---------- */
  var W = 1000, H = 250;
  function points(n) {
    var a = [];
    for (var i = 0; i < n; i++) a.push([60 + i * (880 / Math.max(1, n - 1)), 125 + Math.sin(i * 1.05 + .5) * 70]);
    return a;
  }
  function pathD(p) {
    if (!p.length) return '';
    var d = 'M' + p[0][0] + ',' + p[0][1];
    for (var i = 1; i < p.length; i++) { var cx = (p[i - 1][0] + p[i][0]) / 2; d += ' C' + cx + ',' + p[i - 1][1] + ' ' + cx + ',' + p[i][1] + ' ' + p[i][0] + ',' + p[i][1]; }
    return d;
  }
  function trackWin(win, sid, opts) {
    opts = opts || {};
    var students = data.students;
    var s = students.find(function (x) { return x.id === sid; }) || students[0];
    if (!s) { win.innerHTML = '<div class="ac-win-body"><div class="empty">Todavía no hay alumnos.</div></div>'; return; }
    var items = journey(s), pts = points(items.length);
    var last = -1; for (var li = 0; li < items.length && items[li].st !== 'todo'; li++) last = li; // línea solo sobre el tramo continuo ya recorrido
    var sel = items.findIndex(function (it) { return it.st === 'now'; }); if (sel < 0) sel = Math.max(0, last);
    var done = items.filter(function (it) { return it.st === 'done'; }).length;
    var pct = Math.round(done / items.length * 100);
    var plan = planForStudent(s.id);
    var tabs = opts.tabs ? '<div class="ac-tabs" role="tablist">' + students.map(function (x) { return '<button role="tab" data-sid="' + esc(x.id) + '" class="' + (x.id === s.id ? 'on' : '') + '">' + av(x) + esc(firstName(x)) + '</button>'; }).join('') + '</div>' : '';
    win.innerHTML =
      '<div class="ac-win-top"><i></i><i></i><i></i><span class="ac-wt">' + (opts.tabs ? 'recorrido en vivo' : 'recorrido del alumno') + '</span>' + tabs + '</div>' +
      '<div class="ac-win-body">' +
        '<div class="ac-who ac-swap"><div><b>' + esc(s.name) + '</b><small>' + esc(plan ? plan.title : 'Programa general') + ' · ' + esc(s.status || '') + '</small></div><div class="ac-pct" data-to="' + pct + '">0<small>% completo</small></div></div>' +
        '<div class="ac-track"><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="acGrad" x1="0" x2="1"><stop offset="0" stop-color="#4BE39A"/><stop offset=".6" stop-color="#00C8FF"/><stop offset="1" stop-color="#007BFF"/></linearGradient></defs>' +
          '<path class="bg" d="' + pathD(pts) + '"/>' + (last > 0 ? '<path class="fg" d="' + pathD(pts.slice(0, last + 1)) + '"/>' : '') + '</svg>' +
          items.map(function (it, i) {
            return '<button class="ac-node s-' + it.st + (i === sel ? ' sel' : '') + '" data-i="' + i + '" style="left:' + (pts[i][0] / W * 100) + '%;top:' + (pts[i][1] / H * 100) + '%;animation-delay:' + (.15 + i * .08) + 's" aria-label="Módulo ' + pad(it.m.id) + ': ' + esc(it.m.title) + ', ' + LABEL[it.st] + '">' + (it.st === 'done' ? '✓' : pad(it.m.id)) + '<em>M' + pad(it.m.id) + '</em></button>';
          }).join('') +
        '</div>' +
        '<div class="ac-focus" id="' + (opts.id || 'acFocus') + '"></div>' +
      '</div>';

    var fg = $('.fg', win);
    if (fg && !reduce) {
      var L = fg.getTotalLength();
      fg.style.strokeDasharray = L; fg.style.strokeDashoffset = L;
      requestAnimationFrame(function () { requestAnimationFrame(function () { fg.style.transition = 'stroke-dashoffset 1.6s cubic-bezier(.4,0,.2,1)'; fg.style.strokeDashoffset = 0; }); });
    }
    countUp($('.ac-pct', win), pct, '<small>% completo</small>');

    function focus(i) {
      var it = items[i]; if (!it) return;
      $$('.ac-node', win).forEach(function (n) { n.classList.toggle('sel', Number(n.dataset.i) === i); });
      var f = $('.ac-focus', win);
      var meta = it.se ? 'Sesión del ' + fechaLarga(it.se.date) : (it.st === 'todo' ? 'Todavía sin sesión' : 'En preparación');
      f.innerHTML = '<div class="ac-fn">' + pad(it.m.id) + '</div><div class="ac-swap"><h4>' + esc(it.m.title) + ' <span class="pill ' + (it.st === 'done' ? 'done' : it.st === 'now' ? '' : 'pending') + '" style="margin-left:6px;vertical-align:2px">' + LABEL[it.st] + '</span></h4><p>' + esc(meta) + ' · ' + esc(it.m.objective || '') + '</p></div>' +
        '<button class="btn">' + (it.se ? 'Abrir sesión' : 'Ver alumno') + '</button>';
      $('.btn', f).onclick = function () { open(it); };
    }
    $$('.ac-node', win).forEach(function (n) {
      n.addEventListener('click', function () { focus(Number(n.dataset.i)); if (opts.onUser) opts.onUser(); });
      if (fine) n.addEventListener('mouseenter', function () { focus(Number(n.dataset.i)); if (opts.onUser) opts.onUser(); });
    });
    $$('.ac-tabs button', win).forEach(function (b) { b.addEventListener('click', function () { if (opts.onUser) opts.onUser(); trackWin(win, b.dataset.sid, opts); }); });
    focus(sel);
    win.dataset.sid = s.id;
  }

  // la portada recorre los alumnos sola hasta que alguien toca algo
  var heroWin = $('#acHeroWin'), heroTimer = 0, heroUser = false, heroVisible = true;
  var heroOpts = { tabs: true, onUser: function () { heroUser = true; clearInterval(heroTimer); } };
  function heroCycle() {
    clearInterval(heroTimer);
    if (reduce || heroUser || data.students.length < 2) return;
    heroTimer = setInterval(function () {
      if (!heroVisible || document.hidden || !inicio.classList.contains('active')) return;
      var i = data.students.findIndex(function (x) { return x.id === heroWin.dataset.sid; });
      trackWin(heroWin, data.students[(i + 1) % data.students.length].id, heroOpts);
    }, 7000);
  }
  function firstActive() {
    var s = data.students.find(function (x) { return norm(x.status) === 'now' || /curso|activo/i.test(x.status || ''); });
    return (s || data.students[0] || {}).id;
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { heroVisible = e[0].isIntersecting; }).observe(heroWin);
  if (fine && !reduce) {
    heroWin.addEventListener('mousemove', function (e) { var r = heroWin.getBoundingClientRect(); var x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; heroWin.style.transform = 'perspective(1200px) rotateY(' + (x * 5) + 'deg) rotateX(' + (-y * 4) + 'deg)'; });
    heroWin.addEventListener('mouseleave', function () { heroWin.style.transform = ''; });
  }

  /* ---------- contadores ---------- */
  function countUp(el, to, suffix) {
    if (!el) return; suffix = suffix || '';
    if (reduce) { el.innerHTML = to + suffix; return; }
    var t0 = null, dur = 1300;
    function step(t) { if (!t0) t0 = t; var p = Math.min(1, (t - t0) / dur); p = 1 - Math.pow(1 - p, 3); el.innerHTML = Math.round(to * p) + suffix; if (p < 1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  }
  var statsDone = false;
  var STAT_GO = { statStudents: 'alumnos', statModules: 'biblioteca', statSessions: 'sesiones', statIssues: 'problemas' };
  $$('.cards .stat').forEach(function (c) {
    var b = $('b', c); if (!b || !STAT_GO[b.id]) return;
    c.classList.add('ac-link'); c.setAttribute('role', 'button'); c.tabIndex = 0;
    c.insertAdjacentHTML('beforeend', '<span class="ac-go" aria-hidden="true">→</span>');
    c.addEventListener('click', function () { showView(STAT_GO[b.id]); });
    c.addEventListener('keydown', function (e) { if (e.key === 'Enter') showView(STAT_GO[b.id]); });
  });
  function animateStats() {
    if (statsDone) return; statsDone = true;
    $$('.cards .stat b').forEach(function (b) { var v = parseInt(b.textContent, 10) || 0; b.textContent = '0'; setTimeout(function () { countUp(b, v); }, introSeen ? 200 : 1500); });
  }

  /* ---------- aparición, brillo y detalles en todo lo que se renderiza ---------- */
  var CARD = '.stat,.panel,.student-card,.module-card,.row,.session,.issue,.ac-card,.ac-col';
  var io = 'IntersectionObserver' in window && !reduce ? new IntersectionObserver(function (ents) {
    ents.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('ac-in'); io.unobserve(e.target); } });
  }, { threshold: .08, rootMargin: '0px 0px -30px 0px' }) : null;
  function enhance() {
    var k = 0;
    $$(CARD).forEach(function (n) {
      if (n.dataset.acx) return; n.dataset.acx = 1;
      n.classList.add('ac-spot');
      if (io) { n.classList.add('ac-rv'); n.style.transitionDelay = (k++ % 8) * .05 + 's'; io.observe(n); }
    });
    $$('.module-card').forEach(function (c) { if (c.dataset.n) return; var b = $('b', c); var m = b && b.textContent.match(/(\d+)/); if (m) c.dataset.n = pad(m[1]); });
    $$('.progress span').forEach(function (sp) {
      if (sp.dataset.acx || reduce) return; sp.dataset.acx = 1;
      var w = sp.style.width; sp.style.width = '0';
      requestAnimationFrame(function () { requestAnimationFrame(function () { sp.style.width = w; }); });
    });
  }
  var mo = new MutationObserver(function () { clearTimeout(mo.t); mo.t = setTimeout(enhance, 30); });
  mo.observe($('.shell'), { childList: true, subtree: true });

  /* ---------- pizarra ---------- */
  var VIEWS = ['tablero', 'matriz', 'tiempo'];
  var bView = store.get('view', 'tablero'); if (VIEWS.indexOf(bView) < 0) bView = 'tablero';
  var bWho = store.get('who', 'all'), bQ = '';
  var tip = document.createElement('div'); tip.className = 'ac-tip'; document.body.appendChild(tip);

  function allItems() { var a = []; data.students.forEach(function (s) { a = a.concat(journey(s)); }); return a; }
  function match(it) {
    if (bWho !== 'all' && it.s.id !== bWho) return false;
    if (!bQ) return true;
    var hay = [it.m.title, it.m.objective, (it.m.topics || []).join(' '), it.s.name, 'M' + pad(it.m.id)].join(' ').toLowerCase();
    return hay.indexOf(bQ) >= 0;
  }
  function chips() {
    if (bWho !== 'all' && !data.students.some(function (s) { return s.id === bWho; })) bWho = 'all';
    $('#acChips').innerHTML = '<button class="ac-chip solo ' + (bWho === 'all' ? 'on' : '') + '" data-w="all">Todos</button>' +
      data.students.map(function (s) { return '<button class="ac-chip ' + (bWho === s.id ? 'on' : '') + '" data-w="' + esc(s.id) + '">' + av(s) + esc(firstName(s)) + '</button>'; }).join('');
    $$('#acChips .ac-chip').forEach(function (c) { c.onclick = function () { bWho = c.dataset.w; store.set('who', bWho); chips(); board(); }; });
  }
  function seg() {
    $$('#acSeg button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === bView); });
    var on = $('#acSeg button.on'), i = $('#acSeg .ac-segi');
    if (on) { i.style.width = on.offsetWidth + 'px'; i.style.transform = 'translateX(' + (on.offsetLeft - 3) + 'px)'; }
  }
  $$('#acSeg button').forEach(function (b) { b.onclick = function () { bView = b.dataset.v; store.set('view', bView); seg(); board(); }; });
  $('#acQ').addEventListener('input', function (e) { bQ = e.target.value.trim().toLowerCase(); board(); });

  function summary(items) {
    var c = { done: 0, now: 0, todo: 0 }; items.forEach(function (it) { c[it.st]++; });
    var t = items.length || 1;
    $('#acSum').innerHTML =
      '<div class="ac-card k-done"><small>Completados</small><b data-to="' + c.done + '">0</b></div>' +
      '<div class="ac-card k-now"><small>En curso</small><b data-to="' + c.now + '">0</b></div>' +
      '<div class="ac-card k-todo"><small>Pendientes</small><b data-to="' + c.todo + '">0</b></div>' +
      '<div class="ac-card k-bar"><small>Avance del programa · ' + Math.round(c.done / t * 100) + '% completo</small><div class="ac-stack"><i class="i-done" data-w="' + (c.done / t * 100) + '"></i><i class="i-now" data-w="' + (c.now / t * 100) + '"></i><i class="i-todo" data-w="' + (c.todo / t * 100) + '"></i></div>' +
      '<div class="ac-legend"><span style="--c:#4BE39A">Completado</span><span style="--c:#00C8FF">En curso</span><span style="--c:rgba(255,255,255,.3)">Pendiente</span></div></div>';
    $$('#acSum b[data-to]').forEach(function (b) { countUp(b, Number(b.dataset.to)); });
    requestAnimationFrame(function () { requestAnimationFrame(function () { $$('#acSum .ac-stack i').forEach(function (i) { i.style.width = i.dataset.w + '%'; }); }); });
  }

  function kcard(it, i) {
    var meta = it.se ? fechaLarga(it.se.date) : (it.st === 'todo' ? 'Sin sesión' : 'En preparación');
    return '<button class="ac-kcard s-' + it.st + ' ac-pop" style="animation-delay:' + Math.min(i, 14) * .035 + 's" data-k="' + esc(it.s.id) + '|' + it.m.id + '">' +
      '<span class="ac-k-top">' + av(it.s) + '<span class="ac-k-who">' + esc(it.s.name) + '</span><span class="ac-k-m">M' + pad(it.m.id) + '</span></span>' +
      '<b>' + esc(it.m.title) + '</b><span class="ac-k-meta"><span>' + esc(meta) + '</span><span class="go">' + (it.se ? 'Abrir sesión →' : 'Ver alumno →') + '</span></span></button>';
  }
  function bindOpen(root, items) {
    var map = {}; items.forEach(function (it) { map[it.s.id + '|' + it.m.id] = it; });
    $$('[data-k]', root).forEach(function (b) { b.addEventListener('click', function () { var it = map[b.dataset.k]; if (it) open(it); }); });
    return map;
  }

  function board() {
    if (!$('#acBoard')) return;
    tip.classList.remove('on');
    var all = allItems(), items = all.filter(match), out = $('#acBoard');
    summary(items);
    if (bView === 'tablero') {
      var cols = [['now', 'En curso'], ['todo', 'Pendientes'], ['done', 'Completados']];
      out.innerHTML = '<div class="ac-kanban">' + cols.map(function (c) {
        var list = items.filter(function (it) { return it.st === c[0]; });
        if (c[0] === 'done') list = list.slice().reverse();
        return '<div class="ac-col c-' + c[0] + '"><div class="ac-col-h"><b>' + c[1] + '</b><span>' + list.length + '</span></div><div class="ac-list">' +
          (list.length ? list.map(kcard).join('') : '<div class="ac-none">Nada por acá</div>') + '</div></div>';
      }).join('') + '</div>';
      bindOpen(out, items);
    } else if (bView === 'matriz') {
      var studs = data.students.filter(function (s) { return bWho === 'all' || s.id === bWho; });
      var n = Math.max.apply(null, [8].concat(studs.map(function (s) { return modulesForStudent(s.id).length; })));
      var head = '<tr><th>Alumno</th>' + Array.from({ length: n }, function (_, i) { return '<th data-c="' + i + '">M' + pad(i + 1) + '</th>'; }).join('') + '</tr>';
      var k = 0;
      var body = studs.map(function (s) {
        var row = journey(s);
        return '<tr><th><span class="n">' + av(s) + esc(s.name) + '</span></th>' + Array.from({ length: n }, function (_, i) {
          var it = row[i]; if (!it) return '<td></td>';
          var hit = match(it);
          return '<td><button class="ac-cell s-' + it.st + '" style="animation-delay:' + (k++ * .02) + 's;' + (hit ? '' : 'opacity:.18') + '" data-c="' + i + '" data-k="' + esc(s.id) + '|' + it.m.id + '" aria-label="' + esc(s.name) + ', módulo ' + pad(it.m.id) + ': ' + LABEL[it.st] + '">' + (it.st === 'done' ? '✓' : it.st === 'now' ? '●' : pad(it.m.id)) + '</button></td>';
        }).join('') + '</tr>';
      }).join('');
      out.innerHTML = '<div class="ac-mx-wrap"><table class="ac-mx"><thead>' + head + '</thead><tbody>' + (body || '<tr><td colspan="9" class="ac-none">Sin alumnos</td></tr>') + '</tbody></table></div>';
      var map = bindOpen(out, all), tbl = $('.ac-mx', out);
      $$('.ac-cell', out).forEach(function (c) {
        c.addEventListener('mouseenter', function () {
          var it = map[c.dataset.k]; if (!it) return;
          var col = c.dataset.c, tr = c.closest('tr');
          tbl.classList.add('dim');
          $$('.ac-cell', tbl).forEach(function (x) { x.classList.toggle('hl', x.dataset.c === col || x.closest('tr') === tr); });
          $$('thead th', tbl).forEach(function (h) { h.classList.toggle('hl', h.dataset.c === col); });
          tip.innerHTML = '<small>' + esc(it.s.name) + ' · M' + pad(it.m.id) + ' · ' + LABEL[it.st] + '</small><b>' + esc(it.m.title) + '</b><span>' + (it.se ? 'Sesión del ' + fechaLarga(it.se.date) : 'Todavía sin sesión registrada') + '</span>';
          var r = c.getBoundingClientRect();
          tip.style.left = Math.max(10, Math.min(innerWidth - 290, r.left + r.width / 2 - 140)) + 'px';
          tip.style.top = (r.top - 12 > 120 ? r.top - tip.offsetHeight - 10 : r.bottom + 10) + 'px';
          tip.classList.add('on');
        });
        c.addEventListener('mouseleave', function () { tbl.classList.remove('dim'); tip.classList.remove('on'); $$('.hl', tbl).forEach(function (x) { x.classList.remove('hl'); }); });
      });
    } else {
      var ses = data.sessions.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).map(function (se) {
        var s = studentById(se.studentId); if (!s) return null;
        var m = moduleForStudent(se.studentId, se.moduleId) || { id: se.moduleId, title: 'Módulo ' + se.moduleId, objective: '' };
        return { s: s, m: m, se: se, st: norm(se.status) === 'done' ? 'done' : norm(se.status) };
      }).filter(function (it) { return it && match(it); });
      var last = '', i = 0;
      out.innerHTML = ses.length ? '<div class="ac-time">' + ses.map(function (it) {
        var p = it.se.date.split('-'), mk = MESES[Number(p[1]) - 1] + ' ' + p[0], h = '';
        if (mk !== last) { h = '<div class="ac-month">' + mk + '</div>'; last = mk; }
        return h + '<button class="ac-titem s-' + it.st + ' ac-pop" style="animation-delay:' + Math.min(i++, 14) * .04 + 's" data-k="' + esc(it.s.id) + '|' + it.m.id + '|' + esc(it.se.id) + '"><span class="d"></span><time>' + Number(p[2]) + ' ' + MESES[Number(p[1]) - 1].slice(0, 3) + '</time><span style="min-width:0"><b>M' + pad(it.m.id) + ' · ' + esc(it.m.title) + '</b><small>' + esc(it.s.name) + '</small></span>' + pill(it.se.status) + '</button>';
      }).join('') + '</div>' : '<div class="ac-none">No hay sesiones que coincidan</div>';
      $$('[data-k]', out).forEach(function (b) { b.addEventListener('click', function () { openSessionDetail(b.dataset.k.split('|')[2]); }); });
    }
  }

  /* ---------- filtros del banco de problemas ---------- */
  var iCat = 'all';
  function issueFilter() {
    var grid = $('#issueGrid'); if (!grid) return;
    var bar = $('#acIf');
    if (!bar) { grid.insertAdjacentHTML('beforebegin', '<div class="ac-ifilter ac-chips" id="acIf"></div>'); bar = $('#acIf'); }
    var cats = []; data.issues.forEach(function (i) { var c = i.category || 'General'; if (cats.indexOf(c) < 0) cats.push(c); });
    if (iCat !== 'all' && cats.indexOf(iCat) < 0) iCat = 'all';
    bar.innerHTML = cats.length > 1 ? '<button class="ac-chip solo ' + (iCat === 'all' ? 'on' : '') + '" data-c="all">Todos · ' + data.issues.length + '</button>' + cats.map(function (c) {
      var n = data.issues.filter(function (i) { return (i.category || 'General') === c; }).length;
      return '<button class="ac-chip solo ' + (iCat === c ? 'on' : '') + '" data-c="' + esc(c) + '">' + esc(c) + ' · ' + n + '</button>';
    }).join('') : '';
    $$('.ac-chip', bar).forEach(function (b) { b.onclick = function () { iCat = b.dataset.c; issueFilter(); }; });
    $$('.issue', grid).forEach(function (el) { var eb = $('.eyebrow', el); var c = eb ? eb.textContent : 'General'; el.style.display = iCat === 'all' || c === iCat ? '' : 'none'; });
  }

  /* ---------- pie ---------- */
  $('main.shell').insertAdjacentHTML('afterend', '<footer class="ac-foot"><div class="s"><img src="' + esc(logoSrc) + '" alt=""><span><b>GENIDEIA ACADEMY</b><small>Sistema de aprendizaje aplicado</small></span></div><div class="r">GENIDEIA Company · ' + new Date().getFullYear() + '</div></footer>');

  /* ---------- enganche con el panel existente ---------- */
  function live() {
    var last = data.sessions.slice().sort(function (a, b) { return b.date.localeCompare(a.date); })[0];
    var el = $('#acLive'); if (!el) return;
    el.textContent = data.students.length + ' alumnos · ' + data.sessions.length + ' sesiones registradas' + (last ? ' · última clase el ' + fechaLarga(last.date) : '');
  }
  function refresh() {
    live();
    trackWin(heroWin, heroWin.dataset.sid && studentById(heroWin.dataset.sid) ? heroWin.dataset.sid : firstActive(), heroOpts);
    chips(); if ($('#view-pizarra').classList.contains('active')) board();
    issueFilter(); enhance();
  }
  var _renderAll = renderAll;
  renderAll = function () { _renderAll.apply(this, arguments); refresh(); };

  var _showView = showView;
  showView = function (name) {
    _showView.apply(this, arguments);
    tip.classList.remove('on');
    var v = document.getElementById('view-' + name);
    if (v && !reduce) { v.classList.remove('ac-enter'); void v.offsetWidth; v.classList.add('ac-enter'); }
    moveInd();
    if (name === 'pizarra') { chips(); seg(); board(); }
    if (name === 'problemas') issueFilter();
  };

  var _openStudentDetail = openStudentDetail;
  openStudentDetail = function (id) {
    _openStudentDetail.apply(this, arguments);
    var d = document.getElementById('student-detail'), head = d && $('.detail-head', d);
    if (!head) return;
    var w = document.createElement('div'); w.className = 'ac-win ac-mini';
    head.insertAdjacentElement('afterend', w);
    trackWin(w, id, { id: 'acFocusS' });
  };

  refresh();
  heroCycle();
  animateStats();
  requestAnimationFrame(moveInd);
  setTimeout(moveInd, 400);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { moveInd(); seg(); });
  onScroll();
})();
