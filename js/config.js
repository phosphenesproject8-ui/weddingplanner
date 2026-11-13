// ============================================================
//  KONFIGURASI — isi bagian ini setelah membuat project Firebase
//  (lihat PANDUAN-SETUP.md langkah 3).
//  Selama firebaseConfig masih kosong, aplikasi berjalan dalam
//  "Mode Lokal": data hanya tersimpan di browser perangkat ini.
// ============================================================

export const firebaseConfig = {
  apiKey: "AIzaSyDjfAKbJ_0fLPRQBiWWpY80XxNPw_k2qDA",
  authDomain: "weddingvaditfirda.firebaseapp.com",
  projectId: "weddingvaditfirda",
  storageBucket: "weddingvaditfirda.firebasestorage.app",
  messagingSenderId: "342711484543",
  appId: "1:342711484543:web:fbc2afaaec6ba291a6ff4a"
};

// Email yang boleh masuk (kamu & pasangan). Harus sama dengan
// yang ditulis di firestore.rules.
export const allowedEmails = [
  "vadityaviardana@gmail.com",
  "fatihatulfirdausi@gmail.com"
];
