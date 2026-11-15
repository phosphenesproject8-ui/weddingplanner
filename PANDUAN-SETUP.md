# Panduan Setup Wedding Planner

Total waktu: sekitar 20–30 menit, sekali saja. Semuanya gratis (Firebase paket **Spark** + GitHub Pages), tanpa kartu kredit.

Isi folder:

| File | Fungsi |
|---|---|
| `index.html` | Aplikasi planner (perlu login) |
| `undangan.html` | Undangan digital publik + form RSVP (tanpa login) |
| `js/config.js` | **Tempat menempel konfigurasi Firebase & email kalian** |
| `firestore.rules` | Aturan keamanan database (siapa boleh baca/tulis) |
| `img/` | Foto prewedding & halaman moodboard |
| `data/data-awal.json` | Data dari 4 PDF kalian. **Jangan diunggah ke GitHub** (lihat langkah 5) |

> Belum setup apa pun? Buka `index.html` lewat web server lokal dan aplikasi akan berjalan di **Mode Lokal** (data hanya di browser itu). Cocok untuk mencoba dulu.

---

## 1. Buat project Firebase

1. Buka <https://console.firebase.google.com> dan login dengan akun Google.
2. Klik **Create a project** (Buat project). Nama bebas, misalnya `wedding-vf`. Google Analytics boleh dimatikan.
3. Setelah jadi, di halaman project klik ikon **`</>`** (Web) untuk menambahkan aplikasi web. Nama app bebas. **Jangan** centang Firebase Hosting. Klik **Register app**.
4. Akan muncul kode berisi `const firebaseConfig = { apiKey: "...", ... }`. Biarkan tab ini terbuka, isinya dipakai di langkah 3.

## 2. Aktifkan login & database

**Login (Authentication)**
1. Menu kiri **Build → Authentication → Get started**.
2. Tab **Sign-in method** → pilih **Email/Password** → aktifkan (Enable) → Save.
3. Tab **Users** → **Add user**. Buat 2 akun: email kamu + kata sandi, lalu email pasangan + kata sandi.

**Database (Firestore)**
1. Menu kiri **Build → Firestore Database → Create database**.
2. Pilih lokasi **asia-southeast2 (Jakarta)**. Mulai dalam **production mode**.
3. Buka tab **Rules**, hapus semua isinya, lalu tempel seluruh isi file `firestore.rules`.
4. Ganti `emailkamu@gmail.com` dan `emailpasangan@gmail.com` dengan 2 email dari langkah sebelumnya. Klik **Publish**.

## 3. Tempel konfigurasi ke aplikasi

Buka `js/config.js` dengan editor teks (Notepad pun bisa), lalu:
- Salin nilai `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId` dari langkah 1.4.
- Isi `allowedEmails` dengan 2 email yang sama.

Contoh:
```js
export const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "wedding-vf.firebaseapp.com",
  projectId: "wedding-vf",
  storageBucket: "wedding-vf.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123"
};
export const allowedEmails = ["kamu@gmail.com", "pasangan@gmail.com"];
```
`apiKey` Firebase memang aman untuk publik. Yang menjaga data kalian adalah `firestore.rules`.

## 4. Unggah ke GitHub Pages

1. Buat akun / login di <https://github.com>.
2. Klik **New repository**. Nama misalnya `wedding-planner`, pilih **Public** (GitHub Pages gratis butuh repo publik). Data tamu & anggaran tersimpan di Firebase, bukan di repo. Folder `img/` (foto prewedding & moodboard) ikut terunggah, jadi bisa dibuka siapa saja yang tahu alamatnya, sama seperti foto di undangan digital. Kalau tidak mau, hapus file moodboard dari folder `img/moodboard` sebelum mengunggah.
3. Di repo baru, klik **uploading an existing file**, lalu seret semua isi folder ini **kecuali folder `data`**. Klik **Commit changes**.
4. Buka **Settings → Pages**. Pada *Source* pilih **Deploy from a branch**, branch **main**, folder **/(root)** → Save.
5. Tunggu 1–2 menit. Alamat aplikasi: `https://USERNAME.github.io/wedding-planner/`
6. Kembali ke Firebase: **Authentication → Settings → Authorized domains → Add domain** → isi `USERNAME.github.io`.

## 5. Masukkan data dari PDF

