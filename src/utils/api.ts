// 'use server';
import axios from 'axios';
const api = axios.create({
  baseURL: '/api/livepeer',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
