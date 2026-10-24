import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import Wordmark from '@/components/Wordmark'
import { camp } from '@/lib/camp'

const description = `Campamento del Ministerio Juvenil VIDA, ${camp.dates} en la Isla de Bocachica, Cartagena.`

export const metadata: Metadata = {
    title: { absolute: `${camp.name} ${camp.year}` },
    description,
    openGraph: { title: `${camp.name} ${camp.year}`, description, locale: 'es_CO', type: 'website' },
}

// Brand line art (transparent PNG) painted in any color through a CSS mask
function LineArt({ src, className }: { src: string; className: string }) {
    const mask = `url(${src}) center / contain no-repeat`
    return <div aria-hidden="true" className={className} style={{ mask, WebkitMask: mask }} />
}

const checklist = [
    'Documento de identidad',
    'Tu código QR, que te llega por correo cuando firmas el consentimiento',
    'Equipaje dentro de las medidas permitidas',
    'Llegar con anticipación',
]

// Moodboard photos from the Canva brand guide, paired with what campers will actually do
const moments = [
    { photo: '/brand/photos/hands.jpg', title: 'Adoración', text: 'Culto y oración en comunidad.' },
    { photo: '/brand/photos/cathedral.jpg', title: 'La Palabra', text: 'Enseñanza bíblica para ver a Jesús con claridad.' },
    { photo: '/brand/photos/golden-wave.jpg', title: 'El mar', text: 'Tres días en la Isla de Bocachica, frente al Caribe.' },
]

const steps = [
    { title: 'Inscríbete', text: 'Reserva tu cupo con el equipo del Ministerio Juvenil VIDA.' },
    { title: 'Firma el consentimiento', text: 'Te llega un enlace por correo para leerlo y firmarlo desde el celular o el computador.' },
    { title: 'Recibe tu QR', text: 'Al firmar te enviamos por correo tu pase de abordaje con un código QR.' },
    { title: 'Preséntate en el muelle', text: 'Muestra el QR y tu documento de identidad al equipo de logística antes de abordar.' },
]

