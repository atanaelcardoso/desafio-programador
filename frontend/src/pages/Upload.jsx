import React, { useState, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppContext } from '../App'
import axios from 'axios'
import '../styles/Upload.css'

function Upload() {
  const navigate = useNavigate()
  const { transcription, setTranscription } = useContext(AppContext)
  const [file, setFile] = useState(null)
  const [tipo, setTipo] = useState('cartao-ponto')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      if (!selectedFile.type.includes('pdf')) {
        setError('Por favor, selecione um arquivo PDF')
        setFile(null)
        return
      }
      if (selectedFile.size > 50 * 1024 * 1024) {
        setError('Arquivo muito grande (máximo 50MB)')
        setFile(null)
        return
      }
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!file) {
      setError('Selecione um arquivo PDF')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('arquivo', file)
      formData.append('tipo', tipo)

      const response = await axios.post('/api/transcricoes', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      const { id } = response.data

      // Guardar no contexto e redirecionar para review
      setTranscription({
        id,
        tipo,
        status: 'processando',
        value: null,
        error: null
      })

      // Iniciar polling
      navigate(`/review/${id}`)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erro ao enviar arquivo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="upload-container">
      <div className="upload-card">
        <h2>📤 Enviar Documento</h2>
        
        <form onSubmit={handleSubmit} className="upload-form">
          <div className="form-group">
            <label htmlFor="tipo">Tipo de Documento</label>
            <select
              id="tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              disabled={loading}
            >
              <option value="cartao-ponto">Cartão de Ponto</option>
              <option value="holerite">Holerite</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="file">Selecione o PDF</label>
            <input
              id="file"
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              disabled={loading}
              className="file-input"
            />
            {file && (
              <p className="file-info">
                ✓ {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          {error && <div className="error-message">❌ {error}</div>}

          <button
            type="submit"
            disabled={!file || loading}
            className="submit-button"
          >
            {loading ? '⏳ Enviando...' : '📤 Enviar'}
          </button>
        </form>

        <div className="upload-info">
          <h3>ℹ️ Instruções</h3>
          <ul>
            <li>Selecione um arquivo PDF (máximo 50MB)</li>
            <li>Escolha o tipo de documento</li>
            <li>O processamento pode levar alguns minutos</li>
            <li>Você poderá editar os dados após a leitura</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default Upload
