import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@shared/schema";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

async function fetchCurrentUser(): Promise<User | null> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error("Failed to fetch user");
  const data = await res.json();
  return data.user;
}

async function requestMagicLink(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
  const res = await fetch("/api/auth/magic-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    credentials: "include",
  });
  return res.json();
}

async function verifyToken(token: string): Promise<{ success: boolean; user?: User; error?: string }> {
  const res = await fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`, {
    credentials: "include",
  });
  return res.json();
}

async function logoutUser(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
}

export function useAuth(): AuthState & {
  requestMagicLink: (email: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  verifyToken: (token: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  logout: () => Promise<void>;
  refetch: () => void;
} {
  const queryClient = useQueryClient();

  const { data: user, isLoading, refetch } = useQuery({
    queryKey: ["auth", "user"],
    queryFn: fetchCurrentUser,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const requestMagicLinkMutation = useMutation({
    mutationFn: requestMagicLink,
  });

  const verifyTokenMutation = useMutation({
    mutationFn: verifyToken,
    onSuccess: (data) => {
      if (data.success && data.user) {
        queryClient.setQueryData(["auth", "user"], data.user);
      }
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      queryClient.setQueryData(["auth", "user"], null);
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    requestMagicLink: requestMagicLinkMutation.mutateAsync,
    verifyToken: verifyTokenMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    refetch: () => refetch(),
  };
}
