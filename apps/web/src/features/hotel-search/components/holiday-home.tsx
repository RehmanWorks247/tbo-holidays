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
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
} from 'lucide-react';
import Image from 'next/image';
import { useRef, useState } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useHolidayInspiration } from '@/features/hotel-search/components/holiday-inspiration-provider';
import { HotelSearchForm } from '@/features/hotel-search/components/hotel-search-form';

import styles from './holiday-home.module.css';

const destinations = [
  {
    id: 'greece',
    name: 'Greek Islands',
    country: 'Greece',
    image: 'hero-greece.jpg',
    tag: 'Blue skies, bluer seas',
    category: 'Beach escapes',
    description:
      'Whitewashed villages, little waterfront tavernas and a new shade of blue around every corner. Slow down and find your own slice of island life.',
    highlights: ['Sunset strolls', 'Hidden coves', 'Island hopping'],
  },
  {
    id: 'turkey',
    name: 'Turkish Riviera',
    country: 'Turkey',
    image: 'turkey.jpg',
    tag: 'A little bit of everything',
    category: 'Beach escapes',
    description:
      'Spend your days between pine-fringed bays and character-filled old towns. Make room for lazy beach mornings and a little adventure.',
    highlights: ['Turquoise coastline', 'Local bazaars', 'Beach days'],
  },
  {
    id: 'italy',
    name: 'Amalfi Coast',
    country: 'Italy',
    image: 'italy.jpg',
    tag: 'Take the scenic route',
    category: 'Beach escapes',
    description:
      'Colourful cliffside towns, lemon groves and long lunches overlooking the sea. Take the coastal road and let the next beautiful view set the pace.',
    highlights: ['Coastal villages', 'Italian flavours', 'Boat trips'],
  },
  {
    id: 'tropical',
    name: 'Tropical escapes',
    country: 'Somewhere far away',
    image: 'beach.jpg',
    tag: 'Your out-of-office escape',
    category: 'Faraway favourites',
    description:
      'Trade the everyday for warm waters and wonderfully unhurried days. Think barefoot walks, a book by the beach and uninterrupted ocean views. From the Caribbean to the Indian Ocean, find your own happy place.',
    highlights: ['Palm-lined beaches', 'Island hideaways', 'Ocean sunsets'],
  },
  {
    id: 'madrid',
    name: 'Madrid',
    country: 'Spain',
    image: 'city.jpg',
    tag: 'Get lost in a good way',
    category: 'City breaks',
    description:
      'Follow lively streets past grand architecture, stop for something delicious and watch the city come to life as the sun sets. Make time for a gallery, a long lunch and a stroll in the park.',
    highlights: ['Lively streets', 'Café culture', 'Rooftop views'],
  },
  {
    id: 'dubai',
    name: 'Dubai',
    country: 'United Arab Emirates',
    image: 'dubai.jpg',
    tag: 'Sunshine meets skyline',
    category: 'City breaks',
    description:
      'Pair big-city exploring with time by the beach. Discover waterfront walks, neighbourhood cafés and spectacular views that carry on after sunset.',
    highlights: ['City skylines', 'Beach afternoons', 'Desert adventures'],
  },
] as const;

type Destination = (typeof destinations)[number];
type Category = 'All destinations' | Destination['category'];
const categories: { name: Category; icon: typeof Compass }[] = [
  { name: 'All destinations', icon: Compass },
  { name: 'Beach escapes', icon: Palmtree },
  { name: 'City breaks', icon: Building2 },
  { name: 'Faraway favourites', icon: Sun },
];

