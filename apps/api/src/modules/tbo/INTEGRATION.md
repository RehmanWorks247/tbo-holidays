# TBO integration boundary

The adapter is deliberately disabled by default. No fabricated inventory is returned.

The public [TBO API portal](https://api.tbotechnology.in/AIS_APISpecification.aspx)
documents **SOAP v7**, not a verified JSON contract for this account. This scaffold's
read-only JSON DTOs and mapping are candidate integration points. Obtain the current
REST specification, sandbox URLs, account credentials, and agency certification from
TBO. Validate them against recorded, sanitized sandbox fixtures before enabling
`TBO_READS_ENABLED=true`. Configure an HTTPS `TBO_BASE_URL`; it must support the
Search, PreBook, Hoteldetails, and TBOHotelCodeList methods or adapt this module to
separate static-content and availability endpoints supplied for the account.

Confirm `TotalFare` includes `TotalTax`, currency precision, extra-guest charges,
fees payable at the property, room combinations, rate expiration, cancellation
deadlines/timezones, and status codes. The candidate mapping subtracts `TotalTax`
from `TotalFare`; no other service should reinterpret supplier price fields.
The scaffold does not yet map cancellation policies or supplements for booking.

Booking, lookup and cancellation intentionally return
`SUPPLIER_INTEGRATION_REQUIRED` until their certified DTOs and reconciliation
semantics are implemented. Adding credentials does not turn these methods on.
Implement them here behind `HotelSupplier`; never in controllers or payment code.
Do not put mutation methods in `TboClient.read`, which retries safe reads only.

[TBO certification guidance](https://api.tbotechnology.in/AIS_Going-live-certification.aspx)
requires agency certification for live access and warns that an apparent booking
failure may have actually created a reservation. Persist a unique client reference
before sending a booking request, and reconcile ambiguous outcomes by that reference
before any operator-approved retry. Never blindly retry booking creation.
