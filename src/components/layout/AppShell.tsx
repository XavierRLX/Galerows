import { Outlet } from 'react-router-dom'
import { SafeArea } from './SafeArea'

export function AppShell() {
  return <SafeArea className="bg-slate-950 text-white"><main className="mx-auto min-h-dvh w-full max-w-2xl"><Outlet /></main></SafeArea>
}
