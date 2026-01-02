<template>
  <div class="match-history-container">
    <div class="header">
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
          <select v-model="selectedGameMode" @change="fetchMatches" class="mode-select">
            <option value="">所有模式</option>
            <option value="ARAM">极地大乱斗</option>
            <option value="CLASSIC">召唤师峡谷</option>
            <option value="CHERRY">斗魂竞技场</option>
            <option value="KIWI">海克斯大乱斗</option>
          </select>
        </div>
        
        <!-- Search History Dropdown -->
        <div v-if="showHistory && searchHistory.length > 0" class="search-history-dropdown">
            <div v-for="(name, index) in searchHistory" :key="index" class="history-item">
                <span class="history-name" @click="selectHistory(name)">{{ name }}</span>
                <span class="delete-btn" @click.stop="deleteHistory(index)">×</span>
            </div>
        </div>
      </div>
    </div>

    <div class="content-area" :class="{ 'has-selection': selectedMatchDetails || detailLoading }">
      <!-- Left Pane: Match List -->
      <div class="left-pane">
        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <div v-if="matches.length > 0" class="match-list">
          <div 
            v-for="match in matches" 
            :key="match.MatchId || match.matchId" 
            class="match-card" 
            :class="{ 
                'win': isWin(match), 
                'loss': !isWin(match),
                'active': selectedMatchDetails && (selectedMatchDetails.matchInfo?.matchId === (match.MatchId || match.matchId) || selectedMatchDetails.matchInfo?.MatchId === (match.MatchId || match.matchId))
            }" 
            @click="openDetails(match.MatchId || match.matchId)"
          >
            <div class="match-info">
              <div class="champion-info">
                 <div class="champion-icon-wrapper">
                    <img :src="getChampionIcon(match)" :alt="match.ChampionName || match.championName" class="champion-icon" />
                 </div>
              </div>

              <div class="game-meta">
                <span class="mode">{{ getModeName(match) }}</span>
                <span class="date">{{ formatOnlyDate(match.GameCreation ?? match.gameCreation ?? match.GameDate ?? match.gameDate) }}</span>
              </div>

              <div class="kda-stats">
                <div class="kda">
                  <span>{{ match.Kills ?? match.kills }}</span> / 
                  <span class="deaths">{{ match.Deaths ?? match.deaths }}</span> / 
                  <span>{{ match.Assists ?? match.assists }}</span>
                </div>
              </div>
            </div>
          </div>
           
          <div class="pagination">
              <button :disabled="page <= 1" @click="changePage(page - 1)">上一页</button>
              <span class="page-info">{{ page }} / {{ totalPages }}</span>
              <button :disabled="page >= totalPages" @click="changePage(page + 1)">下一页</button>
          </div>
        </div>
        <div v-else-if="!loading && hasSearched" class="no-data">
            没有找到该召唤师的战绩。
        </div>
        <div v-else-if="!hasSearched" class="initial-state">
            <div class="welcome-msg">
                <span class="icon">🔍</span>
                <p>请输入召唤师名称开始查询</p>
            </div>
        </div>
      </div>

      <!-- Right Pane: Match Details (Only shown when loading or details exist) -->
      <div v-if="detailLoading || selectedMatchDetails" class="right-pane">
        <div v-if="detailLoading" class="detail-loading-wrapper">
            <div class="spinner"></div>
            <p>正在获取详细数据...</p>
        </div>
        
        <div v-else-if="selectedMatchDetails" class="details-container">
            <div class="details-header" v-if="selectedMatchDetails.matchInfo">
               <div class="detail-item">
                   <span class="d-label">时间</span>
                   <span class="d-value">{{ formatDate(selectedMatchDetails.matchInfo.gameCreation || selectedMatchDetails.matchInfo.GameCreation) }}</span>
               </div>
               <div class="detail-item">
                   <span class="d-label">类型</span>
                   <span class="d-value">{{ getModeName(selectedMatchDetails.matchInfo) }}</span>
               </div>
               <div class="detail-item">
                   <span class="d-label">比赛时长</span>
                   <span class="d-value">{{ formatDuration(selectedMatchDetails.matchInfo.gameDuration || selectedMatchDetails.matchInfo.GameDuration) }}</span>
               </div>
               <div class="detail-item">
                   <span class="d-label">击杀</span>
                   <span class="d-value">{{ getKillScore(selectedMatchDetails) }}</span>
               </div>
            </div>

            <div class="teams-wrapper">
                <!-- Blue Team -->
                <div class="team-column blue-team">
                    <div v-for="p in getTeam(selectedMatchDetails, 100)" :key="p.SummonerName || p.summonerName" class="p-row" :class="{ 'is-me': (p.SummonerName || p.summonerName) === summonerName }">
                        <div class="p-champ">
                            <img :src="getChampionIcon(p)" class="p-icon" />
                            <div class="p-level">{{ p.ChampLevel || p.champLevel }}</div>
                        </div>
                        <div class="p-main-info">
                            <div class="p-name-wrapper">
                              <div class="p-name" @click="querySummoner(p.SummonerName || p.summonerName)" style="cursor: pointer;">{{ p.SummonerName || p.summonerName }}</div>
                              <button class="copy-btn" @click.stop="copySummonerName(p.SummonerName || p.summonerName, $event)" title="复制用户名">⎘</button>
                            </div>
                            <div class="p-kda-items">
                                <span class="kda-text">{{ p.Kills ?? p.kills }}/<span class="deaths">{{ p.Deaths ?? p.deaths }}</span>/{{ p.Assists ?? p.assists }}</span>
                                <div class="p-items-row">
                                     <img 
                                        v-for="(itemId, idx) in parseItemIds(p)" 
                                        :key="idx" 
                                        :src="getItemIcon(itemId)" 
                                        class="p-item-icon-small" 
                                        @mouseenter="showItemTooltip(itemId, $event)"
                                        @mousemove="moveTooltip($event)"
                                        @mouseleave="hideTooltip"
                                     />
                                </div>
                            </div>
                        </div>
                        <div class="p-stats-compact">
                            <div title="伤害">⚔️ {{ (p.TotalDamageDealtToChampions ?? p.totalDamageDealtToChampions)?.toLocaleString() }}</div>
                            <div title="经济">💰 {{ (p.GoldEarned ?? p.goldEarned)?.toLocaleString() }}</div>
                        </div>
                    </div>
                </div>

                <!-- Red Team -->
                <div class="team-column red-team">
                    <div v-for="p in getTeam(selectedMatchDetails, 200)" :key="p.SummonerName || p.summonerName" class="p-row" :class="{ 'is-me': (p.SummonerName || p.summonerName) === summonerName }">
                        <div class="p-champ">
                            <img :src="getChampionIcon(p)" class="p-icon" />
                            <div class="p-level">{{ p.ChampLevel || p.champLevel }}</div>
                        </div>
                        <div class="p-main-info">
                            <div class="p-name-wrapper">
                              <div class="p-name" @click="querySummoner(p.SummonerName || p.summonerName)" style="cursor: pointer;">{{ p.SummonerName || p.summonerName }}</div>
                              <button class="copy-btn" @click.stop="copySummonerName(p.SummonerName || p.summonerName, $event)" title="复制用户名">⎘</button>
                            </div>
                             <div class="p-kda-items">
                                <span class="kda-text">{{ p.Kills ?? p.kills }}/<span class="deaths">{{ p.Deaths ?? p.deaths }}</span>/{{ p.Assists ?? p.assists }}</span>
                                <div class="p-items-row">
                                     <img 
                                        v-for="(itemId, idx) in parseItemIds(p)" 
                                        :key="idx" 
                                        :src="getItemIcon(itemId)" 
                                        class="p-item-icon-small" 
                                        @mouseenter="showItemTooltip(itemId, $event)"
                                        @mousemove="moveTooltip($event)"
                                        @mouseleave="hideTooltip"
                                     />
                                </div>
                            </div>
                        </div>
                        <div class="p-stats-compact">
                            <div title="伤害">⚔️ {{ (p.TotalDamageDealtToChampions ?? p.totalDamageDealtToChampions)?.toLocaleString() }}</div>
                            <div title="经济">💰 {{ (p.GoldEarned ?? p.goldEarned)?.toLocaleString() }}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>

    <!-- Global Item Tooltip -->
    <div v-if="tooltip.show" class="item-tooltip" :style="{ top: tooltip.y + 'px', left: tooltip.x + 'px' }">
        <div class="tooltip-header" v-if="tooltip.data">
            <span class="tooltip-name">{{ tooltip.data.name }}</span>
            <span class="tooltip-gold" v-if="tooltip.data.gold">
                <span class="gold-icon">💰</span> {{ tooltip.data.gold.total }}
            </span>
        </div>
        <div class="tooltip-desc" v-if="tooltip.data" v-html="tooltip.data.description"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '../services/api';

