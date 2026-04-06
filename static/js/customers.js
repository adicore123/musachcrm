// ── Customers JS ─────────────────────────────────────────────────

function renderTable(list) {
  const tbody = document.getElementById('tbody');
  if (!tbody) return;
  customersMap = {};
  list.forEach(c => customersMap[c.id] = c);
  if (!list.length) { tbody.innerHTML = ''; show('empty'); return; }
  hide('empty');

  tbody.innerHTML = list.map((c, index) => `
    <tr class="border-b border-brand-bg hover:bg-brand-c1/10 transition-colors group fade-up" style="animation-delay: ${index * 0.05}s">
      <td class="px-6 py-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-brand-c2/30 border border-brand-c2
                      flex items-center justify-center text-brand-text font-bold shadow-sm">
            ${(c.full_name||'?')[0].toUpperCase()}
          </div>
          <div>
            <div class="text-sm font-bold text-brand-text">${esc(c.full_name||'—')}</div>
            ${c.email?`<div class="text-xs text-brand-muted mt-0.5">${esc(c.email)}</div>`:''}
          </div>
        </div>
      </td>
      <td class="px-6 py-4 hidden sm:table-cell">
        <span class="text-sm text-brand-text font-mono font-medium" dir="ltr">${esc(c.phone||'—')}</span>
      </td>
      <td class="px-6 py-4 hidden md:table-cell">
        ${c.license_plate
          ? `<div class="inline-flex items-center px-3 py-1.5 rounded-md plate-badge relative pl-6">
               <span class="tracking-widest font-mono text-sm">${esc(c.license_plate)}</span>
             </div>`
          : `<span class="text-brand-muted text-sm italic">—</span>`}
      </td>
      <td class="px-6 py-4 hidden lg:table-cell text-sm text-brand-muted font-medium">${fmtDate(c.created_at)}</td>
      <td class="px-4 py-4">
        <div class="flex items-center gap-1">
          ${c.license_plate ? `
          <button onclick="openVehiclePanel('${c.id}')" title="פרטי רכב"
            class="p-2 rounded-lg text-brand-muted hover:text-purple-600 hover:bg-brand-c3/30 transition-all">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
            </svg>
          </button>` : ''}
          <button onclick="openEditModal('${c.id}')" title="עריכה"
            class="p-2 rounded-lg text-brand-muted hover:text-brand-text hover:bg-brand-bg transition-all">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
          <button onclick="deleteCustomer('${c.id}','${esc(c.full_name||'')}')" title="מחיקה"
            class="p-2 rounded-lg text-brand-muted hover:text-brand-danger hover:bg-brand-danger/10 transition-all">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>`).join('');
}

function updateStats(list) {
  const total = document.getElementById('stat-total');
  const vehicles = document.getElementById('stat-vehicles');
  if (total) total.textContent = list.length || '0';
  if (vehicles) vehicles.textContent = list.filter(c=>c.license_plate).length || '0';
}

function filterTable() {
  const q = document.getElementById('search').value.toLowerCase();
  renderTable(!q ? allCustomers : allCustomers.filter(c =>
    (c.full_name||'').toLowerCase().includes(q) ||
    (c.phone||'').toLowerCase().includes(q) ||
    (c.license_plate||'').toLowerCase().includes(q)
  ));
}

// ── Modal ────────────────────────────────────────────────────────
function openModal() {
  currentEditId = null;
  document.getElementById('modal-title').textContent = 'לקוח חדש';
  document.getElementById('modal-subtitle').textContent = 'הזן את פרטי הלקוח והרכב למערכת';
  document.getElementById('save-label').textContent = 'שמור לקוח';
  const m = document.getElementById('modal');
  m.classList.remove('hidden');
  m.classList.add('flex');
  setTimeout(() => document.getElementById('f-first').focus(), 50);
  resetVehicle();
}

function openEditModal(id) {
  const c = customersMap[id];
  if (!c) return;
  currentEditId = id;
  document.getElementById('modal-title').textContent = 'עריכת לקוח';
  document.getElementById('modal-subtitle').textContent = 'עדכן את פרטי הלקוח';
  document.getElementById('save-label').textContent = 'שמור שינויים';

  const nameParts = (c.full_name || '').split(' ');
  document.getElementById('f-first').value = nameParts[0] || '';
  document.getElementById('f-last').value = nameParts.slice(1).join(' ') || '';
  document.getElementById('f-phone').value = c.phone || '';
  document.getElementById('f-plate').value = c.license_plate || '';

  const m = document.getElementById('modal');
  m.classList.remove('hidden');
  m.classList.add('flex');
  resetVehicle();

  if (c.license_plate) {
    onPlateInput(c.license_plate);
  }
}

function closeModal() {
  pendingRepairContext = false;
  const m = document.getElementById('modal');
  m.classList.add('hidden');
  m.classList.remove('flex');
  document.getElementById('form').reset();
  currentEditId = null;
  resetVehicle();
  clearTimeout(debounce);
}

// ── Submit ────────────────────────────────────────────────────────
async function submitCustomer(e) {
  e.preventDefault();
  const btn = document.getElementById('save-btn');
  btn.disabled = true; show('save-spin');

  const payload = {
    full_name: `${document.getElementById('f-first').value.trim()} ${document.getElementById('f-last').value.trim()}`,
    phone: document.getElementById('f-phone').value.trim() || undefined,
    license_plate: document.getElementById('f-plate').value.trim() || undefined,
  };

  try {
    const url = currentEditId ? `${API}/customers/${currentEditId}` : `${API}/customers`;
    const method = currentEditId ? 'PATCH' : 'POST';
    const r = await fetch(url, {
      method,
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      let saved = null;
      try { saved = await r.json(); } catch (_) {}
      const backToRepair = pendingRepairContext;
      closeModal();
      await loadCustomers();
      if (typeof populateRepairCustomerSelect === 'function') populateRepairCustomerSelect();
      if (backToRepair && saved && saved.id != null && typeof openRepairModal === 'function') {
        openRepairModal(null, String(saved.id));
      }
    } else {
      const err = await r.json();
      alert('שגיאה: ' + (err.detail || 'לא ניתן לשמור'));
    }
  } catch {
    alert('שגיאת חיבור לשרת או שה-API לא מוגדר');
  } finally {
    btn.disabled = false; hide('save-spin');
  }
}

// ── Delete ────────────────────────────────────────────────────────
async function deleteCustomer(id, name) {
  if (!confirm(`למחוק את הלקוח ${name}? פעולה זו אינה הפיכה.`)) return;
  try {
    await fetch(`${API}/customers/${id}`, {method:'DELETE'});
    await loadCustomers();
  } catch {
    alert('שגיאה במחיקת לקוח');
  }
}
