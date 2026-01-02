<script setup>
import { ref, reactive, onMounted } from 'vue'
import MatchHistory from './components/MatchHistory.vue'
import api from './services/api'

const matchHistoryRef = ref(null)
const showLoginModal = ref(false)
const showProfileModal = ref(false)
const isLoggedIn = ref(false)
const showUserMenu = ref(false)
const currentUsername = ref('')
const loginForm = reactive({
  username: '',
  password: '',
  captcha: ''
})
const captchaUrl = ref('')
const loginMsg = ref('')
const loginMsgType = ref('') // 'success' or 'error'

// Toast Notification
const toast = reactive({
  show: false,
  message: '',
  type: 'info'
})
let toastTimeout = null

const showToast = (message, type = 'info') => {
  toast.message = message
  toast.type = type
  toast.show = true
  
  if (toastTimeout) clearTimeout(toastTimeout)
  toastTimeout = setTimeout(() => {
    toast.show = false
  }, 3000)
}

const refreshCaptcha = () => {
  captchaUrl.value = `/api/user/generate-captcha?t=${Date.now()}`
}

const checkLoginStatus = () => {
  const token = localStorage.getItem('token')
  const savedName = localStorage.getItem('username')
  if (token) {
    isLoggedIn.value = true
    currentUsername.value = savedName || '用户'
  }
}

const openLoginModal = () => {
  showLoginModal.value = true
  loginMsg.value = ''
  loginMsgType.value = ''
  refreshCaptcha()
}

const openProfileModal = () => {
    showProfileModal.value = true
    showUserMenu.value = false // Close menu
}

const handleLogin = async () => {
  loginMsg.value = ''
  if (!loginForm.username || !loginForm.password || !loginForm.captcha) {
    loginMsg.value = '请填写完整信息'
    loginMsgType.value = 'error'
    return
  }
  try {
    await api.login(loginForm)
    loginMsg.value = '登录成功'
    loginMsgType.value = 'success'
    
    // Update State
    localStorage.setItem('username', loginForm.username)
    isLoggedIn.value = true
    currentUsername.value = loginForm.username
    
    // Refresh Match History if component is available
    if (matchHistoryRef.value) {
        console.log('Refreshing match history after login...')
        matchHistoryRef.value.fetchMatches()
    }
    
    // 延迟关闭，让用户看到成功提示
    setTimeout(() => {
        showLoginModal.value = false
        // Clear form
        loginForm.username = ''
        loginForm.password = ''
        loginForm.captcha = ''
        loginMsg.value = ''
    }, 1500)

  } catch (error) {
    console.error(error)
    loginMsg.value = '登录失败: ' + (error.response?.data?.message || '请检查用户名密码或验证码')
    loginMsgType.value = 'error'
    refreshCaptcha()
  }
}

const handleLogout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('username')
  isLoggedIn.value = false
  currentUsername.value = ''
  showUserMenu.value = false
}

const toggleUserMenu = () => {
  showUserMenu.value = !showUserMenu.value
}

// Close menu when clicking outside
const closeUserMenu = (e) => {
    if (showUserMenu.value && !e.target.closest('.user-profile-area')) {
        showUserMenu.value = false;
    }
}

