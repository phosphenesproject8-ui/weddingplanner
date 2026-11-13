import { publicApi } from "./store.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const qs = new URLSearchParams(location.search);
const to = (qs.get("to") || "").slice(0, 80), gid = (qs.get("g") || "").slice(0, 40);
const fmt = (iso, o) => { const d = new Date(iso + "T00:00:00"); return isNaN(d) ? iso : d.toLocaleDateString("id-ID", o); };

// Foto yang dipakai (ganti file di folder img/ untuk mengganti foto)
const FOTO = { sampul: "img/foto-3.jpg", cerita: "img/foto-1.jpg", oval: "img/foto-4.jpg" };

// ---------- pita renda (SVG digambar sendiri, warna ivory) ----------
function laceEdge() {
  const iv = "#f4ecdd", hole = "rgba(23,17,14,.55)";
  let picots = "";
  for (let a = 200; a <= 340; a += 20) { const r = (a * Math.PI) / 180; picots += `<circle cx="${30 + 19 * Math.cos(r)}" cy="${30 + 19 * Math.sin(r)}" r="2" fill="${iv}"/>`; }
  let dots = "";
  for (let a = 0; a < 360; a += 60) { const r = (a * Math.PI) / 180; dots += `<circle cx="${30 + 11 * Math.cos(r)}" cy="${28 + 11 * Math.sin(r)}" r="1.6" fill="${hole}"/>`; }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="46" viewBox="0 0 60 46"><rect x="0" y="30" width="60" height="16" fill="${iv}"/><circle cx="30" cy="30" r="17" fill="${iv}"/><circle cx="0" cy="31" r="7" fill="${iv}"/><circle cx="60" cy="31" r="7" fill="${iv}"/>${picots}<circle cx="30" cy="28" r="6" fill="${hole}"/><circle cx="30" cy="28" r="2.4" fill="${iv}"/>${dots}<circle cx="15" cy="38" r="2.6" fill="${hole}"/><circle cx="45" cy="38" r="2.6" fill="${hole}"/><circle cx="0" cy="38" r="1.6" fill="${hole}"/><circle cx="60" cy="38" r="1.6" fill="${hole}"/></svg>`;
  return `url('data:image/svg+xml,${encodeURIComponent(svg)}')`;
}

// ---------- renda bundar untuk RSVP ----------
function doilySvg() {
  const iv = "#f4ecdd", hole = "#5c0d16";
  const ring = (n, rad, fn) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return fn(150 + rad * Math.cos(a), 150 + rad * Math.sin(a), (a * 180) / Math.PI); }).join("");
  return `<svg viewBox="0 0 300 300" aria-hidden="true">
    ${ring(28, 134, (x, y) => `<circle cx="${x}" cy="${y}" r="13" fill="${iv}"/>`)}
    <circle cx="150" cy="150" r="134" fill="${iv}"/>
    ${ring(28, 136, (x, y) => `<circle cx="${x}" cy="${y}" r="4" fill="${hole}" opacity=".85"/>`)}
    ${ring(56, 120, (x, y) => `<circle cx="${x}" cy="${y}" r="1.6" fill="${hole}" opacity=".7"/>`)}
    ${ring(18, 100, (x, y, d) => `<ellipse cx="${x}" cy="${y}" rx="13" ry="6" transform="rotate(${d} ${x} ${y})" fill="${hole}" opacity=".55"/><circle cx="${x}" cy="${y}" r="2.2" fill="${iv}"/>`)}
    ${ring(36, 80, (x, y) => `<circle cx="${x}" cy="${y}" r="2.4" fill="${hole}" opacity=".65"/>`)}
    ${ring(12, 70, (x, y, d) => `<path d="M${x} ${y} l4 -4 l4 4 l-4 4z" transform="rotate(${d} ${x} ${y})" fill="${hole}" opacity=".45"/>`)}
    <circle cx="150" cy="150" r="60" fill="${iv}" stroke="${hole}" stroke-opacity=".5" stroke-width="1"/>
    <circle cx="150" cy="150" r="54" fill="none" stroke="${hole}" stroke-opacity=".35" stroke-dasharray="2 4"/>
  </svg>`;
}

// ---------- latar bunga gelap (digambar di canvas, warna palet) ----------
function paintFlowers(canvas) {
  const box = canvas.parentElement.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(box.width * dpr); canvas.height = Math.round(box.height * dpr);
  const c = canvas.getContext("2d"); c.scale(dpr, dpr);
  const W = box.width, H = box.height;
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  c.fillStyle = "#1a1411"; c.fillRect(0, 0, W, H);
  const petals = ["#c98a93", "#edc6c4", "#a8553a", "#8c2a36", "#f4ecdd", "#c98a93", "#7a1a2a"];
  const leaf = (x, y, len, ang) => { c.save(); c.translate(x, y); c.rotate(ang); const g = c.createLinearGradient(0, 0, len, 0); g.addColorStop(0, "#2f4a2b"); g.addColorStop(1, "#56703a"); c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(len / 2, -len / 4, len, 0); c.quadraticCurveTo(len / 2, len / 4, 0, 0); c.fill(); c.restore(); };
  const flower = (x, y, r, col) => {
    for (let k = 0; k < 4; k++) leaf(x, y, r * (1.6 + rnd()), rnd() * Math.PI * 2);
    for (let layer = 0; layer < 3; layer++) {
      const n = 7 + layer * 2, rr = r * (1 - layer * 0.28);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + layer * 0.4;
        c.save(); c.translate(x + Math.cos(a) * rr * 0.45, y + Math.sin(a) * rr * 0.45); c.rotate(a);
        const g = c.createRadialGradient(0, 0, 1, 0, 0, rr * 0.6); g.addColorStop(0, col); g.addColorStop(1, "rgba(26,20,17,.2)");
        c.fillStyle = g; c.globalAlpha = 0.75; c.beginPath(); c.ellipse(0, 0, rr * 0.55, rr * 0.32, 0, 0, Math.PI * 2); c.fill(); c.restore();
      }
    }
    c.globalAlpha = 1; c.fillStyle = "#c9a15e"; c.beginPath(); c.arc(x, y, r * 0.09, 0, Math.PI * 2); c.fill();
  };
  const count = Math.max(10, Math.round((W * H) / 26000));
  for (let i = 0; i < count; i++) {
    const side = rnd() < 0.5 ? rnd() * W * 0.32 : W - rnd() * W * 0.32;
    flower(side, rnd() * H, 26 + rnd() * 46, petals[Math.floor(rnd() * petals.length)]);
  }
  for (let i = 0; i < 6; i++) flower(W * (0.3 + rnd() * 0.4), H - rnd() * 60, 30 + rnd() * 30, petals[Math.floor(rnd() * petals.length)]);
}

function cd(iso) {
  const ms = Math.max(0, new Date(iso + "T08:00:00") - new Date());
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
  return `<div><b>${d}</b><span>Hari</span></div><div><b>${h}</b><span>Jam</span></div><div><b>${m}</b><span>Menit</span></div>`;
}

async function main() {
  const api = await publicApi();
  let inv = null;
  try { inv = await api.getInvite(); } catch (e) { console.error(e); }
  const root = document.getElementById("inv");
  if (!inv) { root.innerHTML = `<section class="hero"><div class="in"><div class="welcome">Undangan belum tersedia</div></div></section>`; return; }
  const P = esc(inv.namaPria), W = esc(inv.namaWanita);
  document.title = `Undangan ${inv.namaPria} & ${inv.namaWanita}`;
  const dateLong = fmt(inv.tanggal, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const lace = laceEdge();
  const cerita = inv.cerita ? inv.cerita.split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join("") : "";
  root.innerHTML = `
  <section class="hero"><div class="bg" style="background-image:url('${FOTO.sampul}')"></div>
    <div class="in wrap">
      <div class="mono">${esc((inv.namaPria || "")[0] || "")}&amp;${esc((inv.namaWanita || "")[0] || "")}</div>
      <div class="welcome">Selamat datang di pernikahan</div>
      <h1><span class="nm">${P}</span> <span class="script">&amp;</span> <span class="nm">${W}</span></h1>
      <div class="date">${esc(fmt(inv.tanggal, { day: "numeric", month: "long", year: "numeric" }))}</div>
      ${to ? `<div class="to"><small>Kepada Yth.</small><b>${esc(to)}</b></div>` : ""}
    </div>
    <div class="scroll">Gulir ke bawah ↓</div>
  </section>
  <div class="lace top" style="background-image:${lace}"></div>
  <section class="story"><div class="wrap story-grid">
      <img class="story-photo" src="${FOTO.cerita}" alt="Foto ${P} dan ${W}">
      <div class="story-text">
        <h2 class="sec-title">Cerita <span class="script">K</span>ami</h2>
        ${cerita || `<p>Dengan memohon rahmat dan ridho Allah SWT, kami bermaksud menyelenggarakan pernikahan kami dan memohon doa restu dari Bapak/Ibu/Saudara/i.</p>`}
        ${inv.kutipan ? `<p class="quote">${esc(inv.kutipan)}</p>` : ""}
        <div class="parents"><div><b>${P}</b>${esc(inv.ortuPria || "")}</div><div><b>${W}</b>${esc(inv.ortuWanita || "")}</div></div>
      </div>
    </div>
    <div class="oval"><img src="${FOTO.oval}" alt="Foto ${P} dan ${W}"></div>
  </section>
  <div class="lace bottom" style="background-image:${lace}"></div>
  <section class="event"><canvas aria-hidden="true"></canvas><div class="wrap">
    <div class="ev-grid">
      <div><h3>Waktu</h3><div class="big">${esc(dateLong)}</div>
        <div class="small">${inv.akadJam ? `Akad nikah: ${esc(inv.akadJam)} WIB` : ""}${inv.akadJam && inv.resepsiJam ? "<br>" : ""}${inv.resepsiJam ? `Resepsi: ${esc(inv.resepsiJam)} WIB` : ""}</div></div>
      <div><h3>Tempat</h3><div class="big">${esc(inv.tempat || "-")}</div>
        ${inv.alamat ? `<div class="small">${esc(inv.alamat)}</div>` : ""}
        ${inv.maps ? `<a class="btn-line" href="${esc(inv.maps)}" target="_blank" rel="noopener">Buka peta</a>` : ""}</div>
    </div>
    <div class="countdown" id="cd">${cd(inv.tanggal)}</div>
  </div></section>
  ${inv.rsvpBuka !== false ? `<section class="rsvp-sec" id="rsvpSec"><div class="wrap">
    <button class="doily" id="doily" type="button" aria-expanded="false" aria-controls="rsvpCard">${doilySvg()}<span class="label"><b>RSVP</b><span>Di sini</span></span></button>
    <div class="rsvp-card" id="rsvpCard" hidden>
      <h3>Konfirmasi Kehadiran</h3>
      <form class="rsvp" id="rsvp">
        <div><label class="lbl" for="rNama">Nama</label><input class="field" id="rNama" maxlength="80" required value="${esc(to)}"></div>
        <div><span class="lbl">Kehadiran</span><div class="radios" role="radiogroup">
          <label><input type="radio" name="hadir" value="ya" checked><span>Hadir</span></label>
          <label><input type="radio" name="hadir" value="tidak"><span>Tidak hadir</span></label>
          <label><input type="radio" name="hadir" value="ragu"><span>Masih ragu</span></label></div></div>
        <div><label class="lbl" for="rJml">Jumlah orang</label><select class="field" id="rJml">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<option>${n}</option>`).join("")}</select></div>
        <div><label class="lbl" for="rUcapan">Ucapan &amp; doa</label><textarea class="field" id="rUcapan" maxlength="500" rows="3"></textarea></div>
        <div class="msg" id="rMsg"></div>
        <button class="send" type="submit">Kirim konfirmasi</button>
      </form>
    </div></div></section>` : ""}
  <footer><div class="wrap"><p>Merupakan suatu kehormatan dan kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan hadir dan memberikan doa restu.</p><div class="thanks">Terima kasih</div><p style="letter-spacing:.3em;text-transform:uppercase;font-size:12px">${P} &amp; ${W}</p></div></footer>`;

  const canvas = root.querySelector(".event canvas");
  const repaint = () => paintFlowers(canvas);
  repaint(); let t; window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(repaint, 150); });
  setInterval(() => { const el = document.getElementById("cd"); if (el) el.innerHTML = cd(inv.tanggal); }, 30000);

  const doily = document.getElementById("doily");
  if (doily) doily.onclick = () => { const card = document.getElementById("rsvpCard"); card.hidden = !card.hidden; doily.setAttribute("aria-expanded", String(!card.hidden)); if (!card.hidden) document.getElementById("rNama").focus(); };
  const form = document.getElementById("rsvp");
  if (form) form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button"), msg = document.getElementById("rMsg");
    const nama = document.getElementById("rNama").value.trim();
    if (!nama) { msg.textContent = "Mohon isi nama."; return; }
    const hadir = form.querySelector("input[name=hadir]:checked").value;
    const d = { nama, hadir, jumlah: hadir === "tidak" ? 0 : parseInt(document.getElementById("rJml").value, 10), ucapan: document.getElementById("rUcapan").value.trim(), createdAt: new Date().toISOString() };
    if (gid) d.guestId = gid;
    btn.disabled = true; msg.textContent = "Mengirim…";
    try {
      await api.sendRsvp(d);
      document.getElementById("rsvpCard").innerHTML = `<h3>Terima kasih</h3><p style="text-align:center;margin:0">Konfirmasi dari <b>${esc(nama)}</b> sudah kami terima.</p>`;
    } catch (err) { console.error(err); btn.disabled = false; msg.textContent = "Gagal mengirim. Coba lagi sebentar."; }
  };
}
main();
