import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { authApi } from "@/api/auth";
import { usersApi } from "@/api/users";
import { useT } from "@/i18n";
import toast from "@/lib/toast";

export function useCurrentUser(options: { enabled?: boolean } = {}) {
  const { isAuthenticated, setUser } = useAuthStore();
  const enabled = options.enabled ?? true;

  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await usersApi.getMe();
      setUser(res.data.data);
      return res.data.data;
    },
    enabled: enabled && isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });
}

export function useLogin() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: { email: string; password: string }) => authApi.login(data),
    onSuccess: (res) => {
      const { accessToken, user } = res.data.data;
      setAuth(user, accessToken);
      queryClient.setQueryData(["me"], user);
      if (!user.onboardingDone) {
        navigate("/onboarding");
      } else {
        navigate("/app");
      }
    },
    onError: () => {
      toast.error(t("auth.messages.loginFailed"));
    },
  });
}

export function useRegister() {
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const t = useT();

  return useMutation({
    mutationFn: (data: { name: string; email: string; password: string }) =>
      authApi.register(data),
    onSuccess: (res) => {
      const { accessToken, user } = res.data.data;
      setAuth(user, accessToken);
      queryClient.setQueryData(["me"], user);
      navigate("/onboarding");
    },
    onError: () => {
      toast.error(t("auth.messages.registrationFailed"));
    },
  });
}

export function useLogout() {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      logout();
      queryClient.clear();
      navigate("/");
    },
  });
}