const emit = defineEmits(['require-login', 'show-toast']);

const summonerName = ref('');
const matches = ref([]);
const loading = ref(false);
const error = ref(null);
const page = ref(1);
const lastValidPage = ref(1);
const totalPages = ref(1);
const pageSize = ref(9);
const selectedGameMode = ref('');
const gameVersion = ref('14.23.1'); // 更新默认版本
const championMap = ref({});
const itemMap = ref({});

const hasSearched = ref(false);

// Tooltip Logic
const tooltip = ref({
    show: false,
    data: null,
    x: 0,
    y: 0
});

const showItemTooltip = (itemId, event) => {
    if (!itemId || itemId === '0' || !itemMap.value[itemId]) return;
    
    const item = itemMap.value[itemId];
    tooltip.value = {
        show: true,
        data: item,
        x: event.clientX + 15,
        y: event.clientY + 15
    };
};

const moveTooltip = (event) => {
    if (!tooltip.value.show) return;
    tooltip.value.x = event.clientX + 15;
    tooltip.value.y = event.clientY + 15;
};

const hideTooltip = () => {
    tooltip.value.show = false;
};

// Match Details Logic
const selectedMatchDetails = ref(null);
const showDetails = ref(false);
const detailLoading = ref(false);

const queueMap = {
    420: '排位赛 单排/双排',
    430: '匹配模式 (盲选)',
    440: '排位赛 灵活组排',
    450: '极地大乱斗',
    490: '快速匹配',
    1700: '斗魂竞技场',
    1900: '无限火力',
    2400: '海克斯大乱斗',
};

