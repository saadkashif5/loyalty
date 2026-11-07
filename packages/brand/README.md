# @taptapsell/brand

The product's name, logo and colours, shared by the portal, the business dashboard, the admin console and the API.

| To change | Edit | Reaches |
| --- | --- | --- |
| Name, byline, tagline | `src/index.ts` → `BRAND` | Page titles, headers, emails, authenticator label, portal copy (`{brand}` in `portal/src/lib/i18n.ts`) |
| Colours | `src/index.ts` → `COLORS` | Every `brand-*` / `accent-*` Tailwind class, PWA theme colour and icon |
| Logo | `src/Logo.tsx` → the `<svg>` in `LogoMark` | Every header, sign-in page, the admin sidebar, and the home-screen icon |
| Sign-in page layout | `src/AuthShell.tsx` | Sign-in, sign-up, password and invite pages in all three apps |

Keep `brand-500` dark enough for white text on top; buttons use it.

After changing colours or the logo, restart any running `next dev` so Tailwind picks up the new values.

Not covered: the Expo app in `mobile/`, which cannot import workspace packages. Its name and colours are in `mobile/src/components/ui.tsx` and `mobile/app.json`.

Current stamper glyph: [Lucide "stamp"](https://lucide.dev/icons/stamp), ISC licence.
