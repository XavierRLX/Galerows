import { Capacitor } from '@capacitor/core'
import { AdMob, AdmobConsentStatus, BannerAdPosition, BannerAdSize, MaxAdContentRating } from '@capacitor-community/admob'
import { adMobConfig } from './adMob.config'
import type { AdBannerPlacement } from './ads.types'
import { canDisplayAds } from './ads.visibility'
import { isPremiumActive } from '../premium/premium.access'

type AdsRuntime = {
  initialized: boolean
  initializing: Promise<void> | null
  canRequestAds: boolean
  privacyOptionsRequired: boolean
  bannerPlacement: AdBannerPlacement | null
}

const runtime: AdsRuntime = {
  initialized: false,
  initializing: null,
  canRequestAds: false,
  privacyOptionsRequired: false,
  bannerPlacement: null,
}

function canUseNativeAndroidAds() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

export async function initializeAds(): Promise<void> {
  if (!canDisplayAds()) return
  if (!canUseNativeAndroidAds()) return
  if (runtime.initialized) return
  if (runtime.initializing) return runtime.initializing
  runtime.initializing = initializeNativeAds().finally(() => {
    runtime.initializing = null
  })
  return runtime.initializing
}

async function initializeNativeAds() {
  try {
    await AdMob.initialize({
      initializeForTesting: adMobConfig.usesTestIds,
      maxAdContentRating: MaxAdContentRating.Teen,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    })
    const consentInfo = await AdMob.requestConsentInfo()
    let updatedConsentInfo = consentInfo
    if (!consentInfo.canRequestAds && consentInfo.isConsentFormAvailable && consentInfo.status === AdmobConsentStatus.REQUIRED) {
      updatedConsentInfo = await AdMob.showConsentForm()
    }
    runtime.canRequestAds = updatedConsentInfo.canRequestAds
    runtime.privacyOptionsRequired = updatedConsentInfo.privacyOptionsRequirementStatus === 'REQUIRED'
    runtime.initialized = true
  } catch {
    runtime.canRequestAds = false
    runtime.privacyOptionsRequired = false
    runtime.initialized = true
  }
}

export async function showBanner(placement: AdBannerPlacement): Promise<void> {
  await initializeAds()
  if (!canShowAds()) return
  if (runtime.bannerPlacement === placement) return
  await removeBanner()
  try {
    await AdMob.showBanner({
      adId: adMobConfig.androidAdUnits.banner,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
      isTesting: adMobConfig.usesTestIds,
    })
    runtime.bannerPlacement = placement
  } catch {
    runtime.bannerPlacement = null
  }
}

export async function hideBanner(): Promise<void> {
  if (!canUseNativeAndroidAds()) return
  try {
    await AdMob.hideBanner()
  } catch {
    // Keep navigation resilient if the native view has already gone away.
  } finally {
    runtime.bannerPlacement = null
  }
}

export async function removeBanner(): Promise<void> {
  if (!canUseNativeAndroidAds()) return
  try {
    await AdMob.removeBanner()
  } catch {
    // Keep navigation resilient if no banner is currently attached.
  } finally {
    runtime.bannerPlacement = null
  }
}

export function isPrivacyOptionsRequired() {
  return canDisplayAds() && canUseNativeAndroidAds() && runtime.privacyOptionsRequired
}

export async function showPrivacyOptions(): Promise<boolean> {
  await initializeAds()
  if (!canUseNativeAndroidAds()) return false
  try {
    await AdMob.showPrivacyOptionsForm()
    const consentInfo = await AdMob.requestConsentInfo()
    runtime.canRequestAds = consentInfo.canRequestAds
    runtime.privacyOptionsRequired = consentInfo.privacyOptionsRequirementStatus === 'REQUIRED'
    return true
  } catch {
    return false
  }
}

export function getAdsRuntimeForTests() {
  return runtime
}

export function resetAdsRuntimeForTests() {
  runtime.initialized = false
  runtime.initializing = null
  runtime.canRequestAds = false
  runtime.privacyOptionsRequired = false
  runtime.bannerPlacement = null
}

function canShowAds() {
  return canDisplayAds() && canUseNativeAndroidAds() && runtime.canRequestAds && !isPremiumActive()
}
