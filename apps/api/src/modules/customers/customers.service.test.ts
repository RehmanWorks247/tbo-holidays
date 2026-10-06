import type { BookingGuestInput } from '@hotel/contracts';
import { describe, expect, it } from 'vitest';

import { CustomersService } from './customers.service';

describe('quoted room occupancy', () => {
  const service = new CustomersService();
  const adult: BookingGuestInput = {
    roomIndex: 0,
    title: 'Ms',
    firstName: 'Test',
    lastName: 'Guest',
    type: 'ADULT',
    leadGuest: true,
  };
  const child: BookingGuestInput = {
    roomIndex: 0,
    title: 'Miss',
    firstName: 'Child',
    lastName: 'Guest',
    type: 'CHILD',
    age: 7,
    leadGuest: false,
  };
  const occupancy = { nationality: 'PK', rooms: [{ adults: 1, childrenAges: [7] }] };

  it('requires the exact quoted room counts and child ages', () => {
    expect(() => service.assertGuestsMatchRooms([adult, child], occupancy)).not.toThrow();
    expect(() => service.assertGuestsMatchRooms([adult], occupancy)).toThrow('quoted occupancy');
    expect(() => service.assertGuestsMatchRooms([adult, { ...child, age: 8 }], occupancy)).toThrow(
      'quoted occupancy',
    );
    expect(() =>
      service.assertGuestsMatchRooms([adult, { ...child, roomIndex: 1 }], occupancy),
    ).toThrow('selected rooms');
  });
});
