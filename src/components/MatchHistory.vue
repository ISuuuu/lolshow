<template>
  <div class="match-history-container">
    <div class="header">
      <h2>战绩历史</h2>
      <div class="search-bar-wrapper">
        <div class="search-bar">
          <input 
            v-model="summonerName" 
            @keyup.enter="fetchMatches" 
            @focus="showHistory = true"
            @blur="hideHistoryDelayed"
            placeholder="输入召唤师名字..." 
            class="search-input"
          />
          <button @click="fetchMatches" :disabled="loading" class="search-btn">
            {{ loading ? '加载中...' : '查询' }}
          </button>
        </div>
        
        <!-- Search History Dropdown -->
        <div v-if="showHistory && searchHistory.length > 0" class="search-history-dropdown">
            <div v-for="(name, index) in searchHistory" :key="index" class="history-item">
                <span class="history-name" @click="selectHistory(name)">{{ name }}</span>
                <span class="delete-btn" @click.stop="deleteHistory(index)">×</span>
            </div>
        </div>
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
      <div v-for="match in matches" :key="match.MatchId || match.matchId" class="match-card" :class="{ 'win': isWin(match), 'loss': !isWin(match) }">
        <div class="match-info">
          <div class="game-meta">
            <span class="mode">{{ match.GameMode ?? match.gameMode }}</span>
            <span class="date">{{ formatDate(match.GameDate ?? match.gameDate) }}</span>
            <span class="duration">{{ formatDuration(match.GameDuration ?? match.gameDuration) }}</span>
            <span class="result" :class="{ 'win-text': isWin(match), 'loss-text': !isWin(match) }">
              {{ isWin(match) ? '胜利' : '失败' }}
            </span>
          </div>
          
          <div class="champion-info">
             <div class="champion-icon-wrapper">
                <img :src="getChampionIcon(match)" :alt="match.ChampionName || match.championName" class="champion-icon" />
                <div class="level-badge" v-if="match.ChampLevel || match.champLevel">{{ match.ChampLevel || match.champLevel }}</div>
             </div>
             <span class="champion-name">{{ match.ChampionName || match.championName }}</span>
          </div>

          <div class="kda-stats">
            <div class="kda">
              <span>{{ match.Kills ?? match.kills }}</span> / 
              <span class="deaths">{{ match.Deaths ?? match.deaths }}</span> / 
              <span>{{ match.Assists ?? match.assists }}</span>
            </div>
            <div class="kda-ratio">
              {{ calculateKDA(match) }} KDA
            </div>
          </div>

          <div class="items-list">
             <img 
               v-for="(itemId, index) in parseItemIds(match)" 
               :key="index" 
               :src="getItemIcon(itemId)" 
               class="item-icon" 
               :alt="itemId"
               @error="handleImgError"
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
const gameVersion = ref('14.23.1'); // 更新默认版本
const championMap = ref({});

const hasSearched = ref(false);

// Search History Logic
const searchHistory = ref(JSON.parse(localStorage.getItem('lol_search_history') || '[]'));
const showHistory = ref(false);

const saveHistory = (name) => {
    if (!name) return;
    const history = searchHistory.value.filter(n => n !== name); // Remove duplicate if exists
    history.unshift(name); // Add to beginning
    if (history.length > 10) history.pop(); // Keep max 10
    searchHistory.value = history;
    localStorage.setItem('lol_search_history', JSON.stringify(history));
};

const deleteHistory = (index) => {
    searchHistory.value.splice(index, 1);
    localStorage.setItem('lol_search_history', JSON.stringify(searchHistory.value));
};

const selectHistory = (name) => {
    summonerName.value = name;
    showHistory.value = false;
    fetchMatches();
};

const hideHistoryDelayed = () => {
    setTimeout(() => {
        showHistory.value = false;
    }, 200); // Small delay to allow click event to register
};

const fetchChampionData = async (version) => {
    try {
        console.log(`[DataDragon] Fetching champion data for version ${version}...`);
        const response = await api.getChampionData(version);
        const data = response.data.data;
        const map = {};
        let count = 0;
        for (const key in data) {
             const champ = data[key];
             // Data Dragon keys are numeric strings (e.g., "266"), values are IDs (e.g., "Aatrox")
             map[champ.key] = champ.id;
             count++;
        }
        championMap.value = map;
        console.log(`[DataDragon] Loaded champion map with ${count} entries. Example: Key '1' -> ${map['1']}`);
    } catch (e) {
        console.error("Failed to load champion data:", e);
    }
};

