import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
async function safely(action: () => Promise<void>) { try { await action() } catch { /* Unavailable in browsers without native support. */ } }
export const AppHaptics = { light: () => safely(() => Haptics.impact({ style: ImpactStyle.Light })), medium: () => safely(() => Haptics.impact({ style: ImpactStyle.Medium })), success: () => safely(() => Haptics.notification({ type: NotificationType.Success })), error: () => safely(() => Haptics.notification({ type: NotificationType.Error })) }
