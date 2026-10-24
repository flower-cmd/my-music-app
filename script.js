const audio = document.getElementById('audio');
const playBtn = document.getElementById('play');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const shuffleBtn = document.getElementById('shuffle-btn');
const title = document.getElementById('title');
const artist = document.getElementById('artist');
const songMeta = document.getElementById('song-meta');
const playerCover = document.getElementById('player-cover');
const playerView = document.getElementById('player-view');
const progress = document.getElementById('progress');
const progressContainer = document.getElementById('progress-container');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');
const volumeSlider = document.getElementById('volume-slider');

let allSongs = [];           
let currentPlaylist = [];       
let songIndex = 0;
let isPlaying = false;
let isLocalMode = false;       

let isShuffle = false;         
let currentPlaylistType = 'all'; 
let currentPlaylistName = '';   
let isDraggingProgress = false;
let isReorderMode = false;
let draggedSongIndex = null;

// 豐富的卡片漸層色盤與圖示
const COVER_GRADIENTS = [
    'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)',
    'linear-gradient(135deg, #0d9488 0%, #0284c7 50%, #4f46e5 100%)',
    'linear-gradient(135deg, #f4a261 0%, #e76f51 50%, #be123c 100%)',
    'linear-gradient(135deg, #10b981 0%, #059669 50%, #0f766e 100%)',
    'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 50%, #1e1b4b 100%)',
    'linear-gradient(135deg, #ec4899 0%, #f43f5e 50%, #fb923c 100%)',
    'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 50%, #312e81 100%)'
];
const COVER_EMOJIS = ['🌙', '🎧', '✨', '🕯️', '🌌', '🎷', '🌊', '☕'];

function getCoverStyle(seedStr) {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
        hash = seedStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash);
    return {
        gradient: COVER_GRADIENTS[idx % COVER_GRADIENTS.length],
        emoji: COVER_EMOJIS[idx % COVER_EMOJIS.length]
    };
}

async function init() {
    await checkEnvironment();
    await loadAllSongs();
    showPlaylistList();
    renderManagePlaylists();
    renderDashboardRecommendations();
    setupAudioEvents();
    setupMediaSessionHandlers();
    renderMemo();
}

// 格式化秒數為 m:ss
function formatTime(seconds) {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// 取得與記錄歌曲播放統計 (次數 & 最後播放時間)
function getSongStats() {
    return JSON.parse(localStorage.getItem('mySongStats') || '{}');
}

function recordSongPlay(song) {
    const key = song && (song.idbKey || song.src);
    if (!key) return;
    const stats = getSongStats();
    const prev = stats[key] || { count: 0, lastPlayed: 0 };
    stats[key] = {
        count: (prev.count || 0) + 1,
        lastPlayed: Date.now()
    };
    localStorage.setItem('mySongStats', JSON.stringify(stats));
    renderDashboardRecommendations();
}

function formatLastPlayed(timestamp, count) {
    if (!count || !timestamp) return '尚未播放';
    const diffMins = Math.floor((Date.now() - timestamp) / 60000);
    if (diffMins < 1) return '剛剛播放';
    if (diffMins < 60) return `${diffMins} 分鐘前`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} 小時前`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} 天前`;
}

// ================= IndexedDB 手機本機免 Python 音樂庫 =================
function openMusicDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open('MyMusicBoxDB', 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('localSongs')) {
                db.createObjectStore('localSongs', { keyPath: 'id' });
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

async function getAllIndexedDBSongs() {
    try {
        const db = await openMusicDB();
        return new Promise((resolve) => {
            const tx = db.transaction('localSongs', 'readonly');
            const store = tx.objectStore('localSongs');
            const req = store.getAll();
            req.onsuccess = () => {
                const items = req.result || [];
                const converted = items.map(item => {
                    const blobUrl = URL.createObjectURL(item.blob);
                    return {
                        title: item.title,
                        artist: item.artist,
                        src: blobUrl,
                        idbKey: `idb:${item.id}`,
                        isLocalImport: true
                    };
                });
                resolve(converted);
            };
            req.onerror = () => resolve([]);
        });
    } catch (e) {
        return [];
    }
}

function updateSelectedFileName(input) {
    const label = document.getElementById('file-upload-label');
    if (!label) return;
    if (input.files && input.files.length > 0) {
        const file = input.files[0];
        label.innerText = `🎵 已選擇：${file.name}`;
        const titleInput = document.getElementById('local-mp3-title');
        if (titleInput && !titleInput.value.trim()) {
            titleInput.value = file.name.replace(/\.[^/.]+$/, '');
        }
    } else {
        label.innerText = '📁 點擊選擇手機或電腦裡的 MP3 音訊檔案';
    }
}

async function importMp3ToIndexedDB() {
    const fileInput = document.getElementById('local-mp3-file');
    const titleInput = document.getElementById('local-mp3-title');
    const artistInput = document.getElementById('local-mp3-artist');
    const status = document.getElementById('local-mp3-status');

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        status.innerText = '❌ 請先選擇一個 MP3 音訊檔案！';
        return;
    }

    const file = fileInput.files[0];
    const songTitle = (titleInput.value || file.name.replace(/\.[^/.]+$/, '')).trim();
    const songArtist = (artistInput.value || '未知歌手').trim();

    try {
        const db = await openMusicDB();
        const id = 'song_' + Date.now();
        await new Promise((resolve, reject) => {
            const tx = db.transaction('localSongs', 'readwrite');
            const store = tx.objectStore('localSongs');
            store.put({
                id,
                title: songTitle,
                artist: songArtist,
                blob: file,
                createdAt: Date.now()
            });
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });

        status.innerText = `✅ 已將《${songTitle}》加入你的音樂盒！免開電腦隨時可聽！`;
        titleInput.value = '';
        artistInput.value = '';
        fileInput.value = '';
        document.getElementById('file-upload-label').innerText = '📁 點擊選擇手機或電腦裡的 MP3 音訊檔案';

        await loadAllSongs();
        renderDashboardRecommendations();
    } catch (e) {
        status.innerText = '❌ 儲存失敗，請確認瀏覽器空間是否充足。';
    }
}

