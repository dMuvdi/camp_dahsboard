// This year's camp facts, shared by the web app and the consent Edge Function.
export const camp = {
    name: 'Revelation Camp',
    year: 2026,
    dates: 'del 13 al 15 de noviembre de 2026',
    boardingDay: 'Viernes, 13 de noviembre de 2026',
    boardingTime: '7:00 a. m.',
    boardingPlace: 'Muelle Turístico de Manga',
    contactEmail: 'vida@iglesiacbicartagena.com',
    // Scanner time windows, Colombia time (UTC-5, no daylight saving)
    // open the whole camp so leaders who arrive late can still check in; it closes when check-out opens
    checkIn: { start: '2026-11-13T06:00:00-05:00', end: '2026-11-15T09:00:00-05:00', label: 'del viernes 13 de noviembre a las 6:00 a. m. al domingo 15 a las 9:00 a. m.' },
    checkOut: { start: '2026-11-15T09:00:00-05:00', end: '2026-11-15T14:00:00-05:00', label: 'domingo 15 de noviembre, de 9:00 a. m. a 2:00 p. m.' },
}

// true while now is inside a check-in or check-out window
export const inWindow = (w: { start: string; end: string }, now = new Date()) => now >= new Date(w.start) && now <= new Date(w.end)
