import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { canDisplayAds } from '../features/ads/ads.visibility'
import { contentAdminEnabled } from '../features/content/contentAdmin'
import { HubScreen } from '../features/hub/HubScreen'
import { QuemSouEuPlayScreen } from '../features/quem-sou-eu/QuemSouEuPlayScreen'
import { QuemSouEuResultScreen } from '../features/quem-sou-eu/QuemSouEuResultScreen'
import { QuemSouEuSetupScreen } from '../features/quem-sou-eu/QuemSouEuSetupScreen'

const AdedonhaHomeScreen = lazy(() => import('../features/adedonha/AdedonhaHomeScreen').then((module) => ({ default: module.AdedonhaHomeScreen })))
const AdedonhaPlayScreen = lazy(() => import('../features/adedonha/AdedonhaPlayScreen').then((module) => ({ default: module.AdedonhaPlayScreen })))
const AdedonhaSetupScreen = lazy(() => import('../features/adedonha/AdedonhaSetupScreen').then((module) => ({ default: module.AdedonhaSetupScreen })))
const ContentAdminScreen = lazy(() => import('../features/content/ContentAdminScreen').then((module) => ({ default: module.ContentAdminScreen })))
const ImpostorDaPalavraHomeScreen = lazy(() => import('../features/impostor-da-palavra/ImpostorDaPalavraHomeScreen').then((module) => ({ default: module.ImpostorDaPalavraHomeScreen })))
const ImpostorDaPalavraPlayScreen = lazy(() => import('../features/impostor-da-palavra/ImpostorDaPalavraPlayScreen').then((module) => ({ default: module.ImpostorDaPalavraPlayScreen })))
const ImpostorDaPalavraResultScreen = lazy(() => import('../features/impostor-da-palavra/ImpostorDaPalavraResultScreen').then((module) => ({ default: module.ImpostorDaPalavraResultScreen })))
const ImpostorDaPalavraSetupScreen = lazy(() => import('../features/impostor-da-palavra/ImpostorDaPalavraSetupScreen').then((module) => ({ default: module.ImpostorDaPalavraSetupScreen })))
const MimicaHomeScreen = lazy(() => import('../features/mimica/MimicaHomeScreen').then((module) => ({ default: module.MimicaHomeScreen })))
const MimicaPlayScreen = lazy(() => import('../features/mimica/MimicaPlayScreen').then((module) => ({ default: module.MimicaPlayScreen })))
const MimicaResultScreen = lazy(() => import('../features/mimica/MimicaResultScreen').then((module) => ({ default: module.MimicaResultScreen })))
const MimicaSetupScreen = lazy(() => import('../features/mimica/MimicaSetupScreen').then((module) => ({ default: module.MimicaSetupScreen })))
const NemFerrandoHomeScreen = lazy(() => import('../features/nem-ferrando/NemFerrandoHomeScreen').then((module) => ({ default: module.NemFerrandoHomeScreen })))
const NemFerrandoPlayScreen = lazy(() => import('../features/nem-ferrando/NemFerrandoPlayScreen').then((module) => ({ default: module.NemFerrandoPlayScreen })))
const NemFerrandoResultScreen = lazy(() => import('../features/nem-ferrando/NemFerrandoResultScreen').then((module) => ({ default: module.NemFerrandoResultScreen })))
const NemFerrandoSetupScreen = lazy(() => import('../features/nem-ferrando/NemFerrandoSetupScreen').then((module) => ({ default: module.NemFerrandoSetupScreen })))
const PremiumScreen = lazy(() => import('../features/premium/PremiumScreen').then((module) => ({ default: module.PremiumScreen })))
const PlayersScreen = lazy(() => import('../features/players/PlayersScreen').then((module) => ({ default: module.PlayersScreen })))
const QuemSouEuHomeScreen = lazy(() => import('../features/quem-sou-eu/QuemSouEuHomeScreen').then((module) => ({ default: module.QuemSouEuHomeScreen })))
const SettingsScreen = lazy(() => import('../features/settings/SettingsScreen').then((module) => ({ default: module.SettingsScreen })))
const TabooHomeScreen = lazy(() => import('../features/taboo/TabooHomeScreen').then((module) => ({ default: module.TabooHomeScreen })))
const TabooPlayScreen = lazy(() => import('../features/taboo/TabooPlayScreen').then((module) => ({ default: module.TabooPlayScreen })))
const TabooResultScreen = lazy(() => import('../features/taboo/TabooResultScreen').then((module) => ({ default: module.TabooResultScreen })))
const TabooSetupScreen = lazy(() => import('../features/taboo/TabooSetupScreen').then((module) => ({ default: module.TabooSetupScreen })))

function RouteLoading() {
  return <div aria-label="Carregando tela" className="min-h-dvh bg-slate-950" role="status" />
}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HubScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
          {canDisplayAds() ? <Route path="premium" element={<PremiumScreen />} /> : null}
          <Route path="players" element={<PlayersScreen />} />
          {contentAdminEnabled ? <Route path="admin/content" element={<ContentAdminScreen />} /> : null}
          <Route path="games/nem-ferrando" element={<NemFerrandoHomeScreen />} />
          <Route path="games/nem-ferrando/setup" element={<NemFerrandoSetupScreen />} />
          <Route path="games/nem-ferrando/play" element={<NemFerrandoPlayScreen />} />
          <Route path="games/nem-ferrando/result" element={<NemFerrandoResultScreen />} />
          <Route path="games/impostor-da-palavra" element={<ImpostorDaPalavraHomeScreen />} />
          <Route path="games/impostor-da-palavra/setup" element={<ImpostorDaPalavraSetupScreen />} />
          <Route path="games/impostor-da-palavra/play" element={<ImpostorDaPalavraPlayScreen />} />
          <Route path="games/impostor-da-palavra/result" element={<ImpostorDaPalavraResultScreen />} />
          <Route path="games/taboo" element={<TabooHomeScreen />} />
          <Route path="games/taboo/setup" element={<TabooSetupScreen />} />
          <Route path="games/taboo/play" element={<TabooPlayScreen />} />
          <Route path="games/taboo/result" element={<TabooResultScreen />} />
          <Route path="games/mimica" element={<MimicaHomeScreen />} />
          <Route path="games/mimica/setup" element={<MimicaSetupScreen />} />
          <Route path="games/mimica/play" element={<MimicaPlayScreen />} />
          <Route path="games/mimica/result" element={<MimicaResultScreen />} />
          <Route path="games/quem-sou-eu" element={<QuemSouEuHomeScreen />} />
          <Route path="games/quem-sou-eu/setup" element={<QuemSouEuSetupScreen />} />
          <Route path="games/quem-sou-eu/play" element={<QuemSouEuPlayScreen />} />
          <Route path="games/quem-sou-eu/result" element={<QuemSouEuResultScreen />} />
          <Route path="games/adedonha" element={<AdedonhaHomeScreen />} />
          <Route path="games/adedonha/setup" element={<AdedonhaSetupScreen />} />
          <Route path="games/adedonha/play" element={<AdedonhaPlayScreen />} />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
