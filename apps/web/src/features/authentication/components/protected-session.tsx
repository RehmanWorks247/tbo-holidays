'use client';

import { RedirectToSignIn, useAuth } from '@clerk/nextjs';
import type { ReactNode } from 'react';

import { Skeleton } from '@/components/ui/skeleton';

/** Layouts persist across navigation; react to session changes without exposing stale UI. */
export function ProtectedSession({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <Skeleton className="h-48" />;
  if (!isSignedIn) return <RedirectToSignIn />;
  return children;
}
