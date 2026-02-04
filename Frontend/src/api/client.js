import axios from 'axios';

const client = axios.create({
  baseURL: '/api', // Proxied by Vite
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add Auth Token to Requests
client.interceptors.request.use((config) => {
  const storedUser = localStorage.getItem('sidera_user');
  if (storedUser) {
    const user = JSON.parse(storedUser);
    if (user.token) {
      config.headers.Authorization = `Bearer ${user.token}`;
    }
  }
  return config;
});

// Handle 401 & 403 (Token Expired/Invalid)
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.warn("[API] Session expired. Logging out...");
      localStorage.removeItem('sidera_user');
      // Force reload to reset state (simple logout)
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default client;
