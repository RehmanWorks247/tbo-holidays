import { PageHeading } from '@/components/shared/page-heading';
import { AccountProfile } from '@/features/account/components/account-profile';

export default function AccountPage() {
  return (
    <>
      <PageHeading
        title="My account"
        description="Keep your contact details ready for your next stay."
      />
      <AccountProfile />
    </>
  );
}