export default function Home() {
    return (
        <>
            <header className="relative overflow-hidden bg-oxblood text-parchment">
                {/* low-res moodboard photo used as light, not detail: soft and tinted under the wordmark */}
                <Image src="/brand/photos/cathedral.jpg" alt="" fill priority sizes="100vw" className="object-cover opacity-60 blur-[1px] scale-105" />
                <div className="absolute inset-0 bg-gradient-to-b from-oxblood/40 via-oxblood/60 to-oxblood" aria-hidden="true" />
                <div className="relative mx-auto flex min-h-[100svh] max-w-5xl flex-col items-center justify-center px-6 py-20 text-center">
                    <Wordmark className="text-[2rem] sm:text-6xl lg:text-7xl" />
                    <p className="mt-8 font-display text-lg tracking-[0.2em] sm:text-xl">to see HIM clearly</p>
                    <p className="mt-14 text-lg font-semibold sm:text-xl">
                        Del 13 al 15 de noviembre de 2026
                        <span className="mt-1 block font-normal text-parchment/80">Isla de Bocachica, Cartagena</span>
                    </p>
                </div>
            </header>

            <main>
                <section className="px-6 py-20 sm:py-28">
                    <div className="mx-auto max-w-3xl">
                        <blockquote>
                            <p className="font-display text-2xl leading-snug text-oxblood sm:text-3xl">
                                “Por tanto, nosotros todos, mirando a cara descubierta como en un espejo la gloria del Señor, somos
                                transformados de gloria en gloria en la misma imagen, como por el Espíritu del Señor.”
                            </p>
                            <footer className="mt-4 font-semibold text-ink/70">2 Corintios 3:18</footer>
                        </blockquote>
                        <p className="mt-12 max-w-2xl text-lg leading-relaxed text-ink/80">
                            {camp.name} es el campamento del Ministerio Juvenil VIDA de la Iglesia Centro Bíblico Internacional de
                            Cartagena: tres días en la Isla de Bocachica para orar, adorar, estudiar la Palabra y vivir en comunidad.
                        </p>
                    </div>
                </section>

                <section aria-labelledby="vivir" className="pb-20 sm:pb-28">
                    <h2 id="vivir" className="mx-auto max-w-5xl px-6 font-display text-3xl text-oxblood">Lo que vamos a vivir</h2>
                    {/* phones: swipeable row with the next card peeking; desktop: three columns */}
                    <ul className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 [scrollbar-width:none] sm:mx-auto sm:grid sm:max-w-5xl sm:grid-cols-3 sm:overflow-visible">
                        {moments.map((m) => (
                            <li key={m.title} className="relative aspect-[3/4] w-[78%] flex-none snap-center overflow-hidden rounded-3xl bg-oxblood sm:w-auto">
                                <Image src={m.photo} alt="" fill sizes="(min-width: 640px) 33vw, 78vw" className="object-cover" />
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5 pt-16 text-parchment">
                                    <h3 className="font-display text-2xl">{m.title}</h3>
                                    <p className="mt-1 text-sm leading-relaxed text-parchment/85">{m.text}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* the source photo is ~470px wide, so it stays at a size it can fill sharply */}
                <figure className="relative mx-auto aspect-[3/2] w-full max-w-xl sm:mb-20 sm:overflow-hidden sm:rounded-3xl">
                    <Image src="/brand/photos/worship.jpg" alt="Jóvenes cantando con una guitarra en un tiempo de adoración" fill sizes="(min-width: 640px) 576px, 100vw" className="object-cover" />
                </figure>

                <section aria-labelledby="viaje" className="bg-ink px-6 py-20 sm:py-28">
                    <div className="mx-auto max-w-md">
                        <h2 id="viaje" className="text-center font-display text-3xl text-parchment">El viaje</h2>
                        <article className="mt-10 overflow-hidden rounded-2xl bg-white text-ink">
                            <div className="bg-oxblood px-6 pb-6 pt-7 text-parchment">
                                <p className="text-center font-display text-sm tracking-[0.3em]">Pase de abordaje</p>
                                <div className="mt-5 flex items-center justify-between">
                                    <span className="font-display text-4xl">CTG</span>
                                    <LineArt src="/boat.png" className="h-12 w-16 bg-parchment" />
                                    <span className="font-display text-4xl">BCH</span>
                                </div>
                                <div className="mt-1 flex justify-between text-sm text-parchment/75">
                                    <span>Cartagena</span>
                                    <span>Bocachica</span>
                                </div>
                            </div>
                            <dl className="space-y-5 px-6 py-7">
                                <div>
                                    <dt className="text-sm font-semibold text-oxblood">Fecha</dt>
                                    <dd className="mt-0.5 font-semibold">{camp.boardingDay}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-semibold text-oxblood">Embarque</dt>
                                    <dd className="mt-0.5 text-3xl font-bold tabular-nums">{camp.boardingTime}</dd>
                                    <dd className="text-sm text-ink/70">{camp.boardingPlace}</dd>
                                </div>
                                <div>
                                    <dt className="text-sm font-semibold text-oxblood">Equipaje permitido</dt>
                                    <dd className="mt-0.5">1 bolso o morral de hasta 40 × 35 × 25 cm y 12 kg</dd>
                                </div>
                            </dl>
                            {/* ticket perforation: notches take the section background */}
                            <div className="relative mx-6 border-t-2 border-dashed border-ink/20" aria-hidden="true">
                                <span className="absolute -left-9 -top-3 h-6 w-6 rounded-full bg-ink" />
                                <span className="absolute -right-9 -top-3 h-6 w-6 rounded-full bg-ink" />
                            </div>
                            <div className="px-6 py-7">
                                <h3 className="font-semibold">Antes de embarcar</h3>
                                <ul className="mt-3 space-y-2 text-ink/80">
                                    {checklist.map((item) => (
                                        <li key={item} className="flex gap-2.5">
                                            <svg className="mt-1 h-4 w-4 flex-none text-glass" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </article>
                    </div>
                </section>

                <section aria-labelledby="cupo" className="px-6 py-20 sm:py-28">
                    <div className="mx-auto max-w-4xl">
                        <h2 id="cupo" className="font-display text-3xl text-oxblood">Cómo asegurar tu cupo</h2>
                        <ol className="mt-10 grid gap-x-12 gap-y-10 sm:grid-cols-2">
                            {steps.map((step, i) => (
                                <li key={step.title} className="flex gap-4">
                                    <span className="w-7 flex-none font-display text-4xl leading-none text-vermilion" aria-hidden="true">{i + 1}</span>
                                    <div>
                                        <h3 className="text-lg font-semibold">{step.title}</h3>
                                        <p className="mt-1 leading-relaxed text-ink/75">{step.text}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                        <div className="mt-14 rounded-2xl border border-ink/15 bg-white p-6 sm:p-8">
                            <h3 className="text-lg font-semibold">¿Va un menor de edad?</h3>
                            <p className="mt-2 leading-relaxed text-ink/75">
                                Su padre, madre o tutor(a) firma la autorización. Puede ir con él al campamento o autorizar a un
                                adulto inscrito para que sea su responsable durante esos tres días.
                            </p>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="bg-oxblood px-6 py-16 text-parchment">
                <div className="mx-auto flex max-w-4xl flex-col items-center gap-10 text-center">
                    <p className="text-lg">
                        ¿Tienes preguntas? Escríbenos a{' '}
                        <a href={`mailto:${camp.contactEmail}`} className="font-semibold underline underline-offset-4 hover:text-vermilion">
                            {camp.contactEmail}
                        </a>
                    </p>
                    <div className="flex items-center gap-10">
                        <Wordmark className="text-xl text-vermilion" />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/logos/vida_logo_white.PNG" alt="Ministerio Juvenil VIDA" className="h-12 w-auto" loading="lazy" />
                    </div>
                    <Link href="/login" className="text-sm text-parchment/70 underline-offset-4 hover:underline">
                        Acceso del equipo
                    </Link>
                </div>
            </footer>
        </>
    )
}
