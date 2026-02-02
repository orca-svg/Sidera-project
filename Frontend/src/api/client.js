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

export default client;
