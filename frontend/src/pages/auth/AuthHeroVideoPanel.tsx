type AuthHeroVideoPanelProps = {
  title: string;
  description: string;
  appName: string;
  glow: "top" | "bottom";
};

const glowClass = {
  top: "bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.18),_transparent_48%)]",
  bottom: "bg-[radial-gradient(circle_at_bottom,_rgba(255,255,255,0.18),_transparent_50%)]",
};

export function AuthHeroVideoPanel({ title, description, appName, glow }: AuthHeroVideoPanelProps) {
  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 lg:flex lg:min-h-dvh lg:items-center lg:justify-center lg:px-8 lg:py-7 xl:px-10">
      <video
        src="/asalingo-hero-video.mp4"
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-label={`${appName} preview`}
      />
      <div className="absolute inset-0 bg-brand-900/45 mix-blend-multiply" />
      <div className={`absolute inset-0 ${glowClass[glow]}`} />
      <div className="absolute inset-0 bg-gradient-to-t from-brand-950/70 via-brand-900/20 to-brand-600/10" />

      <div className="relative z-10 flex h-full w-full max-w-sm flex-col items-center justify-end pb-12 text-center text-white xl:pb-16">
        <div className="w-full">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-white/15 shadow-lg shadow-brand-950/20 ring-1 ring-white/25 backdrop-blur">
            <img src="/app-icon.png" alt={appName} className="h-full w-full object-cover" />
          </div>
          <h2 className="mb-3 text-2xl font-bold drop-shadow-sm">{title}</h2>
          <p className="text-sm leading-relaxed text-white/90 drop-shadow-sm">{description}</p>
        </div>
      </div>
    </div>
  );
}
