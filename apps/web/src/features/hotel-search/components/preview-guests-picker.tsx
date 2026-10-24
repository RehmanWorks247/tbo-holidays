'use client';

import { ChevronDown, Minus, Plus, Users, X } from 'lucide-react';
import { useId, useState } from 'react';

import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { PreviewStay } from '@/features/hotel-search/data/preview-hotels';

import styles from './preview-search-form.module.css';

type Room = PreviewStay['rooms'][number];

function GuestCounter({
  label,
  detail,
  count,
  min,
  max,
  roomNumber,
  onChange,
}: {
  label: string;
  detail: string;
  count: number;
  min: number;
  max: number;
  roomNumber: number;
  onChange: (count: number) => void;
}) {
  return (
    <div className={styles.guestRow}>
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <div className={styles.counter} role="group" aria-label={`${label} in room ${roomNumber}`}>
        <button
          type="button"
          disabled={count <= min}
          aria-label={`Remove ${label.toLowerCase()} from room ${roomNumber}`}
          onClick={() => onChange(count - 1)}
        >
          <Minus size={16} aria-hidden="true" />
        </button>
        <output aria-live="polite">{count}</output>
        <button
          type="button"
          disabled={count >= max}
          aria-label={`Add ${label.toLowerCase()} to room ${roomNumber}`}
          onClick={() => onChange(count + 1)}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export function PreviewGuestsPicker({
  rooms,
  onChange,
}: {
  rooms: PreviewStay['rooms'];
  onChange: (rooms: PreviewStay['rooms']) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const adults = rooms.reduce((total, room) => total + room.adults, 0);
  const children = rooms.reduce((total, room) => total + room.childrenAges.length, 0);

  function changeRoom(index: number, change: Partial<Room>) {
    onChange(rooms.map((room, roomIndex) => (roomIndex === index ? { ...room, ...change } : room)));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={styles.guestField}>
          <span className={styles.fieldLabel}>Rooms</span>
          <span className={styles.fieldValue}>
            <Users size={20} aria-hidden="true" />
            <span>
              {rooms.length} {rooms.length === 1 ? 'Room' : 'Rooms'} / {adults}{' '}
              {adults === 1 ? 'Adult' : 'Adults'}
              {children ? ` / ${children} ${children === 1 ? 'Child' : 'Children'}` : ''}
            </span>
            <ChevronDown size={15} aria-hidden="true" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className={`${styles.popover} ${styles.guestsPopover}`}
        aria-label="How many guests?"
        lang="en"
        dir="ltr"
      >
        <div className={styles.popoverHeading}>
          <h2>How many guests?</h2>
          <PopoverClose asChild>
            <button type="button" className={styles.closeButton} aria-label="Close guests">
              <X size={21} aria-hidden="true" />
            </button>
          </PopoverClose>
        </div>
        <div className={styles.roomsList}>
          {rooms.map((room, index) => (
            <fieldset key={`${id}-${index}`} className={styles.room}>
              <legend>Room {index + 1}</legend>
              {rooms.length > 1 ? (
                <button
                  type="button"
                  className={styles.removeRoom}
                  aria-label={`Remove room ${index + 1}`}
                  onClick={() => onChange(rooms.filter((_, roomIndex) => roomIndex !== index))}
                >
                  Remove
                </button>
              ) : null}
              <GuestCounter
                label="Adults"
                detail="Aged 18 and over"
                count={room.adults}
                min={1}
                max={4}
                roomNumber={index + 1}
                onChange={(count) => changeRoom(index, { adults: count })}
              />
              <GuestCounter
                label="Children"
                detail="Aged 0–17"
                count={room.childrenAges.length}
                min={0}
                max={2}
                roomNumber={index + 1}
                onChange={(count) =>
                  changeRoom(index, {
                    childrenAges:
                      count > room.childrenAges.length
                        ? [...room.childrenAges, 8]
                        : room.childrenAges.slice(0, count),
                  })
                }
              />
              {room.childrenAges.length ? (
                <div className={styles.childAges}>
                  {room.childrenAges.map((age, childIndex) => (
                    <label key={`${id}-${index}-${childIndex}`}>
                      Child {childIndex + 1} age
                      <select
                        aria-label={`Age of child ${childIndex + 1} in room ${index + 1}`}
                        value={age}
                        onChange={(event) =>
                          changeRoom(index, {
                            childrenAges: room.childrenAges.map((current, ageIndex) =>
                              ageIndex === childIndex ? Number(event.target.value) : current,
                            ),
                          })
                        }
                      >
                        {Array.from({ length: 18 }, (_, ageValue) => (
                          <option value={ageValue} key={ageValue}>
                            {ageValue === 0 ? 'Under 1' : ageValue}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              ) : null}
            </fieldset>
          ))}
        </div>
        <button
          type="button"
          className={styles.addRoom}
          disabled={rooms.length >= 4}
          onClick={() => onChange([...rooms, { adults: 2, childrenAges: [] }])}
        >
          <Plus size={17} aria-hidden="true" />
          Add another room
        </button>
        <PopoverClose asChild>
          <button type="button" className={styles.doneButton}>
            Done
          </button>
        </PopoverClose>
      </PopoverContent>
    </Popover>
  );
}
