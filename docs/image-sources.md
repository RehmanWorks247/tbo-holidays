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
