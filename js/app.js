import { createStore, isCloud } from "./store.js";
import { allowedEmails } from "./config.js";
import { icon, ICON_NAMES } from "./icons.js";
import { startCover, setBoard, mountBoard, replayBoard, pixelatePhoto, pixelFace, pixelHeart, petBurst, pixelCats } from "./pixel.js";

const COLS = ["config", "public", "guests", "budget", "tasks", "seserahan", "mahar", "vendors", "rundown", "rsvp", "timeline", "tabungan", "wishlist", "kegiatan", "amplop", "klaim"];
const DATA_COLS = COLS; // yang ikut backup
const S = { data: Object.fromEntries(COLS.map((c) => [c, []])), loaded: new Set(), ui: {} };
let store, unsubs = [];

// ---------------- helpers ----------------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const rp = (n) => "Rp" + Math.round(num(n)).toLocaleString("id-ID");
const rpShort = (n) => { n = num(n); if (Math.abs(n) >= 1e6) return "Rp" + (n / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " jt"; if (Math.abs(n) >= 1e3) return "Rp" + Math.round(n / 1e3) + " rb"; return rp(n); };
const sum = (arr, f) => arr.reduce((a, x) => a + num(f(x)), 0);
// Harga efektif seserahan: harga riil kalau sudah diisi, kalau belum pakai budget
const sesPrice = (x) => num(x.actual) || num(x.budget);
const pct = (a, b) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);
const byUrut = (a, b) => num(a.urut) - num(b.urut) || String(a.nama || "").localeCompare(b.nama || "");
const settings = () => S.data.config.find((d) => d.id === "settings") || {};
const invite = () => S.data.public.find((d) => d.id === "invite") || {};
const fmtDate = (iso, opt = { weekday: "long", day: "numeric", month: "long", year: "numeric" }) => {
  if (!iso) return "-"; const d = new Date(iso + "T00:00:00"); return isNaN(d) ? iso : d.toLocaleDateString("id-ID", opt);
};
const waNumber = (hp) => { let d = String(hp || "").replace(/\D/g, ""); if (d.startsWith("0")) d = "62" + d.slice(1); return d; };
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2200); }
async function save(col, obj, msg = "Tersimpan") { try { await store.put(col, obj); toast(msg); } catch (e) { console.error(e); toast("Gagal menyimpan: " + (e.code || e.message)); } }
async function del(col, id) { try { await store.remove(col, id); toast("Dihapus"); } catch (e) { toast("Gagal menghapus: " + (e.code || e.message)); } }
const nextUrut = (col) => Math.max(0, ...S.data[col].map((x) => num(x.urut))) + 1;
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast("Link disalin"); }
  catch { openInfo("Salin link", `<textarea class="field full" readonly onclick="this.select()">${esc(text)}</textarea>`); }
}

const ORNAMENT = `<svg class="ornament" width="150" height="26" viewBox="0 0 150 26" fill="none" aria-hidden="true"><path d="M2 13h52M96 13h52" stroke="currentColor" stroke-width="1"/><circle cx="66" cy="13" r="8" stroke="currentColor" stroke-width="1.4"/><circle cx="84" cy="13" r="8" stroke="currentColor" stroke-width="1.4"/><path d="M75 3l2 3-2 3-2-3z" fill="currentColor"/><circle cx="54" cy="13" r="1.6" fill="currentColor"/><circle cx="96" cy="13" r="1.6" fill="currentColor"/></svg>`;

// ---------------- dialog / form ----------------
const dlg = () => $("#dlg");
function openInfo(title, html) {
  dlg().innerHTML = `<div class="dlg-head"><h3>${esc(title)}</h3><button type="button" data-close aria-label="Tutup">×</button></div><div class="dlg-body">${html}</div><div class="dlg-foot"><button class="btn outline" data-close type="button">Tutup</button></div>`;
  dlg().querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => dlg().close()));
  dlg().showModal();
}
function fieldHtml(f, v) {
  const id = "f_" + f.k, cls = f.full ? "full" : "";
  if (f.type === "checkbox") return `<div class="${cls} check-inline"><input type="checkbox" class="box" id="${id}" ${v ? "checked" : ""}><label for="${id}">${esc(f.label)}</label></div>`;
  let input;
  if (f.type === "select") {
    const opts = f.options.includes(v ?? "") || v == null ? f.options : [v, ...f.options];
    input = `<select class="field" id="${id}">${opts.map((o) => `<option ${o === (v ?? f.options[0]) ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
  } else if (f.type === "textarea") input = `<textarea class="field" id="${id}" placeholder="${esc(f.ph || "")}">${esc(v ?? "")}</textarea>`;
  else if (f.type === "datalist") input = `<input class="field" id="${id}" list="${id}_l" value="${esc(v ?? "")}"><datalist id="${id}_l">${f.options.map((o) => `<option value="${esc(o)}">`).join("")}</datalist>`;
  else if (f.type === "payments") {
    const rows = (v || []).map((p) => payRow(p)).join("");
    return `<div class="full"><label class="lbl">Riwayat pembayaran</label><div id="payRows" class="stack" style="gap:8px">${rows}</div><button type="button" class="btn outline small" id="addPay" style="margin-top:8px">+ Tambah pembayaran</button></div>`;
  } else input = `<input class="field" id="${id}" type="${f.type || "text"}" ${f.type === "number" ? 'inputmode="decimal" step="any"' : ""} value="${esc(v ?? "")}" placeholder="${esc(f.ph || "")}">`;
  return `<div class="${cls}"><label class="lbl" for="${id}">${esc(f.label)}</label>${input}${f.hint ? `<small style="color:var(--muted);font-size:12px">${esc(f.hint)}</small>` : ""}</div>`;
}
const payRow = (p = {}) => `<div class="pay-row" style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:6px;align-items:center"><input class="field" type="date" value="${esc(p.tgl || "")}" data-p="tgl" aria-label="Tanggal"><input class="field" type="number" inputmode="decimal" value="${esc(p.jumlah ?? "")}" placeholder="Jumlah" data-p="jumlah" aria-label="Jumlah"><input class="field" value="${esc(p.ket || "")}" placeholder="Ket. (DP, pelunasan)" data-p="ket" aria-label="Keterangan"><button type="button" class="icon-btn" data-delpay aria-label="Hapus baris">✕</button></div>`;

function openForm({ title, fields, data = {}, onSave, onDelete, saveLabel = "Simpan" }) {
  const d = dlg();
  d.innerHTML = `<form method="dialog" id="frm"><div class="dlg-head"><h3>${esc(title)}</h3><button type="button" data-close aria-label="Tutup">×</button></div>
  <div class="dlg-body">${fields.map((f) => fieldHtml(f, data[f.k])).join("")}</div>
  <div class="dlg-foot">${onDelete ? `<button type="button" class="btn danger small left" id="delBtn">Hapus</button>` : ""}<button type="button" class="btn outline" data-close>Batal</button><button class="btn" type="submit">${esc(saveLabel)}</button></div></form>`;
  d.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => d.close()));
  const addPay = $("#addPay", d);
  if (addPay) {
    addPay.onclick = () => $("#payRows", d).insertAdjacentHTML("beforeend", payRow({ tgl: new Date().toISOString().slice(0, 10) }));
    $("#payRows", d).onclick = (e) => { if (e.target.closest("[data-delpay]")) e.target.closest(".pay-row").remove(); };
  }
  if (onDelete) {
    const b = $("#delBtn", d);
    b.onclick = async () => {
      if (!b.classList.contains("armed")) { b.classList.add("armed"); b.textContent = "Yakin hapus?"; return; }
      d.close(); await onDelete();
    };
  }
  $("#frm", d).onsubmit = async (e) => {
    e.preventDefault();
    const out = { ...data };
    for (const f of fields) {
      if (f.type === "payments") {
        out[f.k] = $$(".pay-row", d).map((r) => ({ tgl: $('[data-p="tgl"]', r).value, jumlah: num($('[data-p="jumlah"]', r).value), ket: $('[data-p="ket"]', r).value.trim() })).filter((p) => p.jumlah);
        continue;
      }
      const el = $("#f_" + f.k, d);
      out[f.k] = f.type === "checkbox" ? el.checked : f.type === "number" ? num(el.value) : el.value.trim();
    }
    if (fields.some((f) => f.required && !String(out[f.k] || "").trim())) { toast("Lengkapi kolom yang wajib"); return; }
    d.close();
    await onSave(out);
  };
  d.showModal();
  setTimeout(() => { const first = d.querySelector(".dlg-body input:not([type=checkbox]), .dlg-body select"); first && first.focus(); }, 30);
}

// ---------------- navigasi ----------------
const PAL = [["#5c0d16", "#f3d9d6"], ["#a8553a", "#f5e0d4"], ["#2f4a2b", "#e6ebcf"], ["#9b5662", "#f6e0e3"], ["#8a4a1e", "#f5e5c8"], ["#8f6a2c", "#f4e8cd"], ["#7a1a2a", "#f5dadc"], ["#6f7a2a", "#eef0d0"]];
const palVar = (i) => { const [c, soft] = PAL[((i % PAL.length) + PAL.length) % PAL.length]; return `--c:${c};--c-soft:${soft}`; };
// [kunci, label, ikon, warna ikon di header marun, warna aksen halaman]
const NAV = [
  ["beranda", "Beranda", "home", "#f2c46d", "#5c0d16"], ["anggaran", "Anggaran", "wallet", "#e8a07f", "#a8553a"], ["tabungan", "Tabungan", "piggy", "#c6cf6e", "#2f4a2b"],
  ["tamu", "Tamu & RSVP", "guests", "#edc6c4", "#7a1a2a"], ["persiapan", "Persiapan", "check", "#e2b77a", "#8a4a1e"], ["seserahan", "Seserahan & Mahar", "gift", "#e8a9b2", "#9b5662"], ["wishlist", "Wishlist", "heart", "#f2c46d", "#8f6a2c"], ["amplop", "Amplop & Kado", "coin", "#e8a07f", "#a8553a"],
  ["vendor", "Vendor", "store", "#c9a15e", "#8f6a2c"], ["rundown", "Rundown", "clock", "#a9c48a", "#2f4a2b"], ["moodboard", "Moodboard", "palette", "#c6cf6e", "#7a1a2a"],
  ["undangan", "Undangan", "envelope", "#edc6c4", "#7a1a2a"], ["pengaturan", "Pengaturan", "gear", "#d8c7a8", "#8a4a1e"]
];
const TABS = ["beranda", "anggaran", "tamu", "persiapan"];
function renderNav(page) {
  $("#nav").innerHTML = NAV.map(([k, l, ic, nc]) => `<a href="#${k}" class="${k === page ? "active" : ""}" style="--nc:${nc}">${icon(ic, 16)}${esc(l.split(" & ")[0])}</a>`).join("");
  $("#tabbar").innerHTML = TABS.map((k) => { const [, l, ic, , acc] = NAV.find((n) => n[0] === k); return `<a href="#${k}" class="${k === page ? "active" : ""}" style="--nc:${acc}">${icon(ic, 22)}<span>${esc(l.split(" ")[0])}</span></a>`; }).join("") +
    `<button type="button" id="menuBtn" class="${TABS.includes(page) ? "" : "active"}">${icon("menu", 22)}<span>Menu</span></button>`;
}
function openMenu() {
  const page = (location.hash || "#beranda").slice(1), d = $("#menuDlg");
  d.innerHTML = `<div class="dlg-head"><h3>Menu</h3><button type="button" data-close aria-label="Tutup">×</button></div><div class="menu-grid">${NAV.map(([k, l, ic, , acc]) => `<a href="#${k}" class="${k === page ? "active" : ""}" style="--nc2:${acc}">${icon(ic, 24)}${esc(l)}</a>`).join("")}</div>`;
  d.querySelector("[data-close]").onclick = () => d.close();
  d.querySelectorAll("a").forEach((a) => (a.onclick = () => d.close()));
  d.showModal();
}
document.addEventListener("click", (e) => { if (e.target.closest("#menuBtn")) openMenu(); });

// ---------------- render loop ----------------
const PAGES = {};
let renderQueued = false;
function render() {
  if (renderQueued) return; renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    const route = (location.hash || "#beranda").slice(1);
    const page = PAGES[route] ? route : "beranda";
    renderNav(page);
    const st = settings();
    $("#mono").textContent = `${(st.pria || "V")[0]} & ${(st.wanita || "F")[0]}`;
    $("#brandSub").textContent = st.tanggal ? fmtDate(st.tanggal, { day: "numeric", month: "long", year: "numeric" }) : "Wedding Planner";
    if ($("#coverNames") && st.pria) { $("#coverNames").innerHTML = `${esc(st.pria)} <span class="amp">&amp;</span> ${esc(st.wanita)}`; if ($("#coverMono")) $("#coverMono").textContent = (st.pria[0]||"") + "&" + ((st.wanita||"")[0]||""); $("#coverDate").textContent = fmtDate(st.tanggal, { day: "numeric", month: "long", year: "numeric" }); }
    document.title = st.pria ? `${st.pria} & ${st.wanita} Wedding Planner` : "Wedding Planner";
    const act = document.activeElement, actId = act && act.id, sel = act && act.selectionStart;
    const scroll = window.scrollY;
    $("#view").dataset.page = page;
    document.body.dataset.page = page;
    $("#view").innerHTML = PAGES[page]() + `<div class="batik light" aria-hidden="true"></div>`;
    if (actId) { const el = document.getElementById(actId); if (el && el.closest("#view")) { el.focus(); try { el.setSelectionRange(sel, sel); } catch {} } }
    window.scrollTo(0, scroll);
    if (page === "beranda") { mountBoard(); mountPet(); }
  });
}
window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });

// Delegasi aksi: elemen dengan data-act="nama" memanggil ACT[nama](el, event)
const ACT = {};
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (!el || !el.closest("#view")) return;
  const a = e.target.closest("a[href]"); if (a && a !== el && el.contains(a)) return; // biarkan link berjalan
  const fc = e.target.closest("input,select,textarea,label"); if (fc && fc !== el && el.contains(fc)) return; // biarkan kotak centang/isian bekerja
  const fn = ACT[el.dataset.act]; if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener("change", (e) => {
  const el = e.target.closest("[data-change]");
  if (el && ACT[el.dataset.change]) ACT[el.dataset.change](el, e);
});
document.addEventListener("input", (e) => {
  const el = e.target.closest("[data-ui]");
  if (el) { S.ui[el.dataset.ui] = el.value; render(); }
});
const uiSel = (key, options, label) => `<select id="ui_${key}" data-ui="${key}" aria-label="${esc(label)}">${options.map(([v, t]) => `<option value="${esc(v)}" ${S.ui[key] === v || (!S.ui[key] && v === "") ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;

function emptyBanner() {
  const total = ["guests", "budget", "tasks", "seserahan"].reduce((a, c) => a + S.data[c].length, 0);
  if (total) return "";
  return `<div class="banner"><span><b>Database masih kosong.</b> Masukkan data dari file PDF kalian (sudah saya siapkan sebagai <i>data-awal.json</i>) atau mulai dari nol.</span>
  <span style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn small" data-act="loadSeed">Muat data awal</button><button class="btn outline small" data-act="importFile">Import file .json</button></span></div>`;
}
const localBanner = () => (isCloud ? "" : `<div class="banner"><span><b>Mode Lokal.</b> Data hanya tersimpan di browser ini dan belum tersinkron dengan pasangan. Isi <code>js/config.js</code> dengan konfigurasi Firebase agar data sinkron (lihat PANDUAN-SETUP.md).</span></div>`);

// ================= BERANDA =================
PAGES.beranda = () => {
  const st = settings(), inv = invite();
  const g = S.data.guests, b = S.data.budget, t = S.data.tasks;
  const total = sum(b, (x) => x.qty * x.harga), paid = sum(b, (x) => sum(x.pembayaran || [], (p) => p.jumlah));
  const pax = sum(g, (x) => x.jumlah), hadir = sum(g.filter((x) => x.konfirmasi === "Hadir"), (x) => x.jumlah);
  const tDone = t.filter((x) => x.status === "Selesai").length;
  const rsvp = [...S.data.rsvp].sort((a, c) => String(c.createdAt).localeCompare(a.createdAt)).slice(0, 4);
  const tile = (href, ic, bg, fg, k, v, d) => `<a href="#${href}"><span class="bub" style="background:${bg};color:${fg}">${icon(ic, 22)}</span><span style="min-width:0;display:block"><span class="k" style="display:block">${k}</span><span class="v" style="display:block">${v}</span><span style="display:block;font-size:12px;color:var(--muted)">${d}</span></span></a>`;
  return `${localBanner()}${emptyBanner()}
  <section class="home-hero">
    <img class="arch" src="img/foto-1.jpg" alt="Foto prewedding ${esc(st.pria || "")} dan ${esc(st.wanita || "")}">
    <div style="min-width:0">
      <div class="hello">${icon("sparkle", 14)} Menuju hari bahagia</div>
      <h1>${esc(st.pria || "Mempelai")}<span class="amp">&amp;</span>${esc(st.wanita || "Mempelai")}</h1>
      <div class="when">${esc(fmtDate(st.tanggal))}</div>
      <div style="color:var(--muted);margin-top:4px;display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:inherit">${icon("home", 16)}<span>${esc(st.venue || inv.tempat || "-")}</span></div>
      <div class="cd-row" id="cd">${countdownHtml(st.tanggal)}</div>
    </div>
  </section>
  ${petHtml()}
  <div class="quick">
    ${tile("anggaran", "wallet", "var(--maroon)", "var(--paper)", "Sisa bayar", rpShort(total - paid), `${pct(paid, total)}% dari ${rpShort(total)} terbayar`)}
    ${tile("tabungan", "piggy", "var(--maroon-soft)", "var(--maroon)", "Tabungan", rpShort(savingsNow()), S.data.tabungan.length ? "uang terkumpul" : "belum dicatat")}
    ${tile("tamu", "guests", "var(--ok-soft)", "var(--green)", "Tamu", `${pax} orang`, `${g.length} undangan · ${hadir} hadir${num(st.kapasitasCatering) ? ` · target ${num(st.kapasitasCatering)} pax` : ""}`)}
    ${tile("persiapan", "check", "var(--warn-soft)", "var(--teak)", "Persiapan", `${pct(tDone, t.length)}%`, `${tDone} dari ${t.length} selesai`)}
  </div>
  ${boardHtml()}
  <h2 class="section-title">${icon("calendar", 20)} Timeline menuju ${esc(fmtDate(st.tanggal, { day: "numeric", month: "long" }))}</h2>
  ${timelineHtml()}
  ${rsvp.length ? `<h2 class="section-title">${icon("envelope", 20)} RSVP terbaru</h2><div class="card"><ul class="mini-list">${rsvp.map((r) => `<li><span style="min-width:0">${esc(r.nama)}<br><small style="color:var(--muted)">${esc((r.ucapan || "").slice(0, 80))}</small></span>${rsvpPill(r.hadir)}</li>`).join("")}</ul></div>` : ""}`;
};
function countdownHtml(iso) {
  if (!iso) return "";
  let ms = Math.max(0, new Date(iso + "T08:00:00") - new Date());
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
  return `<div class="cd-box"><b>${d}</b><span>Hari</span></div><div class="cd-box"><b>${h}</b><span>Jam</span></div><div class="cd-box"><b>${m}</b><span>Menit</span></div>`;
}
setInterval(() => { const el = $("#cd"); if (el) el.innerHTML = countdownHtml(settings().tanggal); const c = $("#petClock"); if (c) c.textContent = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":"); }, 30000);

