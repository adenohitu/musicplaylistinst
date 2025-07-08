// MusicKit の設定
const MUSICKIT_CONFIG = {
    developerToken: 'YOUR_DEVELOPER_TOKEN_HERE', // Apple Music Developer Tokenを設定してください
    app: {
        name: 'Instrumental Playlist Creator',
        build: '1.0.0'
    }
};

class InstrumentalPlaylistCreator {
    constructor() {
        this.music = null;
        this.currentPlaylist = null;
        this.currentSongs = [];
        this.foundInstrumentals = [];
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.initializeMusicKit();
    }

    setupEventListeners() {
        document.getElementById('authorize-btn').addEventListener('click', () => this.authorize());
        document.getElementById('load-playlist-btn').addEventListener('click', () => this.loadPlaylist());
        document.getElementById('search-instrumentals-btn').addEventListener('click', () => this.searchInstrumentals());
        document.getElementById('create-playlist-btn').addEventListener('click', () => this.createPlaylist());
    }

    async initializeMusicKit() {
        try {
            // 本番環境では適切なDeveloper Tokenを設定してください
            if (MUSICKIT_CONFIG.developerToken === 'YOUR_DEVELOPER_TOKEN_HERE') {
                this.showStatus('error', 'Developer Tokenが設定されていません。script.jsファイルでDeveloper Tokenを設定してください。');
                return;
            }

            await MusicKit.configure(MUSICKIT_CONFIG);
            this.music = MusicKit.getInstance();
            
            // 認証状態をチェック
            if (this.music.isAuthorized) {
                this.onAuthorizationSuccess();
            }
        } catch (error) {
            console.error('MusicKit initialization failed:', error);
            this.showStatus('error', 'MusicKit の初期化に失敗しました。');
        }
    }

    async authorize() {
        try {
            this.showLoading(true);
            await this.music.authorize();
            this.onAuthorizationSuccess();
        } catch (error) {
            console.error('Authorization failed:', error);
            this.showStatus('error', 'Apple Music の認証に失敗しました。');
        } finally {
            this.showLoading(false);
        }
    }

    async onAuthorizationSuccess() {
        document.getElementById('auth-status').innerHTML = `
            <span class="auth-status success">✓ Apple Music にサインインしました</span>
        `;
        
        // プレイリストセクションを表示
        document.getElementById('playlist-section').style.display = 'block';
        
        // プレイリストを読み込む
        await this.loadPlaylists();
    }

    async loadPlaylists() {
        try {
            this.showLoading(true);
            
            // ユーザーのプレイリストを取得
            const playlists = await this.music.api.library.playlists();
            
            const playlistSelect = document.getElementById('playlist-select');
            playlistSelect.innerHTML = '<option value="">プレイリストを選択してください</option>';
            
            playlists.forEach(playlist => {
                const option = document.createElement('option');
                option.value = playlist.id;
                option.textContent = playlist.attributes.name;
                playlistSelect.appendChild(option);
            });
            
            this.showStatus('success', `${playlists.length} 個のプレイリストを読み込みました。`);
        } catch (error) {
            console.error('Failed to load playlists:', error);
            this.showStatus('error', 'プレイリストの読み込みに失敗しました。');
        } finally {
            this.showLoading(false);
        }
    }

    async loadPlaylist() {
        const playlistId = document.getElementById('playlist-select').value;
        if (!playlistId) {
            this.showStatus('error', 'プレイリストを選択してください。');
            return;
        }

        try {
            this.showLoading(true);
            
            // プレイリストの詳細を取得
            const playlist = await this.music.api.library.playlist(playlistId, {
                include: 'tracks'
            });
            
            this.currentPlaylist = playlist;
            this.currentSongs = playlist.relationships.tracks.data;
            
            this.displaySongs();
            document.getElementById('songs-section').style.display = 'block';
            
            this.showStatus('success', `プレイリスト「${playlist.attributes.name}」を読み込みました。`);
        } catch (error) {
            console.error('Failed to load playlist:', error);
            this.showStatus('error', 'プレイリストの読み込みに失敗しました。');
        } finally {
            this.showLoading(false);
        }
    }

    displaySongs() {
        const songsList = document.getElementById('songs-list');
        const songsCount = document.getElementById('songs-count');
        
        songsCount.textContent = `${this.currentSongs.length}曲`;
        
        songsList.innerHTML = '';
        
        this.currentSongs.forEach(song => {
            const songItem = document.createElement('div');
            songItem.className = 'song-item';
            songItem.innerHTML = `
                <div class="song-title">${song.attributes.name}</div>
                <div class="song-artist">${song.attributes.artistName}</div>
                <div class="song-status" id="status-${song.id}"></div>
            `;
            songsList.appendChild(songItem);
        });
    }

    async searchInstrumentals() {
        if (this.currentSongs.length === 0) {
            this.showStatus('error', '楽曲が読み込まれていません。');
            return;
        }

        try {
            this.showLoading(true);
            this.foundInstrumentals = [];
            
            // 各楽曲のインストゥルメンタル版を検索
            for (let i = 0; i < this.currentSongs.length; i++) {
                const song = this.currentSongs[i];
                await this.searchInstrumentalForSong(song);
                
                // 進捗を表示
                this.showStatus('info', `検索中... ${i + 1}/${this.currentSongs.length}`);
                
                // API制限を考慮して少し待機
                await this.delay(500);
            }
            
            this.displayInstrumentals();
            document.getElementById('instrumentals-section').style.display = 'block';
            
            this.showStatus('success', `${this.foundInstrumentals.length} 個のインストゥルメンタル版が見つかりました。`);
        } catch (error) {
            console.error('Failed to search instrumentals:', error);
            this.showStatus('error', 'インストゥルメンタル版の検索に失敗しました。');
        } finally {
            this.showLoading(false);
        }
    }

