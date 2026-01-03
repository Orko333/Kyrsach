import { useEffect, useCallback, useRef, useState } from 'react';

/**
 * Custom hook для автозбереження даних
 * @param {*} data - Дані для збереження
 * @param {string} key - Ключ localStorage
 * @param {number} delay - Затримка автозбереження в мс (за замовчуванням 2000)
 */
export const useAutosave = (data, key, delay = 2000) => {
  const timeoutRef = useRef(null);

  useEffect(() => {
    // Очищаємо попередній таймер
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Встановлюємо новий таймер
    timeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(data));
        console.log(`Autosaved to ${key}`);
      } catch (error) {
        console.error('Autosave error:', error);
      }
    }, delay);

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, key, delay]);

  // Функція для очищення збережених даних
  const clearSaved = useCallback(() => {
    localStorage.removeItem(key);
  }, [key]);

  // Функція для завантаження збережених даних
  const loadSaved = useCallback(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error('Load error:', error);
      return null;
    }
  }, [key]);

  return { clearSaved, loadSaved };
};

/**
 * Custom hook для keyboard shortcuts
 * @param {Object} shortcuts - Об'єкт з комбінаціями клавіш та callback функціями
 * Приклад: { 'ctrl+s': () => save(), 'ctrl+shift+n': () => newStory() }
 */
export const useKeyboardShortcuts = (shortcuts) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Створюємо комбінацію клавіш
      const keys = [];
      if (event.ctrlKey) keys.push('ctrl');
      if (event.shiftKey) keys.push('shift');
      if (event.altKey) keys.push('alt');
      if (event.metaKey) keys.push('meta');
      
      // Додаємо основну клавішу (lowercase)
      if (event.key && event.key.length === 1) {
        keys.push(event.key.toLowerCase());
      } else if (event.key) {
        keys.push(event.key);
      }

      const combination = keys.join('+');

      // Перевіряємо чи є обробник для цієї комбінації
      if (shortcuts[combination]) {
        event.preventDefault();
        shortcuts[combination](event);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts]);
};

/**
 * Custom hook для debounce значення
 */
export const useDebounce = (value, delay = 500) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

/**
 * Custom hook для відстеження попередніх значень
 */
export const usePrevious = (value) => {
  const ref = useRef();
  
  useEffect(() => {
    ref.current = value;
  }, [value]);
  
  return ref.current;
};
