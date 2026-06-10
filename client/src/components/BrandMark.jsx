export default function BrandMark({ compact = false }) {
  return (
    <div className={`flex items-center ${compact ? 'gap-2.5' : 'gap-4'}`}>
      <div className={`relative shrink-0 overflow-hidden rounded-[22px] border border-emerald-200/50 bg-[linear-gradient(135deg,#101827_0%,#162337_100%)] shadow-[0_14px_40px_rgba(15,23,42,0.24)] ${compact ? 'h-12 w-12' : 'h-16 w-16'}`}>
        <div className="absolute inset-[3px] rounded-[18px] bg-[radial-gradient(circle_at_30%_25%,rgba(16,185,129,0.9),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0))]" />
        <svg viewBox="0 0 64 64" aria-hidden="true" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="Cove-orbit" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>
          <path
            d="M16 24c0-6.6 5.4-12 12-12h8c6.6 0 12 5.4 12 12v14c0 6.6-5.4 12-12 12h-8c-6.6 0-12-5.4-12-12V24Z"
            fill="none"
            stroke="url(#Cove-orbit)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M24 22h16M24 30h12M24 38h16"
            stroke="rgba(255,255,255,0.92)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="43" cy="43" r="5.5" fill="#10b981" />
        </svg>
      </div>

      <div className="min-w-0">
        <p className={`font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 ${compact ? 'text-lg' : 'text-2xl'}`}>Cove</p>
        <p className={`text-zinc-500 dark:text-zinc-400 ${compact ? 'text-xs' : 'text-sm'}`}>
          Capture notes, meetings, and team context without losing your flow.
        </p>
      </div>
    </div>
  );
}
