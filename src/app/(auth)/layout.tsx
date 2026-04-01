export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-viking-deep flex items-center justify-center px-4 py-12">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-viking-charcoal/40 via-viking-deep to-viking-deep" />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <a href="/" className="flex items-center justify-center gap-2 mb-10 font-[family-name:var(--font-display)] font-bold text-xl tracking-tight">
          <span className="text-viking-gold">VIKING</span>
          <span className="text-viking-snow">SPORTS</span>
        </a>

        {children}
      </div>
    </div>
  );
}
