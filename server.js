 // ====================================================================
 // server.js
 // ----------------------------------------------------------------------
 // Data layer: Firebase setup, Firestore collections, and all the
 // read/write helpers the app uses to talk to the database.
 // NOTE: this still runs in the visitor's browser like main.js does -
 // it is not a separate backend process. It's just split into its own
 // file to keep "data/Firestore" code separate from "UI" code (main.js).
 // Load order in index.html must be: firebase SDK -> server.js -> main.js
 // ====================================================================

 // ==================== FIREBASE SETUP ====================
 const firebaseConfig = {
 apiKey: "AIzaSyD3XUNapMy7A4_P7-P53PtdF3noSAIG-K0",
 authDomain: "nacademy-c11a9.firebaseapp.com",
 projectId: "nacademy-c11a9",
 storageBucket: "nacademy-c11a9.firebasestorage.app",
 messagingSenderId: "639306451600",
 appId: "1:639306451600:web:9647a04a02b0a61ba52615",
 measurementId: "G-N5D4880NEE"
 };

 firebase.initializeApp(firebaseConfig);
 const db = firebase.firestore();
 const auth = firebase.auth();

 // Firestore collections - one per data type, instead of one giant blob
 const traineesCol = db.collection('trainees');
 const attendanceCol = db.collection('attendance');
 const paymentsCol = db.collection('payments');
 const employeesCol = db.collection('employees');
 const expensesCol = db.collection('expenses');
 const groupsCol = db.collection('groups');
 const sessionsCol = db.collection('sessions');
 const staffAttendanceCol = db.collection('staffAttendance');
 const feedbackCol = db.collection('feedback');
 const metaDoc = db.collection('meta').doc('counter');

 // ==================== DATA STORE ====================
 let data = {
 trainees: [],
 attendance: [],
 payments: [],
 employees: [],
 expenses: [],
 groups: [],
 sessions: [],
 staffAttendance: [],
 feedback: [],
 counter: 1
 };

 // Keep a local copy too, so the app still opens (read-only) if the
 // connection drops, and so the first paint isn't blank while Firestore loads.
 // The history collections (attendance/payments/expenses/...) grow without
 // bound, so the cache keeps the small "current state" collections in full
 // but only the most recent slice of history — this keeps the cache well
 // under the ~5MB localStorage quota no matter how large the database gets.
 function cacheLocally() {
 const HISTORY_KEEP = 800;
 const slim = {
 trainees: data.trainees,
 employees: data.employees,
 groups: data.groups,
 sessions: data.sessions,
 counter: data.counter,
 payments: (data.payments || []).slice(-HISTORY_KEEP),
 attendance: (data.attendance || []).slice(-HISTORY_KEEP),
 expenses: (data.expenses || []).slice(-HISTORY_KEEP),
 staffAttendance: (data.staffAttendance || []).slice(-HISTORY_KEEP),
 feedback: (data.feedback || []).slice(-HISTORY_KEEP)
 };
 try {
 localStorage.setItem('racer-data', JSON.stringify(slim));
 } catch (e) {
 // Still too big: cache only the essential current-state collections.
 try {
 localStorage.setItem('racer-data', JSON.stringify({
 trainees: data.trainees, employees: data.employees,
 groups: data.groups, sessions: data.sessions, counter: data.counter,
 payments: [], attendance: [], expenses: [], staffAttendance: [], feedback: []
 }));
 } catch (e2) { /* storage unavailable - not critical, app works online */ }
 }
 }

 // Load everything from Firestore. If Firestore is empty (first time this
 // site is connected to the database) but old localStorage data exists,
 // that local data is pushed up to Firestore once, so nothing is lost.
 async function loadData() {
 try {
 const [traineesSnap, attendanceSnap, paymentsSnap, employeesSnap, expensesSnap, groupsSnap, sessionsSnap, staffAttSnap, feedbackSnap, counterSnap] =
 await Promise.all([
 traineesCol.get(), attendanceCol.get(), paymentsCol.get(),
 employeesCol.get(), expensesCol.get(), groupsCol.get(), sessionsCol.get(), staffAttendanceCol.get(), feedbackCol.get(), metaDoc.get()
 ]);

 const hasCloudData = !traineesSnap.empty || !attendanceSnap.empty ||
 !paymentsSnap.empty || !employeesSnap.empty || !expensesSnap.empty ||
 !groupsSnap.empty || !sessionsSnap.empty || !staffAttSnap.empty || !feedbackSnap.empty || counterSnap.exists;

 if (hasCloudData) {
 // Attach each Firestore document id as `_docId` so individual records
 // (especially payments, which use auto-generated ids) can be edited
 // or deleted later regardless of how they were originally created.
 const withDocId = d => Object.assign(d.data(), { _docId: d.id });
 data.trainees = traineesSnap.docs.map(withDocId);
 data.attendance = attendanceSnap.docs.map(withDocId);
 data.payments = paymentsSnap.docs.map(withDocId);
 data.employees = employeesSnap.docs.map(withDocId);
 data.expenses = expensesSnap.docs.map(withDocId);
 data.groups = groupsSnap.docs.map(withDocId);
 data.sessions = sessionsSnap.docs.map(withDocId);
 data.staffAttendance = staffAttSnap.docs.map(withDocId);
 data.feedback = feedbackSnap.docs.map(withDocId);
 data.counter = counterSnap.exists ? counterSnap.data().value : (data.trainees.length + 1);
 } else {
 const saved = localStorage.getItem('racer-data');
 if (saved) {
 const localData = JSON.parse(saved);
 data = Object.assign({ trainees: [], attendance: [], payments: [], employees: [], expenses: [], groups: [], sessions: [], staffAttendance: [], feedback: [], counter: 1 }, localData);
 await migrateLocalDataToFirestore(data);
 showNotification('تم رفع البيانات المحفوظة محلياً إلى قاعدة البيانات بنجاح');
 }
 }

 cacheLocally();
 } catch (err) {
 console.error('Firestore load error:', err);
 const saved = localStorage.getItem('racer-data');
 if (saved) data = JSON.parse(saved);
 showNotification('تعذر الاتصال بقاعدة البيانات، يتم عرض آخر نسخة محفوظة محلياً', 'danger');
 }
 }

 // One-time migration of any pre-existing local data into Firestore,
 // batched safely under Firestore's 500-writes-per-batch limit.
 async function migrateLocalDataToFirestore(localData) {
 const ops = [];
 (localData.trainees || []).forEach(t => ops.push(['set', traineesCol.doc(t.id), t]));
 (localData.attendance || []).forEach(a => ops.push(['add', attendanceCol, a]));
 (localData.payments || []).forEach(p => ops.push(['add', paymentsCol, p]));
 (localData.employees || []).forEach(e => ops.push(['set', employeesCol.doc(e.id), e]));
 (localData.expenses || []).forEach(e => ops.push(['set', expensesCol.doc(e.id), e]));

 for (let i = 0; i < ops.length; i += 450) {
 const batch = db.batch();
 ops.slice(i, i + 450).forEach(([kind, refOrCol, obj]) => {
 if (kind === 'set') batch.set(refOrCol, obj);
 else batch.set(refOrCol.doc(), obj);
 });
 await batch.commit();
 }

 await metaDoc.set({ value: localData.counter || 1 });
 }

 // Write helpers - update the cloud, and always keep the local cache in sync
 // immediately so the UI never waits on the network.
 async function dbSetDoc(colRef, id, obj) {
 cacheLocally();
 try {
 await colRef.doc(id).set(obj);
 } catch (err) {
 console.error('Firestore set error:', err);
 showNotification('تم الحفظ محلياً، لكن تعذر رفعه لقاعدة البيانات. تحقق من الاتصال', 'danger');
 }
 }

 async function dbAddDoc(colRef, obj) {
 cacheLocally();
 try {
 await colRef.add(obj);
 } catch (err) {
 console.error('Firestore add error:', err);
 showNotification('تم الحفظ محلياً، لكن تعذر رفعه لقاعدة البيانات. تحقق من الاتصال', 'danger');
 }
 }

 async function dbDeleteDoc(colRef, id) {
 cacheLocally();
 try {
 await colRef.doc(id).delete();
 } catch (err) {
 console.error('Firestore delete error:', err);
 showNotification('تعذر الحذف من قاعدة البيانات السحابية', 'danger');
 }
 }

 // Delete every document in a collection where `field == value`.
 // Used to clean up records (e.g. attendance) tied to a deleted trainee,
 // since those were stored with auto-generated IDs we don't track locally.
 async function dbDeleteWhere(colRef, field, value) {
 cacheLocally();
 try {
 const snap = await colRef.where(field, '==', value).get();
 if (snap.empty) return;
 const batch = db.batch();
 snap.docs.forEach(d => batch.delete(d.ref));
 await batch.commit();
 } catch (err) {
 console.error('Firestore delete-where error:', err);
 showNotification('تعذر حذف بعض السجلات المرتبطة من قاعدة البيانات', 'danger');
 }
 }

 async function dbSaveCounter() {
 cacheLocally();
 try {
 await metaDoc.set({ value: data.counter });
 } catch (err) {
 console.error('Firestore counter error:', err);
 }
 }

 // Atomically reserve the next trainee number using a Firestore transaction,
 // so two devices registering at the same moment can never get the same code.
 // Falls back to the local counter if the database is unreachable (offline).
 async function nextCounterValue() {
 try {
 const value = await db.runTransaction(async (tx) => {
 const snap = await tx.get(metaDoc);
 const current = snap.exists ? (snap.data().value || 1) : (data.trainees.length + 1);
 tx.set(metaDoc, { value: current + 1 });
 return current;
 });
 data.counter = value + 1;
 cacheLocally();
 return value;
 } catch (err) {
 console.error('Counter transaction error (using local fallback):', err);
 const fallback = data.counter++;
 dbSaveCounter();
 return fallback;
 }
 }

