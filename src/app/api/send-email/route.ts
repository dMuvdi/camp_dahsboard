import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import QRCode from "qrcode";

export const runtime = "nodejs";

// Generate ticket email HTML (QR code email - kept unchanged)
function generateTicketEmail(fullName: string): string {
    return `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Ticket de Embarque - Relevante Camp</title>
            <link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@300;400;600;700;800;900&display=swap" rel="stylesheet">
            <!--[if mso]>
            <style type="text/css">
                body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
            </style>
            <![endif]-->
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: 'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: #a8c8d8;
                    min-height: 100vh;
                    padding: 20px;
                    line-height: 1.5;
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                }
                .ticket-container {
                    max-width: 650px;
                    width: 100%;
                    margin: 0 auto;
                    background: linear-gradient(135deg, #b8d5e5 0%, #9bc3db 100%);
                    border-radius: 32px;
                    padding: 50px 35px;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
                }
                .header {
                    text-align: center;
                    margin-bottom: 45px;
                }
                .ticket-title {
                    font-size: 28px;
                    font-weight: 300;
                    letter-spacing: 12px;
                    color: white;
                    margin-bottom: 50px;
                    text-transform: uppercase;
                    text-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
                }
                .route-wrapper {
                    display: table;
                    margin: 0 auto 50px;
                    width: 100%;
                    max-width: 500px;
                }
                .route {
                    display: table-row;
                    text-align: center;
                }
                .route-code,
                .boat-icon {
                    display: table-cell;
                    vertical-align: middle;
                    padding: 10px;
                }
                .route-code {
                    font-size: 68px;
                    font-weight: 900;
                    color: white;
                    letter-spacing: 6px;
                    text-shadow: 0 5px 10px rgba(0, 0, 0, 0.25);
                    width: 40%;
                }
                .boat-icon {
                    font-size: 48px;
                    width: 20%;
                    text-shadow: 0 3px 6px rgba(0, 0, 0, 0.2);
                }
                .greeting {
                    color: white;
                    font-size: 22px;
                    font-weight: 600;
                    margin-bottom: 12px;
                    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
                }
                .passenger-name {
                    color: #1e3a47;
                    font-size: 28px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 3px;
                    margin-bottom: 45px;
                    background: rgba(255, 255, 255, 0.95);
                    padding: 14px 28px;
                    border-radius: 16px;
                    display: inline-block;
                    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.15);
                }
                .ticket-details {
                    background: white;
                    border-radius: 24px;
                    padding: 35px;
                    margin-bottom: 30px;
                    position: relative;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
                }
                .qr-section {
                    text-align: center;
                    margin-bottom: 35px;
                    padding-bottom: 35px;
                    border-bottom: 2px solid #f0f0f0;
                }
                .qr-code {
                    width: 220px;
                    height: 220px;
                    margin: 0 auto;
                    display: block;
                    border-radius: 16px;
                    border: 3px solid #e8e8e8;
                    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
                    background: white;
                    padding: 8px;
                }
                .detail-row {
                    margin-bottom: 28px;
                }
                .detail-row:last-child {
                    margin-bottom: 0;
                }
                .detail-label {
                    color: #9ca3af;
                    font-size: 13px;
                    font-weight: 700;
                    margin-bottom: 8px;
                    text-transform: uppercase;
                    letter-spacing: 1.5px;
                }
                .detail-value {
                    color: #2d4a57;
                    font-size: 21px;
                    font-weight: 800;
                    line-height: 1.4;
                }
                .detail-subvalue {
                    color: #6b7280;
                    font-size: 15px;
                    font-weight: 700;
                    margin-top: 6px;
                    line-height: 1.5;
                }
                .baggage-info {
                    display: table;
                    width: 100%;
                }
                .baggage-icon,
                .baggage-text {
                    display: table-cell;
                    vertical-align: top;
                }
                .baggage-icon {
                    font-size: 28px;
                    width: 40px;
                    padding-right: 15px;
                }
                .baggage-text {
                    color: #4a6b7a;
                    font-size: 14px;
                    font-weight: 700;
                    line-height: 1.6;
                }
                .dashed-line {
                    border: none;
                    border-top: 3px dashed rgba(255, 255, 255, 0.5);
                    margin: 35px 0;
                }
                .instructions {
                    background: rgba(255, 255, 255, 0.97);
                    border-radius: 24px;
                    padding: 35px;
                    margin-bottom: 45px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
                }
                .instructions-title {
                    color: #2d4a57;
                    font-size: 24px;
                    font-weight: 800;
                    margin-bottom: 28px;
                    text-align: center;
                    line-height: 1.5;
                }
                .instruction-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    margin-bottom: 18px;
                }
                .instruction-item:last-child {
                    margin-bottom: 0;
                }
                .instruction-number {
                    color: #2d4a57;
                    font-size: 17px;
                    font-weight: 900;
                    line-height: 1.7;
                    flex-shrink: 0;
                }
                .instruction-text {
                    color: #4a5568;
                    font-size: 16px;
                    font-weight: 700;
                    line-height: 1.7;
                    flex: 1;
                }
                .highlight {
                    color: #2d4a57;
                    font-weight: 900;
                }
                .footer {
                    text-align: center;
                    margin-top: 30px;
                    padding-top: 10px;
                    width: 100%;
                }
                .footer-logos {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 35px;
                    flex-wrap: nowrap;
                    margin: 0 auto;
                }
                .logo-cell {
                    display: inline-block;
                    vertical-align: middle;
                    line-height: 0;
                }
                .logo {
                    height: 65px;
                    width: auto;
                    display: inline-block;
                    vertical-align: middle;
                    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.18));
                }
                .logo-relevante {
                    height: 55px;
                }
                .sign-button {
                    display: inline-block;
                    background: linear-gradient(135deg, #9bc3db 0%, #7aa8c4 100%);
                    color: white;
                    text-decoration: none;
                    padding: 18px 40px;
                    border-radius: 16px;
                    font-size: 18px;
                    font-weight: 800;
                    text-align: center;
                    margin: 25px auto;
                    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
                    transition: all 0.3s ease;
                }
                .sign-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.25);
                }
                .message-text {
                    color: #4a5568;
                    font-size: 17px;
                    font-weight: 700;
                    line-height: 1.8;
                    text-align: center;
                    margin-bottom: 20px;
                }
                
                /* Mobile responsiveness */
                @media only screen and (max-width: 600px) {
                    body {
                        padding: 10px;
                    }
                    .ticket-container {
                        padding: 30px 20px;
                        border-radius: 24px;
                    }
                    .ticket-title {
                        font-size: 20px;
                        letter-spacing: 8px;
                        margin-bottom: 35px;
                    }
                    .route-code {
                        font-size: 48px;
                        letter-spacing: 4px;
                    }
                    .boat-icon {
                        font-size: 36px;
                    }
                    .passenger-name {
                        font-size: 20px;
                        letter-spacing: 2px;
                        padding: 10px 20px;
                    }
                    .ticket-details {
                        padding: 25px 20px;
                    }
                    .qr-code {
                        width: 180px;
                        height: 180px;
                    }
                    .detail-value {
                        font-size: 18px;
                    }
                    .instructions {
                        padding: 25px 20px;
                    }
                    .instructions-title {
                        font-size: 20px;
                    }
                    .instruction-text {
                        font-size: 15px;
                    }
                    .logo {
                        height: 55px;
                    }
                    .logo-relevante {
                        height: 45px;
                    }
                    .footer-logos {
                        gap: 25px;
                    }
                    .sign-button {
                        padding: 15px 30px;
                        font-size: 16px;
                    }
                    .message-text {
                        font-size: 15px;
                    }
                }
                
                @media only screen and (max-width: 480px) {
                    .route-wrapper {
                        max-width: 100%;
                    }
                    .route-code {
                        font-size: 42px;
                    }
                    .boat-icon {
                        font-size: 32px;
                    }
                    .qr-code {
                        width: 160px;
                        height: 160px;
                    }
                    .logo {
                        height: 50px;
                    }
                    .logo-relevante {
                        height: 42px;
                    }
                    .footer-logos {
                        gap: 20px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="ticket-container">
                <div class="header">
                    <div class="ticket-title">TICKET DE EMBARQUE</div>
                    
                    <div class="route-wrapper">
                        <div class="route">
                            <div class="route-code">CTG</div>
                            <img src="cid:boat-icon" alt="Boat Icon" class="boat-icon" style="width: 100px; height: 100px;"/>
                            <div class="route-code">BCH</div>
                        </div>
                    </div>
                    
                    <div class="greeting">Hola campista</div>
                    <div class="passenger-name">${fullName.toUpperCase()}</div>
                </div>
                
                <div class="ticket-details">
                    <div class="qr-section">
                        <img src="cid:qr-code" alt="QR Code" class="qr-code"/>
                    </div>
                    
                    <div class="detail-row">
                        <div class="detail-label">Fecha</div>
                        <div class="detail-value">VIERNES, 14 NOVIEMBRE 2025</div>
                    </div>
                    
                    <div class="detail-row">
                        <div class="detail-label">Embarque</div>
                        <div class="detail-value">07:00 AM</div>
                        <div class="detail-subvalue">MUELLE TURÍSTICO DE MANGA</div>
                    </div>
                    
                    <div class="detail-row">
                        <div class="detail-label">Incluye</div>
                        <div class="baggage-info">
                            <img src="cid:bag-icon" alt="Baggage Icon" class="baggage-icon" style="width: 40px; height: 28px;"/>
                            <div class="baggage-text">Un bolso o mochila pequeña de hasta 40x35x25 cm y 12 kg</div>
                        </div>
                    </div>
                </div>
                
                <hr class="dashed-line">
                
                <div class="instructions">
                    <div class="instructions-title">¡Ya casi comienza tu aventura en Relevante Camp!</div>
                    
                    <div class="instruction-item">
                        <span class="instruction-number">1.</span>
                        <div class="instruction-text">Ten a la mano tu código QR y tu documento de identidad.</div>
                    </div>
                    
                    <div class="instruction-item">
                        <span class="instruction-number">2.</span>
                        <div class="instruction-text">Muéstralos al equipo logístico para su validación.</div>
                    </div>
                    
                    <div class="instruction-item">
                        <span class="instruction-number">3.</span>
                        <div class="instruction-text">Una vez confirmados, podrás ingresar y abordar rumbo a <span class="highlight">RELEVANTE CAMP</span>.</div>
                    </div>
                </div>
                
                <div class="footer">
                    <div class="footer-logos">
                        <div class="logo-cell">
                            <img src="cid:relevante_logo" alt="Relevante Camp" class="logo logo-relevante"/>
                        </div>
                        <div class="logo-cell">
                            <img src="cid:vida_logo" alt="Vida Ministerio Juvenil" class="logo"/>
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
}

// Generate contract signing email HTML (new email for signing contract)
function generateContractSigningEmail(fullName: string, userId: string, contractUrl?: string): string {
    const url = contractUrl || `https://camp-dahsboard.vercel.app/contract_sign/${userId}`;

    return `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Firma de Consentimiento - Relevante Camp</title>
            <link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@300;400;600;700;800;900&display=swap" rel="stylesheet">
            <!--[if mso]>
            <style type="text/css">
                body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
            </style>
            <![endif]-->
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: 'Nunito Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: #a8c8d8;
                    min-height: 100vh;
                    padding: 20px;
                    line-height: 1.5;
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                }
                .ticket-container {
                    max-width: 650px;
                    width: 100%;
                    margin: 0 auto;
                    background: linear-gradient(135deg, #b8d5e5 0%, #9bc3db 100%);
                    border-radius: 32px;
                    padding: 50px 35px;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
                }
                .header {
                    text-align: center;
                    margin-bottom: 45px;
                }
                .ticket-title {
                    font-size: 28px;
                    font-weight: 300;
                    letter-spacing: 12px;
                    color: white;
                    margin-bottom: 50px;
                    text-transform: uppercase;
                    text-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
                }
                .greeting {
                    color: white;
                    font-size: 22px;
                    font-weight: 600;
                    margin-bottom: 12px;
                    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
                }
                .passenger-name {
                    color: #1e3a47;
                    font-size: 28px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 3px;
                    margin-bottom: 45px;
                    background: rgba(255, 255, 255, 0.95);
                    padding: 14px 28px;
                    border-radius: 16px;
                    display: inline-block;
                    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.15);
                }
                .ticket-details {
                    background: white;
                    border-radius: 24px;
                    padding: 35px;
                    margin-bottom: 30px;
                    position: relative;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
                    text-align: center;
                }
                .message-text {
                    color: #4a5568;
                    font-size: 17px;
                    font-weight: 700;
                    line-height: 1.8;
                    text-align: center;
                    margin-bottom: 30px;
                }
                .sign-button {
                    display: inline-block;
                    background: linear-gradient(135deg, #9bc3db 0%, #7aa8c4 100%);
                    color: white;
                    text-decoration: none;
                    padding: 18px 40px;
                    border-radius: 16px;
                    font-size: 18px;
                    font-weight: 800;
                    text-align: center;
                    margin: 25px auto;
                    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
                    transition: all 0.3s ease;
                }
                .sign-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.25);
                }
                .dashed-line {
                    border: none;
                    border-top: 3px dashed rgba(255, 255, 255, 0.5);
                    margin: 35px 0;
                }
                .instructions {
                    background: rgba(255, 255, 255, 0.97);
                    border-radius: 24px;
                    padding: 35px;
                    margin-bottom: 45px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
                }
                .instructions-title {
                    color: #2d4a57;
                    font-size: 24px;
                    font-weight: 800;
                    margin-bottom: 28px;
                    text-align: center;
                    line-height: 1.5;
                }
                .instruction-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    margin-bottom: 18px;
                }
                .instruction-item:last-child {
                    margin-bottom: 0;
                }
                .instruction-number {
                    color: #2d4a57;
                    font-size: 17px;
                    font-weight: 900;
                    line-height: 1.7;
                    flex-shrink: 0;
                }
                .instruction-text {
                    color: #4a5568;
                    font-size: 16px;
                    font-weight: 700;
                    line-height: 1.7;
                    flex: 1;
                }
                .highlight {
                    color: #2d4a57;
                    font-weight: 900;
                }
                .footer {
                    text-align: center;
                    margin-top: 30px;
                    padding-top: 10px;
                    width: 100%;
                }
                .footer-logos {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 35px;
                    flex-wrap: nowrap;
                    margin: 0 auto;
                }
                .logo-cell {
                    display: inline-block;
                    vertical-align: middle;
                    line-height: 0;
                }
                .logo {
                    height: 65px;
                    width: auto;
                    display: inline-block;
                    vertical-align: middle;
                    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.18));
                }
                .logo-relevante {
                    height: 55px;
                }
                
                /* Mobile responsiveness */
                @media only screen and (max-width: 600px) {
                    body {
                        padding: 10px;
                    }
                    .ticket-container {
                        padding: 30px 20px;
                        border-radius: 24px;
                    }
                    .ticket-title {
                        font-size: 20px;
                        letter-spacing: 8px;
                        margin-bottom: 35px;
                    }
                    .passenger-name {
                        font-size: 20px;
                        letter-spacing: 2px;
                        padding: 10px 20px;
                    }
                    .ticket-details {
                        padding: 25px 20px;
                    }
                    .instructions {
                        padding: 25px 20px;
                    }
                    .instructions-title {
                        font-size: 20px;
                    }
                    .instruction-text {
                        font-size: 15px;
                    }
                    .logo {
                        height: 55px;
                    }
                    .logo-relevante {
                        height: 45px;
                    }
                    .footer-logos {
                        gap: 25px;
                    }
                    .sign-button {
                        padding: 15px 30px;
                        font-size: 16px;
                    }
                    .message-text {
                        font-size: 15px;
                    }
                }
                
                @media only screen and (max-width: 480px) {
                    .logo {
                        height: 50px;
                    }
                    .logo-relevante {
                        height: 42px;
                    }
                    .footer-logos {
                        gap: 20px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="ticket-container">
                <div class="header">
                    <div class="ticket-title">FIRMA DE CONSENTIMIENTO</div>
                    
                    <div class="greeting">Hola campista</div>
                    <div class="passenger-name">${fullName.toUpperCase()}</div>
                </div>
                
                <div class="ticket-details">
                    <div class="message-text">
                        Este es el link dispuesto para que realices la firma de tu consentimiento informado para el campamento. Debes firmarlo para poder recibir tu QR de confirmación y registro para el día del campamento.
                    </div>
                    
                    <a href="${url}" class="sign-button">FIRMAR CONSENTIMIENTO</a>
                </div>
                
                <hr class="dashed-line">
                
                <div class="instructions">
                    <div class="instructions-title">¡Importante!</div>
                    
                    <div class="instruction-item">
                        <span class="instruction-number">1.</span>
                        <div class="instruction-text">Haz clic en el botón de arriba para acceder al formulario de firma.</div>
                    </div>
                    
                    <div class="instruction-item">
                        <span class="instruction-number">2.</span>
                        <div class="instruction-text">Lee cuidadosamente el documento de consentimiento informado.</div>
                    </div>
                    
                    <div class="instruction-item">
                        <span class="instruction-number">3.</span>
                        <div class="instruction-text">Firma el documento electrónicamente para completar tu registro.</div>
                    </div>
                    
                    <div class="instruction-item">
                        <span class="instruction-number">4.</span>
                        <div class="instruction-text">Una vez firmado, recibirás tu QR de confirmación por correo electrónico.</div>
                    </div>
                </div>
                
                <div class="footer">
                    <div class="footer-logos">
                        <div class="logo-cell">
                            <img src="cid:relevante_logo" alt="Relevante Camp" class="logo logo-relevante"/>
                        </div>
                        <div class="logo-cell">
                            <img src="cid:vida_logo" alt="Vida Ministerio Juvenil" class="logo"/>
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `;
}

