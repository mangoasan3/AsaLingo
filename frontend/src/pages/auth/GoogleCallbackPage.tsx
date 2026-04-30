import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { usersApi } from "@/api/users";
import { FullPageLoader } from "@/components/ui/LoadingSpinner";

export default function GoogleCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth, logout } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get("token");
    const needsOnboarding = searchParams.get("onboarding") === "true";

    if (!token) {
      logout();
      navigate("/login", { replace: true });
      return;
    }

    useAuthStore.setState({ accessToken: token, isAuthenticated: true });

    usersApi.getMe()
      .then((res) => {
        setAuth(res.data.data, token);
        navigate(needsOnboarding ? "/onboarding" : "/app", { replace: true });
      })
      .catch(() => {
        logout();
        navigate("/login", { replace: true });
      });
  }, [logout, navigate, searchParams, setAuth]);

  return <FullPageLoader />;
}
