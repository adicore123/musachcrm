// ── Repairs JS ───────────────────────────────────────────────────
// Note: pendingRepairContext is declared in main.js (shared state)

let allRepairs = [];
let repairsMap = {};
let currentRepairEditId = null;
let repairVehicleSnapshot = {};
let repairDebounce = null;
let repairItems = [];

// Price List
let priceList = [];
let priceListMap = {};
let editingPriceListItemId = null;

function repairStatusLabel(s) {
  const m = { open: 'פתוח', in_progress: 'בטיפול', done: 'הושלם', cancelled: 'בוטל' };
  return m[s] || (s || '—');
}

function repairStatusClass(s) {
  if (s === 'done') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (s === 'in_progress') return 'bg-amber-100 text-amber-900 border-amber-200';
  if (s === 'cancelled') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-sky-100 text-sky-900 border-sky-200';
}

async function loadRepairs() {
  const tbody = document.getElementById('r-tbody');
  if (!tbody) return;
  show('r-loading');
  hide('r-empty');
  tbody.innerHTML = '';
  try {
    const r = await fetch(`${API}/repairs`);
    if (!r.ok) throw new Error();
    allRepairs = await r.json();
    const search = document.getElementById('search-repairs');
    if (search) search.value = '';
    renderRepairsTable(allRepairs);
    updateRepairStats(allRepairs);
  } catch {
    allRepairs = [];
    renderRepairsTable([]);
    updateRepairStats([]);
  } finally {
    hide('r-loading');
  }
}

function updateRepairStats(list) {
  const el = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = v; };
  el('stat-rep-total', String(list.length));
  el('stat-rep-open', String(list.filter(x => x.status === 'open' || x.status === 'in_progress').length));
  el('stat-rep-done', String(list.filter(x => x.status === 'done').length));
}

