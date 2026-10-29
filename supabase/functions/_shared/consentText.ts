// relative .ts imports so scripts/consent-pdf-check.mjs can load this under plain Node
import { camp } from "./camp.ts";

// Legal text of the informed consent, shared by the signing page (ConsentDocument) and the signed PDF (consentPdf),
// so both always say the same thing. A run is plain text or a filled-in value: bold, or a blank line when missing.
export type Run = string | { value?: string };
export type Paragraph = Run[];
export interface Clause {
    checked: boolean;
    text: Paragraph;
}

const CAMP = camp.name.toUpperCase();

export const consentTitle = `CONSENTIMIENTO VOLUNTARIO E INFORMADO DE PARTICIPACIÓN ${CAMP} ${camp.year}`;

export const fullName = (p: { names?: string | null; last_name_1?: string | null; last_name_2?: string | null }) =>
    [p.names, p.last_name_1, p.last_name_2].filter(Boolean).join(" ");

const intro: Paragraph = [
    `${CAMP} es una actividad promovida del Ministerio de Jóvenes VIDA de la Iglesia Centro Bíblico Internacional de Cartagena, que se realizará `,
    { value: camp.dates },
    ", en el ejercicio del derecho fundamental a la libertad religiosa y de cultos consagrada en el artículo 19 de la Constitución Política de Colombia. En ese sentido, la actividad busca unir a los campistas en prácticas colectivas de actos de oración, culto, enseñanza y festividades de conformidad a las creencias religiosas que profesamos.",
];

export function adultParagraphs({ name, nationalId, date }: { name?: string; nationalId?: string; date?: string }): Paragraph[] {
    return [
        intro,
        [
            "Yo ", { value: name }, " identificado con C.C. No. ", { value: nationalId },
            `, manifiesto mi participación voluntaria y bajo mi propia responsabilidad en el ${CAMP}, de ahora en adelante Campamento. Así mismo, declaro que conozco el listado de actividades que se programarán para los campistas, por lo que acepto participar en todas las actividades que se dispongan, salvo las que se expresen en las observaciones y anotaciones.`,
        ],
        ["Yo acepto y entiendo que el personal que dirigirá el Campamento se esfuerza por proporcionar un ambiente seguro y supervisado, pero reconozco y acepto que existen ciertos riesgos inherentes en las actividades al aire libre y podría estar expuestos a situaciones imprevistas. Entiendo que el Campamento hará todo lo posible para garantizar la seguridad de los participantes, así que eximo de responsabilidad a la Iglesia Centro Bíblico Internacional y a los organizadores del Campamento por lesiones, pérdidas, daños materiales o personales que puedan ocurrir durante el campamento, siempre que no medie dolo o culpa grave de su parte."],
        ["Autorizo a los organizadores del campamento para utilizar fotografías, videos u otros medios de grabación que incluyan mi imagen para propósito promocionales o educativos, siempre y cuando no se violente mi integridad y que se respete mi privacidad y seguridad en todas las publicaciones. Entiendo que las actividades del Campamento se realizarán en el predio privado LA NICLALA en la Isla Bocachica, por lo que las instalaciones como habitaciones, zonas de descanso, piscinas, así como las comidas son proporcionados por la Finca La Niclala, y no por la Iglesia Centro Bíblico Internacional de Cartagena, por lo que declaro que libero de total responsabilidad al Campamento y a la Iglesia de los servicios prestados por la Finca La Niclala. También acepto que conozco que empresas privadas prestarán el servicio de transporte marítimo desde la ciudad de Cartagena a la Isla Bocachica."],
        [`En ese sentido, autorizo de manera voluntaria y libre mi participación en el Campamento ${CAMP}, comprometiéndome a dar cumplimiento a las indicaciones generales del campamento que se anexan a este documento, por lo que acataré las restricciones que se fijen como necesarias de seguridad y salubridad, así como cumplir con las acciones de autocuidado.`],
        ["Por otra parte, siendo que de manera voluntaria expreso mi deseo de autorizar viaje y campamento, me comprometo a no presentar ninguna denuncia, queja y/o algún tipo de acción frente a la Iglesia Centro Bíblico Internacional de la ciudad de Cartagena. De la misma manera me comprometo llevar equipo de protección personal necesario y requerido por el Campamento, así mismo, me comprometo a cumplir todas las normas de bioseguridad establecidas para protegerme, proteger a los demás, de manera íntegra y velando por la salud de todos los participantes del viaje y campamento conforme a lo dispuesto por los organizadores del evento."],
        ["Para los efectos legales pertinentes, suscribo el presente documento de forma voluntaria hoy ", date ?? "", "."],
    ];
}

