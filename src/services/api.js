import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://aiapi.369900.xyz/api/lol',
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

  // 获取单局详情 (10人数据)
  getMatchDetails(matchId) {
    return apiClient.get(`/match/${matchId}`);
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
