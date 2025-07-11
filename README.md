# Plex Playlist Downloader

A beautiful Vue 3 application that connects to your local Plex instance and allows you to view and download music playlists by archiving all the music files to a location of your choice.

<img width="1388" height="1267" alt="image" src="https://github.com/user-attachments/assets/9d1ab5b0-91f9-4325-9098-dd348d37b691" />

## Features

- 🔗 Connect to your local Plex server
- 📋 View all music playlists from your Plex library
- 🎵 Browse individual tracks within playlists
- ⬇️ Download entire playlists as ZIP archives
- 🎧 Download individual tracks
- 💾 Remember your connection settings
- 🎨 Modern, responsive UI with beautiful design

## Prerequisites

- Node.js (version 16 or higher)
- A running Plex Media Server
- Your Plex server token

## Getting Your Plex Token

1. Open Plex Web in your browser
2. Go to **Settings** → **General** → **Advanced** → **Show Advanced**
3. Look for the **Plex Token** field
4. Copy the token value

## Installation

1. Clone or download this repository
2. Navigate to the project directory:
   ```bash
   cd PlexPlaylistDownloader
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:3000`

## Usage

### Connecting to Your Plex Server

1. Enter your Plex server URL (e.g., `http://192.168.1.100:32400`)
2. Enter your Plex token
3. Click "Test Connection" to verify the connection
4. Once connected, your music playlists will be displayed

### Viewing and Downloading Playlists

1. Click on any playlist to view its details
2. Browse through the tracks in the playlist
3. Configure download options:
   - **Download Location**: Enter the folder path where you want to save files
   - **Filename**: Choose a name for the downloaded folder/zip file
   - **Create ZIP archive**: Toggle to create a ZIP file instead of individual files
4. Click "Download Playlist" to download all tracks
5. Use the download button (⬇️) next to individual tracks to download single files

## Configuration

The application automatically saves your connection settings in your browser's localStorage, so you won't need to re-enter them each time.

## Building for Production

To create a production build:

```bash
npm run build
```

The built files will be in the `dist` directory.

## Troubleshooting

### Connection Issues

- **"Connection refused"**: Make sure your Plex server is running and accessible
- **"Server not found"**: Check the server URL and ensure it's correct
- **"HTTP 401"**: Verify your Plex token is correct
- **"HTTP 403"**: Ensure your Plex token has the necessary permissions

### Download Issues

- **Browser download restrictions**: Some browsers may block multiple downloads. Try using the ZIP option instead
- **Large playlists**: For very large playlists, consider downloading in smaller batches
- **File format issues**: The application supports common audio formats (MP3, FLAC, M4A, etc.)

### Finding Your Plex Server URL

- **Local network**: Usually `http://YOUR_IP:32400` (e.g., `http://192.168.1.100:32400`)
- **Remote access**: Use your Plex remote access URL if accessing from outside your network

## Technical Details

- **Frontend**: Vue 3 with Composition API
- **Routing**: Vue Router 4
- **HTTP Client**: Axios
- **File Handling**: JSZip for creating archives, FileSaver for downloads
- **Build Tool**: Vite

## Security Notes

- Your Plex token is stored locally in your browser
- The application only connects to your local Plex server
- No data is sent to external servers
- Consider using a dedicated Plex token for this application

## License

This project is open source and available under the MIT License.

## Contributing

Feel free to submit issues and enhancement requests! 