export function minorParagraphs(p: { tutorName?: string; tutorNationalId?: string; minorName?: string; minorNationalId?: string }): Paragraph[] {
    return [
        intro,
        [
            "Yo, ", { value: p.tutorName }, ", identificado(a) con C.C. No. ", { value: p.tutorNationalId },
            ", en calidad de padre, madre o tutor(a), autorizo la participación de mi hijo(a) ", { value: p.minorName },
            ", identificado(a) con T.I. No. ", { value: p.minorNationalId },
            `, en la actividad ${CAMP}. Declaro que conozco el listado de actividades programadas para los campistas y acepto su participación en todas, salvo aquellas que se indiquen expresamente en las observaciones o anotaciones.`,
        ],
        ["Acepto y entiendo que el personal que dirigirá el Campamento se esfuerza por proporcionar un ambiente seguro y supervisado; sin embargo, reconozco que existen ciertos riesgos inherentes a las actividades al aire libre, así como la posibilidad de situaciones imprevistas. Entiendo que el Campamento adoptará todas las medidas razonables para garantizar la seguridad de los participantes; por ello, eximo de responsabilidad a la Iglesia Centro Bíblico Internacional y a los organizadores del evento por cualquier lesión, pérdida o daño material o personal que pueda ocurrir durante el Campamento, siempre que no medie dolo o culpa grave de su parte."],
        ["Autorizo a los organizadores del Campamento a utilizar fotografías, videos u otros medios de grabación que incluyan la imagen de mi hijo(a), con fines promocionales o educativos, siempre que no se vulnere su integridad ni su privacidad. Entiendo que las actividades del Campamento se realizarán en el predio privado La Niclala, ubicado en la Isla de Bocachica, cuyas instalaciones, zonas de descanso, piscinas y servicios de alimentación son proporcionados por la Finca La Niclala, y no por la Iglesia Centro Bíblico Internacional de Cartagena. En consecuencia, libero de toda responsabilidad al Campamento y a la Iglesia respecto de los servicios prestados por la Finca La Niclala. También reconozco que empresas privadas serán las encargadas del transporte marítimo a los campistas desde la ciudad de Cartagena hasta la Isla de Bocachica."],
        [`En ese sentido, autorizo de manera voluntaria y libre la participación de mi hijo(a) en el Campamento ${CAMP}, comprometiéndome a que cumpla las indicaciones generales del evento anexas a este documento. Acepto las restricciones de seguridad y salubridad que se consideren necesarias, y promoveré las acciones de autocuidado pertinentes.`],
        ["Por otra parte, manifiesto de manera voluntaria mi decisión de autorizar el viaje y la participación de mi hijo(a) en el Campamento, comprometiéndome a no presentar denuncia, queja o acción alguna frente a la Iglesia Centro Bíblico Internacional de Cartagena por hechos derivados de esta actividad. Así mismo, me comprometo a proveer a mi hijo(a) el equipo de protección personal necesario y a garantizar que cumpla las normas de bioseguridad establecidas para la protección y bienestar de todos los participantes."],
    ];
}

export function minorClauses(p: { option: "parent" | "delegate" | null; delegateName?: string; delegateNationalId?: string }): Clause[] {
    return [
        {
            checked: p.option === "parent",
            text: ["En virtud de mi participación en el Campamento, me comprometo a velar por la seguridad e integridad de mi hijo(a) durante el desarrollo de las actividades, y a colaborar con los organizadores cumpliendo con las normas establecidas para el evento."],
        },
        {
            checked: p.option === "delegate",
            text: [
                "Por medio del presente documento, autorizo a ", { value: p.delegateName }, ", identificado con C.C. No. ", { value: p.delegateNationalId },
                ", para que actúe como responsable de mi hijo(a) durante el Campamento, vele por su seguridad y coopere con los organizadores en el cumplimiento de las medidas establecidas para su adecuada ejecución.",
            ],
        },
    ];
}
