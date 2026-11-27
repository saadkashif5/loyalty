# @taptapsell/brand

The product's name, logo and colours, shared by the portal, the business dashboard, the admin console and the API.

| To change | Edit | Reaches |
| --- | --- | --- |
| Name, byline, tagline | `src/index.ts` → `BRAND` | Page titles, headers, emails, authenticator label, portal copy (`{brand}` in `portal/src/lib/i18n.ts`) |
| Colours | `src/index.ts` → `PALETTE` (the brand board) and `COLORS` (scales built from it) | Every `brand-*`, `accent-*`, `ink-*`, `crema`, `mint`, `steam` Tailwind class, PWA theme colour and icon |
| Fonts | `src/index.ts` → `FONTS`; each app loads them with `next/font` (see `portal/src/app/layout.tsx`) | `font-display` (Outfit, headlines and wordmark) and `font-sans` (Inter, body). Apps that do not load them fall back to the system font. |
| Logo | `src/Logo.tsx` → the petal paths drawn by `LogoMark` (traced from `assets/stamply-logo-mark.png`) | Every header, sign-in page, the admin sidebar, and the home-screen icon |
| Cards, buttons, form controls, tables, status badges | `src/styles.ts` → `UI`, `TONES`, `STATUS_TONE` | Every app's `components/ui.tsx` (dashboard, admin console, portal) |
| Sign-in page layout | `src/AuthShell.tsx` | Sign-in, sign-up, password and invite pages in all three apps |

`brand-500` is Stamp Orange: white text on it passes contrast only at large bold sizes (19px bold and up). Use `brand-600` (Ember) or `ink` behind smaller white text.

After changing colours or the logo, restart any running `next dev` so Tailwind picks up the new values.

Not covered: the Expo app in `mobile/`, which cannot import workspace packages. Its name and colours are copied into `mobile/src/components/ui.tsx` (keep them in step), and its icon and splash images are in `mobile/assets/`, generated from `assets/stamply-logo-mark.png`. It still uses the system font: loading Outfit and Inter there needs `expo-font`.

Source artwork from the design team (logo, mark) is in `assets/`. The 3D stamper on the portal home page is `portal/public/models/stamper.glb`, built from the designers' export with `portal/scripts/optimize-stamper.mjs`.