onMounted(() => {
  checkLoginStatus()
  document.addEventListener('click', closeUserMenu)
})
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>LOL 战绩秀</h1>
      
      <!-- User Profile / Login Area -->
      <div class="user-profile-area">
          <div v-if="isLoggedIn" class="user-avatar-wrapper" @click.stop="toggleUserMenu">
             <div class="avatar-circle" title="个人中心">
                <!-- Default User SVG Icon -->
                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" class="user-icon"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
             </div>
             <span class="user-name-header">{{ currentUsername }}</span>
             
             <!-- Dropdown Menu -->
             <div v-if="showUserMenu" class="user-dropdown">
                <div class="menu-item" @click="openProfileModal">
                    <span>个人信息</span>
                </div>
                <div class="menu-item logout" @click="handleLogout">
                    <span>退出</span>
                </div>
             </div>
          </div>
          <button v-else class="login-btn" @click="openLoginModal">登录</button>
      </div>
    </header>
    <main>
      <MatchHistory ref="matchHistoryRef" @require-login="openLoginModal" @show-toast="showToast" />
    </main>

    <!-- Toast Notification -->
    <div v-if="toast.show" class="toast-notification" :class="toast.type">
      {{ toast.message }}
    </div>

    <!-- Login Modal -->
    <div v-if="showLoginModal" class="modal-overlay" @click.self="showLoginModal = false">
      <div class="modal-content">
        <h2>用户登录</h2>
        <div class="form-group">
          <input v-model="loginForm.username" type="text" placeholder="用户名" />
        </div>
        <div class="form-group">
          <input v-model="loginForm.password" type="password" placeholder="密码" />
        </div>
        <div class="form-group">
          <div class="captcha-group">
            <input v-model="loginForm.captcha" type="text" placeholder="验证码" />
            <img :src="captchaUrl" @click="refreshCaptcha" alt="验证码" class="captcha-img" />
          </div>
        </div>
        <div class="form-actions">
          <button @click="handleLogin" class="submit-btn">登录</button>
          <button @click="showLoginModal = false" class="cancel-btn">取消</button>
        </div>
        
        <div class="register-area">
            <span>需要注册？请前往</span>
            <a href="https://ai.369900.xyz/" target="_blank" class="register-link">
                ai.369900.xyz <span class="arrow">→</span>
            </a>
        </div>

        <div v-if="loginMsg" class="login-message" :class="loginMsgType">
            {{ loginMsg }}
        </div>
      </div>
    </div>

    <!-- Profile Modal -->
    <div v-if="showProfileModal" class="modal-overlay" @click.self="showProfileModal = false">
      <div class="modal-content profile-modal">
        <h2>个人信息</h2>
        <div class="profile-info">
            <div class="avatar-large">
                <svg viewBox="0 0 24 24" width="64" height="64" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </div>
            <div class="info-row">
                <span class="label">用户名:</span>
                <span class="value">{{ currentUsername }}</span>
            </div>
            <!-- More info can be added here later -->
        </div>
        <div class="form-actions center">
          <button @click="showProfileModal = false" class="submit-btn">关闭</button>
        </div>
      </div>
    </div>

    <footer class="app-footer">
      <p>Powered by Local LCU API(Seraphine) & Data Dragon</p>
    </footer>
  </div>
</template>

<style scoped>
/* ... (keep existing styles) ... */

/* Add Profile Modal Specific Styles */
.profile-modal {
    text-align: center;
}

.profile-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    margin-bottom: 25px;
}

.avatar-large {
    width: 80px;
    height: 80px;
    background: #00bcd4;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #111;
    margin-bottom: 10px;
    border: 4px solid #2a2a2a;
    box-shadow: 0 0 0 2px #00bcd4;
}

.info-row {
    font-size: 1.2rem;
    color: #eee;
}

.info-row .label {
    color: #888;
    margin-right: 10px;
}

.form-actions.center {
    justify-content: center;
}

.form-actions.center .submit-btn {
    flex: 0 0 100px; /* Fixed width for button */
}

/* ... (Rest of existing styles) ... */
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  position: relative; /* For absolute positioning of login button */
  padding: 1.5rem 1.5rem 0.5rem 1.5rem; /* Reduced bottom padding */
  text-align: center;
  background: linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%);
}

.user-profile-area {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  z-index: 100;
}

.login-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #eee;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.login-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* User Avatar Styles */
.user-avatar-wrapper {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    position: relative;
    background: rgba(0, 0, 0, 0.3);
    padding: 5px 12px 5px 5px;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: background 0.2s;
}

.user-avatar-wrapper:hover {
    background: rgba(0, 0, 0, 0.5);
}

.avatar-circle {
    width: 32px;
    height: 32px;
    background: #00bcd4;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #111;
}