// 1. 自動判斷環境
async function checkEnvironment() {
    try {
        const res = await fetch('/api/is_local');
        const data = await res.json();
        if (data.local) isLocalMode = true;
    } catch (e) {
        isLocalMode = false;
    }

    const navAddBtn = document.getElementById('nav-add-btn');
    if (navAddBtn) {
        if (isLocalMode) {
            navAddBtn.classList.remove('hidden');
        } else {
            navAddBtn.classList.add('hidden');
        }
    }
}

function getSongKey(song) {
    return song.idbKey || song.src;
}

// 2. 讀取總歌單 (合併 songs.json 與手機匯入的 IndexedDB 歌曲)
async function loadAllSongs() {
    let jsonSongs = [];
    try {
        const response = await fetch('songs.json?t=' + Date.now());
        jsonSongs = await response.json();
    } catch (error) {
        console.error("無法讀取 songs.json", error);
    }

    const idbSongs = await getAllIndexedDBSongs();
    allSongs = [...jsonSongs, ...idbSongs];
    currentPlaylist = [...allSongs];

    const countLabel = document.getElementById('all-songs-count-label');
    if (countLabel) {
        countLabel.innerText = `📌 全部收藏 • ${allSongs.length} 首歌曲`;
    }
    renderPlaylistCheckboxes();
}

// 3. 頂部主要分頁切換
function switchTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.top-tabs .nav-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    if (btnElement) {
        btnElement.classList.add('active');
    }
    
    if(tabId === 'playlist-tab') {
        renderPlaylistCheckboxes();
        renderManagePlaylists();
    }
}

function goToCreatePlaylist() {
    const plBtn = document.getElementById('nav-playlist-btn');
    switchTab('playlist-tab', plBtn);
}

// 切換回推薦總覽首頁
function openHomeDashboard() {
    isReorderMode = false;
    updateReorderUI();

    const listenBtn = document.getElementById('nav-listen-btn');
    switchTab('listen-tab', listenBtn);

    document.getElementById('dashboard-view').classList.remove('hidden');
    document.getElementById('song-list-view').classList.add('hidden');

    document.querySelectorAll('.lib-item').forEach(el => el.classList.remove('active'));
    const homeItem = document.getElementById('lib-item-home');
    if (homeItem) homeItem.classList.add('active');

    setActiveStageChip('chip-dashboard');
    renderDashboardRecommendations();
}

function setActiveStageChip(chipId) {
    document.querySelectorAll('.stage-filter-bar .filter-pill').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(chipId);
    if (target) target.classList.add('active');
}

