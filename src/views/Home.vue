<template>
  <div class="home">
    <div class="hero-section">
      <h1 class="hero-title">Plex Playlist Downloader</h1>
      <p class="hero-subtitle">Connect to your Plex server and download your music playlists</p>
    </div>

    <div class="connection-section">
      <div class="card">
        <h2 class="card-title">Plex Server Connection</h2>
        
        <div class="form-group">
          <label for="plexUrl">Plex Server URL</label>
          <input 
            id="plexUrl"
            v-model="plexConfig.url" 
            type="text" 
            placeholder="http://192.168.1.100:32400"
            class="form-input"
          />
        </div>

        <div class="form-group">
          <label for="plexToken">Plex Token</label>
          <input 
            id="plexToken"
            v-model="plexConfig.token" 
            type="password" 
            placeholder="Your Plex token"
            class="form-input"
          />
          <small class="help-text">
            Find your token in Plex Web → Settings → General → Advanced → Show Advanced
          </small>
        </div>

        <button 
          @click="testConnection" 
          :disabled="!plexConfig.url || !plexConfig.token || connecting"
          class="btn btn-primary"
        >
          {{ connecting ? 'Testing...' : 'Test Connection' }}
        </button>

        <div v-if="connectionStatus" class="status-message" :class="connectionStatus.type">
          {{ connectionStatus.message }}
        </div>
      </div>
    </div>

    <div v-if="isConnected" class="playlists-section">
      <div class="card">
        <div class="playlists-header">
          <h2 class="card-title">Music Playlists</h2>
          <div class="header-buttons">
            <button 
              @click="clearCache" 
              class="btn btn-small clear-btn"
              title="Clear cache"
            >
              <Trash2 class="icon" />
            </button>
            <button 
              @click="loadPlaylists(true)" 
              :disabled="loadingPlaylists"
              class="btn btn-small refresh-btn"
              title="Refresh playlists"
            >
              <Loader2 v-if="loadingPlaylists" class="icon spinning" />
              <RefreshCw v-else class="icon" />
            </button>
          </div>
        </div>
      
        <div v-if="loadingPlaylists" class="loading">
          <div class="spinner"></div>
          <p>Loading playlists...</p>
        </div>

        <div v-else>
          <div v-if="cacheStatus" class="cache-status">
            <small>{{ cacheStatus }}</small>
          </div>
          
          <div v-if="playlists.length === 0" class="empty-state">
            <p>No music playlists found on your Plex server.</p>
          </div>

          <div v-else class="playlists-grid">
            <div 
              v-for="playlist in playlists" 
              :key="playlist.ratingKey"
              class="playlist-card"
              @click="viewPlaylist(playlist.ratingKey)"
            >
              <div class="playlist-icon">
                <Music class="icon" />
              </div>
              <div class="playlist-info">
                <h3 class="playlist-title">{{ playlist.title }}</h3>
                <p class="playlist-count">{{ playlist.leafCount }} tracks</p>
                <p class="playlist-library">{{ playlist.libraryName }}</p>
              </div>
              <div class="playlist-arrow">
                <ChevronRight class="icon" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { PlexAPI } from '../services/plexApi'
import { Trash2, RefreshCw, Loader2, Music, ChevronRight } from 'lucide-vue-next'

