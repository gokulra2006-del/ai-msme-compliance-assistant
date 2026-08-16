import axios from 'axios';

const API_URL = 'http://localhost:5000/api/compliance-actions';

export const syncActions = async (token: string) => {
  return axios.post(`${API_URL}/sync`, {}, { headers: { Authorization: `Bearer ${token}` } });
};

export const getActions = async (token: string, params: any = {}) => {
  return axios.get(API_URL, { params, headers: { Authorization: `Bearer ${token}` } });
};

export const getDashboardSummary = async (token: string) => {
  return axios.get(`${API_URL}/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
};

export const markCompleted = async (id: string, token: string) => {
  return axios.put(`${API_URL}/${id}/complete`, {}, { headers: { Authorization: `Bearer ${token}` } });
};

export const reopenAction = async (id: string, token: string) => {
  return axios.put(`${API_URL}/${id}/reopen`, {}, { headers: { Authorization: `Bearer ${token}` } });
};
