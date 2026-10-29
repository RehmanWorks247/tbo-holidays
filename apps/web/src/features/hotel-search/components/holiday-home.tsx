'use client';

import {
  ArrowRight,
  BedDouble,
  Building2,
  Check,
  ChevronDown,
  Compass,
  Heart,
  MapPin,
  Palmtree,
  Plane,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
} from 'lucide-react';
import Image from 'next/image';
import { useRef, useState } from 'react';

import { PreviewEntry } from '@/components/shared/preview-shell';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useHolidayInspiration } from '@/features/hotel-search/components/holiday-inspiration-provider';
import { HotelSearchForm } from '@/features/hotel-search/components/hotel-search-form';
import { PreviewSearchForm } from '@/features/hotel-search/components/preview-search-form';
import { usePageMessages } from '@/providers/use-page-messages';

import styles from './holiday-home.module.css';

const destinations = [
  { id: 'greece', image: 'hero-greece.jpg', category: 'beach' },
  { id: 'turkey', image: 'turkey.jpg', category: 'beach' },
  { id: 'italy', image: 'italy.jpg', category: 'beach' },
  { id: 'tropical', image: 'beach.jpg', category: 'faraway' },
  { id: 'madrid', image: 'city.jpg', category: 'city' },
  { id: 'dubai', image: 'dubai.jpg', category: 'city' },
] as const;

type Destination = (typeof destinations)[number];
type Category = 'all' | Destination['category'];
const categories: { id: Category; icon: typeof Compass }[] = [
  { id: 'all', icon: Compass },
  { id: 'beach', icon: Palmtree },
  { id: 'city', icon: Building2 },
  { id: 'faraway', icon: Sun },
];

