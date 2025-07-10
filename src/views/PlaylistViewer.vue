<template>
  <div class="playlist-viewer">
    <div class="header">
      <router-link to="/" class="back-button">
        <ArrowLeft class="icon" />
        Back to Playlists
      </router-link>
      <h1 class="playlist-title">{{ playlist?.title || 'Loading...' }}</h1>
      <p v-if="playlist?.summary" class="playlist-description">{{ playlist.summary }}</p>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>Loading playlist...</p>
    </div>

    <div v-else-if="error" class="error">
      <p>{{ error }}</p>
      <button @click="loadPlaylist" class="btn btn-primary">Retry</button>
    </div>

    <div v-else-if="playlist" class="playlist-content">
      <div class="playlist-info">
        <div class="info-card">
          <h2>Playlist Information</h2>
          <div class="info-grid">
            <div class="info-item">
              <span class="label">Title:</span>
              <span class="value">{{ playlist.title }}</span>
            </div>
            <div class="info-item">
              <span class="label">Tracks:</span>
              <span class="value">{{ playlist.items.length }}</span>
            </div>
          </div>
        </div>

        <div class="download-section">
          <h2>Download Options</h2>

          <div class="download-options">
            <div class="form-group">
              <label for="filename">Filename</label>
              <input 
                id="filename"
                v-model="downloadConfig.filename" 
                type="text" 
                placeholder="My Playlist"
                class="form-input"
              />
              <small class="help-text">The name for the downloaded ZIP file</small>
            </div>

            <button 
              @click="downloadPlaylistAsZip" 
              :disabled="downloading"
              class="btn btn-primary download-btn"
            >
              <Download class="icon" />
              {{ downloading ? 'Creating ZIP...' : 'Download Playlist' }}
            </button>
          </div>
        </div>
      </div>

      <div class="tracks-section">
        <h2>Tracks ({{ playlist.items.length }})</h2>
        
        <div class="tracks-list">
          <div 
            v-for="(track, index) in playlist.items" 
            :key="track.ratingKey"
            class="track-item"
          >
            <div class="track-number">{{ index + 1 }}</div>
            <div class="track-info">
              <div class="track-title">{{ track.title }}</div>
              <div class="track-artist">{{ track.artist }}</div>
              <div class="track-album">{{ track.album }}</div>
            </div>
            <div class="track-duration">{{ formatDuration(track.duration) }}</div>
            <div class="track-actions">
              <button 
                @click="downloadSingleTrack(track)"
                :disabled="downloading || downloadingTracks.has(track.ratingKey)"
                class="btn btn-small"
                :title="downloadingTracks.has(track.ratingKey) ? 'Downloading...' : 'Download this track'"
              >
                <Loader2 v-if="downloadingTracks.has(track.ratingKey)" class="icon spinning" />
                <Download v-else class="icon" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { PlexAPI } from '../services/plexApi'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { ArrowLeft, Download, Loader2 } from 'lucide-vue-next'

export default {
  name: 'PlaylistViewer',
  components: {
    ArrowLeft,
    Download,
    Loader2
  },
  props: {
    id: {
      type: String,
      required: true
    }
  },
  setup(props) {
    const route = useRoute()
    const loading = ref(true)
    const downloading = ref(false)
    const downloadingTracks = ref(new Set()) // Track which tracks are being downloaded
    const error = ref(null)
    const playlist = ref(null)

    const downloadConfig = reactive({
      filename: ''
    })

    const plexConfig = {
      url: localStorage.getItem('plexUrl'),
      token: localStorage.getItem('plexToken')
    }

    const loadPlaylist = async () => {
      loading.value = true
      error.value = null

      try {
        const plex = new PlexAPI(plexConfig.url, plexConfig.token)
        const playlistData = await plex.getPlaylistDetails(props.id)
        playlist.value = playlistData
        
        // Set default filename if not set
        if (!downloadConfig.filename) {
          downloadConfig.filename = playlistData.title.replace(/[^a-zA-Z0-9\s]/g, '')
        }
      } catch (err) {
        error.value = err.message
      } finally {
        loading.value = false
      }
    }

    const formatDuration = (milliseconds) => {
      if (!milliseconds) return '--:--'
      
      // Convert milliseconds to seconds
      const totalSeconds = Math.floor(milliseconds / 1000)
      
      if (totalSeconds < 3600) {
        // Less than 1 hour: show MM:SS
        const mins = Math.floor(totalSeconds / 60)
        const secs = totalSeconds % 60
        return `${mins}:${secs.toString().padStart(2, '0')}`
      } else {
        // 1 hour or more: show HH:MM:SS
        const hours = Math.floor(totalSeconds / 3600)
        const mins = Math.floor((totalSeconds % 3600) / 60)
        const secs = totalSeconds % 60
        return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      }
    }

    const downloadSingleTrack = async (track) => {
      if (downloadingTracks.value.has(track.ratingKey)) return // Prevent multiple downloads
      
      downloadingTracks.value.add(track.ratingKey)
      const startTime = Date.now()
      
      try {
        const plex = new PlexAPI(plexConfig.url, plexConfig.token)
        console.log(`Starting download for: ${track.title}`)
        
        const { blob, filename } = await plex.downloadTrack(track, (percent, loaded, total, speed) => {
          console.log(`Download progress: ${percent}% (${speed.toFixed(1)} KB/s)`)
        })
        saveAs(blob, filename)
      } catch (err) {
        console.error('Failed to download track:', err)
        if (err.message.includes('timeout')) {
          alert(`Download timeout for "${track.title}". The file may be large or your connection is slow. Try downloading the entire playlist as a ZIP instead.`)
        } else {
          alert(`Failed to download track "${track.title}": ${err.message}`)
        }
      } finally {
        downloadingTracks.value.delete(track.ratingKey)
      }
    }

    const downloadPlaylistAsZip = async () => {
      downloading.value = true
      
      try {
        const plex = new PlexAPI(plexConfig.url, plexConfig.token)
        const zip = new JSZip()
        const playlistFolder = zip.folder(downloadConfig.filename || playlist.value.title)
        
        for (let i = 0; i < playlist.value.items.length; i++) {
          const track = playlist.value.items[i]
          try {
            const { blob } = await plex.downloadTrack(track)
            const filename = `${(i + 1).toString().padStart(2, '0')} - ${track.artist} - ${track.title}.${track.media?.container || 'mp3'}`
            playlistFolder.file(filename, blob)
          } catch (err) {
            console.warn(`Failed to download track ${track.title}:`, err)
          }
        }
        
        const zipBlob = await zip.generateAsync({ type: 'blob' })
        const zipFilename = `${downloadConfig.filename || playlist.value.title}.zip`
        saveAs(zipBlob, zipFilename)
        
        alert('ZIP download completed!')
      } catch (err) {
        console.error('Failed to download playlist as ZIP:', err)
        alert(`Failed to download playlist: ${err.message}`)
      } finally {
        downloading.value = false
      }
    }



    onMounted(() => {
      loadPlaylist()
    })

          return {
        loading,
        downloading,
        downloadingTracks,
        error,
        playlist,
        downloadConfig,
        loadPlaylist,
        formatDuration,
        downloadSingleTrack,
        downloadPlaylistAsZip,
      }
  }
}
</script>