function scrollToSection(sectionId) {
    openHomeDashboard();
    if (sectionId === 'most-played-section') setActiveStageChip('chip-most');
    if (sectionId === 'least-played-section') setActiveStageChip('chip-least');
    const sec = document.getElementById(sectionId);
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 渲染中央首頁：「最常聽的歌曲」與「最少/很久沒聽的歌曲」
function renderDashboardRecommendations() {
    const mostGrid = document.getElementById('most-played-grid');
    const leastGrid = document.getElementById('least-played-grid');
    if (!mostGrid || !leastGrid) return;

    const stats = getSongStats();
    const enriched = allSongs.map((song, idx) => {
        const key = getSongKey(song);
        const st = stats[key] || { count: 0, lastPlayed: 0 };
        return {
            ...song,
            originalIndex: idx,
            count: st.count || 0,
            lastPlayed: st.lastPlayed || 0
        };
    });

    const totalPlays = enriched.reduce((acc, s) => acc + s.count, 0);
    const heroStatsText = document.getElementById('hero-stats-text');
    if (heroStatsText) {
        heroStatsText.innerText = `目前收藏共 ${allSongs.length} 首歌曲 • 累計放鬆聆聽 ${totalPlays} 次`;
    }

    const mostPlayed = [...enriched]
        .sort((a, b) => (b.count - a.count) || (b.lastPlayed - a.lastPlayed))
        .slice(0, 5);

    mostGrid.innerHTML = '';
    mostPlayed.forEach(item => {
        const badgeText = item.count > 0 ? `🔥 播放 ${item.count} 次` : `🎵 熱門推薦`;
        mostGrid.appendChild(createSongCard(item, badgeText, mostPlayed));
    });

    const leastPlayed = [...enriched]
        .sort((a, b) => (a.count - b.count) || (a.lastPlayed - b.lastPlayed))
        .slice(0, 5);

    leastGrid.innerHTML = '';
    leastPlayed.forEach(item => {
        const badgeText = item.count === 0
            ? '✨ 尚未聽過'
            : `🕰️ ${formatLastPlayed(item.lastPlayed, item.count)} (${item.count}次)`;
        leastGrid.appendChild(createSongCard(item, badgeText, leastPlayed));
    });
}

function createSongCard(songItem, badgeText, listContext) {
    const card = document.createElement('div');
    card.className = 'media-card';
    const style = getCoverStyle(songItem.title + songItem.artist);

    card.innerHTML = `
        <div class="card-artwork" style="background: ${style.gradient};">
            <span class="card-stat-badge">${badgeText}</span>
            <span class="card-art-emoji">${style.emoji}</span>
            <div class="card-hover-play">▶</div>
        </div>
        <h4 class="card-song-title">${songItem.title.trim()}</h4>
        <p class="card-song-artist">${songItem.artist.trim()}</p>
    `;

    card.onclick = () => {
        currentPlaylist = listContext.map(s => ({ title: s.title, artist: s.artist, src: s.src, idbKey: s.idbKey }));
        const idx = currentPlaylist.findIndex(s => getSongKey(s) === getSongKey(songItem));
        startPlayer(idx >= 0 ? idx : 0);
    };
    return card;
}

function playRandomRelax() {
    if (allSongs.length === 0) return;
    currentPlaylist = [...allSongs];
    const randomIdx = Math.floor(Math.random() * currentPlaylist.length);
    startPlayer(randomIdx);
}

function playCurrentListFromStart() {
    if (currentPlaylist.length === 0) return;
    startPlayer(0);
}

// 頂部搜尋框即時篩選歌曲
function handleSearchInput(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
        openHomeDashboard();
        return;
    }
    isReorderMode = false;
    updateReorderUI();

    const listenBtn = document.getElementById('nav-listen-btn');
    switchTab('listen-tab', listenBtn);
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('song-list-view').classList.remove('hidden');

    document.getElementById('edit-current-pl-btn').classList.add('hidden');
    document.getElementById('reorder-mode-btn').classList.add('hidden');

    currentPlaylistType = 'search';
    document.getElementById('list-title').innerText = `🔍 搜尋結果：「${query.trim()}」`;
    document.getElementById('list-subtitle').innerText = `符合歌名或歌手關鍵字的曲目`;

    currentPlaylist = allSongs.filter(s =>
        s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
    );
    const container = document.getElementById('songs-container');
    container.innerHTML = '';
    renderSongs(container);
}

// 切換「✋ 編輯拖拉順序」模式
function toggleReorderMode() {
    if (currentPlaylistType !== 'custom') return;
    isReorderMode = !isReorderMode;
    updateReorderUI();
    const container = document.getElementById('songs-container');
    container.innerHTML = '';
    renderSongs(container);
}

function updateReorderUI() {
    const reorderBtn = document.getElementById('reorder-mode-btn');
    const hintBanner = document.getElementById('reorder-hint-banner');
    if (!reorderBtn || !hintBanner) return;

    if (isReorderMode && currentPlaylistType === 'custom') {
        reorderBtn.innerText = '✅ 完成排序';
        reorderBtn.classList.add('active-mode');
        hintBanner.classList.remove('hidden');
    } else {
        reorderBtn.innerText = '✋ 編輯拖拉順序';
        reorderBtn.classList.remove('active-mode');
        hintBanner.classList.add('hidden');
    }
}

