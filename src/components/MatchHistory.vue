<template>
  <div class="match-history-container">
    <div class="header">
      <h2>战绩历史</h2>
      <div class="search-bar">
        <input 
          v-model="summonerName" 
          @keyup.enter="fetchMatches" 
          placeholder="输入召唤师名字..." 
          class="search-input"
        />
        <button @click="fetchMatches" :disabled="loading" class="search-btn">
          {{ loading ? '加载中...' : '查询' }}
        </button>
      </div>
      <div class="filters">
        <select v-model="selectedGameMode" @change="fetchMatches">
            <option value="">所有模式</option>
            <option value="ARAM">极地大乱斗</option>
            <option value="CLASSIC">召唤师峡谷</option> 
        </select>
      </div>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="matches.length > 0" class="match-list">
      <div v-for="match in matches" :key="match.MatchId" class="match-card" :class="{ 'win': match.Win, 'loss': !match.Win }">
        <div class="match-info">
          <div class="game-meta">
            <span class="mode">{{ match.GameMode }}</span>
            <span class="date">{{ formatDate(match.GameDate) }}</span>
            <span class="duration">{{ formatDuration(match.GameDuration) }}</span>
            <span class="result" :class="{ 'win-text': match.Win, 'loss-text': !match.Win }">
              {{ match.Win ? '胜利' : '失败' }}
            </span>
          </div>
          
          <div class="champion-info">
             <div class="champion-icon-wrapper">
                <img :src="getChampionIcon(match.ChampionName)" :alt="match.ChampionName" class="champion-icon" />
                <div class="level-badge" v-if="match.ChampLevel">{{ match.ChampLevel }}</div>
             </div>
             <span class="champion-name">{{ match.ChampionName }}</span>
          </div>

          <div class="kda-stats">
            <div class="kda">
              <span>{{ match.Kills }}</span> / <span class="deaths">{{ match.Deaths }}</span> / <span>{{ match.Assists }}</span>
            </div>
            <div class="kda-ratio">
              {{ calculateKDA(match.Kills, match.Deaths, match.Assists) }} KDA
            </div>
          </div>

          <div class="items-list">
             <img 
               v-for="(itemId, index) in parseItemIds(match.ItemIds)" 
               :key="index" 
               :src="getItemIcon(itemId)" 
               class="item-icon" 
               :alt="itemId"
               @error="$event.target.style.display='none'"
             />
          </div>
        </div>
      </div>
       
      <div class="pagination">
          <button :disabled="page <= 1" @click="changePage(page - 1)">上一页</button>
          <span>第 {{ page }} 页 / 共 {{ totalPages }} 页</span>
          <button :disabled="page >= totalPages" @click="changePage(page + 1)">下一页</button>
      </div>

    </div>
    <div v-else-if="!loading && hasSearched" class="no-data">
        没有找到该召唤师的战绩。
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api';

const summonerName = ref('');
const matches = ref([]);
const loading = ref(false);
const error = ref(null);
const page = ref(1);
const totalPages = ref(1);
const pageSize = ref(10);
const selectedGameMode = ref('');
const gameVersion = ref('13.24.1'); // 默认版本，最好动态获取
const hasSearched = ref(false);

const fetchMatches = async () => {
    if (!summonerName.value) return;
    
    loading.value = true;
    error.value = null;
    hasSearched.value = true;

    try {
        const response = await api.getMatchHistory(summonerName.value, page.value, pageSize.value, selectedGameMode.value);
        // 根据新的后端API文档，响应结构是 { matches: [], totalPages: 10, ... }
        // 假设后端直接返回数据对象
        const data = response.data;
        matches.value = data.matches || [];
        totalPages.value = data.totalPages || 1;
        
        // 如果有第一条数据，可以用它的版本号
        if (matches.value.length > 0 && matches.value[0].GameVersion) {
            gameVersion.value = matches.value[0].GameVersion;
        }

    } catch (err) {
        console.error("Error fetching matches:", err);
        error.value = "获取战绩失败，请检查后端服务是否启动。";
        matches.value = [];
    } finally {
        loading.value = false;
    }
};

const changePage = (newPage) => {
    page.value = newPage;
    fetchMatches();
};

const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    // 简单格式化 MM-DD HH:mm
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