// ---------- Kartu virtual pet: foto CPP & CPW versi pixel ----------
const fotoCfg = () => S.data.config.find((d) => d.id === "foto") || {};
const PET_DEF = { cpp: ["img/foto-4.jpg", [0.49, 0.375, 0.2, 0.22]], cpw: ["img/foto-2.jpg", [0.22, 0.1, 0.56, 0.42]] };
function petStats() {
  const st = settings(), t = S.data.tasks, b = S.data.budget;
  const prep = pct(t.filter((x) => x.status === "Selesai").length, t.length);
  const nb = needBreakdown(), saldo = savingsNow(), target = num(st.tabunganTarget) || nb.total;
  const dana = pct(saldo, target);
  const total = sum(b, (x) => x.qty * x.harga), paid = sum(b, (x) => sum(x.pembayaran || [], (p) => p.jumlah));
  const bayar = pct(paid, total);
  const tl = [...S.data.timeline].sort((a, c) => String(a.tgl).localeCompare(c.tgl)).find((x) => !x.done);
  return { prep, dana, bayar, tl };
}
const mood = (v) => (v >= 60 ? "senang" : v >= 25 ? "biasa" : "sedih");
function petHtml() {
  const st = settings(), { prep, dana, bayar, tl } = petStats();
  const hearts = Array.from({ length: 5 }, (_, i) => pixelHeart(Math.max(0, Math.min(1, prep / 20 - i)) >= 1 ? 1 : prep / 20 - i >= 0.5 ? 0.5 : 0, 20)).join("");
  const left = st.tanggal ? Math.max(0, daysBetween(todayIso(), st.tanggal)) : null;
  const now = new Date(), clock = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }).replace(".", ":");
  const handle = "@" + `${st.pria || "cpp"}_${st.wanita || "cpw"}`.toLowerCase().replace(/[^a-z0-9_]/g, "");
  const msgs = [
    dana < 25 ? "Dompet lagi lapar, yuk setor tabungan!" : dana < 60 ? "Tabungan mulai kenyang, lanjutkan!" : "Tabungan kenyang, mantap!",
    tl ? `Misi berikutnya: ${tl.judul}` : "Semua misi timeline beres!",
    prep >= 60 ? "Persiapan lancar, kalian keren!" : `Persiapan ${prep}%, semangat berdua!`,
    left != null ? (left > 0 ? `${left} hari lagi menuju pelaminan` : "Hari H! Selamat menempuh hidup baru!") : ""
  ].filter(Boolean);
  const stat = (k, v) => `<span class="pet-stat">${k} ${pixelFace(mood(v))}<small>${v}%</small></span>`;
  const portrait = (who, name) => `<figure class="pet-char ${who}"><button type="button" class="pet-photo" data-act="petPhoto" data-who="${who}" aria-label="Ganti foto ${who.toUpperCase()}" title="Klik untuk ganti foto"><canvas id="pet_${who}" class="px" aria-hidden="true"></canvas></button><figcaption class="px-font">${who.toUpperCase()}<b>${esc(name)}</b></figcaption></figure>`;
  return `<section class="pet" aria-label="Kartu pixel ${esc(st.pria || "CPP")} dan ${esc(st.wanita || "CPW")}">
    <div class="pet-bar px-font"><span class="pet-hearts" title="Persiapan ${prep}%">${hearts}</span><span class="pet-batt" title="Tabungan ${dana}% dari target"><i style="--v:${Math.max(4, dana)}%"></i>${dana}%</span><span id="petClock">${esc(clock)}</span></div>
    <div class="pet-bar2 px-font"><span>LEVEL: ${left != null ? (left > 0 ? "H-" + left : "HARI H") : "-"}</span><span>DATE: ${esc(now.toLocaleDateString("id-ID", { day: "numeric", month: "short" }).toUpperCase())}</span><span class="hide-sm">${esc(handle)}</span></div>
    <div class="pet-screen" id="petScreen">
      <div class="pet-bg" aria-hidden="true"></div>
      <div class="pet-chars">${portrait("cpp", st.pria || "Vaditya")}<span class="pet-mid" aria-hidden="true">${pixelHeart(1, 30)}</span>${portrait("cpw", st.wanita || "Firda")}</div>
      <div class="pet-msg px-font" id="petMsg" data-msgs="${esc(JSON.stringify(msgs))}">${esc(msgs[0])}</div>
    </div>
    <div class="pet-stats px-font">${stat("PERSIAPAN", prep)}${stat("DANA", dana)}${stat("BAYAR", bayar)}</div>
    <div class="pet-btns px-font"><a href="#persiapan">TUGAS</a><a href="#tabungan">DANA</a><button type="button" class="love" data-act="petLove">LOVE</button><button type="button" data-act="petGame">MAIN</button></div>
    <p class="pet-note">Klik foto untuk mengganti foto CPP atau CPW.</p>
  </section>`;
}
let petMsgTimer;
function mountPet() {
  const f = fotoCfg();
  ["cpp", "cpw"].forEach((w) => { const cv = document.getElementById("pet_" + w); if (!cv) return; const src = f[w] || PET_DEF[w][0]; pixelatePhoto(cv, src, f[w] ? [0, 0, 1, 1] : PET_DEF[w][1], 40, 50); });
  clearInterval(petMsgTimer); let i = 0;
  petMsgTimer = setInterval(() => { const el = document.getElementById("petMsg"); if (!el) return clearInterval(petMsgTimer); const m = JSON.parse(el.dataset.msgs || "[]"); if (!m.length) return; i = (i + 1) % m.length; el.textContent = m[i]; }, 4000);
}
ACT.petLove = () => petBurst(document.getElementById("petScreen"));
ACT.petGame = () => { const b = document.getElementById("ularTangga"); if (b) { b.scrollIntoView({ behavior: "smooth", block: "center" }); replayBoard(); mountBoard(); } };
ACT.petPhoto = (el) => {
  const who = el.dataset.who, has = !!fotoCfg()[who];
  openInfo(`Foto ${who.toUpperCase()}`, `<p style="margin:0 0 10px;font-size:14px">Pilih foto ${who === "cpp" ? "calon pengantin pria" : "calon pengantin wanita"}. Foto close-up wajah paling bagus. Foto dikecilkan otomatis lalu ditampilkan versi pixel.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="button" id="petPick">Pilih foto</button>${has ? `<button class="btn outline" type="button" id="petReset">Pakai foto bawaan</button>` : ""}</div>`);
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
  $("#petPick").onclick = () => inp.click();
  inp.onchange = async () => {
    const file = inp.files[0]; if (!file) return;
    try { const data = await shrinkPhoto(file); dlg().close(); await save("config", { ...fotoCfg(), id: "foto", [who]: data }, "Foto diganti"); }
    catch (e) { toast("Foto tidak bisa dibaca"); }
  };
  const r = $("#petReset"); if (r) r.onclick = async () => { dlg().close(); const o = { ...fotoCfg(), id: "foto" }; delete o[who]; await save("config", o, "Kembali ke foto bawaan"); };
};
// kecilkan foto ke 120×150 (potong tengah, sedikit ke atas agar wajah masuk), simpan sebagai JPEG kecil
function shrinkPhoto(file) {
  return new Promise((ok, no) => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const W = 120, H = 150, c = document.createElement("canvas"); c.width = W; c.height = H;
      const r = W / H; let sw = im.width, sh = im.height, sx = 0, sy = 0;
      if (sw / sh > r) { sw = sh * r; sx = (im.width - sw) / 2; } else { sh = sw / r; sy = (im.height - sh) * 0.25; }
      c.getContext("2d").drawImage(im, sx, sy, sw, sh, 0, 0, W, H);
      URL.revokeObjectURL(url); ok(c.toDataURL("image/jpeg", 0.85));
    };
    im.onerror = no; im.src = url;
  });
}

// ---------- Ular tangga menuju hari H ----------
const isoTime = (iso) => new Date(iso + "T00:00:00").getTime();
function boardStart() {
  const st = settings();
  if (st.mulai) return st.mulai;
  const tl = S.data.timeline.map((x) => x.tgl).filter(Boolean).sort()[0];
  return tl && tl < todayIso() ? tl : "2026-11-01";
}
function boardHtml() {
  const st = settings(); if (!st.tanggal) return "";
  const start = boardStart(), today = todayIso();
  const items = [...S.data.timeline].filter((x) => x.tgl).sort((a, b) => String(a.tgl).localeCompare(b.tgl));
  const next = items.find((x) => !x.done);
  const sq = setBoard({ start: isoTime(start), end: isoTime(st.tanggal), today: isoTime(today), milestones: items.map((x) => ({ date: isoTime(x.tgl), done: !!x.done, next: x === next })) });
  const left = Math.max(0, daysBetween(today, st.tanggal)), total = Math.max(1, daysBetween(start, st.tanggal));
  return `<h2 class="section-title">${icon("sparkle", 20)} Perjalanan menuju hari H</h2>
  <div class="card ut-card"><div class="ut-board"><canvas id="ularTangga" class="px" role="img" aria-label="Papan ular tangga: kalian di kotak ${sq} dari 100, ${left} hari lagi menuju hari H"></canvas></div>
    <div class="ut-side">
      <div class="ut-pos"><span class="px-font">KOTAK</span><b class="px-font" id="utPos">${sq}</b><span class="ut-of">dari 100</span></div>
      <p>${left > 0 ? `Tinggal <b>${left} hari</b> lagi. Pion kalian maju sendiri setiap hari dari ${esc(fmtDate(start, { day: "numeric", month: "short", year: "numeric" }))} sampai kotak 100, hari H.` : `<b>Hari H sudah tiba!</b> Selamat menempuh hidup baru.`}</p>
      <div class="bar" style="margin:4px 0 12px"><i style="width:${pct(total - left, total)}%"></i></div>
      <ul class="ut-legend"><li><i class="lg-flag done"></i>Langkah timeline selesai</li><li><i class="lg-flag"></i>Langkah belum selesai${next ? ` (berkedip = berikutnya: ${esc(next.judul)})` : ""}</li><li><i class="lg-heart"></i>Kotak 100: hari pernikahan</li></ul>
      <button class="btn outline small" data-act="replayBoard">${icon("sparkle", 14)} Main lagi dari kotak 1</button>
      <small style="display:block;color:var(--muted);margin-top:8px">Tangga dan ular hanya hiasan. Tanggal mulai bisa diubah di Pengaturan.</small>
    </div></div>`;
}
ACT.replayBoard = () => { replayBoard(); mountBoard(); };

// ---------- Timeline ----------
const daysBetween = (a, b) => Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 864e5);
const todayIso = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
function timelineHtml() {
  const st = settings();
  const items = [...S.data.timeline].sort((a, b) => String(a.tgl).localeCompare(b.tgl));
  if (!items.length) return `<div class="card empty"><span style="color:var(--gold)">${icon("calendar", 40)}</span><p>Belum ada timeline. Isi dengan contoh langkah persiapan sampai hari H, lalu sesuaikan.</p><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn small" data-act="seedTl">Isi timeline contoh</button><button class="btn outline small" data-act="addTl">+ Tambah langkah</button></div></div>`;
  const today = todayIso(), next = items.find((x) => !x.done);
  const todayLi = `<li class="today"><span class="dot"></span><span class="lbl2">Hari ini · ${esc(fmtDate(today, { day: "numeric", month: "short" }))}</span></li>`;
  let html = "", last = "", placed = false, mi = -1;
  items.forEach((x, i) => {
    const m = String(x.tgl).slice(0, 7);
    if (!placed && x.tgl > today && today.slice(0, 7) < m) { html += todayLi; placed = true; }
    if (m !== last) { mi++; html += `<li class="tl-month" style="display:block;${palVar(mi)}">${esc(fmtDate(m + "-01", { month: "long", year: "numeric" }))}</li>`; last = m; }
    if (!placed && x.tgl > today) { html += todayLi; placed = true; }
    const big = i === items.length - 1;
    const h = st.tanggal ? daysBetween(x.tgl, st.tanggal) : null;
    html += `<li class="${x.done ? "done" : ""} ${x === next ? "next" : ""} ${big ? "big" : ""}" style="${palVar(mi)}">
      <span class="dot">${icon(x.ikon || "sparkle", 20)}</span>
      <div style="min-width:0;padding-top:3px"><div class="when">${esc(fmtDate(x.tgl, { day: "numeric", month: "short" }))}${h != null ? (h > 0 ? ` · H-${h}` : h === 0 ? " · Hari H" : "") : ""}${x === next ? ` · <span style="color:var(--rose)">berikutnya</span>` : ""}</div><div class="what">${esc(x.judul)}</div>${x.ket ? `<div class="desc">${esc(x.ket)}</div>` : ""}</div>
      <div class="actions"><input type="checkbox" class="box" id="tl_${x.id}" data-change="toggleTl" data-id="${x.id}" ${x.done ? "checked" : ""} aria-label="Selesai"><button class="icon-btn" data-act="editTl" data-id="${x.id}" aria-label="Ubah">${icon("edit", 16)}</button></div></li>`;
  });
  if (!placed) html += todayLi;
  const done = items.filter((x) => x.done).length;
  return `<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px"><span style="color:var(--muted);font-size:13px">${done} dari ${items.length} langkah selesai</span><button class="btn outline small" data-act="addTl">${icon("plus", 14)} Tambah langkah</button></div><ul class="tl">${html}</ul></div>`;
}
const TL_FIELDS = [
  { k: "judul", label: "Langkah", required: true, full: true }, { k: "tgl", label: "Tanggal target", type: "date" },
  { k: "ikon", label: "Ikon", type: "select", options: ["sparkle", "ring", "heart", "flower", "calendar", "doc", "envelope", "gift", "wallet", "piggy", "people", "dress", "camera", "store", "clock", "palette", "check"] },
  { k: "ket", label: "Keterangan", type: "textarea", full: true }, { k: "done", label: "Sudah selesai", type: "checkbox", full: true }
];
ACT.addTl = () => openForm({ title: "Langkah timeline", fields: TL_FIELDS, data: { tgl: todayIso(), ikon: "sparkle" }, onSave: (o) => save("timeline", o) });
ACT.editTl = (el) => { const x = S.data.timeline.find((d) => d.id === el.dataset.id); openForm({ title: "Ubah langkah", fields: TL_FIELDS, data: x, onSave: (o) => save("timeline", o), onDelete: () => del("timeline", x.id) }); };
ACT.toggleTl = (el) => { const x = S.data.timeline.find((d) => d.id === el.dataset.id); save("timeline", { ...x, done: el.checked }, el.checked ? "Langkah selesai ✓" : "Ditandai belum"); };
ACT.seedTl = () => loadSeedPart(["timeline"]);
async function loadSeedPart(cols) {
  try {
    const r = await fetch("data/data-awal.json", { cache: "no-store" }); if (!r.ok) throw 0;
    const j = await r.json(); for (const c of cols) await store.bulk(c, j.collections[c] || []);
    toast("Contoh dimuat");
  } catch { toast("File data-awal.json tidak ditemukan"); }
}
const statusPill = (s) => `<span class="pill ${s === "Selesai" ? "ok" : s === "Proses" ? "warn" : ""}">${esc(s || "Belum")}</span>`;
const rsvpPill = (h) => h === "ya" ? `<span class="pill ok">Hadir</span>` : h === "tidak" ? `<span class="pill no">Tidak hadir</span>` : `<span class="pill warn">Ragu</span>`;

