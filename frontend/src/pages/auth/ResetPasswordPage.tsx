import { useState, type FormEvent } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { authApi } from "@/api/auth";
import { useT } from "@/i18n";
import toast from "@/lib/toast";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const t = useT();
  const token = searchParams.get("token") ?? "";

  const [done, setDone] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (): { password?: string; confirm?: string } => {
    const next: { password?: string; confirm?: string } = {};
    if (!password) next.password = t("auth.validation.passwordRequired");
    else if (password.length < 8) next.password = t("auth.validation.passwordMin");
    if (!confirm) next.confirm = t("auth.validation.confirmRequired");
    else if (password !== confirm) next.confirm = t("auth.validation.passwordsMismatch");
    return next;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = validate();
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    setIsSubmitting(true);
    try {
      await authApi.resetPassword({ token, password });
      setDone(true);
    } catch {
      toast.error(t("auth.resetPassword.invalidToken"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12 bg-surface-50">
        <div className="w-full max-w-sm text-center">
          <p className="text-slate-500 mb-6">{t("auth.resetPassword.invalidToken")}</p>
          <Link to="/forgot-password" className="btn-primary inline-block">
            {t("auth.forgotPassword.sendLink")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12 bg-surface-50">
      <div className="w-full max-w-sm">
        <Link
          to="/login"
          className="flex items-center gap-2 text-slate-600 mb-10 w-fit hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">{t("auth.forgotPassword.backToLogin")}</span>
        </Link>

        {done ? (
          <div className="flex flex-col items-center text-center pt-6">
            <div className="w-16 h-16 bg-green-100 rounded-3xl flex items-center justify-center mb-5">
              <CheckCircle2 size={28} className="text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              {t("auth.resetPassword.success")}
            </h2>
            <p className="text-slate-500 max-w-xs">{t("auth.resetPassword.successDesc")}</p>
            <button onClick={() => navigate("/login")} className="btn-primary mt-8 w-full">
              {t("auth.resetPassword.backToLogin")}
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-slate-800 mb-1">
              {t("auth.resetPassword.title")}
            </h1>
            <p className="text-slate-500 mb-8">{t("auth.resetPassword.subtitle")}</p>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t("auth.resetPassword.passwordLabel")}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("auth.resetPassword.passwordPlaceholder")}
                  className="input"
                />
                {errors.password && (
                  <p className="text-xs text-red-500 mt-1">{errors.password}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t("auth.resetPassword.confirmPasswordLabel")}
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={t("auth.resetPassword.confirmPasswordPlaceholder")}
                  className="input"
                />
                {errors.confirm && (
                  <p className="text-xs text-red-500 mt-1">{errors.confirm}</p>
                )}
              </div>
              <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
                {isSubmitting
                  ? t("auth.resetPassword.submitting")
                  : t("auth.resetPassword.submit")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
