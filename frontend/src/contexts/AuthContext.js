import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // Перевірка токена при завантаженні
  useEffect(() => {
    const checkAuth = async () => {
      const savedToken = localStorage.getItem('token');
      if (savedToken) {
        try {
          // Встановлюємо токен в axios
          api.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
          
          // Перевіряємо чи токен валідний
          const response = await api.get('/auth/me');
          setUser(response.data.user);
          setToken(savedToken);
        } catch (error) {
          console.error('Token validation failed:', error);
          // Токен невалідний - очищуємо
          localStorage.removeItem('token');
          delete api.defaults.headers.common['Authorization'];
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token: newToken, user: userData } = response.data;

      // Зберігаємо токен
      localStorage.setItem('token', newToken);
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      setToken(newToken);
      setUser(userData);

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Помилка входу',
      };
    }
  };

  const register = async (username, email, password, bio = '') => {
    try {
      const response = await api.post('/auth/register', {
        username,
        email,
        password,
        bio,
      });
      const { token: newToken, user: userData } = response.data;

      // Зберігаємо токен
      localStorage.setItem('token', newToken);
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      setToken(newToken);
      setUser(userData);

      return { success: true };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Помилка реєстрації',
      };
    }
  };

  const logout = () => {
    // Очищуємо токен
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    
    setToken(null);
    setUser(null);
  };

  const updateProfile = async (updates) => {
    try {
      const response = await api.put('/auth/profile', updates);
      setUser(response.data.user);
      return { success: true };
    } catch (error) {
      console.error('Profile update error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Помилка оновлення профілю',
      };
    }
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