.user-name-header {
    font-size: 0.9rem;
    font-weight: bold;
    color: #eee;
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* Dropdown Menu */
.user-dropdown {
    position: absolute;
    top: 110%;
    right: 0;
    width: 140px;
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    animation: fadeIn 0.2s ease;
}

.menu-item {
    padding: 10px 15px;
    color: #eee;
    font-size: 0.9rem;
    cursor: pointer;
    transition: background 0.2s;
    text-align: left;
}

.menu-item:hover {
    background: #333;
}

.menu-item.logout {
    border-top: 1px solid #333;
    color: #f44336;
}

.menu-item.logout:hover {
    background: rgba(244, 67, 54, 0.1);
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(-5px); }
    to { opacity: 1; transform: translateY(0); }
}

.app-header h1 {
  font-size: 2.5rem; /* Slightly smaller title */
  background: -webkit-linear-gradient(#eee, #333);
  -webkit-background-clip: text;
  /* -webkit-text-fill-color: transparent; */ /* Optional: for gradient text effect */
  text-shadow: 0 4px 10px rgba(0,0,0,0.5);
  margin: 0;
  letter-spacing: 2px;
}

main {
  flex: 1;
  padding: 5px 20px 20px 20px; /* Greatly reduced top padding */
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: #2a2a2a;
  padding: 1.5rem;
  border-radius: 8px;
  width: 300px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  color: #eee;
}

.modal-content h2 {
  margin-top: 0;
  text-align: center;
  margin-bottom: 1.2rem;
  font-size: 1.5rem;
}

.form-group {
  margin-bottom: 0.8rem;
}

.form-group input {
  width: 100%;
  padding: 0.6rem 0.8rem;
  background: #333;
  border: 1px solid #444;
  border-radius: 4px;
  color: #fff;
  box-sizing: border-box; 
  outline: none;
}

.form-group input:focus {
    border-color: #00bcd4;
}

.captcha-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.captcha-img {
  height: 38px;
  cursor: pointer;
  border-radius: 4px;
}

.form-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 1.2rem;
  gap: 10px;
}

.submit-btn, .cancel-btn {
  flex: 1;
  padding: 0.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  font-size: 0.9rem;
}

.submit-btn {
  background: #007bff;
  color: white;
}

.submit-btn:hover {
  background: #0056b3;
}

.cancel-btn {
  background: #555;
  color: white;
}

.cancel-btn:hover {
  background: #444;
}

.register-area {
    margin-top: 15px;
    padding-top: 12px;
    border-top: 1px solid #333;
    text-align: center;
    font-size: 0.8rem;
    color: #999;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
}

.register-link {
    color: #00bcd4;
    text-decoration: none;
    font-weight: bold;
    display: inline-flex;
    align-items: center;
    transition: color 0.2s, transform 0.2s;
}

.register-link:hover {
    color: #4dd0e1;
    transform: translateX(2px);
}

.register-link .arrow {
    margin-left: 4px;
    font-size: 1.1rem;
    line-height: 1;
}

.login-message {
    margin-top: 15px;
    padding: 10px;
    border-radius: 4px;
    text-align: center;
    font-size: 0.9rem;
}

.login-message.success {
    background: rgba(76, 175, 80, 0.2);
    color: #4caf50;
    border: 1px solid #4caf50;
}

.login-message.error {
    background: rgba(244, 67, 54, 0.2);
    color: #f44336;
    border: 1px solid #f44336;
}

/* Toast Styles */
.toast-notification {
  position: fixed;
  top: 80px; /* Below header */
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  background: rgba(30, 30, 30, 0.95);
  color: #fff;
  border-radius: 50px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.5);
  z-index: 2000;
  font-size: 0.95rem;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: slideDown 0.3s ease-out;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.toast-notification.warning {
  border-left: 4px solid #ff9800;
}

.toast-notification.error {
  border-left: 4px solid #f44336;
}

.toast-notification.success {
  border-left: 4px solid #4caf50;
}

@keyframes slideDown {
  from { opacity: 0; transform: translate(-50%, -20px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

.app-footer {
  text-align: center;
  padding: 2rem;
  color: #666;
  font-size: 0.8rem;
}
</style>