const getModeName = (match) => {
    const qId = match.QueueId ?? match.queueId;
    if (qId && queueMap[qId]) return queueMap[qId];
    const mode = match.GameMode ?? match.gameMode;
    if (mode === 'ARAM') return '极地大乱斗';
    if (mode === 'CLASSIC') return '召唤师峡谷';
    if (mode === 'CHERRY') return '斗魂竞技场';
    if (mode === 'KIWI') return '海克斯大乱斗';
    return mode || '未知模式';
};

const getKillScore = (details) => {
    if (!details) return '0/0';
    // Find my team
    let myTeamId = 100; // default
    let parts = [];
    
    // Normalize participants list
    if (Array.isArray(details.participants)) parts = details.participants;
    else if (Array.isArray(details)) parts = details;
    else if (details.team100 && details.team200) parts = [...details.team100, ...details.team200];

    // Try to find current summoner to determine side
    if (summonerName.value) {
        const me = parts.find(p => (p.SummonerName || p.summonerName)?.toLowerCase() === summonerName.value.toLowerCase());
        if (me) {
            myTeamId = me.TeamId || me.teamId;
        }
    }

    let myKills = 0;
    let enemyKills = 0;

    parts.forEach(p => {
        const k = Number(p.Kills ?? p.kills ?? 0);
        const tId = p.TeamId ?? p.teamId;
        if (tId === myTeamId) myKills += k;
        else enemyKills += k;
    });

    return `${myKills}/${enemyKills}`;
};

