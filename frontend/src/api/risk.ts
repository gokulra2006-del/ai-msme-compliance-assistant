import axios from 'axios';

const API_URL = 'http://localhost:5000/api/risk';

export const getRiskScore = async (token: string) => {
  return axios.get(`${API_URL}/score`, { headers: { Authorization: `Bearer ${token}` } });
};
