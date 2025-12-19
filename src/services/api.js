import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api/lol', // 使用相对路径，触发 Vite 代理
  headers: {
    'Content-Type': 'application/json',
  },
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
    return apiClient.get('/history', { params });
  },

  // 获取 Data Dragon 版本 (可选，用于获取最新版本号)
  getVersions() {
    return axios.get('https://ddragon.leagueoflegends.com/api/versions.json');
  },

  // 获取 Data Dragon 英雄数据
  getChampionData(version, lang = 'en_US') {
    return axios.get(`https://ddragon.leagueoflegends.com/cdn/${version}/data/${lang}/champion.json`);
  }
};