const formatDuration = (durationString) => {
    // 假设是 TimeSpan "00:25:30" 
    if (!durationString) return '';
    const parts = durationString.split(':');
    if (parts.length >= 2) {
        return `${parts[1]}分${parts[0] !== '00' ? parts[0] + '时' : ''}`; // 简单处理
    }
    return durationString;
};

const calculateKDA = (k, d, a) => {
    if (d === 0) return 'Perfect';
    return ((k + a) / d).toFixed(2);
};

// Data Dragon Helpers
const getChampionIcon = (championName) => {
    // 某些英雄名字可能有特殊字符，需要处理，这里暂时直接用
    if(!championName) return '';
    return `https://ddragon.leagueoflegends.com/cdn/${gameVersion.value}/img/champion/${championName}.png`;
};

const getItemIcon = (itemId) => {
    if (!itemId || itemId === '0') return ''; 
    return `https://ddragon.leagueoflegends.com/cdn/${gameVersion.value}/img/item/${itemId}.png`;
};

const parseItemIds = (itemIdsStr) => {
    if (!itemIdsStr) return [];
    return itemIdsStr.split(',').filter(id => id && id !== '0');
}

onMounted(async () => {
    // 可选：获取最新版本号
    try {
        const vRes = await api.getVersions();
        if (vRes.data && vRes.data.length > 0) {
            gameVersion.value = vRes.data[0];
        }
    } catch (e) {
        console.warn("Could not fetch ddragon versions, using default.");
    }
});
</script>

<style scoped>
.match-history-container {
    color: #e0e0e0;
    max-width: 800px;
    margin: 0 auto;
}

.header {
    margin-bottom: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: center;
}

.search-bar {
    display: flex;
    gap: 10px;
    width: 100%;
    max-width: 500px;
}

.search-input {
    flex: 1;
    padding: 10px 15px;
    border-radius: 8px;
    border: 1px solid #444;
    background: #2a2a2a;
    color: #fff;
    font-size: 1rem;
}

.search-btn {
    padding: 10px 20px;
    background: #00bcd4; /* Cyan accent */
    color: #000;
    border: none;
    font-weight: bold;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;
}

.search-btn:hover {
    background: #00acc1;
}
.search-btn:disabled {
    background: #555;
    cursor: not-allowed;
}

.match-list {
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.match-card {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    padding: 15px;
    display: flex;
    align-items: center;
    border-left: 6px solid #666;
    transition: transform 0.2s, background 0.2s;
}

.match-card:hover {
    transform: translateY(-2px);
    background: rgba(255, 255, 255, 0.08);
}

.match-card.win {
    border-left-color: #4caf50; /* Green */
    background: linear-gradient(90deg, rgba(76, 175, 80, 0.1) 0%, rgba(0,0,0,0) 100%);
}

.match-card.loss {
    border-left-color: #f44336; /* Red */
    background: linear-gradient(90deg, rgba(244, 67, 54, 0.1) 0%, rgba(0,0,0,0) 100%);
}

.match-info {
    display: grid;
    grid-template-columns: 100px 1fr 120px 1fr;
    align-items: center;
    width: 100%;
    gap: 15px;
}

.game-meta {
    display: flex;
    flex-direction: column;
    font-size: 0.85rem;
    color: #aaa;
}

.mode {
    font-weight: bold;
    color: #fff;
    margin-bottom: 4px;
}

.win-text { color: #4caf50; font-weight: bold; }
.loss-text { color: #f44336; font-weight: bold; }

.champion-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
}

.champion-icon-wrapper {
    position: relative;
    width: 48px;
    height: 48px;
}

.champion-icon {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    border: 2px solid #333;
}

.champion-name {
    font-size: 0.9rem;
}

.kda-stats {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.kda {
    font-size: 1.1rem;
    font-weight: bold;
}
.kda .deaths { color: #f44336; }

.kda-ratio {
    font-size: 0.8rem;
    color: #888;
}

.items-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    max-width: 150px;
}

.item-icon {
    width: 32px;
    height: 32px;
    border-radius: 4px;
    background: #111;
}

.pagination {
    margin-top: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 15px;
}

.no-data {
    margin-top: 2rem;
    color: #888;
    font-style: italic;
}

@media (max-width: 600px) {
    .match-info {
        grid-template-columns: 1fr;
        text-align: center;
    }
    .items-list {
        justify-content: center;
    }
}
</style>
