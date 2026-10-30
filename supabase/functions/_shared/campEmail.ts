import { Buffer } from "node:buffer";
import nodemailer from "nodemailer";
import QRCode from "qrcode";
import { camp } from "./camp.ts";
import { c, contractEmail, ticketEmail } from "./emailTemplates.ts";
import { env } from "./env.ts";

type Attachment = { filename: string; cid: string; content?: Buffer; path?: string; contentType?: string; contentDisposition?: "inline" };

// Sends the camp emails (boarding pass with QR, consent signing link) over SMTP from the consent Edge Function.
// The HTML lives in emailTemplates.ts.
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

// Images embedded by CID, fetched from the public site
const assets: Record<CampEmail["emailType"], [file: string, cid: string][]> = {
    ticket: [["logos/revelation_logo_white.png", "camp_logo"], ["logos/vida_logo_white.PNG", "vida_logo"], ["brand/boat-parchment.png", "boat"]],
    contract: [["logos/revelation_logo_white.png", "camp_logo"], ["logos/vida_logo_white.PNG", "vida_logo"]],
};

// Throws when SMTP is not configured or the message can't be sent
export async function sendCampEmail({ emailType, to, fullName, userId, origin, contractUrl, minorName }: CampEmail) {
    try {
        const host = env("SMTP_HOST");
        const port = Number(env("SMTP_PORT") ?? 587);
        const user = env("SMTP_USER");
        const pass = env("SMTP_PASS");
        const from = env("SMTP_FROM") || user;

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
            ? contractEmail(fullName, contractUrl, minorName)
            : ticketEmail(fullName);

        const baseUrl = origin;
        const attachments: Attachment[] = await Promise.all(assets[emailType].map(async ([file, cid]) => {
            const filename = file.split('/').pop()!;
            try {
                const res = await fetch(`${baseUrl}/${file}`, { cache: 'no-store' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return { filename, cid, content: Buffer.from(await res.arrayBuffer()), contentDisposition: 'inline' as const };
            } catch (e) {
                // local dev or a protected preview: read it from disk instead (Node only)
                console.warn(`Email asset ${file} not fetched, using the file on disk`, e);
                return { filename, cid, path: `${typeof process !== 'undefined' ? process.cwd() : '.'}/public/${file}`, contentDisposition: 'inline' as const };
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
