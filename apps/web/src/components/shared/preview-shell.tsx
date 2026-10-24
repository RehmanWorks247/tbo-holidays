import { ArrowLeft, BedDouble, FlaskConical } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import styles from './preview-shell.module.css';

export function PreviewShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell} data-ui-preview lang="en" dir="ltr">
      <div className={styles.top}>
        <nav className={styles.tabs} aria-label="Hotel preview navigation">
          <Link href="/preview/hotels">
            <BedDouble size={19} aria-hidden="true" /> Hotels
          </Link>
          <Link href="/" className={styles.home}>
            <ArrowLeft size={15} aria-hidden="true" /> Back to home
          </Link>
        </nav>
        <p className={styles.notice}>
          <FlaskConical size={15} aria-hidden="true" />
          <span>
            <strong>UI preview</strong> · Sample GBP prices, reviews and photos. No bookings or
            payments.
          </span>
        </p>
      </div>
      {children}
    </div>
  );
}

export function PreviewEntry() {
  return (
    <Link href="/preview/hotels" className={styles.entry} lang="en">
      <FlaskConical size={17} aria-hidden="true" />
      <span>
        Explore the hotel booking demo <small>Search, choose your room and preview checkout</small>
      </span>
      <span aria-hidden="true">→</span>
    </Link>
  );
}
