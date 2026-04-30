import { useQuery } from "@tanstack/react-query";
import { Flame, BookOpen, CheckCircle, AlertCircle, TrendingUp, Calendar } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { usersApi } from "@/api/users";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { useT } from "@/i18n";
import { getLanguageLabel } from "@/utils/language";
import { useLocaleStore } from "@/store/localeStore";

export default function ProgressPage() {
  const user = useAuthStore((s) => s.user);
  const locale = useLocaleStore((s) => s.locale);
  const t = useT();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const res = await usersApi.getStats();
      return res.data.data;
    },
  });

  if (isLoading) return <LoadingSpinner className="min-h-dvh" />;

  // Explicit class map — avoids fragile dynamic string interpolation that breaks Tailwind's JIT
  const statColorClasses: Record<string, { bg: string; text: string }> = {
    green: { bg: "bg-green-100", text: "text-green-600" },
    blue: { bg: "bg-blue-100", text: "text-blue-600" },
    red: { bg: "bg-red-100", text: "text-red-600" },
    purple: { bg: "bg-purple-100", text: "text-purple-600" },
  };

  return (
    <div className="max-w-5xl mx-auto px-5 lg:px-10 pt-8 lg:pt-12 pb-6">
      <h1 className="text-2xl lg:text-3xl font-bold text-slate-800 mb-6">{t("progress.title")}</h1>

      <div className="lg:grid lg:grid-cols-3 lg:gap-8">
        {/* Left column: Level + streak card */}
        <div className="lg:col-span-1 space-y-5 mb-5 lg:mb-0">
          <div className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-3xl p-5 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-brand-200 text-xs mb-1">{t("progress.currentLevel")}</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{user?.currentLevel}</span>
                  <span className="text-brand-300 text-sm">- {getLanguageLabel(user?.studyLanguage, locale)}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full">
                  <Flame size={16} className="text-orange-400" />
                  <span className="font-bold">{user?.streak}</span>
                  <span className="text-brand-200 text-xs">{t("progress.dayStreak")}</span>
                </div>
              </div>
            </div>

            {user?.learningGoal && (
              <div className="bg-white/10 rounded-2xl px-4 py-3">
                <p className="text-xs text-brand-200 mb-0.5">{t("progress.yourGoal")}</p>
                <p className="text-sm font-medium">{user.learningGoal}</p>
              </div>
            )}
          </div>

          {/* Weekly card */}
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-brand-600" />
              <h3 className="font-semibold text-slate-700">{t("progress.thisWeek")}</h3>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-4xl font-bold text-brand-600">{stats?.weeklyLearned || 0}</p>
              <div>
                <p className="text-sm font-medium text-slate-700">{t("progress.wordsLearned")}</p>
                <p className="text-xs text-slate-400">{t("progress.inLastDays")}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right columns: stats grid + recent sessions */}
        <div className="lg:col-span-2 space-y-5">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: CheckCircle, label: t("progress.stats.wordsLearned"), value: stats?.learnedCount || 0, color: "green" },
              { icon: BookOpen, label: t("progress.stats.wordsSaved"), value: stats?.savedCount || 0, color: "blue" },
              { icon: AlertCircle, label: t("progress.stats.difficultWords"), value: stats?.difficultCount || 0, color: "red" },
              { icon: Calendar, label: t("progress.stats.sessionsDone"), value: stats?.sessionCount || 0, color: "purple" },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="card">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-3 ${statColorClasses[color]?.bg ?? "bg-brand-100"}`}>
                  <Icon size={18} className={statColorClasses[color]?.text ?? "text-brand-600"} />
                </div>
                <p className="text-2xl font-bold text-slate-800">{value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Recent sessions */}
          {stats?.recentSessions && stats.recentSessions.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-slate-700 mb-4">{t("progress.recentSessions")}</h3>
              <div className="space-y-3">
                {stats.recentSessions.map((s, i) => {
                  const sessionKey = `progress.sessionTypes.${s.sessionType}`;
                  const translatedSession = t(sessionKey);
                  const sessionLabel =
                    translatedSession === sessionKey
                      ? s.sessionType.replace(/_/g, " ").toLowerCase()
                      : translatedSession;
                  return (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-surface-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-slate-700 capitalize">{sessionLabel}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(s.startedAt).toLocaleDateString(locale)}
                        </p>
                      </div>
                      <div className="text-right">
                        {s.score !== null && s.score !== undefined && (
                          <p className={`text-sm font-bold ${s.score >= 0.7 ? "text-green-600" : "text-amber-600"}`}>
                            {Math.round(s.score * 100)}%
                          </p>
                        )}
                        <p className="text-xs text-slate-400">{s.wordsReviewed} {t("progress.wordsReviewed")}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