// 4. 顯示歌單歌曲列表
function showSongList(type, playlistName = '') {
    isReorderMode = false;
    updateReorderUI();

    const listenBtn = document.getElementById('nav-listen-btn');
    switchTab('listen-tab', listenBtn);

    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('song-list-view').classList.remove('hidden');
    
    currentPlaylistType = type;       
    currentPlaylistName = playlistName; 
    
    const container = document.getElementById('songs-container');
    container.innerHTML = '';
    const stats = getSongStats();
    const heroCover = document.getElementById('playlist-hero-cover');
    const editPlBtn = document.getElementById('edit-current-pl-btn');
    const reorderBtn = document.getElementById('reorder-mode-btn');

    document.querySelectorAll('.lib-item').forEach(el => el.classList.remove('active'));

    if (type === 'all') {
        if (editPlBtn) editPlBtn.classList.add('hidden');
        if (reorderBtn) reorderBtn.classList.add('hidden');
        setActiveStageChip('chip-all-songs');
        const allItem = document.getElementById('lib-item-all');
        if (allItem) allItem.classList.add('active');
        document.getElementById('list-title').innerText = "所有歌曲";
        document.getElementById('list-subtitle').innerText = `收藏庫全部共 ${allSongs.length} 首歌曲`;
        if (heroCover) {
            heroCover.style.background = 'linear-gradient(135deg, #4f46e5 0%, #9333ea 55%, #ec4899 100%)';
            heroCover.innerText = '💜';
        }
        currentPlaylist = [...allSongs];
        renderSongs(container);
    } else if (type === 'most') {
        if (editPlBtn) editPlBtn.classList.add('hidden');
        if (reorderBtn) reorderBtn.classList.add('hidden');
        setActiveStageChip('chip-most');
        document.getElementById('list-title').innerText = "🔥 最常聽的歌曲排行";
        document.getElementById('list-subtitle').innerText = "依照你的累計播放次數由高至低排序";
        if (heroCover) {
            heroCover.style.background = 'linear-gradient(135deg, #f4a261 0%, #e76f51 55%, #be123c 100%)';
            heroCover.innerText = '🔥';
        }
        currentPlaylist = [...allSongs].sort((a, b) => {
            const ca = (stats[getSongKey(a)] && stats[getSongKey(a)].count) || 0;
            const cb = (stats[getSongKey(b)] && stats[getSongKey(b)].count) || 0;
            return cb - ca;
        });
        renderSongs(container);
    } else if (type === 'least') {
        if (editPlBtn) editPlBtn.classList.add('hidden');
        if (reorderBtn) reorderBtn.classList.add('hidden');
        setActiveStageChip('chip-least');
        document.getElementById('list-title').innerText = "🕰️ 最少或很久沒聽的歌曲";
        document.getElementById('list-subtitle').innerText = "從最少播放與最久未聽的歌曲開始重溫";
        if (heroCover) {
            heroCover.style.background = 'linear-gradient(135deg, #0d9488 0%, #0284c7 55%, #4f46e5 100%)';
            heroCover.innerText = '🕰️';
        }
        currentPlaylist = [...allSongs].sort((a, b) => {
            const sa = stats[getSongKey(a)] || { count: 0, lastPlayed: 0 };
            const sb = stats[getSongKey(b)] || { count: 0, lastPlayed: 0 };
            return (sa.count - sb.count) || (sa.lastPlayed - sb.lastPlayed);
        });
        renderSongs(container);
    } else if (type === 'custom') {
        if (editPlBtn) editPlBtn.classList.remove('hidden');
        if (reorderBtn) reorderBtn.classList.remove('hidden');
        document.querySelectorAll('.stage-filter-bar .filter-pill').forEach(p => p.classList.remove('active'));
        const activePlItem = document.getElementById(`lib-pl-${playlistName}`);
        if (activePlItem) activePlItem.classList.add('active');

        const coverStyle = getCoverStyle(playlistName);
        if (heroCover) {
            heroCover.style.background = coverStyle.gradient;
            heroCover.innerText = coverStyle.emoji;
        }
        document.getElementById('list-title').innerText = playlistName;
        const playlists = JSON.parse(localStorage.getItem('myPlaylists') || '{}');
        const allowedKeys = playlists[playlistName] || [];
        
        currentPlaylist = [];
        allowedKeys.forEach(k => {
            const foundSong = allSongs.find(s => getSongKey(s) === k || s.src === k);
            if (foundSong) currentPlaylist.push(foundSong);
        });
        document.getElementById('list-subtitle').innerText = `自訂分類歌單 • 共 ${currentPlaylist.length} 首歌曲`;
        renderSongs(container);
    }
}

