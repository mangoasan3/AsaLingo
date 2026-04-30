import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Edit3, LogOut, Moon, Sun, Target, Trash2, User } from "lucide-react";
import toast from "@/lib/toast";
import { useAuthStore } from "@/store/authStore";
import { useLocaleStore } from "@/store/localeStore";
import { usersApi } from "@/api/users";
import { useLogout } from "@/hooks/useAuth";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import LevelBadge from "@/components/ui/LevelBadge";
import { useT } from "@/i18n";
import type { CefrLevel } from "@/types";
import { cn } from "@/utils/cn";
import { getLanguageLabel } from "@/utils/language";
import { getTopicLabel } from "@/utils/topic";

const LEVELS: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const { setUser, logout: resetSession } = useAuthStore();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const locale = useLocaleStore((s) => s.locale);
  const darkMode = useLocaleStore((s) => s.darkMode);
  const toggleDarkMode = useLocaleStore((s) => s.toggleDarkMode);
  const t = useT();
  const [editingLevel, setEditingLevel] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const updateLevel = useMutation({
    mutationFn: (level: CefrLevel) => usersApi.updateMe({ currentLevel: level }),
    onSuccess: (res) => {
      setUser(res.data.data);
      queryClient.setQueryData(["me"], res.data.data);
      setEditingLevel(false);
      toast.success(t("profile.levelUpdated"));
    },
  });

  const deleteAccount = useMutation({
    mutationFn: () => usersApi.deleteAccount(),
    onSuccess: () => {
      setDeleteDialogOpen(false);
      resetSession();
      queryClient.clear();
      window.location.href = "/";
    },
    onError: () => toast.error(t("profile.deleteError")),
  });

  if (!user) return null;

  const memberSince = new Date(user.createdAt).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
  const tOrFallback = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  return (
    <div className="mx-auto max-w-5xl px-5 pb-6 pt-8 lg:px-10 lg:pt-12">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 lg:text-3xl">{t("profile.title")}</h1>
        <button
          type="button"
          onClick={toggleDarkMode}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-card transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          <span>{darkMode ? t("profile.lightMode") : t("profile.darkMode")}</span>
        </button>
      </div>

      <div className="lg:grid lg:grid-cols-3 lg:gap-8">
        <div className="mb-5 space-y-5 lg:col-span-1 lg:mb-0">
          <div className="card">
            <div className="mb-4 flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-brand-100">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="h-14 w-14 rounded-3xl object-cover" />
                ) : (
                  <User size={24} className="text-brand-600" />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-slate-800 dark:text-slate-100">{user.name}</h2>
                <p className="truncate text-sm text-slate-400 dark:text-slate-500">{user.email}</p>
                <span className="mt-1 inline-block rounded-full bg-surface-100 px-2 py-0.5 text-xs text-slate-400 dark:bg-slate-800 dark:text-slate-400">
                  {user.authProvider === "GOOGLE" ? t("profile.authGoogle") : t("profile.authEmail")}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-surface-100 pt-3 dark:border-slate-800">
              <div>
                <p className="mb-0.5 text-xs text-slate-400 dark:text-slate-500">{t("profile.studying")}</p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{getLanguageLabel(user.studyLanguage, locale)}</p>
              </div>
              <div>
                <p className="mb-0.5 text-xs text-slate-400 dark:text-slate-500">{t("profile.nativeLanguage")}</p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{getLanguageLabel(user.nativeLanguage, locale)}</p>
              </div>
              <div className="col-span-2">
                <p className="mb-0.5 text-xs text-slate-400 dark:text-slate-500">{t("profile.memberSince")}</p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{memberSince}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-card transition-shadow hover:shadow-soft dark:bg-slate-900"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                <LogOut size={16} className="text-slate-600 dark:text-slate-300" />
              </div>
              <span className="font-medium text-slate-700 dark:text-slate-100">{t("profile.logout")}</span>
            </button>

            <button
              onClick={() => setDeleteDialogOpen(true)}
              disabled={deleteAccount.isPending}
              className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-card transition-shadow hover:shadow-soft dark:bg-slate-900"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50">
                <Trash2 size={16} className="text-red-500" />
              </div>
              <span className="font-medium text-red-500">{t("profile.deleteAccount")}</span>
            </button>
          </div>
        </div>

        <div className="space-y-5 lg:col-span-2">
          <div className="card">
            <div
              className="flex cursor-pointer items-center justify-between"
              onClick={() => setEditingLevel((current) => !current)}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-100">
                  <Target size={18} className="text-brand-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-100">{t("profile.currentLevel")}</p>
                  <div className="mt-0.5">
                    <LevelBadge level={user.currentLevel} />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                <Edit3 size={15} />
                <span className="text-xs">{t("profile.changeLevel")}</span>
              </div>
            </div>

            {editingLevel && (
              <div className="mt-4 border-t border-surface-100 pt-4 dark:border-slate-800">
                <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">{t("profile.selectNewLevel")}</p>
                <div className="grid grid-cols-3 gap-2">
                  {LEVELS.map((level) => (
                    <button
                      key={level}
                      onClick={() => updateLevel.mutate(level)}
                      disabled={updateLevel.isPending}
                      className={cn(
                        "rounded-2xl border-2 py-2.5 text-sm font-semibold transition-all",
                        user.currentLevel === level
                          ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-200"
                          : "border-surface-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      )}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-100">
                <BookOpen size={18} className="text-green-600" />
              </div>
              <p className="font-medium text-slate-700 dark:text-slate-100">{t("profile.learningPreferences")}</p>
            </div>

            {user.learningGoal && (
              <div className="mb-4 rounded-2xl bg-surface-50 p-3 dark:bg-slate-800">
                <p className="mb-1 text-xs text-slate-400 dark:text-slate-500">{t("profile.goal")}</p>
                <p className="text-sm text-slate-700 dark:text-slate-200">{user.learningGoal}</p>
              </div>
            )}

            {user.interests.length > 0 && (
              <div>
                <p className="mb-2 text-xs text-slate-400 dark:text-slate-500">{t("profile.interests")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {user.interests.map((interest) => (
                    <span
                      key={interest}
                      className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-950/40 dark:text-brand-200"
                    >
                      {getTopicLabel(interest, t)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={deleteDialogOpen}
        tone="danger"
        title={tOrFallback("profile.deleteTitle", t("profile.deleteAccount"))}
        description={tOrFallback("profile.deleteDescription", t("profile.deleteConfirm"))}
        confirmLabel={tOrFallback("profile.deleteConfirmAction", t("profile.deleteAccount"))}
        cancelLabel={tOrFallback("profile.deleteCancel", t("common.cancel"))}
        isPending={deleteAccount.isPending}
        icon={<Trash2 size={21} />}
        onConfirm={() => deleteAccount.mutate()}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}
