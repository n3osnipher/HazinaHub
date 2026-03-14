import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store'

const FEATURES = [
  { icon: '📞', title: 'Smart Calls',        desc: 'Make and receive calls directly. Ask Hiah to call someone — she handles the rest.' },
  { icon: '💬', title: 'SMS Management',     desc: 'Send and read SMS across all your SIM cards from one place.' },
  { icon: '🃏', title: 'Multi-SIM Support',  desc: 'Detects all your SIM cards automatically — Safaricom, Airtel, and more.' },
  { icon: '🤖', title: 'Hiah AI Agent',      desc: 'A voice-first AI agent that understands natural language and acts on your behalf.' },
  { icon: '🔔', title: 'Smart Notifications',desc: 'Unified alerts across all channels. Hiah highlights what matters most.' },
  { icon: '🔄', title: 'Offline First',      desc: 'Works fully without internet. All data syncs automatically when you reconnect.' },
  { icon: '🎙️', title: 'Voice Enabled',     desc: 'Speak to Hiah naturally. Built-in speech recognition and text-to-speech.' },
  { icon: '🌐', title: 'Web + Mobile',       desc: 'Use on any device. Install as a native app from your browser — no app store needed.' },
]

const STEPS = [
  { n: '01', title: 'Download Reino',         desc: 'Open this page in your mobile browser and tap Add to Home Screen to install.' },
  { n: '02', title: 'Create your account',    desc: 'Register with your email. Your data stays private and secure.' },
  { n: '03', title: 'Set Hiah\'s permissions',desc: 'Choose exactly what Hiah can do — calls only, SMS only, or everything.' },
  { n: '04', title: 'Talk to Hiah',           desc: 'Say "Call Mama" or "Send SMS to John" and Hiah handles the rest.' },
]