const openDetails = async (matchId) => {
    if (!matchId) return;
    showDetails.value = true; // Keep for conditional rendering if needed, or just rely on selectedMatchDetails
    detailLoading.value = true;
    // Don't clear selectedMatchDetails immediately if you want to keep showing old one while loading, 
    // but better to clear to show loading state clearly
    selectedMatchDetails.value = null;

    try {
        const response = await api.getMatchDetails(matchId);
        const resData = response.data;
        selectedMatchDetails.value = resData.success ? resData.data : resData; 
    } catch (e) {
        console.error("Failed to load details", e);
        // alert("无法加载对局详情"); // Optional: less intrusive error handling
    } finally {
        detailLoading.value = false;
    }
};

const getTeam = (details, teamId) => {
    if (!details) return [];
    let list = [];
    // Case 1: details.participants is the array
    if (Array.isArray(details.participants)) {
        list = details.participants;
    } 
    // Case 2: details is the array itself
    else if (Array.isArray(details)) {
        list = details;
    }
    // Case 3: details.team100 / details.team200 (Grouped response)
    else if (details[`team${teamId}`]) {
        return details[`team${teamId}`];
    }
    
    // Filter by teamId
    return list.filter(p => p.TeamId === teamId || p.teamId === teamId);
};

const querySummoner = async (targetSummonerName) => {
  if (!targetSummonerName) return;
  
  // 设置当前查询的召唤师名称
  window.scrollTo({ top: 0, behavior: 'smooth' }); // 滚动到顶部
  
  // 重置分页和相关状态
  page.value = 1;
  summonerName.value = targetSummonerName;
  
  // 调用现有的查询函数
  await fetchMatches();
};

const copySummonerName = async (summonerName, event) => {
  if (!summonerName) return;
  
  try {
    await navigator.clipboard.writeText(summonerName);
    // 可以添加一个提示，比如临时显示“已复制”
    console.log(`已复制用户名: ${summonerName}`);
    
    // 提供一个简单的视觉反馈
    if (event && event.target) {
      const button = event.target;
      const originalText = button.textContent;
      button.textContent = '✓';
      
      setTimeout(() => {
        button.textContent = originalText;
      }, 2000);
    }
  } catch (err) {
    console.error('复制失败:', err);
    // 降级方案：使用旧的 clipboard API
    try {
      const textArea = document.createElement('textarea');
      textArea.value = summonerName;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      // 提供一个简单的视觉反馈
      if (event && event.target) {
        const button = event.target;
        const originalText = button.textContent;
        button.textContent = '✓';
        
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      }
    } catch (fallbackErr) {
      console.error('降级复制方案也失败:', fallbackErr);
    }
  }
};

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