// ================= ANGGARAN =================
const BUDGET_FIELDS = (cats) => [
  { k: "nama", label: "Nama item", required: true, full: true },
  { k: "kategori", label: "Kategori", type: "datalist", options: cats },
  { k: "vendor", label: "Vendor" },
  { k: "grup", label: "Gabung ke baris (opsional)", type: "datalist", options: [...new Set(["Catering", ...S.data.budget.map((x) => x.grup).filter(Boolean)])], hint: "Item dengan nama grup sama tampil sebagai satu baris total yang bisa dirinci" },
  { k: "qty", label: "Qty", type: "number" },
  { k: "harga", label: "Harga satuan (Rp)", type: "number" },
  { k: "ikutPax", label: "Qty mengikuti jumlah pax (otomatis berubah saat jumlah pax diganti)", type: "checkbox", full: true },
  { k: "detail", label: "Detail / isi paket", type: "textarea", full: true },
  { k: "catatan", label: "Catatan", full: true },
  { k: "pembayaran", type: "payments" }
];
const budgetCats = () => [...new Set(["WO & Paket", "Venue", "Catering", "Dekorasi", "Dokumentasi", "Rias & Busana", "Undangan & Souvenir", "Administrasi", "Lainnya", ...S.data.budget.map((x) => x.kategori).filter(Boolean)])];
PAGES.anggaran = () => {
  const b = [...S.data.budget].sort(byUrut), st = settings();
  const total = sum(b, (x) => x.qty * x.harga), paid = sum(b, (x) => sum(x.pembayaran || [], (p) => p.jumlah));
  const sesB = sum(S.data.seserahan, sesPrice), mahar = sum(S.data.mahar, (x) => x.harga);
  const grand = total + sesB + mahar, target = num(st.targetBudget);
  const cats = {}; b.forEach((x) => { const c = x.kategori || "Lainnya"; cats[c] = cats[c] || { t: 0, p: 0 }; cats[c].t += x.qty * x.harga; cats[c].p += sum(x.pembayaran || [], (p) => p.jumlah); });
  const maxCat = Math.max(1, ...Object.values(cats).map((c) => c.t));
  const f = S.ui.bCat || "", q = (S.ui.bQ || "").toLowerCase();
  const list = b.filter((x) => (!f || (x.kategori || "Lainnya") === f) && (!q || `${x.nama} ${x.vendor} ${x.detail}`.toLowerCase().includes(q)));
  return `<div class="page-head"><div><h1 class="page-title"><span class="cap">A</span>nggaran</h1><p class="page-sub">RAB pernikahan, pembayaran DP, dan sisa yang harus dilunasi.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn outline" data-act="addBudget" data-newcat="1">${icon("plus", 14)} Kategori baru</button><button class="btn" data-act="addBudget">${icon("plus", 14)} Tambah item</button></div></div>
  <div class="grid c4">
    <div class="card stat"><div class="k">Total RAB</div><div class="v">${rp(total)}</div><div class="d">${b.length} item</div></div>
    <div class="card stat"><div class="k">Sudah dibayar</div><div class="v">${rp(paid)}</div><div class="bar" style="margin-top:8px"><i style="width:${pct(paid, total)}%"></i></div></div>
    <div class="card stat"><div class="k">Sisa bayar</div><div class="v">${rp(total - paid)}</div><div class="d">${pct(paid, total)}% terbayar</div></div>
    <div class="card stat"><div class="k">Total kebutuhan</div><div class="v">${rp(grand)}</div><div class="d">RAB + seserahan ${rpShort(sesB)} + mahar ${rpShort(mahar)}${target ? ` · target ${rpShort(target)}` : ""}</div>${target ? `<div class="bar ${grand > target ? "over" : ""}" style="margin-top:8px"><i style="width:${pct(grand, target)}%"></i></div>` : ""}</div>
  </div>
  ${paxCard()}
  <h2 class="section-title">Per kategori</h2>
  <div class="card"><div class="stack" style="gap:10px">${Object.entries(cats).sort((a, c) => c[1].t - a[1].t).map(([c, v], ci) => `<div style="${palVar(ci)}"><div style="display:flex;justify-content:space-between;gap:10px;font-size:13.5px;align-items:center"><span style="min-width:0;overflow-wrap:anywhere">${esc(c)}</span><span class="num" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">${rp(v.t)} <small style="color:var(--muted)">· dibayar ${rpShort(v.p)}</small><button class="icon-btn" data-act="addBudget" data-cat="${esc(c)}" aria-label="Tambah item di ${esc(c)}" title="Tambah item di kategori ini">${icon("plus", 15)}</button></span></div><div class="bar" style="margin-top:4px;background:var(--c-soft)"><i style="width:${(v.t / maxCat) * 100}%;background:var(--c)"></i></div></div>`).join("") || `<p class="empty">Belum ada item</p>`}</div></div>
  <h2 class="section-title">Daftar item</h2>
  <div class="toolbar"><input class="grow" id="ui_bQ" data-ui="bQ" placeholder="Cari item, vendor, isi paket…" value="${esc(S.ui.bQ || "")}">${uiSel("bCat", [["", "Semua kategori"], ...Object.keys(cats).map((c) => [c, c])], "Filter kategori")}</div>
  ${budgetTable(list)}`;
};
// ---------- Jumlah pax ----------
const paxNow = () => num(settings().kapasitasCatering);
const paxLinked = (x) => (x.ikutPax != null ? !!x.ikutPax : paxNow() > 0 && num(x.qty) === paxNow() && (grpOf(x) === "Catering" || x.kategori === "Catering"));
const paxItems = () => [...S.data.budget].filter((x) => x.ikutPax || grpOf(x) === "Catering" || x.kategori === "Catering").sort(byUrut);
function paxCard() {
  const pax = paxNow(), items = paxItems(), g = S.data.guests;
  const est = sum(g, (x) => x.jumlah), hadir = sum(g.filter((x) => x.konfirmasi === "Hadir"), (x) => x.jumlah);
  const tot = sum(items, (x) => x.qty * x.harga);
  return `<h2 class="section-title">${icon("people", 20)} Jumlah pax</h2>
  <div class="card pax-card">
    <div class="pax-top">
      <div><label class="lbl" for="paxInput">Jumlah pax (porsi / target tamu)</label>
        <div class="pax-ctrl"><button type="button" class="btn outline small" data-act="paxStep" data-d="-50">−50</button><button type="button" class="btn outline small" data-act="paxStep" data-d="-10">−10</button>
        <input class="field" id="paxInput" type="number" inputmode="numeric" min="0" step="1" value="${pax || ""}" placeholder="mis. 400" data-change="setPax">
        <button type="button" class="btn outline small" data-act="paxStep" data-d="10">+10</button><button type="button" class="btn outline small" data-act="paxStep" data-d="50">+50</button></div>
        <small class="pax-hint">Dari daftar tamu: <b>${est}</b> orang (${hadir} konfirmasi hadir). ${est && est !== pax ? `<button type="button" class="linkish" data-act="paxFromGuests" data-v="${est}">Pakai ${est}</button>` : ""}</small></div>
      <div class="pax-sum"><span class="t-label">Total catering</span><b class="num">${rp(tot)}</b><small>${pax ? `≈ ${rp(tot / pax)} per pax` : ""}</small></div>
    </div>
    ${items.length ? `<div class="table-wrap" style="margin-top:12px"><table class="pax-table"><thead><tr><th>Item</th><th class="num">Qty / porsi</th><th>Ikut pax</th><th class="num">Harga</th><th class="num">Subtotal</th></tr></thead><tbody>
    ${items.map((x) => `<tr><td>${esc(String(x.nama).replace(/^Catering\s*[–-]\s*/, ""))}</td><td class="num"><input class="field qty-in" type="number" inputmode="numeric" min="0" value="${num(x.qty)}" data-change="setQty" data-id="${x.id}" aria-label="Qty ${esc(x.nama)}" ${paxLinked(x) ? "disabled" : ""}></td><td><input type="checkbox" class="box" data-change="togglePax" data-id="${x.id}" ${paxLinked(x) ? "checked" : ""} aria-label="Ikut jumlah pax"></td><td class="num">${rp(x.harga)}</td><td class="num"><b>${rp(x.qty * x.harga)}</b></td></tr>`).join("")}
    </tbody></table></div><small class="pax-hint">Centang <b>Ikut pax</b> agar qty item sama dengan jumlah pax. Yang tidak dicentang (mis. stall 250 porsi) bisa diisi sendiri di kolom qty.</small>` : `<p class="pax-hint">Belum ada item catering. Item anggaran dengan kategori Catering, atau yang dicentang “Qty mengikuti jumlah pax”, akan muncul di sini.</p>`}
  </div>`;
}
async function applyPax(v) {
  v = Math.max(0, Math.round(num(v)));
  const linked = paxItems().filter(paxLinked);
  await save("config", { ...settings(), id: "settings", kapasitasCatering: v }, `Jumlah pax: ${v}`);
  if (linked.length) await store.bulk("budget", linked.map((x) => ({ ...x, qty: v, ikutPax: true, updatedAt: new Date().toISOString() })));
}
ACT.setPax = (el) => applyPax(el.value);
ACT.paxStep = (el) => applyPax(paxNow() + num(el.dataset.d));
ACT.paxFromGuests = (el) => applyPax(el.dataset.v);
ACT.setQty = (el) => { const x = S.data.budget.find((d) => d.id === el.dataset.id); save("budget", { ...x, qty: Math.max(0, num(el.value)), ikutPax: false }, "Qty disimpan"); };
ACT.togglePax = (el) => { const x = S.data.budget.find((d) => d.id === el.dataset.id); save("budget", { ...x, ikutPax: el.checked, ...(el.checked && paxNow() ? { qty: paxNow() } : {}) }, el.checked ? "Item mengikuti jumlah pax" : "Item tidak lagi mengikuti pax"); };

const grpOf = (x) => x.grup || (/^Catering\s*[–-]/.test(x.nama || "") ? "Catering" : "");
function budgetTable(list) {
  if (!list.length) return `<div class="empty card"><span class="script">Kosong</span>Tidak ada item yang cocok.</div>`;
  const paidOf = (x) => sum(x.pembayaran || [], (p) => p.jumlah);
  let tt = 0, tp = 0, no = 0;
  const row = (x, child) => {
    const tot = x.qty * x.harga, paid = paidOf(x), sisa = tot - paid, pkg = !tot, open = S.ui.openB === x.id;
    const g = grpOf(x), name = child && g ? String(x.nama).replace(new RegExp("^" + g.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*[–-]\\s*"), "") : x.nama;
    const detail = `${esc(x.detail || "")}${x.catatan ? `<div style="margin-top:6px;color:var(--rose)">${esc(x.catatan)}</div>` : ""}${(x.pembayaran || []).length ? `<div style="margin-top:6px"><b>Pembayaran:</b><br>${x.pembayaran.map((p) => `${p.tgl ? esc(fmtDate(p.tgl, { day: "numeric", month: "short", year: "numeric" })) + " · " : ""}${rp(p.jumlah)}${p.ket ? " (" + esc(p.ket) + ")" : ""}`).join("<br>")}</div>` : ""}`;
    return `<tr class="clickable ${child ? "grp-child" : ""}" data-act="toggleB" data-id="${x.id}"><td class="num" style="color:var(--muted)">${child ? "" : ++no}</td>
      <td style="min-width:150px"><b style="font-weight:500">${esc(name)}</b>${child ? "" : `<br><small style="color:var(--muted)">${esc(x.kategori || "Lainnya")}</small>`}</td>
      <td style="min-width:130px">${child ? "" : esc(x.vendor || "-")}</td>
      <td class="num">${num(x.qty).toLocaleString("id-ID")}</td>
      <td class="num">${pkg ? "–" : rp(x.harga)}</td>
      <td class="num">${pkg ? `<span class="pill">Paket WO</span>` : rp(tot)}</td>
      <td class="num">${pkg ? "–" : rp(paid)}</td>
      <td class="num">${pkg ? "–" : sisa <= 0 ? `<span class="pill ok">Lunas</span>` : `<b style="color:var(--acc)">${rp(sisa)}</b>`}</td>
      <td style="white-space:nowrap">${pkg || sisa <= 0 ? "" : `<button class="btn small" data-act="payB" data-id="${x.id}">Bayar</button>`}<button class="icon-btn" data-act="editB" data-id="${x.id}" aria-label="Ubah">${icon("edit", 16)}</button></td></tr>
      ${open ? `<tr><td></td><td colspan="8" style="font-size:13px;white-space:pre-line;background:var(--paper);color:var(--ink)">${detail}</td></tr>` : ""}`;
  };
  const seen = new Set();
  const rows = list.map((x) => {
    const tot = x.qty * x.harga; tt += tot; tp += paidOf(x);
    const g = grpOf(x);
    if (!g) return row(x, false);
    if (seen.has(g)) return "";
    seen.add(g);
    const kids = list.filter((y) => grpOf(y) === g);
    if (kids.length < 2) return row(x, false);
    const gt = sum(kids, (y) => y.qty * y.harga), gp = sum(kids, paidOf), open = S.ui.openG === g;
    const vendors = [...new Set(kids.map((y) => y.vendor).filter(Boolean))].join(", ");
    return `<tr class="clickable grp-parent ${open ? "open-g" : ""}" data-act="toggleG" data-g="${esc(g)}"><td class="num" style="color:var(--muted)">${++no}</td>
      <td style="min-width:150px"><b style="font-weight:600">${esc(g)}</b><br><small style="color:var(--muted)">${kids.length} jenis · ${esc(kids[0].kategori || "")}</small></td>
      <td style="min-width:130px">${esc(vendors || "-")}</td><td class="num">–</td><td class="num">–</td>
      <td class="num"><b>${rp(gt)}</b></td><td class="num">${rp(gp)}</td>
      <td class="num">${gt - gp <= 0 ? `<span class="pill ok">Lunas</span>` : `<b style="color:var(--acc)">${rp(gt - gp)}</b>`}</td>
      <td style="white-space:nowrap"><button class="btn outline small" data-act="toggleG" data-g="${esc(g)}">${open ? "Tutup" : "Rincian"} <span class="chev">▾</span></button></td></tr>
      ${open ? kids.map((y) => row(y, true)).join("") : ""}`;
  }).join("");
  return `<p style="font-size:12.5px;color:var(--muted);margin:-4px 0 8px">Klik baris untuk melihat detail paket & riwayat pembayaran. Baris bergrup (mis. Catering) bisa dibuka lewat tombol Rincian.</p>
  <div class="table-wrap"><table><thead><tr><th class="num">No</th><th>Nama</th><th>Vendor</th><th class="num">Qty</th><th class="num">Harga</th><th class="num">Total</th><th class="num">Dibayar</th><th class="num">Sisa bayar</th><th></th></tr></thead>
  <tbody>${rows}</tbody><tfoot><tr><td></td><td colspan="4">Total</td><td class="num">${rp(tt)}</td><td class="num">${rp(tp)}</td><td class="num">${rp(tt - tp)}</td><td></td></tr></tfoot></table></div>`;
}
ACT.toggleG = (el) => { S.ui.openG = S.ui.openG === el.dataset.g ? null : el.dataset.g; render(); };
function budgetTicket(x) {
  const tot = x.qty * x.harga, paid = sum(x.pembayaran || [], (p) => p.jumlah), sisa = tot - paid;
  const pkg = !tot, lunas = tot > 0 && sisa <= 0;
  const cls = pkg ? "light" : lunas ? "cream" : "";
  const open = S.ui.openB === x.id;
  return `<article class="ticket budget-ticket ${cls} ${open ? "open" : ""}">
    <div class="t-main">
      <div class="t-row"><div style="min-width:0"><div class="t-label">${esc(x.kategori || "Lainnya")}</div><p class="t-title">${esc(x.nama)}</p></div>
      <div class="t-big">${pkg ? "Termasuk paket" : rp(tot)}<br><span class="t-small">${pkg ? "" : `${num(x.qty).toLocaleString("id-ID")} × ${rp(x.harga)}`}</span></div></div>
      ${x.catatan ? `<div class="t-small">${esc(x.catatan)}</div>` : ""}
      <div class="detail">${esc(x.detail || "")}${(x.pembayaran || []).length ? `\n\nPembayaran:\n${x.pembayaran.map((p) => `• ${p.tgl ? fmtDate(p.tgl, { day: "numeric", month: "short", year: "numeric" }) + " — " : ""}${rp(p.jumlah)}${p.ket ? " (" + p.ket + ")" : ""}`).join("\n")}` : ""}</div>
      <div class="t-row" style="align-items:flex-end"><div><div class="t-label">Vendor</div><div>${esc(x.vendor || "-")}</div></div>
      <div class="t-actions"><button data-act="toggleB" data-id="${x.id}">${open ? "Tutup" : "Detail"}</button>${pkg ? "" : `<button data-act="payB" data-id="${x.id}">Catat bayar</button>`}<button data-act="editB" data-id="${x.id}">Ubah</button></div></div>
    </div>
    <div class="t-stub"><span class="t-label">${pkg ? "Paket" : lunas ? "Lunas" : "Sisa bayar"}</span><b class="num" style="font-size:14px">${pkg ? "—" : lunas ? "✓" : rpShort(sisa)}</b><div class="barcode"></div><span class="t-label">${paid ? "DP " + rpShort(paid) : "Belum DP"}</span></div>
  </article>`;
}
ACT.addBudget = (el) => openForm({ title: el.dataset.newcat ? "Kategori & item baru" : "Item anggaran", fields: BUDGET_FIELDS(budgetCats()).map((f) => f.k === "kategori" && el.dataset.newcat ? { ...f, type: "text", label: "Nama kategori baru", required: true } : f), data: { qty: 1, pembayaran: [], kategori: el.dataset.newcat ? "" : el.dataset.cat || "" }, onSave: (o) => save("budget", paxSync({ ...o, urut: nextUrut("budget") })) });
const paxSync = (o) => (o.ikutPax && paxNow() ? { ...o, qty: paxNow() } : o);
ACT.editB = (el) => { const x = S.data.budget.find((d) => d.id === el.dataset.id); openForm({ title: "Ubah item", fields: BUDGET_FIELDS(budgetCats()), data: { ...x, ikutPax: paxLinked(x) }, onSave: (o) => save("budget", paxSync(o)), onDelete: () => del("budget", x.id) }); };
ACT.toggleB = (el) => { S.ui.openB = S.ui.openB === el.dataset.id ? null : el.dataset.id; render(); };
ACT.payB = (el) => {
  const x = S.data.budget.find((d) => d.id === el.dataset.id);
  const sisa = x.qty * x.harga - sum(x.pembayaran || [], (p) => p.jumlah);
  openForm({ title: "Catat pembayaran", saveLabel: "Catat", fields: [
    { k: "jumlah", label: `Jumlah (sisa ${rp(sisa)})`, type: "number", required: true },
    { k: "tgl", label: "Tanggal", type: "date" },
    { k: "ket", label: "Keterangan", full: true, ph: "DP 2, pelunasan, dll." },
    { k: "dariTabungan", label: "Ambil dari tabungan (otomatis tercatat sebagai penarikan)", type: "checkbox", full: true }
  ], data: { tgl: todayIso(), jumlah: sisa, ket: sisa > 0 ? "Pelunasan" : "", dariTabungan: S.data.tabungan.length > 0 },
  onSave: async (p) => {
    await save("budget", { ...x, pembayaran: [...(x.pembayaran || []), { tgl: p.tgl, jumlah: num(p.jumlah), ket: p.ket }] }, "Pembayaran dicatat");
    if (p.dariTabungan) await store.put("tabungan", { jenis: "Penarikan", jumlah: num(p.jumlah), tgl: p.tgl, oleh: "", ket: `Bayar ${x.nama}${p.ket ? " (" + p.ket + ")" : ""}` });
  } });
};

// ================= TAMU =================
const GUEST_FIELDS = (groups) => [
  { k: "nama", label: "Nama", required: true, full: true },
  { k: "pihak", label: "Pihak", type: "select", options: ["Vaditya", "Firda", "Bersama"].map((p) => p === "Vaditya" ? (settings().pria || p) : p === "Firda" ? (settings().wanita || p) : p) },
  { k: "grup", label: "Grup / keluarga", type: "datalist", options: groups },
  { k: "asal", label: "Asal kota" },
  { k: "jumlah", label: "Jumlah orang", type: "number" },
  { k: "undangan", label: "Jenis undangan", type: "select", options: ["", "Online", "Fisik"] },
  { k: "acara", label: "Diundang ke", type: "select", options: ["", "Akad", "Resepsi", "Akad & Resepsi"] },
  { k: "konfirmasi", label: "Konfirmasi", type: "select", options: ["Belum", "Hadir", "Tidak Hadir"] },
  { k: "hp", label: "No. WhatsApp", type: "tel", ph: "08…" },
  { k: "catatan", label: "Catatan", full: true }
];
PAGES.tamu = () => {
  const st = settings();
  const all = S.data.guests;
  const q = (S.ui.gQ || "").toLowerCase(), fp = S.ui.gP || "", fu = S.ui.gU || "", fk = S.ui.gK || "";
  const list = all.filter((x) => (!q || `${x.nama} ${x.grup} ${x.asal}`.toLowerCase().includes(q)) && (!fp || x.pihak === fp) && (!fu || (x.undangan || "-") === fu) && (!fk || (x.konfirmasi || "Belum") === fk));
  const pax = sum(all, (x) => x.jumlah), hadir = sum(all.filter((x) => x.konfirmasi === "Hadir"), (x) => x.jumlah);
  const belum = all.filter((x) => (x.konfirmasi || "Belum") === "Belum").length;
  const fisik = all.filter((x) => x.undangan === "Fisik").length, online = all.filter((x) => x.undangan === "Online").length;
  const cap = num(st.kapasitasCatering);
  const pihaks = [...new Set(all.map((x) => x.pihak).filter(Boolean))];
  // kelompokkan: pihak -> grup
  const groups = {};
  list.forEach((x) => { const k = (x.pihak || "-") + "||" + (x.grup || "Lainnya"); (groups[k] = groups[k] || []).push(x); });
  const rows = Object.entries(groups).sort((a, b) => Math.min(...a[1].map((x) => num(x.urut))) - Math.min(...b[1].map((x) => num(x.urut)))).map(([k, arr]) => {
    const [p, gname] = k.split("||");
    return `<tr class="group"><td colspan="7">${esc(gname)} <small style="opacity:.7;font-weight:500">· ${esc(p)} · ${sum(arr, (x) => x.jumlah)} org</small></td></tr>` +
      arr.sort(byUrut).map((x) => `<tr class="clickable" data-act="editG" data-id="${x.id}"><td>${esc(x.nama)}${x.catatan ? `<br><small style="color:var(--muted)">${esc(x.catatan)}</small>` : ""}</td><td class="hide-sm">${esc(x.asal || "")}</td><td class="num">${num(x.jumlah)}</td><td>${x.undangan ? `<span class="pill ${x.undangan === "Fisik" ? "red" : ""}">${esc(x.undangan)}</span>` : ""}</td><td class="hide-sm">${x.acara ? `<span class="pill ${x.acara === "Akad" ? "warn" : "solid"}">${esc(x.acara)}</span>` : ""}</td><td><button class="pill ${x.konfirmasi === "Hadir" ? "ok" : x.konfirmasi === "Tidak Hadir" ? "no" : ""}" data-act="cycleK" data-id="${x.id}" title="Klik untuk ganti">${esc(x.konfirmasi || "Belum")}</button></td><td>${x.hp ? `<a class="icon-btn" href="https://wa.me/${waNumber(x.hp)}" target="_blank" rel="noopener" aria-label="WhatsApp">WA</a>` : ""}</td></tr>`).join("");
  }).join("");
  const rsvp = [...S.data.rsvp].sort((a, b) => String(b.createdAt).localeCompare(a.createdAt));
  return `<div class="page-head"><div><h1 class="page-title"><span class="cap">T</span>amu &amp; RSVP</h1><p class="page-sub">Daftar undangan kedua pihak. Klik status konfirmasi untuk menggantinya, klik baris untuk mengubah.</p></div><button class="btn" data-act="addG">+ Tambah tamu</button></div>
  <div class="grid c4">
    <div class="card stat"><div class="k">Undangan</div><div class="v">${all.length}</div><div class="d">${fisik} fisik · ${online} online · ${all.length - fisik - online} belum ditentukan</div></div>
    <div class="card stat"><div class="k">Perkiraan tamu</div><div class="v">${pax} <small style="font-size:15px">orang</small></div>${cap ? `<div class="bar ${pax > cap ? "over" : ""}" style="margin-top:8px"><i style="width:${pct(pax, cap)}%"></i></div><div class="d">Target ${cap} pax${pax > cap ? ` · lebih ${pax - cap}` : ` · sisa ${cap - pax}`} · <a href="#anggaran">ubah</a></div>` : ""}</div>
    <div class="card stat"><div class="k">Konfirmasi hadir</div><div class="v">${hadir} <small style="font-size:15px">orang</small></div><div class="d">${belum} undangan belum konfirmasi</div></div>
    <div class="card stat"><div class="k">Per pihak</div><div class="d" style="font-size:13.5px;color:var(--ink)">${pihaks.map((p) => `${esc(p)}: <b>${all.filter((x) => x.pihak === p).length}</b> undangan · ${sum(all.filter((x) => x.pihak === p), (x) => x.jumlah)} org`).join("<br>") || "-"}</div></div>
  </div>
  ${rsvp.length ? `<h2 class="section-title">RSVP masuk dari undangan digital</h2><div class="table-wrap"><table><thead><tr><th>Nama</th><th>Kehadiran</th><th class="num">Jml</th><th>Ucapan</th><th></th></tr></thead><tbody>${rsvp.map((r) => { const g = r.guestId && all.find((x) => x.id === r.guestId); return `<tr><td style="min-width:120px">${esc(r.nama)}${g ? `<br><small style="color:var(--muted)">→ ${esc(g.nama)}</small>` : ""}</td><td>${rsvpPill(r.hadir)}</td><td class="num">${num(r.jumlah)}</td><td style="min-width:200px">${esc(r.ucapan || "")}</td><td style="white-space:nowrap">${g && !r.applied ? `<button class="btn small" data-act="applyR" data-id="${r.id}">Terapkan</button>` : r.applied ? `<span class="pill ok">Diterapkan</span>` : ""} <button class="icon-btn" data-act="delR" data-id="${r.id}" aria-label="Hapus">✕</button></td></tr>`; }).join("")}</tbody></table></div>` : ""}
  <h2 class="section-title">Daftar tamu</h2>
  <div class="toolbar"><input class="grow" id="ui_gQ" data-ui="gQ" placeholder="Cari nama, grup, kota…" value="${esc(S.ui.gQ || "")}">
  ${uiSel("gP", [["", "Semua pihak"], ...pihaks.map((p) => [p, p])], "Pihak")}${uiSel("gU", [["", "Semua undangan"], ["Online", "Online"], ["Fisik", "Fisik"], ["-", "Belum ditentukan"]], "Undangan")}${uiSel("gK", [["", "Semua status"], ["Belum", "Belum konfirmasi"], ["Hadir", "Hadir"], ["Tidak Hadir", "Tidak hadir"]], "Konfirmasi")}</div>
  <div class="table-wrap"><table><thead><tr><th>Nama</th><th class="hide-sm">Asal</th><th class="num">Jml</th><th>Undangan</th><th class="hide-sm">Acara</th><th>Konfirmasi</th><th></th></tr></thead>
  <tbody>${rows || `<tr><td colspan="7" class="empty">Belum ada tamu yang cocok.</td></tr>`}</tbody>
  <tfoot><tr><td>${list.length} undangan</td><td class="hide-sm"></td><td class="num">${sum(list, (x) => x.jumlah)}</td><td colspan="4"></td></tr></tfoot></table></div>`;
};
const guestGroups = () => [...new Set(S.data.guests.map((x) => x.grup).filter(Boolean))];
ACT.addG = () => openForm({ title: "Tamu baru", fields: GUEST_FIELDS(guestGroups()), data: { jumlah: 1, konfirmasi: "Belum", pihak: S.ui.gP || settings().pria || "Vaditya" }, onSave: (o) => save("guests", { ...o, urut: nextUrut("guests") }) });
ACT.editG = (el, e) => { if (e.target.closest("[data-act]") !== el) return; const x = S.data.guests.find((d) => d.id === el.dataset.id); openForm({ title: "Ubah tamu", fields: GUEST_FIELDS(guestGroups()), data: x, onSave: (o) => save("guests", o), onDelete: () => del("guests", x.id) }); };
ACT.cycleK = (el) => { const x = S.data.guests.find((d) => d.id === el.dataset.id); const order = ["Belum", "Hadir", "Tidak Hadir"]; save("guests", { ...x, konfirmasi: order[(order.indexOf(x.konfirmasi || "Belum") + 1) % 3] }, "Status diperbarui"); };
ACT.applyR = async (el) => {
  const r = S.data.rsvp.find((d) => d.id === el.dataset.id), g = S.data.guests.find((d) => d.id === r.guestId);
  await save("guests", { ...g, konfirmasi: r.hadir === "ya" ? "Hadir" : r.hadir === "tidak" ? "Tidak Hadir" : "Belum", jumlah: r.hadir === "ya" && num(r.jumlah) ? num(r.jumlah) : g.jumlah, catatan: [g.catatan, r.ucapan ? "Ucapan: " + r.ucapan : ""].filter(Boolean).join(" · ") }, "RSVP diterapkan");
  await store.put("rsvp", { ...r, applied: true });
};
ACT.delR = (el) => del("rsvp", el.dataset.id);

// ================= PERSIAPAN =================
const sections = () => [...new Set(S.data.tasks.sort(byUrut).map((x) => x.section))];
const TASK_FIELDS = () => [
  { k: "nama", label: "Nama persiapan", required: true, full: true },
  { k: "section", label: "Bagian", type: "datalist", options: sections() },
  { k: "status", label: "Status", type: "select", options: ["Belum", "Proses", "Selesai"] },
  { k: "deadline", label: "Target selesai", type: "date" },
  { k: "pic", label: "Penanggung jawab", ph: "CPP / CPW / keluarga" },
  { k: "budget", label: "Anggaran (Rp)", type: "number" },
  { k: "spent", label: "Pengeluaran (Rp)", type: "number" },
  { k: "catatan", label: "Keterangan", type: "textarea", full: true },
  { k: "dual", label: "Perlu dicentang untuk CPP dan CPW", type: "checkbox", full: true }
];
PAGES.persiapan = () => {
  const t = S.data.tasks, done = t.filter((x) => x.status === "Selesai").length, onlyOpen = S.ui.tOpen === "1";
  const secs = sections();
  return `<div class="page-head"><div><h1 class="page-title"><span class="cap">P</span>ersiapan</h1><p class="page-sub">Checklist dari A sampai J. CPP = calon pengantin pria, CPW = calon pengantin wanita.</p></div><button class="btn" data-act="addT">+ Tambah</button></div>
  <div class="card" style="margin-bottom:14px"><div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;flex-wrap:wrap"><b style="font:600 22px var(--f-display);color:var(--maroon)">${pct(done, t.length)}% selesai</b><span style="color:var(--muted);font-size:13px">${done} selesai · ${t.filter((x) => x.status === "Proses").length} proses · ${t.filter((x) => (x.status || "Belum") === "Belum").length} belum</span></div><div class="bar" style="margin-top:8px"><i style="width:${pct(done, t.length)}%"></i></div></div>
  <div class="toolbar">${uiSel("tOpen", [["", "Tampilkan semua"], ["1", "Hanya yang belum selesai"]], "Filter")}</div>
  <div class="grid c2">${secs.map((s, si) => {
    const items = t.filter((x) => x.section === s).sort(byUrut).filter((x) => !onlyOpen || x.status !== "Selesai");
    const all = t.filter((x) => x.section === s), d = all.filter((x) => x.status === "Selesai").length;
    if (!items.length && onlyOpen) return "";
    return `<div class="card tint" style="${palVar(si)}"><h3 style="display:flex;justify-content:space-between;gap:8px"><span>${esc(s)}</span><span style="color:var(--muted);font-size:12px">${d}/${all.length}</span></h3><ul class="check-list">${items.map((x) => `<li class="${x.status === "Selesai" ? "done" : ""}">
      <input type="checkbox" class="box" id="tk_${x.id}" data-change="toggleT" data-id="${x.id}" ${x.status === "Selesai" ? "checked" : ""} aria-label="Selesai">
      <div class="name"><span>${esc(x.nama)}</span>${x.catatan || x.deadline || x.pic ? `<small>${[x.catatan, x.deadline && "Target " + fmtDate(x.deadline, { day: "numeric", month: "short" }), x.pic].filter(Boolean).map(esc).join(" · ")}</small>` : ""}
      ${x.dual ? `<div class="dual"><label><input type="checkbox" class="box" style="width:16px;height:16px" data-change="dualT" data-k="cpp" data-id="${x.id}" ${x.cpp ? "checked" : ""}>CPP</label><label><input type="checkbox" class="box" style="width:16px;height:16px" data-change="dualT" data-k="cpw" data-id="${x.id}" ${x.cpw ? "checked" : ""}>CPW</label></div>` : ""}</div>
      <button class="pill ${x.status === "Selesai" ? "ok" : x.status === "Proses" ? "warn" : ""}" data-act="cycleT" data-id="${x.id}">${esc(x.status || "Belum")}</button>
      <button class="icon-btn" data-act="editT" data-id="${x.id}" aria-label="Ubah">✎</button></li>`).join("")}</ul>
      <button class="icon-btn" style="margin-top:6px" data-act="addT" data-sec="${esc(s)}">+ tambah di bagian ini</button></div>`;
  }).join("")}</div>`;
};
ACT.addT = (el) => openForm({ title: "Persiapan baru", fields: TASK_FIELDS(), data: { section: el.dataset.sec || "J. Persiapan Lainnya", status: "Belum" }, onSave: (o) => save("tasks", { ...o, urut: nextUrut("tasks") }) });
ACT.editT = (el) => { const x = S.data.tasks.find((d) => d.id === el.dataset.id); openForm({ title: "Ubah persiapan", fields: TASK_FIELDS(), data: x, onSave: (o) => save("tasks", o), onDelete: () => del("tasks", x.id) }); };
ACT.toggleT = (el) => { const x = S.data.tasks.find((d) => d.id === el.dataset.id); const on = el.checked; save("tasks", { ...x, status: on ? "Selesai" : "Belum", ...(x.dual ? { cpp: on, cpw: on } : {}) }, on ? "Selesai ✓" : "Ditandai belum"); };
ACT.cycleT = (el) => { const x = S.data.tasks.find((d) => d.id === el.dataset.id); const o = ["Belum", "Proses", "Selesai"]; save("tasks", { ...x, status: o[(o.indexOf(x.status || "Belum") + 1) % 3] }, "Status diperbarui"); };
ACT.dualT = (el) => { const x = S.data.tasks.find((d) => d.id === el.dataset.id); const n = { ...x, [el.dataset.k]: el.checked }; n.status = n.cpp && n.cpw ? "Selesai" : n.cpp || n.cpw ? "Proses" : "Belum"; save("tasks", n, "Diperbarui"); };

// ================= SESERAHAN & MAHAR =================
const SES_FIELDS = (cats) => [
  { k: "nama", label: "Barang", required: true },
  { k: "kategori", label: "Kategori", type: "datalist", options: cats },
  { k: "brand", label: "Brand" },
  { k: "toko", label: "Toko", type: "datalist", options: ["Shopee", "Tokopedia", "TikTok Shop", "Drugstore", "Offline"] },
  { k: "budget", label: "Budget (Rp)", type: "number" },
  { k: "actual", label: "Harga sebenarnya (Rp)", type: "number" },
  { k: "link", label: "Link produk", type: "url", full: true, ph: "https://…" },
  { k: "catatan", label: "Catatan", full: true },
  { k: "done", label: "Sudah dibeli / siap", type: "checkbox", full: true }
];
const MAHAR_FIELDS = (cats) => [
  { k: "nama", label: "Nama", required: true }, { k: "kategori", label: "Kategori", type: "datalist", options: cats },
  { k: "brand", label: "Toko / brand" }, { k: "karat", label: "Karat" },
  { k: "berat", label: "Berat (gram)", type: "number" }, { k: "harga", label: "Harga (Rp)", type: "number" },
  { k: "link", label: "Link", type: "url", full: true, ph: "https://…" },
  { k: "catatan", label: "Catatan", full: true }, { k: "done", label: "Sudah dibeli", type: "checkbox", full: true }
];
const WISH_FIELDS = (cats) => [
  { k: "nama", label: "Barang", required: true, full: true },
  { k: "kategori", label: "Ruangan / kategori", type: "datalist", options: cats },
  { k: "prioritas", label: "Prioritas", type: "select", options: ["Wajib", "Penting", "Nanti saja"] },
  { k: "harga", label: "Perkiraan harga (Rp)", type: "number" },
  { k: "jumlah", label: "Jumlah", type: "number" },
  { k: "brand", label: "Brand / tipe" },
  { k: "toko", label: "Toko", type: "datalist", options: ["Shopee", "Tokopedia", "TikTok Shop", "IKEA", "Informa", "Ace", "Offline"] },
  { k: "link", label: "Link produk", type: "url", full: true, ph: "https://…" },
  { k: "catatan", label: "Catatan", full: true, ph: "Ukuran, warna, kado dari siapa…" },
  { k: "done", label: "Sudah punya / sudah dibeli", type: "checkbox", full: true },
  { k: "kado", label: "Tampilkan di daftar kado undangan (tamu bisa memilih untuk menghadiahkan)", type: "checkbox", full: true }
];
const wishCats = () => [...new Set(["Dapur", "Kamar Tidur", "Ruang Tamu", "Kamar Mandi", "Elektronik", "Kebersihan", "Lainnya", ...S.data.wishlist.map((x) => x.kategori).filter(Boolean)])];
const wishPrice = (x) => num(x.harga) * (num(x.jumlah) || 1);
const sesCats = () => [...new Set(["Prayer Set", "Toiletries", "Body Care", "Skincare", "Make Up", "Underwear", "Accessories", ...S.data.seserahan.map((x) => x.kategori).filter(Boolean)])];
const maharCats = () => [...new Set(["Perhiasan", "Uang", "Logam Mulia", "Alat Sholat", ...S.data.mahar.map((x) => x.kategori).filter(Boolean)])];
const CAT = {
  seserahan: { title: "seserahan", fields: () => SES_FIELDS(sesCats()), price: sesPrice, def: { toko: "Shopee" } },
  mahar: { title: "mahar", fields: () => MAHAR_FIELDS(maharCats()), price: (x) => num(x.harga), def: {} },
  wishlist: { title: "wishlist", fields: () => WISH_FIELDS(wishCats()), price: wishPrice, def: { prioritas: "Penting", jumlah: 1 }, icon: "home", pal: 2 },
  kegiatan: { title: "kegiatan", fields: () => KEG_FIELDS(kegCats()), price: (x) => num(x.biaya), def: { kapan: "Tahun pertama" }, icon: "sparkle", pal: 4 }
};
function catCard(col, kat, items, ci = 0) {
  const c = CAT[col];
  const linkIcon = (x) => x.link ? `<a class="icon-btn" href="${esc(x.link)}" target="_blank" rel="noopener" title="${esc(x.toko || "Buka link")}" aria-label="Buka link">${icon("link", 16)}</a>` : "";
  const done = items.filter((x) => x.done).length;
  const catTot = sum(items, c.price), catPaid = sum(items.filter((x) => x.done), c.price);
  return `<div class="card tint" style="${palVar(ci + (col === "mahar" ? 5 : c.pal || 0))}"><div class="cat-head"><h3 style="margin:0;min-width:0;overflow-wrap:anywhere"><span class="cat-dot">${icon(c.icon || (col === "mahar" ? "ring" : "gift"), 15)}</span>${esc(kat)} <small style="color:var(--muted);font-weight:400;letter-spacing:0;text-transform:none">· ${done}/${items.length}</small></h3>
    <div class="acts"><span class="cat-total num" title="Total kategori (harga riil, atau budget kalau riil belum diisi)">${rp(catTot)}<small>dibeli ${rp(catPaid)}</small></span><button class="icon-btn" data-act="addInCat" data-col="${col}" data-cat="${esc(kat)}" aria-label="Tambah item" title="Tambah item">${icon("plus", 16)}</button><button class="icon-btn" data-act="renCat" data-col="${col}" data-cat="${esc(kat)}" aria-label="Ubah kategori" title="Ubah nama kategori">${icon("edit", 16)}</button></div></div>
    <ul class="check-list" style="margin-top:6px">${items.map((x) => `<li class="${x.done ? "done" : ""}"><input type="checkbox" class="box" id="ck_${x.id}" data-change="toggleItem" data-col="${col}" data-id="${x.id}" ${x.done ? "checked" : ""} aria-label="Siap">
      <div class="name"><span>${esc(x.nama)}${col === "wishlist" && x.prioritas ? ` <span class="pill prio ${x.prioritas === "Wajib" ? "red" : x.prioritas === "Penting" ? "gold" : ""}">${esc(x.prioritas)}</span>` : ""}</span>${col === "wishlist" ? kadoTag(x) : ""}<small>${[col === "wishlist" && num(x.jumlah) > 1 && num(x.jumlah) + " pcs", x.brand, col === "wishlist" && x.toko, col === "mahar" && x.karat, col === "mahar" && x.berat && num(x.berat).toLocaleString("id-ID") + " gr", x.catatan].filter(Boolean).map(esc).join(" · ")}</small></div>
      <div class="item-price num">${col === "seserahan" && num(x.actual) ? `<b class="riil ${num(x.budget) && num(x.actual) > num(x.budget) ? "over" : ""}">${rp(x.actual)}</b><small>budget ${num(x.budget) ? rp(x.budget) : "–"}</small>` : `<b>${c.price(x) ? rp(c.price(x)) : "–"}</b>${col === "seserahan" && c.price(x) ? `<small>budget</small>` : ""}`}</div>
      ${linkIcon(x)}<button class="icon-btn" data-act="editItem" data-col="${col}" data-id="${x.id}" aria-label="Ubah">${icon("edit", 16)}</button></li>`).join("")}</ul></div>`;
}
const groupBy = (arr) => { const m = new Map(); [...arr].sort(byUrut).forEach((x) => { const k = x.kategori || "Lainnya"; if (!m.has(k)) m.set(k, []); m.get(k).push(x); }); return m; };
PAGES.seserahan = () => {
  const s = S.data.seserahan, m = S.data.mahar;
  const st = sum(s, sesPrice), sa = sum(s.filter((x) => x.done), sesPrice), mt = sum(m, (x) => x.harga), mPaid = sum(m.filter((x) => x.done), (x) => x.harga);
  const done = s.filter((x) => x.done).length + m.filter((x) => x.done).length;
  return `<div class="page-head"><div><h1 class="page-title"><span class="cap">S</span>eserahan &amp; Mahar</h1><p class="page-sub">Tambah kategori dan barang sesuka kalian. Centang barang yang sudah dibeli. Total memakai harga riil; kalau harga riil belum diisi, dipakai budget.</p></div></div>
  <div class="ticket cream" style="--stub:130px;margin-bottom:16px"><div class="t-main"><div class="t-row"><p class="t-title">${icon("gift", 20)} Seserahan &amp; Mahar</p><div class="t-big ses-grand">${rp(st + mt)}</div></div>
    <div class="ses-sum"><div><div class="t-label">Total seserahan</div><div class="sv">${rp(st)}</div></div><div><div class="t-label">Sudah dibeli</div><div class="sv">${rp(sa)}</div></div><div><div class="t-label">Belum dibeli</div><div class="sv">${rp(st - sa)}</div></div><div><div class="t-label">Mahar · ${sum(m, (x) => x.berat).toLocaleString("id-ID")} gr</div><div class="sv">${rp(mt)}</div>${mPaid ? `<small>sudah dibeli ${rp(mPaid)}</small>` : ""}</div></div></div>
    <div class="t-stub"><span class="t-label">Siap</span><b style="font:500 28px/1 var(--f-display)">${done}/${s.length + m.length}</b><div class="barcode"></div></div></div>
  <h2 class="section-title">${icon("gift", 20)} Seserahan</h2>
  <div class="toolbar"><button class="btn outline small" data-act="addCat" data-col="seserahan">${icon("plus", 14)} Kategori baru</button><button class="btn small" data-act="addInCat" data-col="seserahan">${icon("plus", 14)} Barang</button></div>
  <div class="grid c2">${[...groupBy(s)].map(([k, it], i) => catCard("seserahan", k, it, i)).join("") || `<div class="card empty">Belum ada seserahan.</div>`}</div>
  <h2 class="section-title">${icon("ring", 20)} Mahar</h2>
  <div class="toolbar"><button class="btn outline small" data-act="addCat" data-col="mahar">${icon("plus", 14)} Kategori baru</button><button class="btn small" data-act="addInCat" data-col="mahar">${icon("plus", 14)} Mahar</button></div>
  <div class="grid c2">${[...groupBy(m)].map(([k, it], i) => catCard("mahar", k, it, i)).join("") || `<div class="card empty">Belum ada mahar.</div>`}</div>`;
};
// ================= WISHLIST RUMAH =================
const klaimOf = (id) => S.data.klaim.find((k) => k.itemId === id || k.id === id);
function kadoTag(x) {
  const k = klaimOf(x.id);
  if (k) return `<span class="kado-tag claimed">${icon("gift", 12)} Dipilih ${esc(k.nama)}</span>`;
  return x.kado ? `<span class="kado-tag">${icon("gift", 12)} Di daftar kado</span>` : "";
}
// salin item kado ke dokumen publik agar bisa dibaca halaman undangan tanpa login
let kadoSyncT;
function syncKado() {
  clearTimeout(kadoSyncT);
  kadoSyncT = setTimeout(async () => {
    if (!["wishlist", "public", "config"].every((c) => S.loaded.has(c))) return;
    const items = S.data.wishlist.filter((x) => x.kado && !x.done).sort(byUrut).map((x) => ({ id: x.id, nama: x.nama || "", kategori: x.kategori || "", harga: num(x.harga), link: x.link || "" }));
    const aktif = settings().kadoAktif !== false;
    const cur = S.data.public.find((d) => d.id === "kado");
    const sig = JSON.stringify({ items, aktif });
    if (cur && JSON.stringify({ items: cur.items || [], aktif: cur.aktif !== false }) === sig) return;
    if (!cur && !items.length) return;
    try { await store.put("public", { id: "kado", items, aktif }); } catch (e) { console.warn("sync kado", e); }
  }, 800);
}
const wishTabs = (cur) => `<div class="seg-tabs" role="tablist" aria-label="Jenis wishlist">${[["barang", "home", "Barang rumah", S.data.wishlist.length], ["kegiatan", "sparkle", "Kegiatan", S.data.kegiatan.length]].map(([k, ic, l, n]) => `<button type="button" role="tab" aria-selected="${cur === k}" class="${cur === k ? "on" : ""}" data-act="wTab" data-tab="${k}">${icon(ic, 16)} ${l}<small>${n}</small></button>`).join("")}</div>`;
ACT.wTab = (el) => { S.ui.wTab = el.dataset.tab; try { localStorage.setItem("wTab", S.ui.wTab); } catch (e) {} render(); };
const curWTab = () => { if (!S.ui.wTab) { try { S.ui.wTab = localStorage.getItem("wTab") || "barang"; } catch (e) { S.ui.wTab = "barang"; } } return S.ui.wTab === "kegiatan" ? "kegiatan" : "barang"; };
PAGES.wishlist = () => {
  if (curWTab() === "kegiatan") return kegiatanPage();
  const all = S.data.wishlist, fp = S.ui.wP || "", fs = S.ui.wS || "";
  const list = all.filter((x) => (!fp || (x.prioritas || "Penting") === fp) && (!fs || (fs === "belum" ? !x.done : x.done)));
  const tot = sum(all, wishPrice), have = sum(all.filter((x) => x.done), wishPrice), wajib = sum(all.filter((x) => !x.done && x.prioritas === "Wajib"), wishPrice);
  const done = all.filter((x) => x.done).length;
  return `<div class="page-head"><div><h1 class="page-title"><span class="cap">W</span>ishlist</h1><p class="page-sub">Barang yang ingin kalian punya setelah menikah. Kelompokkan per ruangan, beri prioritas, dan centang yang sudah ada. Tidak dihitung ke anggaran pernikahan.</p></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn outline" data-act="addCat" data-col="wishlist">${icon("plus", 14)} Ruangan baru</button><button class="btn" data-act="addInCat" data-col="wishlist">${icon("plus", 14)} Barang</button></div></div>
  <div class="ticket gold" style="--stub:130px;margin-bottom:16px"><div class="t-main"><div class="t-row"><p class="t-title">${icon("home", 20)} Rumah kita nanti</p><div class="t-big ses-grand">${rp(tot)}</div></div>
    <div class="ses-sum"><div><div class="t-label">Total perkiraan</div><div class="sv">${rp(tot)}</div></div><div><div class="t-label">Sudah punya</div><div class="sv">${rp(have)}</div></div><div><div class="t-label">Belum</div><div class="sv">${rp(tot - have)}</div></div><div><div class="t-label">Wajib, belum ada</div><div class="sv">${rp(wajib)}</div></div></div></div>
    <div class="t-stub"><span class="t-label">Terpenuhi</span><b style="font:500 28px/1 var(--f-display)">${done}/${all.length}</b><div class="barcode"></div></div></div>
  ${wishTabs("barang")}
  ${wishKadoCard()}
  <div class="toolbar">${uiSel("wP", [["", "Semua prioritas"], ["Wajib", "Wajib"], ["Penting", "Penting"], ["Nanti saja", "Nanti saja"]], "Prioritas")}${uiSel("wS", [["", "Semua"], ["belum", "Belum punya"], ["sudah", "Sudah punya"]], "Status")}</div>
  ${all.length ? `<div class="grid c2">${[...groupBy(list)].map(([k, it], i) => catCard("wishlist", k, it, i)).join("") || `<div class="card empty">Tidak ada barang yang cocok dengan filter.</div>`}</div>`
    : `<div class="card empty"><span style="color:var(--gold)">${icon("home", 40)}</span><p>Belum ada wishlist. Mulai dari ruangan yang paling penting, misalnya Dapur atau Kamar Tidur.</p><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn small" data-act="seedWish">Isi contoh daftar</button><button class="btn outline small" data-act="addInCat" data-col="wishlist">+ Tambah barang</button></div></div>`}`;
};
function wishKadoCard() {
  const on = settings().kadoAktif !== false, n = S.data.wishlist.filter((x) => x.kado && !x.done).length, cl = S.data.klaim.length;
  return `<div class="card kado-card"><div style="min-width:0"><h3 style="margin:0 0 4px">${icon("gift", 18)} Daftar kado di undangan</h3>
    <p style="margin:0;font-size:13px;color:var(--muted)">Barang yang dicentang <b>“Tampilkan di daftar kado”</b> muncul di undangan digital. Tamu bisa memilih satu barang untuk dihadiahkan, jadi tidak ada kado dobel. ${n} barang tampil · ${cl} sudah dipilih tamu.</p></div>
    <label class="kado-switch"><input type="checkbox" class="box" data-change="kadoAktif" ${on ? "checked" : ""}> Tampilkan di undangan</label></div>`;
}
ACT.kadoAktif = (el) => save("config", { ...settings(), id: "settings", kadoAktif: el.checked }, el.checked ? "Daftar kado tampil di undangan" : "Daftar kado disembunyikan");

const WISH_SEED = [
  ["Dapur", "Kompor 2 tungku", "Wajib", 600000], ["Dapur", "Rice cooker", "Wajib", 450000], ["Dapur", "Set panci & wajan", "Wajib", 500000], ["Dapur", "Kulkas", "Penting", 3000000], ["Dapur", "Dispenser / galon", "Penting", 250000],
  ["Kamar Tidur", "Kasur & dipan", "Wajib", 3500000], ["Kamar Tidur", "Lemari pakaian", "Wajib", 1500000], ["Kamar Tidur", "Sprei & bantal", "Wajib", 400000],
  ["Ruang Tamu", "Sofa", "Nanti saja", 2500000], ["Ruang Tamu", "Karpet", "Nanti saja", 400000],
  ["Elektronik", "Mesin cuci", "Penting", 2500000], ["Elektronik", "Kipas angin / AC", "Penting", 400000], ["Kebersihan", "Setrika & meja setrika", "Penting", 350000], ["Kebersihan", "Sapu, pel, ember", "Wajib", 150000]
];
ACT.seedWish = async () => { await store.bulk("wishlist", WISH_SEED.map(([kategori, nama, prioritas, harga], i) => ({ kategori, nama, prioritas, harga, jumlah: 1, done: false, urut: i + 1 }))); toast("Contoh wishlist dimuat. Ubah atau hapus sesuai kebutuhan."); };

// ================= WISHLIST KEGIATAN (manifestasi berdua) =================
const KEG_KAPAN = ["Bulan madu", "Tahun pertama", "1–3 tahun", "Suatu hari nanti"];
const KEG_FIELDS = (cats) => [
  { k: "nama", label: "Kegiatan / impian", required: true, full: true, ph: "Umroh berdua, road trip ke Bali, masak bareng tiap Minggu…" },
  { k: "kategori", label: "Kategori", type: "datalist", options: cats },
  { k: "kapan", label: "Target kapan", type: "select", options: KEG_KAPAN },
  { k: "biaya", label: "Perkiraan biaya (Rp, opsional)", type: "number" },
  { k: "tempat", label: "Tempat (opsional)" },
  { k: "catatan", label: "Kenapa ingin ini / catatan", full: true, ph: "Tulis niatnya, biar jadi doa juga" },
  { k: "done", label: "Sudah terwujud", type: "checkbox", full: true },
  { k: "kenangan", label: "Cerita setelah terwujud (opsional)", full: true, ph: "Tanggal, momen lucu, foto disimpan di mana…" }
];
const kegCats = () => [...new Set(["Ibadah", "Jalan-jalan", "Kebiasaan Baik", "Belajar Bareng", "Kuliner", "Keuangan", "Seru-seruan", ...S.data.kegiatan.map((x) => x.kategori).filter(Boolean)])];
const KEG_SEED = [
  ["Ibadah", "Umroh berdua", "1–3 tahun", 70000000], ["Ibadah", "Sholat berjamaah tiap Subuh", "Tahun pertama", 0], ["Ibadah", "Khatam Al-Qur'an bareng", "Tahun pertama", 0],
  ["Jalan-jalan", "Bulan madu", "Bulan madu", 10000000], ["Jalan-jalan", "Road trip keliling Jawa", "1–3 tahun", 5000000], ["Jalan-jalan", "Lihat sunrise di Bromo", "Suatu hari nanti", 2000000],
  ["Kebiasaan Baik", "Olahraga pagi bareng tiap akhir pekan", "Tahun pertama", 0], ["Kebiasaan Baik", "Date night sebulan sekali", "Tahun pertama", 300000],
  ["Belajar Bareng", "Kelas masak berdua", "Tahun pertama", 500000], ["Belajar Bareng", "Belajar bahasa baru", "Suatu hari nanti", 0],
  ["Keuangan", "Dana darurat 6 bulan", "1–3 tahun", 0], ["Seru-seruan", "Foto studio tiap anniversary", "Tahun pertama", 500000], ["Seru-seruan", "Adopsi kucing", "Suatu hari nanti", 1000000]
];
ACT.seedKeg = async () => { await store.bulk("kegiatan", KEG_SEED.map(([kategori, nama, kapan, biaya], i) => ({ kategori, nama, kapan, biaya, done: false, urut: i + 1 }))); toast("Contoh kegiatan dimuat. Ubah atau hapus sesuai impian kalian."); };
function kegCard(kat, items, ci = 0) {
  const done = items.filter((x) => x.done).length;
  return `<div class="card tint" style="${palVar(ci + CAT.kegiatan.pal)}"><div class="cat-head"><h3 style="margin:0;min-width:0;overflow-wrap:anywhere"><span class="cat-dot">${icon("sparkle", 15)}</span>${esc(kat)} <small style="color:var(--muted);font-weight:400;letter-spacing:0;text-transform:none">· ${done}/${items.length} terwujud</small></h3>
    <div class="acts"><button class="icon-btn" data-act="addInCat" data-col="kegiatan" data-cat="${esc(kat)}" aria-label="Tambah kegiatan" title="Tambah kegiatan">${icon("plus", 16)}</button><button class="icon-btn" data-act="renCat" data-col="kegiatan" data-cat="${esc(kat)}" aria-label="Ubah kategori" title="Ubah nama kategori">${icon("edit", 16)}</button></div></div>
    <ul class="check-list" style="margin-top:6px">${items.map((x) => `<li class="${x.done ? "done" : ""}"><input type="checkbox" class="box" id="ck_${x.id}" data-change="toggleItem" data-col="kegiatan" data-id="${x.id}" ${x.done ? "checked" : ""} aria-label="Sudah terwujud">
      <div class="name"><span>${esc(x.nama)}${x.kapan ? ` <span class="pill prio keg-when">${esc(x.kapan)}</span>` : ""}</span><small>${[x.tempat, x.done && x.kenangan ? "✨ " + x.kenangan : x.catatan].filter(Boolean).map(esc).join(" · ")}</small></div>
      <div class="item-price num"><b>${num(x.biaya) ? rp(x.biaya) : ""}</b></div>
      <button class="icon-btn" data-act="editItem" data-col="kegiatan" data-id="${x.id}" aria-label="Ubah">${icon("edit", 16)}</button></li>`).join("")}</ul></div>`;
}
function kegiatanPage() {
  const all = S.data.kegiatan, fk = S.ui.kW || "", fs = S.ui.kS || "";
  const list = all.filter((x) => (!fk || (x.kapan || "") === fk) && (!fs || (fs === "belum" ? !x.done : x.done)));
  const done = all.filter((x) => x.done).length, pct = all.length ? Math.round((done / all.length) * 100) : 0;
  const biaya = sum(all.filter((x) => !x.done), (x) => x.biaya);
  const msg = !all.length ? "Tulis impian pertama kalian!" : done === all.length ? "Semua impian terwujud! Tulis yang baru ya" : done ? `${done} impian sudah terwujud. Lanjut!` : "Semoga semuanya terwujud. Aamiin";
  return `<div class="page-head"><div><h1 class="page-title"><span class="cap">W</span>ishlist</h1><p class="page-sub">Bukan cuma barang: tulis hal-hal yang ingin kalian lakukan berdua setelah menikah. Anggap saja daftar manifestasi. Centang kalau sudah terwujud, lalu tulis ceritanya.</p></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn outline" data-act="addCat" data-col="kegiatan">${icon("plus", 14)} Kategori baru</button><button class="btn" data-act="addInCat" data-col="kegiatan">${icon("plus", 14)} Kegiatan</button></div></div>
  ${wishTabs("kegiatan")}
  <section class="keg-hero" aria-label="Ringkasan impian berdua">
    <div class="keg-cats">${pixelCats(150)}</div>
    <div class="keg-info"><p class="px-font keg-title">Impian kita berdua</p>
      <div class="keg-count"><b>${done}</b><span>/ ${all.length} terwujud</span></div>
      <div class="keg-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Impian terwujud"><i style="width:${pct}%"></i></div>
      <p class="keg-msg px-font">${esc(msg)}</p>
      ${biaya ? `<small class="keg-cost">Perkiraan biaya yang belum terwujud: <b>${rp(biaya)}</b></small>` : ""}</div>
  </section>
  ${all.length ? `<div class="toolbar">${uiSel("kW", [["", "Semua target"], ...KEG_KAPAN.map((k) => [k, k])], "Target kapan")}${uiSel("kS", [["", "Semua"], ["belum", "Belum terwujud"], ["sudah", "Sudah terwujud"]], "Status")}</div>
    <div class="grid c2">${[...groupBy(list)].map(([k, it], i) => kegCard(k, it, i)).join("") || `<div class="card empty">Tidak ada kegiatan yang cocok dengan filter.</div>`}</div>`
    : `<div class="card empty"><span style="color:var(--gold)">${icon("sparkle", 40)}</span><p>Belum ada kegiatan. Mulai dari yang paling kalian tunggu, misalnya bulan madu atau ibadah bareng.</p><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn small" data-act="seedKeg">Isi contoh daftar</button><button class="btn outline small" data-act="addInCat" data-col="kegiatan">+ Tambah kegiatan</button></div></div>`}`;
}

ACT.addCat = (el) => {
  const col = el.dataset.col, c = CAT[col];
  openForm({ title: `Kategori ${c.title} baru`, fields: [{ k: "kategori", label: "Nama kategori", required: true, full: true }, ...c.fields().filter((f) => f.k !== "kategori").map((f) => f.k === "nama" ? { ...f, label: "Item pertama" } : f)],
    data: { ...c.def }, onSave: (o) => save(col, { ...o, urut: nextUrut(col) }, "Kategori ditambahkan") });
};
ACT.addInCat = (el) => { const col = el.dataset.col, c = CAT[col]; openForm({ title: `Tambah ${c.title}`, fields: c.fields(), data: { ...c.def, kategori: el.dataset.cat || "" }, onSave: (o) => save(col, { ...o, urut: nextUrut(col) }) }); };
ACT.editItem = (el) => { const col = el.dataset.col, x = S.data[col].find((d) => d.id === el.dataset.id); openForm({ title: `Ubah ${CAT[col].title}`, fields: CAT[col].fields(), data: x, onSave: (o) => save(col, o), onDelete: () => del(col, x.id) }); };
ACT.toggleItem = (el) => { const col = el.dataset.col, x = S.data[col].find((d) => d.id === el.dataset.id); save(col, { ...x, done: el.checked }, el.checked ? (col === "kegiatan" ? "Alhamdulillah, terwujud ✨" : "Siap ✓") : "Ditandai belum"); };
ACT.renCat = (el) => {
  const col = el.dataset.col, old = el.dataset.cat, items = S.data[col].filter((x) => (x.kategori || "Lainnya") === old);
  openForm({ title: "Ubah kategori", saveLabel: "Simpan nama", fields: [{ k: "kategori", label: "Nama kategori", required: true, full: true, hint: `Hapus kategori akan menghapus ${items.length} item di dalamnya.` }], data: { kategori: old },
    onSave: async (o) => { await store.bulk(col, items.map((x) => ({ ...x, kategori: o.kategori }))); toast("Kategori diganti"); },
    onDelete: async () => { for (const x of items) await store.remove(col, x.id); toast("Kategori dihapus"); } });
};

// ================= VENDOR =================
const VENDOR_FIELDS = [
  { k: "nama", label: "Nama vendor", required: true, full: true }, { k: "layanan", label: "Layanan" },
  { k: "status", label: "Status", type: "select", options: ["Kandidat", "Deal", "DP", "Lunas", "Batal"] },
  { k: "kontak", label: "No. WhatsApp / telepon", type: "tel" }, { k: "instagram", label: "Instagram", ph: "@namavendor" },
  { k: "catatan", label: "Catatan", type: "textarea", full: true }
];
PAGES.vendor = () => {
  const v = [...S.data.vendors].sort(byUrut);
  return `<div class="page-head"><div><h1 class="page-title"><span class="cap">V</span>endor</h1><p class="page-sub">Kontak vendor beserta ringkasan biaya dari halaman Anggaran (dicocokkan berdasarkan nama vendor).</p></div><button class="btn" data-act="addV">+ Tambah vendor</button></div>
  <div class="grid c3">${v.map((x) => {
    const items = S.data.budget.filter((b) => (b.vendor || "").trim().toLowerCase() === (x.nama || "").trim().toLowerCase());
    const tot = sum(items, (b) => b.qty * b.harga), paid = sum(items, (b) => sum(b.pembayaran || [], (p) => p.jumlah));
    const ig = (x.instagram || "").replace(/^@/, "");
    return `<div class="card" style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start"><div style="min-width:0"><div class="t-label" style="color:var(--muted)">${esc(x.layanan || "")}</div><h3 style="margin:2px 0 0">${esc(x.nama)}</h3></div><span class="pill ${x.status === "Lunas" ? "ok" : x.status === "DP" ? "warn" : x.status === "Deal" ? "solid" : x.status === "Batal" ? "no" : ""}">${esc(x.status || "Kandidat")}</span></div>
    ${tot ? `<div style="font-size:13px"><span class="num">${rp(tot)}</span> <span style="color:var(--muted)">· dibayar ${rpShort(paid)} · sisa ${rpShort(tot - paid)}</span><div class="bar" style="margin-top:5px"><i style="width:${pct(paid, tot)}%"></i></div></div>` : ""}
    ${x.catatan ? `<div style="font-size:13px;color:var(--muted)">${esc(x.catatan)}</div>` : ""}
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:auto">${x.kontak ? `<a class="btn small" href="https://wa.me/${waNumber(x.kontak)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}${ig ? `<a class="btn outline small" href="https://instagram.com/${encodeURIComponent(ig)}" target="_blank" rel="noopener">Instagram</a>` : ""}<button class="btn outline small" data-act="editV" data-id="${x.id}">Ubah</button></div></div>`;
  }).join("") || `<div class="card empty"><span class="script">Belum ada</span>Tambahkan vendor pertama kalian.</div>`}</div>`;
};
ACT.addV = () => openForm({ title: "Vendor baru", fields: VENDOR_FIELDS, data: { status: "Kandidat" }, onSave: (o) => save("vendors", { ...o, urut: nextUrut("vendors") }) });
ACT.editV = (el) => { const x = S.data.vendors.find((d) => d.id === el.dataset.id); openForm({ title: "Ubah vendor", fields: VENDOR_FIELDS, data: x, onSave: (o) => save("vendors", o), onDelete: () => del("vendors", x.id) }); };

// ================= RUNDOWN =================
const RUN_FIELDS = () => [
  { k: "kegiatan", label: "Kegiatan", required: true, full: true },
  { k: "acara", label: "Bagian acara", type: "datalist", options: [...new Set(["Persiapan", "Akad", "Resepsi", ...S.data.rundown.map((x) => x.acara)])] },
  { k: "pic", label: "PIC" }, { k: "mulai", label: "Mulai", type: "time" }, { k: "selesai", label: "Selesai", type: "time" },
  { k: "catatan", label: "Catatan", full: true }
];
PAGES.rundown = () => {
  const r = [...S.data.rundown].sort((a, b) => String(a.mulai).localeCompare(b.mulai));
  const st = settings();
  return `<div class="page-head"><div><h1 class="page-title"><span class="cap">R</span>undown</h1><p class="page-sub">Susunan acara hari H, ${esc(fmtDate(st.tanggal))}. Isi awal adalah contoh, silakan disesuaikan dengan WO.</p></div><button class="btn" data-act="addR">+ Tambah kegiatan</button></div>
  <div class="card" style="padding:6px 18px">${r.length ? `<ul class="check-list">${r.map((x) => `<li><div style="width:96px;flex:none;font:600 15px var(--f-display);color:var(--maroon)" class="num">${esc(x.mulai || "")}${x.selesai ? `<small style="display:block;font:400 12px var(--f-body);color:var(--muted)">s/d ${esc(x.selesai)}</small>` : ""}</div><div class="name"><span>${esc(x.kegiatan)}</span><small>${[x.pic, x.catatan].filter(Boolean).map(esc).join(" · ")}</small></div><span class="pill ${x.acara === "Akad" ? "warn" : x.acara === "Resepsi" ? "solid" : ""}">${esc(x.acara || "")}</span><button class="icon-btn" data-act="editR" data-id="${x.id}" aria-label="Ubah">✎</button></li>`).join("")}</ul>` : `<p class="empty"><span class="script">Kosong</span>Tambahkan kegiatan pertama.</p>`}</div>`;
};
ACT.addR = () => openForm({ title: "Kegiatan", fields: RUN_FIELDS(), data: { acara: "Resepsi" }, onSave: (o) => save("rundown", o) });
ACT.editR = (el) => { const x = S.data.rundown.find((d) => d.id === el.dataset.id); openForm({ title: "Ubah kegiatan", fields: RUN_FIELDS(), data: x, onSave: (o) => save("rundown", o), onDelete: () => del("rundown", x.id) }); };

// ================= UNDANGAN =================
const INV_FIELDS = [
  ["namaPria", "Nama mempelai pria"], ["namaWanita", "Nama mempelai wanita"],
  ["ortuPria", "Keterangan orang tua pria"], ["ortuWanita", "Keterangan orang tua wanita"],
  ["tanggal", "Tanggal", "date"], ["tempat", "Nama tempat"],
  ["akadJam", "Jam akad"], ["resepsiJam", "Jam resepsi"],
  ["alamat", "Alamat lengkap", "text", true], ["maps", "Link Google Maps", "url", true],
  ["kutipan", "Kutipan / doa", "textarea", true],
  ["rekening", "Amplop digital: rekening / e-wallet (opsional)", "textarea", true]
];
const DEFAULT_WA = "Assalamu'alaikum {nama},\n\nTanpa mengurangi rasa hormat, kami mengundang Bapak/Ibu/Saudara/i untuk hadir di hari pernikahan kami.\n\nDetail acara & konfirmasi kehadiran:\n{link}\n\nMerupakan kebahagiaan bagi kami apabila berkenan hadir dan memberikan doa restu.\n\nTerima kasih,\n{pria} & {wanita}";
function inviteLink(g) {
  const base = location.href.split("#")[0].replace(/index\.html.*$/, "").replace(/[?].*$/, "");
  return base + "undangan.html" + (g ? `?to=${encodeURIComponent(g.nama)}&g=${encodeURIComponent(g.id)}` : "");
}
function waMessage(g) {
  const st = settings(), inv = invite();
  return (st.waTemplate || DEFAULT_WA).replaceAll("{nama}", g.nama).replaceAll("{link}", inviteLink(g)).replaceAll("{pria}", inv.namaPria || st.pria || "").replaceAll("{wanita}", inv.namaWanita || st.wanita || "");
}
PAGES.undangan = () => {
  const inv = invite(), st = settings();
  const q = (S.ui.iQ || "").toLowerCase();
  const gs = S.data.guests.filter((x) => x.undangan !== "Fisik").filter((x) => !q || x.nama.toLowerCase().includes(q)).sort(byUrut);
  return `<div class="page-head"><div><h1 class="page-title"><span class="cap">U</span>ndangan Digital</h1><p class="page-sub">Halaman undangan publik dengan form RSVP. Tamu tidak perlu login; jawaban mereka masuk ke halaman Tamu &amp; RSVP.</p></div><a class="btn outline" href="${esc(inviteLink())}" target="_blank" rel="noopener">Lihat undangan ↗</a></div>
  <div class="grid c2" style="align-items:start">
    <form class="card" id="invForm"><h3>Isi undangan</h3><div class="dlg-body" style="padding:0;max-height:none;overflow:visible">${INV_FIELDS.map(([k, l, t, full]) => fieldHtml({ k: "inv_" + k, label: l, type: t, full }, inv[k])).join("")}
      ${fieldHtml({ k: "inv_rsvpBuka", label: "Form RSVP dibuka", type: "checkbox", full: true }, inv.rsvpBuka !== false)}</div>
      <div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn" type="button" data-act="saveInv">Simpan undangan</button></div></form>
    <div class="card"><h3>Kirim ke tamu</h3><p style="font-size:13px;color:var(--muted);margin:0 0 10px">Setiap tamu punya link pribadi dengan namanya. Tombol WA membuka WhatsApp dengan pesan siap kirim (tamu dengan undangan Fisik disembunyikan).</p>
      <label class="lbl" for="waTpl">Template pesan ({nama}, {link}, {pria}, {wanita})</label><textarea class="field" id="waTpl" style="min-height:130px">${esc(st.waTemplate || DEFAULT_WA)}</textarea>
      <div style="display:flex;justify-content:flex-end;margin:8px 0 14px"><button class="btn outline small" data-act="saveTpl">Simpan template</button></div>
      <div class="toolbar"><input class="grow" id="ui_iQ" data-ui="iQ" placeholder="Cari tamu…" value="${esc(S.ui.iQ || "")}"></div>
      <ul class="check-list" style="max-height:440px;overflow:auto">${gs.map((g) => `<li><div class="name"><span>${esc(g.nama)}</span><small>${esc(g.grup || "")}${g.hp ? " · " + esc(g.hp) : ""}</small></div><button class="icon-btn" data-act="copyInv" data-id="${g.id}">Salin link</button><a class="btn small" target="_blank" rel="noopener" href="https://wa.me/${g.hp ? waNumber(g.hp) : ""}?text=${encodeURIComponent(waMessage(g))}">WA</a></li>`).join("") || `<li class="empty">Tidak ada tamu</li>`}</ul></div>
  </div>`;
};
ACT.saveInv = () => {
  const o = { ...invite(), id: "invite" };
  INV_FIELDS.forEach(([k]) => (o[k] = $("#f_inv_" + k).value.trim()));
  o.rsvpBuka = $("#f_inv_rsvpBuka").checked;
  save("public", o, "Undangan disimpan");
};
ACT.saveTpl = () => save("config", { ...settings(), id: "settings", waTemplate: $("#waTpl").value }, "Template disimpan");
ACT.copyInv = (el) => copyText(inviteLink(S.data.guests.find((d) => d.id === el.dataset.id)));

// ================= AMPLOP & KADO =================
const AMP_FIELDS = () => [
  { k: "nama", label: "Dari", required: true, full: true, type: "datalist", options: S.data.guests.map((g) => g.nama) },
  { k: "jenis", label: "Jenis", type: "select", options: ["Amplop", "Transfer", "Kado barang"] },
  { k: "jumlah", label: "Jumlah uang (Rp)", type: "number" },
  { k: "barang", label: "Barang (kalau kado)", full: true },
  { k: "tgl", label: "Tanggal diterima", type: "date" },
  { k: "catatan", label: "Catatan", full: true },
  { k: "terimakasih", label: "Sudah diucapkan terima kasih", type: "checkbox", full: true }
];
const guestByName = (n) => S.data.guests.find((g) => (g.nama || "").trim().toLowerCase() === String(n || "").trim().toLowerCase());
function thanksMsg(x) {
  const st = settings(), what = x.jenis === "Kado barang" ? (x.barang ? `kado ${x.barang}` : "kadonya") : "amplop dan doanya";
  return `Assalamu'alaikum ${x.nama},\n\nTerima kasih banyak atas kehadiran, doa, dan ${what} di hari pernikahan kami. Semoga kebaikan Bapak/Ibu/Saudara/i dibalas berlipat ganda.\n\nSalam hangat,\n${st.pria || ""} & ${st.wanita || ""}`;
}
PAGES.amplop = () => {
  const all = [...S.data.amplop].sort((a, b) => String(b.tgl || "").localeCompare(a.tgl || "") || byUrut(a, b));
  const q = (S.ui.aQ || "").toLowerCase(), fj = S.ui.aJ || "", ft = S.ui.aT || "";
  const list = all.filter((x) => (!q || `${x.nama} ${x.barang} ${x.catatan}`.toLowerCase().includes(q)) && (!fj || x.jenis === fj) && (!ft || (ft === "belum" ? !x.terimakasih : x.terimakasih)));
  const uang = sum(all.filter((x) => x.jenis !== "Kado barang"), (x) => x.jumlah), kado = all.filter((x) => x.jenis === "Kado barang").length;
  const belum = all.filter((x) => !x.terimakasih).length;
  const kl = [...S.data.klaim].sort((a, b) => String(b.createdAt).localeCompare(a.createdAt));
  return `<div class="page-head"><div><h1 class="page-title"><span class="cap">A</span>mplop &amp; Kado</h1><p class="page-sub">Catat amplop, transfer, dan kado yang diterima, lalu tandai yang sudah diberi ucapan terima kasih.</p></div><button class="btn" data-act="addAmp">${icon("plus", 14)} Catat</button></div>
  <div class="grid c4">
    <div class="card stat"><div class="k">Total uang</div><div class="v">${rp(uang)}</div><div class="d">amplop & transfer</div></div>
    <div class="card stat"><div class="k">Kado barang</div><div class="v">${kado}</div><div class="d">${kl.length} dipilih lewat undangan</div></div>
    <div class="card stat"><div class="k">Pemberi</div><div class="v">${all.length}</div><div class="d">catatan</div></div>
    <div class="card stat"><div class="k">Belum diberi terima kasih</div><div class="v">${belum}</div><div class="bar" style="margin-top:8px"><i style="width:${pct(all.length - belum, all.length)}%"></i></div></div>
  </div>
  ${kl.length ? `<h2 class="section-title">${icon("gift", 20)} Kado yang dipilih tamu lewat undangan</h2><div class="table-wrap"><table><thead><tr><th>Barang</th><th>Dipilih oleh</th><th class="hide-sm">Tanggal</th><th></th></tr></thead><tbody>
    ${kl.map((k) => { const w = S.data.wishlist.find((x) => x.id === k.itemId); const rec = S.data.amplop.find((a) => a.klaimId === k.id); return `<tr><td>${esc(w ? w.nama : "(barang sudah dihapus)")}${k.pesan ? `<br><small style="color:var(--muted)">${esc(k.pesan)}</small>` : ""}</td><td>${esc(k.nama)}</td><td class="hide-sm">${esc(fmtDate(String(k.createdAt || "").slice(0, 10), { day: "numeric", month: "short" }))}</td><td style="white-space:nowrap">${rec ? `<span class="pill ok">Diterima</span>` : `<button class="btn small" data-act="klaimTerima" data-id="${k.id}">Catat diterima</button>`} <button class="icon-btn" data-act="klaimDel" data-id="${k.id}" title="Batalkan pilihan (barang tampil lagi di undangan)" aria-label="Batalkan">✕</button></td></tr>`; }).join("")}
  </tbody></table></div>` : ""}
  <h2 class="section-title">${icon("coin", 20)} Daftar penerimaan</h2>
  <div class="toolbar"><input class="grow" id="ui_aQ" data-ui="aQ" placeholder="Cari nama atau barang…" value="${esc(S.ui.aQ || "")}">${uiSel("aJ", [["", "Semua jenis"], ["Amplop", "Amplop"], ["Transfer", "Transfer"], ["Kado barang", "Kado barang"]], "Jenis")}${uiSel("aT", [["", "Semua"], ["belum", "Belum terima kasih"], ["sudah", "Sudah terima kasih"]], "Terima kasih")}</div>
  <div class="table-wrap"><table><thead><tr><th>Dari</th><th>Jenis</th><th class="num">Jumlah / barang</th><th>Terima kasih</th><th></th></tr></thead><tbody>
  ${list.map((x) => { const g = guestByName(x.nama); return `<tr class="clickable" data-act="editAmp" data-id="${x.id}"><td>${esc(x.nama)}${x.tgl ? `<br><small style="color:var(--muted)">${esc(fmtDate(x.tgl, { day: "numeric", month: "short", year: "numeric" }))}</small>` : ""}</td><td><span class="pill ${x.jenis === "Kado barang" ? "gold" : x.jenis === "Transfer" ? "solid" : "red"}">${esc(x.jenis || "Amplop")}</span></td><td class="num">${x.jenis === "Kado barang" ? esc(x.barang || "-") : rp(x.jumlah)}</td><td><input type="checkbox" class="box" data-change="ampThanks" data-id="${x.id}" ${x.terimakasih ? "checked" : ""} aria-label="Sudah terima kasih"></td><td style="white-space:nowrap">${g && g.hp ? `<a class="btn small" target="_blank" rel="noopener" href="https://wa.me/${waNumber(g.hp)}?text=${encodeURIComponent(thanksMsg(x))}">WA terima kasih</a>` : `<button class="icon-btn" data-act="copyThanks" data-id="${x.id}">Salin ucapan</button>`}</td></tr>`; }).join("") || `<tr><td colspan="5" class="empty">Belum ada catatan.</td></tr>`}
  </tbody><tfoot><tr><td colspan="2">${list.length} catatan</td><td class="num">${rp(sum(list.filter((x) => x.jenis !== "Kado barang"), (x) => x.jumlah))}</td><td colspan="2"></td></tr></tfoot></table></div>`;
};
ACT.addAmp = () => openForm({ title: "Catat amplop / kado", fields: AMP_FIELDS(), data: { jenis: "Amplop", tgl: todayIso() }, onSave: (o) => save("amplop", { ...o, urut: nextUrut("amplop") }) });
ACT.editAmp = (el, e) => { if (e.target.closest("[data-act]") !== el || e.target.closest("a,input")) return; const x = S.data.amplop.find((d) => d.id === el.dataset.id); openForm({ title: "Ubah catatan", fields: AMP_FIELDS(), data: x, onSave: (o) => save("amplop", o), onDelete: () => del("amplop", x.id) }); };
ACT.ampThanks = (el) => { const x = S.data.amplop.find((d) => d.id === el.dataset.id); save("amplop", { ...x, terimakasih: el.checked }, el.checked ? "Ditandai sudah terima kasih" : "Ditandai belum"); };
ACT.copyThanks = (el) => { const x = S.data.amplop.find((d) => d.id === el.dataset.id); copyText(thanksMsg(x)); };
ACT.klaimTerima = (el) => { const k = S.data.klaim.find((d) => d.id === el.dataset.id), w = S.data.wishlist.find((x) => x.id === k.itemId);
  save("amplop", { nama: k.nama, jenis: "Kado barang", barang: w ? w.nama : "", tgl: todayIso(), klaimId: k.id, terimakasih: false, urut: nextUrut("amplop") }, "Kado dicatat");
  if (w) store.put("wishlist", { ...w, done: true }); };
