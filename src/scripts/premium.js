// Movimiento del formato premium: títulos palabra por palabra, entrada al hacer scroll,
// luz que sigue al cursor y menú mobile. Sin dependencias.
(function () {
  var d = document;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $$ = function (s) { return [].slice.call(d.querySelectorAll(s)); };

  // Recorre solo los textos para respetar el <em> del destacado.
  $$('.px-split').forEach(function (h) {
    var i = 0;
    (function walk(n) {
      [].slice.call(n.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          var f = d.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach(function (w) {
            if (!w) return;
            if (/^\s+$/.test(w)) { f.appendChild(d.createTextNode(w)); return; }
            var o = d.createElement('span'); o.className = 'w';
            var t = d.createElement('span'); t.textContent = w; t.style.transitionDelay = (i++ * 0.06) + 's';
            o.appendChild(t); f.appendChild(o);
          });
          c.replaceWith(f);
        } else walk(c);
      });
    })(h);
  });

  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    $$('.px-rv,.px-split').forEach(function (el) { io.observe(el); });
  } else {
    d.documentElement.classList.remove('pxj');
  }

  if (fine) d.addEventListener('pointermove', function (e) {
    var c = e.target.closest && e.target.closest('.px-spot');
    if (!c) return;
    var r = c.getBoundingClientRect();
    c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    c.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });

  var btn = d.getElementById('px-burger'), menu = d.getElementById('px-menu');
  if (btn && menu) {
    btn.addEventListener('click', function () {
      var open = !menu.classList.contains('is-open');
      menu.classList.toggle('is-open', open); btn.classList.toggle('is-open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { menu.classList.remove('is-open'); btn.classList.remove('is-open'); btn.setAttribute('aria-expanded', 'false'); });
    });
  }
})();
