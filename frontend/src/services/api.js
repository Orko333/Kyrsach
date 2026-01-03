import axios from 'axios';

const API_URL =
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:5000/api');

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000 // 30 секунд
});

// Interceptor для обробки помилок
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response) {
      // Сервер відповів з помилкою
      const message = error.response.data?.error || 'Помилка сервера';
      console.error('API Error:', message);
      throw new Error(message);
    } else if (error.request) {
      // Запит відправлено, але немає відповіді
      console.error('Network Error:', error.message);
      throw new Error('Помилка з\'єднання з сервером. Перевірте інтернет.');
    } else {
      // Інша помилка
      console.error('Error:', error.message);
      throw error;
    }
  }
);

export const storyAPI = {
  getAll: (page = 1, limit = 20) => 
    api.get('/stories', { params: { page, limit } }),
  
  getById: (id) => api.get(`/stories/${id}`),
  
  create: (data) => api.post('/stories', data),
  
  addNode: (id, nodeData) => api.post(`/stories/${id}/nodes`, nodeData),
  
  saveChoice: (id, choiceData) => api.post(`/stories/${id}/choice`, choiceData),
  
  delete: (id) => api.delete(`/stories/${id}`)
};

export const aiAPI = {
  generateStart: (data) => api.post('/ai/generate-start', data),
  
  continue: (data) => api.post('/ai/continue', data),
  
  generateImage: (data) => api.post('/ai/generate-image', data)
};

export default api;
