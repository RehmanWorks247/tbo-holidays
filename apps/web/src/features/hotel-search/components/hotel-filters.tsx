import type { HotelFilters as Filters } from '@hotel/contracts';

import { Input } from '@/components/ui/input';

export function HotelFilters({
  value,
  onChange,
}: {
  value: Filters;
  onChange: (filters: Filters) => void;
}) {
  return (
    <aside aria-label="Filter hotels" className="space-y-4 rounded-lg border bg-card p-5">
      <h2 className="font-semibold">Filter results</h2>
      <div>
        <label className="field-label" htmlFor="hotel-name">
          Hotel name
        </label>
        <Input
          id="hotel-name"
          value={value.name ?? ''}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
        />
      </div>
      <div>
        <label className="field-label" htmlFor="star-rating">
          Star rating
        </label>
        <select
          id="star-rating"
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
          value={value.starRating ?? ''}
          onChange={(event) =>
            onChange({
              ...value,
              starRating: event.target.value ? Number(event.target.value) : undefined,
            })
          }
        >
          <option value="">Any rating</option>
          {[5, 4, 3, 2, 1].map((rating) => (
            <option key={rating} value={rating}>
              {rating} stars
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={value.refundable === true}
          onChange={(event) =>
            onChange({ ...value, refundable: event.target.checked ? true : undefined })
          }
        />
        Refundable options only
      </label>
    </aside>
  );
}
