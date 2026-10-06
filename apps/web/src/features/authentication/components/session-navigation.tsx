'use client';

import { useAuth, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { useAuthenticationEnabled } from '@/providers/app-providers';

function ClerkSessionNavigation() {
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded) return <span className="text-sm text-muted-foreground">Loading account…</span>;
  if (isSignedIn)
    return (
      <div className="flex items-center gap-4">
        <Link className="text-sm" href="/account">
          Account
        </Link>
        <UserButton />
      </div>
    );
  return (
    <Button asChild variant="outline" size="sm">
      <Link href="/sign-in">Sign in</Link>
    </Button>
  );
}

export function SessionNavigation() {
  const enabled = useAuthenticationEnabled();
  return enabled ? (
    <ClerkSessionNavigation />
  ) : (
    <Button asChild variant="outline" size="sm">
      <Link href="/sign-in">Sign in</Link>
    </Button>
  );
}
