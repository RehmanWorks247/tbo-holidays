import { LocalizedPageHeading as PageHeading } from '@/components/shared/page-heading';
import { AdminPlaceholder } from '@/features/account/components/admin-placeholder';

export default function AdminPage() {
  return (
    <>
      <PageHeading title="adminTitle" />
      <AdminPlaceholder />
    </>
  );
}
