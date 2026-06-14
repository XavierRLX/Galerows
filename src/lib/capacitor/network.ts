import { Network } from '@capacitor/network'
export const AppNetwork = { getStatus: () => Network.getStatus(), async onStatusChange(callback: (connected: boolean) => void): Promise<() => void> { const listener = await Network.addListener('networkStatusChange', ({ connected }) => callback(connected)); return () => { void listener.remove() } } }
