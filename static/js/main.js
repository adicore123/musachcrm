// API base
const API = (typeof window.NUSACH_API_BASE === 'string' && window.NUSACH_API_BASE)
  ? window.NUSACH_API_BASE.replace(/\/$/, '')
  : '';

// Shared state
let allCustomers = [];
let customersMap = {};
let rawVehicle = {};
let debounce = null;
let techOpen = false;
let currentEditId = null;
let currentView = 'customers';
let pendingRepairContext = false;

// ── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const burger = document.getElementById('burger');
  if (burger) burger.onclick = toggleMobileMenu;
});

function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  if (menu) menu.classList.toggle('hidden');
}

function navHover(el, on) {
  if (!el.classList.contains('nav-inactive')) return;
  if (on) { el.style.background = 'rgba(123,201,234,0.09)'; el.style.color = '#0f172a'; }
  else { el.style.background = ''; el.style.color = '#64748b'; }
}

function setView(view) {
  currentView = view;
  document.getElementById('view-customers')?.classList.toggle('hidden', view !== 'customers');
  document.getElementById('view-repairs')?.classList.toggle('hidden', view !== 'repairs');
  document.getElementById('view-appointments')?.classList.toggle('hidden', view !== 'appointments');
  document.getElementById('view-vehicle-check')?.classList.toggle('hidden', view !== 'vehicle-check');
  const nc = document.getElementById('nav-customers');
  const nr = document.getElementById('nav-repairs');
  const na = document.getElementById('nav-appointments');
  const nv = document.getElementById('nav-vehicle-check');
  const activeCls = 'flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all border-r-4';
  const inactiveCls = 'flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all nav-inactive';
  const activeStyle = 'background:rgba(123,201,234,0.13);border-color:#7BC9EA;color:#0c4a6e;border-right-width:4px;';
  const inactiveStyle = 'color:#64748b';
  [nc, nr, na, nv].forEach(el => {
    if (!el) return;
    el.className = inactiveCls;
    el.style.cssText = inactiveStyle;
    el.classList.add('nav-inactive');
  });
  const activeEl = view === 'customers' ? nc : view === 'repairs' ? nr : view === 'appointments' ? na : nv;
  if (activeEl) {
    activeEl.className = activeCls;
    activeEl.style.cssText = activeStyle;
    activeEl.classList.remove('nav-inactive');
  }
  if (view === 'repairs' && typeof loadRepairs === 'function') {
    (async () => { await loadCustomers(); await loadRepairs(); })();
  }
  if (view === 'appointments' && typeof loadAppointments === 'function') {
    (async () => { await loadCustomers(); await loadAppointments(); })();
  }
  if (view === 'customers' && typeof loadCustomers === 'function') {
    loadCustomers();
  }
}

// ── Helpers ───────────────────────────────────────────────────────
function show(id) { const el = document.getElementById(id); if (el) el.classList.remove('hidden'); }
function hide(id) { const el = document.getElementById(id); if (el) el.classList.add('hidden'); }
function hidePlateSt() { ['ps-spin','ps-ok','ps-err'].forEach(hide); }

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escAttr(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('he-IL',{day:'2-digit',month:'2-digit',year:'numeric'});
}

function fmtTest(s) {
  if (!s) return '—';
  try {
    const d = new Date(s);
    const fmt = d.toLocaleDateString('he-IL',{month:'2-digit',year:'numeric'});
    return d < new Date() ? `⚠️ פג תוקף (${fmt})` : `✓ תקף עד ${fmt}`;
  } catch { return s; }
}

// ── Vehicle data ─────────────────────────────────────────────────
const HEB = {
  tozeret_cd:        'קוד יצרן',
  tozeret_nm:        'יצרן',
  sug_degem:         'סוג דגם',
  degem_cd:          'קוד דגם',
  degem_nm:          'מספר דגם',
  kinuy_mishari:     'כינוי מסחרי',
  ramat_gimur:       'רמת גימור',
  kvutzat_zihum:     'קבוצת זיהום',
  shnat_yitzur:      'שנת ייצור',
  degem_manoa:       'דגם מנוע',
  mivchan_acharon_dt:'תאריך טסט אחרון',
  tokef_dt:          'תוקף טסט',
  baalut:            'בעלות',
  misgeret:          'מספר שלדה',
  tzeva_cd:          'קוד צבע',
  tzeva_rechev:      'צבע',
  zmig_kidmi:        'צמיג קדמי',
  zmig_ahori:        'צמיג אחורי',
  sug_delek_nm:      'סוג דלק',
  horaat_rishum:     'הוראת רישום',
  moed_aliya_lakvish:'מועד עלייה לכביש',
  mispar_rechev:     'מספר רכב',
};