// 5. 渲染歌曲清單 (當開啟「編輯拖拉順序」時，支援滑鼠與手機觸控直接上下拖拉排序！)
function renderSongs(container) {
    if(currentPlaylist.length === 0) {
        container.innerHTML = '<p style="color:#b4b8d8; text-align:center; padding: 28px 0;">此清單內目前沒有歌曲</p>';
        return;
    }
    const stats = getSongStats();
    
    currentPlaylist.forEach((song, index) => {
        const div = document.createElement('div');
        div.className = 'item-row';
        div.dataset.index = index;
        const st = stats[getSongKey(song)] || { count: 0, lastPlayed: 0 };
        
        const leftWrap = document.createElement('div');
        leftWrap.className = 'song-row-left';

        if (currentPlaylistType === 'custom' && isReorderMode) {
            div.classList.add('reorder-active');
            div.draggable = true;

            const handle = document.createElement('span');
            handle.className = 'drag-handle';
            handle.innerText = '☰';
            handle.title = '按住上下拖拉調整順序';
            leftWrap.appendChild(handle);

            // 電腦滑鼠 Drag & Drop 事件
            div.addEventListener('dragstart', (e) => {
                draggedSongIndex = index;
                div.classList.add('dragging');
                if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
            });
            div.addEventListener('dragover', (e) => {
                e.preventDefault();
                div.classList.add('drag-over');
            });
            div.addEventListener('dragleave', () => {
                div.classList.remove('drag-over');
            });
            div.addEventListener('drop', (e) => {
                e.preventDefault();
                div.classList.remove('drag-over');
                if (draggedSongIndex !== null && draggedSongIndex !== index) {
                    reorderPlaylistArray(draggedSongIndex, index);
                }
            });
            div.addEventListener('dragend', () => {
                div.classList.remove('dragging');
                draggedSongIndex = null;
            });

            // 手機觸控 Touch 拖拉事件
            handle.addEventListener('touchstart', () => {
                draggedSongIndex = index;
                div.classList.add('dragging');
            }, { passive: true });

            handle.addEventListener('touchmove', (e) => {
                if (draggedSongIndex === null || e.touches.length === 0) return;
                e.preventDefault();
                const touch = e.touches[0];
                const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
                const targetRow = targetEl ? targetEl.closest('.item-row') : null;
                if (targetRow && targetRow.dataset.index !== undefined) {
                    const overIndex = parseInt(targetRow.dataset.index, 10);
                    if (!isNaN(overIndex) && overIndex !== draggedSongIndex) {
                        reorderPlaylistArray(draggedSongIndex, overIndex);
                        draggedSongIndex = overIndex;
                    }
                }
            }, { passive: false });

            handle.addEventListener('touchend', () => {
                div.classList.remove('dragging');
                draggedSongIndex = null;
            });
        } else {
            leftWrap.onclick = () => startPlayer(index);
        }

        const numSpan = document.createElement('span');
        numSpan.className = 'track-num';
        numSpan.innerText = index + 1;

        const infoDiv = document.createElement('div');
        infoDiv.className = 'song-info';
        infoDiv.innerHTML = `<strong>${song.title}</strong><span class="song-artist-sub">${song.artist}</span>`;

        leftWrap.appendChild(numSpan);
        leftWrap.appendChild(infoDiv);
        div.appendChild(leftWrap);

        const statPill = document.createElement('span');
        statPill.className = 'song-stat-pill';
        statPill.innerText = st.count > 0 ? `🎧 已聽 ${st.count} 次` : '✨ 尚未播放';
        if (!isReorderMode) {
            statPill.onclick = () => startPlayer(index);
        }
        div.appendChild(statPill);

        container.appendChild(div);
    });
}

function reorderPlaylistArray(fromIndex, toIndex) {
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= currentPlaylist.length || toIndex >= currentPlaylist.length) return;
    const [movedSong] = currentPlaylist.splice(fromIndex, 1);
    currentPlaylist.splice(toIndex, 0, movedSong);

    if (currentPlaylistType === 'custom' && currentPlaylistName) {
        const playlists = JSON.parse(localStorage.getItem('myPlaylists') || '{}');
        playlists[currentPlaylistName] = currentPlaylist.map(song => getSongKey(song));
        localStorage.setItem('myPlaylists', JSON.stringify(playlists));
    }

    const container = document.getElementById('songs-container');
    container.innerHTML = '';
    renderSongs(container);
}

// 渲染左側欄分類歌單清單
async function showPlaylistList() {
    const container = document.getElementById('playlist-names-container');
    if (!container) return;
    container.innerHTML = '';
    
    const playlists = JSON.parse(localStorage.getItem('myPlaylists') || '{}');
    const names = Object.keys(playlists);
    
    if(names.length === 0) {
        container.innerHTML = '<p style="color:#7e83a8; font-size:12.5px; padding: 8px 10px;">尚無自訂歌單，點上方「＋ 管理歌單」即可建立</p>';
        return;
    }
    
    names.forEach(name => {
        const div = document.createElement('div');
        div.id = `lib-pl-${name}`;
        div.className = 'lib-item';
        if (currentPlaylistType === 'custom' && currentPlaylistName === name) {
            div.classList.add('active');
        }
        const style = getCoverStyle(name);
        div.innerHTML = `
            <div class="lib-cover" style="background: ${style.gradient};">${style.emoji}</div>
            <div class="lib-info">
                <strong>${name}</strong>
                <span>播放清單 • ${playlists[name].length} 首歌曲</span>
            </div>
        `;
        div.onclick = () => showSongList('custom', name);
        container.appendChild(div);
    });
}

// 6. 核心音樂播放器控制 (搭配可愛跑步貓咪動畫狀態)
function startPlayer(index) {
    songIndex = index;
    const song = currentPlaylist[songIndex];
    loadSong(song);
    recordSongPlay(song);
    playSong();
}

function loadSong(song) {
    if (!song) return;
    if (songMeta) {
        songMeta.classList.remove('fade-song');
        void songMeta.offsetWidth;
        songMeta.classList.add('fade-song');
    }
    title.innerText = song.title;
    artist.innerText = song.artist;
    if (playerCover) {
        const style = getCoverStyle(song.title + song.artist);
        playerCover.style.background = style.gradient;
        playerCover.innerText = style.emoji;
    }
    audio.src = song.src;
    progress.style.width = '0%';
    if (currentTimeEl) currentTimeEl.innerText = '0:00';
    if (durationEl) durationEl.innerText = '0:00';
    updateMediaSession(song);
}