// ... (fetchMatches, changePage, etc. remain the same) ...
const fetchMatches = async () => {
    if (!summonerName.value) return;
    
    // Save to history before fetching
    saveHistory(summonerName.value);
    showHistory.value = false;
    
    loading.value = true;
    error.value = null;
    hasSearched.value = true;

    try {
        const response = await api.getMatchHistory(summonerName.value, page.value, pageSize.value, selectedGameMode.value);
        const data = response.data;
        matches.value = data.matches || [];
        totalPages.value = data.totalPages || 1;
        
        if (matches.value.length > 0) {
            console.log("First match data structure:", matches.value[0]);
            if (matches.value[0].GameVersion) {
                gameVersion.value = matches.value[0].GameVersion;
                console.log("Updated Data Dragon version from match data:", gameVersion.value);
            }
        }

    } catch (err) {
        console.error("Error fetching matches:", err);
         if (err.response) {
            error.value = `请求失败 (${err.response.status}): ${err.response.data?.message || err.message}`;
        } else if (err.request) {
             error.value = "请求未收到响应，请检查后端服务或网络。";
        } else {
             error.value = `发生错误: ${err.message}`;
        }
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
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

const formatDuration = (durationString) => {
    if (!durationString) return '';
    const parts = durationString.split(':');
    if (parts.length >= 2) {
        return `${parts[1]}分${parts[0] !== '00' ? parts[0] + '时' : ''}`;
    }
    return durationString;
};

const isWin = (match) => {
    const winVal = match.Win !== undefined ? match.Win : match.win;
    if (winVal === undefined) return false;
    if (typeof winVal === 'boolean') return winVal;
    if (typeof winVal === 'number') return winVal === 1;
    if (typeof winVal === 'string') return winVal.toLowerCase() === 'true' || winVal === '1';
    return false;
};

const calculateKDA = (match) => {
    const k = match.Kills ?? match.kills ?? 0;
    const d = match.Deaths ?? match.deaths ?? 0;
    const a = match.Assists ?? match.assists ?? 0;
    if (d === 0) return 'Perfect';
    return ((k + a) / d).toFixed(2);
};

// Data Dragon Helpers
const fixChampionName = (name) => {
    if (!name) return '';
    // 处理特殊情况
    switch (name) {
        case 'Wukong': return 'MonkeyKing';
        case 'FiddleSticks': return 'Fiddlesticks'; // Old API might return camelCase
        default: 
            // 移除空格和撇号 ' (e.g. Kai'Sa -> KaiSa, Lee Sin -> LeeSin)
            return name.replace(/[' ]/g, ''); 
    }
};

const getChampionIcon = (match) => {
    // 兼容旧调用方式 (如果传入的是字符串)
    if (typeof match === 'string') {
        const fixedName = fixChampionName(match);
        return fixedName ? `https://ddragon.leagueoflegends.com/cdn/${gameVersion.value}/img/champion/${fixedName}.png` : '';
    }

    // Support both PascalCase and camelCase
    const champId = match.ChampionId || match.championId;
    const champName = match.ChampionName || match.championName;

    let imageId = '';

    // 优先使用 ID 查找 (确保 champId 转为字符串比较)
    if (champId && championMap.value[String(champId)]) {
        imageId = championMap.value[String(champId)];
        // console.log(`[Icon] Found by ID: ${champId} -> ${imageId}`);
    } else {
        // 降级使用名称
        imageId = fixChampionName(champName);
        console.warn(`[Icon] ID lookup failed for ID: ${champId}, Name: ${champName}. Fallback to fixed name: ${imageId}`);
    }

    if (!imageId) return '';
    
    const url = `https://ddragon.leagueoflegends.com/cdn/${gameVersion.value}/img/champion/${imageId}.png`;
    
    // 只在首次或特定条件下打印，避免列表过长刷屏 (这里为了调试暂时全部打印，或者只打印错误的)
    console.log(`[Icon] Generated URL: ${url}`);
    
    return url;
};

const getItemIcon = (itemId) => {
    if (!itemId || itemId === '0') return ''; 
    return `https://ddragon.leagueoflegends.com/cdn/${gameVersion.value}/img/item/${itemId}.png`;
};

const parseItemIds = (match) => {
    // Check if match is null or undefined
    if (!match) return [];

    // Support both PascalCase and camelCase
    // If 'match' is just the string (legacy call), handle that too for safety
    let itemIdsStr = match.ItemIds || match.itemIds;
    if (typeof match === 'string') {
        itemIdsStr = match;
    }

    if (!itemIdsStr) return [];
    
    // Handle if it's already an array
    if (Array.isArray(itemIdsStr)) return itemIdsStr.filter(id => id && id !== 0 && id !== '0');
    
    return itemIdsStr.toString().split(',').filter(id => id && id !== '0' && id.trim() !== '');
}

const handleImgError = (e) => {
    e.target.style.display = 'none';
    console.warn(`Image failed to load: ${e.target.src}`);
};

onMounted(async () => {
    // 可选：获取最新版本号
    try {
        const vRes = await api.getVersions();
        if (vRes.data && vRes.data.length > 0) {
            gameVersion.value = vRes.data[0];
            console.log("Updated Data Dragon version to:", gameVersion.value);
        }
    } catch (e) {
        console.warn("Could not fetch ddragon versions, using default.", e);
    }
    fetchChampionData(gameVersion.value);
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

.search-bar-wrapper {
    position: relative;
    width: 100%;
    max-width: 500px;
}

.search-bar {
    display: flex;
    gap: 10px;
    width: 100%;
}

.search-history-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 0 0 8px 8px;
    z-index: 10;
    max-height: 200px;
    overflow-y: auto;
    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
}

.history-item {
    padding: 10px 15px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #333;
    cursor: pointer;
}

.history-item:last-child {
    border-bottom: none;
}

.history-item:hover {
    background: #333;
}

.history-name {
    flex: 1;
}

.delete-btn {
    color: #888;
    padding: 2px 8px;
    border-radius: 4px;
    transition: background 0.2s, color 0.2s;
}

.delete-btn:hover {
    background: #444;
    color: #f44336;
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
