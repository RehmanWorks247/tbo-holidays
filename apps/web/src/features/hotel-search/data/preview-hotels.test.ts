import { describe, expect, it } from 'vitest';

import { DEFAULT_PREVIEW_STAY, previewHref, readPreviewStay } from './preview-hotels';

describe('UI preview navigation', () => {
  it('preserves multiple rooms and child ages between results, hotel and checkout', () => {
    const stay = {
      ...DEFAULT_PREVIEW_STAY,
      destination: 'benidorm',
      checkIn: '2027-03-02',
      nights: 12,
      rooms: [
        { adults: 2, childrenAges: [0, 12] },
        { adults: 1, childrenAges: [17] },
      ],
    };
    const href = previewHref('/preview/checkout', stay, {
      hotel: 'pueblo-benidorm',
      room: 'double-balcony',
    });
    const params = new URL(href, 'http://localhost').searchParams;
    expect(readPreviewStay(params)).toEqual(stay);
    expect(params.get('hotel')).toBe('pueblo-benidorm');
    expect(params.get('room')).toBe('double-balcony');
  });

  it.each([
    'rooms=not-json',
    'rooms=%5B%5D',
    'rooms=%5B%7B%22adults%22%3A99%2C%22childrenAges%22%3A%5B%5D%7D%5D',
    'nights=0',
    'nights=1000000',
    'checkIn=2027-02-30',
  ])('uses a safe sample stay for malformed URL input: %s', (query) => {
    expect(readPreviewStay(new URLSearchParams(query))).toEqual(DEFAULT_PREVIEW_STAY);
  });

  it('does not copy unrelated URL fields into the preview model', () => {
    const stay = readPreviewStay(
      new URLSearchParams('amount=1&rateId=live-rate&email=example%40example.com'),
    );
    expect(stay).toEqual(DEFAULT_PREVIEW_STAY);
    const href = previewHref('/preview/hotels', stay);
    expect(href).not.toMatch(/rateId|amount|email/);
  });
});
