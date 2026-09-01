import axios from "axios";
import { API_URL } from "../utils/constants";

const AUTH_ENDPOINTS = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout"];

const isAuthEndpoint = (url = "") =>
  AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));

let isRefreshing = false;
let queuedRequests = [];
let accessToken = null;

export const getAccessToken = () => accessToken;
export const setAccessToken = (token) => {
  accessToken = token || null;
};
export const clearAccessToken = () => {
  accessToken = null;
};

const flushQueue = (error, accessToken) => {
  queuedRequests.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
      return;
    }
    resolve(accessToken);
  });
  queuedRequests = [];
};

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (!originalRequest || status !== 401) {
      return Promise.reject(error);
    }

    if (originalRequest._retry || isAuthEndpoint(originalRequest.url)) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        queuedRequests.push({ resolve, reject });
      }).then((accessToken) => {
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const response = await api.post("/auth/refresh");
      const accessToken = response.data?.data?.accessToken;

      if (!accessToken) {
        throw new Error("Access token missing from refresh response");
      }

      setAccessToken(accessToken);
      flushQueue(null, accessToken);

      originalRequest.headers = originalRequest.headers || {};
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    } catch (refreshError) {
      flushQueue(refreshError, null);
      clearAccessToken();

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("tasknexus:auth-expired"));
      }

      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
