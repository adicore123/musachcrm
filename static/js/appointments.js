// ── Appointments JS ──────────────────────────────────────────────

let allAppointments = [];
let appointmentsMap = {};
let currentAptEditId = null;
let _waPendingId = null;

const APT_STATUS = {
  scheduled:   { label: 'ממתין',  cls: 'bg-sky-100 text-sky-900 border-sky-200' },
  in_progress: { label: 'בביצוע', cls: 'bg-amber-100 text-amber-900 border-amber-200' },
  completed:   { label: 'הושלם',  cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  cancelled:   { label: 'בוטל',   cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

function aptStatusBadge(status) {
  const s = APT_STATUS[status] || { label: status || '—', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  return `<span class="inline-flex px-2.5 py-1 rounded-lg text-xs font-bold border ${s.cls}">${s.label}</span>`;
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function loadAppointments() {
  show('apt-loading'); hide('apt-empty');
  const tbody = document.getElementById('apt-tbody');
  if (tbody) tbody.innerHTML = '';
  try {
    const r = await fetch(`${API}/appointments`);
    allAppointments = r.ok ? await r.json() : [];
  } catch { allAppointments = []; }
  appointmentsMap = {};
  allAppointments.forEach(a => { appointmentsMap[a.id] = a; });
  updateAptStats();
  renderAptTable(allAppointments);
  hide('apt-loading');
}

function updateAptStats() {
  const el = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = v; };
  el('apt-stat-total', allAppointments.length);
  el('apt-stat-scheduled', allAppointments.filter(a => a.status === 'scheduled').length);
  el('apt-stat-inprogress', allAppointments.filter(a => a.status === 'in_progress').length);
  el('apt-stat-completed', allAppointments.filter(a => a.status === 'completed').length);
}

function renderAptTable(list) {
  const tbody = document.getElementById('apt-tbody');
  if (!tbody) return;
  if (!list.length) { tbody.innerHTML = ''; show('apt-empty'); return; }
  hide('apt-empty');
  tbody.innerHTML = list.map((a, i) => {
    const aid = escAttr(String(a.id));
    const name = esc((a.customers && a.customers.full_name) || '—');
    const phone = (a.customers && a.customers.phone) ? esc(a.customers.phone) : '';
    return `
    <tr class="border-b border-brand-bg hover:bg-brand-c1/10 transition-colors fade-up" style="animation-delay:${i * 0.04}s">
      <td class="px-6 py-4">
        <div class="text-sm font-bold text-brand-text">${name}</div>
        ${phone ? `<div class="text-xs text-brand-muted mt-0.5 font-mono" dir="ltr">${phone}</div>` : ''}
      </td>
      <td class="px-6 py-4 hidden sm:table-cell text-sm text-brand-text">${fmtDateTime(a.appointment_time)}</td>
      <td class="px-6 py-4 hidden md:table-cell text-sm text-brand-muted">${esc(a.service_type || '—')}</td>
      <td class="px-6 py-4">${aptStatusBadge(a.status)}</td>
      <td class="px-4 py-4">
        <div class="flex items-center gap-1">
          <button type="button" onclick="openAppointmentModal('${aid}')" title="עריכה"
            class="p-2 rounded-lg text-brand-muted hover:text-brand-text hover:bg-brand-bg transition-all">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button type="button" onclick="deleteAppointment('${aid}')" title="מחיקה"
            class="p-2 rounded-lg text-brand-muted hover:text-brand-danger hover:bg-brand-danger/10 transition-all">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
          <button type="button" onclick="sendAptReminder('${aid}')" title="שלח תזכורת וואטסאפ"
            class="p-2 rounded-lg text-brand-muted hover:text-emerald-700 hover:bg-emerald-50 transition-all">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterAppointmentsTable() {
  const q = document.getElementById('search-appointments').value.trim().toLowerCase();
  if (!q) { renderAptTable(allAppointments); return; }
  renderAptTable(allAppointments.filter(a => {
    const name = ((a.customers && a.customers.full_name) || '').toLowerCase();
    const svc = (a.service_type || '').toLowerCase();
    const notes = (a.notes || '').toLowerCase();
    return name.includes(q) || svc.includes(q) || notes.includes(q);
  }));
}

function populateAptCustomerSelect() {
  const sel = document.getElementById('apt-customer');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— בחרו מהרשימה —</option>' +
    allCustomers.map(c => `<option value="${escAttr(String(c.id))}">${esc(c.full_name || 'ללא שם')}${c.phone ? ' · ' + esc(c.phone) : ''}</option>`).join('');
  if (cur && [...sel.options].some(o => o.value === cur)) sel.value = cur;
}

function buildTimeDropdowns(timeStr) {
  const hourSel = document.getElementById('apt-hour');
  const minSel  = document.getElementById('apt-minute');
  const pad = n => String(n).padStart(2, '0');

  hourSel.innerHTML = '<option value="">--</option>' +
    Array.from({length: 15}, (_, i) => i + 6).map(h =>
      `<option value="${pad(h)}">${pad(h)}</option>`).join('');

  minSel.innerHTML = '<option value="">--</option>' +
    Array.from({length: 12}, (_, i) => i * 5).map(m =>
      `<option value="${pad(m)}">${pad(m)}</option>`).join('');

  if (timeStr) {
    const [h, m] = timeStr.split(':');
    hourSel.value = h;
    minSel.value  = m;
    document.getElementById('apt-time-hidden').value = timeStr;
  } else {
    hourSel.value = '';
    minSel.value  = '';
    document.getElementById('apt-time-hidden').value = '';
  }
}

function updateAptTime() {
  const h = document.getElementById('apt-hour').value;
  const m = document.getElementById('apt-minute').value;
  if (h && m) {
    document.getElementById('apt-time-hidden').value = `${h}:${m}`;
    hide('apt-time-error');
  } else {
    document.getElementById('apt-time-hidden').value = '';
  }
}

function openAppointmentModal(editId) {
  populateAptCustomerSelect();
  currentAptEditId = editId || null;
  document.getElementById('apt-form').reset();
  hide('apt-time-error');

  const pad = n => String(n).padStart(2, '0');
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;

  if (editId && appointmentsMap[editId]) {
    const a = appointmentsMap[editId];
    document.getElementById('apt-modal-title').textContent = 'עריכת תור';
    document.getElementById('apt-save-label').textContent = 'עדכן תור';
    document.getElementById('apt-customer').value = String(a.customer_id);
    let selTime = '';
    if (a.appointment_time) {
      const dt = new Date(a.appointment_time);
      document.getElementById('apt-date').value = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`;
      selTime = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    } else {
      document.getElementById('apt-date').value = todayStr;
    }
    buildTimeDropdowns(selTime);
    document.getElementById('apt-service').value = a.service_type || '';
    document.getElementById('apt-status').value = a.status || 'scheduled';
    document.getElementById('apt-notes').value = a.notes || '';
  } else {
    document.getElementById('apt-modal-title').textContent = 'תור חדש';
    document.getElementById('apt-save-label').textContent = 'שמור תור';
    document.getElementById('apt-date').value = todayStr;
    buildTimeDropdowns('');
  }
  const m = document.getElementById('apt-modal');
  m.classList.remove('hidden');
  m.classList.add('flex');
}

function closeAppointmentModal() {
  const m = document.getElementById('apt-modal');
  m.classList.add('hidden');
  m.classList.remove('flex');
  document.getElementById('apt-form').reset();
  currentAptEditId = null;
}

async function submitAppointment(e) {
  e.preventDefault();
  const timeSlot = document.getElementById('apt-time-hidden').value;
  if (!timeSlot) {
    show('apt-time-error');
    return;
  }
  const dateVal = document.getElementById('apt-date').value;
  const btn = document.getElementById('apt-save-btn');
  btn.disabled = true;
  show('apt-save-spin');
  const payload = {
    customer_id: document.getElementById('apt-customer').value,
    appointment_time: `${dateVal}T${timeSlot}:00`,
    service_type: document.getElementById('apt-service').value.trim() || undefined,
    status: document.getElementById('apt-status').value,
    notes: document.getElementById('apt-notes').value.trim() || undefined,
  };
  try {
    const isNew = !currentAptEditId;
    const custName = (document.getElementById('apt-customer').selectedOptions[0]?.text || '').split(' · ')[0];
    const url = currentAptEditId ? `${API}/appointments/${currentAptEditId}` : `${API}/appointments`;
    const method = currentAptEditId ? 'PATCH' : 'POST';
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (r.ok) {
      const saved = await r.json();
      const savedId = saved.id;
      closeAppointmentModal();
      await loadAppointments();
      if (isNew && savedId) {
        openWaConfirm(String(savedId), custName);
      }
    } else {
      let msg = 'לא ניתן לשמור';
      try { const err = await r.json(); msg = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail || err); } catch(_) {}
      alert('שגיאה: ' + msg);
    }
  } catch { alert('שגיאת חיבור לשרת'); }
  finally { btn.disabled = false; hide('apt-save-spin'); }
}

async function deleteAppointment(id) {
  const a = appointmentsMap[id];
  const name = a ? ((a.customers && a.customers.full_name) || 'תור') : 'תור';
  if (!confirm(`למחוק את התור של ${name}?`)) return;
  try {
    const r = await fetch(`${API}/appointments/${id}`, { method: 'DELETE' });
    if (r.ok) await loadAppointments();
    else alert('שגיאה במחיקה');
  } catch { alert('שגיאה במחיקה'); }
}

function openWaConfirm(id, name) {
  _waPendingId = id;
  document.getElementById('wa-confirm-name').textContent = name;
  const m = document.getElementById('wa-confirm-modal');
  m.classList.remove('hidden');
  m.classList.add('flex');
}

function closeWaConfirm() {
  document.getElementById('wa-confirm-modal').classList.add('hidden');
  document.getElementById('wa-confirm-modal').classList.remove('flex');
  _waPendingId = null;
}

async function waConfirmSend() {
  const id = _waPendingId;
  closeWaConfirm();
  if (id) await sendAptReminder(id, true);
}

function waConfirmReject() {
  closeWaConfirm();
}

async function sendAptReminder(id, silent = false) {
  const a = appointmentsMap[id];
  const name = (a?.customers?.full_name) || 'הלקוח';
  if (!silent && !confirm(`לשלוח תזכורת וואטסאפ ל${name}?`)) return;
  try {
    const r = await fetch(`${API}/appointments/${id}/remind`, { method: 'POST' });
    if (r.ok) {
      showToast(`✅ תזכורת נשלחה ל${name} בוואטסאפ`);
    } else {
      const e = await r.json().catch(() => ({}));
      alert('שגיאה: ' + (e.detail || 'לא ניתן לשלוח'));
    }
  } catch { alert('שגיאת חיבור לשרת'); }
}
