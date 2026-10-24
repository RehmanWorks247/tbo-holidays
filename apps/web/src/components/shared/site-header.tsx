'use client';

import {
  CalendarCheck,
  Check,
  ChevronDown,
  Heart,
  HelpCircle,
  Menu,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SessionNavigation } from '@/features/authentication/components/session-navigation';
import { useSiteMessages } from '@/providers/use-site-messages';

import { RegionalSelectors } from './regional-selectors';
import styles from './site-chrome.module.css';
import { SiteLogo } from './site-logo';
import { ThemeToggle } from './theme-toggle';

type OpenDropdown = 'inspiration' | 'destinations' | null;

export function SiteHeader() {
  const pathname = usePathname();
  const isHotelResults = pathname === '/hotels' || pathname.startsWith('/preview/');
  const { locale, dir, messages } = useSiteMessages();
  const copy = messages.header;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<OpenDropdown>(null);
  const headerRef = useRef<HTMLElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);

  function closeNavigation() {
    setMobileOpen(false);
    setOpenDropdown(null);
  }

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Element &&
        !headerRef.current?.contains(event.target) &&
        !event.target.closest('[data-site-navigation-menu]')
      ) {
        setMobileOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented || openDropdown) return;
      if (mobileOpen) {
        setMobileOpen(false);
        mobileButtonRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileOpen, openDropdown]);

  return (
    <header
      ref={headerRef}
      className={`${styles.header} ${isHotelResults ? styles.hotelHeader : ''}`}
      lang={locale}
      dir={dir}
    >
      <div className={styles.topbar}>
        <div className={styles.topbarInner}>
          <Link href="/" className={styles.brand} aria-label={copy.home} onClick={closeNavigation}>
            <SiteLogo preload />
          </Link>
          <div className={styles.benefits} aria-label={copy.benefitsLabel}>
            <span>
              <Sun size={17} aria-hidden="true" /> {copy.benefitStay}
            </span>
            <span>
              <Check size={17} aria-hidden="true" /> {copy.benefitPricing}
            </span>
            <span>
              <CalendarCheck size={17} aria-hidden="true" /> {copy.benefitTrip}
            </span>
          </div>
          <div className={styles.regionalActions}>
            <RegionalSelectors />
          </div>
          <div className={styles.accountActions}>
            <Link
              className={styles.savedLink}
              href="/#saved-destinations"
              aria-label={copy.savedInspiration}
              title={copy.savedInspiration}
              onClick={closeNavigation}
            >
              <Heart size={23} aria-hidden="true" />
            </Link>
            <Link className={styles.manageLink} href="/bookings" onClick={closeNavigation}>
              {copy.manageBooking}
            </Link>
            <SessionNavigation />
            <ThemeToggle className="shrink-0 bg-transparent" />
            <button
              ref={mobileButtonRef}
              type="button"
              className={styles.mobileToggle}
              aria-label={mobileOpen ? copy.closeNavigation : copy.openNavigation}
              aria-expanded={mobileOpen}
              aria-controls="site-navigation"
              onClick={() => {
                setMobileOpen(!mobileOpen);
                setOpenDropdown(null);
              }}
            >
              {mobileOpen ? <X size={23} /> : <Menu size={23} />}
            </button>
          </div>
        </div>
      </div>
      <nav
        id="site-navigation"
        aria-label={copy.mainNavigation}
        className={`${styles.navigation} ${mobileOpen ? styles.navigationOpen : ''}`}
      >
        <div className={styles.navigationInner}>
          <div className={styles.primaryLinks}>
            <div className={styles.dropdown}>
              <DropdownMenu
                dir={dir}
                modal={false}
                open={openDropdown === 'inspiration'}
                onOpenChange={(open) => setOpenDropdown(open ? 'inspiration' : null)}
              >
                <DropdownMenuTrigger asChild>
                  <button type="button" className={styles.navTrigger}>
                    {copy.holidayInspiration} <ChevronDown size={15} aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={0}
                  className={styles.dropdownPanel}
                  lang={locale}
                  data-site-navigation-menu=""
                >
                  <span className={styles.dropdownEyebrow}>{copy.getawayEyebrow}</span>
                  <DropdownMenuItem asChild>
                    <Link href="/#holiday-inspiration" onClick={closeNavigation}>
                      <Sparkles size={18} aria-hidden="true" /> {copy.holidayIdeas}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/#destinations" onClick={closeNavigation}>
                      <Sun size={18} aria-hidden="true" /> {copy.placesToLove}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/#saved-destinations" onClick={closeNavigation}>
                      <Heart size={18} aria-hidden="true" /> {copy.yourSavedInspiration}
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className={styles.dropdown}>
              <DropdownMenu
                dir={dir}
                modal={false}
                open={openDropdown === 'destinations'}
                onOpenChange={(open) => setOpenDropdown(open ? 'destinations' : null)}
              >
                <DropdownMenuTrigger asChild>
                  <button type="button" className={styles.navTrigger}>
                    {copy.destinations} <ChevronDown size={15} aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={0}
                  className={styles.dropdownPanel}
                  lang={locale}
                  data-site-navigation-menu=""
                >
                  <span className={styles.dropdownEyebrow}>{copy.destinationsEyebrow}</span>
                  <DropdownMenuItem asChild>
                    <Link href="/#destinations" onClick={closeNavigation}>
                      {copy.exploreDestinations}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/hotels" onClick={closeNavigation}>
                      {copy.searchByDestination}
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Link className={styles.navLink} href="/hotels" onClick={closeNavigation}>
              {copy.hotels}
            </Link>
          </div>
          <div className={styles.secondaryLinks}>
            <Link className={styles.navLink} href="/#travel-help" onClick={closeNavigation}>
              <HelpCircle size={16} aria-hidden="true" /> {copy.help}
            </Link>
            <Link className={styles.mobileManageLink} href="/bookings" onClick={closeNavigation}>
              {copy.manageBooking}
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
