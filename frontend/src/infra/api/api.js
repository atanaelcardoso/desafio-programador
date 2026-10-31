import axios from 'axios'

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export const api = {
    getById: async (id) => {
        const response = await axios.get(`${API_BASE_URL}/api/transcricoes/${id}`)
        return response.data
    },

    update: async (id, value) => {
        const response = await axios.put(`${API_BASE_URL}/api/transcricoes/${id}`, { value })
        return response.data
    },

    getDownloadFile: async (id, format) => {
        return await axios.get(`${API_BASE_URL}/api/transcricoes/${id}/planilha`, {
            params: { formato: format },
            responseType: format === 'json' ? 'json' : 'blob'
        })
    },
     uploadDocument: async (formData) => {
        const response = await axios.post(`${API_BASE_URL}/api/transcricoes`, formData)
        return response.data
    }
}
