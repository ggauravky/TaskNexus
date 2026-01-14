import axios from "axios";
import { API_URL, LOCAL_STORAGE_KEYS } from "../utils/constants";

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Important for cookies
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If token expired and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh token
        const response = await axios.post(
          `${API_URL}/auth/refresh`,
          {},
          {
            withCredentials: true,
          }
        );

        const { accessToken } = response.data.data;
        localStorage.setItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN, accessToken);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        localStorage.removeItem(LOCAL_STORAGE_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(LOCAL_STORAGE_KEYS.USER);
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
