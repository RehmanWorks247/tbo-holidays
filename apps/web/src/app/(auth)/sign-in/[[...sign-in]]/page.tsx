import { SignIn } from '@clerk/nextjs';

import { ConfigurationRequired } from '@/components/shared/configuration-required';
import { getServerEnvironment } from '@/config/server-env';

export const dynamic = 'force-dynamic';

export default function SignInPage() {
  if (!getServerEnvironment().authEnabled) return <ConfigurationRequired />;
  return (
    <div className="flex justify-center">
      <SignIn fallbackRedirectUrl="/account" />
    </div>
  );
}
