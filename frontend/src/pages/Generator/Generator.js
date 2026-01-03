import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaMagic, FaSpinner } from 'react-icons/fa';
import { motion } from 'framer-motion';
import api, { storyAPI, aiAPI } from '../../services/api';
import { BackgroundContext } from '../../contexts/BackgroundContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAutosave } from '../../hooks/useUtilities';
import './Generator.css';

const Generator = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { updateBackground } = React.useContext(BackgroundContext);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    genre: 'фентезі',
    setting: '',
    mainCharacter: '',
    isPublic: false
  });

  // Автозбереження форми
  const { clearSaved, loadSaved } = useAutosave(formData, 'story-draft', 3000);

  // Завантаження збереженої форми при монтуванні
  useEffect(() => {
    const saved = loadSaved();
    if (saved && saved.title) {
      setFormData(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Редірект якщо не авторизований
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/generator' } } });
    }
  }, [isAuthenticated, navigate]);

  const genres = [
    { value: 'фентезі', label: 'Фентезі', emoji: '🧙‍♂️' },
    { value: 'фантастика', label: 'Фантастика', emoji: '🚀' },
    { value: 'детектив', label: 'Детектив', emoji: '🔍' },
    { value: 'жахи', label: 'Жахи', emoji: '👻' },
    { value: 'пригоди', label: 'Пригоди', emoji: '⚔️' },
    { value: 'романтика', label: 'Романтика', emoji: '💕' },
    { value: 'містика', label: 'Містика', emoji: '🔮' },
    { value: 'кіберпанк', label: 'Кіберпанк', emoji: '🤖' },
    { value: 'апокаліпсис', label: 'Апокаліпсис', emoji: '☢️' },
    { value: 'стімпанк', label: 'Стімпанк', emoji: '⚙️' },
    { value: 'трилер', label: 'Трилер', emoji: '🎭' },
    { value: 'історичний', label: 'Історичний', emoji: '🏛️' },
    { value: 'комедія', label: 'Комедія', emoji: '😂' },
    { value: 'драма', label: 'Драма', emoji: '🎬' },
    { value: 'noir', label: 'Нуар', emoji: '🕵️' },
    { value: 'космоопера', label: 'Космоопера', emoji: '🌌' }
  ];

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Basic client-side validation to avoid 400 from server
    if (!formData.title || !formData.setting || !formData.mainCharacter) {
      alert('Будь ласка, заповніть назву, сеттінг та головного персонажа.');
      setLoading(false);
      return;
    }

    try {
      const storyResponse = await storyAPI.create(formData);
      const storyId = storyResponse.data._id;

      // Генеруємо початок історії та зображення паралельно
      const [aiResponse, imageResponse] = await Promise.all([
        aiAPI.generateStart({
          genre: formData.genre,
          setting: formData.setting,
          mainCharacter: formData.mainCharacter
        }),
        aiAPI.generateImage({
          sceneDescription: `${formData.mainCharacter} у ${formData.setting}. Початок пригоди в жанрі ${formData.genre}`,
          genre: formData.genre,
          setting: formData.setting,
          style: 'cinematic'
        }).catch(err => {
          console.warn('Image generation failed:', err);
          return { data: { imageUrl: null } };
        })
      ]);
      // Persist inline image if needed
      let imageUrl = imageResponse.data?.imageUrl || null;
      try {
        if (imageUrl && imageUrl.startsWith('data:')) {
          const upload = await api.post('/images/from-base64', { dataUrl: imageUrl });
          imageUrl = upload.data?.imageUrl || null;
        }
      } catch (e) {
        console.warn('Failed to persist base64 image, drop it to avoid large docs:', e?.message || e);
        imageUrl = null;
      }

      await storyAPI.addNode(storyId, {
        content: aiResponse.data.content,
        choices: aiResponse.data.choices,
        imageUrl
      });

      // Update background with the newly generated image (persist for authenticated users)
      if (imageUrl) {
        updateBackground(imageUrl);
      }

      // Очищаємо збережену форму після успішного створення
      clearSaved();

      navigate(`/story/${storyId}`);
    } catch (error) {
      console.error('Помилка створення історії:', error);
      // api interceptor throws Error with message when server returns error
      // prefer descriptive server message when available
      const errorMessage = error.response?.data?.message || error.message || 'Не вдалося створити історію. Спробуйте ще раз.';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return null; // Або можна показати LoadingSpinner
  }

  return (
    <div className="generator">
      <motion.div
        className="generator-content"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="generator-header">
          <h1>
            <FaMagic className="header-icon" />
            Створити нову історію
          </h1>
          <p>Налаштуйте параметри вашої унікальної інтерактивної історії</p>
        </div>

        <form onSubmit={handleSubmit} className="generator-form">
            <div className="form-group">
              <label htmlFor="title">Назва історії</label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Наприклад: Подорож у невідоме"
                required
              />
            </div>

            <div className="form-group">
              <label>Оберіть жанр</label>
              <div className="genre-grid">
                {genres.map((genre) => (
                  <label
                    key={genre.value}
                    className={`genre-card ${formData.genre === genre.value ? 'active' : ''}`}
                  >
                    <input
                      type="radio"
                      name="genre"
                      value={genre.value}
                      checked={formData.genre === genre.value}
                      onChange={handleChange}
                    />
                    <span className="genre-emoji">{genre.emoji}</span>
                    <span className="genre-label">{genre.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="setting">Сеттінг / Світ</label>
              <input
                type="text"
                id="setting"
                name="setting"
                value={formData.setting}
                onChange={handleChange}
                placeholder="Наприклад: Середньовічне королівство, космічна станція, сучасне місто"
                required
              />
              <small>Опишіть світ, в якому розгортається історія</small>
            </div>

            <div className="form-group">
              <label htmlFor="mainCharacter">Головний персонаж</label>
              <input
                type="text"
                id="mainCharacter"
                name="mainCharacter"
                value={formData.mainCharacter}
                onChange={handleChange}
                placeholder="Наприклад: Молодий чарівник, космічний дослідник, детектив"
                required
              />
              <small>Опишіть головного героя історії</small>
            </div>

            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  name="isPublic"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                />
                <span>Зробити історію публічною</span>
              </label>
              <small>Публічні історії можуть бачити інші користувачі</small>
            </div>

            <button
              type="submit"
              className="btn btn-generate"
              disabled={loading}
            >
              {loading ? (
                <>
                  <FaSpinner className="spinner" />
                  Генерую історію...
                </>
              ) : (
                <>
                  <FaMagic />
                  Згенерувати історію
                </>
              )}
            </button>
          </form>
        </motion.div>
    </div>
  );
};

export default Generator;
