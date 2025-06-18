import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { MNCErrorHandlerProvider } from 'metanet-react-prompt'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MNCErrorHandlerProvider>
      <App />
    </MNCErrorHandlerProvider>
  </StrictMode>
)
