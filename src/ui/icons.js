/** 線画アイコン（24×24、currentColor） */
const P = {
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8h14v-8"/><path d="M12 8v12"/><path d="M12 8c-1.5-3-5-3.5-5-1.2C7 8.5 10 8 12 8zM12 8c1.5-3 5-3.5 5-1.2C17 8.5 14 8 12 8z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5L12 13l8.5-6.5"/>',
  layout: '<path d="M3 21V9l9-6 9 6v12"/><path d="M9 21v-7h6v7"/>',
  shop: '<path d="M4 10v10h16V10"/><path d="M2 10l2-6h16l2 6a3.3 3.3 0 0 1-6.7 0 3.3 3.3 0 0 1-6.6 0A3.3 3.3 0 0 1 2 10z"/><path d="M10 20v-5h4v5"/>',
  ally: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12c1.5-2 5-2 6.5 0-1.5 2-5 2-6.5 0z"/><path d="M15 12l2-1.5v3z"/>',
  expedition: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  items: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
  more: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>',
  cloud: '<path d="M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 10.5 3.8 3.8 0 0 1 17.5 18z"/>',
  rain: '<path d="M7 14a4 4 0 0 1-.5-8A6 6 0 0 1 18 6.5 3.8 3.8 0 0 1 17.5 14z"/><path d="M8 18l-1 3M13 18l-1 3M18 18l-1 3"/>',
  snow: '<path d="M7 14a4 4 0 0 1-.5-8A6 6 0 0 1 18 6.5 3.8 3.8 0 0 1 17.5 14z"/><path d="M8 18v.01M12 20v.01M16 18v.01"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-4 3-6 6.5-6s6 2 6.5 6"/><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.5c2 .8 3.2 2.7 3.5 5.5"/>',
  coin: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><path d="M9.5 12c1-1.3 3-1.3 4 0-1 1.3-3 1.3-4 0zM13.5 12l1.3-.9v1.8z"/>',
  gem: '<path d="M6 4h12l3 5-9 11L3 9z"/><path d="M3 9h18M9 4l-1.5 5L12 20l4.5-11L15 4"/>',
  clean: '<path d="M14 3l7 7"/><path d="M17.5 6.5L11 13"/><path d="M11 10l3 3-5 8-6-6z"/>',
  event: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M12 13l1 2 2 .3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1L9 15.3l2-.3z"/>',
  staff: '<circle cx="12" cy="7" r="3.5"/><path d="M5 21c.5-5 3.300-8 7-8s6.5 3 7 8"/><path d="M12 13v4"/>',
  map: '<path d="M9 4L3 6.5v14L9 18l6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v14M15 6.5v14"/>',
  care: '<path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z"/>',
  zukan: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21a2 2 0 0 1 2-2h13v2H6"/><path d="M9 9c2-2.5 5-2.5 7 0-2 2.5-5 2.5-7 0z"/>',
  account: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.5 4-7 8-7s7.2 2.5 8 7"/>',
};
export const icon = (name, size = 22) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`;
