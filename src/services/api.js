import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to inject the token
apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, error => {
  return Promise.reject(error);
});

// Add a response interceptor to handle 401 Unauthorized and 403 Forbidden
apiClient.interceptors.response.use(response => {
  return response;
}, error => {
  if (error.response && (error.response.status === 401 || error.response.status === 403)) {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    // Dispatch a custom event so the UI can react (e.g., show login modal)
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
  }
  return Promise.reject(error);
});

export default {
  // 获取战绩历史
  getMatchHistory(summonerName, page = 1, pageSize = 10, gameMode = '') {
    const params = {
      summonerName,
      page,
      pageSize,
    };
    if (gameMode) {
      params.gameMode = gameMode;
    }
    return apiClient.get('/lol/history', { params });
  },

  // 获取单局详情 (10人数据)
  getMatchDetails(matchId) {
    return apiClient.get(`/lol/match/${matchId}`);
  },

  // 获取 Data Dragon 版本 (可选，用于获取最新版本号)
  getVersions() {
    return axios.get('https://ddragon.leagueoflegends.com/api/versions.json');
  },

  // 获取 Data Dragon 英雄数据
  getChampionData(version, lang = 'zh_CN') {
    return axios.get(`https://ddragon.leagueoflegends.com/cdn/${version}/data/${lang}/champion.json`);
  },

  // 获取 Data Dragon 装备数据
  getItemData(version, lang = 'zh_CN') {
    return axios.get(`https://ddragon.leagueoflegends.com/cdn/${version}/data/${lang}/item.json`);
  },

  // 用户登录
  async login(data) {
    const response = await apiClient.post('/user/login', data);
    // 兼容不同的后端返回结构: { token: '...' } 或 { data: { token: '...' } }
    const token = response.data?.token || response.data?.data?.token;
    if (token) {
        localStorage.setItem('token', token);
    }
    return response;
  }
};