export default {
  name: 'Home',
  components: {
    Trash2,
    RefreshCw,
    Loader2,
    Music,
    ChevronRight
  },
  setup() {
    const router = useRouter()
    const connecting = ref(false)
    const isConnected = ref(false)
    const loadingPlaylists = ref(false)
    const playlists = ref([])
    const connectionStatus = ref(null)
    const cacheStatus = ref(null)

    const plexConfig = reactive({
      url: localStorage.getItem('plexUrl') || '',
      token: localStorage.getItem('plexToken') || ''
    })

    const loadPlaylists = async (forceRefresh = false) => {
      loadingPlaylists.value = true
      cacheStatus.value = null // Clear cache status when starting
      
      try {
        // Check cache first (unless forcing refresh)
        if (!forceRefresh) {
          const cachedData = localStorage.getItem('plexPlaylistsCache')
          const cacheTimestamp = localStorage.getItem('plexPlaylistsCacheTimestamp')
          
          if (cachedData && cacheTimestamp) {
            const cacheAge = Date.now() - parseInt(cacheTimestamp)
            const cacheMaxAge = 30 * 60 * 1000 // 30 minutes
            
            if (cacheAge < cacheMaxAge) {
              console.log('Loading playlists from cache')
              playlists.value = JSON.parse(cachedData)
              cacheStatus.value = `Loaded from cache (${Math.round(cacheAge / 60000)} minutes old)`
              loadingPlaylists.value = false
              return
            }
          }
        }
        
        // Fetch fresh data from Plex
        console.log('Loading playlists from Plex server')
        const plex = new PlexAPI(plexConfig.url, plexConfig.token)
        const musicPlaylists = await plex.getMusicPlaylists()
        
        console.log('Received playlists:', musicPlaylists.length)
        console.log('Sample playlist data:', musicPlaylists[0])
        // Force reactive update by creating a new array
        playlists.value = [...musicPlaylists]
        
        // Cache the data
        localStorage.setItem('plexPlaylistsCache', JSON.stringify(musicPlaylists))
        localStorage.setItem('plexPlaylistsCacheTimestamp', Date.now().toString())
        cacheStatus.value = 'Fresh data loaded from server'
        
        // Ensure DOM updates
        await nextTick()
        
      } catch (error) {
        console.error('Failed to load playlists:', error)
        
        // Try to load from cache as fallback
        const cachedData = localStorage.getItem('plexPlaylistsCache')
        if (cachedData) {
          console.log('Loading playlists from cache (fallback)')
          playlists.value = JSON.parse(cachedData)
          cacheStatus.value = 'Loaded from cache (fallback)'
        }
      } finally {
        loadingPlaylists.value = false
        console.log('Final playlists count:', playlists.value.length)
      }
    }

    const testConnection = async () => {
      connecting.value = true
      connectionStatus.value = null

      try {
        const plex = new PlexAPI(plexConfig.url, plexConfig.token)
        await plex.testConnection()
        
        // Save to localStorage
        localStorage.setItem('plexUrl', plexConfig.url)
        localStorage.setItem('plexToken', plexConfig.token)
        
        connectionStatus.value = {
          type: 'success',
          message: 'Successfully connected to Plex server!'
        }
        
        isConnected.value = true
        await loadPlaylists()
      } catch (error) {
        connectionStatus.value = {
          type: 'error',
          message: `Connection failed: ${error.message}`
        }
        isConnected.value = false
      } finally {
        connecting.value = false
      }
    }

    const clearCache = () => {
      localStorage.removeItem('plexPlaylistsCache')
      localStorage.removeItem('plexPlaylistsCacheTimestamp')
      cacheStatus.value = 'Cache cleared'
      playlists.value = []
    }

    const viewPlaylist = (playlistId) => {
      router.push(`/playlist/${playlistId}`)
    }

    // Auto-connect if we have saved credentials
    if (plexConfig.url && plexConfig.token) {
      testConnection()
    }

          return {
        plexConfig,
        connecting,
        isConnected,
        loadingPlaylists,
        playlists,
        connectionStatus,
        cacheStatus,
        testConnection,
        loadPlaylists,
        clearCache,
        viewPlaylist
      }
  }
}
</script>

<style scoped>
.home {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.hero-section {
  text-align: center;
  margin-bottom: 3rem;
}

.hero-title {
  font-size: 3rem;
  font-weight: 800;
  color: white;
  margin-bottom: 1rem;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.hero-subtitle {
  font-size: 1.2rem;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 2rem;
  line-height: 1.6;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(30px);
  border-radius: 24px;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
}

.card:hover {
  transform: translateY(-5px);
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.2);
  background: rgba(255, 255, 255, 0.08);
}

.card-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  color: white;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.75rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.form-input {
  width: 100%;
  padding: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  font-size: 1rem;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  background: rgba(255, 255, 255, 0.15);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.3);
}

.form-input::placeholder {
  color: rgba(255, 255, 255, 0.5);
}

.help-text {
  display: block;
  margin-top: 0.5rem;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-3px);
  box-shadow: 0 12px 35px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.status-message {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 12px;
  font-weight: 500;
  backdrop-filter: blur(10px);
}

.status-message.success {
  background: rgba(16, 185, 129, 0.2);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.status-message.error {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.loading {
  text-align: center;
  padding: 4rem;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(30px);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
}

.spinner {
  width: 60px;
  height: 60px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 2rem;
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 2rem;
  color: rgba(255, 255, 255, 0.7);
}

.playlists-grid {
  display: grid;
  gap: 1rem;
}

.playlist-card {
  display: flex;
  align-items: center;
  padding: 1.25rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.playlist-card:hover {
  background: rgba(255, 255, 255, 0.12);
  transform: translateY(-2px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
  border-color: rgba(255, 255, 255, 0.2);
}

.playlist-icon {
  margin-right: 1rem;
  color: #667eea;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon {
  width: 24px;
  height: 24px;
  stroke: currentColor;
  stroke-width: 2;
  fill: none;
}

.spinning {
  animation: spin 1s linear infinite;
}

.playlist-info {
  flex: 1;
}

.playlist-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: white;
  margin-bottom: 0.25rem;
}

.playlist-count {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 0.25rem;
}

.playlist-library {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
  font-style: italic;
}

.playlists-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.playlists-header .card-title {
  margin-bottom: 0;
}

.header-buttons {
  display: flex;
  gap: 0.5rem;
}

.btn-small {
  padding: 0.75rem;
  font-size: 0.9rem;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.btn-small:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
}

.btn-small:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.cache-status {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: rgba(102, 126, 234, 0.1);
  border-radius: 12px;
  text-align: center;
  border: 1px solid rgba(102, 126, 234, 0.2);
}

.cache-status small {
  color: rgba(255, 255, 255, 0.7);
  font-style: italic;
}

.playlist-arrow {
  color: #667eea;
  font-weight: bold;
}

@media (max-width: 768px) {
  .home {
    padding: 1rem;
  }
  
  .hero-title {
    font-size: 2rem;
  }
  
  .playlist-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.5rem;
  }
  
  .playlist-icon {
    margin-right: 0;
    margin-bottom: 0.5rem;
  }
  
  .playlist-arrow {
    align-self: flex-end;
  }
}
</style>