export default function Landing() {
  const navigate = useNavigate()
  const { isAuthenticated } = useStore()

  return (
    <div className="min-h-screen bg-r-bg text-r-text overflow-x-hidden">
      {/* Nav */}
      <nav className="sticky top-0 z-50 glass border-b border-r-border/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-bold text-white text-sm flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#6c63ff,#00d4aa)' }}>R</div>
            <span className="font-display font-bold text-white">Reino</span>
            <span className="hidden sm:block text-r-muted text-xs">Daily Assistant</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {isAuthenticated ? (
              <button onClick={() => navigate('/app/dashboard')} className="btn-primary py-2 px-4 text-sm">
                Open App →
              </button>
            ) : (
              <>
                <button onClick={() => navigate('/login')} className="btn-ghost text-sm py-2 px-3 hidden sm:block">Sign in</button>
                <button onClick={() => navigate('/register')} className="btn-primary py-2 px-4 text-sm">Get Started</button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-16 sm:pt-24 pb-24 sm:pb-32 px-4">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-80 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse, rgba(108,99,255,0.18) 0%, transparent 65%)' }} />
        <div className="relative max-w-4xl mx-auto text-center animate-fade-up">
          <div className="inline-flex items-center gap-2 bg-r-accent/10 border border-r-accent/20 rounded-full px-4 py-1.5 text-xs sm:text-sm text-r-accent mb-6 sm:mb-8">
            <span className="w-2 h-2 rounded-full bg-r-teal animate-pulse flex-shrink-0" />
            AI-powered · Safaricom &amp; Airtel · Works offline
          </div>

          <h1 className="font-display font-black text-4xl sm:text-6xl md:text-7xl text-white leading-[1.05] mb-5 sm:mb-6">
            Your personal<br />
            <span className="gradient-text">AI Communications</span><br />
            Assistant
          </h1>

          <p className="text-r-muted text-base sm:text-xl max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2">
            Meet <strong className="text-r-text">Hiah</strong> — the intelligent agent that manages your calls, SMS, and contacts across all your SIM cards.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0">
            <button onClick={() => navigate('/register')}
              className="btn-primary text-base sm:text-lg py-3.5 sm:py-4 px-8 sm:px-10 rounded-2xl"
              style={{ background: 'linear-gradient(135deg,#6c63ff,#00d4aa)' }}>
              Get Reino Free →
            </button>
            <button onClick={() => navigate('/login')}
              className="btn-secondary text-base sm:text-lg py-3.5 sm:py-4 px-8 sm:px-10 rounded-2xl">
              Sign In
            </button>
          </div>
          <p className="mt-4 text-r-muted text-xs sm:text-sm">Free · No app store needed · Install from browser</p>

          {/* Mock chat preview */}
          <div className="relative max-w-xs sm:max-w-sm mx-auto mt-12 sm:mt-16 animate-fade-up" style={{ animationDelay: '0.2s' }}>
            <div className="card p-4 gradient-border">
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-r-border/40">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-r-accent to-r-teal flex items-center justify-center text-white font-bold text-sm flex-shrink-0">H</div>
                <div>
                  <p className="text-sm font-semibold text-white">Hiah</p>
                  <p className="text-xs text-r-teal flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-r-teal inline-block" />Active</p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="bg-r-surface rounded-xl rounded-tl-sm p-3 text-r-text max-w-[80%]">Call Mama for me</div>
                <div className="bg-r-accent rounded-xl rounded-tr-sm p-3 text-white ml-auto max-w-[90%]">
                  Calling Mama on SIM1 (Safaricom)…
                  <div className="mt-1.5 text-xs bg-white/20 px-2 py-0.5 rounded-full inline-block">✅ Call initiated</div>
                </div>
                <div className="bg-r-surface rounded-xl rounded-tl-sm p-3 text-r-text max-w-[80%]">Any missed calls?</div>
                <div className="flex gap-1 pl-2">
                  {[0, 0.2, 0.4].map((d, i) => <div key={i} className="w-2 h-2 rounded-full bg-r-accent animate-bounce" style={{ animationDelay: `${d}s` }} />)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-20 px-4 border-t border-r-border/30">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display font-bold text-2xl sm:text-4xl text-white text-center mb-3">Everything in one place</h2>
          <p className="text-r-muted text-center mb-10 sm:mb-12 max-w-xl mx-auto text-sm sm:text-base">
            Reino brings your calls, SMS, and contacts under one intelligent assistant.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {FEATURES.map(f => (
              <div key={f.title} className="card p-4 sm:p-5 hover:border-r-accent/30 transition-colors group">
                <div className="text-2xl sm:text-3xl mb-2 sm:mb-3">{f.icon}</div>
                <h3 className="font-display font-semibold text-white mb-1.5 text-sm sm:text-base group-hover:text-r-accent transition-colors">{f.title}</h3>
                <p className="text-r-muted text-xs sm:text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 sm:py-20 px-4 border-t border-r-border/30 bg-r-surface/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-display font-bold text-2xl sm:text-4xl text-white text-center mb-10 sm:mb-12">
            Up and running in 4 steps
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-8">
            {STEPS.map(s => (
              <div key={s.n} className="flex gap-4">
                <div className="font-display font-black text-2xl sm:text-3xl gradient-text flex-shrink-0 w-10 sm:w-12">{s.n}</div>
                <div>
                  <h3 className="font-semibold text-white mb-1 text-sm sm:text-base">{s.title}</h3>
                  <p className="text-r-muted text-xs sm:text-sm leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Download CTA */}
      <section className="py-16 sm:py-20 px-4 border-t border-r-border/30">
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl mx-auto mb-5 sm:mb-6 flex items-center justify-center font-display font-bold text-white text-2xl sm:text-3xl"
            style={{ background: 'linear-gradient(135deg,#6c63ff,#00d4aa)' }}>R</div>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-white mb-3 sm:mb-4">Install on your phone</h2>
          <p className="text-r-muted mb-6 sm:mb-8 leading-relaxed text-sm sm:text-base px-2">
            Open Reino in <strong className="text-r-text">Chrome (Android)</strong> or <strong className="text-r-text">Safari (iPhone)</strong>,
            then tap <strong className="text-r-text">Add to Home Screen</strong>.
            Reino installs as a native app — no app store required.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0">
            <button onClick={() => navigate('/register')}
              className="btn-primary py-3.5 sm:py-4 px-8 text-base sm:text-lg rounded-2xl"
              style={{ background: 'linear-gradient(135deg,#6c63ff,#00d4aa)' }}>
              Create Free Account
            </button>
            <a href="/api/health" target="_blank" rel="noopener"
              className="btn-secondary py-3.5 sm:py-4 px-8 text-base sm:text-lg rounded-2xl text-center">
              View API
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-r-border/30 py-6 sm:py-8 px-4 text-center text-r-muted text-xs sm:text-sm">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-5 h-5 rounded flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,#6c63ff,#00d4aa)' }}>R</div>
          <span className="font-display font-semibold text-r-text">Reino Daily Task Assistant</span>
        </div>
        <p>Intelligent communications for everyone</p>
      </footer>
    </div>
  )
}
