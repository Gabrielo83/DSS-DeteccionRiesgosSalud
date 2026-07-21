import { BrowserRouter } from 'react-router-dom'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

if (import.meta.env.DEV) {
  Promise.all([
    import('./demo/demoSeed.js'),
    import('./demo/firebaseEmployeeSeed.js'),
    import('./demo/firebaseRiskSeed.js'),
    import('./services/firebase/adminUserService.js'),
  ]).catch((error) => {
    console.warn('No se pudieron cargar las herramientas de desarrollo.', error)
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
