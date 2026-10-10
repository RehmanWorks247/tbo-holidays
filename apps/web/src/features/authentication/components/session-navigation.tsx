'use client';

import { useAuth, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { useAuthenticationEnabled } from '@/providers/app-providers';

function ClerkSessionNavigation() {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded)
    return (
      <span className="text-xs text-white/80" aria-label="Loading account">
        Loading…
      </span>
    );
  if (isSignedIn)
    return (
      <div className="flex items-center gap-4">
        <Link className="hidden text-xs text-white sm:inline" href="/account">
          Account
        </Link>
        <UserButton />
      </div>
    );
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="border-white/70 bg-transparent text-xs text-white hover:bg-white/15 hover:text-white"
    >
      <Link href="/sign-in">Sign in</Link>
    </Button>
  );
}

export function SessionNavigation() {
  const enabled = useAuthenticationEnabled();
  return enabled ? (
    <ClerkSessionNavigation />
  ) : (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="border-white/70 bg-transparent text-xs text-white hover:bg-white/15 hover:text-white"
    >
      <Link href="/sign-in">Sign in</Link>
    </Button>
  );
}
