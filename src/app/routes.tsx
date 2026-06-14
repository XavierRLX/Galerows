import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { ContentAdminScreen } from '../features/content/ContentAdminScreen'
import { contentAdminEnabled } from '../features/content/contentAdmin'
import { HubScreen } from '../features/hub/HubScreen'
import { ImpostorDaPalavraHomeScreen } from '../features/impostor-da-palavra/ImpostorDaPalavraHomeScreen'
import { ImpostorDaPalavraPlayScreen } from '../features/impostor-da-palavra/ImpostorDaPalavraPlayScreen'
import { ImpostorDaPalavraResultScreen } from '../features/impostor-da-palavra/ImpostorDaPalavraResultScreen'
import { ImpostorDaPalavraSetupScreen } from '../features/impostor-da-palavra/ImpostorDaPalavraSetupScreen'
import { NemFerrandoHomeScreen } from '../features/nem-ferrando/NemFerrandoHomeScreen'
import { NemFerrandoPlayScreen } from '../features/nem-ferrando/NemFerrandoPlayScreen'
import { NemFerrandoResultScreen } from '../features/nem-ferrando/NemFerrandoResultScreen'
import { NemFerrandoSetupScreen } from '../features/nem-ferrando/NemFerrandoSetupScreen'
import { PremiumScreen } from '../features/premium/PremiumScreen'
import { PlayersScreen } from '../features/players/PlayersScreen'
import { SettingsScreen } from '../features/settings/SettingsScreen'
import { TabooHomeScreen } from '../features/taboo/TabooHomeScreen'
import { TabooPlayScreen } from '../features/taboo/TabooPlayScreen'
import { TabooResultScreen } from '../features/taboo/TabooResultScreen'
import { TabooSetupScreen } from '../features/taboo/TabooSetupScreen'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HubScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
        <Route path="premium" element={<PremiumScreen />} />
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
        <Route path="*" element={<Navigate replace to="/" />} />
      </Route>
    </Routes>
  )
}
