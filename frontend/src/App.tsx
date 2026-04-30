import { Suspense, lazy, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useLocaleStore } from "@/store/localeStore";
import { useCurrentUser } from "@/hooks/useAuth";
import { FullPageLoader } from "@/components/ui/LoadingSpinner";

const SplashPage = lazy(() => import("@/pages/SplashPage"));
const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/auth/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/pages/auth/ResetPasswordPage"));
const GoogleCallbackPage = lazy(() => import("@/pages/auth/GoogleCallbackPage"));
const OnboardingPage = lazy(() => import("@/pages/OnboardingPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));
const AppLayout = lazy(() => import("@/components/layout/AppLayout"));
const HomePage = lazy(() => import("@/pages/app/HomePage"));
const DiscoverPage = lazy(() => import("@/pages/app/DiscoverPage"));
const WordDetailPage = lazy(() => import("@/pages/app/WordDetailPage"));
const MyWordsPage = lazy(() => import("@/pages/app/MyWordsPage"));
const PracticePage = lazy(() => import("@/pages/app/PracticePage"));
const RoadmapPage = lazy(() => import("@/pages/app/RoadmapPage"));
const ProgressPage = lazy(() => import("@/pages/app/ProgressPage"));
const ProfilePage = lazy(() => import("@/pages/app/ProfilePage"));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (user && !user.onboardingDone) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

export default function App() {
  const locale = useLocaleStore((s) => s.locale);
  // Keep user data fresh
  useCurrentUser();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={<SplashPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />

        {/* Onboarding (auth required) */}
        <Route
          path="/onboarding"
          element={
            <RequireAuth>
              <OnboardingPage />
            </RequireAuth>
          }
        />

        {/* App (auth + onboarding required) */}
        <Route
          path="/app"
          element={
            <RequireAuth>
              <RequireOnboarding>
                <AppLayout />
              </RequireOnboarding>
            </RequireAuth>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="discover" element={<DiscoverPage />} />
          <Route path="roadmap" element={<RoadmapPage />} />
          <Route path="words/:id" element={<WordDetailPage />} />
          <Route path="my-words" element={<MyWordsPage />} />
          <Route path="practice" element={<PracticePage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
