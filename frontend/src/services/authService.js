import api from "./api";

/**
 * Authentication Service
 */
const authService = {
  /**
   * Register new user
   */
  register: async (userData) => {
    const response = await api.post("/auth/register", userData);
    return response.data;
  },

  /**
   * Login user
   */
  login: async (credentials) => {
    const response = await api.post("/auth/login", credentials);
    return response.data;
  },

  /**
   * Logout user
   */
  logout: async () => {
    const response = await api.post("/auth/logout");
    return response.data;
  },

  /**
   * Get current user
   */
  getCurrentUser: async () => {
    const response = await api.get("/auth/me");
    return response.data;
  },

  /**
   * Refresh access token
   */
  refreshToken: async () => {
    const response = await api.post("/auth/refresh");
    return response.data;
  },
};

export default authService;