export async function POST(req: Request) {
    try {
        const { to, subject = "Hello", text = "Hello", userId, fullName, emailType = "ticket", contractUrl } = await req.json();

        if (!to || !userId || !fullName) {
            return new Response(JSON.stringify({ error: "Missing 'to', 'userId' or 'fullName'" }), { status: 400 });
        }

        const host = process.env.SMTP_HOST;
        const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        const from = process.env.SMTP_FROM || user;

        if (!host || !user || !pass) {
            return new Response(JSON.stringify({ error: "SMTP env vars not configured" }), { status: 500 });
        }

        const transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user, pass },
        });

        //TODO: Fix email logos in production

        // Proactively verify SMTP connectivity (helps diagnose production issues)
        try {
            await transporter.verify();
        } catch (err) {
            console.error('SMTP verify failed', err);
            return new Response(JSON.stringify({ error: 'SMTP connection failed. Please verify host/port/user/pass and allow SMTP on your provider.' }), { status: 500 });
        }

        // Generate QR code as PNG buffer and embed via CID so most clients display it (only for ticket email)
        let qrPng: Buffer | null = null;
        if (emailType === "ticket") {
            qrPng = await QRCode.toBuffer(String(userId), { type: 'png', margin: 1, scale: 6 });
        }

        // Generate HTML based on email type
        const html = emailType === "contract"
            ? generateContractSigningEmail(fullName, userId, contractUrl)
            : generateTicketEmail(fullName);

        // Build logo attachments in a way that also works on Vercel (prefer request origin)
        const requestOrigin = (() => {
            try {
                return new URL(req.url).origin;
            } catch {
                return '';
            }
        })();
        const baseUrl = requestOrigin || process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

        const attachments: Mail.Attachment[] = [];

        // Only add QR code attachment for ticket emails
        if (emailType === "ticket" && qrPng) {
            attachments.push({
                filename: 'qr.png',
                content: qrPng,
                contentType: 'image/png',
                cid: 'qr-code',
            });
        }

        try {
            if (baseUrl) {
                // Both emails need logos, but only ticket email needs boat and bag icons
                const logoPromises: Promise<Response>[] = [
                    fetch(`${baseUrl}/logos/relevante_logo_white.PNG`, { cache: 'no-store' }),
                    fetch(`${baseUrl}/logos/vida_logo_white.PNG`, { cache: 'no-store' }),
                ];

                if (emailType === "ticket") {
                    logoPromises.push(
                        fetch(`${baseUrl}/boat.png`, { cache: 'no-store' }),
                        fetch(`${baseUrl}/bag.png`, { cache: 'no-store' })
                    );
                }

                const responses = await Promise.all(logoPromises);
                if (!responses.every(r => r.ok)) throw new Error('Asset fetch failed');

                const buffers = await Promise.all(
                    responses.map(async r => Buffer.from(await r.arrayBuffer()))
                );

                attachments.push(
                    { filename: 'relevante_logo_white.PNG', content: buffers[0], contentType: 'image/png', cid: 'relevante_logo', contentDisposition: 'inline' },
                    { filename: 'vida_logo_white.PNG', content: buffers[1], contentType: 'image/png', cid: 'vida_logo', contentDisposition: 'inline' },
                );

                if (emailType === "ticket") {
                    attachments.push(
                        { filename: 'boat.png', content: buffers[2], contentType: 'image/png', cid: 'boat-icon', contentDisposition: 'inline' },
                        { filename: 'bag.png', content: buffers[3], contentType: 'image/png', cid: 'bag-icon', contentDisposition: 'inline' },
                    );
                }
            } else {
                // Fallback to reading from build filesystem if base URL not available
                attachments.push(
                    { filename: 'relevante_logo_white.PNG', path: process.cwd() + '/public/logos/relevante_logo_white.PNG', cid: 'relevante_logo', contentDisposition: 'inline' },
                    { filename: 'vida_logo_white.PNG', path: process.cwd() + '/public/logos/vida_logo_white.PNG', cid: 'vida_logo', contentDisposition: 'inline' },
                );

                if (emailType === "ticket") {
                    attachments.push(
                        { filename: 'boat.png', path: process.cwd() + '/public/boat.png', cid: 'boat-icon', contentDisposition: 'inline' },
                        { filename: 'bag.png', path: process.cwd() + '/public/bag.png', cid: 'bag-icon', contentDisposition: 'inline' },
                    );
                }
            }
        } catch (e) {
            console.warn('Failed to fetch assets from base URL, falling back to paths. Error:', e);
            attachments.push(
                { filename: 'relevante_logo_white.PNG', path: process.cwd() + '/public/logos/relevante_logo_white.PNG', cid: 'relevante_logo', contentDisposition: 'inline' },
                { filename: 'vida_logo_white.PNG', path: process.cwd() + '/public/logos/vida_logo_white.PNG', cid: 'vida_logo', contentDisposition: 'inline' },
            );

            if (emailType === "ticket") {
                attachments.push(
                    { filename: 'boat.png', path: process.cwd() + '/public/boat.png', cid: 'boat-icon', contentDisposition: 'inline' },
                    { filename: 'bag.png', path: process.cwd() + '/public/bag.png', cid: 'bag-icon', contentDisposition: 'inline' },
                );
            }
        }

        await transporter.sendMail({
            from,
            to,
            subject: emailType === "contract" ? "Firma de Consentimiento - Relevante Camp" : subject,
            html,
            text: emailType === "contract" ? `Hola ${fullName}, este es el link para firmar tu consentimiento: https://camp-dahsboard.vercel.app/contract_sign/${userId}` : text,
            attachments,
        });

        return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } catch (error) {
        console.error("send-email error", error);
        return new Response(JSON.stringify({ error: "Failed to send" }), { status: 500 });
    }
}