ACT.klaimDel = (el) => del("klaim", el.dataset.id);

// ================= TABUNGAN =================
const savingsNow = () => sum(S.data.tabungan, (x) => (x.jenis === "Penarikan" ? -num(x.jumlah) : num(x.jumlah)));
function needBreakdown() {
  const b = S.data.budget;
  const sisaRab = sum(b, (x) => Math.max(0, x.qty * x.harga - sum(x.pembayaran || [], (p) => p.jumlah)));
  const ses = sum(S.data.seserahan.filter((x) => !x.done), sesPrice);
  const mahar = sum(S.data.mahar.filter((x) => !x.done), (x) => x.harga);
  return { sisaRab, ses, mahar, total: sisaRab + ses + mahar };
}
function monthsLeft(iso) { if (!iso) return 0; const d = new Date(iso + "T00:00:00"), n = new Date(); return Math.max(0, (d.getFullYear() - n.getFullYear()) * 12 + d.getMonth() - n.getMonth()); }
const TAB_FIELDS = () => [
  { k: "jenis", label: "Jenis", type: "select", options: ["Setoran", "Penarikan", "Saldo awal"] },
  { k: "jumlah", label: "Jumlah (Rp)", type: "number", required: true },
  { k: "tgl", label: "Tanggal", type: "date" },
  { k: "oleh", label: "Dari / oleh", type: "datalist", options: [settings().pria || "Vaditya", settings().wanita || "Firda", "Bersama", "Keluarga"] },
  { k: "ket", label: "Keterangan", full: true, ph: "Gaji November, angpao, bayar vendor…" }
];
function savingsChart(saldo, bulanan, target, iso) {
  const now = new Date(), months = [];
  const end = iso ? new Date(iso + "T00:00:00") : now;
  for (let d = new Date(now.getFullYear(), now.getMonth(), 1), i = 0; d <= end && i < 25; d = new Date(d.getFullYear(), d.getMonth() + 1, 1), i++) months.push({ label: d.toLocaleDateString("id-ID", { month: "short" }), v: saldo + bulanan * i });
  if (!months.length) return "";
  const W = 640, H = 230, pl = 12, pr = 12, pt = 26, pb = 30, cw = W - pl - pr, ch = H - pt - pb;
  const max = Math.max(target, ...months.map((m) => m.v), 1);
  const bw = Math.min(56, (cw / months.length) * 0.62), step = cw / months.length;
  const y = (v) => pt + ch - (Math.max(0, v) / max) * ch;
  const every = Math.ceil(months.length / 8);
  const bars = months.map((m, i) => { const x = pl + step * i + (step - bw) / 2, yy = y(m.v), last = i === months.length - 1;
    return `<rect x="${x}" y="${yy}" width="${bw}" height="${pt + ch - yy}" rx="6" fill="${last ? "var(--maroon)" : "var(--dusty)"}"/>` +
      ((i % every === 0 || last) ? `<text x="${x + bw / 2}" y="${H - 10}" text-anchor="middle" font-size="12" fill="var(--muted)">${esc(m.label)}</text>` : "") +
      (last ? `<text x="${Math.min(x + bw / 2, W - 60)}" y="${Math.max(14, yy - 8)}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--maroon)">${esc(rpShort(m.v))}</text>` : ""); }).join("");
  const ty = y(target);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Proyeksi tabungan per bulan"><line x1="${pl}" x2="${W - pr}" y1="${pt + ch}" y2="${pt + ch}" stroke="var(--line)"/>${bars}${target ? `<line x1="${pl}" x2="${W - pr}" y1="${ty}" y2="${ty}" stroke="var(--green)" stroke-dasharray="5 4" stroke-width="1.5"/><text x="${pl + 4}" y="${Math.max(12, ty - 6)}" font-size="11.5" fill="var(--green)">Target ${esc(rpShort(target))}</text>` : ""}</svg>`;
}
PAGES.tabungan = () => {
  const st = settings(), saldo = savingsNow(), nb = needBreakdown();
  const target = num(st.tabunganTarget) || nb.total, bulanan = num(st.tabunganBulanan), mLeft = monthsLeft(st.tanggal);
  const proj = saldo + bulanan * mLeft, gap = target - saldo, perlu = mLeft ? Math.max(0, gap) / mLeft : Math.max(0, gap);
  const rows = [...S.data.tabungan].sort((a, b) => String(b.tgl).localeCompare(a.tgl));
  const byWho = {}; S.data.tabungan.filter((x) => x.jenis !== "Penarikan").forEach((x) => { const k = x.oleh || "Tanpa nama"; byWho[k] = (byWho[k] || 0) + num(x.jumlah); });
  return `<div class="page-head"><div><h1 class="page-title"><span class="cap">T</span>abungan</h1><p class="page-sub">Catat uang yang sudah terkumpul dan rencana setoran per bulan, lalu lihat apakah cukup sampai hari H.</p></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn outline" data-act="addTab" data-j="Penarikan">− Penarikan</button><button class="btn" data-act="addTab" data-j="${rows.length ? "Setoran" : "Saldo awal"}">${icon("plus", 14)} ${rows.length ? "Setoran" : "Uang saat ini"}</button></div></div>
  ${rows.length ? "" : `<div class="banner"><span>${icon("piggy", 18)} <b>Mulai dari uang yang sudah ada.</b> Catat jumlah tabungan kalian saat ini, lalu isi rencana setoran per bulan.</span><button class="btn small" data-act="addTab" data-j="Saldo awal">Catat uang saat ini</button></div>`}
  <div class="ticket green" style="--stub:130px;margin-bottom:16px"><div class="t-main">
    <div class="t-row"><div><div class="t-label">Uang saat ini</div><p class="t-title" style="font-size:26px;font-family:var(--f-display);font-weight:600;letter-spacing:.02em">${rp(saldo)}</p></div><div class="t-big">${icon("piggy", 30)}</div></div>
    <div class="grid c3" style="gap:10px"><div><div class="t-label">Target dana</div>${rp(target)}</div><div><div class="t-label">${gap > 0 ? "Kurang" : "Lebih"}</div>${rp(Math.abs(gap))}</div><div><div class="t-label">Sisa waktu</div>${mLeft} bulan</div></div></div>
    <div class="t-stub"><span class="t-label">Terkumpul</span><b style="font:600 28px/1 var(--f-display)">${pct(saldo, target)}%</b><div class="barcode"></div></div></div>
  <div class="grid c2" style="align-items:start">
    <div class="card"><h3>${icon("calendar", 18)} Rencana setoran</h3>
      <label class="lbl" for="tabBulanan">Estimasi uang masuk per bulan (Rp)</label>
      <div class="range-row"><input class="field" id="tabBulanan" type="number" inputmode="numeric" step="100000" value="${bulanan || ""}" placeholder="mis. 5000000" data-change="saveTabCfg" data-k="tabunganBulanan"></div>
      <div class="stack" style="gap:8px;margin-top:14px;font-size:14px">
        <div style="display:flex;justify-content:space-between;gap:10px"><span>Estimasi uang di hari H</span><b class="num">${rp(proj)}</b></div>
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><span>Dibanding target</span>${proj >= target ? `<span class="pill ok">Cukup, lebih ${rpShort(proj - target)}</span>` : `<span class="pill red">Kurang ${rpShort(target - proj)}</span>`}</div>
        <div style="display:flex;justify-content:space-between;gap:10px"><span>Agar cukup, setor per bulan</span><b class="num">${rp(Math.ceil(perlu / 1000) * 1000)}</b></div>
      </div>
      <div style="margin-top:14px">${savingsChart(saldo, bulanan, target, st.tanggal)}</div></div>
    <div class="card"><h3>${icon("coin", 18)} Target dana</h3>
      <p style="font-size:13px;color:var(--muted);margin:0 0 10px">Otomatis dihitung dari kebutuhan yang belum dibayar. Isi angka sendiri bila ingin target lain.</p>
      <ul class="mini-list" style="margin-bottom:12px"><li><span>Sisa bayar vendor (RAB)</span><b class="num">${rp(nb.sisaRab)}</b></li><li><span>Seserahan belum dibeli</span><b class="num">${rp(nb.ses)}</b></li><li><span>Mahar belum dibeli</span><b class="num">${rp(nb.mahar)}</b></li><li><span><b>Total otomatis</b></span><b class="num">${rp(nb.total)}</b></li></ul>
      <label class="lbl" for="tabTarget">Target sendiri (kosongkan = otomatis)</label>
      <input class="field" id="tabTarget" type="number" inputmode="numeric" value="${num(st.tabunganTarget) || ""}" placeholder="${nb.total}" data-change="saveTabCfg" data-k="tabunganTarget">
      ${Object.keys(byWho).length ? `<h3 style="margin-top:18px">${icon("people", 18)} Setoran per orang</h3><ul class="mini-list">${Object.entries(byWho).map(([k, v]) => `<li><span>${esc(k)}</span><b class="num">${rp(v)}</b></li>`).join("")}</ul>` : ""}
    </div>
  </div>
  <h2 class="section-title">${icon("doc", 20)} Riwayat</h2>
  <div class="table-wrap"><table><thead><tr><th>Tanggal</th><th>Jenis</th><th class="hide-sm">Oleh</th><th class="hide-sm">Keterangan</th><th class="num">Jumlah</th></tr></thead><tbody>
  ${rows.map((x) => `<tr class="clickable" data-act="editTab" data-id="${x.id}"><td style="white-space:nowrap">${esc(fmtDate(x.tgl, { day: "numeric", month: "short", year: "numeric" }))}</td><td><span class="pill ${x.jenis === "Penarikan" ? "red" : x.jenis === "Saldo awal" ? "gold" : "ok"}">${esc(x.jenis)}</span></td><td class="hide-sm">${esc(x.oleh || "")}</td><td class="hide-sm">${esc(x.ket || "")}</td><td class="num" style="color:${x.jenis === "Penarikan" ? "var(--rose)" : "var(--ok)"}">${x.jenis === "Penarikan" ? "−" : "+"}${rp(x.jumlah)}</td></tr>`).join("") || `<tr><td colspan="5" class="empty">Belum ada catatan.</td></tr>`}
  </tbody></table></div>`;
};
ACT.addTab = (el) => openForm({ title: el.dataset.j === "Penarikan" ? "Catat penarikan" : el.dataset.j === "Saldo awal" ? "Uang saat ini" : "Catat setoran", fields: TAB_FIELDS(), data: { jenis: el.dataset.j, tgl: todayIso() }, onSave: (o) => save("tabungan", o) });
ACT.editTab = (el) => { const x = S.data.tabungan.find((d) => d.id === el.dataset.id); openForm({ title: "Ubah catatan", fields: TAB_FIELDS(), data: x, onSave: (o) => save("tabungan", o), onDelete: () => del("tabungan", x.id) }); };
ACT.saveTabCfg = (el) => save("config", { ...settings(), id: "settings", [el.dataset.k]: num(el.value) }, "Disimpan");

