(() => {
  const API = 'https://dbwuubabafzsinaokawe.supabase.co/functions/v1/academy-enrollment';
  const ONE_TO_ONE_PAYONEER = 'https://link.payoneer.com/Token?t=92CC9FD225EF4AC2962D8F6387F48367&src=mobile';
  const body = document.body;
  const service = body.dataset.service;
  if (!service || !['grupal', '1a1'].includes(service)) return;

  if (service === '1a1') {
    const heroPrice = document.querySelector('.hero aside strong');
    const totalPrice = document.querySelector('#pago .total strong');
    if (heroPrice) heroPrice.textContent = 'USD 799';
    if (totalPrice) totalPrice.textContent = 'USD 799';

    const grid = document.querySelector('#pago .payment-grid');
    if (grid && !document.getElementById('payoneer-button')) {
      grid.classList.remove('single');
      grid.style.gridTemplateColumns = '1.35fr .65fr';
      grid.style.gap = '14px';

      const article = document.createElement('article');
      article.style.padding = '18px';
      article.style.border = '1px solid rgba(61,176,255,.22)';
      article.style.borderRadius = '15px';
      article.style.background = 'rgba(5,21,35,.72)';
      article.innerHTML = `
        <small style="color:#24d7e8">OPCIÓN 2</small>
        <h3 style="font-family:Montserrat,sans-serif;margin:12px 0 8px">Pago con tarjeta · Payoneer</h3>
        <p style="color:#aebdcd;line-height:1.65">Realizá el pago online de USD 799 con tarjeta mediante Payoneer.</p>
        <a id="payoneer-button" href="${ONE_TO_ONE_PAYONEER}" target="_blank" rel="noopener noreferrer" style="display:block;width:100%;margin-top:14px;text-align:center;background:linear-gradient(90deg,#13bcd1,#147eff);color:#fff;border-radius:11px;padding:13px 17px;font-weight:600;text-decoration:none">Pagar USD 799 con tarjeta</a>
        <p style="font-size:.72rem;color:#7f91a4;margin-top:10px">El pago se procesa de forma segura fuera de esta página mediante Payoneer.</p>`;
      grid.appendChild(article);
    }
  }

  const form = document.getElementById('academy-form');
  const canvas = document.getElementById('signature-pad');
  const ctx = canvas?.getContext('2d');
  const payment = document.getElementById('pago');
  const printBtn = document.getElementById('print-contract');
  const confirmBtn = document.getElementById('confirm-signature');
  const clearBtn = document.getElementById('clear-signature');
  const nameInput = form?.elements.namedItem('nombre');
  const signatureName = document.getElementById('signature-name');
  const signatureDate = document.getElementById('signature-date');
  const saveStatus = document.getElementById('save-status');
  const payoneerBtn = document.getElementById('payoneer-button');
  const proofBtn = document.getElementById('submit-proof');
  const proofFile = document.getElementById('proof-file');
  const paymentMethod = document.getElementById('payment-method');
  const proofStatus = document.getElementById('proof-status');

  if (!form || !canvas || !ctx || !payment || !confirmBtn) return;

  let drawing = false;
  let signed = false;
  const storageKey = `academy_enrollment_${service}`;
  let enrollment = null;
  try { enrollment = JSON.parse(sessionStorage.getItem(storageKey) || 'null'); } catch (_) {}

  signatureDate.textContent = `Fecha: ${new Date().toLocaleDateString('es-UY')}`;
  nameInput?.addEventListener('input', () => {
    signatureName.textContent = `Nombre: ${nameInput.value || '—'}`;
  });

  function setupCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = 210 * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#dfeaf6';
  }
  setupCanvas();

  function point(e) {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }
  function start(e) { e.preventDefault(); drawing = true; signed = true; const p = point(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
  function move(e) { if (!drawing) return; e.preventDefault(); const p = point(e); ctx.lineTo(p.x, p.y); ctx.stroke(); }
  function end() { drawing = false; }
  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);

  async function api(payload) {
    const response = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación.');
    return data;
  }

  function unlockPayment() {
    payment.classList.remove('is-locked');
    if (printBtn) printBtn.disabled = false;
    confirmBtn.textContent = 'Inscripción guardada ✓';
    if (saveStatus) saveStatus.textContent = 'Tus datos y tu firma quedaron registrados correctamente.';
  }

  if (enrollment?.enrollment_id && enrollment?.client_token) unlockPayment();

  clearBtn?.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    signed = false;
    if (!enrollment) {
      payment.classList.add('is-locked');
      if (printBtn) printBtn.disabled = true;
      confirmBtn.textContent = 'Confirmar firma e inscripción';
    }
  });

  confirmBtn.addEventListener('click', async () => {
    if (enrollment) { unlockPayment(); payment.scrollIntoView({ behavior: 'smooth' }); return; }
    if (!form.reportValidity()) return;
    if (!document.getElementById('accept-program')?.checked || !document.getElementById('accept-contract')?.checked) {
      alert('Aceptá las condiciones para continuar.'); return;
    }
    if (!signed) { alert('Firmá dentro del recuadro para continuar.'); return; }

    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Guardando inscripción…';
    if (saveStatus) saveStatus.textContent = 'Estamos registrando tus datos y firma.';
    try {
      const data = await api({
        action: 'create',
        service_type: service,
        full_name: form.elements.namedItem('nombre').value,
        document_number: form.elements.namedItem('documento').value,
        country: form.elements.namedItem('pais').value,
        city: form.elements.namedItem('ciudad').value,
        address: form.elements.namedItem('direccion').value,
        email: form.elements.namedItem('email').value,
        whatsapp: form.elements.namedItem('whatsapp').value,
        contract_accepted: true,
        signature_data_url: canvas.toDataURL('image/png'),
      });
      enrollment = { enrollment_id: data.enrollment_id, client_token: data.client_token };
      sessionStorage.setItem(storageKey, JSON.stringify(enrollment));
      unlockPayment();
      payment.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      confirmBtn.textContent = 'Confirmar firma e inscripción';
      if (saveStatus) saveStatus.textContent = err.message;
      alert(err.message);
    } finally {
      confirmBtn.disabled = false;
    }
  });

  printBtn?.addEventListener('click', () => window.print());

  document.querySelectorAll('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(btn.dataset.copy);
    const old = btn.textContent;
    btn.textContent = 'Copiado ✓';
    setTimeout(() => { btn.textContent = old; }, 1200);
  }));

  payoneerBtn?.addEventListener('click', async (e) => {
    if (!enrollment) { e.preventDefault(); alert('Primero confirmá tu inscripción y firma.'); return; }
    e.preventDefault();
    const href = payoneerBtn.href;
    try {
      await api({ action: 'set_payment_method', ...enrollment, payment_method: 'payoneer' });
    } catch (_) {}
    window.open(href, '_blank', 'noopener,noreferrer');
  });

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  proofBtn?.addEventListener('click', async () => {
    if (!enrollment) { alert('Primero confirmá tu inscripción y firma.'); return; }
    const method = paymentMethod?.value;
    const file = proofFile?.files?.[0];
    if (!method) { alert('Elegí el método de pago que utilizaste.'); return; }
    if (!file) { alert('Seleccioná el comprobante de pago.'); return; }
    if (file.size > 8 * 1024 * 1024) { alert('El comprobante no puede superar 8 MB.'); return; }

    proofBtn.disabled = true;
    proofBtn.textContent = 'Enviando comprobante…';
    if (proofStatus) proofStatus.textContent = '';
    try {
      const proofDataUrl = await fileToDataUrl(file);
      await api({
        action: 'upload_proof',
        ...enrollment,
        payment_method: method,
        proof_data_url: proofDataUrl,
      });
      proofBtn.textContent = 'Comprobante enviado ✓';
      if (proofStatus) proofStatus.textContent = 'Recibimos tu comprobante. Tu pago quedó pendiente de validación.';
    } catch (err) {
      proofBtn.textContent = 'Enviar comprobante';
      if (proofStatus) proofStatus.textContent = err.message;
      alert(err.message);
    } finally {
      proofBtn.disabled = false;
    }
  });
})();