    async searchInstrumentalForSong(song) {
        const statusElement = document.getElementById(`status-${song.id}`);
        statusElement.className = 'song-status searching';
        statusElement.textContent = '検索中...';
        
        try {
            const searchQueries = [
                `${song.attributes.name} instrumental ${song.attributes.artistName}`,
                `${song.attributes.name} karaoke ${song.attributes.artistName}`,
                `${song.attributes.name} backing track ${song.attributes.artistName}`,
                `${song.attributes.name} minus one ${song.attributes.artistName}`
            ];
            
            for (const query of searchQueries) {
                const results = await this.music.api.search(query, {
                    types: ['songs'],
                    limit: 10
                });
                
                if (results.songs && results.songs.data.length > 0) {
                    // インストゥルメンタル版らしい楽曲を探す
                    const instrumental = this.findInstrumental(results.songs.data, song);
                    if (instrumental) {
                        this.foundInstrumentals.push({
                            original: song,
                            instrumental: instrumental
                        });
                        
                        statusElement.className = 'song-status found';
                        statusElement.textContent = '✓ インストゥルメンタル版が見つかりました';
                        
                        // 元の楽曲アイテムをハイライト
                        const songItem = statusElement.closest('.song-item');
                        songItem.classList.add('has-instrumental');
                        
                        return;
                    }
                }
            }
            
            statusElement.className = 'song-status not-found';
            statusElement.textContent = '✗ インストゥルメンタル版が見つかりませんでした';
        } catch (error) {
            console.error('Search failed for song:', song.attributes.name, error);
            statusElement.className = 'song-status not-found';
            statusElement.textContent = '✗ 検索エラー';
        }
    }

    findInstrumental(searchResults, originalSong) {
        const instrumentalKeywords = [
            'instrumental', 'karaoke', 'backing track', 'minus one', 
            'without vocals', 'no vocals', 'inst', 'instru'
        ];
        
        return searchResults.find(result => {
            const title = result.attributes.name.toLowerCase();
            const artist = result.attributes.artistName.toLowerCase();
            const originalTitle = originalSong.attributes.name.toLowerCase();
            const originalArtist = originalSong.attributes.artistName.toLowerCase();
            
            // タイトルまたはアーティストが似ている
            const titleMatch = title.includes(originalTitle) || originalTitle.includes(title);
            const artistMatch = artist.includes(originalArtist) || originalArtist.includes(artist);
            
            // インストゥルメンタル関連のキーワードが含まれている
            const hasInstrumentalKeyword = instrumentalKeywords.some(keyword => 
                title.includes(keyword) || artist.includes(keyword)
            );
            
            return (titleMatch || artistMatch) && hasInstrumentalKeyword;
        });
    }

    displayInstrumentals() {
        const instrumentalsList = document.getElementById('instrumentals-list');
        const instrumentalsCount = document.getElementById('instrumentals-count');
        
        instrumentalsCount.textContent = `${this.foundInstrumentals.length}曲`;
        
        instrumentalsList.innerHTML = '';
        
        this.foundInstrumentals.forEach(item => {
            const instrumentalItem = document.createElement('div');
            instrumentalItem.className = 'song-item has-instrumental';
            instrumentalItem.innerHTML = `
                <div class="song-title">${item.instrumental.attributes.name}</div>
                <div class="song-artist">${item.instrumental.attributes.artistName}</div>
                <div class="song-status found">
                    元楽曲: ${item.original.attributes.name}
                </div>
            `;
            instrumentalsList.appendChild(instrumentalItem);
        });
    }

    async createPlaylist() {
        const playlistName = document.getElementById('new-playlist-name').value.trim();
        if (!playlistName) {
            this.showStatus('error', 'プレイリスト名を入力してください。');
            return;
        }

        if (this.foundInstrumentals.length === 0) {
            this.showStatus('error', 'インストゥルメンタル版が見つかっていません。');
            return;
        }

        try {
            this.showLoading(true);
            
            // 新しいプレイリストを作成
            const playlist = await this.music.api.library.playlists.create({
                attributes: {
                    name: playlistName,
                    description: `インストゥルメンタル版のプレイリスト（${this.foundInstrumentals.length}曲）`
                }
            });
            
            // インストゥルメンタル楽曲を追加
            const trackIds = this.foundInstrumentals.map(item => item.instrumental.id);
            await this.music.api.library.playlist(playlist.id).tracks.add(trackIds);
            
            this.showStatus('success', `プレイリスト「${playlistName}」を作成しました！`);
            
            // 入力フィールドをクリア
            document.getElementById('new-playlist-name').value = '';
        } catch (error) {
            console.error('Failed to create playlist:', error);
            this.showStatus('error', 'プレイリストの作成に失敗しました。');
        } finally {
            this.showLoading(false);
        }
    }

    showStatus(type, message) {
        const statusElement = document.getElementById('status-message');
        statusElement.className = `status-message ${type}`;
        statusElement.textContent = message;
        
        // 5秒後に自動的に非表示
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 5000);
    }

    showLoading(show) {
        const loadingElement = document.getElementById('loading');
        loadingElement.style.display = show ? 'flex' : 'none';
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// アプリケーション開始
document.addEventListener('DOMContentLoaded', () => {
    new InstrumentalPlaylistCreator();
});
