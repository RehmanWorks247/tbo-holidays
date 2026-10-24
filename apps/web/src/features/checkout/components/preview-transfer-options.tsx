'use client';

import { Accessibility, BusFront, CarFront, Check, Zap } from 'lucide-react';

import { previewMoney } from '@/features/hotel-search/data/preview-hotels';

import styles from './preview-checkout.module.css';

export const previewTransfers = [
  {
    id: 'shuttle',
    name: 'Shuttle',
    priceMinor: 2600,
    icon: BusFront,
    features: ['Shared coach or minibus', 'Pick-up within an hour of landing'],
  },
  {
    id: 'express',
    name: 'Express shuttle',
    priceMinor: 3500,
    icon: Zap,
    features: ['Shared coach or minibus', 'Set pick-up time and fewer stops'],
  },
  {
    id: 'private',
    name: 'Standard Private',
    priceMinor: 13500,
    icon: CarFront,
    features: ['Standard car for your group only', 'No extra stops or wait for pick-up'],
  },
  {
    id: 'accessible',
    name: 'Wheelchair accessible',
    priceMinor: 19300,
    icon: Accessibility,
    features: [
      'Wheelchair accessible minibus',
      'Tail lift or ramp for easy boarding',
      'No extra stops',
    ],
  },
] as const;

export type PreviewTransferId = (typeof previewTransfers)[number]['id'];

export function PreviewTransferOptions({
  selected,
  pickup,
  onSelect,
  onPickupChange,
}: {
  selected: PreviewTransferId | null;
  pickup: string;
  onSelect: (value: PreviewTransferId | null) => void;
  onPickupChange: (value: string) => void;
}) {
  return (
    <section aria-labelledby="transfer-heading">
      <h1 id="transfer-heading" className={styles.heading}>
        Add transfer
      </h1>
      <p className={styles.introduction}>
        Book a return transfer between your pick-up point and hotel.
      </p>
      <label className={styles.pickupLabel} htmlFor="preview-pickup">
        Select pick-up point
      </label>
      <select
        id="preview-pickup"
        className={styles.select}
        value={pickup}
        onChange={(event) => onPickupChange(event.target.value)}
      >
        <option value="airport">Destination airport</option>
        <option value="station">Central train station</option>
        <option value="port">Cruise port</option>
      </select>
      <fieldset className={styles.transferGroup}>
        <legend className={styles.srOnly}>Choose a return transfer</legend>
        <label className={styles.noTransfer}>
          <span>Continue without transfer</span>
          <input
            type="radio"
            name="preview-transfer"
            checked={selected === null}
            onChange={() => onSelect(null)}
          />
        </label>
        {previewTransfers.map((transfer) => {
          const Icon = transfer.icon;
          return (
            <label
              key={transfer.id}
              className={`${styles.transferCard} ${selected === transfer.id ? styles.transferSelected : ''}`}
            >
              <div className={styles.transferName}>
                {transfer.id === 'private' ? <span className={styles.fastest}>Fastest</span> : null}
                <Icon size={29} strokeWidth={1.45} aria-hidden="true" />
                <strong>{transfer.name}</strong>
              </div>
              <ul className={styles.transferFeatures}>
                {transfer.features.map((feature) => (
                  <li key={feature}>
                    <Check size={13} aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              <div className={styles.transferChoice}>
                <strong>{previewMoney(transfer.priceMinor)}</strong>
                <input
                  type="radio"
                  name="preview-transfer"
                  value={transfer.id}
                  checked={selected === transfer.id}
                  onChange={() => onSelect(transfer.id)}
                  aria-label={`${transfer.name}, ${previewMoney(transfer.priceMinor)} return`}
                />
              </div>
            </label>
          );
        })}
      </fieldset>
      <p className={styles.smallPrint}>Return journey · Illustrative transfer options and prices</p>
    </section>
  );
}
