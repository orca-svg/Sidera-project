import axios from 'axios';

const client = axios.create({
  baseURL: '/api', // Proxied by Vite
  headers: {
    'Content-Type': 'application/json',
  },
});

export default client;
