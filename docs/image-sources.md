# Brand logo and homepage photography

## Company logo

The Best Holiday Packages logo was supplied by the user and downloaded unchanged
on 10 October 2026 from [the supplied company image](https://bestholidaypackages.co.uk/wp-content/uploads/2026/01/Umrah-Deal-9-e1767715832942.png).
The original transparent 1044 × 653 PNG is stored at
`apps/web/public/images/best-holiday-packages-logo.png`.

The shared `SiteLogo` component displays this asset in the header and footer on
every page, with responsive sizing that preserves its original aspect ratio.
Both light and dark themes use the same unmodified artwork without a backing
box, border, cropping, or recoloring. Next.js serves optimized sizes from the
local asset, so the site does not depend on the external image host at runtime.

## Homepage photography

The homepage uses locally served, optimized JPEGs from Unsplash. These are
destination inspiration images, not supplier inventory or depictions of a
bookable hotel. Image use is governed by the [Unsplash license](https://unsplash.com/license).

| Local file                               | Subject                                                        | Source                                                                                                                           |
| ---------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/public/images/hero-greece.jpg` | Santorini white buildings and windmills beside the sea at dusk | [Unsplash image](https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff)                                                   |
| `apps/web/public/images/beach.jpg`       | Tropical beach at sunset                                       | [Unsplash image](https://images.unsplash.com/photo-1507525428034-b723cf961d3e)                                                   |
| `apps/web/public/images/city.jpg`        | Madrid skyline and Gran Via at sunset                          | [Unsplash image](https://images.unsplash.com/photo-1539037116277-4db20889f2d4)                                                   |
| `apps/web/public/images/dubai.jpg`       | Dubai skyline and Burj Khalifa at sunset                       | [Unsplash image](https://images.unsplash.com/photo-1512453979798-5ea266f8880c)                                                   |
| `apps/web/public/images/turkey.jpg`      | Oludeniz lagoon, Turkey, by Hilmi Can Taskiran                 | [Unsplash photo](https://unsplash.com/photos/k4bSibOhR74), [image](https://images.unsplash.com/photo-1686465602845-868cebea024a) |
| `apps/web/public/images/italy.jpg`       | Positano, Italy, by Khachik Simonian                           | [Unsplash photo](https://unsplash.com/photos/TtDa6GZBIYI), [image](https://images.unsplash.com/photo-1515400276915-8aa3a8fd70f4) |
| `apps/web/public/images/pool.jpg`        | Resort swimming pool at dusk                                   | [Unsplash image](https://images.unsplash.com/photo-1571896349842-33c89424de2d)                                                   |

Downloaded on 7 October 2026. Images are served from `/images/` to avoid runtime
dependency on an external image host. Hero dimensions are 1600 x 950 pixels;
other images are 900 pixels wide. The hero and Turkey images use landscape crops.

## Language flags

The local SVGs in `apps/web/public/images/flags` are country flags downloaded from
[Flagcdn](https://flagcdn.com/) on 15 October 2026. Flagcdn distributes vectors
based on Wikimedia Commons; see its [usage documentation](https://flagpedia.net/download/api).
`catalonia.svg` is a locally drawn Senyera. These assets are cropped into circles
in the language selector and make no external requests at runtime.

## Mock hotel gallery photography

Added on 15 October 2026. The files in `apps/web/public/images/hotels/` are
illustrative stock photographs used with **fictional demonstration hotels**.
They do not depict the named sample properties, establish facilities at those
properties, or represent live TBO inventory. Sample hotel names, addresses,
review scores, review counts and prices are synthetic. The hotel results and
details screens identify sample inventory and do not permit sample bookings.

These assets are served locally with Next.js responsive image optimization;
there are no stock-image host requests in the browser. Newly downloaded images
are 1200 pixels wide, except the courtyard image which keeps its source aspect
ratio. `resort-pool.jpg` reuses the existing 900-pixel homepage stock photograph.
Images retain their natural appearance; only delivery size, quality and crop
parameters were applied.

| Local filename           | Illustrative subject                           | Source                                                                                                                                                                              |
| ------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resort-pool.jpg`        | Resort pool and buildings at dusk              | [Unsplash image](https://images.unsplash.com/photo-1571896349842-33c89424de2d)                                                                                                      |
| `beach-resort.jpg`       | Tropical resort buildings beside a pool        | [Unsplash image](https://images.unsplash.com/photo-1566073771259-6a8506099945)                                                                                                      |
| `city-hotel.jpg`         | Modern white hotel exterior, by Bhanu Singh    | [Unsplash photo](https://unsplash.com/photos/modern-white-hotel-building-against-clear-blue-sky-Pj7j384f23U), [image](https://images.unsplash.com/photo-1763708204354-365647bcf21e) |
| `deluxe-room.jpg`        | Contemporary double bedroom                    | [Unsplash image](https://images.unsplash.com/photo-1566665797739-1674de7a421a)                                                                                                      |
| `hotel-lobby.jpg`        | Hotel reception and seating, by Tim Photoguy   | [Unsplash photo](https://unsplash.com/photos/empty-hotel-lobby-FPS7a7XQZ0w), [image](https://images.unsplash.com/photo-1560662105-57f8ad6ae2d1)                                     |
| `infinity-pool.jpg`      | Illuminated resort pool at blue hour           | [Unsplash image](https://images.unsplash.com/photo-1542314831-068cd1dbfeeb)                                                                                                         |
| `boutique-courtyard.jpg` | Hotel courtyard with a water feature, by z yan | [Pexels photo](https://www.pexels.com/photo/fountain-in-courtyard-of-hotel-11909503/), [image](https://images.pexels.com/photos/11909503/pexels-photo-11909503.jpeg)                |
| `palm-resort.jpg`        | Palm-lined resort pool, by Cory Bjork          | [Unsplash photo](https://unsplash.com/photos/swimming-pool-near-palm-trees-during-daytime-D1yT791Nf9A), [image](https://images.unsplash.com/photo-1623718649591-311775a30c43)       |
| `beachfront-hotel.jpg`   | Seafront infinity pool at sunset               | [Unsplash image](https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9)                                                                                                      |
| `luxury-suite.jpg`       | Warm wood hotel bedroom overlooking greenery   | [Unsplash image](https://images.unsplash.com/photo-1611892440504-42a792e24d32)                                                                                                      |

Unsplash assets follow the [Unsplash license](https://unsplash.com/license).
The courtyard asset follows the [Pexels license](https://www.pexels.com/license/).
No Loveholidays photography, logos or other brand assets are included.
