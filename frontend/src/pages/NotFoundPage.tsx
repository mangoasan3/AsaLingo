import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useT } from "@/i18n";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFoundPage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const t = useT();

  const handleHome = () => {
    navigate(isAuthenticated ? "/app" : "/");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Large 404 */}
        <div className="relative mb-8">
          <p className="text-[120px] lg:text-[160px] font-black text-slate-100 leading-none select-none">
            404
          </p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 bg-brand-100 rounded-3xl flex items-center justify-center">
              <span className="text-4xl">🔍</span>
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-3">
          {t("notFound.title")}
        </h1>
        <p className="text-slate-500 mb-8 leading-relaxed">
          {t("notFound.description")}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={16} />
            {t("notFound.goBack")}
          </button>
          <button
            onClick={handleHome}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-brand-600 text-white font-medium text-sm hover:bg-brand-700 transition-colors"
          >
            <Home size={16} />
            {t("notFound.home")}
          </button>
        </div>
      </div>
    </div>
  );
}
