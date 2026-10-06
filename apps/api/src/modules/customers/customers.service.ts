import type { BookingGuestInput } from '@hotel/contracts';
import { Injectable } from '@nestjs/common';

import { DomainError } from '../../common/errors/domain-error';
import { occupancySnapshotSchema } from '../bookings/booking-snapshots';

@Injectable()
export class CustomersService {
  assertGuestsMatchRooms(guests: BookingGuestInput[], snapshot: unknown): void {
    const occupancy = occupancySnapshotSchema.parse(snapshot);
    if (
      guests.some((guest) => guest.type === 'ADULT' && guest.age !== undefined && guest.age < 18)
    ) {
      throw new DomainError('GUEST_AGE_INVALID', 'An adult guest must be at least 18 years old.');
    }
    if (
      guests.filter((guest) => guest.leadGuest).length !== 1 ||
      guests.some((guest) => guest.leadGuest && guest.type !== 'ADULT')
    ) {
      throw new DomainError('INVALID_LEAD_GUEST', 'Exactly one adult must be the lead guest.');
    }
    if (guests.some((guest) => guest.roomIndex < 0 || guest.roomIndex >= occupancy.rooms.length)) {
      throw new DomainError(
        'GUEST_OCCUPANCY_MISMATCH',
        'Guest rooms must match the selected rooms.',
      );
    }
    occupancy.rooms.forEach((room, roomIndex) => {
      const inRoom = guests.filter((guest) => guest.roomIndex === roomIndex);
      const children = inRoom.filter((guest) => guest.type === 'CHILD');
      const expectedAges = [...room.childrenAges].sort((a, b) => a - b);
      const actualAges = children.map((guest) => guest.age).sort((a, b) => (a ?? -1) - (b ?? -1));
      if (
        inRoom.filter((guest) => guest.type === 'ADULT').length !== room.adults ||
        expectedAges.length !== actualAges.length ||
        expectedAges.some((age, index) => age !== actualAges[index])
      ) {
        throw new DomainError(
          'GUEST_OCCUPANCY_MISMATCH',
          'Guest counts and child ages must match the quoted occupancy.',
        );
      }
    });
  }
}
