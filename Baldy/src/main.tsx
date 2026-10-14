import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Bootstrap 5 (komponen) bertema SIKOTIS — dimuat sesudah index.css yang menetapkan urutan layer.
import './styles/bootstrap.scss'
import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
