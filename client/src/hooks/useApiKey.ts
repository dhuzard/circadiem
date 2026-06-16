import { useEffect, useState } from "react";
import { STORAGE_KEY } from "../lib/constants";

export function useApiKey() {
  const [apiKey, setApiKey] = useState("");
  const [rememberKey, setRememberKey] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setApiKey(saved);
        setRememberKey(true);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  useEffect(() => {
    try {
      if (rememberKey && apiKey) {
        window.localStorage.setItem(STORAGE_KEY, apiKey);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // localStorage unavailable
    }
  }, [apiKey, rememberKey]);

  return { apiKey, setApiKey, rememberKey, setRememberKey };
}
