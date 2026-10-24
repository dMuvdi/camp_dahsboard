import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import QRCode from "qrcode";
import { camp } from "@/lib/camp";

// Camp emails (boarding pass with QR, consent signing link). Server only: called from API routes, never from the browser.
// Layout follows the 2026 boarding pass in Canva (DAG0pUL8Kks) on the Revelation palette. Email HTML: tables and inline
// styles so Gmail, Outlook and Apple Mail agree; web fonts load where supported and fall back to Georgia / Arial.

const c = { oxblood: "#4f0100", deep: "#2a0100", parchment: "#f3edd8", ink: "#142840", glass: "#016d32", muted: "#5b6577" };
const display = "'Cinzel', Georgia, 'Times New Roman', serif";
const sans = "'Montserrat', Arial, Helvetica, sans-serif";

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

function shell(title: string, preheader: string, body: string) {
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light only">
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Montserrat:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  body { margin: 0; padding: 0; background: ${c.oxblood}; }
  a { color: ${c.oxblood}; }
  @media (max-width: 480px) {
    .px { padding-left: 20px !important; padding-right: 20px !important; }
    .stack { display: block !important; width: 100% !important; }
    .qr { padding: 20px 0 0 0 !important; text-align: center !important; }
    .route { font-size: 34px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${c.oxblood};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${c.oxblood};">
<tr><td align="center" style="padding:24px 12px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td align="center" style="padding:8px 0 28px;">
  <img src="cid:camp_logo" alt="${camp.name}" height="44" style="height:44px;width:auto;border:0;display:inline-block;vertical-align:middle;">
  <span style="display:inline-block;width:28px;"></span>
  <img src="cid:vida_logo" alt="Ministerio Juvenil VIDA" height="36" style="height:36px;width:auto;border:0;display:inline-block;vertical-align:middle;">
</td></tr>
${body}
<tr><td align="center" style="padding:28px 16px 0;font-family:${sans};font-size:13px;line-height:20px;color:${c.parchment};opacity:.8;">
  ¿Preguntas? Escríbenos a <a href="mailto:${camp.contactEmail}" style="color:${c.parchment};font-weight:600;">${camp.contactEmail}</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

// Ticket perforation: half circles take the page color, dashes in between
const perforation = `<tr><td style="padding:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
  <td width="14" style="width:14px;height:28px;background:${c.oxblood};border-radius:0 14px 14px 0;font-size:0;">&nbsp;</td>
  <td style="border-top:2px dashed #d9d2c3;font-size:0;">&nbsp;</td>
  <td width="14" style="width:14px;height:28px;background:${c.oxblood};border-radius:14px 0 0 14px;font-size:0;">&nbsp;</td>
</tr></table>
</td></tr>`;

const label = (text: string) =>
    `<div style="font-family:${sans};font-size:12px;line-height:16px;font-weight:700;color:${c.oxblood};text-transform:none;">${text}</div>`;

function generateTicketEmail(fullName: string): string {
    const name = escapeHtml(fullName.toUpperCase());
    const check = (text: string) =>
        `<tr><td valign="top" style="padding:4px 10px 4px 0;font-family:${sans};font-size:14px;color:${c.glass};font-weight:700;">✓</td><td style="padding:4px 0;font-family:${sans};font-size:14px;line-height:20px;color:${c.ink};">${text}</td></tr>`;

    const body = `
<tr><td align="center" style="font-family:${display};font-size:22px;letter-spacing:8px;color:${c.parchment};padding:0 0 14px;">BOARDING PASS</td></tr>
<tr><td style="padding:0 24px;"><div style="height:1px;background:${c.parchment};opacity:.5;font-size:0;">&nbsp;</div></td></tr>
<tr><td align="center" style="padding:18px 0 6px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td class="route" style="font-family:${display};font-size:44px;color:${c.parchment};">CTG</td>
    <td style="padding:0 22px;"><img src="cid:boat" alt="" width="64" style="width:64px;height:auto;border:0;display:block;"></td>
    <td class="route" style="font-family:${display};font-size:44px;color:${c.parchment};">BCH</td>
  </tr></table>
</td></tr>
<tr><td align="center" style="font-family:${sans};font-size:12px;color:${c.parchment};opacity:.75;padding:0 0 22px;">Cartagena &nbsp;→&nbsp; Isla de Bocachica</td></tr>
<tr><td class="px" style="padding:0 8px 12px;font-family:${sans};font-size:17px;font-weight:700;letter-spacing:.5px;color:#ffffff;">${name}</td></tr>
<tr><td style="background:#ffffff;border-radius:20px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td class="px" style="padding:26px 28px 6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td class="stack" valign="top" style="width:55%;">
          ${label("Fecha")}
          <div style="font-family:${sans};font-size:14px;line-height:20px;color:${c.ink};margin:2px 0 16px;">${camp.boardingDay}</div>
          ${label("Embarque")}
          <div style="font-family:${sans};font-size:28px;line-height:32px;font-weight:700;color:${c.ink};margin:2px 0 0;">${camp.boardingTime}</div>
          <div style="font-family:${sans};font-size:12px;line-height:18px;color:${c.muted};margin:0 0 16px;">${camp.boardingPlace}</div>
          ${label("Equipaje permitido")}
          <div style="font-family:${sans};font-size:14px;line-height:20px;color:${c.ink};margin:2px 0 0;">1 bolso o morral, máx. 12 kg (40 × 35 × 25 cm)</div>
        </td>
        <td class="stack qr" valign="top" align="right" style="width:45%;padding-left:12px;">
          <img src="cid:qr-code" alt="Tu código QR de acceso" width="170" style="width:170px;max-width:100%;height:auto;border:0;display:inline-block;">
        </td>
      </tr></table>
    </td></tr>
    <tr><td align="center" class="px" style="padding:18px 28px 18px;font-family:${display};font-size:22px;color:${c.oxblood};">El viaje está por comenzar</td></tr>
    ${perforation}
    <tr><td class="px" style="padding:14px 28px 26px;">
      <div style="font-family:${sans};font-size:15px;font-weight:700;color:${c.ink};margin:0 0 6px;">Antes de embarcar</div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        ${check("Documento de identidad")}
        ${check("Este código QR en tu celular o impreso")}
        ${check("Equipaje dentro de las medidas permitidas")}
        ${check("Llegar con anticipación al muelle")}
      </table>
    </td></tr>
  </table>
</td></tr>`;

    return shell(`Pase de abordaje - ${camp.name}`, `Tu pase de abordaje para ${camp.name}: ${camp.boardingDay}, ${camp.boardingTime}.`, body);
}

// minorName set: the email goes to the adult a parent named as the minor's manager
function generateContractSigningEmail(fullName: string, contractUrl?: string, minorName?: string): string {
    const name = escapeHtml(fullName);
    const url = contractUrl ?? "";
    const minor = minorName ? escapeHtml(minorName) : "";
    const step = (n: number, text: string) =>
        `<tr><td valign="top" style="padding:6px 12px 6px 0;"><div style="width:24px;height:24px;line-height:24px;border-radius:12px;background:${c.parchment};color:${c.oxblood};font-family:${sans};font-size:12px;font-weight:700;text-align:center;">${n}</div></td><td style="padding:8px 0 6px;font-family:${sans};font-size:14px;line-height:20px;color:${c.ink};">${text}</td></tr>`;

    const body = `
<tr><td align="center" style="font-family:${display};font-size:24px;letter-spacing:4px;color:${c.parchment};padding:0 0 22px;">Firma de consentimiento</td></tr>
<tr><td style="background:#ffffff;border-radius:20px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td class="px" style="padding:28px 28px 8px;font-family:${sans};">
      <div style="font-size:14px;color:${c.muted};">Hola,</div>
      <div style="font-size:18px;font-weight:700;color:${c.ink};margin:2px 0 14px;">${name}</div>
      <div style="font-size:15px;line-height:23px;color:${c.ink};">
        ${minor
            ? `El padre, madre o tutor(a) de <strong>${minor}</strong> te autorizó como su responsable durante ${camp.name} (${camp.dates}). Lee la autorización y fírmala para completar su inscripción.`
            : `Para participar en ${camp.name} (${camp.dates}) necesitamos tu consentimiento informado firmado. Cuando lo firmes te enviaremos tu código QR de acceso.`}
      </div>
    </td></tr>
    <tr><td align="center" class="px" style="padding:22px 28px 24px;">
      <a href="${url}" style="display:inline-block;background:${c.oxblood};color:#ffffff;font-family:${sans};font-size:15px;font-weight:700;text-decoration:none;padding:15px 34px;border-radius:14px;">${minor ? "Firmar autorización" : "Firmar consentimiento"}</a>
    </td></tr>
    ${perforation}
    <tr><td class="px" style="padding:12px 28px 26px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        ${minor
            ? `${step(1, "Toca el botón y lee la autorización con calma.")}
        ${step(2, "Firma con el dedo o el mouse y envíala.")}
        ${step(3, `${minor} recibirá su pase de abordaje con el código QR.`)}`
            : `${step(1, "Toca el botón y lee el documento con calma.")}
        ${step(2, "Si el campista es menor de edad, lo firma su padre, madre o tutor(a).")}
        ${step(3, "Firma con el dedo o el mouse y envíalo.")}
        ${step(4, "Recibirás tu pase de abordaje con el código QR en este correo.")}`}
      </table>
    </td></tr>
  </table>
</td></tr>`;

    return shell(`Firma de consentimiento - ${camp.name}`, `Firma tu consentimiento para ${camp.name}.`, body);
}

export interface CampEmail {
    emailType: "ticket" | "contract";
    to: string;
    fullName: string;
    userId: string;
    // site origin, used for the signing link and to fetch the logos
    origin: string;
    contractUrl?: string;
    // contract emails for a minor's appointed manager: the minor's full name
    minorName?: string;
}

// Images embedded by CID; fetched from the site because Vercel functions don't ship /public
const assets: Record<CampEmail["emailType"], [file: string, cid: string][]> = {
    ticket: [["logos/revelation_logo_white.png", "camp_logo"], ["logos/vida_logo_white.PNG", "vida_logo"], ["brand/boat-parchment.png", "boat"]],
    contract: [["logos/revelation_logo_white.png", "camp_logo"], ["logos/vida_logo_white.PNG", "vida_logo"]],
};

// Throws when SMTP is not configured or the message can't be sent
export async function sendCampEmail({ emailType, to, fullName, userId, origin, contractUrl, minorName }: CampEmail) {
    try {
        const host = process.env.SMTP_HOST;
        const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        const from = process.env.SMTP_FROM || user;

        if (!host || !user || !pass) {
            throw new Error("SMTP env vars not configured");
        }

        const transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user, pass },
        });

        // Proactively verify SMTP connectivity (helps diagnose production issues)
        try {
            await transporter.verify();
        } catch (err) {
            console.error('SMTP verify failed', err);
            throw new Error('SMTP connection failed. Please verify host/port/user/pass and allow SMTP on your provider.');
        }

        const html = emailType === "contract"
            ? generateContractSigningEmail(fullName, contractUrl, minorName)
            : generateTicketEmail(fullName);

        const baseUrl = origin || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
        const attachments: Mail.Attachment[] = await Promise.all(assets[emailType].map(async ([file, cid]) => {
            const filename = file.split('/').pop()!;
            try {
                const res = await fetch(`${baseUrl}/${file}`, { cache: 'no-store' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return { filename, cid, content: Buffer.from(await res.arrayBuffer()), contentDisposition: 'inline' as const };
            } catch (e) {
                // local dev or a protected preview: read it from disk instead
                console.warn(`Email asset ${file} not fetched, using the file on disk`, e);
                return { filename, cid, path: `${process.cwd()}/public/${file}`, contentDisposition: 'inline' as const };
            }
        }));

        // The QR encodes the participant id; the scanner looks it up at check-in
        if (emailType === "ticket") {
            attachments.push({
                filename: 'qr.png',
                content: await QRCode.toBuffer(String(userId), { type: 'png', margin: 1, scale: 8, color: { dark: c.ink, light: '#ffffff' } }),
                contentType: 'image/png',
                cid: 'qr-code',
            });
        }

        await transporter.sendMail({
            from,
            to,
            subject: emailType === "contract"
                ? (minorName ? `Autorización como responsable de ${minorName} - ${camp.name}` : `Firma de Consentimiento - ${camp.name}`)
                : `Tu pase de abordaje - ${camp.name}`,
            html,
            text: emailType === "contract"
                ? `Hola ${fullName}, este es el link para firmar tu consentimiento: ${contractUrl}`
                : `Hola ${fullName}! Aquí tienes tu pase de abordaje con el código QR para el check-in de ${camp.name}. ${camp.boardingDay}, ${camp.boardingTime}, ${camp.boardingPlace}.`,
            attachments,
        });
    } catch (error) {
        console.error("send-email error", error);
        throw error;
    }
}
