'use client';

import { useAuth, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { useAuthenticationEnabled } from '@/providers/app-providers';
import { useSiteMessages } from '@/providers/use-site-messages';

function ClerkSessionNavigation() {
  const { messages } = useSiteMessages();
  const { isSignedIn, isLoaded } = useAuth();
  if (!isLoaded)
    return (
      <span className="text-xs text-muted-foreground" aria-label={messages.header.loadingAccount}>
        {messages.header.loading}
      </span>
    );
  if (isSignedIn)
    return (
      <div className="flex items-center gap-4">
        <Link className="hidden text-xs text-foreground sm:inline" href="/account">
          {messages.header.account}
        </Link>
        <UserButton />
      </div>
    );
  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="bg-transparent text-xs text-foreground hover:bg-muted hover:text-foreground"
    >
      <Link href="/sign-in">{messages.header.signIn}</Link>
    </Button>
  );
}

export function SessionNavigation() {
  const enabled = useAuthenticationEnabled();
  const { messages } = useSiteMessages();
  return enabled ? (
    <ClerkSessionNavigation />
  ) : (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="bg-transparent text-xs text-foreground hover:bg-muted hover:text-foreground"
    >
      <Link href="/sign-in">{messages.header.signIn}</Link>
    </Button>
  );
}
