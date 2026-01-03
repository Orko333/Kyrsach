import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBook, FaTrash, FaPlay, FaSearch, FaHeart, FaEye, FaUser } from 'react-icons/fa';
import { motion } from 'framer-motion';
import { storyAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import './Library.css';

const Library = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stories, setStories] = useState([]);
  const [filteredStories, setFilteredStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGenre, setFilterGenre] = useState('all');

  useEffect(() => {
    loadStories();
  }, []);

  useEffect(() => {
    // compute filtered stories when dependencies change
    let filtered = [...stories];
    if (searchTerm) {
      filtered = filtered.filter(story =>
        story.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filterGenre !== 'all') {
      filtered = filtered.filter(story => story.genre === filterGenre);
    }
    setFilteredStories(filtered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stories, searchTerm, filterGenre]);

  const loadStories = async () => {
    try {
      const response = await storyAPI.getAll();
      const storiesData = response.data.stories || response.data;
      setStories(storiesData);
      setFilteredStories(storiesData);
      setLoading(false);
    } catch (error) {
      console.error('Помилка завантаження історій:', error);
      setLoading(false);
    }
  };

  // function replaced by the useEffect above

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (window.confirm('Ви впевнені, що хочете видалити цю історію?')) {
      try {
        await storyAPI.delete(id);
        setStories(stories.filter(story => story._id !== id));
      } catch (error) {
        console.error('Помилка видалення історії:', error);
        alert('Не вдалося видалити історію');
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('uk-UA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <LoadingSpinner message="Завантаження бібліотеки..." />
      </div>
    );
  }

  const genres = ['all', 'фентезі', 'фантастика', 'детектив', 'жахи', 'пригоди', 'романтика', 'містика', 'кіберпанк', 'апокаліпсис', 'стімпанк', 'трилер', 'історичний', 'комедія', 'драма', 'noir', 'космоопера'];

  return (
    <div className="library">
      <div className="container">
        <motion.div
          className="library-header"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1>
            <FaBook className="header-icon" />
            Ваша бібліотека історій
          </h1>
          <p>Продовжуйте свої пригоди або почніть нові</p>
        </motion.div>

        {stories.length > 0 && (
          <motion.div
            className="library-filters"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="search-box">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Пошук історій..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="genre-filter">
              {genres.map(genre => (
                <button
                  key={genre}
                  className={`filter-btn ${filterGenre === genre ? 'active' : ''}`}
                  onClick={() => setFilterGenre(genre)}
                >
                  {genre === 'all' ? 'Всі' : genre}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {filteredStories.length === 0 ? (
          <motion.div
            className="empty-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <FaBook className="empty-icon" />
            <h2>{searchTerm || filterGenre !== 'all' ? 'Нічого не знайдено' : 'Ваша бібліотека порожня'}</h2>
            <p>
              {searchTerm || filterGenre !== 'all' 
                ? 'Спробуйте змінити параметри пошуку' 
                : 'Створіть свою першу інтерактивну історію!'}
            </p>
            {!searchTerm && filterGenre === 'all' && (
              <button
                onClick={() => navigate('/generator')}
                className="btn btn-primary"
              >
                Створити історію
              </button>
            )}
          </motion.div>
        ) : (
          <div className="stories-grid">
            {filteredStories.map((story, index) => (
              <motion.div
                key={story._id}
                className="story-card"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -10 }}
                onClick={() => navigate(`/story/${story._id}`)}
              >
                <div className="card-header">
                  <span className="genre-badge">{story.genre}</span>
                  <button
                    onClick={(e) => handleDelete(story._id, e)}
                    className="btn-delete"
                  >
                    <FaTrash />
                  </button>
                </div>

                <h3>{story.title}</h3>

                {story.user && (
                  <div className="story-author">
                    <FaUser />
                    <span>{story.user.username}</span>
                  </div>
                )}

                <div className="card-stats">
                  <div className="stat">
                    <FaHeart />
                    <span>{story.likes?.length || 0}</span>
                  </div>
                  <div className="stat">
                    <FaEye />
                    <span>{story.views || 0}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Розділів:</span>
                    <span className="stat-value">{story.nodes.length}</span>
                  </div>
                </div>

                <div className="card-footer">
                  <span className="date">{formatDate(story.updatedAt)}</span>
                  <button className="btn-play">
                    <FaPlay />
                    Продовжити
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Library;
