/* ============================================================================
   GENIDEIA — reveal.js : scroll reveals + loader.
   Compatible con Astro View Transitions (escucha astro:page-load) y con
   sitios estáticos (fallback a DOMContentLoaded). Idempotente: correr dos
   veces no rompe nada.
   ============================================================================ */
(function () {
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setupReveals() {
    // Cascada: hijos dentro de [data-reveal-group] reciben delay incremental.
    // <div data-reveal-group> o <div data-reveal-group="120"> para 120ms de paso.
    document.querySelectorAll('[data-reveal-group]').forEach((group) => {
      const step = parseInt(group.dataset.revealGroup, 10) || 90;
      group.querySelectorAll('[data-reveal]').forEach((child, i) => {
        if (!child.style.transitionDelay) child.style.transitionDelay = `${i * step}ms`;
      });
    });

    const els = document.querySelectorAll('[data-reveal]:not(.is-visible)');
    if (!els.length) return;

    // Sin movimiento o sin soporte: mostrar todo de una.
    if (REDUCED || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    els.forEach((el) => io.observe(el));
  }

  function hideLoader() {
    const loader = document.getElementById('tr-loader');
    if (loader) loader.setAttribute('data-hidden', '');
  }

  function init() {
    setupReveals();
    if (document.readyState === 'complete') hideLoader();
    else window.addEventListener('load', hideLoader, { once: true });
  }

  // Astro: dispara en la carga inicial y tras cada navegación con ClientRouter.
  document.addEventListener('astro:page-load', init);

  // Fallback para sitios sin Astro (idempotente si Astro también dispara).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
