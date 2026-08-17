import React from 'react'
import '../../styles/Upload.css'
import { useUpload } from '../../hooks/useUpload'

function Upload() {
  const {
    file,
    tipo,
    loading,
    error,
    setTipo,
    handleFileChange,
    handleSubmit
  } = useUpload()

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
