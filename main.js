 // ====================================================================
 // main.js
 // ----------------------------------------------------------------------
 // UI logic: navigation, forms, tables, modals, reports, printing.
 // Uses `data`, `db`, the Firestore collection refs, and the dbSetDoc/
 // dbAddDoc/dbDeleteDoc/dbSaveCounter/loadData helpers - all defined in
 // server.js, which must be loaded before this file.
 // ====================================================================

 // ==================== NAVIGATION ====================
 // Current user's role; set on login. Defaults to the most restrictive.
 let currentRole = 'employee';

 function showSection(name) {
 // Block employees from opening admin-only sections (e.g. via console).
 if (currentRole === 'employee' && !EMPLOYEE_SECTIONS.includes(name)) {
 name = EMPLOYEE_SECTIONS[0];
 }
 document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
 document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

 document.getElementById(`section-${name}`).classList.add('active');

 // Highlight the matching sidebar item by its data-section (robust to
 // adding/removing/reordering sections — no brittle index map).
 const navItem = document.querySelector(`.nav-item[data-section="${name}"]`);
 if (navItem) navItem.classList.add('active');

 if (name === 'dashboard') updateDashboard();
 if (name === 'registration') { updateTraineesTable(); populateRegTrainerSelect(); }
 if (name === 'financial') updateFinancial();
 if (name === 'salaries') updateSalaries();
 if (name === 'attendance') updateAttendanceLog();
 if (name === 'sessions') renderSessionsSection();
 if (name === 'groups') renderGroups();
 if (name === 'coaches') renderCoachesSection();
 if (name === 'staff-attendance') renderStaffAttendance();
 if (name === 'financial-dashboard') renderFinancialDashboard();
 if (name === 'reports') updateReports();
 }

 // ==================== REGISTRATION ====================
 let currentType = 'subscription';

 function switchTab(type) {
 currentType = type;
 document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
 document.getElementById(`tab-${type}`).classList.add('active');

 const subOnlyFields = document.querySelectorAll('.sub-only');
 subOnlyFields.forEach(f => {
 f.style.display = type === 'subscription' ? 'flex' : 'none';
 });
 if (type === 'subscription') toggleSubType();
 }

 // Show the days field or the sessions field depending on the chosen
 // subscription type in the registration form.
 function toggleSubType() {
 const type = document.getElementById('reg-sub-type').value;
 document.getElementById('reg-duration-group').style.display = type === 'days' ? 'flex' : 'none';
 document.getElementById('reg-sessions-group').style.display = type === 'sessions' ? 'flex' : 'none';
 }

 // Generates a unique trainee code like "Wasl-0427" using random digits,
 // checking against existing trainees so two players never share an ID.
 function generateID() {
 for (let i = 0; i < 80; i++) {
 const id = `Wasl-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
 if (!data.trainees.some(t => t.id === id)) return id;
 }
 // Fallback if the 4-digit space is unexpectedly crowded.
 return `Wasl-${Date.now().toString().slice(-6)}`;
 }

 // Case-insensitive trainee lookup by code (codes may be typed/scanned in
 // any case, e.g. "wasl-0427" vs "Wasl-0427"; old "RCR-..." codes too).
 function findTraineeByCode(code) {
 const c = (code || '').trim().toLowerCase();
 return data.trainees.find(t => (t.id || '').toLowerCase() === c);
 }

 // <option> list of all coaches, used for assigning/reassigning a trainee's
 // coach. Preserves the current value even if it isn't a registered coach.
 function coachOptionsHTML(selected) {
 const coaches = getCoaches();
 let html = `<option value="غير محدد" ${(!selected || selected === 'غير محدد') ? 'selected' : ''}>— غير محدد —</option>`;
 let matched = false;
 coaches.forEach(c => {
 const sel = c.name === selected ? 'selected' : '';
 if (sel) matched = true;
 html += `<option value="${esc(c.name)}" ${sel}>${esc(c.name)}</option>`;
 });
 if (selected && selected !== 'غير محدد' && !matched) {
 html += `<option value="${esc(selected)}" selected>${esc(selected)} (غير مسجّل)</option>`;
 }
 return html;
 }

 // Fills the registration form's coach dropdown.
 function populateRegTrainerSelect() {
 const sel = document.getElementById('reg-trainer');
 if (sel) sel.innerHTML = coachOptionsHTML(sel.value);
 const sport = document.getElementById('reg-sport');
 if (sport && !sport.options.length) sport.innerHTML = sportOptionsHTML('');
 const level = document.getElementById('reg-level');
 if (level && !level.options.length) level.innerHTML = levelOptionsHTML('');
 const method = document.getElementById('reg-method');
 if (method && !method.options.length) method.innerHTML = methodOptionsHTML('');
 }

 // Show the gymnastics level field only when "جمباز فني" is selected.
 function toggleSportLevel() {
 const sport = document.getElementById('reg-sport').value;
 const grp = document.getElementById('reg-level-group');
 if (grp) grp.style.display = (sport === 'جمباز فني') ? 'flex' : 'none';
 }
 function toggleEditSportLevel() {
 const sport = document.getElementById('edit-sport').value;
 const grp = document.getElementById('edit-level-group');
 if (grp) grp.style.display = (sport === 'جمباز فني') ? 'flex' : 'none';
 }

 // Unique document id for records stored with an explicit id (payments),
 // so each one can be edited/deleted individually later.
 function genDocId(prefix) {
 return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
 }

 function addDays(dateStr, days) {
 const d = new Date(dateStr);
 d.setDate(d.getDate() + parseInt(days || 0));
 const y = d.getFullYear();
 const m = String(d.getMonth() + 1).padStart(2, '0');
 const day = String(d.getDate()).padStart(2, '0');
 return `${y}-${m}-${day}`;
 }

 async function registerTrainee() {
 const name = document.getElementById('reg-name').value.trim();
 const phone = document.getElementById('reg-phone').value.trim();
 const age = document.getElementById('reg-age').value;
 const gender = document.getElementById('reg-gender').value;
 const sport = document.getElementById('reg-sport').value;
 const level = (sport === 'جمباز فني') ? document.getElementById('reg-level').value : '';
 const trainer = document.getElementById('reg-trainer').value.trim();
 const startDate = document.getElementById('reg-start-date').value;
 const subType = document.getElementById('reg-sub-type').value; // 'days' | 'sessions'
 const duration = document.getElementById('reg-duration').value || 30;
 const sessions = document.getElementById('reg-sessions').value;
 const total = document.getElementById('reg-total').value;
 const amount = document.getElementById('reg-amount').value;
 const method = document.getElementById('reg-method').value || 'نقداً';
 const branch = document.getElementById('reg-branch').value;
 const notes = document.getElementById('reg-notes').value;

 if (!name || !phone) {
 showNotification('يرجى ملء الاسم ورقم الهاتف على الأقل', 'warning');
 return;
 }
 if (!branch) {
 showNotification('يرجى اختيار الفرع', 'warning');
 return;
 }
 const isSessions = currentType === 'subscription' && subType === 'sessions';
 if (isSessions && (!sessions || parseInt(sessions) <= 0)) {
 showNotification('يرجى إدخال عدد الحصص', 'warning');
 return;
 }

 // Use the pre-printed card code if the staff entered one, else auto-generate.
 const cardCode = document.getElementById('reg-card-code').value.trim();
 let id;
 if (cardCode) {
 if (findTraineeByCode(cardCode)) {
 showNotification('هذا الكود مستخدم بالفعل لمتدرب آخر', 'warning');
 return;
 }
 id = cardCode;
 } else {
 id = generateID();
 }

 const todayISO = new Date().toISOString().slice(0,10);
 const today = new Date().toLocaleDateString('ar-EG');
 const effectiveStart = startDate || todayISO;
 // Days-based subscriptions get an expiry date; session-based ones track a
 // remaining-sessions counter instead.
 const expiryDate = (currentType === 'subscription' && !isSessions) ? addDays(effectiveStart, duration) : null;

 const paidNow = num(amount);
 const subTotal = num(total) > 0 ? num(total) : paidNow;

 const trainee = {
 id,
 name,
 phone,
 age,
 gender,
 type: currentType,
 sport: currentType === 'subscription' ? sport : 'تجريبي مجاني',
 plan: currentType === 'subscription' ? sport : 'تجريبي مجاني',
 level: currentType === 'subscription' ? level : '',
 trainer: currentType === 'subscription' ? (trainer || 'غير محدد') : 'غير محدد',
 startDate: effectiveStart,
 subType: currentType === 'subscription' ? subType : null,
 durationDays: (currentType === 'subscription' && !isSessions) ? parseInt(duration) : null,
 sessionsTotal: isSessions ? parseInt(sessions) : null,
 sessionsRemaining: isSessions ? parseInt(sessions) : null,
 expiryDate,
 amount: currentType === 'subscription' ? paidNow : 0,
 subTotal: currentType === 'subscription' ? subTotal : 0,
 subPaid: currentType === 'subscription' ? paidNow : 0,
 notes,
 status: currentType === 'subscription' ? 'نشط' : 'تجريبي',
 registrationDate: today,
 attendanceCount: 0,
 branch: branch
 };

 data.trainees.push(trainee);
 dbSetDoc(traineesCol, trainee.id, trainee);
 // Note: the counter was already persisted atomically by generateID().

 // Add payment record if subscription
 if (currentType === 'subscription' && paidNow > 0) {
 const payDocId = genDocId('PAY');
 const remaining = Math.max(0, subTotal - paidNow);
 const payment = {
 _docId: payDocId,
 id,
 name,
 type: 'اشتراك جديد',
 plan: sportLabel(trainee),
 amount: paidNow,
 method: method,
 date: today,
 status: remaining > 0 ? 'دفعة أولى' : 'مكتمل',
 branch: branch
 };
 data.payments.push(payment);
 dbSetDoc(paymentsCol, payDocId, payment);
 }

 // Optional add-on services are stored on the trainee and billed.
 trainee.addons = { test: 0, tournament: 0, locker: 0, internet: 0 };
 billAddons(trainee, readAddonInputs('addon'), branch, today);
 dbSetDoc(traineesCol, trainee.id, trainee);

 updateDashboard();
 updateTraineesTable();
 updateBadge();

 // Show ID
 document.getElementById('generated-id').textContent = id;
 document.getElementById('id-result').classList.add('show');

 document.getElementById('reg-card-code').value = '';
 document.getElementById('reg-total').value = '';
 resetAddons();
 showNotification(`تم تسجيل ${name} بنجاح!`);
 }

 // The optional add-on services, stored per-trainee as a price each (0 = not taken).
 const ADDON_DEFS = [
 { key: 'test', type: 'اختبار', plan: 'اختبارات', label: 'اختبارات', def: '' },
 { key: 'tournament', type: 'بطولة', plan: 'بطولات', label: 'بطولات', def: '' },
 { key: 'locker', type: 'لوكر', plan: 'إيجار لوكر', label: 'إيجار لوكر', def: '150' },
 { key: 'internet', type: 'انترنت', plan: 'اشتراك انترنت', label: 'اشتراك انترنت', def: '100' }
 ];

 // Reads add-on checkbox+price inputs that share the given id prefix
 // (e.g. "addon" -> addon-test / addon-test-price).
 function readAddonInputs(prefix) {
 const result = {};
 ADDON_DEFS.forEach(d => {
 const check = document.getElementById(`${prefix}-${d.key}`);
 const price = document.getElementById(`${prefix}-${d.key}-price`);
 result[d.key] = (check && check.checked) ? num(price ? price.value : 0) : 0;
 });
 return result;
 }

 // Applies new add-on prices to a trainee. Any increase versus what was
 // stored is billed as a new income entry; decreases just update the record
 // (past income is never deleted, keeping the financials honest).
 function billAddons(trainee, newAddons, branch, today) {
 trainee.addons = trainee.addons || { test: 0, tournament: 0, locker: 0, internet: 0 };
 ADDON_DEFS.forEach(d => {
 const oldP = num(trainee.addons[d.key]);
 const newP = num(newAddons[d.key]);
 const delta = newP - oldP;
 if (delta > 0) {
 const payDocId = genDocId('PAY');
 const payment = {
 _docId: payDocId,
 id: trainee.id,
 name: trainee.name,
 type: d.type,
 plan: d.plan,
 amount: delta,
 method: 'نقداً',
 date: today,
 status: 'مكتمل',
 branch
 };
 data.payments.push(payment);
 dbSetDoc(paymentsCol, payDocId, payment);
 }
 trainee.addons[d.key] = newP;
 });
 }

 function resetAddons() {
 ADDON_DEFS.forEach(d => {
 const check = document.getElementById(`addon-${d.key}`);
 const price = document.getElementById(`addon-${d.key}-price`);
 if (check) check.checked = false;
 if (price) price.value = d.def;
 });
 }

 function clearForm() {
 document.getElementById('reg-name').value = '';
 document.getElementById('reg-phone').value = '';
 document.getElementById('reg-age').value = '';
 document.getElementById('reg-sport').value = '';
 document.getElementById('reg-level-group').style.display = 'none';
 document.getElementById('reg-trainer').value = '';
 document.getElementById('reg-sessions').value = '';
 document.getElementById('reg-total').value = '';
 document.getElementById('reg-amount').value = '';
 document.getElementById('reg-notes').value = '';
 document.getElementById('reg-card-code').value = '';
 document.getElementById('id-result').classList.remove('show');
 resetAddons();
 }

 function daysLeft(t) {
 if (!t.expiryDate) return null;
 const today = new Date();
 today.setHours(0,0,0,0);
 const exp = new Date(t.expiryDate);
 exp.setHours(0,0,0,0);
 return Math.round((exp - today) / (1000 * 60 * 60 * 24));
 }

 // Flip any subscription whose expiry date has passed from "نشط" to
 // "منتهي". Runs once after data loads so all counts/reports are accurate.
 // Only writes back the records that actually changed (one write per
 // transition), so it doesn't hammer Firestore on every page load.
 function refreshExpiredStatuses() {
 let changed = 0;
 data.trainees.forEach(t => {
 if (t.type === 'subscription' && t.status === 'نشط') {
 const info = subInfo(t);
 if (info.expired) {
 t.status = 'منتهي';
 dbSetDoc(traineesCol, t.id, t);
 changed++;
 }
 }
 });
 return changed;
 }

 // ==================== ABSENCE TRACKING ====================
 // A trainee who hasn't attended in this many days is flagged as "منقطع".
 // Change this number to make the alert stricter or more lenient.
 const ABSENCE_ALERT_DAYS = 7;

 // How long since a trainee last showed up (in whole days). Measured from
 // their last attendance, or from registration if they never attended.
 function lastAttendanceInfo(t) {
 let lastTs = 0, lastDate = '';
 data.attendance.forEach(a => {
 if (a.id === t.id) {
 const ts = parseDate(a.date);
 if (ts > lastTs) { lastTs = ts; lastDate = a.date; }
 }
 });
 const baseTs = lastTs || parseDate(t.registrationDate);
 if (!baseTs) return { days: null, lastDate: '', neverAttended: !lastTs };
 const today = new Date();
 today.setHours(0, 0, 0, 0);
 const days = Math.floor((today.getTime() - baseTs) / 86400000);
 return { days, lastDate, neverAttended: !lastTs };
 }

 // Active subscribers who have been absent past the threshold — the people
 // most at risk of dropping out, so the gym can follow up with them.
 function getAbsentees() {
 return data.trainees
 .filter(t => t.type === 'subscription' && t.status === 'نشط')
 .map(t => ({ t, info: lastAttendanceInfo(t) }))
 .filter(x => x.info.days !== null && x.info.days >= ABSENCE_ALERT_DAYS)
 .sort((a, b) => b.info.days - a.info.days);
 }

 // Single source of truth for "how much is left" on a subscription, whether
 // it's measured in days or in sessions. Backward compatible: trainees with
 // no subType are treated as days-based (the original behaviour).
 function subInfo(t) {
 if (!t || t.type !== 'subscription') {
 return { kind: 'none', expired: false, near: false, label: '—', remaining: null };
 }
 // A frozen subscription is paused: not expiring, not attendable.
 if (t.frozen) {
 return { kind: 'frozen', frozen: true, expired: false, near: false, label: 'مجمد', remLabel: 'الاشتراك مجمّد', remaining: null };
 }
 if (t.subType === 'sessions') {
 const rem = num(t.sessionsRemaining);
 return {
 kind: 'sessions',
 remaining: rem,
 expired: rem <= 0,
 near: rem > 0 && rem <= 3,
 label: rem <= 0 ? 'منتهي' : `${rem} حصة`,
 remLabel: rem <= 0 ? 'منتهي' : `${rem} حصة متبقية`
 };
 }
 const left = daysLeft(t);
 if (left === null) return { kind: 'none', expired: false, near: false, label: '—', remaining: null };
 return {
 kind: 'days',
 remaining: left,
 expired: left < 0,
 near: left >= 0 && left <= 5,
 label: left < 0 ? 'منتهي' : `${left} يوم`,
 remLabel: left < 0 ? 'منتهي' : `${left} يوم متبقي`
 };
 }

 function expiryCell(t) {
 const info = subInfo(t);
 if (info.frozen) return '<span class="badge badge-info">❄️ مجمّد</span>';
 if (info.kind === 'none') return '<span style="font-size:12px; color: rgba(48,56,65,0.4);">—</span>';
 if (info.expired) return '<span class="badge badge-danger">منتهي</span>';
 if (info.near) return `<span class="badge badge-warning">باقي ${esc(info.label)}</span>`;
 return `<span style="font-size:12px;">${esc(info.label)}</span>`;
 }

 // Single row renderer used by both the full list and the filtered views,
 // so the columns/actions always stay consistent.
 function traineeRowHtml(t) {
 const i = data.trainees.indexOf(t);
 const info = subInfo(t);
 const renewBtn = (info.expired || info.near)
 ? `<button class="btn btn-warning btn-sm" onclick="goRenew('${esc(t.id)}')">تجديد</button>` : '';
 // Freeze/unfreeze is only relevant for subscriptions.
 const freezeBtn = t.type === 'subscription'
 ? (t.frozen
 ? `<button class="btn btn-success btn-sm" onclick="unfreezeTrainee(${i})">إلغاء التجميد</button>`
 : `<button class="btn btn-outline btn-sm" onclick="freezeTrainee(${i})">تجميد</button>`)
 : '';
 const statusClass = t.status === 'نشط' ? 'badge-success'
 : t.status === 'تجريبي' ? 'badge-test'
 : t.status === 'مجمد' ? 'badge-info'
 : 'badge-danger';
 // Outstanding balance for installment subscriptions.
 const remaining = Math.max(0, num(t.subTotal) - num(t.subPaid));
 const installBtn = (t.type === 'subscription' && remaining > 0)
 ? `<button class="btn btn-warning btn-sm" onclick="payInstallment(${i})">دفع قسط (متبقي ${remaining.toLocaleString()})</button>` : '';
 return `
 <tr>
 <td><code style="color: var(--gold); font-family: monospace;">${esc(t.id)}</code></td>
 <td><strong>${esc(t.name)}</strong></td>
 <td>${esc(t.phone)}</td>
 <td>
 <span class="badge ${t.type === 'subscription' ? 'badge-success' : 'badge-test'}">
 ${t.type === 'subscription' ? 'اشتراك' : 'تجريبي'}
 </span>
 </td>
 <td><span class="badge" style="background: rgba(48,56,65,0.05); color: var(--accent); border: 1px solid rgba(48,56,65,0.2);">${esc(t.branch || 'غير محدد')}</span></td>
 <td style="font-size: 12px;">${esc(sportLabel(t))}</td>
 <td>
 <span class="badge ${statusClass}">${esc(t.status)}</span>
 </td>
 <td>${expiryCell(t)}</td>
 <td>
 ${installBtn}
 ${renewBtn}
 ${freezeBtn}
 <button class="btn btn-outline btn-sm" onclick="viewTrainee(${i})">عرض</button>
 <button class="btn btn-outline btn-sm" onclick="editTrainee(${i})">تعديل</button>
 <button class="btn btn-outline btn-sm" onclick="printCard(${i})">طباعة</button>
 <button class="btn btn-danger btn-sm" onclick="deleteTrainee(${i})">حذف</button>
 </td>
 </tr>`;
 }

 function updateTraineesTable() {
 populateTraineeFilters();
 filterTrainees();
 }

 // Fill the sport dropdown from the distinct sports in the data, then refresh
 // the (sport-dependent) trainer dropdown.
 function populateTraineeFilters() {
 const sportSel = document.getElementById('filter-sport');
 if (!sportSel) return;
 const prev = sportSel.value;
 const sports = [...new Set(data.trainees.map(t => (t.sport || t.plan || '').trim()).filter(Boolean))].sort();
 sportSel.innerHTML = '<option value="الكل">كل الرياضات</option>' +
 sports.map(s => `<option value="${esc(s)}" ${s === prev ? 'selected' : ''}>${esc(s)}</option>`).join('');
 populateTrainerFilter();
 }

 // Trainer options depend on the chosen sport: only trainers who actually
 // have players in that sport are shown (so the filter narrows down).
 function populateTrainerFilter() {
 const sportSel = document.getElementById('filter-sport');
 const trainerSel = document.getElementById('filter-trainer');
 if (!sportSel || !trainerSel) return;
 const sport = sportSel.value;
 const prev = trainerSel.value;
 let pool = data.trainees;
 if (sport && sport !== 'الكل') pool = pool.filter(t => (t.sport || t.plan || '').trim() === sport);
 const trainers = [...new Set(pool.map(t => (t.trainer || 'غير محدد').trim()).filter(Boolean))].sort();
 trainerSel.innerHTML = '<option value="الكل">كل المدربين</option>' +
 trainers.map(tr => `<option value="${esc(tr)}" ${tr === prev ? 'selected' : ''}>${esc(tr)}</option>`).join('');
 }

 // When the sport changes, rebuild the trainer list then re-filter.
 function onSportFilterChange() {
 populateTrainerFilter();
 filterTrainees();
 }

 // Applies the text search + sport + trainer filters and renders the table.
 function filterTrainees() {
 const q = (document.getElementById('search-trainees').value || '').toLowerCase().trim();
 const sportSel = document.getElementById('filter-sport');
 const trainerSel = document.getElementById('filter-trainer');
 const sport = sportSel ? sportSel.value : 'الكل';
 const trainer = trainerSel ? trainerSel.value : 'الكل';

 const list = data.trainees.filter(t => {
 const tSport = (t.sport || t.plan || '').trim();
 const tTrainer = (t.trainer || 'غير محدد').trim();
 const matchSport = !sport || sport === 'الكل' || tSport === sport;
 const matchTrainer = !trainer || trainer === 'الكل' || tTrainer === trainer;
 const matchText = !q || t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || (t.phone || '').includes(q);
 return matchSport && matchTrainer && matchText;
 });

 const tbody = document.getElementById('trainees-table');
 if (data.trainees.length === 0) {
 tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color: rgba(48,56,65,0.3); padding: 30px;">لا يوجد متدربون مسجلون بعد</td></tr>';
 return;
 }
 if (list.length === 0) {
 tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color: rgba(48,56,65,0.3); padding: 30px;">لا توجد نتائج مطابقة للفلاتر</td></tr>';
 return;
 }
 tbody.innerHTML = list.map(traineeRowHtml).join('');
 }

 function resetTraineeFilters() {
 const search = document.getElementById('search-trainees');
 const sportSel = document.getElementById('filter-sport');
 const trainerSel = document.getElementById('filter-trainer');
 if (search) search.value = '';
 if (sportSel) sportSel.value = 'الكل';
 populateTrainerFilter();
 if (trainerSel) trainerSel.value = 'الكل';
 filterTrainees();
 }

 // Back-compat alias (the search box still calls this name).
 function searchTrainees() { filterTrainees(); }

 function viewTrainee(index) {
 const t = data.trainees[index];
 const attendanceCount = data.attendance.filter(a => a.id === t.id).length;

 document.getElementById('modal-title-text').textContent = `${t.name}`;
 document.getElementById('modal-body').innerHTML = `
 <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
 <div style="padding: 15px; background: rgba(48,56,65,0.05); border-radius: 10px;">
 <div style="color: rgba(48,56,65,0.4); font-size: 12px;">الكود</div>
 <div style="color: var(--gold); font-family: monospace; font-size: 18px; font-weight: 700;">${esc(t.id)}</div>
 </div>
 <div style="padding: 15px; background: rgba(48,56,65,0.05); border-radius: 10px;">
 <div style="color: rgba(48,56,65,0.4); font-size: 12px;">الهاتف</div>
 <div style="font-weight: 600;">${esc(t.phone)}</div>
 </div>
 <div style="padding: 15px; background: rgba(48,56,65,0.05); border-radius: 10px;">
 <div style="color: rgba(48,56,65,0.4); font-size: 12px;">نوع الرياضة</div>
 <div style="font-weight: 600;">${esc(sportLabel(t))}</div>
 </div>
 <div style="padding: 15px; background: rgba(48,56,65,0.05); border-radius: 10px;">
 <div style="color: rgba(48,56,65,0.4); font-size: 12px;">المدرب المسؤول</div>
 <div style="font-weight: 600;">${esc(t.trainer || 'غير محدد')}</div>
 </div>
 <div style="padding: 15px; background: rgba(48,56,65,0.05); border-radius: 10px;">
 <div style="color: rgba(48,56,65,0.4); font-size: 12px;">${subInfo(t).kind === 'sessions' ? 'الحصص المتبقية' : 'تاريخ الانتهاء'}</div>
 <div style="font-weight: 600;">${esc(subInfo(t).kind === 'sessions' ? subInfo(t).remLabel : (t.expiryDate || '-'))}</div>
 </div>
 <div style="padding: 15px; background: rgba(48,56,65,0.05); border-radius: 10px;">
 <div style="color: rgba(48,56,65,0.4); font-size: 12px;">الفرع</div>
 <div style="font-weight: 600;">${esc(t.branch || 'غير محدد')}</div>
 </div>
 <div style="padding: 15px; background: rgba(48,56,65,0.05); border-radius: 10px;">
 <div style="color: rgba(48,56,65,0.4); font-size: 12px;">باقي على انتهاء الاشتراك</div>
 <div style="font-weight: 600;">${expiryCell(t)}</div>
 </div>
 <div style="padding: 15px; background: rgba(48,56,65,0.05); border-radius: 10px;">
 <div style="color: rgba(48,56,65,0.4); font-size: 12px;">مرات الحضور</div>
 <div style="font-weight: 600; color: var(--success);">${attendanceCount} مرة</div>
 </div>
 <div style="padding: 15px; background: rgba(48,56,65,0.05); border-radius: 10px;">
 <div style="color: rgba(48,56,65,0.4); font-size: 12px;">المدفوع</div>
 <div style="font-weight: 600; color: var(--warning);">${num(t.amount).toLocaleString()} ج.م</div>
 </div>
 <div style="padding: 15px; background: rgba(48,56,65,0.05); border-radius: 10px;">
 <div style="color: rgba(48,56,65,0.4); font-size: 12px;">تاريخ التسجيل</div>
 <div style="font-weight: 600;">${esc(t.registrationDate)}</div>
 </div>
 </div>
 ${t.frozen ? `<div style="margin-top: 15px; padding: 15px; background: rgba(184,144,31,0.07); border:1px solid rgba(184,144,31,0.3); border-radius: 10px;">
 <div style="color: var(--gold); font-size: 12px; font-weight:700;">❄️ الاشتراك مجمّد</div>
 <div style="font-size:13px; margin-top:4px;">السبب: ${esc(t.freezeReason || '-')}${t.freezeDate ? ' • منذ: ' + esc(t.freezeDate) : ''}</div>
 </div>` : ''}
 ${(() => {
 const active = ADDON_DEFS.filter(d => num((t.addons || {})[d.key]) > 0);
 if (active.length === 0) return '';
 return `<div style="margin-top: 15px; padding: 15px; background: rgba(48,56,65,0.05); border-radius: 10px;">
 <div style="color: rgba(48,56,65,0.4); font-size: 12px; margin-bottom: 8px;">خدمات إضافية</div>
 <div style="display:flex; flex-wrap:wrap; gap:8px;">
 ${active.map(d => `<span class="badge badge-info">${esc(d.label)}: ${num(t.addons[d.key]).toLocaleString()} ج.م</span>`).join('')}
 </div>
 </div>`;
 })()}
 ${t.notes ? `<div style="margin-top: 15px; padding: 15px; background: rgba(48,56,65,0.05); border-radius: 10px;">
 <div style="color: rgba(48,56,65,0.4); font-size: 12px;">ملاحظات</div>
 <div>${esc(t.notes)}</div>
 </div>` : ''}
 <div style="margin-top: 15px; display: flex; gap: 10px;">
 <button class="btn btn-outline btn-sm" onclick="closeModal(); editTrainee(${index})">تعديل البيانات</button>
 <button class="btn btn-outline btn-sm" onclick="printCard(${index})">طباعة البطاقة</button>
 </div>
 `;
 document.getElementById('modal-overlay').classList.add('show');
 }

 function editTrainee(index) {
 const t = data.trainees[index];
 document.getElementById('modal-title-text').textContent = `تعديل بيانات ${t.name}`;
 document.getElementById('modal-body').innerHTML = `
 <div class="form-grid">
 <div class="form-group">
 <label>الاسم الكامل</label>
 <input type="text" id="edit-name" value="${esc(t.name)}">
 </div>
 <div class="form-group">
 <label>رقم الهاتف</label>
 <input type="tel" id="edit-phone" value="${esc(t.phone)}">
 </div>
 <div class="form-group">
 <label>نوع الرياضة</label>
 <select id="edit-sport" onchange="toggleEditSportLevel()">${sportOptionsHTML(t.sport || t.plan || '')}</select>
 </div>
 <div class="form-group" id="edit-level-group" style="display:${(t.sport || t.plan) === 'جمباز فني' ? 'flex' : 'none'};">
 <label>المستوى (جمباز فني)</label>
 <select id="edit-level">${levelOptionsHTML(t.level || '')}</select>
 </div>
 <div class="form-group">
 <label>المدرب المسؤول</label>
 <select id="edit-trainer">${coachOptionsHTML(t.trainer)}</select>
 </div>
 ${t.subType === 'sessions' ? `
 <div class="form-group">
 <label>الحصص المتبقية</label>
 <input type="number" id="edit-sessions" value="${num(t.sessionsRemaining)}">
 </div>` : `
 <div class="form-group">
 <label>تاريخ بداية الاشتراك</label>
 <input type="date" id="edit-start-date" value="${t.startDate || ''}">
 </div>
 <div class="form-group">
 <label>مدة الاشتراك (بالأيام)</label>
 <input type="number" id="edit-duration" value="${t.durationDays || 30}">
 </div>`}
 <div class="form-group">
 <label>المبلغ المدفوع</label>
 <input type="number" id="edit-amount" value="${num(t.amount)}">
 </div>
 <div class="form-group">
 <label>الفرع</label>
 <select id="edit-branch">
 <option value="فرع المريوطيه 1" ${t.branch === 'فرع المريوطيه 1' ? 'selected' : ''}>فرع المريوطيه 1</option>
 <option value="فرع المريوطيه 2" ${t.branch === 'فرع المريوطيه 2' ? 'selected' : ''}>فرع المريوطيه 2</option>
 <option value="فرع الحدايق" ${t.branch === 'فرع الحدايق' ? 'selected' : ''}>فرع الحدايق</option>
 <option value="غير محدد" ${!t.branch || t.branch === 'غير محدد' ? 'selected' : ''}>غير محدد</option>
 </select>
 </div>
 <div class="form-group">
 <label>الحالة</label>
 <select id="edit-status">
 <option value="نشط" ${t.status === 'نشط' ? 'selected' : ''}>نشط</option>
 <option value="منتهي" ${t.status === 'منتهي' ? 'selected' : ''}>منتهي</option>
 <option value="تجريبي" ${t.status === 'تجريبي' ? 'selected' : ''}>تجريبي</option>
 ${t.frozen ? '<option value="مجمد" selected>مجمد</option>' : ''}
 </select>
 </div>
 <div class="form-group">
 <label>ملاحظات</label>
 <input type="text" id="edit-notes" value="${esc(t.notes || '')}">
 </div>
 </div>
 <div style="border-top: 1px solid rgba(48,56,65,0.1); margin-top: 16px; padding-top: 14px;">
 <div style="font-weight: 700; color: var(--accent); margin-bottom: 4px;">خدمات إضافية</div>
 <p style="color: rgba(48,56,65,0.5); font-size: 12px; margin-bottom: 12px;">أي زيادة في السعر تُحتسب كإيراد جديد عند الحفظ.</p>
 <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
 ${ADDON_DEFS.map(d => {
 const cur = num((t.addons || {})[d.key]);
 const checked = cur > 0 ? 'checked' : '';
 const val = cur > 0 ? cur : d.def;
 return `
 <div class="addon-box">
 <label style="display:flex; align-items:center; gap:8px; font-weight:600; margin-bottom:8px;">
 <input type="checkbox" id="edit-addon-${d.key}" ${checked} style="width:18px; height:18px;"> ${esc(d.label)}
 </label>
 <input type="number" id="edit-addon-${d.key}-price" value="${esc(val)}">
 </div>`;
 }).join('')}
 </div>
 </div>
 <button class="btn btn-primary" style="margin-top: 20px; width: 100%;" onclick="saveTraineeEdit(${index})">حفظ التعديلات</button>
 `;
 document.getElementById('modal-overlay').classList.add('show');
 }

 function saveTraineeEdit(index) {
 const t = data.trainees[index];
 t.name = document.getElementById('edit-name').value.trim() || t.name;
 t.phone = document.getElementById('edit-phone').value.trim() || t.phone;
 t.sport = document.getElementById('edit-sport').value;
 t.plan = t.sport;
 t.level = (t.sport === 'جمباز فني') ? document.getElementById('edit-level').value : '';
 t.trainer = document.getElementById('edit-trainer').value.trim() || 'غير محدد';
 t.amount = num(document.getElementById('edit-amount').value);
 t.branch = document.getElementById('edit-branch').value;
 t.status = document.getElementById('edit-status').value;
 t.notes = document.getElementById('edit-notes').value.trim();

 if (t.subType === 'sessions') {
 // Session-based: update the remaining-sessions balance directly.
 const sessEl = document.getElementById('edit-sessions');
 if (sessEl) t.sessionsRemaining = num(sessEl.value);
 } else {
 // Days-based: recompute expiry from start date + duration.
 const startEl = document.getElementById('edit-start-date');
 const durEl = document.getElementById('edit-duration');
 t.startDate = (startEl && startEl.value) || t.startDate;
 t.durationDays = (durEl && parseInt(durEl.value)) || t.durationDays || 30;
 if (t.startDate && t.durationDays) {
 t.expiryDate = addDays(t.startDate, t.durationDays);
 }
 }

 // Apply add-on changes (any added/increased service is billed as income).
 const today = new Date().toLocaleDateString('ar-EG');
 billAddons(t, readAddonInputs('edit-addon'), t.branch, today);

 dbSetDoc(traineesCol, t.id, t);
 updateTraineesTable();
 updateFinancial();
 updateDashboard();
 closeModal();
 showNotification(`تم حفظ تعديلات ${t.name}`);
 }

 function printCard(index) {
 const t = data.trainees[index];
 openCardWindow(t.id, t.name, sportLabel(t));
 }
 function deleteTrainee(index) {
 const t = data.trainees[index];
 if (confirm(`هل أنت متأكد من حذف "${t.name}"؟\nسيتم حذف سجلات حضوره أيضاً، مع الاحتفاظ بمدفوعاته في التقارير المالية.`)) {
 data.trainees.splice(index, 1);
 dbDeleteDoc(traineesCol, t.id);

 // Clean up attendance records (local + cloud). Payments are intentionally
 // kept so historical revenue stays accurate in the financial reports.
 data.attendance = data.attendance.filter(a => a.id !== t.id);
 dbDeleteWhere(attendanceCol, 'id', t.id);

 updateTraineesTable();
 updateDashboard();
 updateBadge();
 showNotification('تم حذف المتدرب وسجلات حضوره', 'danger');
 }
 }

 // ==================== FREEZE / PAUSE SUBSCRIPTION ====================
 // Opens a popup to capture the freeze reason, then pauses the subscription.
 function freezeTrainee(index) {
 const t = data.trainees[index];
 if (!t || t.frozen) return;
 document.getElementById('modal-title-text').textContent = `تجميد اشتراك - ${t.name}`;
 document.getElementById('modal-body').innerHTML = `
 <p style="color:rgba(48,56,65,0.6); margin-bottom:14px;">سيتم إيقاف الاشتراك مؤقتاً (لا يُحتسب الوقت ولا يُسمح بالحضور) حتى إلغاء التجميد.</p>
 <div class="form-group">
 <label>سبب التجميد *</label>
 <input type="text" id="freeze-reason" placeholder="مثال: سفر / إصابة / ظرف طارئ">
 </div>
 <div style="display:flex; gap:10px; margin-top:18px;">
 <button class="btn btn-primary" style="flex:1;" onclick="confirmFreeze(${index})">تأكيد التجميد</button>
 <button class="btn btn-outline" style="flex:1;" onclick="closeModal()">إلغاء</button>
 </div>`;
 document.getElementById('modal-overlay').classList.add('show');
 }

 function confirmFreeze(index) {
 const t = data.trainees[index];
 if (!t) return;
 const reason = document.getElementById('freeze-reason').value.trim();
 if (!reason) { showNotification('يرجى كتابة سبب التجميد', 'warning'); return; }

 t.frozen = true;
 t.freezeReason = reason;
 t.freezeDate = new Date().toISOString().slice(0, 10);
 // Preserve the remaining days so they're restored on unfreeze (days-based only).
 if (t.subType !== 'sessions') {
 const left = daysLeft(t);
 t.frozenDaysLeft = (left !== null && left > 0) ? left : 0;
 }
 t.status = 'مجمد';
 dbSetDoc(traineesCol, t.id, t);

 closeModal();
 updateTraineesTable();
 updateDashboard();
 showNotification(`تم تجميد اشتراك ${t.name}`);
 }

 function unfreezeTrainee(index) {
 const t = data.trainees[index];
 if (!t || !t.frozen) return;
 if (!confirm(`إلغاء تجميد اشتراك "${t.name}" واستئنافه؟`)) return;

 // Days-based: resume by extending the expiry from today by the days that
 // were left when it was frozen (so frozen time isn't lost). Session-based
 // keeps its remaining sessions as they are.
 if (t.subType !== 'sessions') {
 const days = num(t.frozenDaysLeft);
 const todayISO = new Date().toISOString().slice(0, 10);
 t.expiryDate = addDays(todayISO, days);
 t.startDate = todayISO;
 }
 t.frozen = false;
 t.freezeReason = '';
 t.frozenDaysLeft = null;
 t.status = 'نشط';
 dbSetDoc(traineesCol, t.id, t);

 updateTraineesTable();
 updateDashboard();
 showNotification(`تم إلغاء تجميد اشتراك ${t.name}`);
 }

 // ==================== INSTALLMENTS ====================
 function payInstallment(index) {
 const t = data.trainees[index];
 if (!t) return;
 const remaining = Math.max(0, num(t.subTotal) - num(t.subPaid));
 document.getElementById('modal-title-text').textContent = `دفع قسط - ${t.name}`;
 document.getElementById('modal-body').innerHTML = `
 <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:16px;">
 ${attRow('السعر الإجمالي', num(t.subTotal).toLocaleString() + ' ج.م')}
 ${attRow('المدفوع', num(t.subPaid).toLocaleString() + ' ج.م')}
 ${attRow('المتبقي', remaining.toLocaleString() + ' ج.م')}
 </div>
 <div class="form-group"><label>مبلغ القسط</label><input type="number" id="install-amount" value="${remaining}"></div>
 <div class="form-group"><label>طريقة الدفع</label><select id="install-method">${methodOptionsHTML('')}</select></div>
 <div style="display:flex; gap:10px; margin-top:18px;">
 <button class="btn btn-success" style="flex:1;" onclick="confirmInstallment(${index})">تأكيد الدفع</button>
 <button class="btn btn-outline" style="flex:1;" onclick="closeModal()">إلغاء</button>
 </div>`;
 document.getElementById('modal-overlay').classList.add('show');
 }

 function confirmInstallment(index) {
 const t = data.trainees[index];
 if (!t) return;
 const amount = num(document.getElementById('install-amount').value);
 const method = document.getElementById('install-method').value;
 if (amount <= 0) { showNotification('أدخل مبلغاً صالحاً', 'warning'); return; }

 t.subPaid = num(t.subPaid) + amount;
 t.amount = num(t.amount) + amount;
 const remaining = Math.max(0, num(t.subTotal) - num(t.subPaid));
 const today = new Date().toLocaleDateString('ar-EG');
 const payDocId = genDocId('PAY');
 const payment = {
 _docId: payDocId, id: t.id, name: t.name, type: 'قسط', plan: sportLabel(t),
 amount, method, date: today, status: remaining > 0 ? 'قسط' : 'مكتمل', branch: t.branch
 };
 data.payments.push(payment);
 dbSetDoc(paymentsCol, payDocId, payment);
 dbSetDoc(traineesCol, t.id, t);

 closeModal();
 updateTraineesTable();
 updateFinancial();
 updateDashboard();
 showNotification(`تم دفع قسط ${amount.toLocaleString()} ج.م لـ ${t.name}`);
 }

 function printID() {
 const id = document.getElementById('generated-id').textContent;
 const trainee = data.trainees.find(t => t.id === id);
 const name = trainee ? trainee.name : '';
 const plan = trainee ? (trainee.sport || trainee.plan || '') : '';
 openCardWindow(id, name, plan);
 }

 function openCardWindow(id, name, plan) {
 const logoUrl = new URL('src/logo-after.png', location.href).href;
 const qrUrl = new URL('vendor/qrcode.min.js', location.href).href;
 const win = window.open('', '_blank');
 if (!win) { showNotification('فعّل السماح بالنوافذ المنبثقة لطباعة البطاقة', 'warning'); return; }
 win.document.write(`
 <html dir="rtl" lang="ar"><head><title>بطاقة العضوية - ${esc(id)}</title>
 <meta charset="UTF-8">
 <script src="${qrUrl}"><\/script>
 <style>
 @page { size: 90mm 56mm; margin: 0; }
 * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
 html, body { margin: 0; padding: 0; background: #ffffff; }
 /* Only the card itself is printed (page is sized to the card) */
 .card {
 position: relative;
 width: 90mm; height: 56mm;
 overflow: hidden;
 background:
 radial-gradient(60mm 40mm at 88% 8%, rgba(212,175,55,0.18), transparent 60%),
 linear-gradient(135deg, #1B2433 0%, #243049 60%, #18212f 100%);
 border-radius: 8px;
 padding: 4.5mm 5mm;
 display: flex;
 flex-direction: column;
 justify-content: space-between;
 color: #E9EDF3;
 }
 /* Gold frame + top accent bar */
 .card::before {
 content: '';
 position: absolute; inset: 1.1mm;
 border: 0.5mm solid rgba(212,175,55,0.55);
 border-radius: 6px;
 pointer-events: none;
 }
 .card::after {
 content: '';
 position: absolute; top: 0; right: 0; left: 0; height: 1.6mm;
 background: linear-gradient(90deg, #B8901F, #D4AF37, #B8901F);
 }
 .card-top { display: flex; justify-content: space-between; align-items: center; z-index: 1; }
 .brand { line-height: 1.1; }
 .club-name { font-size: 15px; font-weight: 900; letter-spacing: 1px; color: #ffffff; }
 .club-name span { color: #D4AF37; }
 .club-sub { font-size: 7.5px; letter-spacing: 3px; color: rgba(212,175,55,0.85); margin-top: 1.5mm; text-transform: uppercase; }
 .monogram {
 width: 11mm; height: 11mm; border-radius: 50%;
 border: 0.5mm solid #D4AF37;
 display: flex; align-items: center; justify-content: center;
 font-size: 12px; font-weight: 900; color: #D4AF37;
 background: rgba(212,175,55,0.08);
 }
 .brand-logo { height: 12mm; width: auto; }
 .divider { height: 0.3mm; background: linear-gradient(90deg, transparent, rgba(212,175,55,0.6), transparent); margin: 1mm 0; z-index: 1; }
 .card-body { display: flex; justify-content: space-between; align-items: center; gap: 4mm; z-index: 1; }
 .card-info { flex: 1; min-width: 0; }
 .lbl { font-size: 6.5px; letter-spacing: 1px; color: rgba(233,237,243,0.5); text-transform: uppercase; }
 .member-name { font-size: 15px; font-weight: 800; color: #ffffff; margin-bottom: 1.5mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
 .member-plan { font-size: 9px; color: #D4AF37; font-weight: 600; margin-bottom: 2mm; }
 .member-code { font-size: 13px; font-family: 'Courier New', monospace; letter-spacing: 1px; color: #E9EDF3; font-weight: 700; }
 .qr-box { background: #ffffff; padding: 1.2mm; border-radius: 1.5mm; line-height: 0; box-shadow: 0 0 0 0.4mm rgba(212,175,55,0.5); }
 .card-footer { font-size: 6.5px; color: rgba(212,175,55,0.7); text-align: center; letter-spacing: 0.5px; z-index: 1; }
 </style>
 </head>
 <body>
 <div class="card">
 <div class="card-top">
 <div class="brand">
 <div class="club-name">El Wasl <span>Academy</span></div>
 <div class="club-sub">Membership Card</div>
 </div>
 <img class="brand-logo" src="${logoUrl}" alt="" onerror="this.style.display='none'; var m=document.getElementById('mono'); if(m){m.style.display='flex';}">
 <div class="monogram" id="mono" style="display:none;">EW</div>
 </div>
 <div class="divider"></div>
 <div class="card-body">
 <div class="card-info">
 <div class="lbl">الاسم</div>
 <div class="member-name">${esc(name)}</div>
 ${plan ? `<div class="member-plan">${esc(plan)}</div>` : ''}
 <div class="lbl">الكود</div>
 <div class="member-code">${esc(id)}</div>
 </div>
 <div class="qr-box" id="qrcode"></div>
 </div>
 <div class="card-footer">يُستخدم هذا الكود لتسجيل الحضور عند الدخول</div>
 </div>
 <script>
 window.onload = function() {
 function render() {
 if (window.QRCode) {
 new QRCode(document.getElementById("qrcode"), { text: "${id}", width: 96, height: 96, colorDark: "#1B2433", colorLight: "#ffffff" });
 }
 setTimeout(function() { window.print(); }, 350);
 }
 if (window.QRCode) { render(); }
 else { var s = document.createElement('script'); s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"; s.onload = render; s.onerror = render; document.head.appendChild(s); }
 };
 <\/script>
 </body></html>
 `);
 win.document.close();
 }

 // Generates `n` unique codes (Wasl-XXXX) that don't collide with existing
 // trainees or with each other within the batch.
 function generateUniqueCodes(n) {
 const used = new Set(data.trainees.map(t => (t.id || '').toLowerCase()));
 const codes = [];
 let guard = 0;
 while (codes.length < n && guard < n * 200 + 1000) {
 guard++;
 const c = `Wasl-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
 if (!used.has(c.toLowerCase())) { used.add(c.toLowerCase()); codes.push(c); }
 }
 return codes;
 }

 // Prints branded cards that each carry a unique pre-generated code + QR.
 // You write the name/sport by hand, then enter the card's code when you
 // register that player (so codes can never clash).
 function printBlankCards() {
 const qty = Math.min(parseInt(document.getElementById('blank-cards-qty').value) || 0, 200);
 if (qty <= 0) { showNotification('أدخل عدد الكروت', 'warning'); return; }
 const logoUrl = new URL('src/logo-after.png', location.href).href;
 const codes = generateUniqueCodes(qty);

 const cards = codes.map(code => `
 <div class="card">
 <div class="card-top">
 <div class="brand">
 <div class="club-name">El Wasl <span>Academy</span></div>
 <div class="club-sub">Membership Card</div>
 </div>
 <img class="brand-logo" src="${logoUrl}" alt="" onerror="this.style.display='none'">
 </div>
 <div class="divider"></div>
 <div class="card-body">
 <div class="card-info">
 <div class="lbl">الكود</div>
 <div class="member-code">${esc(code)}</div>
 </div>
 <div class="qr-box"><div class="qr" data-code="${esc(code)}"></div></div>
 </div>
 <div class="card-footer">يُستخدم هذا الكود لتسجيل الحضور عند الدخول</div>
 </div>`).join('');

 const qrUrl = new URL('vendor/qrcode.min.js', location.href).href;
 const win = window.open('', '_blank');
 if (!win) { showNotification('فعّل السماح بالنوافذ المنبثقة لطباعة الكروت', 'warning'); return; }
 win.document.write(`
 <html dir="rtl" lang="ar"><head><title>كروت بأكواد (${qty})</title>
 <meta charset="UTF-8">
 <script src="${qrUrl}"><\/script>
 <style>
 @page { size: A4; margin: 8mm; }
 * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
 body { display: flex; flex-wrap: wrap; gap: 5mm; padding: 2mm; background: #ffffff; }
 .card {
 position: relative; width: 90mm; height: 56mm; overflow: hidden;
 background:
 radial-gradient(60mm 40mm at 88% 8%, rgba(212,175,55,0.18), transparent 60%),
 linear-gradient(135deg, #1B2433 0%, #243049 60%, #18212f 100%);
 border-radius: 8px; padding: 4.5mm 5mm;
 display: flex; flex-direction: column; justify-content: space-between; color: #E9EDF3;
 }
 .card::before { content: ''; position: absolute; inset: 1.1mm; border: 0.5mm solid rgba(212,175,55,0.55); border-radius: 6px; }
 .card::after { content: ''; position: absolute; top: 0; right: 0; left: 0; height: 1.6mm; background: linear-gradient(90deg, #B8901F, #D4AF37, #B8901F); }
 .card-top { display: flex; justify-content: space-between; align-items: center; z-index: 1; }
 .club-name { font-size: 15px; font-weight: 900; color: #fff; letter-spacing: 1px; }
 .club-name span { color: #D4AF37; }
 .club-sub { font-size: 7.5px; letter-spacing: 3px; color: rgba(212,175,55,0.85); margin-top: 1.5mm; text-transform: uppercase; }
 .brand-logo { height: 12mm; width: auto; }
 .divider { height: 0.3mm; background: linear-gradient(90deg, transparent, rgba(212,175,55,0.6), transparent); margin: 1mm 0; }
 .card-body { display: flex; justify-content: space-between; align-items: center; gap: 4mm; z-index: 1; }
 .card-info { flex: 1; min-width: 0; }
 .lbl { font-size: 7px; letter-spacing: 1px; color: rgba(233,237,243,0.5); text-transform: uppercase; }
 .member-code { font-size: 16px; font-family: 'Courier New', monospace; letter-spacing: 1px; color: #D4AF37; font-weight: 800; margin-top: 1mm; }
 .qr-box { background: #ffffff; padding: 1.2mm; border-radius: 1.5mm; line-height: 0; box-shadow: 0 0 0 0.4mm rgba(212,175,55,0.5); }
 .card-footer { font-size: 6.5px; color: rgba(212,175,55,0.7); text-align: center; z-index: 1; }
 </style>
 </head>
 <body>
 ${cards}
 <script>
 window.onload = function() {
 function render() {
 if (window.QRCode) {
 document.querySelectorAll('.qr').forEach(function(el) {
 new QRCode(el, { text: el.getAttribute('data-code'), width: 64, height: 64, colorDark: '#1B2433', colorLight: '#ffffff' });
 });
 }
 setTimeout(function() { window.print(); }, 500);
 }
 if (window.QRCode) { render(); }
 else { var s = document.createElement('script'); s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"; s.onload = render; s.onerror = render; document.head.appendChild(s); }
 };
 <\/script>
 </body></html>
 `);
 win.document.close();
 }

 // ==================== ATTENDANCE ====================
 // Auto-submit: as soon as the entered/scanned code exactly matches a known
 // trainee, register the attendance — no need to press the button or scan.
 let attendanceInputTimer = null;
 function onAttendanceInput() {
 clearTimeout(attendanceInputTimer);
 attendanceInputTimer = setTimeout(() => {
 const cur = document.getElementById('attendance-code').value.trim();
 if (cur && findTraineeByCode(cur)) {
 recordAttendance();
 }
 }, 150);
 }

 function recordAttendance() {
 const raw = document.getElementById('attendance-code').value.trim();

 if (!raw) {
 showNotification('يرجى إدخال كود المتدرب', 'warning');
 return;
 }

 const trainee = findTraineeByCode(raw);
 if (!trainee) {
 renderAttendanceCard(null, null, { state: 'notfound', code: raw });
 return;
 }
 const code = trainee.id; // use the canonical stored id from here on

 const info = subInfo(trainee);

 // Frozen subscription -> paused, entry not allowed.
 if (trainee.frozen) {
 renderAttendanceCard(trainee, info, { state: 'frozen' });
 document.getElementById('attendance-code').value = '';
 return;
 }

 // Expired subscription -> entry forbidden, nothing is recorded.
 if (trainee.type === 'subscription' && info.expired) {
 renderAttendanceCard(trainee, info, { state: 'blocked' });
 document.getElementById('attendance-code').value = '';
 return;
 }

 // Already checked in today -> show info, don't record/consume again.
 const today = new Date().toLocaleDateString('ar-EG');
 const alreadyCheckedIn = data.attendance.some(a => a.id === code && a.date === today);
 if (alreadyCheckedIn) {
 renderAttendanceCard(trainee, info, { state: 'already' });
 document.getElementById('attendance-code').value = '';
 return;
 }

 // Detect a comeback after a long absence (measured BEFORE adding today's record).
 const absBefore = lastAttendanceInfo(trainee);
 const returnedAfter = (!absBefore.neverAttended && absBefore.days >= ABSENCE_ALERT_DAYS) ? absBefore.days : 0;

 const now = new Date();
 const time = now.toLocaleTimeString('ar-EG');
 const attendanceEntry = { id: code, name: trainee.name, date: today, time, status: 'حاضر' };
 data.attendance.push(attendanceEntry);
 dbAddDoc(attendanceCol, attendanceEntry);

 // Consume one session for session-based subscriptions.
 if (trainee.type === 'subscription' && info.kind === 'sessions') {
 trainee.sessionsRemaining = num(trainee.sessionsRemaining) - 1;
 if (trainee.sessionsRemaining <= 0) trainee.status = 'منتهي';
 dbSetDoc(traineesCol, trainee.id, trainee);
 }

 const after = subInfo(trainee);
 renderAttendanceCard(trainee, after, { state: 'recorded', time, returnedAfter });

 document.getElementById('attendance-code').value = '';
 updateAttendanceLog();
 updateTraineesTable();
 updateDashboard();
 showNotification(`تم تسجيل حضور ${trainee.name}`);
 }

 // Builds a small info row for the attendance result card.
 function attRow(label, value) {
 return `<div style="background:rgba(48,56,65,0.04);border-radius:8px;padding:8px 10px;text-align:right;">
 <div style="font-size:11px;color:rgba(48,56,65,0.5);">${esc(label)}</div>
 <div style="font-weight:700;font-size:14px;">${esc(value)}</div>
 </div>`;
 }

 // Renders the full attendance result: trainee details + a status alert.
 function renderAttendanceCard(t, info, opts) {
 const resultDiv = document.getElementById('attendance-result');

 if (opts.state === 'notfound') {
 resultDiv.className = 'attendance-result error';
 resultDiv.innerHTML = `
 <div style="font-size:18px;font-weight:800;color:var(--danger);">كود غير موجود!</div>
 <div style="font-size:13px;color:rgba(48,56,65,0.6);margin-top:6px;">الكود "${esc(opts.code)}" غير مسجل في النظام</div>`;
 return;
 }

 resultDiv.className = 'attendance-result ' + (opts.state === 'blocked' || opts.state === 'frozen' ? 'error' : 'success');

 const typeLabel = info.kind === 'sessions' ? 'بالحصص' : info.kind === 'days' ? 'بالأيام' : '—';
 const details = `
 <div style="font-size:20px;font-weight:800;margin-bottom:4px;">${esc(t.name)}</div>
 <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;">
 ${attRow('الكود', t.id)}
 ${attRow('الرياضة', sportLabel(t))}
 ${attRow('المدرب', t.trainer || 'غير محدد')}
 ${attRow('الفرع', t.branch || 'غير محدد')}
 ${attRow('نوع الاشتراك', typeLabel)}
 ${attRow('المتبقي', info.remLabel || '—')}
 ${info.kind === 'days' ? attRow('تاريخ الانتهاء', t.expiryDate || '-') : ''}
 </div>`;

 let alert = '';
 if (opts.state === 'frozen') {
 alert = `<div class="att-alert att-alert-danger">❄️ الاشتراك مجمّد مؤقتاً — لا يمكن تسجيل الحضور.${t.freezeReason ? '<br>السبب: ' + esc(t.freezeReason) : ''}</div>`;
 } else if (opts.state === 'blocked') {
 alert = `<div class="att-alert att-alert-danger">⛔ ممنوع من الدخول — الاشتراك منتهي.<br>برجاء تجديد الاشتراك قبل الدخول.</div>`;
 } else if (opts.state === 'already') {
 alert = `<div class="att-alert att-alert-info">تم تسجيل حضور هذا المتدرب مسبقاً اليوم.</div>`;
 if (info.near) alert += `<div class="att-alert att-alert-warning">⚠️ الاشتراك قارب على الانتهاء (${esc(info.remLabel)}). برجاء التجديد.</div>`;
 } else {
 alert = `<div class="att-alert att-alert-success">✅ تم تسجيل الحضور بنجاح${opts.time ? ' - ' + esc(opts.time) : ''}.</div>`;
 if (opts.returnedAfter) alert += `<div class="att-alert att-alert-info">👋 عاد بعد انقطاع ${opts.returnedAfter} يوم — أهلاً بعودته!</div>`;
 if (info.expired) alert += `<div class="att-alert att-alert-warning">⚠️ تم استهلاك آخر حصة في الاشتراك. برجاء التجديد قبل الحضور القادم.</div>`;
 else if (info.near) alert += `<div class="att-alert att-alert-warning">⚠️ الاشتراك قارب على الانتهاء (${esc(info.remLabel)}). برجاء تجديد الاشتراك.</div>`;
 }

 // Offer a one-click renewal whenever the subscription is expired or close.
 const renewBtn = (info.expired || info.near)
 ? `<button class="btn btn-warning" style="width:100%; margin-top:10px;" onclick="goRenew('${esc(t.id)}')">تجديد الاشتراك الآن</button>`
 : '';

 resultDiv.innerHTML = details + alert + renewBtn;
 }

 function updateAttendanceLog() {
 const today = new Date().toLocaleDateString('ar-EG');
 const todayAttendance = data.attendance.filter(a => a.date === today);

 document.getElementById('today-present').textContent = todayAttendance.length;

 const totalActive = data.trainees.filter(t => t.status === 'نشط').length;
 const absent = Math.max(0, totalActive - todayAttendance.length);
 document.getElementById('today-absent').textContent = absent;

 const rate = totalActive > 0 ? Math.round((todayAttendance.length / totalActive) * 100) : 0;
 document.getElementById('attendance-rate').textContent = `${rate}%`;

 const tbody = document.getElementById('attendance-log');
 if (todayAttendance.length === 0) {
 tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: rgba(48,56,65,0.3); padding: 30px;">لا توجد سجلات حضور لليوم</td></tr>';
 return;
 }

 tbody.innerHTML = todayAttendance.map((a, i) => `
 <tr>
 <td>${i + 1}</td>
 <td><code style="color: var(--gold); font-family: monospace;">${esc(a.id)}</code></td>
 <td>${esc(a.name)}</td>
 <td>${esc(a.time)}</td>
 <td><span class="badge badge-success">حاضر</span></td>
 </tr>
 `).join('');
 }

 // ==================== FINANCIAL ====================
 function searchTraineeForRenewal() {
 const trainee = findTraineeByCode(document.getElementById('renew-code').value);
 document.getElementById('renew-name').value = trainee ? trainee.name : '';
 // Adapt the duration field's label to the trainee's subscription type.
 const label = document.getElementById('renew-duration-label');
 if (label) {
 label.textContent = (trainee && trainee.subType === 'sessions')
 ? 'عدد الحصص المضافة'
 : 'مدة التجديد (بالأيام)';
 }
 }

 function renewSubscription() {
 const rawCode = document.getElementById('renew-code').value.trim();
 const duration = document.getElementById('renew-duration').value || 30;
 const amount = document.getElementById('renew-amount').value;
 const method = document.getElementById('renew-method').value;
 const branch = document.getElementById('renew-branch').value;
 const date = document.getElementById('renew-date').value;

 if (!rawCode || !amount || !branch) {
 showNotification('يرجى ملء جميع البيانات', 'warning');
 return;
 }

 const trainee = findTraineeByCode(rawCode);
 if (!trainee) {
 showNotification('الكود غير موجود', 'danger');
 return;
 }

 const today = new Date().toLocaleDateString('ar-EG');
 const todayISO = new Date().toISOString().slice(0,10);

 const payDocId = genDocId('PAY');
 const payment = {
 _docId: payDocId,
 id: trainee.id,
 name: trainee.name,
 type: 'تجديد',
 plan: trainee.sport || trainee.plan,
 amount: parseInt(amount),
 method,
 date: date || today,
 status: 'مكتمل',
 branch: branch
 };
 data.payments.push(payment);
 dbSetDoc(paymentsCol, payDocId, payment);

 if (trainee.subType === 'sessions') {
 // Add the entered number of sessions to the remaining balance.
 const add = parseInt(duration) || 0;
 trainee.sessionsTotal = num(trainee.sessionsTotal) + add;
 trainee.sessionsRemaining = num(trainee.sessionsRemaining) + add;
 } else {
 // Extend from current expiry if still active, otherwise from today.
 const base = (trainee.expiryDate && new Date(trainee.expiryDate) > new Date()) ? trainee.expiryDate : todayISO;
 trainee.expiryDate = addDays(base, duration);
 trainee.durationDays = parseInt(duration);
 }
 trainee.status = 'نشط';
 // New period starts fully paid (renewal amount), clearing any old balance.
 trainee.subTotal = parseInt(amount);
 trainee.subPaid = parseInt(amount);
 dbSetDoc(traineesCol, trainee.id, trainee);
 updateFinancial();
 updateTraineesTable();
 updateDashboard();

 document.getElementById('renew-code').value = '';
 document.getElementById('renew-name').value = '';
 document.getElementById('renew-amount').value = '';

 showNotification(`تم تجديد اشتراك ${trainee.name} بنجاح!`);
 }

 function updateFinancial() {
 const totalIncome = data.payments.reduce((sum, p) => sum + num(p.amount), 0);
 const totalExpenses = data.expenses.reduce((sum, e) => sum + num(e.amount), 0);
 const totalSalaries = data.expenses.filter(e => isSalaryType(e.type)).reduce((sum, e) => sum + num(e.amount), 0);
 const allExpenses = totalExpenses;

 document.getElementById('fin-income').textContent = `${totalIncome.toLocaleString()} ج.م`;
 document.getElementById('fin-expenses').textContent = `${allExpenses.toLocaleString()} ج.م`;
 document.getElementById('fin-profit').textContent = `${(totalIncome - allExpenses).toLocaleString()} ج.م`;

 const tbody = document.getElementById('payments-table');
 if (data.payments.length === 0) {
 tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color: rgba(48,56,65,0.3); padding: 30px;">لا توجد مدفوعات مسجلة</td></tr>';
 return;
 }

 tbody.innerHTML = data.payments.map(p => {
 const actions = currentRole === 'admin' && p._docId ? `
 <button class="btn btn-outline btn-sm" onclick="editPayment('${esc(p._docId)}')">تعديل</button>
 <button class="btn btn-danger btn-sm" onclick="deletePayment('${esc(p._docId)}')">حذف</button>` : '—';
 return `
 <tr>
 <td><code style="color: var(--gold); font-family: monospace;">${esc(p.id)}</code></td>
 <td>${esc(p.name)}</td>
 <td><span class="badge ${p.type === 'تجديد' ? 'badge-info' : 'badge-success'}">${esc(p.type)}</span></td>
 <td style="font-size: 12px;">${esc(p.plan)}</td>
 <td><span class="badge" style="background: rgba(48,56,65,0.05); border: 1px solid rgba(48,56,65,0.2);">${esc(p.branch || 'غير محدد')}</span></td>
 <td style="color: var(--success); font-weight: 700;">${num(p.amount).toLocaleString()} ج.م</td>
 <td>${esc(p.method)}</td>
 <td>${esc(p.date)}</td>
 <td><span class="badge badge-success">${esc(p.status)}</span></td>
 <td>${actions}</td>
 </tr>
 `;
 }).join('');
 }

 // ==================== SALARIES ====================
 function addEmployee() {
 const name = document.getElementById('emp-name').value.trim();
 const role = document.getElementById('emp-role').value;
 const salary = document.getElementById('emp-salary').value;
 const branch = document.getElementById('emp-branch').value;

 if (!name || !salary || !branch) {
 showNotification('يرجى ملء جميع البيانات', 'warning');
 return;
 }

 const employee = {
 id: `EMP-${Date.now()}`,
 code: generateStaffCode(),
 name,
 role,
 salary: parseInt(salary),
 branch: branch,
 status: 'نشط',
 joinDate: new Date().toLocaleDateString('ar-EG')
 };
 data.employees.push(employee);
 dbSetDoc(employeesCol, employee.id, employee);
 updateSalaries();

 document.getElementById('emp-name').value = '';
 document.getElementById('emp-salary').value = '';
 showNotification(`تم إضافة ${name} بنجاح!`);
 }

 function addExpense() {
 const type = document.getElementById('expense-type').value;
 const desc = document.getElementById('expense-desc').value;
 const amount = document.getElementById('expense-amount').value;
 const branch = document.getElementById('expense-branch').value;

 if (!amount || !branch) {
 showNotification('يرجى ملء جميع البيانات', 'warning');
 return;
 }

 const expense = {
 id: `EXP-${Date.now()}`,
 type,
 desc,
 amount: parseInt(amount),
 branch: branch,
 date: new Date().toLocaleDateString('ar-EG')
 };
 data.expenses.push(expense);
 dbSetDoc(expensesCol, expense.id, expense);
 updateSalaries();
 updateFinancial();

 document.getElementById('expense-desc').value = '';
 document.getElementById('expense-amount').value = '';
 showNotification('تم تسجيل المصروف بنجاح!');
 }

 function updateSalaries() {
 const empTbody = document.getElementById('employees-table');
 // Coaches have their own dedicated section, so exclude them here. Keep the
 // original index so paySalary/deleteEmployee still point to the right record.
 const nonCoaches = data.employees.map((e, i) => ({ e, i })).filter(x => !(x.e.role && x.e.role.indexOf('مدرب') !== -1));
  if (nonCoaches.length === 0) {
  empTbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: rgba(48,56,65,0.3); padding: 30px;">لا يوجد موظفون مسجلون</td></tr>';
  } else {
 empTbody.innerHTML = nonCoaches.map(({ e, i }, rowNum) => `
 <tr>
 <td>${rowNum + 1}</td>
 <td><strong>${esc(e.name)}</strong></td>
  <td>${esc(e.role)}</td>
  <td><span class="badge" style="background: rgba(48,56,65,0.05); border: 1px solid rgba(48,56,65,0.2);">${esc(e.branch || 'غير محدد')}</span></td>
  <td style="color: var(--warning); font-weight: 700;">${num(e.salary).toLocaleString()} ج.م</td>
 <td><span class="badge badge-success">${esc(e.status)}</span></td>
 <td>
 <button class="btn btn-success btn-sm" onclick="paySalary(${i})">صرف</button>
 <button class="btn btn-danger btn-sm" onclick="deleteEmployee(${i})">حذف</button>
 </td>
 </tr>
 `).join('');
 }

 const expTbody = document.getElementById('expenses-table');
 if (data.expenses.length === 0) {
 expTbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: rgba(48,56,65,0.3); padding: 30px;">لا توجد مصروفات مسجلة</td></tr>';
 } else {
 expTbody.innerHTML = data.expenses.map((e, i) => `
 <tr>
 <td>${i + 1}</td>
 <td><span class="badge badge-warning">${esc(e.type)}</span></td>
 <td>${esc(e.desc || '-')}</td>
 <td><span class="badge" style="background: rgba(48,56,65,0.05); border: 1px solid rgba(48,56,65,0.2);">${esc(e.branch || 'غير محدد')}</span></td>
 <td style="color: var(--danger); font-weight: 700;">${num(e.amount).toLocaleString()} ج.م</td>
 <td>${esc(e.date)}</td>
 <td>
 <button class="btn btn-outline btn-sm" onclick="editExpense('${esc(e.id)}')">تعديل</button>
 <button class="btn btn-danger btn-sm" onclick="deleteExpense('${esc(e.id)}')">حذف</button>
 </td>
 </tr>
 `).join('');
 }
 }

 // Opens a styled confirmation popup (not a native confirm dialog).
 function paySalary(index) {
 const emp = data.employees[index];
 if (!emp) return;
 document.getElementById('modal-title-text').textContent = `صرف راتب - ${emp.name}`;
 document.getElementById('modal-body').innerHTML = `
 <p style="margin-bottom:18px; font-size:15px;">تأكيد صرف راتب <strong>${esc(emp.name)}</strong> بمبلغ <strong style="color:var(--warning);">${num(emp.salary).toLocaleString()} ج.م</strong>؟</p>
 <div style="display:flex; gap:10px;">
 <button class="btn btn-success" style="flex:1;" onclick="doPaySalary(${index})">تأكيد الصرف</button>
 <button class="btn btn-outline" style="flex:1;" onclick="closeModal()">إلغاء</button>
 </div>
 `;
 document.getElementById('modal-overlay').classList.add('show');
 }

 function doPaySalary(index) {
 const emp = data.employees[index];
 if (!emp) return;
 const today = new Date().toLocaleDateString('ar-EG');
 const expense = {
 id: `SAL-${Date.now()}`,
 type: 'مرتب',
 desc: `راتب ${emp.name} (${emp.role})`,
 amount: emp.salary,
 branch: emp.branch,
 date: today,
 staffId: emp.id
 };
 data.expenses.push(expense);
 dbSetDoc(expensesCol, expense.id, expense);
 updateSalaries();
 updateFinancial();
 updateReports();
 closeModal();
 showNotification(`تم صرف راتب ${emp.name}: ${num(emp.salary).toLocaleString()} ج.م`);
 }

 function deleteEmployee(index) {
 if (confirm('هل تريد حذف هذا الموظف؟')) {
 const emp = data.employees[index];
 data.employees.splice(index, 1);
 dbDeleteDoc(employeesCol, emp.id);
 updateSalaries();
 }
 }

 // ==================== EDIT / DELETE FINANCIAL RECORDS ====================
 // Editing/deleting payments and expenses is restricted to admins, both in
 // the UI here and enforced server-side by the Firestore rules.

 function deletePayment(docId) {
 if (currentRole !== 'admin') return;
 const p = data.payments.find(x => x._docId === docId);
 if (!p) return;
 if (!confirm(`حذف عملية الدفع لـ "${p.name}" بمبلغ ${num(p.amount).toLocaleString()} ج.م؟`)) return;
 data.payments = data.payments.filter(x => x._docId !== docId);
 dbDeleteDoc(paymentsCol, docId);
 updateFinancial();
 updateDashboard();
 showNotification('تم حذف عملية الدفع', 'danger');
 }

 function editPayment(docId) {
 if (currentRole !== 'admin') return;
 const p = data.payments.find(x => x._docId === docId);
 if (!p) return;
 document.getElementById('modal-title-text').textContent = `تعديل عملية دفع - ${p.name}`;
 document.getElementById('modal-body').innerHTML = `
 <div class="form-grid">
 <div class="form-group">
 <label>المبلغ المدفوع (ج.م)</label>
 <input type="number" id="edit-pay-amount" value="${esc(num(p.amount))}">
 </div>
 <div class="form-group">
 <label>طريقة الدفع</label>
 <select id="edit-pay-method">
 <option ${p.method === 'نقداً' ? 'selected' : ''}>نقداً</option>
 <option ${p.method === 'تحويل بنكي' ? 'selected' : ''}>تحويل بنكي</option>
 <option ${p.method === 'فودافون كاش' ? 'selected' : ''}>فودافون كاش</option>
 <option ${p.method === 'انستا باي' ? 'selected' : ''}>انستا باي</option>
 </select>
 </div>
 <div class="form-group">
 <label>التاريخ</label>
 <input type="text" id="edit-pay-date" value="${esc(p.date)}">
 </div>
 </div>
 <button class="btn btn-primary" style="margin-top: 20px; width: 100%;" onclick="savePaymentEdit('${esc(docId)}')">حفظ التعديلات</button>
 `;
 document.getElementById('modal-overlay').classList.add('show');
 }

 function savePaymentEdit(docId) {
 if (currentRole !== 'admin') return;
 const p = data.payments.find(x => x._docId === docId);
 if (!p) return;
 p.amount = num(document.getElementById('edit-pay-amount').value);
 p.method = document.getElementById('edit-pay-method').value;
 p.date = document.getElementById('edit-pay-date').value.trim() || p.date;
 dbSetDoc(paymentsCol, docId, p);
 closeModal();
 updateFinancial();
 updateDashboard();
 showNotification('تم تعديل عملية الدفع');
 }

 function deleteExpense(id) {
 if (currentRole !== 'admin') return;
 const e = data.expenses.find(x => x.id === id);
 if (!e) return;
 if (!confirm(`حذف هذا المصروف "${e.type}" بمبلغ ${num(e.amount).toLocaleString()} ج.م؟`)) return;
 data.expenses = data.expenses.filter(x => x.id !== id);
 dbDeleteDoc(expensesCol, id);
 updateSalaries();
 updateFinancial();
 updateReports();
 showNotification('تم حذف المصروف', 'danger');
 }

 function editExpense(id) {
 if (currentRole !== 'admin') return;
 const e = data.expenses.find(x => x.id === id);
 if (!e) return;
 document.getElementById('modal-title-text').textContent = `تعديل مصروف`;
 document.getElementById('modal-body').innerHTML = `
 <div class="form-grid">
 <div class="form-group">
 <label>الوصف</label>
 <input type="text" id="edit-exp-desc" value="${esc(e.desc || '')}">
 </div>
 <div class="form-group">
 <label>المبلغ (ج.م)</label>
 <input type="number" id="edit-exp-amount" value="${esc(num(e.amount))}">
 </div>
 <div class="form-group">
 <label>التاريخ</label>
 <input type="text" id="edit-exp-date" value="${esc(e.date)}">
 </div>
 </div>
 <button class="btn btn-primary" style="margin-top: 20px; width: 100%;" onclick="saveExpenseEdit('${esc(id)}')">حفظ التعديلات</button>
 `;
 document.getElementById('modal-overlay').classList.add('show');
 }

 function saveExpenseEdit(id) {
 if (currentRole !== 'admin') return;
 const e = data.expenses.find(x => x.id === id);
 if (!e) return;
 e.desc = document.getElementById('edit-exp-desc').value.trim();
 e.amount = num(document.getElementById('edit-exp-amount').value);
 e.date = document.getElementById('edit-exp-date').value.trim() || e.date;
 dbSetDoc(expensesCol, id, e);
 closeModal();
 updateSalaries();
 updateFinancial();
 updateReports();
 showNotification('تم تعديل المصروف');
 }

 // ==================== GROUPS & COACHES ====================
 // Coaches are simply the employees whose role mentions "مدرب".
 function getCoaches() {
 return (data.employees || []).filter(e => e.role && e.role.indexOf('مدرب') !== -1);
 }

 // Jump to the renewal form with the trainee's code pre-filled.
 function goRenew(code) {
 closeModal();
 showSection('financial');
 const input = document.getElementById('renew-code');
 if (input) {
 input.value = code;
 searchTraineeForRenewal();
 input.scrollIntoView({ behavior: 'smooth', block: 'center' });
 }
 }

 function renderGroups() {
 populateGroupTrainerSelect();
 renderStudentAlerts();

 const wrap = document.getElementById('groups-list');
 const groups = data.groups || [];
 if (groups.length === 0) {
 wrap.innerHTML = '<p style="color:rgba(48,56,65,0.4); padding:20px; text-align:center;">لا توجد جروبات بعد — أنشئ أول جروب من الأعلى</p>';
 return;
 }
 wrap.innerHTML = groups.map(g => {
 const count = (g.memberIds || []).length;
 return `
 <div class="group-card">
 <div class="group-card-head">
 <div class="group-card-name">${esc(g.name)}</div>
 <span class="badge" style="background: rgba(48,56,65,0.05); border: 1px solid rgba(48,56,65,0.2);">${esc(g.branch || 'غير محدد')}</span>
 </div>
 <div class="group-card-meta">المدرب: <strong>${esc(g.trainer || 'غير محدد')}</strong> • ${count} لاعب</div>
 <div style="display:flex; gap:8px; margin-top:14px;">
 <button class="btn btn-primary btn-sm" onclick="openGroup('${esc(g._docId)}')">إدارة وتحضير</button>
 <button class="btn btn-danger btn-sm" onclick="deleteGroup('${esc(g._docId)}')">حذف</button>
 </div>
 </div>`;
 }).join('');
 }

 // All student-related alerts in one place: expired subscriptions, ones about
 // to expire, and players who stopped coming. One row per student, with the
 // relevant badges plus quick renew/view actions.
 function renderStudentAlerts() {
 const box = document.getElementById('student-alerts');
 if (!box) return;

 const byTrainee = new Map();
 const add = (t, label, cls, renewable) => {
 if (!byTrainee.has(t.id)) byTrainee.set(t.id, { t, badges: [], renew: false });
 const entry = byTrainee.get(t.id);
 entry.badges.push({ label, cls });
 if (renewable) entry.renew = true;
 };

 data.trainees.forEach(t => {
 if (t.type !== 'subscription') return;
 const info = subInfo(t);
 if (info.expired) add(t, 'منتهي الاشتراك', 'badge-danger', true);
 else if (info.near) add(t, `قارب على الانتهاء (${info.label})`, 'badge-warning', true);
 });
 getAbsentees().forEach(({ t, info }) => add(t, `غائب منذ ${info.days} يوم`, 'badge-danger', false));

 const items = [...byTrainee.values()];
 if (items.length === 0) {
 box.innerHTML = '<p style="color:rgba(48,56,65,0.4); padding:12px;">لا توجد تنبيهات حالياً ✅</p>';
 return;
 }

 box.innerHTML = items.map(({ t, badges, renew }) => {
 const idx = data.trainees.indexOf(t);
 const badgeHtml = badges.map(b => `<span class="badge ${b.cls}">${esc(b.label)}</span>`).join(' ');
 const renewBtn = renew ? `<button class="btn btn-warning btn-sm" onclick="goRenew('${esc(t.id)}')">تجديد</button>` : '';
 return `
 <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:10px 14px; background:rgba(48,56,65,0.03); border-radius:10px; flex-wrap:wrap;">
 <div>
 <strong>${esc(t.name)}</strong>
 <span style="font-size:12px; color:rgba(48,56,65,0.5);">${esc(t.id)}</span>
 </div>
 <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
 ${badgeHtml}
 ${renewBtn}
 <button class="btn btn-outline btn-sm" onclick="viewTrainee(${idx})">عرض</button>
 </div>
 </div>`;
 }).join('');
 }

 function populateGroupTrainerSelect() {
 const sel = document.getElementById('group-trainer');
 if (!sel) return;
 const coaches = getCoaches();
 sel.innerHTML = coaches.length
 ? coaches.map(c => `<option value="${esc(c.name)}">${esc(c.name)} (${esc(c.role)})</option>`).join('')
 : '<option value="">— أضف مدربين من قسم الشؤون المالية أولاً —</option>';
 }

 function createGroup() {
 const name = document.getElementById('group-name').value.trim();
 const trainer = document.getElementById('group-trainer').value;
 const branch = document.getElementById('group-branch').value;
 if (!name) { showNotification('يرجى إدخال اسم الجروب', 'warning'); return; }
 if (!branch) { showNotification('يرجى اختيار الفرع', 'warning'); return; }

 const docId = genDocId('GRP');
 const group = {
 _docId: docId,
 id: docId,
 name,
 trainer: trainer || 'غير محدد',
 branch,
 memberIds: [],
 createdDate: new Date().toLocaleDateString('ar-EG')
 };
 data.groups.push(group);
 dbSetDoc(groupsCol, docId, group);

 document.getElementById('group-name').value = '';
 renderGroups();
 showNotification(`تم إنشاء جروب "${name}"`);
 }

 function deleteGroup(groupId) {
 const g = (data.groups || []).find(x => x._docId === groupId);
 if (!g) return;
 if (!confirm(`حذف جروب "${g.name}"؟\n(اللاعبون أنفسهم لن يُحذفوا، فقط الجروب)`)) return;
 data.groups = data.groups.filter(x => x._docId !== groupId);
 dbDeleteDoc(groupsCol, groupId);
 renderGroups();
 showNotification('تم حذف الجروب', 'danger');
 }

 // Modal to manage a group's members and take group attendance.
 function openGroup(groupId) {
 const g = (data.groups || []).find(x => x._docId === groupId);
 if (!g) return;
 g.memberIds = g.memberIds || [];

 const members = g.memberIds.map(id => data.trainees.find(t => t.id === id)).filter(Boolean);
 const nonMembers = data.trainees.filter(t => !g.memberIds.includes(t.id));
 const addOptions = nonMembers.length
 ? '<option value="">اختر لاعباً لإضافته...</option>' + nonMembers.map(t => `<option value="${esc(t.id)}">${esc(t.id)} — ${esc(t.name)}</option>`).join('')
 : '<option value="">لا يوجد لاعبون متاحون للإضافة</option>';

 const rows = members.length ? members.map(t => {
 const info = subInfo(t);
 const badge = info.expired
 ? '<span class="badge badge-danger">منتهي</span>'
 : info.near
 ? `<span class="badge badge-warning">${esc(info.label)}</span>`
 : `<span class="badge badge-success">${esc(info.label)}</span>`;
 const renewBtn = (info.expired || info.near)
 ? `<button class="btn btn-warning btn-sm" onclick="goRenew('${esc(t.id)}')">تجديد</button>` : '';
 return `
 <tr>
 <td style="text-align:center;"><input type="checkbox" id="grp-present-${esc(t.id)}" ${info.expired ? 'disabled' : 'checked'} style="width:18px; height:18px;"></td>
 <td><code style="color: var(--gold); font-family: monospace;">${esc(t.id)}</code></td>
 <td>${esc(t.name)}</td>
 <td>${badge}</td>
 <td>${renewBtn}<button class="btn btn-outline btn-sm" onclick="removeMemberFromGroup('${esc(g._docId)}','${esc(t.id)}')">إزالة</button></td>
 </tr>`;
 }).join('') : '<tr><td colspan="5" style="text-align:center; color:rgba(48,56,65,0.4); padding:20px;">لا يوجد لاعبون في الجروب بعد</td></tr>';

 document.getElementById('modal-title-text').textContent = `جروب: ${g.name}`;
 document.getElementById('modal-body').innerHTML = `
 <div style="margin-bottom:14px; color:rgba(48,56,65,0.6);">المدرب: <strong>${esc(g.trainer || 'غير محدد')}</strong> • الفرع: ${esc(g.branch || 'غير محدد')}</div>
 <div style="display:flex; gap:8px; margin-bottom:16px;">
 <select id="group-add-select" style="flex:1; padding:9px 12px; border-radius:8px; border:1px solid var(--secondary);">${addOptions}</select>
 <button class="btn btn-primary btn-sm" onclick="addMemberToGroup('${esc(g._docId)}')">إضافة لاعب</button>
 </div>
 <div class="table-container">
 <table>
 <thead><tr><th>حاضر</th><th>الكود</th><th>الاسم</th><th>الاشتراك</th><th>إجراءات</th></tr></thead>
 <tbody>${rows}</tbody>
 </table>
 </div>
 <p style="font-size:12px; color:rgba(48,56,65,0.5); margin-top:10px;">أزل علامة "حاضر" عن أي لاعب لتسجيله غائباً. اللاعب منتهي الاشتراك لا يمكن تحضيره.</p>
 <button class="btn btn-success" style="width:100%; margin-top:12px;" onclick="recordGroupAttendance('${esc(g._docId)}')">تسجيل حضور الجروب</button>
 `;
 document.getElementById('modal-overlay').classList.add('show');
 }

 function addMemberToGroup(groupId) {
 const g = (data.groups || []).find(x => x._docId === groupId);
 if (!g) return;
 const code = document.getElementById('group-add-select').value;
 if (!code) return;
 g.memberIds = g.memberIds || [];
 if (!g.memberIds.includes(code)) {
 g.memberIds.push(code);
 dbSetDoc(groupsCol, g._docId, g);
 }
 openGroup(groupId);
 renderGroups();
 }

 function removeMemberFromGroup(groupId, code) {
 const g = (data.groups || []).find(x => x._docId === groupId);
 if (!g) return;
 g.memberIds = (g.memberIds || []).filter(id => id !== code);
 dbSetDoc(groupsCol, g._docId, g);
 openGroup(groupId);
 renderGroups();
 }

 // Records attendance for every "present"-checked member at once. Skips
 // members already checked in today and blocks expired subscriptions.
 function recordGroupAttendance(groupId) {
 const g = (data.groups || []).find(x => x._docId === groupId);
 if (!g) return;
 const today = new Date().toLocaleDateString('ar-EG');
 let present = 0, absent = 0, blocked = 0, dup = 0;

 (g.memberIds || []).forEach(mid => {
 const t = data.trainees.find(x => x.id === mid);
 if (!t) return;
 const cb = document.getElementById(`grp-present-${mid}`);
 const isPresent = cb ? cb.checked : false;
 const info = subInfo(t);

 if (t.type === 'subscription' && info.expired) { blocked++; return; }
 if (!isPresent) { absent++; return; }
 if (data.attendance.some(a => a.id === mid && a.date === today)) { dup++; return; }

 const time = new Date().toLocaleTimeString('ar-EG');
 const entry = { id: mid, name: t.name, date: today, time, status: 'حاضر' };
 data.attendance.push(entry);
 dbAddDoc(attendanceCol, entry);

 if (t.type === 'subscription' && info.kind === 'sessions') {
 t.sessionsRemaining = num(t.sessionsRemaining) - 1;
 if (t.sessionsRemaining <= 0) t.status = 'منتهي';
 dbSetDoc(traineesCol, t.id, t);
 }
 present++;
 });

 updateAttendanceLog();
 updateTraineesTable();
 updateDashboard();
 openGroup(groupId);

 let msg = `تم تحضير الجروب: ${present} حاضر، ${absent} غياب`;
 if (blocked) msg += `، ${blocked} منتهي الاشتراك`;
 if (dup) msg += `، ${dup} مسجّل مسبقاً`;
 showNotification(msg);
 }

 // ==================== COACHES MANAGEMENT ====================
 // Coaches are stored in the employees collection (role contains "مدرب")
 // but get a dedicated screen with flexible pay: a fixed monthly salary or
 // a percentage/commission, plus mid-month advances (سلف). Every payout is
 // recorded as an expense (tagged with staffId) so it flows into the reports.

 function toggleCoachPayType() {
 const type = document.getElementById('coach-pay-type').value;
 document.getElementById('coach-salary-group').style.display = type === 'monthly' ? 'flex' : 'none';
 document.getElementById('coach-rate-group').style.display = type === 'percentage' ? 'flex' : 'none';
 }

 function addCoach() {
 const name = document.getElementById('coach-name').value.trim();
 const phone = document.getElementById('coach-phone').value.trim();
 const specialty = document.getElementById('coach-specialty').value.trim();
 const branch = document.getElementById('coach-branch').value;
 const payType = document.getElementById('coach-pay-type').value;
 const salary = document.getElementById('coach-salary').value;
 const rate = document.getElementById('coach-rate').value;

 if (!name || !branch) { showNotification('يرجى إدخال اسم المدرب والفرع', 'warning'); return; }
 if (payType === 'monthly' && (!salary || parseInt(salary) <= 0)) { showNotification('يرجى إدخال الراتب الشهري', 'warning'); return; }
 if (payType === 'percentage' && (!rate || parseFloat(rate) <= 0)) { showNotification('يرجى إدخال النسبة', 'warning'); return; }

 const coach = {
 id: `CO-${Date.now()}`,
 code: generateStaffCode(),
 name, phone,
 role: 'مدرب',
 specialty,
 branch,
 payType,
 salary: payType === 'monthly' ? parseInt(salary) : 0,
 percentageRate: payType === 'percentage' ? parseFloat(rate) : 0,
 status: 'نشط',
 joinDate: new Date().toLocaleDateString('ar-EG')
 };
 data.employees.push(coach);
 dbSetDoc(employeesCol, coach.id, coach);
 renderCoachesSection();

 document.getElementById('coach-name').value = '';
 document.getElementById('coach-phone').value = '';
 document.getElementById('coach-specialty').value = '';
 document.getElementById('coach-salary').value = '';
 document.getElementById('coach-rate').value = '';
 showNotification(`تم إضافة المدرب ${name}`);
 }

 // Total paid to a staff member within the current calendar month.
 function paidThisMonthForStaff(staffId) {
 const now = new Date();
 const y = now.getFullYear(), m = now.getMonth();
 return data.expenses.reduce((sum, e) => {
 if (e.staffId !== staffId) return sum;
 const ts = parseDate(e.date);
 if (!ts) return sum;
 const d = new Date(ts);
 return (d.getFullYear() === y && d.getMonth() === m) ? sum + num(e.amount) : sum;
 }, 0);
 }

 function renderCoachesSection() {
 const tbody = document.getElementById('coaches-table');
 if (!tbody) return;
 const coaches = getCoaches();
 if (coaches.length === 0) {
 tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: rgba(48,56,65,0.3); padding: 30px;">لا يوجد مدربون مسجلون</td></tr>';
 return;
 }
 tbody.innerHTML = coaches.map(c => {
 const paid = paidThisMonthForStaff(c.id);
 const contract = c.payType === 'percentage'
 ? `<span class="badge badge-info">نسبة ${num(c.percentageRate)}%</span>`
 : `<span class="badge badge-success">شهري ${num(c.salary).toLocaleString()} ج.م</span>`;
 const groupCount = (data.groups || []).filter(g => g.trainer === c.name).length;
 const payBtn = c.payType === 'percentage'
 ? `<button class="btn btn-success btn-sm" onclick="payCoachPercentage('${esc(c.id)}')">صرف نسبة</button>`
 : `<button class="btn btn-success btn-sm" onclick="payCoachMonthly('${esc(c.id)}')">صرف الراتب</button>`;
 return `
 <tr>
 <td><strong>${esc(c.name)}</strong>${c.phone ? `<div style="font-size:11px; color:rgba(48,56,65,0.5);">${esc(c.phone)}</div>` : ''}</td>
 <td>${esc(c.specialty || '-')}</td>
 <td><span class="badge" style="background: rgba(48,56,65,0.05); border: 1px solid rgba(48,56,65,0.2);">${esc(c.branch || 'غير محدد')}</span></td>
 <td>${contract}</td>
 <td style="font-weight:700; color: var(--danger);">${paid.toLocaleString()} ج.م</td>
 <td>${groupCount}</td>
 <td>
 ${payBtn}
 <button class="btn btn-warning btn-sm" onclick="payCoachAdvance('${esc(c.id)}')">سلفة</button>
 <button class="btn btn-outline btn-sm" onclick="editCoach('${esc(c.id)}')">تعديل</button>
 <button class="btn btn-danger btn-sm" onclick="deleteCoach('${esc(c.id)}')">حذف</button>
 </td>
 </tr>`;
 }).join('');
 }

 // Records a coach payout as an expense tagged with the coach's id.
 function recordCoachExpense(coach, type, amount, desc) {
 const prefix = type === 'سلفة' ? 'ADV' : type === 'نسبة' ? 'PCT' : 'SAL';
 const expense = {
 id: `${prefix}-${Date.now()}`,
 type, desc, amount,
 branch: coach.branch,
 date: new Date().toLocaleDateString('ar-EG'),
 staffId: coach.id
 };
 data.expenses.push(expense);
 dbSetDoc(expensesCol, expense.id, expense);
 updateSalaries();
 updateFinancial();
 updateReports();
 renderCoachesSection();
 }

 // All coach payouts open a styled popup (the app modal) instead of the
 // browser's native prompt/confirm dialogs.
 function payCoachMonthly(id) {
 const c = data.employees.find(e => e.id === id);
 if (!c) return;
 const paid = paidThisMonthForStaff(id);
 const remaining = Math.max(0, num(c.salary) - paid);
 document.getElementById('modal-title-text').textContent = `صرف راتب - ${c.name}`;
 document.getElementById('modal-body').innerHTML = `
 <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-bottom:18px;">
 ${attRow('الراتب الشهري', num(c.salary).toLocaleString() + ' ج.م')}
 ${attRow('مصروف هذا الشهر', paid.toLocaleString() + ' ج.م')}
 ${attRow('المتبقي', remaining.toLocaleString() + ' ج.م')}
 </div>
 <div class="form-group">
 <label>المبلغ المراد صرفه (ج.م)</label>
 <input type="number" id="pay-amount-input" value="${remaining}">
 </div>
 <div style="display:flex; gap:10px; margin-top:18px;">
 <button class="btn btn-success" style="flex:1;" onclick="confirmCoachPayment('${esc(id)}','مرتب')">تأكيد الصرف</button>
 <button class="btn btn-outline" style="flex:1;" onclick="closeModal()">إلغاء</button>
 </div>
 `;
 document.getElementById('modal-overlay').classList.add('show');
 }

 function payCoachAdvance(id) {
 const c = data.employees.find(e => e.id === id);
 if (!c) return;
 document.getElementById('modal-title-text').textContent = `صرف سلفة - ${c.name}`;
 document.getElementById('modal-body').innerHTML = `
 <p style="color:rgba(48,56,65,0.6); margin-bottom:16px;">سحب مبلغ في نص الشهر (سلفة) للمدرب <strong>${esc(c.name)}</strong>.</p>
 <div class="form-group">
 <label>مبلغ السلفة (ج.م)</label>
 <input type="number" id="pay-amount-input" placeholder="المبلغ">
 </div>
 <div style="display:flex; gap:10px; margin-top:18px;">
 <button class="btn btn-warning" style="flex:1;" onclick="confirmCoachPayment('${esc(id)}','سلفة')">تأكيد صرف السلفة</button>
 <button class="btn btn-outline" style="flex:1;" onclick="closeModal()">إلغاء</button>
 </div>
 `;
 document.getElementById('modal-overlay').classList.add('show');
 }

 function payCoachPercentage(id) {
 const c = data.employees.find(e => e.id === id);
 if (!c) return;
 const rate = num(c.percentageRate);
 document.getElementById('modal-title-text').textContent = `صرف نسبة - ${c.name}`;
 document.getElementById('modal-body').innerHTML = `
 <p style="color:rgba(48,56,65,0.6); margin-bottom:16px;">النسبة المتفق عليها: <strong>${rate}%</strong></p>
 <div class="form-group">
 <label>إجمالي المبلغ المحصّل (ج.م)</label>
 <input type="number" id="pay-base-input" oninput="updatePercentPreview('${esc(id)}')" placeholder="المبلغ المحصّل">
 </div>
 <div id="percent-preview" style="font-weight:800; color:var(--success); font-size:18px; margin:14px 0;">النسبة المستحقة: 0 ج.م</div>
 <div style="display:flex; gap:10px;">
 <button class="btn btn-success" style="flex:1;" onclick="confirmCoachPayment('${esc(id)}','نسبة')">تأكيد الصرف</button>
 <button class="btn btn-outline" style="flex:1;" onclick="closeModal()">إلغاء</button>
 </div>
 `;
 document.getElementById('modal-overlay').classList.add('show');
 }

 function updatePercentPreview(id) {
 const c = data.employees.find(e => e.id === id);
 if (!c) return;
 const base = num(document.getElementById('pay-base-input').value);
 const amount = Math.round(base * num(c.percentageRate) / 100);
 document.getElementById('percent-preview').textContent = `النسبة المستحقة: ${amount.toLocaleString()} ج.م`;
 }

 // Shared confirm handler for all three coach payout popups.
 function confirmCoachPayment(id, type) {
 const c = data.employees.find(e => e.id === id);
 if (!c) return;
 let amount, desc;
 if (type === 'نسبة') {
 const base = num(document.getElementById('pay-base-input').value);
 if (base <= 0) { showNotification('أدخل مبلغاً صالحاً', 'warning'); return; }
 const rate = num(c.percentageRate);
 amount = Math.round(base * rate / 100);
 desc = `نسبة ${rate}% من ${base.toLocaleString()} - ${c.name}`;
 } else {
 amount = num(document.getElementById('pay-amount-input').value);
 if (amount <= 0) { showNotification('أدخل مبلغاً صالحاً', 'warning'); return; }
 desc = type === 'سلفة' ? `سلفة - ${c.name}` : `راتب ${c.name}`;
 }
 recordCoachExpense(c, type, amount, desc);
 closeModal();
 showNotification(`تم صرف ${amount.toLocaleString()} ج.م لـ ${c.name}`);
 }

 function editCoach(id) {
 const c = data.employees.find(e => e.id === id);
 if (!c) return;
 document.getElementById('modal-title-text').textContent = `تعديل المدرب ${c.name}`;
 document.getElementById('modal-body').innerHTML = `
 <div class="form-grid">
 <div class="form-group"><label>الاسم</label><input type="text" id="edit-coach-name" value="${esc(c.name)}"></div>
 <div class="form-group"><label>الهاتف</label><input type="tel" id="edit-coach-phone" value="${esc(c.phone || '')}"></div>
 <div class="form-group"><label>التخصص</label><input type="text" id="edit-coach-specialty" value="${esc(c.specialty || '')}"></div>
 <div class="form-group"><label>الفرع</label>
 <select id="edit-coach-branch">
 <option value="فرع المريوطيه 1" ${c.branch === 'فرع المريوطيه 1' ? 'selected' : ''}>فرع المريوطيه 1</option>
 <option value="فرع المريوطيه 2" ${c.branch === 'فرع المريوطيه 2' ? 'selected' : ''}>فرع المريوطيه 2</option>
 <option value="فرع الحدايق" ${c.branch === 'فرع الحدايق' ? 'selected' : ''}>فرع الحدايق</option>
 </select>
 </div>
 <div class="form-group"><label>نوع التعاقد</label>
 <select id="edit-coach-pay-type" onchange="toggleEditCoachPayType()">
 <option value="monthly" ${c.payType !== 'percentage' ? 'selected' : ''}>راتب شهري</option>
 <option value="percentage" ${c.payType === 'percentage' ? 'selected' : ''}>نسبة</option>
 </select>
 </div>
 <div class="form-group" id="edit-coach-salary-group" style="display:${c.payType === 'percentage' ? 'none' : 'flex'};"><label>الراتب الشهري</label><input type="number" id="edit-coach-salary" value="${num(c.salary)}"></div>
 <div class="form-group" id="edit-coach-rate-group" style="display:${c.payType === 'percentage' ? 'flex' : 'none'};"><label>النسبة (%)</label><input type="number" id="edit-coach-rate" value="${num(c.percentageRate)}"></div>
 </div>
 <button class="btn btn-primary" style="margin-top:20px; width:100%;" onclick="saveCoachEdit('${esc(c.id)}')">حفظ التعديلات</button>
 `;
 document.getElementById('modal-overlay').classList.add('show');
 }

 function toggleEditCoachPayType() {
 const type = document.getElementById('edit-coach-pay-type').value;
 document.getElementById('edit-coach-salary-group').style.display = type === 'monthly' ? 'flex' : 'none';
 document.getElementById('edit-coach-rate-group').style.display = type === 'percentage' ? 'flex' : 'none';
 }

 function saveCoachEdit(id) {
 const c = data.employees.find(e => e.id === id);
 if (!c) return;
 const oldName = c.name;
 c.name = document.getElementById('edit-coach-name').value.trim() || c.name;
 c.phone = document.getElementById('edit-coach-phone').value.trim();
 c.specialty = document.getElementById('edit-coach-specialty').value.trim();
 c.branch = document.getElementById('edit-coach-branch').value;
 c.payType = document.getElementById('edit-coach-pay-type').value;
 c.salary = c.payType === 'monthly' ? num(document.getElementById('edit-coach-salary').value) : 0;
 c.percentageRate = c.payType === 'percentage' ? num(document.getElementById('edit-coach-rate').value) : 0;
 dbSetDoc(employeesCol, c.id, c);

 // Keep groups in sync if the coach was renamed (groups store the name).
 if (oldName !== c.name) {
 (data.groups || []).forEach(g => {
 if (g.trainer === oldName) { g.trainer = c.name; dbSetDoc(groupsCol, g._docId, g); }
 });
 }

 closeModal();
 renderCoachesSection();
 renderGroups();
 showNotification('تم حفظ بيانات المدرب');
 }

 function deleteCoach(id) {
 const c = data.employees.find(e => e.id === id);
 if (!c) return;
 if (!confirm(`حذف المدرب "${c.name}"؟\n(مصروفاته السابقة ستبقى في التقارير المالية)`)) return;
 data.employees = data.employees.filter(e => e.id !== id);
 dbDeleteDoc(employeesCol, id);
 renderCoachesSection();
 renderGroups();
 showNotification('تم حذف المدرب', 'danger');
 }

 // ==================== SESSIONS ====================
 // Live training sessions, managed per branch (pick a branch first so the
 // lists from different branches never get mixed up).

 function renderSessionsSection() {
 renderSessionsList();
 }

 // Distinct sports across all trainees (for the session sport dropdown).
 function distinctSports() {
 return [...new Set(data.trainees.map(t => (t.sport || t.plan || '').trim()).filter(Boolean))].sort();
 }

 // Fill the create-session dropdowns based on the chosen branch.
 function populateSessionForm(branch) {
 const sportSel = document.getElementById('session-sport');
 if (sportSel) {
 sportSel.innerHTML = '<option value="">— اختر الرياضة —</option>' +
 distinctSports().map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
 }
 const coachSel = document.getElementById('session-coach');
 if (coachSel) coachSel.innerHTML = coachOptionsHTML('');
 const groupSel = document.getElementById('session-group');
 if (groupSel) {
 const groups = (data.groups || []).filter(g => g.branch === branch);
 groupSel.innerHTML = '<option value="">— بدون جروب —</option>' +
 groups.map(g => `<option value="${esc(g._docId)}">${esc(g.name)} (${esc(g.trainer || 'غير محدد')})</option>`).join('');
 }
 }

 // Picking a group auto-fills its coach (and sport if the group's players share one).
 function onSessionGroupChange() {
 const gid = document.getElementById('session-group').value;
 if (!gid) return;
 const g = (data.groups || []).find(x => x._docId === gid);
 if (!g) return;
 const coachSel = document.getElementById('session-coach');
 if (coachSel && g.trainer) coachSel.value = g.trainer;
 // If all the group's members share one sport, pre-select it.
 const members = (g.memberIds || []).map(id => data.trainees.find(t => t.id === id)).filter(Boolean);
 const sports = [...new Set(members.map(t => (t.sport || t.plan || '').trim()).filter(Boolean))];
 const sportSel = document.getElementById('session-sport');
 if (sportSel && sports.length === 1) sportSel.value = sports[0];
 }

 function renderSessionsList() {
 const branch = document.getElementById('session-branch-filter').value;
 const createCard = document.getElementById('session-create-card');
 const listCard = document.getElementById('session-list-card');
 if (!branch) {
 createCard.style.display = 'none';
 listCard.style.display = 'none';
 return;
 }
 createCard.style.display = 'block';
 listCard.style.display = 'block';
 populateSessionForm(branch);

 const list = document.getElementById('sessions-list');
 // Sort by manual order (set when reordering / "sort by time"); fall back to time.
 const sessions = (data.sessions || [])
 .filter(s => s.branch === branch)
 .sort((a, b) => (num(a.order) - num(b.order)) || String(a.time || '').localeCompare(String(b.time || '')));

 if (sessions.length === 0) {
 list.innerHTML = '<p style="color:rgba(48,56,65,0.4); padding:20px; text-align:center;">لا توجد جلسات في هذا الفرع — ابدأ جلسة من الأعلى</p>';
 return;
 }
 list.innerHTML = sessions.map((s, i) => {
 const count = (s.attendees || []).length;
 const active = s.status === 'active';
 const statusBadge = active ? '<span class="badge badge-success">نشطة الآن</span>' : '<span class="badge badge-test">منتهية</span>';
 const actions = active
 ? `<button class="btn btn-success btn-sm" onclick="openSession('${esc(s._docId)}')">تحضير</button>
 <button class="btn btn-warning btn-sm" onclick="endSession('${esc(s._docId)}')">إنهاء</button>`
 : `<button class="btn btn-outline btn-sm" onclick="openSession('${esc(s._docId)}')">عرض</button>`;
 const grp = s.groupName ? ' • جروب: ' + esc(s.groupName) : '';
 return `
 <div class="group-card" style="display:flex; align-items:center; gap:14px;">
 <div style="display:flex; flex-direction:column; gap:4px;">
 <button class="btn btn-outline btn-sm" style="padding:2px 8px;" onclick="moveSession('${esc(s._docId)}',-1)" ${i === 0 ? 'disabled' : ''}>▲</button>
 <button class="btn btn-outline btn-sm" style="padding:2px 8px;" onclick="moveSession('${esc(s._docId)}',1)" ${i === sessions.length - 1 ? 'disabled' : ''}>▼</button>
 </div>
 <div style="flex:1;">
 <div class="group-card-head">
 <div class="group-card-name">${s.time ? `<span style="color:var(--gold);">${esc(s.time)}</span> · ` : ''}${esc(s.name)}</div>
 ${statusBadge}
 </div>
 <div class="group-card-meta">${esc(s.sport || 'بدون رياضة')} • المدرب: <strong>${esc(s.coach || 'غير محدد')}</strong>${grp}</div>
 <div class="group-card-meta">${count} حاضر</div>
 <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
 ${actions}
 <button class="btn btn-danger btn-sm" onclick="deleteSession('${esc(s._docId)}')">حذف</button>
 </div>
 </div>
 </div>`;
 }).join('');
 }

 function createSession() {
 const branch = document.getElementById('session-branch-filter').value;
 if (!branch) { showNotification('اختر الفرع أولاً', 'warning'); return; }
 const sport = document.getElementById('session-sport').value;
 const coach = document.getElementById('session-coach').value;
 const gid = document.getElementById('session-group').value;
 const time = document.getElementById('session-time').value;
 let name = document.getElementById('session-name').value.trim();

 const group = (data.groups || []).find(x => x._docId === gid);
 // Auto-name from sport/group/time if no name was typed.
 if (!name) {
 name = [sport || group && group.name || 'جلسة', time].filter(Boolean).join(' - ') || 'جلسة';
 }

 data.sessions = data.sessions || [];
 const branchOrders = data.sessions.filter(s => s.branch === branch).map(s => num(s.order));
 const nextOrder = (branchOrders.length ? Math.max(...branchOrders) : 0) + 1;

 const docId = genDocId('SES');
 const session = {
 _docId: docId, id: docId, name, branch,
 sport: sport || '',
 coach: coach || 'غير محدد',
 groupId: gid || '',
 groupName: group ? group.name : '',
 time: time || '',
 order: nextOrder,
 date: new Date().toLocaleDateString('ar-EG'),
 status: 'active',
 attendees: []
 };
 data.sessions.push(session);
 dbSetDoc(sessionsCol, docId, session);

 document.getElementById('session-name').value = '';
 document.getElementById('session-time').value = '';
 renderSessionsList();
 showNotification(`تم بدء جلسة "${name}"`);
 }

 // Move a session up (-1) or down (+1) within its branch list by swapping
 // its order value with the adjacent session.
 function moveSession(id, dir) {
 const branch = document.getElementById('session-branch-filter').value;
 const ordered = (data.sessions || [])
 .filter(s => s.branch === branch)
 .sort((a, b) => (num(a.order) - num(b.order)) || String(a.time || '').localeCompare(String(b.time || '')));
 const idx = ordered.findIndex(s => s._docId === id);
 const swapWith = idx + dir;
 if (idx < 0 || swapWith < 0 || swapWith >= ordered.length) return;
 const a = ordered[idx], b = ordered[swapWith];
 const tmp = num(a.order); a.order = num(b.order); b.order = tmp;
 dbSetDoc(sessionsCol, a._docId, a);
 dbSetDoc(sessionsCol, b._docId, b);
 renderSessionsList();
 }

 // Re-number the branch's sessions in chronological order of their times.
 function sortSessionsByTime() {
 const branch = document.getElementById('session-branch-filter').value;
 if (!branch) return;
 const ordered = (data.sessions || [])
 .filter(s => s.branch === branch)
 .sort((a, b) => String(a.time || '~').localeCompare(String(b.time || '~')));
 ordered.forEach((s, i) => { s.order = i + 1; dbSetDoc(sessionsCol, s._docId, s); });
 renderSessionsList();
 showNotification('تم ترتيب الجلسات حسب الموعد');
 }

 function openSession(id) {
 const s = (data.sessions || []).find(x => x._docId === id);
 if (!s) return;
 s.attendees = s.attendees || [];

 const branchTrainees = data.trainees.filter(t => (t.branch || 'غير محدد') === s.branch);
 const nonAttendees = branchTrainees.filter(t => !s.attendees.includes(t.id));
 const addOptions = (s.status === 'active' && nonAttendees.length)
 ? '<option value="">اختر لاعباً لتحضيره...</option>' + nonAttendees.map(t => `<option value="${esc(t.id)}">${esc(t.id)} — ${esc(t.name)}</option>`).join('')
 : '<option value="">لا يوجد لاعبون متاحون</option>';

 const attendees = s.attendees.map(code => data.trainees.find(t => t.id === code)).filter(Boolean);
 const rows = attendees.length ? attendees.map(t => `
 <tr>
 <td><code style="color: var(--gold); font-family: monospace;">${esc(t.id)}</code></td>
 <td>${esc(t.name)}</td>
 <td>${s.status === 'active' ? `<button class="btn btn-outline btn-sm" onclick="removeSessionAttendee('${esc(s._docId)}','${esc(t.id)}')">إزالة</button>` : '—'}</td>
 </tr>`).join('') : '<tr><td colspan="3" style="text-align:center; color:rgba(48,56,65,0.4); padding:20px;">لا يوجد حاضرون بعد</td></tr>';

 const addRow = s.status === 'active' ? `
 <div style="display:flex; gap:8px; margin-bottom:16px;">
 <select id="session-add-select" style="flex:1; padding:9px 12px; border-radius:8px; border:1px solid var(--secondary);">${addOptions}</select>
 <button class="btn btn-success btn-sm" onclick="addSessionAttendee('${esc(s._docId)}')">تحضير اللاعب</button>
 </div>` : '';

 document.getElementById('modal-title-text').textContent = `جلسة: ${s.name}`;
 document.getElementById('modal-body').innerHTML = `
 <div style="margin-bottom:14px; color:rgba(48,56,65,0.6);">الفرع: <strong>${esc(s.branch)}</strong> • المدرب: <strong>${esc(s.coach || 'غير محدد')}</strong>${s.sport ? ' • ' + esc(s.sport) : ''}${s.time ? ' • الموعد: ' + esc(s.time) : ''}${s.groupName ? ' • جروب: ' + esc(s.groupName) : ''}</div>
 ${addRow}
 <div class="table-container"><table>
 <thead><tr><th>الكود</th><th>الاسم</th><th>إجراء</th></tr></thead>
 <tbody>${rows}</tbody>
 </table></div>
 `;
 document.getElementById('modal-overlay').classList.add('show');
 }

 // Adds a player to the session and records their attendance (blocking
 // expired subscriptions and consuming a session for session-based plans).
 function addSessionAttendee(id) {
 const s = (data.sessions || []).find(x => x._docId === id);
 if (!s || s.status !== 'active') return;
 const code = document.getElementById('session-add-select').value;
 if (!code) return;
 const t = data.trainees.find(x => x.id === code);
 if (!t) return;

 const info = subInfo(t);
 if (t.type === 'subscription' && info.expired) {
 showNotification(`${t.name}: الاشتراك منتهي — ممنوع الدخول`, 'danger');
 return;
 }

 const today = new Date().toLocaleDateString('ar-EG');
 if (!data.attendance.some(a => a.id === code && a.date === today)) {
 const time = new Date().toLocaleTimeString('ar-EG');
 const entry = { id: code, name: t.name, date: today, time, status: 'حاضر' };
 data.attendance.push(entry);
 dbAddDoc(attendanceCol, entry);
 if (t.type === 'subscription' && info.kind === 'sessions') {
 t.sessionsRemaining = num(t.sessionsRemaining) - 1;
 if (t.sessionsRemaining <= 0) t.status = 'منتهي';
 dbSetDoc(traineesCol, t.id, t);
 }
 }

 s.attendees = s.attendees || [];
 if (!s.attendees.includes(code)) s.attendees.push(code);
 dbSetDoc(sessionsCol, s._docId, s);

 openSession(id);
 renderSessionsList();
 updateAttendanceLog();
 updateDashboard();
 showNotification(`تم تحضير ${t.name}`);
 }

 function removeSessionAttendee(id, code) {
 const s = (data.sessions || []).find(x => x._docId === id);
 if (!s) return;
 s.attendees = (s.attendees || []).filter(a => a !== code);
 dbSetDoc(sessionsCol, s._docId, s);
 openSession(id);
 renderSessionsList();
 }

 function endSession(id) {
 const s = (data.sessions || []).find(x => x._docId === id);
 if (!s) return;
 if (!confirm(`إنهاء جلسة "${s.name}"؟`)) return;
 s.status = 'ended';
 s.endTime = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
 dbSetDoc(sessionsCol, s._docId, s);
 renderSessionsList();
 showNotification('تم إنهاء الجلسة');
 }

 function deleteSession(id) {
 const s = (data.sessions || []).find(x => x._docId === id);
 if (!s) return;
 if (!confirm(`حذف جلسة "${s.name}"؟\n(سجلات الحضور تبقى محفوظة)`)) return;
 data.sessions = data.sessions.filter(x => x._docId !== id);
 dbDeleteDoc(sessionsCol, id);
 renderSessionsList();
 showNotification('تم حذف الجلسة', 'danger');
 }

 // ==================== STAFF ATTENDANCE ====================
 // Staff = all employees (which includes coaches). Each one gets a code (ID)
 // used to clock in/out; a daily per-branch PDF can be printed.

 function generateStaffCode() {
 const used = new Set((data.employees || []).map(e => (e.code || '').toLowerCase()));
 for (let i = 0; i < 300; i++) {
 const c = `Staff-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
 if (!used.has(c.toLowerCase())) return c;
 }
 return `Staff-${Date.now().toString().slice(-6)}`;
 }

 // Backfill codes for staff created before this feature. Writing to the
 // employees collection is admin-only (per the security rules), so this only
 // runs for admins.
 function ensureStaffCodes() {
 if (currentRole !== 'admin') return;
 (data.employees || []).forEach(e => {
 if (!e.code) { e.code = generateStaffCode(); dbSetDoc(employeesCol, e.id, e); }
 });
 }

 function findStaffByCode(code) {
 const c = (code || '').trim().toLowerCase();
 if (!c) return null;
 return (data.employees || []).find(e => (e.code || '').toLowerCase() === c || (e.id || '').toLowerCase() === c);
 }

 function staffTodayKey() {
 const d = new Date();
 return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
 }

 function staffRecordFor(empId, dayKey) {
 return (data.staffAttendance || []).find(r => r.empId === empId && dateKey(r.date) === dayKey);
 }

 function renderStaffAttendance() {
 ensureStaffCodes();
 const dateInput = document.getElementById('staff-report-date');
 if (dateInput && !dateInput.value) dateInput.valueAsDate = new Date();

 const tbody = document.getElementById('staff-attendance-table');
 const staff = data.employees || [];
 if (staff.length === 0) {
 tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color: rgba(48,56,65,0.3); padding: 30px;">لا يوجد موظفون — أضفهم من قسمي الموظفين والمدربين</td></tr>';
 return;
 }
 const tk = staffTodayKey();
 tbody.innerHTML = staff.map(e => {
 const rec = staffRecordFor(e.id, tk);
 const checkIn = (rec && rec.checkIn) ? rec.checkIn : '—';
 const checkOut = (rec && rec.checkOut) ? rec.checkOut : '—';
 const inBtn = (!rec || !rec.checkIn) ? `<button class="btn btn-success btn-sm" onclick="checkInStaff('${esc(e.id)}')">حضور</button>` : '';
 const outBtn = (rec && rec.checkIn && !rec.checkOut) ? `<button class="btn btn-warning btn-sm" onclick="checkOutStaff('${esc(e.id)}')">انصراف</button>` : '';
 const done = (rec && rec.checkIn && rec.checkOut) ? '<span class="badge badge-test">مكتمل</span>' : '';
 return `
 <tr>
 <td><code style="color:var(--gold); font-family:monospace;">${esc(e.code || '—')}</code></td>
 <td><strong>${esc(e.name)}</strong></td>
 <td>${esc(e.role || '-')}</td>
 <td><span class="badge" style="background:rgba(48,56,65,0.05); border:1px solid rgba(48,56,65,0.2);">${esc(e.branch || 'غير محدد')}</span></td>
 <td style="color:var(--success); font-weight:700;">${esc(checkIn)}</td>
 <td style="color:var(--warning); font-weight:700;">${esc(checkOut)}</td>
 <td>${inBtn}${outBtn}${done}</td>
 </tr>`;
 }).join('');
 }

 function checkInStaff(empId) {
 const e = (data.employees || []).find(x => x.id === empId);
 if (!e) return;
 const tk = staffTodayKey();
 if (staffRecordFor(empId, tk)) { showNotification(`${e.name}: مسجّل حضور بالفعل اليوم`, 'warning'); return; }
 const time = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
 const docId = genDocId('SATT');
 const rec = {
 _docId: docId, empId, code: e.code || '', name: e.name, role: e.role || '',
 branch: e.branch || 'غير محدد', date: new Date().toLocaleDateString('ar-EG'),
 checkIn: time, checkOut: ''
 };
 data.staffAttendance = data.staffAttendance || [];
 data.staffAttendance.push(rec);
 dbSetDoc(staffAttendanceCol, docId, rec);
 renderStaffAttendance();
 showNotification(`تم تسجيل حضور ${e.name} - ${time}`);
 }

 function checkOutStaff(empId) {
 const e = (data.employees || []).find(x => x.id === empId);
 if (!e) return;
 const rec = staffRecordFor(empId, staffTodayKey());
 if (!rec || !rec.checkIn) { showNotification('سجّل الحضور أولاً', 'warning'); return; }
 if (rec.checkOut) { showNotification(`${e.name}: مسجّل انصراف بالفعل`, 'warning'); return; }
 rec.checkOut = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
 dbSetDoc(staffAttendanceCol, rec._docId, rec);
 renderStaffAttendance();
 showNotification(`تم تسجيل انصراف ${e.name} - ${rec.checkOut}`);
 }

 let staffCodeTimer = null;
 function onStaffCodeInput() {
 clearTimeout(staffCodeTimer);
 staffCodeTimer = setTimeout(() => {
 const cur = document.getElementById('staff-code').value.trim();
 if (cur && findStaffByCode(cur)) recordStaffByCode();
 }, 200);
 }

 // First scan/entry of the day = check-in, second = check-out.
 function recordStaffByCode() {
 const raw = document.getElementById('staff-code').value.trim();
 if (!raw) { showNotification('أدخل كود الموظف', 'warning'); return; }
 const e = findStaffByCode(raw);
 if (!e) { showNotification(`الكود "${raw}" غير موجود`, 'danger'); return; }
 const rec = staffRecordFor(e.id, staffTodayKey());
 if (!rec || !rec.checkIn) checkInStaff(e.id);
 else if (!rec.checkOut) checkOutStaff(e.id);
 else showNotification(`${e.name}: مكتمل اليوم (حضور وانصراف)`, 'warning');
 document.getElementById('staff-code').value = '';
 }

 // Daily PDF: one page per branch, listing each staff member's check-in/out.
 function printStaffAttendance() {
 const dateVal = document.getElementById('staff-report-date').value || staffTodayKey();
 const dayRecords = (data.staffAttendance || []).filter(r => dateKey(r.date) === dateVal);

 const body = BRANCHES.map((b, i) => {
 const recs = dayRecords.filter(r => (r.branch || 'غير محدد') === b);
 const rows = recs.length
 ? recs.map((r, idx) => `<tr><td>${idx + 1}</td><td>${esc(r.code || '-')}</td><td>${esc(r.name)}</td><td>${esc(r.role || '-')}</td><td>${esc(r.checkIn || '-')}</td><td>${esc(r.checkOut || '-')}</td></tr>`).join('')
 : '<tr><td colspan="6" style="text-align:center; color:#9aa1ab;">لا يوجد حضور مسجّل</td></tr>';
 return `
 <div style="${i > 0 ? 'page-break-before: always;' : ''}">
 <div style="font-size:22px; font-weight:800; color:#B8901F; border-bottom:3px solid #B8901F; padding-bottom:10px; margin:0 0 12px;">حضور الموظفين — ${esc(b)}</div>
 <div style="font-size:12px; color:#6b7280; margin-bottom:14px;">التاريخ: ${esc(dateVal)} • عدد الحاضرين: ${recs.length}</div>
 <table>
 <thead><tr><th>#</th><th>الكود</th><th>الاسم</th><th>الوظيفة</th><th>الحضور</th><th>الانصراف</th></tr></thead>
 <tbody>${rows}</tbody>
 </table>
 </div>`;
 }).join('');
 reportDoc('تقرير حضور الموظفين - ' + dateVal, body);
 }

 // ==================== DASHBOARD ====================
 function updateDashboard() {
 const total = data.trainees.length;
 const active = data.trainees.filter(t => t.status === 'نشط').length;
 const totalSubs = data.trainees.filter(t => t.type === 'subscription').length;
 const revenue = data.payments.reduce((sum, p) => sum + num(p.amount), 0);

 document.getElementById('dash-total').textContent = total;
 document.getElementById('dash-active').textContent = active;
 document.getElementById('dash-subs').textContent = totalSubs;
 document.getElementById('dash-revenue').textContent = revenue.toLocaleString();

 // Expiry alerts
 const expiring = data.trainees.filter(t => {
 if (t.type !== 'subscription' || t.status !== 'نشط') return false;
 const left = daysLeft(t);
 return left !== null && left <= 5;
 }).sort((a, b) => daysLeft(a) - daysLeft(b));

 const alertsCard = document.getElementById('alerts-card');
 const alertsBox = document.getElementById('expiry-alerts');
 if (expiring.length === 0) {
 alertsCard.style.display = 'none';
 } else {
 alertsCard.style.display = 'block';
 alertsBox.innerHTML = expiring.map(t => {
 const left = daysLeft(t);
 const msg = left < 0 ? 'منتهي الاشتراك' : (left === 0 ? 'ينتهي اليوم' : `باقي ${left} يوم على الانتهاء`);
 const cls = left < 0 ? 'badge-danger' : 'badge-warning';
 return `
 <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 15px; background: rgba(48,56,65,0.04); border-radius:10px;">
 <div>
 <strong>${esc(t.name)}</strong>
 <span style="font-size:12px; color: rgba(48,56,65,0.5); margin-right:8px;">${esc(t.id)}</span>
 </div>
 <span class="badge ${cls}">${msg}</span>
 </div>`;
 }).join('');
 }

 // Absence alerts: active subscribers who stopped showing up
 const absentees = getAbsentees();
 const absCard = document.getElementById('absentees-card');
 const absBox = document.getElementById('absentees-list');
 if (absentees.length === 0) {
 absCard.style.display = 'none';
 } else {
 absCard.style.display = 'block';
 absBox.innerHTML = absentees.map(({ t, info }) => {
 const lastTxt = info.neverAttended
 ? 'لم يسجّل حضوراً منذ التسجيل'
 : `آخر حضور: ${esc(info.lastDate)}`;
 const phone = t.phone ? ` • ${esc(t.phone)}` : '';
 return `
 <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 15px; background: rgba(181,69,60,0.05); border-radius:10px; flex-wrap:wrap; gap:10px;">
 <div>
 <strong>${esc(t.name)}</strong>
 <span style="font-size:12px; color: rgba(48,56,65,0.5); margin-right:8px;">${esc(t.id)}</span>
 <div style="font-size:12px; color: rgba(48,56,65,0.5);">${lastTxt}${phone}</div>
 </div>
 <div style="display:flex; align-items:center; gap:8px;">
 <span class="badge badge-danger">غائب منذ ${info.days} يوم</span>
 <button class="btn btn-outline btn-sm" onclick="viewTrainee(${data.trainees.indexOf(t)})">عرض</button>
 </div>
 </div>`;
 }).join('');
 }

 // Recent registrations
 const recent = data.trainees.slice(-5).reverse();
 const tbody = document.getElementById('recent-registrations');

 if (recent.length === 0) {
 tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: rgba(48,56,65,0.3); padding: 30px;">لا توجد تسجيلات بعد</td></tr>';
 } else {
 tbody.innerHTML = recent.map(t => `
 <tr>
 <td><code style="color: var(--gold); font-family: monospace; font-size: 12px;">${esc(t.id)}</code></td>
 <td>${esc(t.name)}</td>
 <td><span class="badge ${t.type === 'subscription' ? 'badge-success' : 'badge-test'}">${t.type === 'subscription' ? 'اشتراك' : 'تجريبي'}</span></td>
 <td><span class="badge badge-success">${esc(t.status)}</span></td>
 <td>${expiryCell(t)}</td>
 </tr>
 `).join('');
 }

 // Always refresh branch financials — expenses/salaries can exist with zero trainees.
 filterBranchDashboard();
 }

 function filterBranchDashboard() {
 const filterSelect = document.getElementById('dashboard-branch-filter');
 if (!filterSelect) return;
 const branch = filterSelect.value;
 
 let incomePayments = data.payments;
 let expenses = data.expenses;
 
 if (branch !== 'الكل') {
 incomePayments = data.payments.filter(p => p.branch === branch);
 expenses = data.expenses.filter(e => e.branch === branch);
 }
 
 const totalIncome = incomePayments.reduce((sum, p) => sum + num(p.amount), 0);
 const totalExpenses = expenses.reduce((sum, e) => sum + num(e.amount), 0);
 const profit = totalIncome - totalExpenses;
 
 const incEl = document.getElementById('branch-fin-income');
 const expEl = document.getElementById('branch-fin-expenses');
 const profEl = document.getElementById('branch-fin-profit');
 
 if(incEl) incEl.textContent = `${totalIncome.toLocaleString()} ج.م`;
 if(expEl) expEl.textContent = `${totalExpenses.toLocaleString()} ج.م`;
 if(profEl) profEl.textContent = `${profit.toLocaleString()} ج.م`;
 
 const tbody = document.getElementById('branch-transactions-table');
 if (!tbody) return;

 const transactions = [
 ...incomePayments.map(p => ({ type: 'إيراد', desc: p.type + ' (' + p.plan + ')', branch: p.branch, amount: p.amount, date: p.date, rawDate: parseDate(p.date) })),
 ...expenses.map(e => ({ type: 'مصروف', desc: e.type + ' (' + (e.desc || '') + ')', branch: e.branch, amount: e.amount, date: e.date, rawDate: parseDate(e.date) }))
 ].sort((a, b) => b.rawDate - a.rawDate);
 
 if (transactions.length === 0) {
 tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: rgba(48,56,65,0.3); padding: 20px;">لا توجد معاملات مالية مسجلة</td></tr>';
 return;
 }
 
 tbody.innerHTML = transactions.map(t => `
 <tr>
 <td><span class="badge ${t.type === 'إيراد' ? 'badge-success' : 'badge-danger'}">${esc(t.type)}</span></td>
 <td>${esc(t.desc)}</td>
 <td><span class="badge" style="background: rgba(48,56,65,0.05); border: 1px solid rgba(48,56,65,0.2);">${esc(t.branch || 'غير محدد')}</span></td>
 <td style="font-weight: 700; color: ${t.type === 'إيراد' ? 'var(--success)' : 'var(--danger)'};">${num(t.amount).toLocaleString()} ج.م</td>
 <td>${esc(t.date)}</td>
 </tr>
 `).join('');
 }

 // Normalize Arabic/Persian-Indic digits to ASCII and strip the hidden
 // bidirectional control marks that toLocaleDateString('ar-EG') injects.
 // Without this, dates stored as "٢٢‏/٦‏/٢٠٢٦" break every numeric parse.
 function normalizeDigits(str) {
 if (str == null) return '';
 const map = {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
 '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9'};
 return String(str)
 .replace(/[٠-٩۰-۹]/g, d => map[d] || d)
 .replace(/[‎‏؜‪-‮⁦-⁩]/g, '')
 .trim();
 }

 // Coerce any stored amount (number or legacy string) to a safe number.
 function num(v) {
 const n = parseFloat(normalizeDigits(v));
 return isNaN(n) ? 0 : n;
 }

 // Staff-cost expense types: monthly salary, mid-month advance, and
 // percentage/commission payouts. All count as "salaries" in the reports.
 const SALARY_TYPES = ['مرتب', 'سلفة', 'نسبة'];
 function isSalaryType(type) {
 return SALARY_TYPES.indexOf(type) !== -1;
 }

 // The branches, used by the per-branch report pages.
 const BRANCHES = ['فرع المريوطيه 1', 'فرع المريوطيه 2', 'فرع الحدايق'];

 // The sports offered, and the levels that only apply to "جمباز فني".
 const SPORTS = ['جمباز فني', 'جمباز ايروبك', 'كاراتيه', 'كونغ فو ساندا', 'كيك بوكس', 'تيكوندو', 'كونغ فو اساليب', 'ملاكمه', 'موياي تاي', 'كالستانكس'];
 const GYM_LEVELS = ['قطاع مدارس', 'قطاع تجهيزي', 'قطاع فريق'];
 const PAYMENT_METHODS = ['نقداً', 'تحويل بنكي', 'فودافون كاش', 'انستا باي'];

 function sportOptionsHTML(selected) {
 return '<option value="">— اختر الرياضة —</option>' +
 SPORTS.map(s => `<option value="${esc(s)}" ${s === selected ? 'selected' : ''}>${esc(s)}</option>`).join('');
 }
 function levelOptionsHTML(selected) {
 return GYM_LEVELS.map(l => `<option value="${esc(l)}" ${l === selected ? 'selected' : ''}>${esc(l)}</option>`).join('');
 }
 function methodOptionsHTML(selected) {
 return PAYMENT_METHODS.map(m => `<option value="${esc(m)}" ${m === selected ? 'selected' : ''}>${esc(m)}</option>`).join('');
 }
 // Sport label including the gymnastics level when present.
 function sportLabel(t) {
 const s = t.sport || t.plan || '-';
 return t.level ? `${s} (${t.level})` : s;
 }

 // Normalize any stored date (Arabic or ISO) to a "YYYY-MM-DD" key, so a
 // single calendar day can be matched reliably regardless of stored format.
 function dateKey(dateStr) {
 const ts = parseDate(dateStr);
 if (!ts) return '';
 const d = new Date(ts);
 const y = d.getFullYear();
 const m = String(d.getMonth() + 1).padStart(2, '0');
 const day = String(d.getDate()).padStart(2, '0');
 return `${y}-${m}-${day}`;
 }

 // Escape user-supplied text before inserting it into innerHTML, so a name
 // or note containing HTML/quotes can't break the layout or inject script.
 // Safe for both element content and double-quoted attribute values.
 function esc(v) {
 return String(v == null ? '' : v)
 .replace(/&/g, '&amp;')
 .replace(/</g, '&lt;')
 .replace(/>/g, '&gt;')
 .replace(/"/g, '&quot;')
 .replace(/'/g, '&#39;');
 }

 // Robust date parser: handles Arabic-locale "day/month/year" (with Arabic
 // digits + direction marks) AND ISO "YYYY-MM-DD". Always returns a number,
 // never NaN, so sorting and range filters stay correct for mixed formats.
 function parseDate(dateStr) {
 const s = normalizeDigits(dateStr);
 if (!s) return 0;
 const parts = s.split('/');
 if (parts.length === 3) {
 const d = parseInt(parts[0], 10);
 const m = parseInt(parts[1], 10);
 const y = parseInt(parts[2], 10);
 const t = new Date(y, m - 1, d).getTime();
 if (!isNaN(t)) return t;
 }
 const t = new Date(s).getTime();
 return isNaN(t) ? 0 : t;
 }

  // ==================== FINANCIAL DASHBOARD ====================
  // Delegates to the shared robust parser so both dashboards agree.
  function fdParseDate(dateStr) {
  return parseDate(dateStr);
  }

  function fdFilterByDateRange(items, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return items;
  const from = dateFrom ? new Date(dateFrom).setHours(0,0,0,0) : 0;
  const to = dateTo ? new Date(dateTo).setHours(23,59,59,999) : Infinity;
  return items.filter(item => {
  const d = fdParseDate(item.date);
  return d >= from && d <= to;
  });
  }

  function fdGroupBy(arr, key) {
  const map = {};
  arr.forEach(item => {
  const k = item[key] || 'غير محدد';
  if (!map[k]) map[k] = [];
  map[k].push(item);
  });
  return map;
  }

  function fdBreakdownHTML(grouped, valueColor) {
  return Object.entries(grouped).map(([label, items]) => {
  const total = items.reduce((s, i) => s + num(i.amount), 0);
  return `
  <div class="fd-breakdown-item">
  <div class="fd-bd-label">${esc(label)}</div>
  <div class="fd-bd-value" style="color: ${valueColor};">${total.toLocaleString()} ج.م</div>
  <div class="fd-bd-count">${items.length} عملية</div>
  </div>`;
  }).join('');
  }

  function fdEmptyRow(cols) {
  return `<tr><td colspan="${cols}" style="text-align:center; color: rgba(48,56,65,0.3); padding: 25px;">لا توجد بيانات</td></tr>`;
  }

  function renderFinancialDashboard() {
  const branch = document.getElementById('fd-branch-filter').value;
  const dateFrom = document.getElementById('fd-date-from').value;
  const dateTo = document.getElementById('fd-date-to').value;

  // Filter data
  let payments = [...data.payments];
  let expenses = [...data.expenses];

  if (branch !== 'الكل') {
  payments = payments.filter(p => p.branch === branch);
  expenses = expenses.filter(e => e.branch === branch);
  }

  payments = fdFilterByDateRange(payments, dateFrom, dateTo);
  expenses = fdFilterByDateRange(expenses, dateFrom, dateTo);

  // Calculations
  const totalIncome = payments.reduce((s, p) => s + num(p.amount), 0);
  const totalExpenses = expenses.reduce((s, e) => s + num(e.amount), 0);
  const salaryExpenses = expenses.filter(e => isSalaryType(e.type));
  const nonSalaryExpenses = expenses.filter(e => !isSalaryType(e.type));
  const totalSalaries = salaryExpenses.reduce((s, e) => s + num(e.amount), 0);
  const netProfit = totalIncome - totalExpenses;
  const profitMargin = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;

  const newSubs = payments.filter(p => p.type === 'اشتراك جديد');
  const renewals = payments.filter(p => p.type === 'تجديد');
  const newSubsTotal = newSubs.reduce((s, p) => s + num(p.amount), 0);
  const renewalsTotal = renewals.reduce((s, p) => s + num(p.amount), 0);

  // KPI Cards
  document.getElementById('fd-total-income').textContent = `${totalIncome.toLocaleString()} ج.م`;
  document.getElementById('fd-income-count').textContent = `${payments.length} عملية`;
  document.getElementById('fd-total-expenses').textContent = `${totalExpenses.toLocaleString()} ج.م`;
  document.getElementById('fd-expense-count').textContent = `${expenses.length} عملية`;
  document.getElementById('fd-total-salaries').textContent = `${totalSalaries.toLocaleString()} ج.م`;
  document.getElementById('fd-salary-count').textContent = `${salaryExpenses.length} عملية صرف`;
  document.getElementById('fd-net-profit').textContent = `${netProfit.toLocaleString()} ج.م`;
  document.getElementById('fd-profit-margin').textContent = `هامش الربح: ${profitMargin}%`;
  document.getElementById('fd-new-subs').textContent = `${newSubsTotal.toLocaleString()} ج.م`;
  document.getElementById('fd-new-subs-count').textContent = `${newSubs.length} اشتراك`;
  document.getElementById('fd-renewals').textContent = `${renewalsTotal.toLocaleString()} ج.م`;
  document.getElementById('fd-renewals-count').textContent = `${renewals.length} تجديد`;

  // Color the profit card
  const profitEl = document.getElementById('fd-net-profit');
  profitEl.style.color = netProfit >= 0 ? 'var(--success)' : 'var(--danger)';

  // Badges
  document.getElementById('fd-income-badge').textContent = `${totalIncome.toLocaleString()} ج.م`;
  document.getElementById('fd-expense-badge').textContent = `${totalExpenses.toLocaleString()} ج.م`;
  document.getElementById('fd-salary-badge').textContent = `${totalSalaries.toLocaleString()} ج.م`;

  // === Branch Comparison ===
  const compCard = document.getElementById('fd-branch-comparison-card');
  if (branch === 'الكل') {
  compCard.style.display = 'block';
  const branches = ['فرع المريوطيه 1', 'فرع المريوطيه 2', 'فرع الحدايق'];
  let branchData = branches.map(b => {
  let bp = fdFilterByDateRange(data.payments.filter(p => p.branch === b), dateFrom, dateTo);
  let be = fdFilterByDateRange(data.expenses.filter(e => e.branch === b), dateFrom, dateTo);
  const inc = bp.reduce((s, p) => s + num(p.amount), 0);
  const exp = be.reduce((s, e) => s + num(e.amount), 0);
  return { name: b, income: inc, expenses: exp, profit: inc - exp };
  });
  const maxIncome = Math.max(...branchData.map(b => b.income), 1);

  document.getElementById('fd-branch-comparison-content').innerHTML = `
  <div style="margin-bottom: 8px;">
  <div class="fd-branch-row" style="font-weight: 600; font-size: 12px; color: rgba(48,56,65,0.5); border-bottom: 2px solid rgba(48,56,65,0.1);">
  <div>الفرع</div>
  <div>نسبة الإيرادات</div>
  <div style="text-align:center;">الإيرادات</div>
  <div style="text-align:center;">المصروفات</div>
  <div style="text-align:center;">صافي الربح</div>
  </div>
  ${branchData.map(b => `
  <div class="fd-branch-row">
  <div class="fd-branch-name">${b.name}</div>
  <div class="fd-branch-bar-container">
  <div class="fd-branch-bar profit-bar" style="width: ${Math.round((b.income / maxIncome) * 100)}%;"></div>
  </div>
  <div class="fd-branch-val income-val">${b.income.toLocaleString()} ج.م</div>
  <div class="fd-branch-val expense-val">${b.expenses.toLocaleString()} ج.م</div>
  <div class="fd-branch-val profit-val">${b.profit.toLocaleString()} ج.م</div>
  </div>
  `).join('')}
  </div>`;
  } else {
  compCard.style.display = 'none';
  }

  // === Income Breakdown by Type ===
  const incomeByType = fdGroupBy(payments, 'type');
  document.getElementById('fd-income-breakdown').innerHTML = fdBreakdownHTML(incomeByType, 'var(--success)') || '<div style="color: rgba(48,56,65,0.3); padding: 12px;">لا توجد إيرادات</div>';

  // === Income by Payment Method ===
  const incomeByMethod = fdGroupBy(payments, 'method');
  document.getElementById('fd-income-by-method').innerHTML = fdBreakdownHTML(incomeByMethod, 'var(--gold)') || '<div style="color: rgba(48,56,65,0.3); padding: 12px;">لا توجد بيانات</div>';

  // === Full Income Table ===
  const incTbody = document.getElementById('fd-income-table');
  if (payments.length === 0) {
  incTbody.innerHTML = fdEmptyRow(9);
  } else {
  incTbody.innerHTML = payments.map((p, i) => `
  <tr>
  <td>${i + 1}</td>
  <td><code style="color: var(--gold); font-family: monospace;">${esc(p.id)}</code></td>
  <td>${esc(p.name)}</td>
  <td><span class="badge ${p.type === 'تجديد' ? 'badge-info' : 'badge-success'}">${esc(p.type)}</span></td>
  <td style="font-size: 12px;">${esc(p.plan || '-')}</td>
  <td><span class="badge" style="background: rgba(48,56,65,0.05); border: 1px solid rgba(48,56,65,0.2);">${esc(p.branch || 'غير محدد')}</span></td>
  <td style="color: var(--success); font-weight: 700;">${num(p.amount).toLocaleString()} ج.م</td>
  <td>${esc(p.method || '-')}</td>
  <td>${esc(p.date)}</td>
  </tr>
  `).join('');
  }

  // === Expense Breakdown by Type ===
  const expenseByType = fdGroupBy(nonSalaryExpenses, 'type');
  // Add salary as a category
  if (salaryExpenses.length > 0) {
  expenseByType['مرتبات'] = salaryExpenses;
  }
  document.getElementById('fd-expense-breakdown').innerHTML = fdBreakdownHTML(expenseByType, 'var(--danger)') || '<div style="color: rgba(48,56,65,0.3); padding: 12px;">لا توجد مصروفات</div>';

  // === Full Expenses Table (non-salary) ===
  const expTbody = document.getElementById('fd-expense-table');
  if (nonSalaryExpenses.length === 0) {
  expTbody.innerHTML = fdEmptyRow(7);
  } else {
  expTbody.innerHTML = nonSalaryExpenses.map((e, i) => `
  <tr>
  <td>${i + 1}</td>
  <td><code style="color: var(--warning); font-family: monospace;">${esc(e.id)}</code></td>
  <td><span class="badge badge-warning">${esc(e.type)}</span></td>
  <td>${esc(e.desc || '-')}</td>
  <td><span class="badge" style="background: rgba(48,56,65,0.05); border: 1px solid rgba(48,56,65,0.2);">${esc(e.branch || 'غير محدد')}</span></td>
  <td style="color: var(--danger); font-weight: 700;">${num(e.amount).toLocaleString()} ج.م</td>
  <td>${esc(e.date)}</td>
  </tr>
  `).join('');
  }

  // === Salary Table ===
  const salTbody = document.getElementById('fd-salary-table');
  if (salaryExpenses.length === 0) {
  salTbody.innerHTML = fdEmptyRow(6);
  } else {
  salTbody.innerHTML = salaryExpenses.map((e, i) => `
  <tr>
  <td>${i + 1}</td>
  <td><code style="color: var(--warning); font-family: monospace;">${esc(e.id)}</code></td>
  <td>${esc(e.desc || '-')}</td>
  <td><span class="badge" style="background: rgba(48,56,65,0.05); border: 1px solid rgba(48,56,65,0.2);">${esc(e.branch || 'غير محدد')}</span></td>
  <td style="color: var(--danger); font-weight: 700;">${num(e.amount).toLocaleString()} ج.م</td>
  <td>${esc(e.date)}</td>
  </tr>
  `).join('');
  }

  // === All Transactions (combined ledger) ===
  const allTransactions = [
  ...payments.map(p => ({ kind: 'إيراد', desc: `${p.type} - ${p.name} (${p.plan || ''})`, branch: p.branch, income: p.amount, expense: 0, date: p.date, rawDate: fdParseDate(p.date) })),
  ...expenses.map(e => ({ kind: 'مصروف', desc: `${e.type} - ${e.desc || ''}`, branch: e.branch, income: 0, expense: e.amount, date: e.date, rawDate: fdParseDate(e.date) }))
  ].sort((a, b) => b.rawDate - a.rawDate);

  const allTbody = document.getElementById('fd-all-transactions-table');
  if (allTransactions.length === 0) {
  allTbody.innerHTML = fdEmptyRow(7);
  } else {
  allTbody.innerHTML = allTransactions.map((t, i) => `
  <tr>
  <td>${i + 1}</td>
  <td><span class="badge ${t.kind === 'إيراد' ? 'badge-success' : 'badge-danger'}">${esc(t.kind)}</span></td>
  <td>${esc(t.desc)}</td>
  <td><span class="badge" style="background: rgba(48,56,65,0.05); border: 1px solid rgba(48,56,65,0.2);">${esc(t.branch || 'غير محدد')}</span></td>
  <td style="color: var(--success); font-weight: 700;">${t.income > 0 ? num(t.income).toLocaleString() + ' ج.م' : '-'}</td>
  <td style="color: var(--danger); font-weight: 700;">${t.expense > 0 ? num(t.expense).toLocaleString() + ' ج.م' : '-'}</td>
  <td>${esc(t.date)}</td>
  </tr>
  `).join('');
  }
  }

  function resetFDFilters() {
  document.getElementById('fd-branch-filter').value = 'الكل';
  document.getElementById('fd-date-from').value = '';
  document.getElementById('fd-date-to').value = '';
  renderFinancialDashboard();
  }

  function exportFinancialDashboardReport() {
  const branch = document.getElementById('fd-branch-filter').value;
  const dateFrom = document.getElementById('fd-date-from').value;
  const dateTo = document.getElementById('fd-date-to').value;

  let payments = [...data.payments];
  let expenses = [...data.expenses];
  if (branch !== 'الكل') {
  payments = payments.filter(p => p.branch === branch);
  expenses = expenses.filter(e => e.branch === branch);
  }
  payments = fdFilterByDateRange(payments, dateFrom, dateTo);
  expenses = fdFilterByDateRange(expenses, dateFrom, dateTo);

  const totalIncome = payments.reduce((s, p) => s + num(p.amount), 0);
  const totalExpenses = expenses.reduce((s, e) => s + num(e.amount), 0);
  const totalSalaries = expenses.filter(e => isSalaryType(e.type)).reduce((s, e) => s + num(e.amount), 0);
  const netProfit = totalIncome - totalExpenses;

  const paymentRows = payments.map((p, i) => `
  <tr>
  <td>${i+1}</td><td>${esc(p.id)}</td><td>${esc(p.name)}</td><td>${esc(p.type)}</td>
  <td>${esc(p.plan || '-')}</td><td>${esc(p.branch || 'غير محدد')}</td>
  <td>${num(p.amount).toLocaleString()} ج.م</td><td>${esc(p.method || '-')}</td><td>${esc(p.date)}</td>
  </tr>
  `).join('') || '<tr><td colspan="9" style="text-align:center; color:#9aa1ab;">لا توجد إيرادات</td></tr>';

  const expenseRows = expenses.map((e, i) => `
  <tr>
  <td>${i+1}</td><td>${esc(e.id)}</td><td>${esc(e.type)}</td><td>${esc(e.desc || '-')}</td>
  <td>${esc(e.branch || 'غير محدد')}</td><td>${num(e.amount).toLocaleString()} ج.م</td><td>${esc(e.date)}</td>
  </tr>
  `).join('') || '<tr><td colspan="7" style="text-align:center; color:#9aa1ab;">لا توجد مصروفات</td></tr>';

  const filterInfo = branch !== 'الكل' ? `الفرع: ${branch}` : 'كل الفروع';
  const dateInfo = (dateFrom || dateTo) ? ` | الفترة: ${dateFrom || '...'} إلى ${dateTo || '...'}` : '';

  const body = `
  <div class="section-block">
  <div class="report-title">التقرير المالي التفصيلي</div>
  <div style="font-size:12px; color:#6b7280; margin-bottom:14px;">${filterInfo}${dateInfo}</div>
  <div class="summary-row">
  ${summaryBox('إجمالي الإيرادات', totalIncome.toLocaleString() + ' ج.م')}
  ${summaryBox('إجمالي المصروفات', totalExpenses.toLocaleString() + ' ج.م')}
  ${summaryBox('المرتبات', totalSalaries.toLocaleString() + ' ج.م')}
  ${summaryBox('صافي الربح', netProfit.toLocaleString() + ' ج.م')}
  </div>
  <table>
  <thead><tr><th colspan="9" style="text-align:right; background:#B8901F;">الإيرادات</th></tr>
  <tr><th>#</th><th>الكود</th><th>الاسم</th><th>النوع</th><th>الرياضة</th><th>الفرع</th><th>المبلغ</th><th>طريقة الدفع</th><th>التاريخ</th></tr></thead>
  <tbody>${paymentRows}</tbody>
  </table>
  <table>
  <thead><tr><th colspan="7" style="text-align:right; background:#B8901F;">المصروفات</th></tr>
  <tr><th>#</th><th>الكود</th><th>النوع</th><th>الوصف</th><th>الفرع</th><th>المبلغ</th><th>التاريخ</th></tr></thead>
  <tbody>${expenseRows}</tbody>
  </table>
  </div>
  `;
  reportDoc('التقرير المالي التفصيلي - ' + filterInfo, body);
  }

  function updateBadge() {
  document.getElementById('reg-badge').textContent = data.trainees.length;
 }

 // ==================== REPORTS ====================
 function updateReports() {
 renderFeedback();
 const monthInput = document.getElementById('monthly-month');
 if (monthInput && !monthInput.value) monthInput.value = thisMonthVal();

 const total = data.trainees.length;
 const active = data.trainees.filter(t => t.status === 'نشط').length;
 const tests = data.trainees.filter(t => t.type === 'test').length;
 const totalIncome = data.payments.reduce((sum, p) => sum + num(p.amount), 0);
 const totalExpenses = data.expenses.reduce((sum, e) => sum + num(e.amount), 0);
 const totalSalaries = data.expenses.filter(e => isSalaryType(e.type)).reduce((sum, e) => sum + num(e.amount), 0);
 const totalAttendance = data.attendance.length;

 document.getElementById('members-report').innerHTML = `
 ${reportItem('إجمالي المتدربين', total, 'var(--gold)')}
 ${reportItem('اشتراكات نشطة', active, 'var(--success)')}
 ${reportItem('جلسات تجريبية', tests, 'var(--gold)')}
 ${reportItem('نسبة التحويل', total > 0 ? `${Math.round((active/total)*100)}%` : '0%', 'var(--warning)')}
 `;

 document.getElementById('financial-report').innerHTML = `
 ${reportItem('إجمالي الإيرادات', `${totalIncome.toLocaleString()} ج.م`, 'var(--success)')}
 ${reportItem('المصروفات', `${totalExpenses.toLocaleString()} ج.م`, 'var(--danger)')}
 ${reportItem('مرتبات مصروفة', `${totalSalaries.toLocaleString()} ج.م`, 'var(--warning)')}
 ${reportItem('صافي الربح', `${(totalIncome - totalExpenses).toLocaleString()} ج.م`, 'var(--gold)')}
 `;

 document.getElementById('attendance-report').innerHTML = `
 ${reportItem('إجمالي سجلات الحضور', totalAttendance, 'var(--success)')}
 ${reportItem('أيام التشغيل', [...new Set(data.attendance.map(a => a.date))].length, 'var(--gold)')}
 ${reportItem('متوسط الحضور اليومي', totalAttendance > 0 ? Math.round(totalAttendance / Math.max(1, [...new Set(data.attendance.map(a => a.date))].length)) : 0, 'var(--warning)')}
 `;
 }

 function reportItem(label, value, color = 'var(--accent)') {
 return `
 <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 15px; background: rgba(48,56,65,0.03); border-radius: 8px;">
 <span style="color: rgba(48,56,65,0.6); font-size: 13px;">${label}</span>
 <span style="font-weight: 700; color: ${color};">${value}</span>
 </div>
 `;
 }

 function reportDoc(title, bodyHtml) {
 const win = window.open('', '_blank');
 if (!win) { showNotification('فعّل السماح بالنوافذ المنبثقة لطباعة التقرير', 'warning'); return; }
 win.document.write(`
 <html dir="rtl" lang="ar"><head><title>${title}</title>
 <meta charset="UTF-8">
 <style>
 * { box-sizing: border-box; margin: 0; padding: 0; font-family: Arial, sans-serif; }
 body { background: #ffffff; color: #1B2433; padding: 30px 40px; }
 .report-header {
 display: flex; justify-content: space-between; align-items: flex-end;
 border-bottom: 3px solid #B8901F; padding-bottom: 14px; margin-bottom: 20px;
 }
 .academy-name { font-size: 26px; font-weight: 800; letter-spacing: 1px; color: #1B2433; }
 .report-meta { text-align: left; font-size: 12px; color: #6b7280; }
 .report-title { font-size: 17px; font-weight: 700; color: #B8901F; margin: 18px 0 10px; }
 .summary-row { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 18px; }
 .summary-box {
 flex: 1; min-width: 140px; border: 1px solid #e3e6eb; border-radius: 8px;
 padding: 10px 14px; background: #f7f9fb;
 }
 .summary-label { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
 .summary-value { font-size: 16px; font-weight: 700; color: #1B2433; }
 table { width: 100%; border-collapse: collapse; margin-bottom: 26px; font-size: 12px; }
 th, td { border: 1px solid #e3e6eb; padding: 8px 10px; text-align: right; }
 th { background: #1B2433; color: #ffffff; font-weight: 600; }
 tbody tr:nth-child(even) { background: #f7f9fb; }
 .section-block { page-break-inside: avoid; }
 .report-footer { margin-top: 10px; font-size: 11px; color: #9aa1ab; text-align: center; }
 @media print { .summary-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
 th { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
 </style>
 </head>
 <body>
 <div class="report-header">
 <div class="academy-name">Academy</div>
 <div class="report-meta">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</div>
 </div>
 ${bodyHtml}
 <div class="report-footer">تم إنشاء هذا التقرير تلقائياً من نظام إدارة الأكاديمية</div>
 <script>
 window.onload = function() { setTimeout(function() { window.print(); }, 250); };
 <\/script>
 </body></html>
 `);
 win.document.close();
 }

 function summaryBox(label, value) {
 return `<div class="summary-box"><div class="summary-label">${label}</div><div class="summary-value">${value}</div></div>`;
 }

 function buildMembersReport(branch) {
 const trainees = branch ? data.trainees.filter(t => (t.branch || 'غير محدد') === branch) : data.trainees;
 const total = trainees.length;
 const active = trainees.filter(t => t.status === 'نشط').length;
 const tests = trainees.filter(t => t.type === 'test').length;
 const conv = total > 0 ? `${Math.round((active/total)*100)}%` : '0%';

 const rows = trainees.map(t => `
 <tr>
 <td>${esc(t.id)}</td>
 <td>${esc(t.name)}</td>
 <td>${esc(t.phone)}</td>
 <td>${t.type === 'subscription' ? 'اشتراك' : 'تجريبي'}</td>
 <td>${esc(sportLabel(t))}</td>
 <td>${esc(t.branch || 'غير محدد')}</td>
 <td>${esc(t.status)}</td>
 <td>${esc(t.expiryDate || '-')}</td>
 </tr>
 `).join('') || '<tr><td colspan="8" style="text-align:center; color:#9aa1ab;">لا يوجد متدربون</td></tr>';

 return `
 <div class="section-block">
 <div class="report-title">تقرير المتدربين</div>
 <div class="summary-row">
 ${summaryBox('إجمالي المتدربين', total)}
 ${summaryBox('اشتراكات نشطة', active)}
 ${summaryBox('جلسات تجريبية', tests)}
 ${summaryBox('نسبة التحويل', conv)}
 </div>
 <table>
 <thead><tr><th>الكود</th><th>الاسم</th><th>الهاتف</th><th>النوع</th><th>الرياضة</th><th>الفرع</th><th>الحالة</th><th>تاريخ الانتهاء</th></tr></thead>
 <tbody>${rows}</tbody>
 </table>
 </div>
 `;
 }

 function buildFinancialReport(branch) {
 const payments = branch ? data.payments.filter(p => (p.branch || 'غير محدد') === branch) : data.payments;
 const expenses = branch ? data.expenses.filter(e => (e.branch || 'غير محدد') === branch) : data.expenses;
 const totalIncome = payments.reduce((sum, p) => sum + num(p.amount), 0);
 const totalExpenses = expenses.reduce((sum, e) => sum + num(e.amount), 0);
 const totalSalaries = expenses.filter(e => isSalaryType(e.type)).reduce((sum, e) => sum + num(e.amount), 0);
 const net = totalIncome - totalExpenses;

 const paymentRows = payments.map(p => `
 <tr>
 <td>${esc(p.id)}</td>
 <td>${esc(p.name)}</td>
 <td>${esc(p.type)}</td>
 <td>${esc(p.plan)}</td>
 <td>${esc(p.branch || 'غير محدد')}</td>
 <td>${num(p.amount).toLocaleString()} ج.م</td>
 <td>${esc(p.method)}</td>
 <td>${esc(p.date)}</td>
 </tr>
 `).join('') || '<tr><td colspan="8" style="text-align:center; color:#9aa1ab;">لا يوجد مدفوعات</td></tr>';

 const expenseRows = expenses.map(e => `
 <tr>
 <td>${esc(e.id)}</td>
 <td>${esc(e.type)}</td>
 <td>${esc(e.desc)}</td>
 <td>${esc(e.branch || 'غير محدد')}</td>
 <td>${num(e.amount).toLocaleString()} ج.م</td>
 <td>${esc(e.date)}</td>
 </tr>
 `).join('') || '<tr><td colspan="6" style="text-align:center; color:#9aa1ab;">لا يوجد مصروفات</td></tr>';

 const salaryRows = data.employees.map(e => `
 <tr>
 <td>${esc(e.id)}</td>
 <td>${esc(e.name)}</td>
 <td>${esc(e.role)}</td>
 <td>${num(e.salary).toLocaleString()} ج.م</td>
 <td>${esc(e.status)}</td>
 </tr>
 `).join('') || '<tr><td colspan="5" style="text-align:center; color:#9aa1ab;">لا يوجد موظفون</td></tr>';

 return `
 <div class="section-block">
 <div class="report-title">التقرير المالي</div>
 <div class="summary-row">
 ${summaryBox('إجمالي الإيرادات', `${totalIncome.toLocaleString()} ج.م`)}
 ${summaryBox('المصروفات', `${totalExpenses.toLocaleString()} ج.م`)}
 ${summaryBox('مرتبات مصروفة', `${totalSalaries.toLocaleString()} ج.م`)}
 ${summaryBox('صافي الربح', `${net.toLocaleString()} ج.م`)}
 </div>
 <table>
 <thead><tr><th colspan="8" style="text-align:right; background:#B8901F;">المدفوعات</th></tr><tr><th>الكود</th><th>الاسم</th><th>نوع العملية</th><th>الرياضة</th><th>الفرع</th><th>المبلغ</th><th>طريقة الدفع</th><th>التاريخ</th></tr></thead>
 <tbody>${paymentRows}</tbody>
 </table>
 <table>
 <thead><tr><th colspan="6" style="text-align:right; background:#B8901F;">المصروفات</th></tr><tr><th>الكود</th><th>النوع</th><th>الوصف</th><th>الفرع</th><th>المبلغ</th><th>التاريخ</th></tr></thead>
 <tbody>${expenseRows}</tbody>
 </table>
 </div>
 `;
 }

 function buildAttendanceReport(branch) {
 // Attendance records have no branch of their own, so resolve it through
 // the trainee they belong to.
 let attendance = data.attendance;
 if (branch) {
 const idsInBranch = new Set(data.trainees.filter(t => (t.branch || 'غير محدد') === branch).map(t => t.id));
 attendance = data.attendance.filter(a => idsInBranch.has(a.id));
 }
 const totalAttendance = attendance.length;
 const days = [...new Set(attendance.map(a => a.date))].length;
 const avg = totalAttendance > 0 ? Math.round(totalAttendance / Math.max(1, days)) : 0;

 const rows = attendance.map(a => `
 <tr>
 <td>${esc(a.id)}</td>
 <td>${esc(a.name)}</td>
 <td>${esc(a.date)}</td>
 <td>${esc(a.time)}</td>
 <td>${esc(a.status)}</td>
 </tr>
 `).join('') || '<tr><td colspan="5" style="text-align:center; color:#9aa1ab;">لا يوجد سجلات حضور</td></tr>';

 return `
 <div class="section-block">
 <div class="report-title">تقرير الحضور</div>
 <div class="summary-row">
 ${summaryBox('إجمالي سجلات الحضور', totalAttendance)}
 ${summaryBox('أيام التشغيل', days)}
 ${summaryBox('متوسط الحضور اليومي', avg)}
 </div>
 <table>
 <thead><tr><th>الكود</th><th>الاسم</th><th>التاريخ</th><th>الوقت</th><th>الحالة</th></tr></thead>
 <tbody>${rows}</tbody>
 </table>
 </div>
 `;
 }

 // Wraps a per-branch report builder so each branch lands on its own PDF page.
 function perBranchPages(builderFn, titlePrefix) {
 return BRANCHES.map((b, i) => `
 <div style="${i > 0 ? 'page-break-before: always;' : ''}">
 <div style="font-size:20px; font-weight:800; color:#B8901F; border-bottom:3px solid #B8901F; padding-bottom:8px; margin:0 0 16px;">${esc(titlePrefix)} — ${esc(b)}</div>
 ${builderFn(b)}
 </div>
 `).join('');
 }

 // "branch" = each branch on its own page, "combined" = all branches together.
 function reportScope() {
 const sel = document.getElementById('report-scope');
 return sel ? sel.value : 'branch';
 }

 function exportReport(type) {
 const builder = type === 'members' ? buildMembersReport : type === 'financial' ? buildFinancialReport : buildAttendanceReport;
 const title = type === 'members' ? 'تقرير المتدربين' : type === 'financial' ? 'التقرير المالي' : 'تقرير الحضور';
 if (reportScope() === 'combined') {
 reportDoc(title + ' (مجمّع)', builder());
 } else {
 reportDoc(title + ' (كل فرع في صفحة)', perBranchPages(builder, title));
 }
 }

 // Comprehensive report: per-branch pages, or one combined report.
 function printReport() {
 if (reportScope() === 'combined') {
 const body = buildMembersReport() + buildFinancialReport() + buildAttendanceReport();
 reportDoc('التقرير الشامل المجمّع', body);
 return;
 }
 const body = BRANCHES.map((b, i) => `
 <div style="${i > 0 ? 'page-break-before: always;' : ''}">
 <div style="font-size:24px; font-weight:800; color:#B8901F; border-bottom:3px solid #B8901F; padding-bottom:10px; margin:0 0 18px;">تقارير ${esc(b)}</div>
 ${buildMembersReport(b)}
 ${buildFinancialReport(b)}
 ${buildAttendanceReport(b)}
 </div>
 `).join('');
 reportDoc('التقارير الشاملة — كل فرع في صفحة', body);
 }

 // ==================== MONTHLY REPORT ====================
 function getMonthlyData(monthVal, branch) {
 const inBranch = x => branch === 'الكل' || (x.branch || 'غير محدد') === branch;
 const inMonth = x => dateKey(x.date).slice(0, 7) === monthVal; // YYYY-MM
 const pays = data.payments.filter(p => inBranch(p) && inMonth(p));
 const exps = data.expenses.filter(e => inBranch(e) && inMonth(e));
 const income = pays.reduce((s, p) => s + num(p.amount), 0);
 const expense = exps.reduce((s, e) => s + num(e.amount), 0);
 return { pays, exps, income, expense, net: income - expense };
 }

 function thisMonthVal() {
 const d = new Date();
 return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
 }

 function renderMonthlyReport() {
 const monthVal = document.getElementById('monthly-month').value || thisMonthVal();
 const branch = document.getElementById('monthly-branch').value;
 const out = document.getElementById('monthly-report-result');
 const d = getMonthlyData(monthVal, branch);
 out.innerHTML = `
 <div class="financial-summary" style="margin-bottom:0;">
 <div class="fin-card"><div class="fin-amount" style="color:var(--success);">${d.income.toLocaleString()} ج.م</div><div class="fin-label">إيرادات الشهر</div></div>
 <div class="fin-card"><div class="fin-amount" style="color:var(--danger);">${d.expense.toLocaleString()} ج.م</div><div class="fin-label">مصروفات الشهر</div></div>
 <div class="fin-card"><div class="fin-amount" style="color:${d.net >= 0 ? 'var(--success)' : 'var(--danger)'};">${d.net.toLocaleString()} ج.م</div><div class="fin-label">صافي الربح</div></div>
 </div>
 <p style="margin-top:12px; color:rgba(48,56,65,0.5); font-size:13px;">عدد عمليات الإيراد: ${d.pays.length} • عدد المصروفات: ${d.exps.length}</p>`;
 }

 function printMonthlyReport() {
 const monthVal = document.getElementById('monthly-month').value || thisMonthVal();
 const branch = document.getElementById('monthly-branch').value;
 const branchInfo = branch === 'الكل' ? 'كل الفروع' : branch;
 const build = (b) => {
 const d = getMonthlyData(monthVal, b === 'الكل' ? 'الكل' : b);
 const payRows = d.pays.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.id)}</td><td>${esc(p.name)}</td><td>${esc(p.type)}</td><td>${esc(p.branch || 'غير محدد')}</td><td>${num(p.amount).toLocaleString()} ج.م</td><td>${esc(p.method || '-')}</td><td>${esc(p.date)}</td></tr>`).join('') || '<tr><td colspan="8" style="text-align:center; color:#9aa1ab;">لا توجد إيرادات</td></tr>';
 const expRows = d.exps.map((e, i) => `<tr><td>${i + 1}</td><td>${esc(e.type)}</td><td>${esc(e.desc || '-')}</td><td>${esc(e.branch || 'غير محدد')}</td><td>${num(e.amount).toLocaleString()} ج.م</td><td>${esc(e.date)}</td></tr>`).join('') || '<tr><td colspan="6" style="text-align:center; color:#9aa1ab;">لا توجد مصروفات</td></tr>';
 return `
 <div class="report-title">تقرير شهر ${esc(monthVal)} — ${esc(b === 'الكل' ? branchInfo : b)}</div>
 <div class="summary-row">
 ${summaryBox('إيرادات الشهر', d.income.toLocaleString() + ' ج.م')}
 ${summaryBox('مصروفات الشهر', d.expense.toLocaleString() + ' ج.م')}
 ${summaryBox('صافي الربح', d.net.toLocaleString() + ' ج.م')}
 </div>
 <table><thead><tr><th colspan="8" style="text-align:right; background:#B8901F;">الإيرادات</th></tr><tr><th>#</th><th>الكود</th><th>الاسم</th><th>النوع</th><th>الفرع</th><th>المبلغ</th><th>الطريقة</th><th>التاريخ</th></tr></thead><tbody>${payRows}</tbody></table>
 <table><thead><tr><th colspan="6" style="text-align:right; background:#B8901F;">المصروفات</th></tr><tr><th>#</th><th>النوع</th><th>الوصف</th><th>الفرع</th><th>المبلغ</th><th>التاريخ</th></tr></thead><tbody>${expRows}</tbody></table>`;
 };

 let body;
 if (branch === 'الكل' && reportScope() === 'branch') {
 body = BRANCHES.map((b, i) => `<div style="${i > 0 ? 'page-break-before: always;' : ''}">${build(b)}</div>`).join('');
 } else {
 body = `<div class="section-block">${build(branch)}</div>`;
 }
 reportDoc('تقرير شهري - ' + monthVal, body);
 }

 // ==================== FEEDBACK / COMPLAINTS ====================
 function addFeedback() {
 const text = document.getElementById('feedback-text').value.trim();
 if (!text) { showNotification('اكتب تفاصيل الشكوى/الملاحظة', 'warning'); return; }
 const name = document.getElementById('feedback-name').value.trim();
 const branch = document.getElementById('feedback-branch').value;
 const ftype = document.getElementById('feedback-type').value;
 const docId = genDocId('FB');
 const fb = { _docId: docId, id: docId, name: name || 'مجهول', branch, type: ftype, text, date: new Date().toLocaleDateString('ar-EG') };
 data.feedback = data.feedback || [];
 data.feedback.push(fb);
 dbSetDoc(feedbackCol, docId, fb);
 document.getElementById('feedback-text').value = '';
 document.getElementById('feedback-name').value = '';
 renderFeedback();
 showNotification('تم تسجيل الملاحظة');
 }

 function renderFeedback() {
 const tbody = document.getElementById('feedback-table');
 if (!tbody) return;
 const list = (data.feedback || []).slice().reverse();
 if (list.length === 0) {
 tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:rgba(48,56,65,0.3); padding:20px;">لا توجد شكاوى مسجلة</td></tr>';
 return;
 }
 tbody.innerHTML = list.map(f => `
 <tr>
 <td>${esc(f.date)}</td>
 <td><span class="badge ${f.type === 'شكوى' ? 'badge-danger' : f.type === 'اقتراح' ? 'badge-info' : 'badge-test'}">${esc(f.type)}</span></td>
 <td>${esc(f.name)}</td>
 <td>${esc(f.branch || 'غير محدد')}</td>
 <td>${esc(f.text)}</td>
 <td><button class="btn btn-danger btn-sm" onclick="deleteFeedback('${esc(f._docId)}')">حذف</button></td>
 </tr>`).join('');
 }

 function deleteFeedback(id) {
 if (!confirm('حذف هذه الملاحظة؟')) return;
 data.feedback = (data.feedback || []).filter(f => f._docId !== id);
 dbDeleteDoc(feedbackCol, id);
 renderFeedback();
 }

 function printFeedback() {
 const list = (data.feedback || []).slice().reverse();
 const rows = list.length
 ? list.map((f, i) => `<tr><td>${i + 1}</td><td>${esc(f.date)}</td><td>${esc(f.type)}</td><td>${esc(f.name)}</td><td>${esc(f.branch || 'غير محدد')}</td><td>${esc(f.text)}</td></tr>`).join('')
 : '<tr><td colspan="6" style="text-align:center; color:#9aa1ab;">لا توجد شكاوى</td></tr>';
 const body = `
 <div class="section-block">
 <div class="report-title">سجل الشكاوى والملاحظات</div>
 <table><thead><tr><th>#</th><th>التاريخ</th><th>النوع</th><th>الاسم</th><th>الفرع</th><th>التفاصيل</th></tr></thead><tbody>${rows}</tbody></table>
 </div>`;
 reportDoc('سجل الشكاوى والملاحظات', body);
 }

 // ==================== DAILY REPORT ====================
 // Income/expenses/net for one calendar day, optionally for one branch.
 function getDailyData(dateVal, branch) {
 const inBranch = x => branch === 'الكل' || (x.branch || 'غير محدد') === branch;
 const pays = data.payments.filter(p => inBranch(p) && dateKey(p.date) === dateVal);
 const exps = data.expenses.filter(e => inBranch(e) && dateKey(e.date) === dateVal);
 const income = pays.reduce((s, p) => s + num(p.amount), 0);
 const expense = exps.reduce((s, e) => s + num(e.amount), 0);
 return { pays, exps, income, expense, net: income - expense };
 }

 function renderDailyReport() {
 const dateVal = document.getElementById('daily-date').value;
 const branch = document.getElementById('daily-branch').value;
 const out = document.getElementById('daily-report-result');
 if (!dateVal) { showNotification('اختر التاريخ أولاً', 'warning'); return; }
 const d = getDailyData(dateVal, branch);

 const tx = [
 ...d.pays.map(p => ({ kind: 'إيراد', desc: `${p.type} - ${p.name}`, amount: num(p.amount), branch: p.branch })),
 ...d.exps.map(e => ({ kind: 'مصروف', desc: `${e.type} - ${e.desc || ''}`, amount: num(e.amount), branch: e.branch }))
 ];
 const rows = tx.length ? tx.map(t => `
 <tr>
 <td><span class="badge ${t.kind === 'إيراد' ? 'badge-success' : 'badge-danger'}">${t.kind}</span></td>
 <td>${esc(t.desc)}</td>
 <td><span class="badge" style="background: rgba(48,56,65,0.05); border: 1px solid rgba(48,56,65,0.2);">${esc(t.branch || 'غير محدد')}</span></td>
 <td style="font-weight:700; color:${t.kind === 'إيراد' ? 'var(--success)' : 'var(--danger)'};">${t.amount.toLocaleString()} ج.م</td>
 </tr>`).join('') : '<tr><td colspan="4" style="text-align:center; color:rgba(48,56,65,0.3); padding:20px;">لا توجد حركات مالية في هذا اليوم</td></tr>';

 out.innerHTML = `
 <div class="financial-summary" style="margin-bottom:18px;">
 <div class="fin-card"><div class="fin-amount" style="color:var(--success);">${d.income.toLocaleString()} ج.م</div><div class="fin-label">إيرادات اليوم</div></div>
 <div class="fin-card"><div class="fin-amount" style="color:var(--danger);">${d.expense.toLocaleString()} ج.م</div><div class="fin-label">مصروفات اليوم</div></div>
 <div class="fin-card"><div class="fin-amount" style="color:${d.net >= 0 ? 'var(--success)' : 'var(--danger)'};">${d.net.toLocaleString()} ج.م</div><div class="fin-label">صافي الربح</div></div>
 </div>
 <div class="table-container"><table>
 <thead><tr><th>النوع</th><th>البيان</th><th>الفرع</th><th>المبلغ</th></tr></thead>
 <tbody>${rows}</tbody>
 </table></div>`;
 }

 function printDailyReport() {
 const dateVal = document.getElementById('daily-date').value;
 const branch = document.getElementById('daily-branch').value;
 if (!dateVal) { showNotification('اختر التاريخ أولاً', 'warning'); return; }
 const d = getDailyData(dateVal, branch);

 const payRows = d.pays.map((p, i) => `
 <tr><td>${i + 1}</td><td>${esc(p.id)}</td><td>${esc(p.name)}</td><td>${esc(p.type)}</td><td>${esc(p.branch || 'غير محدد')}</td><td>${num(p.amount).toLocaleString()} ج.م</td><td>${esc(p.method || '-')}</td></tr>
 `).join('') || '<tr><td colspan="7" style="text-align:center; color:#9aa1ab;">لا توجد إيرادات</td></tr>';
 const expRows = d.exps.map((e, i) => `
 <tr><td>${i + 1}</td><td>${esc(e.id)}</td><td>${esc(e.type)}</td><td>${esc(e.desc || '-')}</td><td>${esc(e.branch || 'غير محدد')}</td><td>${num(e.amount).toLocaleString()} ج.م</td></tr>
 `).join('') || '<tr><td colspan="6" style="text-align:center; color:#9aa1ab;">لا توجد مصروفات</td></tr>';

 const branchInfo = branch === 'الكل' ? 'كل الفروع' : branch;
 const body = `
 <div class="section-block">
 <div class="report-title">تقرير يومي — ${esc(dateVal)} (${esc(branchInfo)})</div>
 <div class="summary-row">
 ${summaryBox('إيرادات اليوم', d.income.toLocaleString() + ' ج.م')}
 ${summaryBox('مصروفات اليوم', d.expense.toLocaleString() + ' ج.م')}
 ${summaryBox('صافي الربح', d.net.toLocaleString() + ' ج.م')}
 </div>
 <table>
 <thead><tr><th colspan="7" style="text-align:right; background:#B8901F;">الإيرادات</th></tr>
 <tr><th>#</th><th>الكود</th><th>الاسم</th><th>النوع</th><th>الفرع</th><th>المبلغ</th><th>طريقة الدفع</th></tr></thead>
 <tbody>${payRows}</tbody>
 </table>
 <table>
 <thead><tr><th colspan="6" style="text-align:right; background:#B8901F;">المصروفات</th></tr>
 <tr><th>#</th><th>الكود</th><th>النوع</th><th>الوصف</th><th>الفرع</th><th>المبلغ</th></tr></thead>
 <tbody>${expRows}</tbody>
 </table>
 </div>`;
 reportDoc(`تقرير يومي - ${dateVal}`, body);
 }

 function exportData() {
 const csv = data.trainees.map(t =>
 `${t.id},${t.name},${t.phone},${t.type},${t.plan},${t.status},${t.registrationDate}`
 ).join('\n');

 const header = 'الكود,الاسم,الهاتف,النوع,الخطة,الحالة,التاريخ\n';
 const blob = new Blob(['\uFEFF' + header + csv], { type: 'text/csv;charset=utf-8;' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = 'trainees.csv';
 a.click();
 }

 // ==================== UTILITIES ====================
 function closeModal() {
 document.getElementById('modal-overlay').classList.remove('show');
 }

 function showNotification(text, type = 'success') {
 const notif = document.getElementById('notification');
 const colors = { success: 'var(--success)', warning: 'var(--warning)', danger: 'var(--danger)' };

 notif.style.borderRightColor = colors[type];
 document.getElementById('notif-text').textContent = text;
 notif.classList.add('show');

 setTimeout(() => notif.classList.remove('show'), 3000);
 }

 function updateDateTime() {
 const now = new Date();
 document.getElementById('current-date').textContent =
 now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
 }

 // ==================== AUTH & ROLES ====================
 // Anyone in this list is a full admin. Everyone else who logs in is
 // treated as an "employee" and only sees the cashier sections below.
 const ADMIN_EMAILS = ['abdrhmanq5005@gmail.com'];

 // Sections an employee (cashier) is allowed to see.
 const EMPLOYEE_SECTIONS = ['registration', 'attendance', 'sessions', 'groups', 'staff-attendance', 'financial'];

 function roleForEmail(email) {
 return ADMIN_EMAILS.includes((email || '').toLowerCase()) ? 'admin' : 'employee';
 }

 // Shows/hides sidebar items based on role. NOTE: this is a UI gate, not
 // hard security — real enforcement would need Firebase custom claims.
 function applyRolePermissions(role) {
 const navItems = document.querySelectorAll('.nav-item');
 if (role === 'admin') {
 navItems.forEach(n => { n.style.display = ''; });
 return;
 }
 // Employee: hide every section that isn't in the allowed list.
 navItems.forEach(n => {
 const sec = n.getAttribute('data-section');
 n.style.display = EMPLOYEE_SECTIONS.includes(sec) ? '' : 'none';
 });
 // The default landing section (dashboard) is hidden for employees,
 // so send them to the first section they're allowed to use.
 showSection(EMPLOYEE_SECTIONS[0]);
 }

 // Maps Firebase auth error codes to friendly Arabic messages.
 function loginErrorMessage(code) {
 switch (code) {
 case 'auth/invalid-email': return 'صيغة البريد الإلكتروني غير صحيحة';
 case 'auth/user-disabled': return 'تم تعطيل هذا الحساب';
 case 'auth/user-not-found':
 case 'auth/wrong-password':
 case 'auth/invalid-credential': return 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
 case 'auth/too-many-requests': return 'محاولات كثيرة، حاول مرة أخرى بعد قليل';
 case 'auth/network-request-failed': return 'تعذر الاتصال بالشبكة، تحقق من الإنترنت';
 default: return 'تعذر تسجيل الدخول، حاول مرة أخرى';
 }
 }

 async function handleLogin(e) {
 e.preventDefault();
 const email = document.getElementById('login-email').value.trim();
 const password = document.getElementById('login-password').value;
 const errEl = document.getElementById('login-error');
 const btn = document.getElementById('login-btn');
 errEl.textContent = '';

 if (!email || !password) {
 errEl.textContent = 'يرجى إدخال البريد الإلكتروني وكلمة المرور';
 return;
 }

 btn.disabled = true;
 btn.textContent = 'جاري تسجيل الدخول...';
 try {
 // On success, onAuthStateChanged fires and bootstraps the app.
 await auth.signInWithEmailAndPassword(email, password);
 } catch (err) {
 console.error('Login error:', err);
 errEl.textContent = loginErrorMessage(err.code);
 } finally {
 btn.disabled = false;
 btn.textContent = 'تسجيل الدخول';
 }
 }

 function logout() {
 auth.signOut().catch(err => console.error('Logout error:', err));
 // onAuthStateChanged will show the login screen again.
 }

 function showLoginScreen() {
 document.getElementById('loading-overlay').classList.add('hidden');
 document.getElementById('app-header').style.display = 'none';
 document.getElementById('app-container').style.display = 'none';
 document.getElementById('login-screen').classList.remove('hidden');
 document.getElementById('login-password').value = '';
 }

 // Runs once after a user is authenticated: loads data and reveals the app.
 async function startApp(user) {
 document.getElementById('login-screen').classList.add('hidden');
 document.getElementById('loading-overlay').classList.remove('hidden');

 await loadData();
 refreshExpiredStatuses();

 document.getElementById('loading-overlay').classList.add('hidden');
 document.getElementById('app-header').style.display = '';
 document.getElementById('app-container').style.display = '';

 currentRole = roleForEmail(user.email);
 const roleLabel = currentRole === 'admin' ? 'مدير' : 'موظف';
 document.getElementById('current-user').textContent = `${user.email || 'مستخدم'} (${roleLabel})`;

 updateDashboard();
 updateBadge();

 // Set today's date
 document.getElementById('reg-start-date').valueAsDate = new Date();
 document.getElementById('renew-date').valueAsDate = new Date();
 const dailyDate = document.getElementById('daily-date');
 if (dailyDate) dailyDate.valueAsDate = new Date();
 populateRegTrainerSelect();

 applyRolePermissions(currentRole);
 }

 // ==================== INIT ====================
 document.addEventListener('DOMContentLoaded', () => {
 updateDateTime();
 setInterval(updateDateTime, 60000);

 document.getElementById('login-form').addEventListener('submit', handleLogin);

 // Single source of truth for "is the user logged in?". Fires on load,
 // after login, after logout, and on token refresh.
 auth.onAuthStateChanged(user => {
 if (user) startApp(user);
 else showLoginScreen();
 });
 });

 // Close modal on overlay click
 document.getElementById('modal-overlay').addEventListener('click', function(e) {
 if (e.target === this) closeModal();
 });

 // Enter key for attendance
 document.addEventListener('keypress', function(e) {
 if (e.key === 'Enter' && document.getElementById('attendance-code') === document.activeElement) {
 recordAttendance();
 }
 });