1. Buka alamat aplikasi, login dengan salah satu akun.
2. Muncul pesan "Database masih kosong". Klik **Import file .json** dan pilih `data/data-awal.json` dari folder ini.
3. Selesai. Pasangan cukup login dengan akunnya, dan data langsung sama di kedua perangkat (real-time).

File `data-awal.json` sengaja tidak diunggah ke GitHub karena repo publik bisa dilihat orang lain.

## 6. Pasang di layar HP

Buka alamat aplikasi di Chrome (Android) atau Safari (iPhone) → menu **Add to Home Screen / Tambahkan ke Layar Utama**. Aplikasi akan tampil seperti app biasa.

---

## Cara pakai singkat

- **Halaman pembuka**: tampil saat aplikasi dibuka (dengan animasi pixel pasangan di bawah gapura bunga), klik **Buka Planner** untuk masuk.
- **Beranda**: kartu pixel ala virtual pet berisi foto CPP & CPW (klik foto untuk mengganti; hati = persiapan, baterai = tabungan), hitung mundur, papan **ular tangga pixel** (pion maju sendiri tiap hari sampai kotak 100 = hari H; bendera = langkah timeline), ringkasan, dan timeline langkah persiapan sampai 10 April (bisa dicentang, ditambah, diubah).
- **Tabungan**: catat uang saat ini, setoran & penarikan, isi estimasi uang masuk per bulan untuk melihat perkiraan dana di hari H. Saat mencatat pembayaran vendor, centang "Ambil dari tabungan" agar saldo ikut berkurang.
- **Moodboard**: palet warna, bunga, foto prewedding, dan semua halaman moodboard (klik untuk memperbesar).
- **Anggaran**: tabel RAB. Tombol **Tambah item** / **Kategori baru**, tombol **Bayar** untuk DP/pelunasan, sisa bayar dihitung otomatis. Kartu **Jumlah pax**: ubah jumlah pax, item catering yang dicentang "Ikut pax" otomatis ikut berubah; qty item lain bisa diisi langsung. Klik baris untuk detail paket.
- **Tamu & RSVP**: klik status konfirmasi untuk mengganti (Belum → Hadir → Tidak Hadir). RSVP dari undangan digital muncul di atas daftar; klik **Terapkan** untuk memperbarui data tamu.
- **Persiapan**: checklist A–J. Bagian administrasi punya centang CPP & CPW terpisah.
- **Seserahan & Mahar**: tambah kategori & barang sendiri, ganti nama kategori, centang yang sudah dibeli, isi link & harga riil.
- **Wishlist Rumah**: daftar barang yang ingin dibeli setelah menikah, per ruangan, dengan prioritas, perkiraan harga & link. Tidak dihitung ke anggaran pernikahan. Centang **Tampilkan di daftar kado undangan** agar barang muncul di undangan digital; tamu bisa memilih satu barang (tidak bisa dobel).
- **Amplop & Kado**: catat amplop, transfer, dan kado; centang yang sudah diberi ucapan terima kasih, tombol WA berisi ucapan siap kirim. Kado yang dipilih tamu lewat undangan muncul di sini.
- **Undangan**: isi nama orang tua, rekening amplop digital (opsional), jam, alamat, link Google Maps. Setiap tamu dapat link pribadi (`undangan.html?to=Nama`) dan tombol WhatsApp berisi pesan siap kirim.
- **Pengaturan**: ganti tanggal/nama, batas anggaran, jumlah pax, tanggal mulai papan ular tangga, dan **unduh cadangan (.json)** secara berkala.

## Update aturan database (daftar kado)
Setiap kali file `firestore.rules` berubah, buka Firebase Console → Firestore Database → Rules, hapus semua, tempel isi file terbaru, lalu **Publish**. Tanpa ini, tamu tidak bisa memilih kado di undangan.

## Batas gratis Firebase (Spark)
50.000 baca & 20.000 tulis per hari, 1 GB penyimpanan. Untuk 2 orang + RSVP ratusan tamu, pemakaian kalian jauh di bawah batas ini.

## Masalah umum
- **"Akses ditolak"**: email di `firestore.rules` atau `allowedEmails` tidak sama persis dengan akun login.
- **Login gagal di GitHub Pages**: domain `USERNAME.github.io` belum ditambahkan di Authorized domains (langkah 4.6).
- **Undangan bilang "belum tersedia"**: buka halaman Undangan di aplikasi dan klik **Simpan undangan** sekali.