export function HolidayHome() {
  const {
    messages: { home: copy },
    locale,
    dir,
    t,
  } = usePageMessages();
  const [category, setCategory] = useState<Category>('all');
  const [product, setProduct] = useState<'hotel' | 'hotel-flights'>('hotel');
  const { savedIds, toggleSaved } = useHolidayInspiration();
  const [selected, setSelected] = useState<Destination | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  const focusSearchAfterClose = useRef(false);
  const filtered = destinations.filter((item) => category === 'all' || item.category === category);
  const visible = showAll || category !== 'all' ? filtered : filtered.slice(0, 4);
  const saved = destinations.filter((item) => savedIds.includes(item.id));
  const selectedCopy = selected ? copy.places[selected.id] : null;

  function explore(destination: Destination, trigger: HTMLButtonElement) {
    lastTrigger.current = trigger;
    setSelected(destination);
  }
  return (
    <div className={styles.home} lang={locale} dir={dir}>
      <section id="hotel-search" className={styles.searchBand} aria-label={copy.search.label}>
        <div className={styles.searchTabs}>
          <button
            type="button"
            className={product === 'hotel' ? styles.activeTab : undefined}
            aria-pressed={product === 'hotel'}
            aria-controls="home-hotel-search"
            onClick={() => setProduct('hotel')}
          >
            <BedDouble size={19} aria-hidden="true" /> {copy.search.hotels}
          </button>
          <button
            type="button"
            className={product === 'hotel-flights' ? styles.activeTab : undefined}
            aria-pressed={product === 'hotel-flights'}
            aria-controls="home-hotel-search"
            onClick={() => setProduct('hotel-flights')}
            lang="en"
          >
            <Plane size={19} aria-hidden="true" /> hotel+flights demo
          </button>
          <a href="#holiday-inspiration">
            <Sparkles size={18} aria-hidden="true" /> {copy.search.inspire}{' '}
            <span>{copy.search.findHappy}</span>
          </a>
          <p>{copy.search.tagline}</p>
        </div>
        <div id="home-hotel-search">
          {product === 'hotel' ? <HotelSearchForm /> : <PreviewSearchForm product={product} />}
        </div>
        <PreviewEntry />
      </section>

      <section className={styles.heroGrid} aria-label={copy.hero.label}>
        <div className={styles.mainHero}>
          <div className={styles.heroCopy}>
            <span className={styles.heroEyebrow}>
              <Sun size={15} aria-hidden="true" /> {copy.hero.eyebrow}
            </span>
            <h1>{copy.hero.title}</h1>
            <p>{copy.hero.description}</p>
            <a href="#destinations" className={styles.heroButton}>
              {copy.hero.action}{' '}
              <ArrowRight size={18} className={styles.forwardIcon} aria-hidden="true" />
            </a>
            <span className={styles.heroFootnote}>{copy.hero.footnote}</span>
          </div>
          <div className={styles.heroImage}>
            <Image
              src="/images/hero-greece.jpg"
              alt={copy.hero.imageAlt}
              fill
              priority
              sizes="(max-width: 640px) 50vw, (max-width: 900px) 55vw, 430px"
            />
            <span className={styles.imageLocation}>
              <MapPin size={14} aria-hidden="true" /> {copy.hero.location}
            </span>
            <div className={styles.sunBadge}>
              <Sun size={24} strokeWidth={1.5} aria-hidden="true" />
              <span>
                {copy.hero.badgeTop}
                <br />
                <strong>{copy.hero.badgeBottom}</strong>
              </span>
            </div>
          </div>
        </div>
        <button
          className={styles.sideHero}
          onClick={(event) => explore(destinations[3], event.currentTarget)}
        >
          <Image
            src="/images/beach.jpg"
            alt={copy.hero.beachImageAlt}
            fill
            sizes="(max-width: 900px) 100vw, 380px"
          />
          <span className={styles.sideHeroShade} />
          <span className={styles.sideHeroContent}>
            <span className={styles.smallPill}>
              <Sun size={14} aria-hidden="true" /> {copy.hero.beachEyebrow}
            </span>
            <strong>{copy.hero.beachTitle}</strong>
            <span>{copy.hero.beachDescription}</span>
            <span className={styles.sideHeroLink}>
              {copy.hero.beachAction}{' '}
              <ArrowRight size={18} className={styles.forwardIcon} aria-hidden="true" />
            </span>
          </span>
        </button>
      </section>

      <section id="holiday-inspiration" className={styles.inspirationSection}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>{copy.inspiration.eyebrow}</p>
            <h2>{copy.inspiration.title}</h2>
          </div>
          <span className={styles.sectionAside}>{copy.inspiration.aside}</span>
        </div>
        <div className={styles.inspirationGrid}>
          {[
            {
              destination: destinations[1],
              image: 'turkey.jpg',
              alt: copy.inspiration.beachImageAlt,
              eyebrow: copy.inspiration.beachEyebrow,
              title: copy.inspiration.beachTitle,
              cta: copy.inspiration.beachAction,
            },
            {
              destination: destinations[4],
              image: 'city.jpg',
              alt: copy.inspiration.cityImageAlt,
              eyebrow: copy.inspiration.cityEyebrow,
              title: copy.inspiration.cityTitle,
              cta: copy.inspiration.cityAction,
            },
            {
              destination: destinations[3],
              image: 'pool.jpg',
              alt: copy.inspiration.farawayImageAlt,
              eyebrow: copy.inspiration.farawayEyebrow,
              title: copy.inspiration.farawayTitle,
              cta: copy.inspiration.farawayAction,
            },
          ].map((item) => (
            <button
              key={item.image}
              className={styles.inspirationCard}
              onClick={(event) => explore(item.destination, event.currentTarget)}
            >
              <Image
                src={`/images/${item.image}`}
                alt={item.alt}
                fill
                sizes="(max-width: 640px) 100vw, 400px"
              />
              <span className={styles.inspirationShade} />
              <span className={styles.inspirationContent}>
                <span>{item.eyebrow}</span>
                <strong>{item.title}</strong>
                <span className={styles.inspirationCta}>
                  {item.cta}
                  <ArrowRight size={17} className={styles.forwardIcon} aria-hidden="true" />
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.benefitStrip} aria-label={copy.benefits.label}>
        <div className={styles.benefitIntro}>
          <Heart size={24} aria-hidden="true" />
          <strong>{copy.benefits.title}</strong>
        </div>
        <div>
          <Compass size={25} aria-hidden="true" />
          <span>
            <strong>{copy.benefits.getawayTitle}</strong>
            <small>{copy.benefits.getawayDescription}</small>
          </span>
        </div>
        <div>
          <ShieldCheck size={25} aria-hidden="true" />
          <span>
            <strong>{copy.benefits.pricingTitle}</strong>
            <small>{copy.benefits.pricingDescription}</small>
          </span>
        </div>
        <div>
          <BedDouble size={25} aria-hidden="true" />
          <span>
            <strong>{copy.benefits.staysTitle}</strong>
            <small>{copy.benefits.staysDescription}</small>
          </span>
        </div>
      </section>

      <section id="destinations">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>{copy.destinations.eyebrow}</p>
            <h2>{copy.destinations.title}</h2>
            <p className={styles.sectionDescription}>{copy.destinations.description}</p>
          </div>
          <a
            href="#saved-destinations"
            className={styles.savedLink}
            onClick={() => setSavedOpen(true)}
          >
            <Heart size={17} aria-hidden="true" />
            <span>
              {saved.length
                ? t(copy.destinations.savedLinkCount, { count: saved.length })
                : copy.destinations.savedLink}
            </span>
          </a>
        </div>
        <div className={styles.filterTabs} aria-label={copy.destinations.categoriesLabel}>
          {categories.map(({ id, icon: Icon }) => (
            <button
              key={id}
              aria-pressed={category === id}
              className={category === id ? styles.selectedFilter : undefined}
              onClick={() => {
                setCategory(id);
                setShowAll(false);
              }}
            >
              <Icon size={16} aria-hidden="true" />
              {copy.categories[id]}
            </button>
          ))}
        </div>
        <div className={styles.destinationGrid}>
          {visible.map((destination) => (
            <article key={destination.id} className={styles.destinationCard}>
              <div className={styles.destinationImage}>
                <button
                  className={styles.imageButton}
                  onClick={(event) => explore(destination, event.currentTarget)}
                  aria-label={t(copy.destinations.explore, {
                    name: copy.places[destination.id].name,
                  })}
                >
                  <Image
                    src={`/images/${destination.image}`}
                    alt={copy.places[destination.id].imageAlt}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 900px) 45vw, 300px"
                  />
                </button>
                <button
                  className={`${styles.saveButton} ${savedIds.includes(destination.id) ? styles.isSaved : ''}`}
                  onClick={() => toggleSaved(destination.id)}
                  aria-pressed={savedIds.includes(destination.id)}
                  aria-label={t(
                    savedIds.includes(destination.id)
                      ? copy.destinations.unsave
                      : copy.destinations.save,
                    { name: copy.places[destination.id].name },
                  )}
                >
                  <Heart
                    size={20}
                    aria-hidden="true"
                    fill={savedIds.includes(destination.id) ? 'currentColor' : 'none'}
                  />
                </button>
                <span className={styles.destinationTag}>{copy.places[destination.id].tag}</span>
              </div>
              <button
                className={styles.destinationDetails}
                onClick={(event) => explore(destination, event.currentTarget)}
              >
                <span>
                  <span className={styles.destinationCountry}>
                    <MapPin size={12} aria-hidden="true" />
                    {copy.places[destination.id].country}
                  </span>
                  <strong>{copy.places[destination.id].name}</strong>
                  <span className={styles.exploreText}>{copy.destinations.exploreDestination}</span>
                </span>
                <span className={styles.circleArrow}>
                  <ArrowRight size={19} className={styles.forwardIcon} aria-hidden="true" />
                </span>
              </button>
            </article>
          ))}
        </div>
        {category === 'all' ? (
          <button className={styles.seeMore} onClick={() => setShowAll((value) => !value)}>
            {showAll ? copy.destinations.showFewer : copy.destinations.showMore}
            <ChevronDown
              className={showAll ? styles.rotated : undefined}
              size={18}
              aria-hidden="true"
            />
          </button>
        ) : null}
        <p className={styles.editorialNote}>{copy.destinations.note}</p>
      </section>

      <section id="saved-destinations" className={styles.savedSection}>
        <button
          className={styles.savedHeading}
          aria-expanded={savedOpen}
          aria-controls="saved-inspiration-content"
          onClick={() => setSavedOpen((open) => !open)}
        >
          <span>
            <Heart size={20} aria-hidden="true" />
            <strong>{copy.saved.title}</strong>
            <span className={styles.savedCount}>
              {t(copy.saved.count, { count: saved.length })}
            </span>
          </span>
          <ChevronDown
            size={20}
            className={savedOpen ? styles.rotated : undefined}
            aria-hidden="true"
          />
        </button>
        <div id="saved-inspiration-content" hidden={!savedOpen}>
          {saved.length ? (
            <div className={styles.savedGrid}>
              {saved.map((destination) => (
                <div className={styles.savedItem} key={destination.id}>
                  <button onClick={(event) => explore(destination, event.currentTarget)}>
                    <Image src={`/images/${destination.image}`} alt="" width={70} height={56} />
                    <span>
                      {copy.places[destination.id].name}
                      <small>{copy.places[destination.id].country}</small>
                    </span>
                  </button>
                  <button
                    onClick={() => toggleSaved(destination.id)}
                    aria-label={t(copy.saved.remove, { name: copy.places[destination.id].name })}
                  >
                    <Heart size={18} fill="currentColor" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.savedEmpty}>{copy.saved.empty}</p>
          )}
        </div>
        <span className="sr-only" role="status">
          {t(copy.saved.announcement, { count: saved.length })}
        </span>
      </section>

      <section className={styles.escapeBanner}>
        <div className={styles.escapeIllustration} aria-hidden="true">
          <Sun size={54} strokeWidth={1.2} />
          <Palmtree size={94} strokeWidth={1.15} />
        </div>
        <div>
          <p className={styles.eyebrow}>{copy.escape.eyebrow}</p>
          <h2>{copy.escape.title}</h2>
          <p>{copy.escape.description}</p>
        </div>
        <a href="#hotel-search" className={styles.primaryLink}>
          {copy.escape.action} <Search size={18} aria-hidden="true" />
        </a>
      </section>

      <section id="travel-help" className={styles.helpSection}>
        <div>
          <p className={styles.eyebrow}>{copy.help.eyebrow}</p>
          <h2>{copy.help.title}</h2>
          <p>{copy.help.description}</p>
          <a href="#hotel-search">
            {copy.help.action}{' '}
            <ArrowRight size={16} className={styles.forwardIcon} aria-hidden="true" />
          </a>
        </div>
        <div className={styles.faqList}>
          <details>
            <summary>
              {copy.help.searchQuestion}
              <ChevronDown size={18} aria-hidden="true" />
            </summary>
            <p lang="en" dir="ltr">
              Choose a destination or hotel from the suggestions, select your check-in date and
              number of nights, and add the adults and children in each room. Select Search to
              explore the hotel booking demo with your chosen filters.
            </p>
          </details>
          <details>
            <summary>
              {copy.help.priceQuestion}
              <ChevronDown size={18} aria-hidden="true" />
            </summary>
            <p>{copy.help.priceAnswer}</p>
          </details>
          <details>
            <summary>
              {copy.help.roomsQuestion}
              <ChevronDown size={18} aria-hidden="true" />
            </summary>
            <p>{copy.help.roomsAnswer}</p>
          </details>
          <details>
            <summary>
              {copy.help.bookingQuestion}
              <ChevronDown size={18} aria-hidden="true" />
            </summary>
            <p>
              {copy.help.bookingAnswer} <a href="/bookings">{copy.help.myBookings}</a>
            </p>
          </details>
        </div>
      </section>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent
          className={styles.destinationDialog}
          lang={locale}
          dir={dir}
          closeLabel={copy.dialog.close}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (focusSearchAfterClose.current) {
              document
                .querySelector<HTMLInputElement>('#hotel-search input[name="destination"]')
                ?.focus({ preventScroll: true });
              focusSearchAfterClose.current = false;
            } else {
              lastTrigger.current?.focus({ preventScroll: true });
            }
          }}
        >
          {selected && selectedCopy ? (
            <>
              <div className={styles.dialogImage}>
                <Image
                  src={`/images/${selected.image}`}
                  alt={selectedCopy.imageAlt}
                  fill
                  sizes="(max-width: 640px) 100vw, 600px"
                />
                <span className={styles.dialogEyebrow}>{copy.dialog.eyebrow}</span>
              </div>
              <div className={styles.dialogContent}>
                <p className={styles.eyebrow}>{selectedCopy.country}</p>
                <DialogTitle className={styles.dialogTitle}>
                  {t(copy.dialog.title, { name: selectedCopy.name })}
                </DialogTitle>
                <DialogDescription className={styles.dialogDescription}>
                  {selectedCopy.description}
                </DialogDescription>
                <ul className={styles.highlights}>
                  {(['highlightOne', 'highlightTwo', 'highlightThree'] as const).map((key) => (
                    <li key={key}>
                      <Check size={16} aria-hidden="true" />
                      {selectedCopy[key]}
                    </li>
                  ))}
                </ul>
                <a
                  href="#hotel-search"
                  className={styles.primaryLink}
                  onClick={() => {
                    focusSearchAfterClose.current = true;
                    setSelected(null);
                  }}
                >
                  {copy.dialog.action}{' '}
                  <ArrowRight size={18} className={styles.forwardIcon} aria-hidden="true" />
                </a>
                <p className={styles.dialogNote}>{copy.dialog.note}</p>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <a href="#hotel-search" className={styles.mobileSearch}>
        <Search size={18} aria-hidden="true" /> {copy.search.mobileLink}{' '}
        <ArrowRight size={18} className={styles.forwardIcon} aria-hidden="true" />
      </a>
    </div>
  );
}
