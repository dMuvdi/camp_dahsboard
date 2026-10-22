// Revelation Camp logo set in the brand fonts (Cinzel + Great Vibes), so it scales with
// font-size and takes its color from the parent instead of shipping one PNG per color.
export default function Wordmark({ className = '' }: { className?: string }) {
    return (
        <span role="img" aria-label="Revelation Camp" className={`inline-flex flex-col items-center leading-none ${className}`}>
            {/* padding-left balances the trailing letter-spacing so the word stays centered */}
            <span className="font-display tracking-[0.3em] pl-[0.3em]">REVELATION</span>
            <span className="font-script text-[1.2em] -mt-[0.1em]">camp</span>
        </span>
    )
}
