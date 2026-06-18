# Galerows Android Production Checklist

## Release Target

- Platform: Android first.
- Package name: `com.galerows.app`.
- Monetization: AdMob banners plus RevenueCat premium entitlement `premium`.
- Play Billing product: `plano_premium_mensal`.
- Audience: 13+, teens and adults; not child-directed.
- Store category: Game > Casual.

## Before Upload

- Confirm the final privacy policy URL is public and points to the latest policy.
- Confirm Play Console app package is exactly `com.galerows.app`.
- Confirm `android/keystore.properties` exists locally and is not committed.
- Confirm release secrets are provided through local files or environment variables, never committed.
- Run:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
  - `npm run build`
  - `npm run cap:android`
  - `./gradlew bundleRelease` from `android/`

## Play Console App Content

- Data safety:
  - Declare local gameplay/player/settings data.
  - Declare AdMob advertising identifiers and ad interactions as handled by Google AdMob.
  - Declare RevenueCat/Google Play subscription processing for premium.
  - State that Galerows has no own backend for personal data storage.
- Permissions:
  - `INTERNET` for platform, ads, and purchases.
  - `CAMERA` only for local QR code scanning.
  - `AD_ID` for ads.
- Ads declaration: app contains ads.
- Target audience: 13+; not primarily directed to children.
- Content rating: complete as a casual party game with user-entered player names only.

## Closed Testing And Production

- If Play Console shows the new personal account requirement, create a closed testing track.
- Keep at least 12 testers opted in for 14 continuous days.
- Ask testers to cover first open, all games, language changes, offline play, QR scanner, ads consent, premium purchase, and restore.
- Record feedback themes and fixes for the production access questionnaire.
- Upload the final AAB only after pre-launch report has no blocking crashes or policy warnings.

## Device Acceptance

- First open and hub render correctly.
- Navigation works for every game and result screen.
- Sessions can be resumed where expected.
- Offline gameplay works after the app is installed.
- QR scanner handles camera granted and denied states.
- Ad consent form and privacy options work when required.
- Premium purchase/restoration removes ads.
- RevenueCat unavailable or missing API key falls back without crashing.