function updateMediaSession(song) {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.title,
            artist: song.artist
        });
    }
}

function setupMediaSessionHandlers() {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', () => {
            playSong();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
            pauseSong();
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
            prevSong();
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
            nextSong();
        });
        navigator.mediaSession.setActionHandler('seekto', (details) => {
            if (details.fastSeek && 'fastSeek' in audio) {
                audio.fastSeek(details.seekTime);
                return;
            }
            audio.currentTime = details.seekTime;
        });
    }
}

function playSong() {
    if (!audio.src && allSongs.length > 0) {
        currentPlaylist = [...allSongs];
        startPlayer(0);
        return;
    }
    isPlaying = true;
    playBtn.innerText = '⏸';
    if (playerView) playerView.classList.add('is-playing');
    audio.play();
    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
    }
}
function pauseSong() {
    isPlaying = false;
    playBtn.innerText = '▶';
    if (playerView) playerView.classList.remove('is-playing');
    audio.pause();
    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
    }
}

playBtn.addEventListener('click', () => { if (isPlaying) { pauseSong(); } else { playSong(); } });

function nextSong() {
    if (currentPlaylist.length === 0) return;

    if (isShuffle) {
        if (currentPlaylist.length > 1) {
            let newIndex = songIndex;
            while (newIndex === songIndex) {
                newIndex = Math.floor(Math.random() * currentPlaylist.length);
            }
            songIndex = newIndex;
        } else {
            songIndex = 0;
        }
    } else {
        songIndex = (songIndex + 1) % currentPlaylist.length;
    }
    const song = currentPlaylist[songIndex];
    loadSong(song);
    recordSongPlay(song);
    playSong();
}

function prevSong() {
    if (currentPlaylist.length === 0) return;

    if (isShuffle) {
        if (currentPlaylist.length > 1) {
            let newIndex = songIndex;
            while (newIndex === songIndex) {
                newIndex = Math.floor(Math.random() * currentPlaylist.length);
            }
            songIndex = newIndex;
        } else {
            songIndex = 0;
        }
    } else {
        songIndex = (songIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
    }
    const song = currentPlaylist[songIndex];
    loadSong(song);
    recordSongPlay(song);
    playSong();
}

nextBtn.addEventListener('click', nextSong);
prevBtn.addEventListener('click', prevSong);

shuffleBtn.addEventListener('click', () => {
    isShuffle = !isShuffle;
    if (isShuffle) {
        shuffleBtn.classList.add('active');
        shuffleBtn.innerText = '🔀 隨機：開';
    } else {
        shuffleBtn.classList.remove('active');
        shuffleBtn.innerText = '🔀 隨機：關';
    }
});

if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
        audio.volume = parseFloat(e.target.value);
    });
}

function seekByClientX(clientX) {
    if (!audio.duration) return;
    const rect = progressContainer.getBoundingClientRect();
    const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    audio.currentTime = ratio * audio.duration;
    progress.style.width = `${ratio * 100}%`;
    if (currentTimeEl) currentTimeEl.innerText = formatTime(audio.currentTime);
}

function setupAudioEvents() {
    audio.addEventListener('loadedmetadata', () => {
        if (durationEl) durationEl.innerText = formatTime(audio.duration);
    });

    audio.addEventListener('play', () => {
        if (playerView) playerView.classList.add('is-playing');
    });

    audio.addEventListener('pause', () => {
        if (playerView) playerView.classList.remove('is-playing');
    });

    audio.addEventListener('timeupdate', () => {
        if (!isDraggingProgress && audio.duration) {
            progress.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
            if (currentTimeEl) currentTimeEl.innerText = formatTime(audio.currentTime);
            if (durationEl && durationEl.innerText === '0:00') {
                durationEl.innerText = formatTime(audio.duration);
            }
        }
    });

    progressContainer.addEventListener('mousedown', (e) => {
        isDraggingProgress = true;
        seekByClientX(e.clientX);
    });
    window.addEventListener('mousemove', (e) => {
        if (isDraggingProgress) seekByClientX(e.clientX);
    });
    window.addEventListener('mouseup', () => {
        isDraggingProgress = false;
    });

    progressContainer.addEventListener('touchstart', (e) => {
        isDraggingProgress = true;
        if (e.touches.length > 0) seekByClientX(e.touches[0].clientX);
    }, { passive: true });
    progressContainer.addEventListener('touchmove', (e) => {
        if (isDraggingProgress && e.touches.length > 0) seekByClientX(e.touches[0].clientX);
    }, { passive: true });
    progressContainer.addEventListener('touchend', () => {
        isDraggingProgress = false;
    });

    audio.addEventListener('ended', nextSong); 
}

