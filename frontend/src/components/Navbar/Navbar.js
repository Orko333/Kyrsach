import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaBook, FaHome, FaPlusCircle, FaBookOpen, FaUser, FaSignOutAlt, FaSignInAlt, FaUserPlus } from 'react-icons/fa';
import { useContext } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useProgress } from '../../contexts/ProgressContext';
import './Navbar.css';

const Navbar = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout, isAuthenticated } = useAuth();
  const { progress } = useProgress();

  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  return (
    <nav className="navbar">
      <div className="container">
        <div className="navbar-content">
          <Link to="/" className="navbar-brand">
            <FaBook className="brand-icon" />
            <span>AI Fiction</span>
          </Link>

          <button 
            className="navbar-toggle"
            onClick={() => setIsOpen(!isOpen)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          <div className={`navbar-menu ${isOpen ? 'active' : ''}`}>
            <Link 
              to="/" 
              className={`nav-link ${isActive('/') ? 'active' : ''}`}
              onClick={() => setIsOpen(false)}
            >
              <FaHome />
              <span>Головна</span>
            </Link>
            <Link 
              to="/generator" 
              className={`nav-link ${isActive('/generator') ? 'active' : ''}`}
              onClick={() => setIsOpen(false)}
            >
              <FaPlusCircle />
              <span>Створити історію</span>
            </Link>
            <Link 
              to="/library" 
              className={`nav-link ${isActive('/library') ? 'active' : ''}`}
              onClick={() => setIsOpen(false)}
            >
              <FaBookOpen />
              <span>Бібліотека</span>
            </Link>
            
            {/* Mini progress chip shows if there is active progress */}
            {progress && progress.totalChoices > 0 && (
              <div className="nav-progress" title={`Досліджено ${progress.explored} з ${progress.totalChoices}`}>
                <div className="nav-progress-text">
                  Гілки: {progress.explored}/{progress.totalChoices}
                </div>
                <div className="nav-progress-bar">
                  <div className="nav-progress-fill" style={{ width: `${progress.percent}%` }} />
                </div>
              </div>
            )}

            {isAuthenticated ? (
              <>
                <div className="nav-user-info">
                  <FaUser />
                  <span>{user?.username}</span>
                </div>
                <button className="nav-link logout-btn" onClick={handleLogout}>
                  <FaSignOutAlt />
                  <span>Вийти</span>
                </button>
              </>
            ) : (
              <>
                <Link 
                  to="/login" 
                  className={`nav-link ${isActive('/login') ? 'active' : ''}`}
                  onClick={() => setIsOpen(false)}
                >
                  <FaSignInAlt />
                  <span>Вхід</span>
                </Link>
                <Link 
                  to="/register" 
                  className={`nav-link register-btn ${isActive('/register') ? 'active' : ''}`}
                  onClick={() => setIsOpen(false)}
                >
                  <FaUserPlus />
                  <span>Реєстрація</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