// ================= MOODBOARD =================
const MOOD_PAL = [
  ["Marun Velvet", "#5C0D16", "Backdrop, tirai, swag kain", 1], ["Ivory Melati", "#F4ECDD", "Sofa, kursi, anemone, roncean melati", 1], ["Hijau Monstera", "#2F4A2B", "Daun monstera, pakis, palem", 1],
  ["Merah Mawar Tua", "#7A1A2A", "Mawar, dahlia & amaranthus marun"], ["Dusty Rose", "#C98A93", "Dahlia pink, mawar dusty, anggrek"], ["Blush Pink", "#EDC6C4", "Anthurium, mawar blush"],
  ["Kayu Jati", "#8A4A1E", "Tiang, rangka sofa, ukiran"], ["Champagne Gold", "#C9A15E", "Chandelier, huruf nama, bingkai"], ["Hijau Lime", "#C6CF6E", "Amaranthus hijau, krisan pompom"],
  ["Terakota", "#A8553A", "Genteng joglo, lantai motif"], ["Cahaya Hangat", "#F2C46D", "Lampu sorot, lampion, lampu mutiara"]
];
const MOOD_PROP = [["Marun", 35, "#5C0D16", "#F4ECDD"], ["Ivory", 20, "#E6DAC3", "#2c0a0f"], ["Hijau daun", 15, "#2F4A2B", "#F4ECDD"], ["Pink & mawar", 15, "#C98A93", "#2c0a0f"], ["Kayu", 10, "#8A4A1E", "#F4ECDD"], ["Emas", 5, "#C9A15E", "#2c0a0f"]];
const MOOD_PAGES = [
  ["Dekorasi", [
    [1, "Sampul moodboard", "Vaditya & Firda · 10 April 2027 · WOS"], [2, "Referensi & konsep", "Pendopo Jawa bertemu kemewahan klasik"],
    [3, "Referensi inspirasi", "Suasana, kepadatan & jenis bunga"], [4, "Palet warna", "Marun velvet, ivory, hijau tropis, emas"],
    [5, "Hall pendopo", "Lengkung silver, velvet marun, 3 pasang tiang"], [6, "Pelaminan", "Tirai velvet, 2 chandelier emas, sofa ivory"],
    [7, "Backdrop photobooth", "Velvet marun + nama Vaditya & Firda"], [8, "Gate depan", "Atap joglo, kolom bunga tinggi, welcome sign"],
    [9, "Paket & budget", "Dekorasi Rp15.000.000 (+Rp2.500.000)"]]],
  ["Makeup & Busana", [
    [10, "Sampul makeup & busana", "Kerudung, roncean melati, riasan lembut"], [11, "Busana akad", "Putih, payet halus, kerudung menutup dada"],
    [12, "Makeup & kerudung akad", "Soft glam, lipstik nude natural"], [13, "Busana resepsi", "Dusty mauve atau champagne gold"],
    [14, "Makeup & kerudung resepsi", "Sedikit lebih bold dari akad"], [15, "Busana orang tua", "Dusty pink & champagne gold"]]]
];
const pad2 = (n) => String(n).padStart(2, "0");
PAGES.moodboard = () => `<div class="page-head"><div><h1 class="page-title"><span class="cap">M</span>oodboard</h1><p class="page-sub">Kehangatan pendopo Jawa bertemu kemewahan klasik: velvet marun, dahlia dan mawar marun–pink, anemone putih, aksen hijau lime, dan amaranthus menjuntai dari gerbang sampai pelaminan.</p></div></div>
  <div class="tags" style="margin-bottom:6px">${["Pendopo Jawa", "Velvet Marun", "Klasik Romantis", "Cahaya Hangat", "Amaranthus Menjuntai", "Bunga Tropis"].map((t) => `<span class="pill red">${esc(t)}</span>`).join("")}</div>
  <h2 class="section-title">${icon("camera", 20)} Foto prewedding</h2>
  <div class="photo-strip">${[1, 2, 3, 4].map((i) => `<button type="button" style="border:0;padding:0;background:none;cursor:zoom-in" data-act="viewImg" data-src="img/foto-${i}.jpg" data-cap="Foto prewedding ${i}"><img src="img/foto-${i}.jpg" alt="Foto prewedding ${i}" loading="lazy"></button>`).join("")}</div>
  <h2 class="section-title">${icon("palette", 20)} Palet warna</h2>
  <div class="swatches">${MOOD_PAL.map(([n, h, u]) => `<div class="sw"><i style="background:${h}"></i><div><b>${esc(n)}</b><code>${h}</code><div style="color:var(--muted);margin-top:2px">${esc(u)}</div></div></div>`).join("")}</div>
  <div class="card" style="margin-top:14px"><h3>Proporsi warna dekor</h3><div class="prop">${MOOD_PROP.map(([n, p, bg]) => `<span style="flex:${p};background:${bg}" title="${esc(n)} ${p}%"></span>`).join("")}</div><div class="prop-legend">${MOOD_PROP.map(([n, p, bg]) => `<span><i style="background:${bg}"></i>${esc(n)} ${p}%</span>`).join("")}</div></div></div>
  <h2 class="section-title">${icon("flower", 20)} Bunga & daun</h2>
  <div class="tags">${["Mawar marun & merah tua", "Dahlia burgundy & pink", "Anemone putih", "Anthurium blush", "Krisan pompom hijau lime", "Amaranthus menjuntai", "Roncean melati", "Ranunculus", "Lisianthus", "Anggrek putih", "Daun monstera & pakis"].map((t) => `<span class="pill lime">${esc(t)}</span>`).join("")}</div>
  ${MOOD_PAGES.map(([sec, pages]) => `<h2 class="section-title">${icon(sec === "Dekorasi" ? "sparkle" : "dress", 20)} ${esc(sec)}</h2><div class="gallery">${pages.map(([n, t, d]) => `<button type="button" data-act="viewImg" data-src="img/moodboard/hal-${pad2(n)}.jpg" data-cap="${esc(t)}"><img src="img/moodboard/thumb-${pad2(n)}.jpg" alt="${esc(t)}" loading="lazy"><span>${esc(t)}<small>${esc(d)}</small></span></button>`).join("")}</div>`).join("")}`;