// 7. 電腦端 API 功能：線上下載 YouTube 音樂 (單首)
async function downloadYouTubeSong() {
    const url = document.getElementById('yt-url').value;
    const titleVal = document.getElementById('song-title').value;
    const artistVal = document.getElementById('song-artist').value;
    const filename = document.getElementById('song-filename').value;
    const status = document.getElementById('add-status');

    if(!url || !titleVal || !artistVal || !filename) { status.innerText = "❌ 請填寫所有欄位！"; return; }
    status.style.color = "#f4a261"; status.innerText = "⏳ 正在線上下載並轉檔中，請稍候...";

    try {
        const res = await fetch('/api/add_song', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, title: titleVal, artist: artistVal, filename })
        });
        const data = await res.json();
        if(res.ok) {
            status.style.color = "#f4a261";
            status.innerText = `✅ ${data.message}`;
            await loadAllSongs();
            renderDashboardRecommendations();
            document.getElementById('yt-url').value = ''; document.getElementById('song-title').value = ''; document.getElementById('song-artist').value = ''; document.getElementById('song-filename').value = '';
        } else {
            status.innerText = `❌ 錯誤: ${data.message}`;
        }
    } catch (e) { status.innerText = "❌ 無法連線到本地 Python 後台"; }
}

// 8. 電腦端 API 功能：批次下載所有歌曲
async function batchDownloadSongs() {
    const batchInput = document.getElementById('batch-input').value;
    const status = document.getElementById('add-status');
    
    if (!batchInput) {
        status.innerText = "❌ 請貼上備忘錄資料！";
        return;
    }
    
    try {
        const songsToDownload = JSON.parse(batchInput);
        if (!Array.isArray(songsToDownload)) {
            status.innerText = "❌ 資料格式錯誤，必須是從手機複製的備忘錄格式！";
            return;
        }
        
        status.style.color = "#f4a261";
        status.innerText = `⏳ 正在批次下載 ${songsToDownload.length} 首歌曲，這需要一些時間，請稍候...`;
        
        const res = await fetch('/api/batch_add_songs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ songs: songsToDownload })
        });
        
        const data = await res.json();
        if (res.ok) {
            status.style.color = "#f4a261";
            status.innerText = `✅ ${data.message}`;
            document.getElementById('batch-input').value = '';
            await loadAllSongs();
            renderDashboardRecommendations();
        } else {
            status.innerText = `❌ 錯誤: ${data.message}`;
        }
    } catch (e) {
        status.innerText = "❌ 解析失敗！請確認貼上的資料是否完整。";
    }
}

// ================= 歌單建立、編輯與刪除 =================
function renderPlaylistCheckboxes(selectedSrcs = []) {
    const container = document.getElementById('playlist-songs-checkboxes');
    if(!container) return;
    container.innerHTML = '';
    if(allSongs.length === 0) { container.innerHTML = '暫無歌曲可供選擇'; return; }
    allSongs.forEach(song => {
        const key = getSongKey(song);
        const div = document.createElement('div');
        div.className = 'checkbox-item';
        const isChecked = (selectedSrcs.includes(key) || selectedSrcs.includes(song.src)) ? 'checked' : '';
        div.innerHTML = `
            <input type="checkbox" name="playlist-song" value="${key}" ${isChecked}>
            <label onclick="this.previousElementSibling.click()" style="cursor:pointer; flex:1;">${song.title} - <span style="color:#b4b8d8;">${song.artist}</span></label>
        `;
        container.appendChild(div);
    });
}

function toggleAllPlaylistCheckboxes(checked) {
    document.querySelectorAll('input[name="playlist-song"]').forEach(cb => {
        cb.checked = checked;
    });
}

async function createPlaylist() {
    const name = document.getElementById('new-playlist-name').value.trim();
    const status = document.getElementById('playlist-status');
    const checkboxes = document.querySelectorAll('input[name="playlist-song"]:checked');
    
    if(!name) { status.innerText = "❌ 請輸入歌單名稱！"; return; }
    if(checkboxes.length === 0) { status.innerText = "❌ 請至少勾選一首歌！"; return; }

    const selectedSongs = Array.from(checkboxes).map(cb => cb.value);

    const playlists = JSON.parse(localStorage.getItem('myPlaylists') || '{}');
    playlists[name] = selectedSongs;
    localStorage.setItem('myPlaylists', JSON.stringify(playlists));

    if (isLocalMode) {
        fetch('/api/save_playlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, songs: selectedSongs })
        }).catch(() => {});
    }

    status.innerText = `✅ 歌單【${name}】已儲存成功！`;
    document.getElementById('new-playlist-name').value = '';
    checkboxes.forEach(cb => cb.checked = false);
    showPlaylistList();
    renderManagePlaylists();
}

