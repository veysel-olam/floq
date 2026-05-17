export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-(--color-background) px-4">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-(--color-coral) to-(--color-peach) flex items-center justify-center mx-auto mb-6">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M16 4C9.373 4 4 9.373 4 16s5.373 12 12 12 12-5.373 12-12S22.627 4 16 4z" fill="white" opacity=".3"/>
            <path d="M8 16c0-4.418 3.582-8 8-8s8 3.582 8 8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M11 16c0-2.761 2.239-5 5-5s5 2.239 5 5" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="16" cy="16" r="2" fill="white"/>
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-(--color-text-primary) mb-2" style={{ fontFamily: 'var(--font-outfit)' }}>
          Çevrimdışısın
        </h1>
        <p className="text-(--color-text-tertiary) text-sm mb-6">
          İnternet bağlantını kontrol et ve tekrar dene.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 rounded-full bg-(--color-coral) text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Yenile
        </button>
      </div>
    </div>
  )
}
