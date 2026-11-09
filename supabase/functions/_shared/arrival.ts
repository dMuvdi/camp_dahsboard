import { camp, inWindow } from "./camp.ts";

// Self check-in from the NFC sticker on the staff badges: the first tap checks the camper in, the next one out, each
// only inside its window. No staff member approves exceptions here; for those they use the QR scanner.
export interface ArrivalState {
    has_signed: boolean | null;
    checked_in: boolean | null;
    checked_out: boolean | null;
}

export type Arrival =
    | { ok: true; update: { checked_in: true } | { checked_out: true } | null; title: string; message: string }
    | { ok: false; message: string };

export function arrival(p: ArrivalState, now = new Date()): Arrival {
    if (p.checked_out) return { ok: true, update: null, title: "Ya hiciste check-out", message: "Tu salida ya está registrada. ¡Gracias por venir!" };
    if (p.checked_in) {
        if (inWindow(camp.checkOut, now)) return { ok: true, update: { checked_out: true }, title: "Check-out registrado", message: "¡Gracias por venir! Buen regreso a casa." };
        return { ok: true, update: null, title: "Ya tienes check-in", message: `Tu llegada ya está registrada. El check-out es el ${camp.checkOut.label}.` };
    }
    if (!p.has_signed) return { ok: false, message: "Aún no has firmado el consentimiento. Acércate al staff para registrarte." };
    if (!inWindow(camp.checkIn, now)) return { ok: false, message: `El check-in es el ${camp.checkIn.label}.` };
    return { ok: true, update: { checked_in: true }, title: "Check-in registrado", message: `¡Bienvenido(a) a ${camp.name}!` };
}
