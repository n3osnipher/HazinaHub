import { useNavigate } from 'react-router-dom'

interface Props {
  title: string
  subtitle: string
  children: React.ReactNode
}

export default function AuthLayout({ title, subtitle, children }: Props) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-r-bg flex flex-col">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px]"
          style={{ background: 'radial-gradient(ellipse, rgba(108,99,255,0.15) 0%, transparent 70%)' }} />
      </div>

      <nav className="relative z-10 h-14 flex items-center px-6">
        <button onClick={() => navigate('/')} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center font-display font-bold text-white text-sm"
            style={{ background: 'linear-gradient(135deg,#6c63ff,#00d4aa)' }}>R</div>
          <span className="font-display font-semibold text-white text-sm">Reino</span>
        </button>
      </nav>

      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="font-display font-bold text-3xl text-white mb-2">{title}</h1>
            <p className="text-r-muted">{subtitle}</p>
          </div>
          <div className="card p-6 sm:p-8">{children}</div>
        </div>
      </div>
    </div>
  )
}
