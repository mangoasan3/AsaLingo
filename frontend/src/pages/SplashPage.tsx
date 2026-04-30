import { useNavigate } from "react-router-dom";
import { BookOpen, Zap, Target, TrendingUp } from "lucide-react";
import { useT } from "@/i18n";

export default function SplashPage() {
  const navigate = useNavigate();
  const t = useT();

  return (
    <div className="min-h-dvh flex bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900">
      {/* Left / hero panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 text-center">
        {/* Logo */}
        <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-3xl flex items-center justify-center mb-6 shadow-xl ring-1 ring-white/20 overflow-hidden">
          <img src="/app-icon.png" alt="AsaLingo" className="h-full w-full object-cover" />
        </div>

        <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">AsaLingo</h1>
        <p className="text-brand-200 text-xl font-medium mb-3">{t("splash.tagline")}</p>
        <p className="text-brand-300 text-sm max-w-sm leading-relaxed mb-10">
          {t("splash.description")}
        </p>

        {/* Feature pills */}
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm mb-10">
          {[
            { icon: Zap, label: t("splash.aiAdapted") },
            { icon: Target, label: t("splash.yourLevel") },
            { icon: TrendingUp, label: t("splash.trackProgress") },
            { icon: BookOpen, label: t("splash.smartPractice") },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-3.5 flex items-center gap-2.5 ring-1 ring-white/10 hover:bg-white/15 transition-colors"
            >
              <Icon size={16} className="text-brand-200 shrink-0" />
              <span className="text-white text-xs font-medium">{label}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="space-y-3 w-full max-w-sm">
          <button
            onClick={() => navigate("/register")}
            className="w-full bg-white text-brand-700 font-semibold py-4 rounded-2xl hover:bg-brand-50 active:scale-[0.98] transition-all shadow-lg text-base"
          >
            {t("splash.getStarted")}
          </button>
          <button
            onClick={() => navigate("/login")}
            className="w-full bg-white/10 text-white font-semibold py-4 rounded-2xl hover:bg-white/20 active:scale-[0.98] transition-all text-base ring-1 ring-white/20"
          >
            {t("splash.haveAccount")}
          </button>
        </div>
      </div>

      {/* Right decorative panel — desktop only */}
      <div className="hidden lg:flex flex-col justify-center items-center w-80 xl:w-96 bg-white/5 border-l border-white/10 px-8 py-12">
        <div className="space-y-6 w-full">
          {/* Decorative stats preview */}
          <div className="bg-white/10 rounded-3xl p-5 backdrop-blur-sm ring-1 ring-white/10">
            <p className="text-brand-200 text-xs font-medium mb-3">{t("progress.title")}</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { val: "42", label: t("home.stats.learned") },
                { val: "128", label: t("home.stats.saved") },
                { val: "7", label: t("progress.dayStreak") },
              ].map(({ val, label }) => (
                <div key={label} className="bg-white/10 rounded-xl p-2.5 text-center">
                  <p className="text-white text-lg font-bold">{val}</p>
                  <p className="text-brand-300 text-[10px] mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/10 rounded-3xl p-5 backdrop-blur-sm ring-1 ring-white/10">
            <p className="text-brand-200 text-xs font-medium mb-3">{t("splash.demoWordOfDay")}</p>
            <p className="text-white text-xl font-bold mb-1">eloquent</p>
            <p className="text-brand-200 text-sm">{t("splash.demoWordTranslation")}</p>
            <p className="text-brand-300 text-xs mt-2 italic">"Fluent or persuasive in speaking or writing"</p>
          </div>

          <div className="bg-white/10 rounded-3xl p-5 backdrop-blur-sm ring-1 ring-white/10">
            <p className="text-brand-200 text-xs font-medium mb-3">
              {t("splash.demoLevel", { level: "B2" })}
            </p>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full" style={{ width: "68%" }} />
            </div>
            <p className="text-brand-300 text-xs mt-2">
              {t("splash.demoLevelProgress", { pct: "68", next: "C1" })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