function fieldLabel(k) {
  return HEB[k] || k.replace(/_/g, ' ');
}

function buildTechGrid(raw) {
  const skip = ['_id','mispar_rechev'];
  const entries = Object.entries(raw).filter(([k,v])=>v&&!skip.includes(k));
  const grid = document.getElementById('tech-grid');
  if (!grid) return;
  grid.innerHTML = entries.slice(0,14).map(([k,v])=>`
    <div class="bg-brand-surface rounded-lg p-2.5 border border-brand-border shadow-sm">
      <div class="text-[10px] text-brand-muted tracking-wide truncate mb-1">${fieldLabel(k)}</div>
      <div class="text-brand-text font-bold truncate text-sm">${v}</div>
    </div>`).join('');
}

function fillVehicle(d) {
  const pairs = [
    ['v-make',  d.manufacturer],
    ['v-model', d.model],
    ['v-year',  d.year],
    ['v-color', d.color],
    ['v-test',  fmtTest(d.test_validity)],
  ];
  pairs.forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = val || '—';
    el.className = 'text-sm text-brand-text font-bold';
  });
  rawVehicle = d.raw || {};
  buildTechGrid(rawVehicle);
}

function resetVehicle() {
  ['v-make','v-model','v-year','v-color','v-test'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = 'ממתין להזנה...';
    el.className = 'text-sm text-brand-muted italic';
  });
  const grid = document.getElementById('tech-grid');
  if (grid) grid.innerHTML = '';
  if (techOpen) toggleTech();
  rawVehicle = {};
}

function toggleTech() {
  techOpen = !techOpen;
  const grid = document.getElementById('tech-grid');
  const label = document.getElementById('tech-label');
  const arrow = document.getElementById('tech-arrow');
  if (grid) grid.classList.toggle('hidden', !techOpen);
  if (label) label.textContent = techOpen ? 'הסתר נתונים טכניים' : 'הצג נתונים טכניים נוספים';
  if (arrow) arrow.style.transform = techOpen ? 'rotate(180deg)' : '';
}

async function fetchPlate(plate) {
  show('ps-spin'); show('vl-spin');
  try {
    const r = await fetch(`${API}/vehicle/${encodeURIComponent(plate)}`);
    hidePlateSt();
    if (r.ok) {
      const d = await r.json();
      fillVehicle(d); show('ps-ok');
    } else {
      show('ps-err');
    }
  } catch {
    hidePlateSt(); show('ps-err');
  } finally {
    hide('vl-spin');
  }
}

function onPlateInput(val) {
  clearTimeout(debounce);
  resetVehicle(); hidePlateSt();
  const digits = val.replace(/\D/g,'');
  if (digits.length < 5) return;
  debounce = setTimeout(() => fetchPlate(val), 700);
}

// ── Load customers ──────────────────────────────────────────────
async function loadCustomers() {
  const loading = document.getElementById('loading');
  const empty = document.getElementById('empty');
  const tbody = document.getElementById('tbody');
  if (loading) show('loading');
  if (empty) hide('empty');
  if (tbody) tbody.innerHTML = '';
  try {
    const r = await fetch(`${API}/customers`);
    if (!r.ok) throw new Error();
    allCustomers = await r.json();
    if (typeof renderTable === 'function') renderTable(allCustomers);
    if (typeof updateStats === 'function') updateStats(allCustomers);
  } catch {
    if (empty) show('empty');
    if (typeof updateStats === 'function') updateStats([]);
  } finally {
    hide('loading');
    if (typeof populateRepairCustomerSelect === 'function') populateRepairCustomerSelect();
  }
}

// ── Toast ────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('opacity-0', 'translate-y-4');
  t.classList.add('opacity-100', 'translate-y-0');
  setTimeout(() => {
    t.classList.remove('opacity-100', 'translate-y-0');
    t.classList.add('opacity-0', 'translate-y-4');
  }, 3500);
}
