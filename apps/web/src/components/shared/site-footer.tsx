import { ArrowUpRight, Heart, Sun } from 'lucide-react';
import Link from 'next/link';

import styles from './site-chrome.module.css';

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrandColumn}>
          <Link href="/" className={styles.brand} aria-label="Stayline home">
            <span className={styles.brandIcon} aria-hidden="true">
              <Sun size={42} strokeWidth={1.8} />
              <Heart size={20} strokeWidth={2.4} />
            </span>
            <span>stayline</span>
          </Link>
          <p>A little inspiration. A place you&apos;ll love. Your next stay starts here.</p>
        </div>
        <nav className={styles.footerLinkColumn} aria-label="Explore Stayline">
          <h2>Find your next escape</h2>
          <Link href="/hotels">Search hotels</Link>
          <Link href="/#destinations">Explore destinations</Link>
          <Link href="/#holiday-inspiration">Holiday inspiration</Link>
          <Link href="/#saved-destinations">Saved inspiration</Link>
        </nav>
        <nav className={styles.footerLinkColumn} aria-label="Your Stayline trip">
          <h2>Your trip</h2>
          <Link href="/bookings">Manage your booking</Link>
          <Link href="/account">Your account</Link>
          <Link href="/#travel-help">Help &amp; FAQs</Link>
          <Link href="/sign-in">
            Sign in <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </nav>
      </div>
      <div className={styles.footerBottom}>
        <span>© {new Date().getFullYear()} Stayline</span>
        <span>Your next stay, considered.</span>
      </div>
    </footer>
  );
}
