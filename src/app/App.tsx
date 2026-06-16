import { BrowserRouter } from 'react-router-dom'
import { FakeAdProvider } from '../features/ads/FakeAdProvider'
import { AppRoutes } from './routes'
import { ScrollToTop } from './ScrollToTop'
import { useNativeAppSetup } from './useNativeAppSetup'

export function App() {
  useNativeAppSetup()
  return <BrowserRouter><FakeAdProvider><ScrollToTop /><AppRoutes /></FakeAdProvider></BrowserRouter>
}