const fetchItemData = async (version) => {
    try {
        console.log(`[DataDragon] Fetching item data for version ${version}...`);
        const response = await api.getItemData(version);
        itemMap.value = response.data.data;
        console.log(`[DataDragon] Loaded item map with ${Object.keys(itemMap.value).length} entries.`);
    } catch (e) {
        console.error("Failed to load item data:", e);
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
        const resData = response.data;
        
        // 适配新的 API 返回格式: { success: true, data: [...matches], pagination: { totalPages: ... } }
        if (resData.success !== undefined) {
             matches.value = resData.data || [];
             totalPages.value = resData.pagination?.totalPages || 1;
        } else {
             // 兼容旧格式 (backup)
             matches.value = resData.matches || resData.data || [];
             totalPages.value = resData.totalPages || 1;
        }
        
        if (matches.value.length > 0) {
            console.log("First match data structure:", matches.value[0]);
            if (matches.value[0].GameVersion) {
                gameVersion.value = matches.value[0].GameVersion;
                console.log("Updated Data Dragon version from match data:", gameVersion.value);
            }
            // Auto-select the first match details
            openDetails(matches.value[0].MatchId || matches.value[0].matchId);
        }
        
        // Update lastValidPage on success
        lastValidPage.value = page.value;

    } catch (err) {
        console.error("Error fetching matches:", err);
         if (err.response && err.response.status === 403) {
            // Revert page to last valid one
            page.value = lastValidPage.value;
            emit('show-toast', '请登录以查看更多数据。', 'warning');
            // Do NOT clear matches or set blocking error
            return; 
         }

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

const formatOnlyDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
};

const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

const formatDuration = (val) => {
    if (!val) return '';
    
    // If it's a number, treat as seconds
    if (typeof val === 'number') {
         const minutes = Math.floor(val / 60);
         const seconds = val % 60;
         return `${minutes}分${seconds}秒`;
    }

    // If it's a string
    if (typeof val === 'string') {
        if (val.includes(':')) {
             const parts = val.split(':');
             if (parts.length >= 2) {
                return `${parts[1]}分${parts[0] !== '00' ? parts[0] + '时' : ''}`;
             }
        }
        // Maybe it is a string representation of a number? "1500"
        const num = Number(val);
        if (!isNaN(num)) {
             const minutes = Math.floor(num / 60);
             const seconds = num % 60;
             return `${minutes}分${seconds}秒`;
        }
    }
    
    return val;
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
    //console.log(`[Icon] Generated URL: ${url}`);
    
    return url;
};

const getItemIcon = (itemId) => {
    if (!itemId || itemId === '0') return ''; 
    return `https://ddragon.leagueoflegends.com/cdn/${gameVersion.value}/img/item/${itemId}.png`;
};

const parseItemIds = (match) => {
    // Check if match is null or undefined
    if (!match) return [];

    // 1. Try new schema (Item0 - Item6)
    const items = [];
    for (let i = 0; i <= 6; i++) {
        const key = `Item${i}`;
        const keyLower = `item${i}`;
        const val = match[key] ?? match[keyLower];
        if (val && val !== 0 && val !== '0') {
            items.push(val);
        }
    }
    if (items.length > 0) return items;

    // 2. Fallback to old schema
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

defineExpose({
  fetchMatches
});

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
    fetchItemData(gameVersion.value);
});
</script>

<style scoped>
.match-history-container {
    color: #e0e0e0;
    max-width: 1400px;
    margin: 0 auto;
}

.header {
    margin-bottom: 1rem; /* Reduced from 2rem */
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: center;
}

.search-bar-wrapper {
    position: relative;
    width: 100%;
    max-width: 650px;
}

.search-bar {
    display: flex;
    gap: 10px;
    width: 100%;
}

.mode-select {
    padding: 10px 15px;
    border-radius: 8px;
    border: 1px solid #444;
    background: #2a2a2a;
    color: #fff;
    font-size: 1rem;
    cursor: pointer;
    outline: none;
}

.mode-select:hover {
    border-color: #666;
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
    padding: 12px 10px; /* Reduced side padding */
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
    display: flex;
    align-items: center; /* Vertically center */
    width: 100%;
    gap: 15px; /* Consistent gap between elements */
}

.game-meta {
    display: flex;
    flex-direction: column;
    font-size: 0.85rem;
    color: #aaa;
    min-width: 100px; /* Ensure minimum width for readability */
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
    flex-shrink: 0; /* Prevent shrinking */
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
    align-items: flex-start; /* Align KDA text to left */
}

