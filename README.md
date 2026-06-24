# Loutakis Real Estate — website + Box & Dice integration

A Next.js (App Router) real estate website for **Loutakis Real Estate** (Inner West, Melbourne), with its Properties section driven automatically by the **Box & Dice (MRI) Website API**. Styled to the official brand: black & white only, the real LOUTAKIS wordmark, and the Brolink / Gotham type system.

It runs **out of the box on bundled sample listings** — no API key needed to preview. Drop in your real key when you're ready and the same pages render live CRM data.

---

## Quick start

```bash
npm install
cp .env.example .env.local      # optional — defaults to mock data
npm run dev                     # http://localhost:3000
```

Build for production:

```bash
npm run build && npm start
```

---

## Going live with Box & Dice

1. In the Box & Dice CRM, generate an **API key** for your office group (Settings → API).
2. Set these environment variables (locally in `.env.local`, or in **Vercel → Settings → Environment Variables** — never commit them):

   | Variable | What it is |
   |---|---|
   | `BOXDICE_API_KEY` | Your secret Website API key |
   | `BOXDICE_API_BASE` | Website API base URL (confirm with MRI) |
   | `BOXDICE_OFFICE_ID` | Your office/group id |
   | `BOXDICE_ENQUIRY_API_BASE` | Enquiry API base (for lead write-back) |
   | `LISTINGS_REVALIDATE_SECONDS` | How often pages refresh (default 600) |
   | `USE_MOCK_DATA` | Set to `false` to use the live API |
   | `REVALIDATE_SECRET` | Secret protecting the `/api/revalidate` webhook |

3. Set `USE_MOCK_DATA=false`, restart, and confirm listings load.
4. **Field mapping:** the API's exact field names vary by account. Open `lib/boxdice.ts` → `normalise()` and adjust the aliases to match your real payload (it's heavily commented). Nothing else needs to change — the rest of the app only uses the normalised shape.

---

## How the sync works

- All CRM calls run **server-side only** (`lib/boxdice.ts` imports `server-only`), so your API key is never exposed to the browser.
- Listing pages use **ISR** (`revalidate`) — served instantly from cache, refreshed in the background.
- Push freshness: hit `GET /api/revalidate?secret=...` from a Box & Dice webhook (instant) or let the included **Vercel cron** (`vercel.json`, every 15 min) refresh on a schedule.
- Enquiry forms POST to `/api/enquiry`, which writes a lead back via the Box & Dice **Enquiry API**.

---

## Project structure

```
app/
  layout.tsx                 Site shell (header + footer)
  page.tsx                   Home (hero, about, services, featured, contact)
  properties/page.tsx        Listings grid + filters
  properties/[slug]/page.tsx Property detail (gallery, enquiry, schema.org)
  api/enquiry/route.ts       Lead write-back → Box & Dice Enquiry API
  api/revalidate/route.ts    On-demand cache refresh (webhook / cron)
components/                  Header, Footer, ListingCard, Filters, EnquiryForm
lib/
  boxdice.ts                 ★ The integration: fetch, normalise, paginate, enquiry
  types.ts                   Normalised Listing shape
  mock-data.ts               Sample listings (used until the key is set)
```

---

## Deploy to Vercel

1. Push this folder to a Git repo.
2. Import it in Vercel.
3. Add the environment variables above.
4. Deploy. Add your custom `.com.au` domain in Vercel → Domains.

Estimated run cost for a small agency: **~A$0–40/month** (Vercel free/Pro + domain).

---

## Branding (already applied — real assets)

- **Logo:** the official LOUTAKIS wordmark (from `LOGO/LOUTAKISnoRE.svg`) is used via `components/Logo.tsx` as transparent PNGs — `public/brand/loutakis-wordmark-black.png` (light header) and `loutakis-wordmark-white.png` (dark footer). The full "LOUTAKIS REAL ESTATE" lockups are also in `public/brand/` if you'd prefer those.
- **Colours:** black `#000` and white `#fff` only, per the brand guidelines (`:root` in `app/globals.css`).
- **Fonts:** the real licensed brand fonts, converted to web `woff2` in `public/fonts/`:
  - *Gotham* — body & headings (`Gotham-Book/Medium/Bold.woff2`).
  - *Brolink* — hero display line (`Brolink-Regular.woff2`).

  Licensing reminder: ship the fonts only under your existing Gotham and Brolink licences; both are commercial faces.

To swap imagery, replace the hero/about photos in `app/page.tsx` (currently licence-free Unsplash placeholders) with the agency's own photography.

---

*API references: [Website Box+Dice API](https://websiteboxdiceapi.docs.apiary.io/) · [Box+Dice Enquiry API](https://boxdiceenquiryapi.docs.apiary.io/)*
