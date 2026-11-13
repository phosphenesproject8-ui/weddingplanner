// Lapisan data: Firebase (sinkron real-time) atau Mode Lokal (localStorage).
import { firebaseConfig } from "./config.js";

const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
export const isCloud = !!(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId);

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

// ---------------- Mode Lokal ----------------
function localStore() {
  const subs = {};
  const key = (c) => "wp:" + c;
  const read = (c) => {
    try { return JSON.parse(localStorage.getItem(key(c)) || "{}"); } catch { return {}; }
  };
  const write = (c, m) => {
    try { localStorage.setItem(key(c), JSON.stringify(m)); } catch {}
    emit(c);
  };
  const emit = (c) => {
    const m = read(c);
    const arr = Object.entries(m).map(([id, d]) => ({ ...d, id }));
    (subs[c] || []).forEach((cb) => cb(arr));
  };
  window.addEventListener("storage", (e) => {
    if (e.key && e.key.startsWith("wp:")) emit(e.key.slice(3));
  });
  let user = { email: "mode-lokal", local: true };
  return {
    mode: "local",
    onAuth(cb) { cb(user); },
    async signIn() { return user; },
    async signOut() {},
    subscribe(c, cb) {
      (subs[c] = subs[c] || []).push(cb);
      emit(c);
      return () => (subs[c] = subs[c].filter((f) => f !== cb));
    },
    async put(c, obj) {
      const m = read(c);
      const id = obj.id || uid();
      const { id: _x, ...rest } = obj;
      m[id] = { ...rest, updatedAt: new Date().toISOString(), updatedBy: user.email };
      write(c, m);
      return id;
    },
    async remove(c, id) { const m = read(c); delete m[id]; write(c, m); },
    async bulk(c, items) {
      const m = read(c);
      items.forEach((o) => { const id = o.id || uid(); const { id: _x, ...r } = o; m[id] = r; });
      write(c, m);
    },
    async getAll(c) { return Object.entries(read(c)).map(([id, d]) => ({ ...d, id })); },
    async clear(c) { write(c, {}); }
  };
}

// ---------------- Firebase ----------------
async function cloudStore() {
  const [{ initializeApp }, auth, fs] = await Promise.all([
    import(FB + "firebase-app.js"),
    import(FB + "firebase-auth.js"),
    import(FB + "firebase-firestore.js")
  ]);
  const app = initializeApp(firebaseConfig);
  const a = auth.getAuth(app);
  let db;
  try {
    db = fs.initializeFirestore(app, {
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() })
    });
  } catch { db = fs.getFirestore(app); }
  let current = null;
  return {
    mode: "cloud",
    onAuth(cb) { auth.onAuthStateChanged(a, (u) => { current = u; cb(u); }); },
    async signIn(email, pass) { return (await auth.signInWithEmailAndPassword(a, email, pass)).user; },
    async resetPassword(email) { return auth.sendPasswordResetEmail(a, email); },
    async signOut() { return auth.signOut(a); },
    subscribe(c, cb, onErr) {
      return fs.onSnapshot(fs.collection(db, c),
        (snap) => cb(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
        (err) => { console.error(c, err); onErr && onErr(err); });
    },
    async put(c, obj) {
      const { id, ...rest } = obj;
      const ref = id ? fs.doc(db, c, id) : fs.doc(fs.collection(db, c));
      await fs.setDoc(ref, { ...rest, updatedAt: new Date().toISOString(), updatedBy: current?.email || "" });
      return ref.id;
    },
    async remove(c, id) { await fs.deleteDoc(fs.doc(db, c, id)); },
    async bulk(c, items) {
      for (let i = 0; i < items.length; i += 400) {
        const b = fs.writeBatch(db);
        items.slice(i, i + 400).forEach((o) => {
          const { id, ...r } = o;
          b.set(id ? fs.doc(db, c, id) : fs.doc(fs.collection(db, c)), r);
        });
        await b.commit();
      }
    },
    async getAll(c) {
      const s = await fs.getDocs(fs.collection(db, c));
      return s.docs.map((d) => ({ ...d.data(), id: d.id }));
    },
    async clear(c) {
      const s = await fs.getDocs(fs.collection(db, c));
      for (let i = 0; i < s.docs.length; i += 400) {
        const b = fs.writeBatch(db);
        s.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
        await b.commit();
      }
    }
  };
}

// Khusus halaman undangan publik: baca info & kirim RSVP tanpa login.
export async function publicApi() {
  if (!isCloud) {
    const ls = localStore();
    return {
      async getInvite() { return (await ls.getAll("public")).find((d) => d.id === "invite") || null; },
      async sendRsvp(d) { return ls.put("rsvp", d); }
    };
  }
  const [{ initializeApp }, fs] = await Promise.all([
    import(FB + "firebase-app.js"), import(FB + "firebase-firestore.js")
  ]);
  const db = fs.getFirestore(initializeApp(firebaseConfig));
  return {
    async getInvite() { const s = await fs.getDoc(fs.doc(db, "public", "invite")); return s.exists() ? s.data() : null; },
    async sendRsvp(d) { return (await fs.addDoc(fs.collection(db, "rsvp"), d)).id; }
  };
}

export async function createStore() {
  return isCloud ? cloudStore() : localStore();
}