<style scoped>
.playlist-viewer {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.header {
  margin-bottom: 3rem;
  text-align: center;
}

.back-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: rgba(255, 255, 255, 0.9);
  text-decoration: none;
  font-weight: 600;
  margin-bottom: 1.5rem;
  transition: all 0.3s ease;
  padding: 0.75rem 1.5rem;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.back-button:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
}

.icon {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  stroke-width: 2;
  fill: none;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.playlist-title {
  font-size: 3rem;
  font-weight: 800;
  color: white;
  margin: 0;
}

.playlist-description {
  font-size: 1.1rem;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 0.5rem;
  line-height: 1.6;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.loading, .error {
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

.playlist-content {
  display: grid;
  gap: 3rem;
  grid-template-columns: 1fr 2fr;
}

.info-card, .download-section {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(30px);
  border-radius: 24px;
  padding: 2rem;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
}

.info-card:hover, .download-section:hover {
  transform: translateY(-5px);
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.2);
  background: rgba(255, 255, 255, 0.08);
}

.info-card {
  margin-bottom: 2rem;
}

.info-card h2, .download-section h2 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  color: white;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.info-grid {
  display: grid;
  gap: 1rem;
}

.info-item {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.info-item .label {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.8);
  min-width: 100px;
  margin-right: 1rem;
}

.info-item .value {
  color: white;
  font-weight: 500;
}

.download-options {
  display: grid;
  gap: 1.5rem;
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

.download-btn {
  margin-top: 1rem;
  width: 100%;
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
  border-radius: 12px;
  transition: all 0.3s ease;
}

.tracks-section {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(30px);
  border-radius: 24px;
  padding: 2rem;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.tracks-section h2 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 1.5rem;
  color: white;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.tracks-list {
  display: grid;
  gap: 0.75rem;
}

.track-item {
  display: flex;
  align-items: center;
  padding: 1.25rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  transition: all 0.3s ease;
  border: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 0.75rem;
}

.track-item:hover {
  background: rgba(255, 255, 255, 0.12);
  transform: translateY(-2px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
  border-color: rgba(255, 255, 255, 0.2);
}

.track-number {
  width: 50px;
  font-weight: 700;
  color: white;
  text-align: center;
  margin-right: 1.5rem;
  font-size: 1.2rem;
}

.track-info {
  flex: 1;
  margin: 0 1.5rem;
  min-width: 0;
}

.track-title {
  font-weight: 600;
  color: white;
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
}

.track-artist {
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 0.25rem;
}

.track-album {
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
}

.track-duration {
  font-size: 0.9rem;
  color: rgba(255, 255, 255, 0.7);
  margin: 0 1.5rem;
  font-weight: 500;
}

.track-actions {
  margin-left: auto;
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

.btn-small {
  padding: 0.75rem;
  font-size: 0.9rem;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
}

.btn-small:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
}

@media (max-width: 768px) {
  .playlist-viewer {
    padding: 1rem;
  }
  
  .playlist-title {
    font-size: 2rem;
  }
  
  .playlist-content {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  
  .track-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
    padding: 1.5rem;
  }
  
  .track-number {
    align-self: flex-start;
    margin-right: 0;
    margin-bottom: 0.5rem;
  }
  
  .track-duration, .track-actions {
    align-self: flex-end;
  }
  
  .track-info {
    margin: 0;
    width: 100%;
  }
}
</style> 