/* Acceso a los programas de la Academy: primero hay que mirar el video de venta completo.
   La marca se guarda en este navegador (localStorage). Es un control de recorrido, no de seguridad. */
(function () {
  var K = 'gii_vsl_visto', M = 'gii_vsl_max', mem = {};
  function get(k) { try { var v = localStorage.getItem(k); return v === null ? (mem[k] || null) : v; } catch (e) { return mem[k] || null; } }
  function set(k, v) { mem[k] = String(v); try { localStorage.setItem(k, String(v)); } catch (e) {} }
  function visto() { return !!get(K); }
  var DEST = /^\/academy\/(1a1|grupal)$/;
  var path = location.pathname.replace(/\/$/, '') || '/';
  function ir(p) { return '/aprender-ia?siguiente=' + encodeURIComponent(p) + '#video'; }

  // 1) Las p\u00e1ginas de inscripci\u00f3n no se abren sin haber visto el video.
  if (DEST.test(path) && !visto()) { location.replace(ir(path)); return; }

  function aviso(msg) {
    var t = document.getElementById('gii-gate-toast');
    if (!t) {
      t = document.createElement('div'); t.id = 'gii-gate-toast'; t.setAttribute('role', 'status');
      t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;max-width:min(92vw,460px);padding:12px 18px;border-radius:14px;background:#0d1a2e;color:#F2F4F7;border:1px solid rgba(0,200,255,.4);box-shadow:0 20px 50px rgba(0,0,0,.5);font:500 14px Poppins,system-ui,sans-serif;text-align:center';
      document.body.appendChild(t);
    }
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(t._h); t._h = setTimeout(function () { t.style.display = 'none'; }, 4200);
  }

  // 2) Cualquier enlace a una inscripci\u00f3n pasa primero por el video.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]'); if (!a || visto()) return;
    var u; try { u = new URL(a.href, location.href); } catch (x) { return; }
    var p = u.pathname.replace(/\/$/, '');
    if (u.origin !== location.origin || !DEST.test(p)) return;
    e.preventDefault();
    if (path === '/aprender-ia') {
      aviso('Primero mir\u00e1 el video completo para habilitar la inscripci\u00f3n.');
      var v = document.getElementById('video'); if (v) v.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else { location.href = ir(p); }
  }, true);

  // 3) En la p\u00e1gina del video: se desbloquea al verlo completo (sin adelantar).
  function init() {
    var vid = document.getElementById('vid-principal'); if (!vid) return;
    var gate = document.getElementById('vsl-gate'), fill = document.getElementById('vg-fill'),
        go = document.getElementById('vg-go'), txt = document.getElementById('vg-t');
    var sig = new URLSearchParams(location.search).get('siguiente');
    if (!sig || !DEST.test(sig)) sig = null;
    var max = parseFloat(get(M)) || 0;
    function ui(done) {
      document.documentElement.classList.toggle('vsl-locked', !done);
      if (!gate) return;
      gate.setAttribute('data-estado', done ? 'listo' : 'bloqueado');
      if (done) {
        if (txt) txt.innerHTML = '<b>Listo.</b> Ya pod\u00e9s elegir tu programa e inscribirte.';
        if (fill) fill.style.width = '100%';
        if (go) { go.hidden = false; go.href = sig || '#programas'; go.textContent = sig ? 'Continuar con mi inscripci\u00f3n \u2192' : 'Elegir mi programa \u2192'; }
      }
    }
    function marcar() { set(K, Date.now()); ui(true); }
    ui(visto());
    if (visto()) return;
    vid.addEventListener('timeupdate', function () {
      var d = vid.duration || 0;
      if (!vid.seeking && vid.currentTime > max && vid.currentTime - max < 2.5) { max = vid.currentTime; set(M, max); }
      if (fill && d) fill.style.width = Math.min(100, Math.round(max / d * 100)) + '%';
      if (d && max / d >= 0.97) marcar();
    });
    vid.addEventListener('seeking', function () { if (vid.currentTime > max + 1) vid.currentTime = max; });
    vid.addEventListener('ended', marcar);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
