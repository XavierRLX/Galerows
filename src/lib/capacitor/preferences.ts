import { Preferences } from '@capacitor/preferences'

export const LocalPreferences = {
  async getJson<T>(key: string): Promise<T | null> { const { value } = await Preferences.get({ key }); if (value === null) return null; try { return JSON.parse(value) as T } catch { return null } },
  async setJson<T>(key: string, value: T): Promise<void> { await Preferences.set({ key, value: JSON.stringify(value) }) },
  async remove(key: string): Promise<void> { await Preferences.remove({ key }) },
}
