// ─────────────────────────────────────────────────────────────────────────────
//  EVENT SETTINGS: the only file you need to touch to change what the site sells.
//
//  • Prices are in rupees.
//  • Restart the server after editing.
//  • NEVER change a pass `id` after the first ticket is sold: it is stored on
//    every ticket. You can change names, prices, emoji, capacity freely.
// ─────────────────────────────────────────────────────────────────────────────

export default {
  brand: 'DELULU PRODUCTION',

  event: {
    name: 'Navratri Nights',
    tagline: 'Dandiya • Music • Food • Fun',
    date: 'October 2026', // e.g. 'Sat, 17 Oct 2026' once the date is locked
    time: 'Time to be announced', // e.g. '6 PM – 11 PM'
    venue: 'Begumpet Hockey Grounds',
    city: 'Hyderabad',
    mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Begumpet+Hockey+Grounds+Hyderabad',
    contactPhone: '', // shown in the footer and emails, e.g. '+91 98xxx xxxxx'
    contactEmail: '',
    instagram: '', // handle without @, e.g. 'delulu.production'
  },

  // Master switch. false = the site shows "Sales closed" and stops taking orders.
  salesOpen: true,
  // Most passes one person can buy in a single checkout.
  maxPerOrder: 10,
  // How long an unpaid checkout reserves passes before they go back on sale.
  holdMinutes: 15,
  // Venue limit across ALL pass types (null = no overall limit).
  totalCapacity: null,

  // Things that get handed out once per pass at a counter. Each one becomes a
  // scanner mode, so the food counter can scan passes just like the gate does.
  perks: {
    food: { label: 'Food', icon: '🍽️' },
    sticks: { label: 'Dandiya sticks', icon: '🥢' },
  },

  // audience: 'student' → shown under "Student passes" and the gate is told to
  //                       check a college ID.
  //           'all'     → shown under "Open to all".
  // includes: what the card lists. redeem: which perks the scanner will hand out.
  // capacity: max of this pass that can be sold (null = no limit).
  passes: [
    {
      id: 'student',
      audience: 'student',
      name: 'Student Pass',
      emoji: '🎟️',
      price: 299,
      blurb: 'Entry for college students',
      includes: ['Entry'],
      redeem: [],
      capacity: null,
    },
    {
      id: 'student-food',
      audience: 'student',
      name: 'Student Pass + Food',
      emoji: '🍽️',
      price: 449,
      blurb: 'Student entry with food',
      includes: ['Entry', 'Food'],
      redeem: ['food'],
      capacity: null,
    },
    {
      id: 'general',
      audience: 'all',
      name: 'General Adult Pass',
      emoji: '🎫',
      price: 399,
      blurb: 'Entry for adults, no student ID needed',
      includes: ['Entry'],
      redeem: [],
      capacity: null,
    },
    {
      id: 'vip',
      audience: 'all',
      name: 'VIP + Food + Sticks',
      emoji: '👑',
      price: 649,
      blurb: 'VIP entry, food and your own dandiya sticks',
      includes: ['VIP entry', 'Food', 'Dandiya sticks'],
      redeem: ['food', 'sticks'],
      capacity: null,
    },
  ],
};
