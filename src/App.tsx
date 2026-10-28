import { BrowserRouter, Route, Routes } from 'react-router-dom'
import HomePage from './pages/HomePage'
import SessionPage from './pages/SessionPage'
import { AuthProvider } from './lib/auth'

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/s/:inviteId" element={<SessionPage />} />
        <Route path="/s/:inviteId/host" element={<SessionPage host />} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
)

export default App
