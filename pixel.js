// Animasi pixel art: adegan pembuka (pasangan di bawah gapura bunga) dan
// papan ular tangga menuju hari H. Semua digambar di <canvas> beresolusi
// rendah lalu diperbesar dengan image-rendering: pixelated.

const C = {
  k: "#2c0a0f", s: "#eab68d", S: "#c98d66", e: "#2c0a0f", w: "#fffaf0", W: "#e6dac3",
  g: "#c9a15e", y: "#f2c46d", m: "#5c0d16", r: "#7a1a2a", R: "#b8323f", p: "#edc6c4", d: "#c98a93",
  G: "#2f4a2b", l: "#c6cf6e", L: "#7f9a4a", t: "#8a4a1e", T: "#5e3013", c: "#fbf6ec", b: "#f3d9d6", n: "#7a5f57"
};
const reduced = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- sprite ----------
const sp = (rows) => rows.map((r) => r.split(""));
const GROOM = [sp([
  "...kkkk...",
  "..kkkkkk..",
  "..kgkkgk..",
  "..ssssss..",
  "..sesses..",
  "..ssssss..",
  "...sSSs...",
  "..wwggww..",
  ".wwwwwwww.",
  ".wwgwwwww.",
  ".swwwwwws.",
  ".swwwwwws.",
  "..mmmmmm..",
  "..mgmmgm..",
  "..mmmmmm..",
  "..kk..kk.."
])];
GROOM.push(GROOM[0].map((r, i) => (i === 15 ? "...kk.kk..".split("") : r)));
const BRIDE = [sp([
  "..gyggyg..",
  "..wwwwww..",
  ".wwssssww.",
  ".wsesseswW",
  ".wwssssww.",
  ".wwwddwwwW",
  "..wwwwwwW.",
  ".wwwwwwwww",
  ".wwgwwgwwW",
  ".swwwwwws.",
  ".wwwwwwwwW",
  ".wwwwwwwwW",
  "wwwwwwwwwW",
  "wwwwwwwwwW",
  "wwwwwwwwww",
  ".WWWWWWWW."
])];
BRIDE.push(BRIDE[0]);
const HEART = sp([".R.R.", "RRRRR", ".RRR.", "..R.."]);
const HEART_BIG = sp([".RR.RR.", "RRRRRRR", "RRRRRRR", ".RRRRR.", "..RRR..", "...R..."]);
const MINI_COUPLE = sp([ // token papan: dua kepala kecil
  ".kk..ww.",
  "kkkkwwww",
  "kssksssw",
  ".ss..ss.",
  "wwwwwwww",
  "wgwwwwgw",
  "mmmwwwww",
  "m.m.wwww"
]);
const FLAG = sp(["tgg", "tgg", "t..", "t..", "t.."]);

