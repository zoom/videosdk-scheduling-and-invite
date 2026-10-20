import ReactDom from 'react-dom/client'
import App from './App'
import '../styles.css'

// remove any service workers left over from another app served on the same origin.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => registrations.forEach((r) => r.unregister()))
    .catch(() => {})
}

ReactDom.createRoot(document.getElementById('root') as HTMLElement).render(<App />)
