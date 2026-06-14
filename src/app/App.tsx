import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from './routes'
import { ScrollToTop } from './ScrollToTop'
import { useNativeAppSetup } from './useNativeAppSetup'

export function App() {
  useNativeAppSetup()
  return <BrowserRouter><ScrollToTop /><AppRoutes /></BrowserRouter>
}