export function HolidayHome() {
  const [category, setCategory] = useState<Category>('All destinations');
  const { savedIds, toggleSaved } = useHolidayInspiration();
  const [selected, setSelected] = useState<Destination | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  const focusSearchAfterClose = useRef(false);
  const filtered = destinations.filter(
    (item) => category === 'All destinations' || item.category === category,
  );
  const visible = showAll || category !== 'All destinations' ? filtered : filtered.slice(0, 4);
  const saved = destinations.filter((item) => savedIds.includes(item.id));

  function explore(destination: Destination, trigger: HTMLButtonElement) {
    lastTrigger.current = trigger;
    setSelected(destination);
  }
  return (
    <div className={styles.home}>
      <section id="hotel-search" className={styles.searchBand} aria-label="Find your hotel">
        <div className={styles.searchTabs}>
          <span className={styles.activeTab}>
            <BedDouble size={19} /> Hotels
          </span>
          <a href="#holiday-inspiration">
            <Sparkles size={18} /> Inspire me <span>Find your happy</span>
          </a>
          <p>Your next getaway starts here.</p>
        </div>
        <HotelSearchForm />
      </section>

      <section className={styles.heroGrid} aria-label="Your next holiday">
        <div className={styles.mainHero}>
          <div className={styles.heroCopy}>
            <span className={styles.heroEyebrow}>
              <Sun size={15} /> LESS EVERYDAY. MORE GETAWAY.
            </span>
            <h1>
              Your next
              <br />
              happy place.
            </h1>
            <p>
              Big adventures. Little escapes.
              <br />
              Find a stay you’ll love.
            </p>
            <a href="#destinations" className={styles.heroButton}>
              Find my escape <ArrowRight size={18} />
            </a>
            <span className={styles.heroFootnote}>Good times are just around the corner.</span>
          </div>
          <div className={styles.heroImage}>
            <Image
              src="/images/hero-greece.jpg"
              alt="Whitewashed Santorini houses overlooking the sea at sunset"
              fill
              priority
              sizes="(max-width: 640px) 50vw, (max-width: 900px) 55vw, 430px"
            />
            <span className={styles.imageLocation}>
              <MapPin size={14} /> Santorini, Greece
            </span>
            <div className={styles.sunBadge}>
              <Sun size={24} strokeWidth={1.5} />
              <span>
                Good vibes.
                <br />
                <strong>Great stays.</strong>
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
            alt="Palm trees beside a tropical beach at sunset"
            fill
            sizes="(max-width: 900px) 100vw, 380px"
          />
          <span className={styles.sideHeroShade} />
          <span className={styles.sideHeroContent}>
            <span className={styles.smallPill}>
              <Sun size={14} /> A DOSE OF VITAMIN SEA
            </span>
            <strong>
              Somewhere
              <br />
              sunny is calling.
            </strong>
            <span>Answer with a beach escape.</span>
            <span className={styles.sideHeroLink}>
              Take me there <ArrowRight size={18} />
            </span>
          </span>
        </button>
      </section>

      <section id="holiday-inspiration" className={styles.inspirationSection}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>A CHANGE OF SCENERY</p>
            <h2>Whatever your holiday looks like</h2>
          </div>
          <span className={styles.sectionAside}>We’ve got a little inspiration for that.</span>
        </div>
        <div className={styles.inspirationGrid}>
          {[
            {
              destination: destinations[1],
              image: 'turkey.jpg',
              alt: 'Turquoise waters of the Turkish Mediterranean coast',
              eyebrow: 'SUNSHINE ON YOUR MIND?',
              title: (
                <>
                  Life’s better
                  <br />
                  by the beach.
                </>
              ),
              cta: 'Explore beach escapes',
            },
            {
              destination: destinations[4],
              image: 'city.jpg',
              alt: 'Madrid’s grand architecture at sunset',
              eyebrow: 'NEW STREETS. NEW STORIES.',
              title: (
                <>
                  A little city.
                  <br />A lot to discover.
                </>
              ),
              cta: 'Find your city break',
            },
            {
              destination: destinations[3],
              image: 'pool.jpg',
              alt: 'A peaceful resort pool at dusk',
              eyebrow: 'MAKE TIME FOR YOU',
              title: (
                <>
                  Do less.
                  <br />
                  Enjoy a little more.
                </>
              ),
              cta: 'Discover faraway favourites',
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
                  <ArrowRight size={17} />
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.benefitStrip} aria-label="Why Stayline">
        <div className={styles.benefitIntro}>
          <Heart size={24} />
          <strong>A little more to love</strong>
        </div>
        <div>
          <Compass size={25} />
          <span>
            <strong>Find your kind of getaway</strong>
            <small>From beach days to city stays</small>
          </span>
        </div>
        <div>
          <ShieldCheck size={25} />
          <span>
            <strong>Know before you go</strong>
            <small>Review your price before booking</small>
          </span>
        </div>
        <div>
          <BedDouble size={25} />
          <span>
            <strong>All your stays, together</strong>
            <small>Keep your trips in one place</small>
          </span>
        </div>
      </section>

      <section id="destinations">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>YOUR NEXT “WISH YOU WERE HERE”</p>
            <h2>A world of happy places</h2>
            <p className={styles.sectionDescription}>
              Some places just have that holiday feeling. Find yours.
            </p>
          </div>
          <a
            href="#saved-destinations"
            className={styles.savedLink}
            onClick={() => setSavedOpen(true)}
          >
            <Heart size={17} />
            <span>Saved inspiration {saved.length ? `(${saved.length})` : ''}</span>
          </a>
        </div>
        <div className={styles.filterTabs} aria-label="Destination categories">
          {categories.map(({ name, icon: Icon }) => (
            <button
              key={name}
              aria-pressed={category === name}
              className={category === name ? styles.selectedFilter : undefined}
              onClick={() => {
                setCategory(name);
                setShowAll(false);
              }}
            >
              <Icon size={16} />
              {name}
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
                  aria-label={`Explore ${destination.name}`}
                >
                  <Image
                    src={`/images/${destination.image}`}
                    alt={`${destination.name} scenery`}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 900px) 45vw, 300px"
                  />
                </button>
                <button
                  className={`${styles.saveButton} ${savedIds.includes(destination.id) ? styles.isSaved : ''}`}
                  onClick={() => toggleSaved(destination.id)}
                  aria-pressed={savedIds.includes(destination.id)}
                  aria-label={`${savedIds.includes(destination.id) ? 'Unsave' : 'Save'} ${destination.name}`}
                >
                  <Heart
                    size={20}
                    fill={savedIds.includes(destination.id) ? 'currentColor' : 'none'}
                  />
                </button>
                <span className={styles.destinationTag}>{destination.tag}</span>
              </div>
              <button
                className={styles.destinationDetails}
                onClick={(event) => explore(destination, event.currentTarget)}
              >
                <span>
                  <span className={styles.destinationCountry}>
                    <MapPin size={12} />
                    {destination.country}
                  </span>
                  <strong>{destination.name}</strong>
                  <span className={styles.exploreText}>Explore destination</span>
                </span>
                <span className={styles.circleArrow}>
                  <ArrowRight size={19} />
                </span>
              </button>
            </article>
          ))}
        </div>
        {category === 'All destinations' ? (
          <button className={styles.seeMore} onClick={() => setShowAll((value) => !value)}>
            {showAll ? 'Show fewer destinations' : 'More places to fall in love with'}
            <ChevronDown className={showAll ? styles.rotated : undefined} size={18} />
          </button>
        ) : null}
        <p className={styles.editorialNote}>
          A little inspiration for your next trip. Search your dates for available hotels.
        </p>
      </section>

      <section id="saved-destinations" className={styles.savedSection}>
        <button
          className={styles.savedHeading}
          aria-expanded={savedOpen}
          aria-controls="saved-inspiration-content"
          onClick={() => setSavedOpen((open) => !open)}
        >
          <span>
            <Heart size={20} />
            <strong>Your holiday daydreams</strong>
            <span className={styles.savedCount}>{saved.length} saved</span>
          </span>
          <ChevronDown size={20} className={savedOpen ? styles.rotated : undefined} />
        </button>
        <div id="saved-inspiration-content" hidden={!savedOpen}>
          {saved.length ? (
            <div className={styles.savedGrid}>
              {saved.map((destination) => (
                <div className={styles.savedItem} key={destination.id}>
                  <button onClick={(event) => explore(destination, event.currentTarget)}>
                    <Image src={`/images/${destination.image}`} alt="" width={70} height={56} />
                    <span>
                      {destination.name}
                      <small>{destination.country}</small>
                    </span>
                  </button>
                  <button
                    onClick={() => toggleSaved(destination.id)}
                    aria-label={`Remove ${destination.name} from saved inspiration`}
                  >
                    <Heart size={18} fill="currentColor" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.savedEmpty}>
              Found somewhere you love? Tap the heart on a destination to keep your inspiration
              together during this visit.
            </p>
          )}
        </div>
        <span className="sr-only" role="status">
          {saved.length} {saved.length === 1 ? 'destination' : 'destinations'} saved for this visit.
        </span>
      </section>

      <section className={styles.escapeBanner}>
        <div className={styles.escapeIllustration} aria-hidden="true">
          <Sun size={54} strokeWidth={1.2} />
          <Palmtree size={94} strokeWidth={1.15} />
        </div>
        <div>
          <p className={styles.eyebrow}>OUT OF OFFICE. INTO YOUR ELEMENT.</p>
          <h2>Good things start with a getaway.</h2>
          <p>A change of pace, a new favourite place. Where will you go next?</p>
        </div>
        <a href="#hotel-search" className={styles.primaryLink}>
          Let’s find your stay <Search size={18} />
        </a>
      </section>

      <section id="travel-help" className={styles.helpSection}>
        <div>
          <p className={styles.eyebrow}>A LITTLE HELP ALONG THE WAY</p>
          <h2>All set for your next stay?</h2>
          <p>The answers to a few things you might be wondering.</p>
          <a href="#hotel-search">
            Start exploring <ArrowRight size={16} />
          </a>
        </div>
        <div className={styles.faqList}>
          <details>
            <summary>
              How do I find a hotel?
              <ChevronDown size={18} />
            </summary>
            <p>
              Enter a destination code, choose your check-in and check-out dates, and add your
              guests. Set the lead guest’s nationality and your preferred currency in the guest
              panel, then select Search.
            </p>
          </details>
          <details>
            <summary>
              When is my price confirmed?
              <ChevronDown size={18} />
            </summary>
            <p>
              Your room price and availability are checked again before booking. You can review the
              current total and the room’s cancellation conditions before proceeding.
            </p>
          </details>
          <details>
            <summary>
              Can I travel with children or book multiple rooms?
              <ChevronDown size={18} />
            </summary>
            <p>
              You can search for up to four rooms. Add the adults and children in each room,
              including children’s ages, so your search reflects everyone travelling.
            </p>
          </details>
          <details>
            <summary>
              Where can I find my booking?
              <ChevronDown size={18} />
            </summary>
            <p>
              Sign in and open <a href="/bookings">My bookings</a> to view your stay and its current
              status. Your hotel is confirmed when the booking status shows confirmation.
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
          {selected ? (
            <>
              <div className={styles.dialogImage}>
                <Image
                  src={`/images/${selected.image}`}
                  alt={`${selected.name} scenery`}
                  fill
                  sizes="(max-width: 640px) 100vw, 600px"
                />
                <span className={styles.dialogEyebrow}>A little travel inspiration</span>
              </div>
              <div className={styles.dialogContent}>
                <p className={styles.eyebrow}>{selected.country}</p>
                <DialogTitle className={styles.dialogTitle}>Hello, {selected.name}.</DialogTitle>
                <DialogDescription className={styles.dialogDescription}>
                  {selected.description}
                </DialogDescription>
                <ul className={styles.highlights}>
                  {selected.highlights.map((item) => (
                    <li key={item}>
                      <Check size={16} />
                      {item}
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
                  Plan your next stay <ArrowRight size={18} />
                </a>
                <p className={styles.dialogNote}>
                  Choose your destination and dates to check hotel availability.
                </p>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <a href="#hotel-search" className={styles.mobileSearch}>
        <Search size={18} /> Find your next stay <ArrowRight size={18} />
      </a>
    </div>
  );
}
