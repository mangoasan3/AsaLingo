import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { useLogin } from "@/hooks/useAuth";
import { useT } from "@/i18n";
import { API_BASE_URL } from "@/api/client";
import { AuthHeroVideoPanel } from "./AuthHeroVideoPanel";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const login = useLogin();
  const t = useT();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: { email?: string; password?: string } = {};
    if (!formData.email.trim()) {
      nextErrors.email = t("auth.validation.emailRequired");
    } else if (!/^\S+@\S+\.\S+$/.test(formData.email)) {
      nextErrors.email = t("auth.validation.emailInvalid");
    }

    if (!formData.password) {
      nextErrors.password = t("auth.validation.passwordRequired");
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    login.mutate(formData);
  };

  const handleGoogle = () => {
    window.location.href = `${API_BASE_URL}/auth/google`;
  };

  return (
    <div className="min-h-dvh bg-surface-50 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
      <div className="flex min-w-0 flex-col justify-center px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-8 xl:px-12">
        <div className="mx-auto flex w-full max-w-[26rem] items-center gap-2.5 lg:max-w-md">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <img src="/app-icon.png" alt={t("common.appName")} className="h-full w-full object-cover" />
          </div>
          <span className="text-xl font-bold text-slate-800">{t("common.appName")}</span>
        </div>

        <div className="mx-auto mt-8 w-full max-w-[26rem] lg:max-w-md">
          <h1 className="text-3xl font-bold text-slate-800">{t("auth.login.title")}</h1>
          <p className="mt-1.5 text-sm text-slate-500">{t("auth.login.subtitle")}</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-3.5">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("auth.login.emailLabel")}
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(event) => {
                  setFormData((current) => ({ ...current, email: event.target.value }));
                  setErrors((current) => ({ ...current, email: undefined }));
                }}
                placeholder={t("auth.login.emailPlaceholder")}
                className="input py-3 text-sm"
                autoComplete="email"
              />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("auth.login.passwordLabel")}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(event) => {
                    setFormData((current) => ({ ...current, password: event.target.value }));
                    setErrors((current) => ({ ...current, password: undefined }));
                  }}
                  placeholder={t("auth.login.passwordPlaceholder")}
                  className="input py-3 pr-12 text-sm"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                  aria-label={showPassword ? t("auth.common.hidePassword") : t("auth.common.showPassword")}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password}</p>}
            </div>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm font-medium text-brand-600">
                {t("auth.login.forgotPassword")}
              </Link>
            </div>

            <button type="submit" disabled={login.isPending} className="btn-primary mt-1 w-full py-3">
              {login.isPending ? t("auth.login.signingIn") : t("auth.login.signIn")}
            </button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-surface-50 px-3 text-xs font-medium text-slate-400">
                {t("auth.login.orContinue")}
              </span>
            </div>
          </div>

          <button
            onClick={handleGoogle}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-surface-200 bg-white py-3 font-semibold text-slate-700 shadow-sm transition-all hover:bg-surface-50 active:scale-[0.98]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            {t("auth.login.continueWithGoogle")}
          </button>

          <p className="mt-6 text-center text-sm text-slate-500">
            {t("auth.login.noAccount")}{" "}
            <Link to="/register" className="font-semibold text-brand-600">
              {t("auth.login.signUp")}
            </Link>
          </p>
        </div>
      </div>

      <AuthHeroVideoPanel
        title={t("auth.login.panelTitle")}
        description={t("auth.login.panelDescription")}
        appName={t("common.appName")}
        glow="top"
      />
    </div>
  );
}