function renderManagePlaylists() {
    const container = document.getElementById('manage-playlists-container');
    if (!container) return;
    container.innerHTML = '';

    const playlists = JSON.parse(localStorage.getItem('myPlaylists') || '{}');
    const names = Object.keys(playlists);

    if (names.length === 0) {
        container.innerHTML = '<p style="color:#b4b8d8; font-size:13.5px; text-align:center;">目前還沒有建立任何分類歌單</p>';
        return;
    }

    names.forEach(name => {
        const div = document.createElement('div');
        div.className = 'item-row';
        div.style.cursor = 'default';

        const info = document.createElement('div');
        info.className = 'song-info';
        info.innerHTML = `<strong>🗂️ ${name}</strong><span class="song-artist-sub">共 ${playlists[name].length} 首歌曲</span>`;

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '8px';

        const editBtn = document.createElement('button');
        editBtn.className = 'copy-pill-btn';
        editBtn.innerText = '✏️ 增減歌曲';
        editBtn.onclick = () => loadPlaylistIntoEditor(name);

        const orderBtn = document.createElement('button');
        orderBtn.className = 'copy-pill-btn';
        orderBtn.innerText = '✋ 拖拉排序';
        orderBtn.onclick = () => {
            showSongList('custom', name);
            if (!isReorderMode) toggleReorderMode();
        };

        const delBtn = document.createElement('button');
        delBtn.className = 'memo-delete-btn';
        delBtn.style.width = 'auto';
        delBtn.style.padding = '0 10px';
        delBtn.innerText = '🗑️ 刪除';
        delBtn.onclick = () => deletePlaylist(name);

        actions.appendChild(editBtn);
        actions.appendChild(orderBtn);
        actions.appendChild(delBtn);

        div.appendChild(info);
        div.appendChild(actions);
        container.appendChild(div);
    });
}

function loadPlaylistIntoEditor(name) {
    const playlists = JSON.parse(localStorage.getItem('myPlaylists') || '{}');
    const selectedSrcs = playlists[name] || [];
    const nameInput = document.getElementById('new-playlist-name');
    if (nameInput) nameInput.value = name;
    renderPlaylistCheckboxes(selectedSrcs);
    const status = document.getElementById('playlist-status');
    if (status) status.innerText = `✏️ 已載入歌單【${name}】，勾選或取消勾選歌曲後點擊「儲存歌單」即可完成修改！`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function editCurrentCustomPlaylist() {
    if (currentPlaylistType !== 'custom' || !currentPlaylistName) return;
    const plName = currentPlaylistName;
    const plBtn = document.getElementById('nav-playlist-btn');
    switchTab('playlist-tab', plBtn);
    loadPlaylistIntoEditor(plName);
}

function deletePlaylist(name) {
    if (!confirm(`確定要刪除歌單【${name}】嗎？`)) return;
    const playlists = JSON.parse(localStorage.getItem('myPlaylists') || '{}');
    delete playlists[name];
    localStorage.setItem('myPlaylists', JSON.stringify(playlists));
    showPlaylistList();
    renderManagePlaylists();
    if (currentPlaylistType === 'custom' && currentPlaylistName === name) {
        openHomeDashboard();
    }
}

// 9. 📝 備忘錄專用核心邏輯
function renderMemo() {
    const container = document.getElementById('memo-list-container');
    if (!container) return;
    container.innerHTML = '';
    
    const memoList = JSON.parse(localStorage.getItem('myMemo') || '[]');
    if (memoList.length === 0) {
        container.innerHTML = '<p style="color:#b4b8d8; text-align:center; font-size:13.5px; margin-top:15px;">目前備忘錄空空如也</p>';
        return;
    }
    
    memoList.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'item-row';
        div.style.cursor = 'default';
        div.innerHTML = `
            <div class="song-info">
                <strong>${item.title} <span style="font-weight:400; color:#b4b8d8;">- ${item.artist}</span></strong>
                <span style="font-size:11.5px; color:#7e83a8; word-break:break-all;">${item.url}</span>
            </div>
            <button class="memo-delete-btn" onclick="deleteMemoItem(${index})" title="刪除">✕</button>
        `;
        container.appendChild(div);
    });
}

function addToMemo() {
    const url = document.getElementById('memo-url').value;
    const titleVal = document.getElementById('memo-title').value;
    const artistVal = document.getElementById('memo-artist').value;
    const filename = document.getElementById('memo-filename').value;
    
    if(!url || !titleVal || !artistVal || !filename) {
        alert("請填寫所有欄位！");
        return;
    }
    
    const memoList = JSON.parse(localStorage.getItem('myMemo') || '[]');
    memoList.push({ url, title: titleVal, artist: artistVal, filename });
    localStorage.setItem('myMemo', JSON.stringify(memoList));
    
    document.getElementById('memo-url').value = '';
    document.getElementById('memo-title').value = '';
    document.getElementById('memo-artist').value = '';
    document.getElementById('memo-filename').value = '';
    
    renderMemo();
}

function deleteMemoItem(index) {
    const memoList = JSON.parse(localStorage.getItem('myMemo') || '[]');
    memoList.splice(index, 1);
    localStorage.setItem('myMemo', JSON.stringify(memoList));
    renderMemo();
}

function copyMemoData() {
    const memoList = localStorage.getItem('myMemo') || '[]';
    if (memoList === '[]') {
        alert("備忘錄裡沒有資料可以複製喔！");
        return;
    }
    
    navigator.clipboard.writeText(memoList).then(() => {
        alert("📋 備忘錄資料已成功複製到剪貼簿！\n請將這段文字傳到電腦貼上。");
    }).catch(err => {
        alert("複製失敗，請手動選取複製。");
    });
}

init();
