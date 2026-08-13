import React, { useState, useEffect, useContext } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AppContext } from '../App'
import axios from 'axios'
import '../styles/Review.css'

function Review() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { transcription, setTranscription } = useContext(AppContext)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [downloadFormat, setDownloadFormat] = useState('xlsx')

  // Polling para status
  useEffect(() => {
    if (!id) {
      navigate('/')
      return
    }

    const poll = async () => {
      try {
        const response = await axios.get(`/api/transcricoes/${id}`)
        const { status, value, error: transcError } = response.data

        setTranscription(prev => ({
          ...prev,
          status,
          value,
          error: transcError
        }))

        setData(response.data)

        if (status === 'concluido' || status === 'erro') {
          setLoading(false)
        }
      } catch (err) {
        setError(err.message)
        setLoading(false)
      }
    }

    poll()

    // Continuar polling enquanto estiver processando
    const interval = setInterval(() => {
      if (transcription?.status === 'processando') {
        poll()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [id, transcription?.status])

  const handleDownload = async () => {
    try {
      const response = await axios.get(`/api/transcricoes/${id}/planilha`, {
        params: { formato: downloadFormat },
        responseType: downloadFormat === 'json' ? 'json' : 'blob'
      })

      if (downloadFormat === 'json') {
        const dataStr = JSON.stringify(response.data, null, 2)
        const blob = new Blob([dataStr], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `transcricao-${id}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      } else {
        const url = URL.createObjectURL(response.data)
        const a = document.createElement('a')
        a.href = url
        a.download = `transcricao-${id}.${downloadFormat}`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    } catch (err) {
      alert('Erro ao baixar: ' + err.message)
    }
  }

  const handleSave = async () => {
    try {
      await axios.put(`/api/transcricoes/${id}`, {
        value: data.value
      })
      setEditing(false)
      alert('✅ Salvo com sucesso!')
    } catch (err) {
      alert('❌ Erro ao salvar: ' + err.message)
    }
  }

  if (loading && transcription?.status === 'processando') {
    return (
      <div className="review-container">
        <div className="loading-card">
          <div className="spinner"></div>
          <h2>⏳ Processando...</h2>
          <p>Seu documento está sendo lido. Isso pode levar alguns minutos.</p>
        </div>
      </div>
    )
  }

  if (error || transcription?.error) {
    return (
      <div className="review-container">
        <div className="error-card">
          <h2>❌ Erro no processamento</h2>
          <p>{error || transcription?.error}</p>
          <button onClick={() => navigate('/')} className="back-button">
            ← Voltar
          </button>
        </div>
      </div>
    )
  }

  if (!data || !data.value) {
    return (
      <div className="review-container">
        <div className="loading-card">
          <p>Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="review-container">
      <div className="review-header">
        <h2>✅ Revisão da Transcrição</h2>
        <div className="review-actions">
          <button onClick={() => navigate('/')} className="back-button">
            ← Voltar
          </button>
          {editing && (
            <button onClick={handleSave} className="save-button">
              💾 Salvar
            </button>
          )}
          <button
            onClick={() => setEditing(!editing)}
            className="edit-button"
          >
            {editing ? '🔒 Concluir Edição' : '✏️ Editar'}
          </button>
        </div>
      </div>

      <div className="review-content">
        <div className="data-section">
          <h3>📊 Dados Extraídos</h3>
          <pre className="json-preview">
            {JSON.stringify(data.value, null, 2)}
          </pre>
        </div>

        <div className="download-section">
          <h3>📥 Baixar Planilha</h3>
          <div className="download-controls">
            <select
              value={downloadFormat}
              onChange={(e) => setDownloadFormat(e.target.value)}
            >
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV (.csv)</option>
              <option value="json">JSON (.json)</option>
            </select>
            <button onClick={handleDownload} className="download-button">
              📥 Baixar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Review