function renderRepairsTable(list) {
  const tbody = document.getElementById('r-tbody');
  repairsMap = {};
  allRepairs.forEach(x => { repairsMap[x.id] = x; });
  if (!list.length) {
    tbody.innerHTML = '';
    show('r-empty');
    return;
  }
  hide('r-empty');
  tbody.innerHTML = list.map((rep, index) => {
    const c = rep.customers || {};
    const rid = String(rep.id);
    const veh = [rep.vehicle_manufacturer, rep.vehicle_model].filter(Boolean).join(' ') || '—';
    const desc = (rep.description || '').length > 48 ? rep.description.slice(0, 48) + '…' : (rep.description || '—');
    const price = rep.final_price ? `₪${Number(rep.final_price).toFixed(2)}` : '—';
    return `
    <tr class="border-b border-brand-bg hover:bg-brand-c1/10 transition-colors fade-up" style="animation-delay: ${index * 0.04}s">
      <td class="px-6 py-4">
        <div class="text-sm font-bold text-brand-text">${esc(c.full_name || '—')}</div>
        <div class="text-xs text-brand-muted sm:hidden">${esc(c.phone || '')}</div>
      </td>
      <td class="px-6 py-4 hidden sm:table-cell font-mono text-sm" dir="ltr">${esc(rep.license_plate || c.license_plate || '—')}</td>
      <td class="px-6 py-4 hidden md:table-cell text-sm text-brand-muted">${esc(veh)}</td>
      <td class="px-6 py-4 hidden lg:table-cell text-sm text-brand-text max-w-xs truncate" title="${esc(rep.description || '')}">${esc(desc)}</td>
      <td class="px-6 py-4">
        <span class="inline-flex px-2.5 py-1 rounded-lg text-xs font-bold border ${repairStatusClass(rep.status)}">${repairStatusLabel(rep.status)}</span>
      </td>
      <td class="px-6 py-4 text-sm font-bold text-brand-success" dir="ltr">${price}</td>
      <td class="px-6 py-4 hidden lg:table-cell text-sm text-brand-muted">${fmtDate(rep.created_at)}</td>
      <td class="px-4 py-4">
        <div class="flex items-center gap-1">
          <button type="button" onclick="openRepairModal('${rid}')" title="עריכה"
            class="p-2 rounded-lg text-brand-muted hover:text-brand-text hover:bg-brand-bg transition-all">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button type="button" onclick="deleteRepair('${rid}')" title="מחיקה"
            class="p-2 rounded-lg text-brand-muted hover:text-brand-danger hover:bg-brand-danger/10 transition-all">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterRepairsTable() {
  const q = document.getElementById('search-repairs').value.toLowerCase();
  if (!q) {
    renderRepairsTable(allRepairs);
    return;
  }
  const filtered = allRepairs.filter(rep => {
    const c = rep.customers || {};
    const blob = [
      c.full_name, c.phone, c.license_plate,
      rep.license_plate, rep.vehicle_model, rep.vehicle_manufacturer,
      rep.description, rep.status
    ].filter(Boolean).join(' ').toLowerCase();
    return blob.includes(q);
  });
  renderRepairsTableFiltered(filtered);
}

function renderRepairsTableFiltered(list) {
  const tbody = document.getElementById('r-tbody');
  if (!list.length) {
    tbody.innerHTML = '';
    show('r-empty');
    return;
  }
  hide('r-empty');
  tbody.innerHTML = list.map((rep, index) => {
    const c = rep.customers || {};
    const rid = String(rep.id);
    const veh = [rep.vehicle_manufacturer, rep.vehicle_model].filter(Boolean).join(' ') || '—';
    const desc = (rep.description || '').length > 48 ? rep.description.slice(0, 48) + '…' : (rep.description || '—');
    const price = rep.final_price ? `₪${Number(rep.final_price).toFixed(2)}` : '—';
    return `
    <tr class="border-b border-brand-bg hover:bg-brand-c1/10 transition-colors fade-up" style="animation-delay: ${index * 0.04}s">
      <td class="px-6 py-4">
        <div class="text-sm font-bold text-brand-text">${esc(c.full_name || '—')}</div>
        <div class="text-xs text-brand-muted sm:hidden">${esc(c.phone || '')}</div>
      </td>
      <td class="px-6 py-4 hidden sm:table-cell font-mono text-sm" dir="ltr">${esc(rep.license_plate || c.license_plate || '—')}</td>
      <td class="px-6 py-4 hidden md:table-cell text-sm text-brand-muted">${esc(veh)}</td>
      <td class="px-6 py-4 hidden lg:table-cell text-sm text-brand-text max-w-xs truncate" title="${esc(rep.description || '')}">${esc(desc)}</td>
      <td class="px-6 py-4">
        <span class="inline-flex px-2.5 py-1 rounded-lg text-xs font-bold border ${repairStatusClass(rep.status)}">${repairStatusLabel(rep.status)}</span>
      </td>
      <td class="px-6 py-4 text-sm font-bold text-brand-success" dir="ltr">${price}</td>
      <td class="px-6 py-4 hidden lg:table-cell text-sm text-brand-muted">${fmtDate(rep.created_at)}</td>
      <td class="px-4 py-4">
        <div class="flex items-center gap-1">
          <button type="button" onclick="openRepairModal('${rid}')" title="עריכה"
            class="p-2 rounded-lg text-brand-muted hover:text-brand-text hover:bg-brand-bg transition-all">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button type="button" onclick="deleteRepair('${rid}')" title="מחיקה"
            class="p-2 rounded-lg text-brand-muted hover:text-brand-danger hover:bg-brand-danger/10 transition-all">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function populateRepairCustomerSelect() {
  const sel = document.getElementById('r-customer');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— בחרו מהרשימה —</option>' +
    allCustomers.map(c => `<option value="${escAttr(String(c.id))}">${esc(c.full_name || 'ללא שם')}${c.phone ? ' · ' + esc(c.phone) : ''}</option>`).join('');
  if (cur && [...sel.options].some(o => o.value === cur)) sel.value = cur;
}

// Price List Functions
async function loadPriceList() {
  try {
    const r = await fetch(`${API}/price-list`);
    if (r.ok) {
      priceList = await r.json();
      priceListMap = {};
      priceList.forEach(item => { priceListMap[item.id] = item; });
    }
  } catch (e) {
    console.error('Error loading price list:', e);
    priceList = [];
  }
}

function getCategoryLabel(cat) {
  const labels = {
    'oils': 'שמנים',
    'filters': 'מסננים',
    'brakes': 'בלמים',
    'engine': 'חלקי מנוע',
    'labor': 'עבודה',
    'other': 'אחר'
  };
  return labels[cat] || cat;
}

function getCategoryIcon(cat) {
  const icons = {
    'oils': '🛢️',
    'filters': '🔧',
    'brakes': '🛑',
    'engine': '⚙️',
    'labor': '👨‍🔧',
    'other': '📦'
  };
  return icons[cat] || '📦';
}

function renderPriceListTable() {
  const container = document.getElementById('pl-content');
  const filter = document.getElementById('pl-category-filter')?.value || '';
  
  hide('pl-loading');
  hide('pl-empty');
  hide('pl-content');
  
  let items = priceList;
  if (filter) {
    items = items.filter(item => item.category === filter);
  }
  
  if (!items.length) {
    show('pl-empty');
    return;
  }
  
  show('pl-content');
  
  // Group by category
  const grouped = {};
  items.forEach(item => {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  });
  
  container.innerHTML = Object.entries(grouped).map(([cat, catItems]) => `
    <div class="border border-brand-border rounded-xl overflow-hidden">
      <div class="bg-brand-bg px-4 py-3 font-bold text-sm text-brand-text flex items-center gap-2">
        ${getCategoryIcon(cat)} ${getCategoryLabel(cat)}
      </div>
      ${catItems.map(item => `
        <div class="flex items-center justify-between px-4 py-3 border-t border-brand-border hover:bg-brand-bg/50 transition-colors">
          <div class="flex-1">
            <div class="font-semibold text-sm text-brand-text">${esc(item.name)}</div>
            <div class="text-xs text-brand-muted mt-1">
              עלות: ₪${Number(item.part_cost || 0).toFixed(2)} | 
              מכירה: ₪${Number(item.sale_price || 0).toFixed(2)} | 
              עבודה: ₪${Number(item.labor_cost || 0).toFixed(2)}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button type="button"
              onclick="addRepairItem('${item.category}','${escAttr(item.name)}',${item.part_cost||0},${item.sale_price||0},${item.labor_cost||0}); closePriceListModal(); showToast('${escAttr(item.name)} נוסף לתיקון');"
              class="p-2 rounded-lg text-brand-muted hover:text-brand-success hover:bg-brand-success/10 transition-all"
              title="הוסף לתיקון">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
              </svg>
            </button>
            <button type="button" onclick="editPriceListItem(${item.id})"
              class="p-2 rounded-lg text-brand-muted hover:text-brand-text hover:bg-brand-border transition-all">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            <button type="button" onclick="deletePriceListItem(${item.id})"
              class="p-2 rounded-lg text-brand-muted hover:text-brand-danger hover:bg-brand-danger/10 transition-all">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

function openPriceListModal() {
  loadPriceList().then(() => {
    document.getElementById('price-list-modal').classList.remove('hidden');
    document.getElementById('price-list-modal').classList.add('flex');
    renderPriceListTable();
  });
}

function closePriceListModal() {
  document.getElementById('price-list-modal').classList.add('hidden');
  document.getElementById('price-list-modal').classList.remove('flex');
}

function openPriceListItemModal(editId) {
  editingPriceListItemId = editId || null;
  document.getElementById('pl-item-id').value = '';
  document.getElementById('pl-item-category').value = 'other';
  document.getElementById('pl-item-name').value = '';
  document.getElementById('pl-item-part-cost').value = '';
  document.getElementById('pl-item-sale-price').value = '';
  document.getElementById('pl-item-labor-cost').value = '';
  
  if (editId && priceListMap[editId]) {
    const item = priceListMap[editId];
    document.getElementById('pl-item-title').textContent = 'עריכת פריט';
    document.getElementById('pl-item-id').value = item.id;
    document.getElementById('pl-item-category').value = item.category;
    document.getElementById('pl-item-name').value = item.name;
    document.getElementById('pl-item-part-cost').value = item.part_cost || '';
    document.getElementById('pl-item-sale-price').value = item.sale_price || '';
    document.getElementById('pl-item-labor-cost').value = item.labor_cost || '';
  } else {
    document.getElementById('pl-item-title').textContent = 'פריט חדש';
  }
  
  document.getElementById('pl-item-modal').classList.remove('hidden');
  document.getElementById('pl-item-modal').classList.add('flex');
}

function closePriceListItemModal() {
  document.getElementById('pl-item-modal').classList.add('hidden');
  document.getElementById('pl-item-modal').classList.remove('flex');
  editingPriceListItemId = null;
}

function editPriceListItem(id) {
  openPriceListItemModal(id);
}

async function submitPriceListItem(e) {
  e.preventDefault();
  const id = document.getElementById('pl-item-id').value;
  const payload = {
    category: document.getElementById('pl-item-category').value,
    name: document.getElementById('pl-item-name').value.trim(),
    part_cost: parseFloat(document.getElementById('pl-item-part-cost').value) || 0,
    sale_price: parseFloat(document.getElementById('pl-item-sale-price').value) || 0,
    labor_cost: parseFloat(document.getElementById('pl-item-labor-cost').value) || 0
  };
  
  try {
    const url = id ? `${API}/price-list/${id}` : `${API}/price-list`;
    const method = id ? 'PATCH' : 'POST';
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (r.ok) {
      closePriceListItemModal();
      await loadPriceList();
      renderPriceListTable();
      showToast(id ? 'הפריט עודכן בהצלחה' : 'הפריט נוסף בהצלחה');
    } else {
      alert('שגיאה בשמירה');
    }
  } catch (err) {
    alert('שגיאה בחיבור לשרת');
  }
}

async function deletePriceListItem(id) {
  const item = priceListMap[id];
  if (!confirm(`למחוק את "${item?.name}" מהמחירון?`)) return;
  
  try {
    const r = await fetch(`${API}/price-list/${id}`, { method: 'DELETE' });
    if (r.ok) {
      await loadPriceList();
      renderPriceListTable();
      showToast('הפריט נמחק');
    } else {
      alert('שגיאה במחיקה');
    }
  } catch (err) {
    alert('שגיאה בחיבור לשרת');
  }
}

// Repair Item Functions
function addRepairItem(category = 'other', name = '', partCost = 0, salePrice = 0, laborCost = 0) {
  repairItems.push({ category, name, part_cost: partCost, sale_price: salePrice, labor_cost: laborCost });
  renderRepairItems();
}

function removeRepairItem(index) {
  repairItems.splice(index, 1);
  renderRepairItems();
  calculateRepairFinalPrice();
}

function renderRepairItems() {
  const container = document.getElementById('r-items-container');
  if (!container) return;
  
  if (repairItems.length === 0) {
    container.innerHTML = `
      <div class="text-center py-4 text-brand-muted text-sm">
        לחץ על "הוסף פריט" או בחר מהמחירון
      </div>
    `;
    return;
  }
  
  container.innerHTML = repairItems.map((item, index) => {
    const itemTotal = (parseFloat(item.sale_price) || 0) + (parseFloat(item.labor_cost) || 0);
    
    return `
    <div class="grid grid-cols-12 gap-2 items-center bg-white border border-brand-border rounded-xl p-2">
      <div class="col-span-4">
        <input type="text" placeholder="שם הפריט" value="${escAttr(item.name)}"
          class="w-full bg-brand-bg border border-brand-border rounded-lg px-2 py-1.5 text-sm text-brand-text"
          onchange="repairItems[${index}].name = this.value">
      </div>
      <div class="col-span-2">
        <input type="number" placeholder="₪0" value="${item.part_cost || ''}" min="0" step="0.01" dir="ltr"
          class="w-full bg-brand-bg border border-brand-border rounded-lg px-2 py-1.5 text-sm text-brand-text text-left text-center"
          onchange="repairItems[${index}].part_cost = parseFloat(this.value) || 0; calculateRepairFinalPrice();">
      </div>
      <div class="col-span-2">
        <input type="number" placeholder="₪0" value="${item.sale_price || ''}" min="0" step="0.01" dir="ltr"
          class="w-full bg-brand-bg border border-brand-border rounded-lg px-2 py-1.5 text-sm text-brand-text text-left text-center"
          onchange="repairItems[${index}].sale_price = parseFloat(this.value) || 0; calculateRepairFinalPrice();">
      </div>
      <div class="col-span-2">
        <input type="number" placeholder="₪0" value="${item.labor_cost || ''}" min="0" step="0.01" dir="ltr"
          class="w-full bg-brand-bg border border-brand-border rounded-lg px-2 py-1.5 text-sm text-brand-text text-left text-center"
          onchange="repairItems[${index}].labor_cost = parseFloat(this.value) || 0; calculateRepairFinalPrice();">
      </div>
      <div class="col-span-2 text-center">
        <span class="text-sm font-bold text-brand-success" dir="ltr">₪${itemTotal.toFixed(2)}</span>
      </div>
      <div class="col-span-12 sm:col-span-0 sm:absolute sm:top-2 sm:left-2">
        <button type="button" onclick="removeRepairItem(${index})"
          class="sm:relative absolute top-2 left-2 p-1.5 rounded-lg text-brand-muted hover:text-brand-danger hover:bg-brand-danger/10 transition-all">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

function calculateRepairFinalPrice() {
  const subtotal = repairItems.reduce((sum, item) => {
    return sum + (parseFloat(item.sale_price) || 0) + (parseFloat(item.labor_cost) || 0);
  }, 0);
  const vatEnabled = document.getElementById('r-vat-enabled')?.checked ?? true;
  const finalPrice = vatEnabled ? subtotal * 1.17 : subtotal;
  
  const subtotalDisplay = document.getElementById('r-subtotal-display');
  const finalPriceDisplay = document.getElementById('r-final-price-display');
  
  if (subtotalDisplay) subtotalDisplay.textContent = `סכום: ₪${subtotal.toFixed(2)}`;
  if (finalPriceDisplay) finalPriceDisplay.textContent = `₪${finalPrice.toFixed(2)}`;
}

function openRepairModal(editId, preselectCustomerId) {
  populateRepairCustomerSelect();
  loadPriceList();
  currentRepairEditId = editId || null;
  clearTimeout(repairDebounce);
  repairVehicleSnapshot = {};
  document.getElementById('repair-form').reset();
  resetRepairVehicle();
  const sel = document.getElementById('r-customer');

  if (editId && repairsMap[editId]) {
    const rep = repairsMap[editId];
    document.getElementById('repair-modal-title').textContent = 'עריכת תיקון';
    document.getElementById('repair-save-label').textContent = 'עדכן תיקון';
    sel.value = String(rep.customer_id);
    document.getElementById('r-description').value = rep.description || '';
    document.getElementById('r-status').value = rep.status || 'open';
    document.getElementById('r-notes').value = rep.notes || '';
    document.getElementById('r-vat-enabled').checked = rep.vat_enabled !== false;
    
    // Load items from stored data
    try {
      repairItems = (rep.items && Array.isArray(rep.items)) ? rep.items : [];
    } catch (e) {
      repairItems = [];
    }
    renderRepairItems();
    calculateRepairFinalPrice();
    fillRepairVehicleFromStored(rep);
    repairVehicleSnapshot = {
      manufacturer: rep.vehicle_manufacturer || '',
      model: rep.vehicle_model || '',
      year: rep.vehicle_year || '',
      color: rep.vehicle_color || '',
      test_validity: rep.test_validity || '',
    };
  } else {
    document.getElementById('repair-modal-title').textContent = 'תיקון חדש';
    document.getElementById('repair-save-label').textContent = 'שמור תיקון';
    document.getElementById('r-vat-enabled').checked = true;
    repairItems = [];
    renderRepairItems();
    calculateRepairFinalPrice();
    if (preselectCustomerId) sel.value = String(preselectCustomerId);
    onRepairCustomerChange();
  }

  const m = document.getElementById('repair-modal');
  m.classList.remove('hidden');
  m.classList.add('flex');
}

function closeRepairModal() {
  const m = document.getElementById('repair-modal');
  m.classList.add('hidden');
  m.classList.remove('flex');
  document.getElementById('repair-form').reset();
  currentRepairEditId = null;
  clearTimeout(repairDebounce);
  resetRepairVehicle();
  repairVehicleSnapshot = {};
  repairItems = [];
}

function fillRepairVehicleFromStored(rep) {
  [['r-v-make', rep.vehicle_manufacturer], ['r-v-model', rep.vehicle_model], ['r-v-year', rep.vehicle_year],
   ['r-v-color', rep.vehicle_color], ['r-v-test', fmtTest(rep.test_validity)]].forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = val || '—';
    el.className = 'text-sm text-brand-text font-bold';
  });
}

function resetRepairVehicle() {
  const mk = document.getElementById('r-v-make');
  if (!mk) return;
  mk.textContent = 'בחרו לקוח עם לוחית...';
  mk.className = 'text-sm text-brand-muted italic';
  ['r-v-model','r-v-year','r-v-color','r-v-test'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = '—';
    el.className = 'text-sm text-brand-muted italic';
  });
}

function fillRepairVehicle(d) {
  [['r-v-make', d.manufacturer], ['r-v-model', d.model], ['r-v-year', d.year],
   ['r-v-color', d.color], ['r-v-test', fmtTest(d.test_validity)]].forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = val || '—';
    el.className = 'text-sm text-brand-text font-bold';
  });
}

function onRepairCustomerChange() {
  clearTimeout(repairDebounce);
  const id = document.getElementById('r-customer').value;
  if (!id) {
    resetRepairVehicle();
    repairVehicleSnapshot = {};
    return;
  }
  const c = customersMap[id];
  if (!c || !c.license_plate) {
    resetRepairVehicle();
    const el = document.getElementById('r-v-make');
    if (el) {
      el.textContent = 'אין לוחית ללקוח — הוסיפו לוחית בכרטיס הלקוח';
      el.className = 'text-sm text-amber-700 font-semibold';
    }
    repairVehicleSnapshot = {};
    return;
  }
  repairDebounce = setTimeout(() => fetchRepairPlate(c.license_plate), 450);
}

async function fetchRepairPlate(plate) {
  show('r-vl-spin');
  try {
    const r = await fetch(`${API}/vehicle/${encodeURIComponent(plate)}`);
    if (r.ok) {
      const d = await r.json();
      fillRepairVehicle(d);
      repairVehicleSnapshot = {
        manufacturer: d.manufacturer || '',
        model: d.model || '',
        year: String(d.year != null ? d.year : ''),
        color: d.color || '',
        test_validity: d.test_validity || '',
      };
    } else {
      resetRepairVehicle();
      const el = document.getElementById('r-v-make');
      if (el) {
        el.textContent = 'לוחית לא נמצאה במאגר התחבורה';
        el.className = 'text-sm text-brand-danger font-semibold';
      }
      repairVehicleSnapshot = {};
    }
  } catch {
    resetRepairVehicle();
    repairVehicleSnapshot = {};
  } finally {
    hide('r-vl-spin');
  }
}

async function submitRepair(e) {
  e.preventDefault();
  const btn = document.getElementById('repair-save-btn');
  btn.disabled = true;
  show('repair-save-spin');
  const cid = document.getElementById('r-customer').value;
  const c = customersMap[cid];
  const plate = (c && c.license_plate) ? String(c.license_plate).trim() : '';
  const snap = repairVehicleSnapshot;
  const vatEnabled = document.getElementById('r-vat-enabled')?.checked ?? true;
  
  // Calculate final price
  const subtotal = repairItems.reduce((sum, item) => {
    return sum + (parseFloat(item.sale_price) || 0) + (parseFloat(item.labor_cost) || 0);
  }, 0);
  const finalPrice = vatEnabled ? subtotal * 1.17 : subtotal;
  
  const payload = {
    customer_id: cid,
    description: document.getElementById('r-description').value.trim(),
    items: repairItems.filter(item => item.name.trim()),
    vat_enabled: vatEnabled,
    final_price: Math.round(finalPrice * 100) / 100,
    status: document.getElementById('r-status').value,
    notes: document.getElementById('r-notes').value.trim() || undefined,
    license_plate: plate || undefined,
    vehicle_manufacturer: snap.manufacturer || undefined,
    vehicle_model: snap.model || undefined,
    vehicle_year: snap.year || undefined,
    vehicle_color: snap.color || undefined,
    test_validity: snap.test_validity || undefined,
  };
  try {
    const url = currentRepairEditId ? `${API}/repairs/${currentRepairEditId}` : `${API}/repairs`;
    const method = currentRepairEditId ? 'PATCH' : 'POST';
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      closeRepairModal();
      await loadRepairs();
    } else {
      let msg = 'לא ניתן לשמור';
      try {
        const err = await r.json();
        msg = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail || err);
      } catch (_) {}
      alert('שגיאה: ' + msg);
    }
  } catch {
    alert('שגיאת חיבור לשרת');
  } finally {
    btn.disabled = false;
    hide('repair-save-spin');
  }
}

async function deleteRepair(id) {
  const rep = repairsMap[id];
  const name = rep ? ((rep.customers && rep.customers.full_name) || 'תיקון') : 'תיקון';
  if (!confirm(`למחוק את התיקון של ${name}?`)) return;
  try {
    const r = await fetch(`${API}/repairs/${id}`, { method: 'DELETE' });
    if (r.ok) await loadRepairs();
    else alert('שגיאה במחיקה');
  } catch {
    alert('שגיאה במחיקה');
  }
}

function openNewCustomerFromRepair() {
  pendingRepairContext = true;
  closeRepairModal();
  openModal();
}

// Load price list on page load
loadPriceList();
