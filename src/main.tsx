import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App.tsx'
import BatchModePage from './batch/BatchModePage.tsx'
import { MNCErrorHandlerProvider } from 'metanet-react-prompt'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MNCErrorHandlerProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/batch" element={<BatchModePage />} />
        </Routes>
      </BrowserRouter>
    </MNCErrorHandlerProvider>
  </StrictMode>
)
