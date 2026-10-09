import { defineStore } from 'pinia';
import { api } from '../api';

export const useAuth = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    user: JSON.parse(localStorage.getItem('user') || 'null'),
  }),
  getters: {
    logged: (s) => !!s.token,
    isAdmin: (s) => s.user?.rol === 'admin',
  },
  actions: {
    async login(usuario, password) {
      const { data } = await api.post('/auth/login', { usuario, password });
      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    },
    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
  },
});
