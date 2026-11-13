// Ikon garis sederhana (24×24) yang mengikuti warna teks (currentColor).
const P = {
  home: '<path d="M4 11.5 12 5l8 6.5"/><path d="M6.5 10v9h11v-9"/><path d="M10.2 19v-3.6a1.8 1.8 0 0 1 3.6 0V19"/><path d="M12 12.6c-.9-.9-2.2-.2-1.7.9.4.8 1.7 1.6 1.7 1.6s1.3-.8 1.7-1.6c.5-1.1-.8-1.8-1.7-.9z" fill="currentColor" stroke="none"/>',
  ring: '<circle cx="12" cy="14.5" r="5.5"/><path d="M9.5 6.5 12 3.5l2.5 3-2.5 2.5z"/><path d="M10.5 9.3 12 9l1.5.3"/>',
  wallet: '<rect x="3.5" y="7" width="17" height="12" rx="2.5"/><path d="M6 7l9-3.2c.8-.3 1.6.3 1.6 1.1V7"/><path d="M20.5 11h-3.8a2 2 0 0 0 0 4h3.8"/><circle cx="16.8" cy="13" r=".6" fill="currentColor"/>',
  piggy: '<path d="M18.5 11.5c0-3.3-3-5.5-6.8-5.5-4.1 0-7.2 2.6-7.2 6 0 1.9.9 3.3 2.3 4.3V19h2.4v-1.6c.8.2 1.7.3 2.6.3s1.6-.1 2.4-.3V19h2.4v-2.6c1-.8 1.6-1.7 1.9-2.7H20v-2.2z"/><circle cx="15.4" cy="10.6" r=".7" fill="currentColor"/><path d="M10 6.2c0-1.4 1-2.4 2.2-2.4s2.2 1 2.2 2.4"/>',
  guests: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.4-3.2 2.6-5 5.5-5s5.1 1.8 5.5 5"/><path d="M17.3 9.6c-.8-.8-2-.2-1.6.8.3.7 1.6 1.5 1.6 1.5s1.3-.8 1.6-1.5c.4-1-.8-1.6-1.6-.8z" fill="currentColor" stroke="none"/><path d="M15.5 14.4c2.6.2 4.4 1.9 4.8 4.6"/>',
  check: '<rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><path d="M8 8.5l1.3 1.3L11.8 7.3"/><path d="M13.5 8.5H16"/><path d="M8 13.5l1.3 1.3 2.5-2.5"/><path d="M13.5 13.5H16"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11"/><path d="M12 9c-1.2-3.4-5.2-4.4-5.2-2 0 1.4 2.3 2 5.2 2zM12 9c1.2-3.4 5.2-4.4 5.2-2 0 1.4-2.3 2-5.2 2z"/>',
  store: '<path d="M4 9.5 5.5 4.5h13L20 9.5"/><path d="M4 9.5c0 1.4 1.1 2.3 2.7 2.3S9.3 10.9 9.3 9.5c0 1.4 1.1 2.3 2.7 2.3s2.7-.9 2.7-2.3c0 1.4 1.1 2.3 2.6 2.3S20 10.9 20 9.5"/><path d="M5.5 12v7.5h13V12"/><path d="M10 19.5v-4h4v4"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  envelope: '<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 6 8-6"/><path d="M12 15.9c-.7-.7-1.8-.2-1.4.7.3.6 1.4 1.3 1.4 1.3s1.1-.7 1.4-1.3c.4-.9-.7-1.4-1.4-.7z" fill="currentColor" stroke="none"/>',
  palette: '<path d="M12 3.5c-4.8 0-8.5 3.6-8.5 8.2 0 4.4 3.6 8.3 8 8.3 1.5 0 2-1 1.5-2-.5-1.1.1-2.3 1.4-2.3h1.8c2.5 0 4.3-1.9 4.3-4.3 0-4.4-3.8-7.9-8.5-7.9z"/><circle cx="8" cy="11" r="1.2" fill="currentColor"/><circle cx="10.5" cy="7.5" r="1.2" fill="currentColor"/><circle cx="14.6" cy="7.6" r="1.2" fill="currentColor"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M6 18l1.6-1.6M16.4 7.6 18 6"/>',
  menu: '<circle cx="6" cy="6" r="1.8"/><circle cx="12" cy="6" r="1.8"/><circle cx="18" cy="6" r="1.8"/><circle cx="6" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18" cy="12" r="1.8"/><circle cx="6" cy="18" r="1.8"/><circle cx="12" cy="18" r="1.8"/><circle cx="18" cy="18" r="1.8"/>',
  heart: '<path d="M12 19.5s-7.5-4.4-7.5-9.6A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7.5 2.3c0 5.2-7.5 9.6-7.5 9.6z"/>',
  flower: '<circle cx="12" cy="8.8" r="1.7"/><circle cx="12" cy="5.4" r="2"/><circle cx="15.3" cy="7.7" r="2"/><circle cx="14.1" cy="11.6" r="2"/><circle cx="9.9" cy="11.6" r="2"/><circle cx="8.7" cy="7.7" r="2"/><path d="M12 13.6v7"/><path d="M12 17.6c-1.4-1.5-3.3-1.4-3.8-1 .9 1.5 2.5 1.8 3.8 1z"/>',
  sparkle: '<path d="M12 3.5c.6 4 2.5 6 6.5 6.5-4 .6-5.9 2.5-6.5 6.5-.6-4-2.5-5.9-6.5-6.5 4-.5 5.9-2.5 6.5-6.5z"/><path d="M18.5 15.5c.2 1.3.8 2 2 2.2-1.2.2-1.8.9-2 2.2-.2-1.3-.9-2-2.1-2.2 1.2-.2 1.9-.9 2.1-2.2z"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/><path d="M12 13.7c-.8-.8-2-.2-1.6.8.3.7 1.6 1.6 1.6 1.6s1.3-.9 1.6-1.6c.4-1-.8-1.6-1.6-.8z" fill="currentColor" stroke="none"/>',
  doc: '<path d="M7 3.5h7l4 4v13H7z"/><path d="M14 3.5v4h4"/><path d="M9.5 12h6M9.5 15h6M9.5 18h3.5"/>',
  camera: '<rect x="3.5" y="7" width="17" height="12" rx="2.5"/><path d="M8.5 7l1.4-2.5h4.2L15.5 7"/><circle cx="12" cy="13" r="3.3"/>',
  dress: '<path d="M9.5 3.5h5l-1 4 4.5 12.5h-12L10.5 7.5z"/><path d="M10.5 7.5h3"/>',
  people: '<circle cx="8" cy="8" r="2.6"/><circle cx="16" cy="8" r="2.6"/><path d="M3.5 18.5c.3-2.8 2.1-4.4 4.5-4.4s4.2 1.6 4.5 4.4M11.5 18.5c.3-2.8 2.1-4.4 4.5-4.4s4.2 1.6 4.5 4.4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4.5 19.5l1-4L15.8 5.2a2 2 0 0 1 2.9 0l.1.1a2 2 0 0 1 0 2.9L8.5 18.5z"/><path d="M14 7l3 3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  coin: '<ellipse cx="12" cy="7" rx="6.5" ry="2.8"/><path d="M5.5 7v5c0 1.5 2.9 2.8 6.5 2.8s6.5-1.3 6.5-2.8V7"/><path d="M5.5 12v5c0 1.5 2.9 2.8 6.5 2.8s6.5-1.3 6.5-2.8v-5"/>',
  logout: '<path d="M14 4.5H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h7"/><path d="M11 12h9M17 8.5l3.5 3.5-3.5 3.5"/>'
};
export const ICON_NAMES = Object.keys(P);
export const icon = (n, size = 20, cls = "ic") =>
  `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || P.sparkle}</svg>`;
