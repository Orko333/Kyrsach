import React, { Suspense, lazy, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { BackgroundProvider, BackgroundContext } from './contexts/BackgroundContext';
import { ProgressProvider } from './contexts/ProgressContext';
import Navbar from './components/Navbar/Navbar';
import ErrorBoundary from './components/ErrorBoundary/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner/LoadingSpinner';
import './App.css';

// Lazy loading для оптимізації
const Home = lazy(() => import('./pages/Home/Home'));
const Generator = lazy(() => import('./pages/Generator/Generator'));
const StoryPlayer = lazy(() => import('./pages/StoryPlayer/StoryPlayer'));
const Library = lazy(() => import('./pages/Library/Library'));
const Login = lazy(() => import('./pages/Auth/Login'));
const Register = lazy(() => import('./pages/Auth/Register'));

function AppContent() {
  const { backgroundImage } = useContext(BackgroundContext);

  return (
    <div className="App" style={backgroundImage ? {
      backgroundImage: `url('${backgroundImage}')`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      backgroundRepeat: 'no-repeat'
    } : {}}>
      <Navbar />
      <Suspense fallback={
        <div className="page-loader">
          <LoadingSpinner message="Завантаження сторінки..." />
        </div>
      }>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/generator" element={<Generator />} />
          <Route path="/story/:id" element={<StoryPlayer />} />
          <Route path="/library" element={<Library />} />
        </Routes>
      </Suspense>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <BackgroundProvider>
            <ProgressProvider>
              <AppContent />
            </ProgressProvider>
          </BackgroundProvider>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
