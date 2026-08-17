import React, { useState, useContext, createContext } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import './App.css'
import Review from './infra/domain/Review'
import Upload from './infra/domain/Upload'

export const AppContext = createContext()

function App() {
  const [transcription, setTranscription] = useState({
    id: null,
    tipo: null,
    status: null,
    value: null,
    error: null
  })

  return (
    <AppContext.Provider value={{ transcription, setTranscription }}>
      <BrowserRouter>
        <div className="app-container">
          <header className="app-header">
            <h1>📄 Quick Filler</h1>
            <p>Transcrição de Documentos Trabalhistas</p>
          </header>
          
          <main className="app-main">
            <Routes>
              <Route path="/" element={<Upload />} />
              <Route path="/review/:id" element={<Review />} />
            </Routes>
          </main>

          <footer className="app-footer">
            <p>© 2024 Quick Filler — Processamento de PDFs</p>
          </footer>
        </div>
      </BrowserRouter>
    </AppContext.Provider>
  )
}

export default App
