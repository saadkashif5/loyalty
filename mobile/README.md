# TapTapSell Loyalty — customer app

React Native (Expo, expo-router) app for customers: join programs, tap the NFC
stamper, track progress, and redeem rewards.

## Setup

```bash
cd mobile
npm install
```

This app is deliberately **outside** the root npm workspaces — Metro resolves
hoisted/symlinked dependencies poorly, so it keeps its own `node_modules`.

## Running

NFC is not available in Expo Go, so a development build is required:

```bash
npx expo run:android      # or: npx expo run:ios
```

Point the app at your API by editing `expo.extra.apiBaseUrl` in `app.json`. On a
physical Android device, `localhost` refers to the phone — use your machine's LAN
IP (e.g. `http://192.168.1.20:4000/api/v1`).

## What still needs doing

- QR fallback scanning screen (`expo-camera` is installed; the deep link path
  `/discover/stampers/:deviceIdentifier` is already live on the API).
- Push notification registration (FCM).
- Confirm on real hardware whether an NFC read requires the app to be
  foregrounded on each platform — an open decision in PRD §67 that must be
  settled by device testing, not assumption.
