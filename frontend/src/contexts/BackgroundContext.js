import React, { createContext, useState, useCallback, useEffect, useContext } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

export const BackgroundContext = createContext();

export const BackgroundProvider = ({ children }) => {
  const [backgroundImage, setBackgroundImage] = useState(null);
  const { user, isAuthenticated } = useAuth();

  const updateBackground = useCallback(async (imageUrl) => {
    setBackgroundImage(imageUrl);

    // If user is authenticated, persist background on server
    try {
      if (isAuthenticated) {
        await api.put('/auth/background', { backgroundImage: imageUrl });
      }
    } catch (err) {
      // Non-critical: print warning but keep local state
      console.warn('Failed to persist background:', err.message || err);
    }
  }, [isAuthenticated]);

  const clearBackground = useCallback(async () => {
    setBackgroundImage(null);
    try {
      if (isAuthenticated) {
        await api.put('/auth/background', { backgroundImage: null });
      }
    } catch (err) {
      console.warn('Failed to clear background:', err.message || err);
    }
  }, [isAuthenticated]);

  const value = {
    backgroundImage,
    updateBackground,
    clearBackground
  };
  // Initialize background when user or context mounts
  useEffect(() => {
    const init = async () => {
      if (isAuthenticated) {
        // 1) If user has saved background, use it
        if (user && user.backgroundImage) {
          setBackgroundImage(user.backgroundImage);
          return;
        }

        // 2) Try to find the user's latest generated image across their stories
        try {
          const { data } = await api.get('/stories/my/stories', { params: { page: 1, limit: 10 } });
          const stories = data?.stories || [];
          let latestImage = null;
          for (const story of stories) {
            if (!Array.isArray(story.nodes)) continue;
            // Check from the end to get the latest node image in this story
            for (let i = story.nodes.length - 1; i >= 0; i--) {
              const node = story.nodes[i];
              if (node?.imageUrl) {
                latestImage = node.imageUrl;
                break;
              }
            }
            if (latestImage) break; // Found most recent among sorted stories
          }

          if (latestImage) {
            setBackgroundImage(latestImage);
            // Persist on server for future sessions
            try {
              await api.put('/auth/background', { backgroundImage: latestImage });
            } catch (err) {
              console.warn('Failed to persist derived background:', err.message || err);
            }
            return;
          }
        } catch (err) {
          console.warn('Failed to fetch user stories for background:', err.message || err);
        }
      }

      // 3) Fallback: random image from any public story
      try {
        const response = await api.get('/images/random');
        if (response.data?.imageUrl) {
          setBackgroundImage(response.data.imageUrl);
        }
      } catch (err) {
        // ignore if not found, just don't set background
        console.warn('No fallback background found:', err.message || err);
      }
    };

    init();
  }, [isAuthenticated, user]);

  return (
    <BackgroundContext.Provider value={value}>
      {children}
    </BackgroundContext.Provider>
  );
};
// exported private hook removed - initialization logic moved into provider
