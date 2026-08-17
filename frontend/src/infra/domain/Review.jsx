import React from 'react'
import { useReview } from '../../hooks/useReview'
import '../../styles/Review.css'

export default function Review() {
  const {
    data,
    loading,
    error,
    editing,
    downloadFormat,
    status,
    setEditing,
    setDownloadFormat,
    handleDownload,
    handleSave,
    navigate
  } = useReview()

  if (loading && status === 'processando') {
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

  if (error) {
    return (
      <div className="review-container">
        <div className="error-card">
          <h2>❌ Erro no processamento</h2>
          <p>{error}</p>
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

          <button onClick={() => setEditing(!editing)} className="edit-button">
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
