import axios from 'axios'

export class PlexAPI {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.token = token
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'X-Plex-Token': this.token,
        'Accept': 'application/json'
      }
    })
    
    // Create a separate client for downloads with longer timeout and optimized settings
    this.downloadClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 300000, // 5 minutes for downloads
      headers: {
        'X-Plex-Token': this.token,
        'Accept': '*/*',
        'Accept-Encoding': 'identity', // Prevent compression issues
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      // Optimize for large file downloads
      responseType: 'arraybuffer' // Use arraybuffer instead of blob for better performance
    })
  }

  async testConnection() {
    try {
      const response = await this.client.get('/')
      if (response.status !== 200) {
        throw new Error('Failed to connect to Plex server')
      }
      return true
    } catch (error) {
      if (error.response) {
        throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`)
      } else if (error.code === 'ECONNREFUSED') {
        throw new Error('Connection refused. Please check the server URL and ensure Plex is running.')
      } else if (error.code === 'ENOTFOUND') {
        throw new Error('Server not found. Please check the server URL.')
      } else {
        throw new Error(`Connection failed: ${error.message}`)
      }
    }
  }

  async getMusicPlaylists() {
    try {
      // Get all playlists
      const response = await this.client.get('/playlists')
      const playlists = response.data.MediaContainer.Metadata || []
      
      // Filter for music playlists (those with music items)
      const musicPlaylists = []
      
      for (const playlist of playlists) {
        try {
          // Get playlist details to check if it contains music
          const playlistResponse = await this.client.get(`/playlists/${playlist.ratingKey}/items`)
          const items = playlistResponse.data.MediaContainer.Metadata || []
          
          // Check if any items are music tracks
          const hasMusicItems = items.some(item => 
            item.type === 'track' || 
            (item.Media && item.Media.some(media => media.Part && media.Part.some(part => part.container === 'mp3' || part.container === 'flac' || part.container === 'm4a')))
          )
          
          if (hasMusicItems) {
            // Get library name from the first item's librarySectionTitle
            let libraryName = 'Unknown Library'
            if (items.length > 0) {
              const firstItem = items[0]
              if (firstItem.librarySectionTitle) {
                libraryName = firstItem.librarySectionTitle
              }
            }
            
            musicPlaylists.push({
              ratingKey: playlist.ratingKey,
              title: playlist.title,
              leafCount: playlist.leafCount || items.length,
              summary: playlist.summary,
              thumb: playlist.thumb,
              libraryName: libraryName
            })
          }
        } catch (error) {
          console.warn(`Failed to get details for playlist ${playlist.title}:`, error.message)
        }
      }
      
      return musicPlaylists
    } catch (error) {
      console.error('Failed to get playlists:', error)
      throw new Error('Failed to retrieve playlists from Plex server')
    }
  }

  async getPlaylistDetails(playlistId) {
    try {
      const response = await this.client.get(`/playlists/${playlistId}`)
      const playlist = response.data.MediaContainer.Metadata[0]
      
      // Get playlist items
      const itemsResponse = await this.client.get(`/playlists/${playlistId}/items`)
      const items = itemsResponse.data.MediaContainer.Metadata || []
      
      return {
        ratingKey: playlist.ratingKey,
        title: playlist.title,
        summary: playlist.summary,
        thumb: playlist.thumb,
        items: items.map(item => ({
          ratingKey: item.ratingKey,
          title: item.title,
          artist: item.originalTitle || item.grandparentTitle,
          album: item.parentTitle,
          duration: item.duration,
          year: item.year,
          thumb: item.thumb,
          media: item.Media?.[0]?.Part?.[0]
        }))
      }
    } catch (error) {
      console.error('Failed to get playlist details:', error)
      throw new Error('Failed to retrieve playlist details')
    }
  }

  async downloadTrack(track, onProgress = null) {
    if (!track.media) {
      throw new Error('No media information available for this track')
    }

    try {
      // Use the media file path directly instead of the download endpoint
      // Ensure the media key starts with a slash if it doesn't already
      const mediaPath = track.media.key.startsWith('/') ? track.media.key : `/${track.media.key}`
      
      console.log(`Starting download: ${track.title} (${mediaPath})`)
      console.log(`Plex server: ${this.baseUrl}`)
      
      // Test connection speed first
      const startTime = Date.now()
      const response = await this.downloadClient.get(mediaPath, {
        onDownloadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            const elapsed = (Date.now() - startTime) / 1000
            const speed = progressEvent.loaded / elapsed / 1024 // KB/s
            onProgress(percentCompleted, progressEvent.loaded, progressEvent.total, speed)
          }
        }
      })
      
      const totalTime = (Date.now() - startTime) / 1000
      const fileSize = response.data.byteLength / 1024 // KB
      const avgSpeed = fileSize / totalTime
      
      console.log(`Download completed: ${track.title}`)
      console.log(`File size: ${fileSize.toFixed(1)} KB`)
      console.log(`Download time: ${totalTime.toFixed(1)}s`)
      console.log(`Average speed: ${avgSpeed.toFixed(1)} KB/s`)
      
      // Convert arraybuffer to blob
      const blob = new Blob([response.data], { 
        type: this.getMimeType(track.media.container || 'mp3') 
      })
      
      return {
        blob: blob,
        filename: `${track.artist} - ${track.title}.${track.media.container || 'mp3'}`
      }
    } catch (error) {
      console.error('Failed to download track:', error)
      throw new Error(`Failed to download track: ${track.title}`)
    }
  }

  getStreamUrl(track) {
    if (!track.media) {
      throw new Error('No media information available for this track')
    }
    
    // Ensure the media key starts with a slash if it doesn't already
    const mediaPath = track.media.key.startsWith('/') ? track.media.key : `/${track.media.key}`
    return `${this.baseUrl}${mediaPath}?X-Plex-Token=${this.token}`
  }

  getMimeType(container) {
    const mimeTypes = {
      'mp3': 'audio/mpeg',
      'flac': 'audio/flac',
      'm4a': 'audio/mp4',
      'aac': 'audio/aac',
      'ogg': 'audio/ogg',
      'wav': 'audio/wav'
    }
    return mimeTypes[container] || 'audio/mpeg'
  }
} 