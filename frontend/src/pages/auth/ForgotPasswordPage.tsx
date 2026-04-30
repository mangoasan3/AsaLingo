import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import { authApi } from "@/api/auth";
import { useT } from "@/i18n";
import toast from "@/lib/toast";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useT();

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim()) {
      setError(t("auth.validation.emailRequired"));
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError(t("auth.validation.emailInvalid"));
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch {
      toast.error(t("toast.error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-12 bg-surface-50">
      <div className="w-full max-w-sm">
        <Link to="/login" className="flex items-center gap-2 text-slate-600 mb-10 w-fit hover:text-slate-800 transition-colors">
          <ArrowLeft size={20} />
          <span className="font-medium">{t("auth.forgotPassword.backToLogin")}</span>
        </Link>

        {sent ? (
          <div className="flex flex-col items-center text-center pt-6">
            <div className="w-16 h-16 bg-brand-100 rounded-3xl flex items-center justify-center mb-5">
              <Mail size={28} className="text-brand-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">
              {t("auth.forgotPassword.checkEmail")}
            </h2>
            <p className="text-slate-500 max-w-xs">
              {t("auth.forgotPassword.checkEmailDesc")}
            </p>
            <Link to="/login" className="btn-primary mt-8 inline-block">
              {t("auth.forgotPassword.backToLogin")}
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-slate-800 mb-1">
              {t("auth.forgotPassword.title")}
            </h1>
            <p className="text-slate-500 mb-8">{t("auth.forgotPassword.subtitle")}</p>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {t("auth.forgotPassword.emailLabel")}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={t("auth.forgotPassword.emailPlaceholder")}
                  className="input"
                />
                {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
              </div>
              <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
                {isSubmitting ? t("auth.forgotPassword.sending") : t("auth.forgotPassword.sendLink")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
