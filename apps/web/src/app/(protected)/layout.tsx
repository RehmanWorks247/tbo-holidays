import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { ConfigurationRequired } from '@/components/shared/configuration-required';
import { getServerEnvironment } from '@/config/server-env';
import { ProtectedSession } from '@/features/authentication/components/protected-session';

export const dynamic = 'force-dynamic';

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  if (!getServerEnvironment().authEnabled) return <ConfigurationRequired />;
  const session = await auth();
  if (!session.userId) redirect('/sign-in');
  return <ProtectedSession>{children}</ProtectedSession>;
}
