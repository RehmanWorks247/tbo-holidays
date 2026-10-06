import { useAuth } from '@clerk/nextjs';
import { useQuery } from '@tanstack/react-query';

import { requireSessionToken } from '@/services/api/api-client';
import { usersApi } from '@/services/api/users.api';

export const accountKey = (userId: string | null | undefined) => ['account', userId] as const;

export function useAccount() {
  const { userId, getToken } = useAuth();
  return useQuery({
    queryKey: accountKey(userId),
    queryFn: async ({ signal }) => usersApi.me(await requireSessionToken(getToken), signal),
    enabled: Boolean(userId),
  });
}