ACT.viewImg = (el) => {
  const v = $("#viewer");
  v.innerHTML = `<div class="dlg-head"><h3 style="font-size:20px">${esc(el.dataset.cap)}</h3><button type="button" data-close aria-label="Tutup">×</button></div><img src="${esc(el.dataset.src)}" alt="${esc(el.dataset.cap)}">`;
  v.querySelector("[data-close]").onclick = () => v.close();
  v.onclick = (e) => { if (e.target === v) v.close(); };
  v.showModal();
};

// ================= PENGATURAN =================
PAGES.pengaturan = () => {
  const st = settings();
  return `<div class="page-head"><div><h1 class="page-title"><span class="cap">P</span>engaturan</h1><p class="page-sub">Info dasar pernikahan dan pengelolaan data.</p></div></div>
  <div class="grid c2" style="align-items:start">
    <div class="card"><h3>Info pernikahan</h3><div class="dlg-body" style="padding:0;max-height:none;overflow:visible">
      ${fieldHtml({ k: "st_pria", label: "Nama mempelai pria" }, st.pria)}${fieldHtml({ k: "st_wanita", label: "Nama mempelai wanita" }, st.wanita)}
      ${fieldHtml({ k: "st_tanggal", label: "Tanggal pernikahan", type: "date" }, st.tanggal)}${fieldHtml({ k: "st_venue", label: "Venue" }, st.venue)}
      ${fieldHtml({ k: "st_targetBudget", label: "Batas total anggaran (Rp)", type: "number", hint: "Kosongkan jika tidak ada" }, st.targetBudget || "")}${fieldHtml({ k: "st_kapasitasCatering", label: "Jumlah pax (porsi catering)", type: "number", hint: "Bisa juga diubah di halaman Anggaran" }, st.kapasitasCatering || "")}
      ${fieldHtml({ k: "st_mulai", label: "Mulai persiapan (kotak 1 ular tangga)", type: "date", hint: "Kosongkan = otomatis dari timeline" }, st.mulai || "")}
    </div><div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn" data-act="saveSt">Simpan</button></div></div>
    <div class="card"><h3>Data</h3>
      <p style="font-size:13.5px;margin:0 0 6px">Mode: <b>${isCloud ? "Online (Firebase, tersinkron)" : "Lokal (hanya di browser ini)"}</b>${S.user && !S.user.local ? ` · masuk sebagai ${esc(S.user.email)}` : ""}</p>
      <p style="font-size:13px;color:var(--muted);margin:0 0 14px">Simpan cadangan secara berkala. File cadangan berisi semua data dan bisa di-import kembali.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="exportData">Unduh cadangan (.json)</button><button class="btn outline" data-act="importFile">Import dari file</button><button class="btn outline" data-act="loadSeed">Muat ulang data awal PDF</button></div>
      <p style="font-size:12.5px;color:var(--muted);margin:14px 0 6px">Import dan muat ulang akan <b>mengganti</b> data yang ada pada bagian yang sama.</p>
      <button class="btn danger small" data-act="wipe" id="wipeBtn">Hapus semua data</button>
    </div>
  </div>`;
};
ACT.saveSt = () => {
  const o = { ...settings(), id: "settings" };
  ["pria", "wanita", "tanggal", "venue", "mulai"].forEach((k) => (o[k] = $("#f_st_" + k).value.trim()));
  ["targetBudget"].forEach((k) => (o[k] = num($("#f_st_" + k).value)));
  const newPax = num($("#f_st_kapasitasCatering").value);
  if (newPax !== paxNow()) { save("config", o, "Pengaturan disimpan").then(() => applyPax(newPax)); return; }
  save("config", o, "Pengaturan disimpan");
};
ACT.exportData = async () => {
  const collections = {};
  for (const c of DATA_COLS) collections[c] = S.data[c].map(({ updatedAt, updatedBy, ...r }) => r);
  const blob = new Blob([JSON.stringify({ app: "wedding-planner", version: 1, exportedAt: new Date().toISOString(), collections }, null, 1)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `cadangan-wedding-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
async function importData(json) {
  if (!json || !json.collections) throw new Error("Format file tidak dikenali");
  toast("Mengimpor data…");
  for (const [c, items] of Object.entries(json.collections)) {
    if (!COLS.includes(c) || !Array.isArray(items)) continue;
    await store.clear(c);
    await store.bulk(c, items);
  }
  toast("Data berhasil dimuat");
}
ACT.loadSeed = async () => {
  try { const r = await fetch("data/data-awal.json", { cache: "no-store" }); if (!r.ok) throw 0; await importData(await r.json()); }
  catch { toast("File data-awal.json tidak ada di server. Pakai “Import dari file”."); }
};
ACT.importFile = () => $("#fileInput").click();
$("#fileInput").addEventListener("change", async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { await importData(JSON.parse(await f.text())); } catch (err) { toast("Gagal import: " + err.message); }
  e.target.value = "";
});
ACT.wipe = async (el) => {
  if (!el.classList.contains("armed")) { el.classList.add("armed"); el.textContent = "Klik sekali lagi untuk menghapus SEMUA data"; return; }
  for (const c of COLS) await store.clear(c);
  toast("Semua data dihapus");
};

// Mode lokal: kalau masih kosong dan file data awal tersedia, langsung muat (untuk mencoba).
async function autoSeedLocal() {
  if (["guests", "budget", "tasks", "seserahan", "config"].some((c) => S.data[c].length)) return;
  try { const r = await fetch("data/data-awal.json", { cache: "no-store" }); if (r.ok) await importData(await r.json()); } catch {}
}

// ================= BOOT =================
function startData() {
  unsubs.forEach((u) => u && u()); unsubs = [];
  COLS.forEach((c) => unsubs.push(store.subscribe(c, (arr) => { S.data[c] = arr; S.loaded.add(c); render(); if (c === "wishlist" || c === "public" || c === "config") syncKado(); },
    (err) => { if (err.code === "permission-denied") toast("Akses ditolak. Periksa firestore.rules & email yang diizinkan."); })));
}
function showLogin(msg = "") {
  $("#app").hidden = true; $("#login").hidden = false; $("#loginErr").textContent = msg;
}
function setupCover() {
  const cover = $("#cover"); if (!cover) return;
  const card = cover.querySelector(".cover-card");
  if (!cover.classList.contains("simple")) [["flower", "top:-14px;left:-10px", 34, "0s"], ["heart", "top:38%;right:-18px", 26, ".8s"], ["sparkle", "bottom:70px;left:-16px", 26, "1.6s"], ["ring", "top:-8px;right:12px", 28, "2.2s"]]
    .forEach(([n, pos, sz, dl]) => card.insertAdjacentHTML("beforeend", `<span class="float" style="${pos};animation-delay:${dl}">${icon(n, sz)}</span>`));
  $("#coverBtn").onclick = () => cover.classList.add("gone");
  // klik logo V & F di header untuk kembali ke halaman pembuka
  const brand = document.querySelector(".brand");
  if (brand) { brand.style.cursor = "pointer"; brand.title = "Kembali ke halaman pembuka"; brand.setAttribute("role", "button"); brand.tabIndex = 0;
    const back = () => { cover.classList.remove("gone"); $("#coverBtn").focus(); };
    brand.onclick = back; brand.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); back(); } }; }
}
async function boot() {
  setupCover();
  try { startCover($("#coverScene"), $("#coverBg")); } catch (e) { console.warn("animasi pixel", e); }
  store = await createStore();
  $("#whoDot").classList.toggle("local", !isCloud);
  $("#loginForm").onsubmit = async (e) => {
    e.preventDefault(); $("#loginErr").textContent = "";
    try { await store.signIn($("#loginEmail").value.trim(), $("#loginPass").value); }
    catch (err) { $("#loginErr").textContent = err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" ? "Email atau kata sandi salah." : "Gagal masuk: " + (err.code || err.message); }
  };
  $("#forgotBtn").onclick = async () => {
    const em = $("#loginEmail").value.trim(); if (!em) { $("#loginErr").textContent = "Isi email dulu, lalu klik lagi."; return; }
    try { await store.resetPassword(em); $("#loginErr").textContent = "Link reset kata sandi sudah dikirim ke email."; } catch (err) { $("#loginErr").textContent = err.code || err.message; }
  };
  $("#logoutBtn").onclick = () => store.signOut();
  $("#logoutBtn").hidden = !isCloud;
  store.onAuth((u) => {
    S.user = u;
    if (!u) { unsubs.forEach((f) => f && f()); unsubs = []; return showLogin(); }
    if (isCloud && allowedEmails.length && !allowedEmails.map((x) => x.toLowerCase()).includes((u.email || "").toLowerCase())) {
      store.signOut(); return showLogin("Akun ini tidak diizinkan membuka planner.");
    }
    $("#login").hidden = true; $("#app").hidden = false;
    $("#whoName").textContent = u.local ? "Mode lokal" : u.email;
    startData(); render();
    if (!isCloud) setTimeout(autoSeedLocal, 600);
  });
}
boot().catch((e) => { console.error(e); document.body.insertAdjacentHTML("afterbegin", `<p style="padding:16px;color:#a3121c">Gagal memuat aplikasi: ${esc(e.message)}</p>`); });
