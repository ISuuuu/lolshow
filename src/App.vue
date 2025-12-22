<script setup>
import MatchHistory from './components/MatchHistory.vue'
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>LOL 战绩秀</h1>
    </header>
    <main>
      <MatchHistory />
    </main>
    <footer class="app-footer">
      <p>Powered by Local LCU API & Data Dragon</p>
    </footer>
  </div>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  padding: 1.5rem 1.5rem 0.5rem 1.5rem; /* Reduced bottom padding */
  text-align: center;
  background: linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 100%);
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

.app-footer {
  text-align: center;
  padding: 2rem;
  color: #666;
  font-size: 0.8rem;
}
</style>
