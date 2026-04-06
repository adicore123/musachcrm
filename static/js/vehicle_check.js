// ── Vehicle Check JS ─────────────────────────────────────────────

async function lookupVehicle() {
  const raw = document.getElementById('vc-plate-input').value.trim();
  if (!raw) return;
  const plate = raw.replace(/[-\s]/g, '');
  hide('vc-error');
  hide('vc-results');
  show('vc-spin');
  document.getElementById('vc-btn-label').textContent = 'מחפש...';

  try {
    const r = await fetch(`${API}/vehicle/${encodeURIComponent(plate)}`);
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      document.getElementById('vc-error').textContent = err.detail || 'לוחית לא נמצאה במאגר התחבורה';
      show('vc-error');
      return;
    }
    const d = await r.json();
    fillVehicleCheck(d, raw);
    show('vc-results');
  } catch {
    document.getElementById('vc-error').textContent = 'שגיאת חיבור לשרת';
    show('vc-error');
  } finally {
    hide('vc-spin');
    document.getElementById('vc-btn-label').textContent = 'חפש רכב';
  }
}

function fillVehicleCheck(d, plateRaw) {
  const make = d.manufacturer || '—';
  const model = d.model || '—';
  document.getElementById('vc-title').textContent = `${make} ${model}`;
  document.getElementById('vc-plate-display').textContent = plateRaw.toUpperCase();
  document.getElementById('vc-make').textContent = make;
  document.getElementById('vc-model').textContent = model;
  document.getElementById('vc-year').textContent = d.year || '—';
  document.getElementById('vc-color').textContent = d.color || '—';

  const raw = d.raw || {};
  document.getElementById('vc-tire-front').textContent = raw.zmig_kidmi || '—';
  document.getElementById('vc-tire-rear').textContent  = raw.zmig_ahori || '—';

  const testCard = document.getElementById('vc-test-card');
  const testVal  = d.test_validity || raw.tokef_dt || '';
  const expired  = testVal && new Date(testVal) < new Date();
  document.getElementById('vc-test-icon').textContent = testVal ? (expired ? '⚠️' : '✅') : '—';
  document.getElementById('vc-test').textContent = fmtTest(testVal);
  testCard.className = `rounded-2xl p-5 flex items-center gap-4 border shadow-sm ${
    !testVal ? 'bg-brand-surface border-brand-border' :
    expired  ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
  }`;

  const SKIP = ['_id', 'mispar_rechev', 'zmig_kidmi', 'zmig_ahori', 'tokef_dt'];
  const entries = Object.entries(raw).filter(([k, v]) => v && !SKIP.includes(k));
  document.getElementById('vc-raw-grid').innerHTML = entries.map(([k, v]) => `
    <div class="bg-brand-bg rounded-xl p-3 border border-brand-border">
      <div class="text-[10px] text-brand-muted uppercase tracking-wider truncate mb-1">${fieldLabel(k)}</div>
      <div class="text-sm font-bold text-brand-text truncate">${v}</div>
    </div>`).join('');
}

// ── Vehicle Info Panel ───────────────────────────────────────────
async function openVehiclePanel(id) {
  const c = customersMap[id];
  if (!c || !c.license_plate) return;

  document.getElementById('vp-name').textContent = c.full_name || '';
  document.getElementById('vp-plate').textContent = c.license_plate;

  const panel = document.getElementById('vpanel');
  const inner = document.getElementById('vpanel-inner');
  panel.classList.remove('hidden');
  panel.classList.add('flex');
  requestAnimationFrame(() => {
    inner.style.transform = 'translateY(0) translateX(0)';
  });

  show('vp-loading'); hide('vp-data'); hide('vp-error');

  try {
    const r = await fetch(`${API}/vehicle/${encodeURIComponent(c.license_plate)}`);
    if (!r.ok) { hide('vp-loading'); show('vp-error'); return; }
    const d = await r.json();
    hide('vp-loading');
    fillVehiclePanel(d);
    show('vp-data');
  } catch {
    hide('vp-loading'); show('vp-error');
  }
}

function fillVehiclePanel(d) {
  document.getElementById('vp-make').textContent  = d.manufacturer || '—';
  document.getElementById('vp-model').textContent = d.model || '—';
  document.getElementById('vp-year').textContent  = d.year || '—';
  document.getElementById('vp-color').textContent = d.color || '—';

  const testCard = document.getElementById('vp-test-card');
  const expired = d.test_validity && new Date(d.test_validity) < new Date();
  document.getElementById('vp-test-icon').textContent = expired ? '⚠️' : '✅';
  document.getElementById('vp-test').textContent = fmtTest(d.test_validity);
  testCard.className = `rounded-xl p-4 border flex items-center gap-3 ${
    expired ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
  }`;

  const skip = ['_id', 'mispar_rechev'];
  const raw = d.raw || {};
  const entries = Object.entries(raw).filter(([k,v]) => v && !skip.includes(k));
  document.getElementById('vp-raw').innerHTML = entries.map(([k,v]) => `
    <div class="bg-brand-bg rounded-lg p-2.5 border border-brand-border">
      <div class="text-[10px] text-brand-muted tracking-wide truncate mb-0.5">${fieldLabel(k)}</div>
      <div class="text-brand-text font-bold truncate text-sm">${v}</div>
    </div>`).join('');
}

function closeVehiclePanel() {
  const panel = document.getElementById('vpanel');
  const inner = document.getElementById('vpanel-inner');
  inner.style.transform = '';
  setTimeout(() => {
    panel.classList.add('hidden');
    panel.classList.remove('flex');
  }, 300);
}