.kda {
    font-size: 1.1rem;
    font-weight: bold;
    white-space: nowrap;
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

/* Layout */
.content-area {
    display: flex;
    gap: 20px;
    align-items: flex-start;
    justify-content: center; /* Default center for initial state */
    transition: all 0.3s ease;
    min-height: 600px;
}

.content-area.has-selection {
    justify-content: flex-start;
}

.left-pane {
    width: 100%;
    max-width: 500px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    transition: max-width 0.3s ease;
}

/* Shrink left pane slightly when details are showing to give space */
.content-area.has-selection .left-pane {
    max-width: 280px; /* Reduced for more compact list */
    flex-shrink: 0;
}

.right-pane {
    flex: 1;
    background: #1e1e1e;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
    border: 1px solid #333;
    animation: fadeIn 0.3s ease-out;
    min-width: 0; /* Prevents flex item from overflowing */
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}

/* Initial State / Welcome */
.initial-state {
    text-align: center;
    padding: 3rem 1rem;
    color: #666;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 12px;
    border: 1px dashed #444;
}

.welcome-msg .icon {
    display: block;
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
}

.welcome-msg p {
    font-size: 1.1rem;
    margin: 0;
}

/* Match Card Compact (Left Pane) */
.match-card {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 10px; /* Slightly reduced padding */
    display: flex;
    align-items: center;
    border-left: 4px solid #666;
    transition: all 0.2s;
    cursor: pointer;
    position: relative;
    overflow: hidden;
}
.match-card:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: translateX(4px);
}
.match-card.active {
    background: linear-gradient(90deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%);
    border-left-width: 6px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.match-card.win { border-left-color: #4caf50; }
.match-card.loss { border-left-color: #f44336; }

.match-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    gap: 8px; /* Reduced gap */
}
.game-meta { width: 60px; font-size: 0.75rem; display: flex; flex-direction: column; gap: 2px; } /* Compact meta */
.champion-info { flex: 1; display: flex; justify-content: flex-start; padding-left: 5px; }
.champion-icon-wrapper { width: 36px; height: 36px; } /* Smaller icon */
.champion-icon { border-radius: 50%; width: 100%; height: 100%; border: 2px solid #333; }
.kda-stats { min-width: 90px; text-align: right; font-size: 0.9rem; font-weight: bold; letter-spacing: 0.5px; flex-shrink: 0; white-space: nowrap; }

.pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 15px;
    padding: 10px 0;
}
.page-info { color: #888; font-size: 0.9rem; }

/* Right Pane Details */
.detail-loading-wrapper {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 300px;
    color: #888;
    gap: 15px;
}

.spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255, 255, 255, 0.1);
    border-left-color: #00bcd4;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.details-header {
    display: flex;
    flex-direction: row;
    justify-content: flex-start; /* Group items together */
    gap: 30px; /* Reduced gap between groups */
    align-items: center;
    margin-bottom: 15px;
    padding: 10px 15px; /* Reduced padding */
    border-bottom: 1px solid #333;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
    width: fit-content; /* Only take as much space as needed */
    min-width: 400px;
}
.detail-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start; /* Align text to the left within items */
    gap: 2px;
}
.d-label {
    font-size: 0.7rem; /* Smaller font */
    color: #888;
    text-transform: uppercase;
}
.d-value {
    font-size: 0.85rem; /* Smaller font */
    font-weight: bold;
    color: #e0e0e0;
}
.meta-right { display: none; } /* Remove old class if still present */

/* Teams Side-by-Side Layout */
.teams-wrapper { 
    display: grid; 
    grid-template-columns: 1fr 1fr; /* Two equal columns */
    gap: 10px; /* Reduced gap */
}
.team-column {
    min-width: 0; /* Allow shrinking */
}

.p-row {
    display: grid;
    grid-template-columns: 60px 1fr 110px;
    align-items: center;
    gap: 15px;
    padding: 10px 15px;
    
    /* Standardize border box model */
    border: 1px solid transparent; /* Placeholder for top/right/bottom borders */
    border-bottom-color: rgba(255, 255, 255, 0.05); /* Visible bottom separator */
    border-left: 4px solid transparent; /* Visible left indicator */
    
    border-radius: 4px;
    margin-bottom: 6px;
    transition: background 0.1s, border-color 0.1s;
    box-sizing: border-box; /* Ensure padding and border are included in width/height */
}

.blue-team .p-row {
    background: rgba(79, 172, 254, 0.08);
    border-left-color: rgba(79, 172, 254, 0.5);
}
.red-team .p-row {
    background: rgba(255, 88, 88, 0.08);
    border-left-color: rgba(255, 88, 88, 0.5);
}

.p-row:hover { background: rgba(255, 255, 255, 0.12) !important; }
.p-row.is-me { 
    background: rgba(255, 215, 0, 0.12) !important; 
    border-color: rgba(255, 215, 0, 0.3); /* Colors all 4 borders */
    border-left-color: #ffd700; /* Overrides left border color */
    border-left-width: 4px; /* Ensures width stays same */
}

