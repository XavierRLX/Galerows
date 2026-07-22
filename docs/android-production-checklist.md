# Galerows Android Production Checklist

## Release Target

- Platform: Android first.
- Package name: `com.galerows.app`.
- Monetization in this release: none. AdMob, RevenueCat and Play Billing are excluded from the Android binary.
- Planned later releases: AdMob first; RevenueCat premium after ads are live.
- Audience: 13+, teens and adults; not child-directed.
- Store category: Game > Casual.

## Before Upload

- Confirm `https://xavierrlx.github.io/Galerows/privacy.html` is public and points to the latest policy.
- Keep `VITE_PRIVACY_POLICY_URL` set to that same public HTTPS URL when overriding the production build configuration.
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
  - Answer that this release does not collect or share user data.
  - Do not declare gameplay/player/settings data as collected: it is processed only on-device.
  - State that Galerows has no account or own backend for personal data storage.
  - Confirm that the declaration is updated before adding any SDK that transmits data off-device.
- Permissions:
  - `INTERNET` for Google Play update/review/store flows.
  - `CAMERA` only for local QR code scanning.
  - Confirm the merged manifest has no `AD_ID`, Ad Services or Billing permissions.
- Ads declaration: **No, this release does not contain ads.** Edit the existing internal-test declaration if it currently says Yes.
- Target audience: 13+; not primarily directed to children.
- Content rating: disclose non-graphic references to murder, death, victims and elimination in Cidade Dorme and Última Pista.
- Privacy policy: use `https://xavierrlx.github.io/Galerows/privacy.html` in Play Console; permanent in-app access is under Settings > Privacy and data.

## Closed Testing And Production

- If Play Console shows the new personal account requirement, create a closed testing track.
- Keep at least 12 testers opted in for 14 continuous days.
- Ask testers to cover first open, privacy notice, local data deletion, all games, language changes, offline play, and QR scanner.
- Record feedback themes and fixes for the production access questionnaire.
- Upload the final AAB only after pre-launch report has no blocking crashes or policy warnings.

## Device Acceptance

- First open and hub render correctly.
- Navigation works for every game and result screen.
- Sessions can be resumed where expected.
- Offline gameplay works after the app is installed.
- QR scanner handles camera granted and denied states.
- Privacy Policy opens from the app and the configured public HTTPS URL is available without login.
- Clearing gameplay data preserves language; clearing all data restores first-run state.

## Before The Ads Update

- Include the AdMob plugin in the Android `includePlugins` list and sync Android.
- Update the policy and Data safety declaration with AdMob collection/sharing before rollout.
- Change Ads declaration to Yes and validate UMP consent plus privacy options.
- Use test ad IDs outside signed production builds and remove the simulated native ad placeholder.

## Before The Premium Update

- Include RevenueCat in the Android `includePlugins` list and sync Android.
- Update Data safety with purchase history and update the privacy policy.
- Provide localized store pricing, restore purchases, and a permanent subscription-management link.
