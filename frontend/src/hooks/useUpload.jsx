import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../infra/api/api'

export function useUpload() {
    const navigate = useNavigate()
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

            const responseData = await api.uploadDocument(formData)
            const { id } = responseData

            navigate(`/review/${id}`)
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Erro ao enviar arquivo')
        } finally {
            setLoading(false)
        }
    }

    return {
        file,
        tipo,
        loading,
        error,
        setTipo,
        handleFileChange,
        handleSubmit
    }
}