.p-champ { position: relative; width: 56px; height: 56px; } /* Larger avatar (56px) */
.p-icon { width: 100%; height: 100%; border-radius: 50%; border: 2px solid #222; }
.p-level { 
    position: absolute; bottom: -3px; right: -3px; 
    background: #111; color: #fff; font-size: 0.8rem; 
    padding: 1px 5px; border-radius: 4px; border: 1px solid #333;
}

.p-main-info { 
    display: flex; 
    flex-direction: column; 
    justify-content: center; 
    gap: 4px; 
    overflow: hidden; 
}
.p-name { 
    font-weight: bold; 
    font-size: 1.05rem; 
    color: #e0e0e0; 
    white-space: nowrap; 
    overflow: hidden; 
    text-overflow: ellipsis; 
    margin-bottom: 2px;
}
.p-kda-items { 
    display: flex; 
    flex-direction: column; /* Always vertical */
    align-items: flex-start; 
    gap: 6px; /* Gap between KDA text and Items row */
}
.kda-text { 
    font-size: 0.95rem; 
    color: #ccc; 
    font-family: monospace; 
    line-height: 1;
    white-space: nowrap;
}
.kda-text .deaths { color: #f44336; }
.p-items-row { 
    display: flex; 
    gap: 4px; 
}
.p-item-icon-small { width: 30px; height: 30px; border-radius: 4px; background: #000; border: 1px solid #333; } /* Larger items (30px) */

.p-stats-compact { font-size: 0.9rem; color: #888; text-align: right; line-height: 1.5; display: flex; flex-direction: column; justify-content: center; }

@media (max-width: 1000px) {
     /* Stack teams on medium screens if side-by-side is too cramped */
    .teams-wrapper { grid-template-columns: 1fr; }
    .p-row { grid-template-columns: 60px 1fr 110px; }
}

@media (max-width: 900px) {
    .content-area { flex-direction: column; align-items: center; }
    .content-area.has-selection .left-pane { max-width: 500px; width: 100%; }
    .right-pane { width: 100%; }
}

/* Item Tooltip */
.item-tooltip {
    position: fixed;
    z-index: 9999;
    background: rgba(10, 10, 15, 0.95);
    border: 1px solid #785a28; /* Goldish border */
    color: #e0e0e0;
    padding: 12px;
    border-radius: 6px;
    font-size: 0.85rem;
    max-width: 300px;
    pointer-events: none; /* Let mouse pass through */
    box-shadow: 0 4px 20px rgba(0,0,0,0.8);
    backdrop-filter: blur(5px);
}

.tooltip-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #444;
    padding-bottom: 8px;
    margin-bottom: 8px;
}

.tooltip-name {
    font-weight: bold;
    color: #00bcd4; /* Cyan title */
    font-size: 1rem;
}

.tooltip-gold {
    color: #ffd700;
    font-weight: bold;
}

.tooltip-desc {
    line-height: 1.4;
    color: #bbb;
}

/* Player Name and Copy Button Styles */
.p-name-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
}

.p-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.copy-btn {
  background: transparent;
  border: 1px solid transparent;
  color: #888;
  border-radius: 3px;
  padding: 1px 4px;
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
  opacity: 0;
  visibility: hidden;
  font-size: 0.7rem;
  line-height: 1;
  margin-left: 4px;
}

.p-name-wrapper:hover .copy-btn {
  opacity: 1;
  visibility: visible;
}

.copy-btn:hover {
  background: #00bcd4;
  color: #000;
  border-color: #00bcd4;
}

/* Data Dragon HTML Styles */
:deep(stats) {
    color: #98fb98; /* Pale green for stats */
    display: block;
    margin-bottom: 8px;
}
:deep(attention) {
    color: #ff6b6b;
    font-weight: bold;
}
:deep(passive) {
    color: #87ceeb; /* Sky blue for passives */
    font-weight: bold;
}
:deep(active) {
    color: #ffa500; /* Orange for actives */
    font-weight: bold;
}
:deep(unique) {
    color: #ffd700; /* Gold for unique passives */
    font-weight: bold;
}
:deep(mainText) {
    display: block;
}
</style>
