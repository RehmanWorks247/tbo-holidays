import { LocalizedPageHeading as PageHeading } from '@/components/shared/page-heading';
import { AccountProfile } from '@/features/account/components/account-profile';

export default function AccountPage() {
  return (
    <>
      <PageHeading title="accountTitle" description="accountDescription" />
      <AccountProfile />
    </>
  );
}
