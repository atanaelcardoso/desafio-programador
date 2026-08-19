import axios from 'axios'

export const api = {
    getById: async (id) => {
        const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/transcricoes/${id}`)
        return response.data
    },

    update: async (id, value) => {
        const response = await axios.put(`${import.meta.env.VITE_API_URL}/api/transcricoes/${id}`, { value })
        return response.data
    },

    getDownloadFile: async (id, format) => {
        return await axios.get(`${import.meta.env.VITE_API_URL}/api/transcricoes/${id}/planilha`, {
            params: { formato: format },
            responseType: format === 'json' ? 'json' : 'blob'
        })
    },
     uploadDocument: async (formData) => {
        const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/transcricoes`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        })
        return response.data
    }
}
