'use client';

import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

import { useSiteMessages } from '@/providers/use-site-messages';

import styles from './site-chrome.module.css';
import { SiteLogo } from './site-logo';

export function SiteFooter() {
  const { locale, dir, messages } = useSiteMessages();
  return (
    <footer className={styles.footer} lang={locale} dir={dir}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrandColumn}>
          <Link href="/" className={styles.brand} aria-label={messages.header.home}>
            <SiteLogo />
          </Link>
          <p>{messages.footer.introduction}</p>
        </div>
        <nav className={styles.footerLinkColumn} aria-label={messages.footer.exploreLabel}>
          <h2>{messages.footer.escape}</h2>
          <Link href="/hotels">{messages.footer.searchHotels}</Link>
          <Link href="/#destinations">{messages.header.exploreDestinations}</Link>
          <Link href="/#holiday-inspiration">{messages.header.holidayInspiration}</Link>
          <Link href="/#saved-destinations">{messages.header.savedInspiration}</Link>
        </nav>
        <nav className={styles.footerLinkColumn} aria-label={messages.footer.tripLabel}>
          <h2>{messages.footer.trip}</h2>
          <Link href="/bookings">{messages.footer.manageBooking}</Link>
          <Link href="/account">{messages.footer.account}</Link>
          <Link href="/#travel-help">{messages.header.help}</Link>
          <Link href="/sign-in">
            {messages.header.signIn} <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </nav>
      </div>
      <div className={styles.footerBottom}>
        <span lang="en" dir="ltr">
          © {new Date().getFullYear()} Best Holiday Packages
        </span>
        <span>{messages.footer.tagline}</span>
      </div>
    </footer>
  );
}
