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
import { useEffect, useRef, useState } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SessionNavigation } from '@/features/authentication/components/session-navigation';

import styles from './site-chrome.module.css';
import { SiteLogo } from './site-logo';
import { ThemeToggle } from './theme-toggle';

type OpenDropdown = 'inspiration' | 'destinations' | null;

export function SiteHeader() {
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
    <header ref={headerRef} className={styles.header}>
      <div className={styles.topbar}>
        <div className={styles.topbarInner}>
          <Link
            href="/"
            className={styles.brand}
            aria-label="Best Holiday Packages home"
            onClick={closeNavigation}
          >
            <SiteLogo preload />
          </Link>
          <div className={styles.benefits} aria-label="Why Best Holiday Packages">
            <span>
              <Sun size={17} aria-hidden="true" /> A stay for every getaway
            </span>
            <span>
              <Check size={17} aria-hidden="true" /> Clear pricing
            </span>
            <span>
              <CalendarCheck size={17} aria-hidden="true" /> Your trip, all in one place
            </span>
          </div>
          <div className={styles.accountActions}>
            <Link
              className={styles.savedLink}
              href="/#saved-destinations"
              aria-label="Saved inspiration"
              title="Saved inspiration"
              onClick={closeNavigation}
            >
              <Heart size={23} aria-hidden="true" />
            </Link>
            <Link className={styles.manageLink} href="/bookings" onClick={closeNavigation}>
              Manage booking
            </Link>
            <SessionNavigation />
            <ThemeToggle className="shrink-0 bg-transparent" />
            <button
              ref={mobileButtonRef}
              type="button"
              className={styles.mobileToggle}
              aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
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
        aria-label="Main navigation"
        className={`${styles.navigation} ${mobileOpen ? styles.navigationOpen : ''}`}
      >
        <div className={styles.navigationInner}>
          <div className={styles.primaryLinks}>
            <div className={styles.dropdown}>
              <DropdownMenu
                modal={false}
                open={openDropdown === 'inspiration'}
                onOpenChange={(open) => setOpenDropdown(open ? 'inspiration' : null)}
              >
                <DropdownMenuTrigger asChild>
                  <button type="button" className={styles.navTrigger}>
                    Holiday inspiration <ChevronDown size={15} aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={0}
                  className={styles.dropdownPanel}
                  data-site-navigation-menu=""
                >
                  <span className={styles.dropdownEyebrow}>Find your kind of getaway</span>
                  <DropdownMenuItem asChild>
                    <Link href="/#holiday-inspiration" onClick={closeNavigation}>
                      <Sparkles size={18} aria-hidden="true" /> Holiday ideas
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/#destinations" onClick={closeNavigation}>
                      <Sun size={18} aria-hidden="true" /> Places to fall in love with
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/#saved-destinations" onClick={closeNavigation}>
                      <Heart size={18} aria-hidden="true" /> Your saved inspiration
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className={styles.dropdown}>
              <DropdownMenu
                modal={false}
                open={openDropdown === 'destinations'}
                onOpenChange={(open) => setOpenDropdown(open ? 'destinations' : null)}
              >
                <DropdownMenuTrigger asChild>
                  <button type="button" className={styles.navTrigger}>
                    Destinations <ChevronDown size={15} aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  sideOffset={0}
                  className={styles.dropdownPanel}
                  data-site-navigation-menu=""
                >
                  <span className={styles.dropdownEyebrow}>Where will you go next?</span>
                  <DropdownMenuItem asChild>
                    <Link href="/#destinations" onClick={closeNavigation}>
                      Explore destinations
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/hotels" onClick={closeNavigation}>
                      Search hotels by destination
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Link className={styles.navLink} href="/hotels" onClick={closeNavigation}>
              Hotels
            </Link>
          </div>
          <div className={styles.secondaryLinks}>
            <Link className={styles.navLink} href="/#travel-help" onClick={closeNavigation}>
              <HelpCircle size={16} aria-hidden="true" /> Help &amp; FAQs
            </Link>
            <Link className={styles.mobileManageLink} href="/bookings" onClick={closeNavigation}>
              Manage booking
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
