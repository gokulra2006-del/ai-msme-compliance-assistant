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

// WORKFLOW ENDPOINTS
const WORKFLOW_API_URL = 'http://localhost:5000/api/workflow';

export const getBusinessUsers = async (token: string) => {
  return axios.get(`http://localhost:5000/api/business/users`, { headers: { Authorization: `Bearer ${token}` } });
};

export const assignAction = async (id: string, assignedTo: string, token: string, note?: string) => {
  return axios.post(`${WORKFLOW_API_URL}/action/${id}/assign`, { assignedTo, note }, { headers: { Authorization: `Bearer ${token}` } });
};

export const submitActionReview = async (id: string, token: string, note?: string) => {
  return axios.post(`${WORKFLOW_API_URL}/action/${id}/submit`, { note }, { headers: { Authorization: `Bearer ${token}` } });
};

export const approveAction = async (id: string, token: string, note?: string) => {
  return axios.post(`${WORKFLOW_API_URL}/action/${id}/approve`, { note }, { headers: { Authorization: `Bearer ${token}` } });
};

export const rejectAction = async (id: string, reason: string, token: string) => {
  return axios.post(`${WORKFLOW_API_URL}/action/${id}/reject`, { reason }, { headers: { Authorization: `Bearer ${token}` } });
};
