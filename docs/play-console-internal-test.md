# Play Console — Internal Test Update

Use this checklist after uploading the new AAB that excludes monetization.

## App content

- Ads: change the answer to **No** for the current release.
- Data safety: answer that the app does not collect or share user data.
- Privacy policy: use `https://xavierrlx.github.io/Galerows/privacy.html`; its source is `public/privacy.html` and it matches the in-app policy.
- Target audience: select only 13+ age groups intended for teens and adults.
- Content rating: disclose non-graphic references to murder, death, victims and elimination.
- App access: no login or special credentials are required.

## Release validation

- Upload a higher `versionCode` than the artifact already in internal testing.
- Check the App bundle explorer permissions after processing.
- Expected permissions include Camera and Internet.
- The processed artifact must not list Advertising ID, Ad Services or Billing.
- Install from the internal testing link; do not validate only with an Android Studio build.

## Later monetization releases

Before enabling ads or subscriptions, update the privacy policy and Play Console declarations first, then upload the binary containing the respective SDK. Declarations describe every active artifact distributed by Google Play, so retire superseded test releases when appropriate.
