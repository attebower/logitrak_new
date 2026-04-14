export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-dark flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-[28px] font-extrabold tracking-tight">
            <span className="text-brand-blue">Logi</span>
            <span className="text-white">Trak</span>
          </div>
          <div className="text-[13px] text-slate-muted mt-1">Equipment tracking for production</div>
        </div>
        {children}
      </div>
    </div>
  );
}
