import { PageHeading } from '@/components/shared/page-heading';
import { AdminPlaceholder } from '@/features/account/components/admin-placeholder';

export default function AdminPage() {
  return (
    <>
      <PageHeading title="Administration" />
      <AdminPlaceholder />
    </>
  );
}