function drawSprite(ctx, s, x, y, map = null) {
  for (let j = 0; j < s.length; j++) for (let i = 0; i < s[j].length; i++) {
    const ch = s[j][i]; if (ch === ".") continue;
    ctx.fillStyle = (map && map[ch]) || C[ch]; ctx.fillRect(Math.round(x) + i, Math.round(y) + j, 1, 1);
  }
}
const px = (ctx, x, y, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
function line(ctx, x0, y0, x1, y1, col, w = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy; ctx.fillStyle = col;
  for (;;) {
    ctx.fillRect(x0, y0, w, w);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
// angka 3×5 piksel
const DIG = ["111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001", "111100111001111", "111100111101111", "111001001001001", "111101111101111", "111101111001111"];
function drawNum(ctx, n, x, y, col) {
  String(n).split("").forEach((d, k) => { const g = DIG[+d]; for (let i = 0; i < 15; i++) if (g[i] === "1") px(ctx, x + k * 4 + (i % 3), y + Math.floor(i / 3), col); });
}
function fit(canvas, w, h, maxScale = 6) {
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const avail = canvas.parentElement ? canvas.parentElement.clientWidth : w * 3;
  let sc = Math.min(maxScale, Math.floor(avail / w));
  if (sc < 2) sc = Math.max(1, avail / w); // layar sempit: isi lebar penuh
  canvas.style.width = w * sc + "px"; canvas.style.height = h * sc + "px";
}

// ================= ADEGAN PEMBUKA =================
export function startCover(scene, bg) {
  const cover = document.getElementById("cover");
  const W = 112, H = 50;
  const ctx = scene.getContext("2d"), bctx = bg.getContext("2d");
  const hearts = [], petals = [], stars = [];
  let t0 = performance.now(), last = 0;
  const archFlowers = [];
  for (let a = 0; a <= 28; a++) { // lengkung bunga
    const th = Math.PI * (a / 28);
    archFlowers.push([56 - Math.cos(th) * 30, 40 - Math.sin(th) * 30, a % 3]);
  }
  const resizeBg = () => { bg.width = Math.ceil(innerWidth / 4); bg.height = Math.ceil(innerHeight / 4); stars.length = 0;
    for (let i = 0; i < Math.round(bg.width * bg.height / 260); i++) stars.push([Math.random() * bg.width, Math.random() * bg.height, Math.random() * 6.28, Math.random() < 0.15]); };
  resizeBg(); addEventListener("resize", () => { resizeBg(); fit(scene, W, H, 4); });
  fit(scene, W, H, 4);

  function frame(now) {
    if (!cover.classList.contains("gone") && !document.hidden) {
      const t = Math.max(0, (now - t0) / 1000), dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
      // latar: bintang emas berkelip & hati melayang pelan
      bctx.clearRect(0, 0, bg.width, bg.height);
      stars.forEach((s) => {
        if (s[3]) { s[1] -= dt * 3; if (s[1] < -6) { s[1] = bg.height + 4; s[0] = Math.random() * bg.width; } drawSprite(bctx, HEART, s[0], s[1], { R: "rgba(237,198,196,.35)" }); return; }
        const a = (Math.sin(t * 2 + s[2]) + 1) / 2; if (a < 0.35) return;
        bctx.fillStyle = `rgba(242,196,109,${(a * 0.7).toFixed(2)})`; bctx.fillRect(Math.round(s[0]), Math.round(s[1]), 1, 1);
        if (a > 0.92) { bctx.fillRect(Math.round(s[0]) - 1, Math.round(s[1]), 3, 1); bctx.fillRect(Math.round(s[0]), Math.round(s[1]) - 1, 1, 3); }
      });
      drawScene(t, dt);
    }
    if (!reduced()) requestAnimationFrame(frame);
  }
  function drawScene(t, dt) {
    ctx.clearRect(0, 0, W, H);
    // tanah & rumput
    ctx.fillStyle = C.G; ctx.fillRect(0, 45, W, 5); ctx.fillStyle = C.L; ctx.fillRect(0, 45, W, 1);
    for (let x = 1; x < W; x += 7) { px(ctx, x, 44, C.L); px(ctx, x + 3, 44, C.G); }
    for (let x = 4; x < W; x += 13) { px(ctx, x, 43, C.p); px(ctx, x - 1, 44, C.d); px(ctx, x + 1, 44, C.d); }
    // tiang gapura (kayu jati) & lengkung bunga
    ctx.fillStyle = C.t; ctx.fillRect(24, 26, 3, 19); ctx.fillRect(85, 26, 3, 19);
    ctx.fillStyle = C.T; ctx.fillRect(26, 26, 1, 19); ctx.fillRect(87, 26, 1, 19);
    archFlowers.forEach(([x, y, k], i) => {
      const leaf = i % 2 ? [x - 2, y + 1] : [x + 2, y + 1];
      px(ctx, leaf[0], leaf[1], C.G); px(ctx, leaf[0], leaf[1] + 1, C.L);
      const pet = k === 0 ? C.r : k === 1 ? C.d : C.w;
      px(ctx, x, y - 1, pet); px(ctx, x - 1, y, pet); px(ctx, x + 1, y, pet); px(ctx, x, y + 1, pet); px(ctx, x, y, C.y);
    });
    // amaranthus menjuntai di sisi
    for (let j = 0; j < 9; j++) { const sw = Math.round(Math.sin(t * 1.6 + j * 0.5) * 0.6); px(ctx, 28 + sw, 22 + j * 1.6, j % 2 ? C.l : C.L); px(ctx, 84 - sw, 22 + j * 1.6, j % 2 ? C.l : C.L); }
    // pasangan, bergantian naik-turun
    const f = Math.abs(Math.floor(t * 2.2)) % 2;
    drawSprite(ctx, GROOM[f], 45, 29 + (f ? 0 : 0));
    drawSprite(ctx, BRIDE[1 - f], 56, 29);
    ctx.fillStyle = C.s; ctx.fillRect(54, 39, 3, 1); // bergandengan tangan
    // hati muncul dari tengah
    if (!reduced() && Math.random() < dt * 1.4) hearts.push({ x: 54 + Math.random() * 3, y: 27, life: 0, ph: Math.random() * 6 });
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i]; h.life += dt; h.y -= dt * 7; const x = h.x + Math.sin(h.life * 3 + h.ph) * 2;
      if (h.life > 3.2) { hearts.splice(i, 1); continue; }
      drawSprite(ctx, HEART, x - 2, h.y, h.life > 2.4 ? { R: C.d } : null);
    }
    // kelopak berjatuhan
    if (!reduced() && Math.random() < dt * 2.2) petals.push({ x: Math.random() * W, y: -2, ph: Math.random() * 6, c: [C.d, C.p, C.r, C.w][Math.floor(Math.random() * 4)] });
    for (let i = petals.length - 1; i >= 0; i--) {
      const p = petals[i]; p.y += dt * 9; const x = p.x + Math.sin(p.y / 5 + p.ph) * 3;
      if (p.y > 44) { petals.splice(i, 1); continue; }
      px(ctx, x, p.y, p.c); if (Math.floor(p.y) % 3 === 0) px(ctx, x + 1, p.y, p.c);
    }
    // kilau emas di atas gapura
    [[56, 6], [30, 14], [82, 14], [44, 8], [68, 8]].forEach(([x, y], i) => { const a = Math.sin(t * 3 + i * 1.7); if (a > 0.3) { px(ctx, x, y, C.y); if (a > 0.85) { px(ctx, x - 1, y, C.g); px(ctx, x + 1, y, C.g); px(ctx, x, y - 1, C.g); px(ctx, x, y + 1, C.g); } } });
  }
  if (reduced()) { drawScene(0, 0); return; }
  requestAnimationFrame(frame);
}

// ================= PAPAN ULAR TANGGA =================
const N = 10, S = 16, PAD = 4, BW = N * S + PAD * 2;
const LADDERS = [[3, 22], [8, 30], [28, 55], [51, 72], [63, 84], [71, 92]];
const SNAKES = [[46, 25], [62, 19], [87, 66], [98, 79]];
const cellXY = (n) => { const i = n - 1, r = Math.floor(i / N), c = r % 2 ? N - 1 - (i % N) : i % N; return [PAD + c * S, PAD + (N - 1 - r) * S]; };
const center = (n) => { const [x, y] = cellXY(n); return [x + S / 2, y + S / 2]; };
const ROWCOL = [["#fbf6ec", "#f3d9d6"], ["#fbf6ec", "#f5e1bd"], ["#fbf6ec", "#e6ebcf"], ["#fbf6ec", "#f6e0e3"], ["#fbf6ec", "#f5e0d4"]];
const B = { target: 1, shown: null, milestones: [], hop: 0, info: null, replay: false, raf: 0 };

export function setBoard({ start, end, today, milestones }) {
  const span = Math.max(1, end - start);
  const sq = (d) => Math.max(1, Math.min(100, d >= end ? 100 : 1 + Math.floor(((d - start) / span) * 99)));
  B.target = sq(today);
  B.milestones = milestones.map((m) => ({ ...m, sq: sq(m.date) }));
  if (B.shown == null) B.shown = reduced() ? B.target : 1;
  return B.target;
}
export function replayBoard() { B.shown = 1; B.hop = 0; }

function drawLadder(ctx, a, b) {
  const [x0, y0] = center(a), [x1, y1] = center(b);
  const len = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / len * 3, ny = (x1 - x0) / len * 3;
  line(ctx, x0 + nx, y0 + ny, x1 + nx, y1 + ny, C.t); line(ctx, x0 - nx, y0 - ny, x1 - nx, y1 - ny, C.t);
  for (let k = 3; k < len - 1; k += 4) { const u = k / len; line(ctx, x0 + (x1 - x0) * u + nx, y0 + (y1 - y0) * u + ny, x0 + (x1 - x0) * u - nx, y0 + (y1 - y0) * u - ny, C.y); }
}
function drawSnake(ctx, head, tail, t) {
  const [x0, y0] = center(head), [x1, y1] = center(tail);
  const len = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
  const steps = Math.ceil(len * 1.4);
  for (let k = steps; k >= 0; k--) {
    const u = k / steps, w = Math.sin(u * Math.PI * 3 + t * 2) * 3 * (0.4 + u * 0.6);
    const x = x0 + (x1 - x0) * u + nx * w, y = y0 + (y1 - y0) * u + ny * w;
    ctx.fillStyle = Math.floor(k / 3) % 2 ? "#3f6b34" : "#7f9a4a"; ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
  }
  ctx.fillStyle = "#2f4a2b"; ctx.fillRect(Math.round(x0) - 2, Math.round(y0) - 2, 4, 4);
  px(ctx, x0 - 1, y0 - 1, C.y); px(ctx, x0 + 1, y0 - 1, C.y);
  if (Math.sin(t * 4) > 0) { px(ctx, x0, y0 + 2, C.R); px(ctx, x0, y0 + 3, C.R); }
}

function drawBoard(ctx, t) {
  ctx.clearRect(0, 0, BW, BW);
  ctx.fillStyle = C.m; ctx.fillRect(0, 0, BW, BW);
  ctx.fillStyle = C.g; ctx.fillRect(1, 1, BW - 2, BW - 2); ctx.fillStyle = C.m; ctx.fillRect(2, 2, BW - 4, BW - 4);
  for (let n = 1; n <= 100; n++) {
    const [x, y] = cellXY(n), r = Math.floor((n - 1) / N), col = ROWCOL[r % ROWCOL.length][(n + r) % 2];
    ctx.fillStyle = n === 100 ? C.y : n <= B.shown && n < B.target + 1 ? col : col; ctx.fillRect(x, y, S, S);
    if (n < Math.round(B.shown)) { ctx.fillStyle = "rgba(201,161,94,.22)"; ctx.fillRect(x, y, S, S); }
    ctx.fillStyle = "rgba(92,13,22,.12)"; ctx.fillRect(x, y + S - 1, S, 1); ctx.fillRect(x + S - 1, y, 1, S);
    if (n !== 100) drawNum(ctx, n, x + 1, y + 1, n < B.shown ? C.m : C.n);
  }
  // hari H
  const [hx, hy] = cellXY(100); drawSprite(ctx, HEART_BIG, hx + 4, hy + 4 + (Math.sin(t * 3) > 0 ? 0 : 1));
  // mulai
  const [sx, sy] = cellXY(1); ctx.fillStyle = C.G; ctx.fillRect(sx + 2, sy + 9, 12, 5); ctx.fillStyle = C.c; drawNum(ctx, 1, sx + 7, sy + 9, C.c);
  LADDERS.forEach(([a, b]) => drawLadder(ctx, a, b));
  SNAKES.forEach(([h, tl]) => drawSnake(ctx, h, tl, t));
  // bendera = langkah timeline
  B.milestones.forEach((m) => {
    if (m.sq >= 100) return; const [x, y] = cellXY(m.sq);
    const blink = m.next && Math.sin(t * 6) > 0;
    drawSprite(ctx, FLAG, x + S - 5, y + 2, { g: m.done ? "#4f7a3a" : blink ? C.R : C.g });
  });
  // pion pasangan
  const from = Math.floor(B.shown), u = B.shown - from;
  const [ax, ay] = center(from), [bx, by] = center(Math.min(100, from + 1));
  const jump = Math.sin(u * Math.PI) * 5;
  const tx = ax + (bx - ax) * u - 4, ty = ay + (by - ay) * u - 6 - jump - (B.shown >= B.target && Math.sin(t * 4) > 0.6 ? 1 : 0);
  ctx.fillStyle = "rgba(44,10,15,.25)"; ctx.fillRect(Math.round(ax + (bx - ax) * u) - 3, Math.round(ay + (by - ay) * u) + 3, 6, 1);
  drawSprite(ctx, MINI_COUPLE, tx, ty);
  if (B.shown >= B.target) { const hy2 = ty - 6 - ((t * 6) % 6); drawSprite(ctx, HEART, tx + 2, hy2, (t * 6) % 6 > 4 ? { R: C.d } : null); }
}

export function mountBoard() {
  const cv = document.getElementById("ularTangga"); if (!cv) return;
  fit(cv, BW, BW, 5);
  const ctx = cv.getContext("2d");
  cancelAnimationFrame(B.raf);
  let last = performance.now();
  const step = (now) => {
    const el = document.getElementById("ularTangga"); if (el !== cv) return; // halaman sudah dirender ulang
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (B.shown < B.target) { B.shown = Math.min(B.target, B.shown + dt * (B.target - B.shown > 20 ? 9 : 5)); }
    else if (B.shown > B.target) B.shown = B.target;
    if (!document.hidden) drawBoard(ctx, now / 1000);
    const lbl = document.getElementById("utPos"); if (lbl) lbl.textContent = Math.floor(B.shown);
    if (!reduced()) B.raf = requestAnimationFrame(step);
  };
  if (reduced()) { B.shown = B.target; drawBoard(ctx, 0); return; }
  B.raf = requestAnimationFrame(step);
}
addEventListener("resize", () => { const cv = document.getElementById("ularTangga"); if (cv) fit(cv, BW, BW, 5); });

// ================= KARTU VIRTUAL PET (foto CPP & CPW versi pixel) =================
const imgCache = {};
const loadImg = (src) => imgCache[src] || (imgCache[src] = new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = src; }));
// crop: [x, y, w, h] dalam pecahan 0–1 dari ukuran foto
export async function pixelatePhoto(canvas, src, crop = [0, 0, 1, 1], cols = 36, rows = 45) {
  try {
    const im = await loadImg(src);
    canvas.width = cols; canvas.height = rows;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let [cx, cy, cw, ch] = crop.map((v, i) => v * (i % 2 ? im.naturalHeight : im.naturalWidth));
    // samakan rasio dengan kanvas
    const want = cols / rows;
    if (cw / ch > want) { const nw = ch * want; cx += (cw - nw) / 2; cw = nw; } else { const nh = cw / want; cy += (ch - nh) / 2; ch = nh; }
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(im, cx, cy, cw, ch, 0, 0, cols, rows);
    const d = ctx.getImageData(0, 0, cols, rows), a = d.data, lv = 8, stepv = 255 / (lv - 1);
    for (let i = 0; i < a.length; i += 4) for (let k = 0; k < 3; k++) {
      let v = (a[i + k] - 128) * 1.12 + 136; // sedikit kontras & cerah
      a[i + k] = Math.max(0, Math.min(255, Math.round(v / stepv) * stepv));
    }
    ctx.putImageData(d, 0, 0);
  } catch (e) { console.warn("foto pixel", src, e); }
}
// wajah pixel 8×8: senang / biasa / sedih
export function pixelFace(mood) {
  const rows = {
    senang: ["..####..", ".#....#.", "#.#..#.#", "#......#", "#.#..#.#", "#..##..#", ".#....#.", "..####.."],
    biasa: ["..####..", ".#....#.", "#.#..#.#", "#......#", "#......#", "#.####.#", ".#....#.", "..####.."],
    sedih: ["..####..", ".#....#.", "#.#..#.#", "#......#", "#..##..#", "#.#..#.#", ".#....#.", "..####.."]
  }[mood] || [];
  const fill = mood === "senang" ? "#f7e27a" : mood === "biasa" ? "#f6c7a0" : "#f2a9b0";
  let r = `<rect x="1" y="1" width="6" height="6" fill="${fill}"/><rect x="2" y="0" width="4" height="8" fill="${fill}"/><rect x="0" y="2" width="8" height="4" fill="${fill}"/>`;
  rows.forEach((row, y) => row.split("").forEach((c, x) => { if (c === "#") r += `<rect x="${x}" y="${y}" width="1" height="1" fill="#3b2a35"/>`; }));
  return `<svg class="pf" viewBox="0 0 8 8" width="18" height="18" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
}
export function pixelHeart(full = 1, size = 22) { // full: 1 penuh, .5 setengah, 0 kosong
  const H = [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."];
  let r = "";
  H.forEach((row, y) => row.split("").forEach((c, x) => { if (c !== "#") return; const on = full >= 1 || (full > 0 && x < 4); r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${on ? "#f07fa0" : "#f8d3df"}"/>`; }));
  return `<svg viewBox="-.5 -.5 8 7" width="${size}" height="${size * 0.875}" shape-rendering="crispEdges" aria-hidden="true"><g stroke="#8a3a5a" stroke-width=".18">${r}</g></svg>`;
}
export function petBurst(screen) {
  if (!screen || reduced()) return;
  for (let i = 0; i < 12; i++) {
    const s = document.createElement("span");
    s.className = "pet-heart"; s.innerHTML = pixelHeart(1, 14 + Math.round(Math.random() * 12));
    s.style.left = 30 + Math.random() * 40 + "%"; s.style.animationDelay = i * 0.07 + "s";
    s.style.setProperty("--dx", (Math.random() * 120 - 60).toFixed(0) + "px");
    screen.appendChild(s); setTimeout(() => s.remove(), 2200);
  }
}
