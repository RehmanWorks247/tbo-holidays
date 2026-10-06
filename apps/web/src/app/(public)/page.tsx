import { PageHeading } from '@/components/shared/page-heading';
import { HotelSearchForm } from '@/features/hotel-search/components/hotel-search-form';

export default function HomePage() {
  return (
    <div className="space-y-8">
      <PageHeading
        title="Find your next stay"
        description="Start with a destination, choose your dates, and explore the available rooms."
      />
      <HotelSearchForm />
      <p className="text-sm text-muted-foreground">
        Prices and room availability are confirmed again before you book.
      </p>
    </div>
  );
}
