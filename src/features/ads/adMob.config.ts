const androidAdMobIds = {
  appId: 'ca-app-pub-5598392740749077~1101732206',
  banner: 'ca-app-pub-5598392740749077/4672182259',
  nativeAdvanced: 'ca-app-pub-5598392740749077/2832486974',
}

export const adMobConfig = {
  androidAppId: import.meta.env.VITE_ADMOB_ANDROID_APP_ID || androidAdMobIds.appId,
  androidAdUnits: {
    banner: import.meta.env.VITE_ADMOB_ANDROID_BANNER_ID || androidAdMobIds.banner,
    nativeAdvanced: import.meta.env.VITE_ADMOB_ANDROID_NATIVE_ADVANCED_ID || androidAdMobIds.nativeAdvanced,
  },
  usesTestIds: false,
}
