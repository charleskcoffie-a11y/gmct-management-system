import React, { useState, useEffect } from 'react';

// This hook is now the single source of truth for data sanitization.
// It sanitizes on initial load AND on every subsequent write.
export function useLocalStorage<T,>(
  key: string,
  initialValue: T,
  sanitizer?: (data: any) => T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      if (typeof window === 'undefined') {
        return initialValue;
      }
      const item = window.localStorage.getItem(key);
      if (!item) return initialValue;

      const parsedItem = JSON.parse(item);
      // Sanitize the data on load, before it ever gets into app state.
      return sanitizer ? sanitizer(parsedItem) : parsedItem;
    } catch (error) {
      console.error('Error reading or sanitizing from localStorage', key, error);
      return initialValue;
    }
  });

  // This custom setter function is the core of the fix.
  // It intercepts every state update, sanitizes the new value, and then sets the state.
  const setValue: React.Dispatch<React.SetStateAction<T>> = (value) => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Sanitize the new value BEFORE it gets into state or written to localStorage.
      const sanitizedValue = sanitizer ? sanitizer(valueToStore) : valueToStore;
      
      setStoredValue(sanitizedValue);

    } catch (error) {
      console.error(`Error setting and sanitizing localStorage key "${key}"`, error);
    }
  };


  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        // The value being stored here (`storedValue`) has already been sanitized by our custom `setValue`.
        window.localStorage.setItem(key, JSON.stringify(storedValue));
      }
    } catch (error) {
      console.error('Error writing to localStorage', error);
    }
  }, [key, storedValue]);

  return [storedValue, setValue];
}