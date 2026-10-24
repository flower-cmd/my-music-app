const audio = document.getElementById('audio');
const playBtn = document.getElementById('play');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const shuffleBtn = document.getElementById('shuffle-btn');
const title = document.getElementById('title');
const artist = document.getElementById('artist');
const songMeta = document.getElementById('song-meta');
const progress = document.getElementById('progress');
const progressContainer = document.getElementById('progress-container');
const currentTimeEl = document.getElementById('current-time');
const durationEl = document.getElementById('duration');

let allSongs = [];           
let currentPlaylist = [];       
let songIndex = 0;
let isPlaying = false;
let isLocalMode = false;       

let isShuffle = false;         
let currentPlaylistType = 'all'; 
let currentPlaylistName = '';   
let isDraggingProgress = false;

async function init() {
    await checkEnvironment();
    await loadAllSongs();
    setupAudioEvents();
    setupMediaSessionHandlers();
    renderMemo(); // 👈 初始化載入備忘錄
}

// 格式化秒數為 m:ss
function formatTime(seconds) {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
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

    if (!isLocalMode) {
        document.getElementById('local-add-form').classList.add('hidden');
        document.getElementById('github-add-msg').classList.remove('hidden');
        document.getElementById('local-playlist-form').classList.add('hidden');
        document.getElementById('github-playlist-msg').classList.remove('hidden');
    }
}

// 2. 讀取總歌單
async function loadAllSongs() {
    try {
        const response = await fetch('songs.json?t=' + Date.now());
        allSongs = await response.json();
        renderPlaylistCheckboxes();
    } catch (error) {
        console.error("無法讀取 songs.json", error);
    }
}

// 3. 底部主要分頁切換
function switchTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    if (btnElement) {
        btnElement.classList.add('active');
    }
    
    if(tabId === 'playlist-tab') {
        renderPlaylistCheckboxes();
    }
}

// 4. 聽歌子頁面切換控制
function showSongList(type, playlistName = '') {
    document.getElementById('listen-menu').classList.add('hidden');
    document.getElementById('playlist-selector-view').classList.add('hidden');
    document.getElementById('song-list-view').classList.remove('hidden');
    
    currentPlaylistType = type;       
    currentPlaylistName = playlistName; 
    
    const container = document.getElementById('songs-container');
    container.innerHTML = '';
    
    if (type === 'all') {
        document.getElementById('list-title').innerText = "🌌 所有歌曲";
        currentPlaylist = [...allSongs];
        renderSongs(container);
    } else if (type === 'custom') {
        document.getElementById('list-title').innerText = `🕯️ 歌單：${playlistName}`;
        const playlists = JSON.parse(localStorage.getItem('myPlaylists') || '{}');
        const allowedSrcs = playlists[playlistName] || [];
        
        currentPlaylist = [];
        allowedSrcs.forEach(src => {
            const foundSong = allSongs.find(s => s.src === src);
            if (foundSong) currentPlaylist.push(foundSong);
        });
        
        renderSongs(container);
    }
}

// 5. 渲染歌曲清單 (加上移動按鈕)
function renderSongs(container) {
    if(currentPlaylist.length === 0) {
        container.innerHTML = '<p style="color:#9fa4c4; text-align:center; padding: 20px 0;">此歌單內還沒有歌曲</p>';
        return;
    }
    
    currentPlaylist.forEach((song, index) => {
        const div = document.createElement('div');
        div.className = 'item-row';
        
        const infoDiv = document.createElement('div');
        infoDiv.className = 'song-info';
        infoDiv.innerHTML = `<strong>${song.title}</strong><span class="song-artist-sub">${song.artist}</span>`;
        infoDiv.onclick = () => startPlayer(index);
        div.appendChild(infoDiv);

        if (currentPlaylistType === 'custom') {
            const btnDiv = document.createElement('div');
            btnDiv.className = 'reorder-btns';
            
            if (index > 0) {
                const upBtn = document.createElement('button');
                upBtn.className = 'reorder-btn';
                upBtn.innerText = '▲';
                upBtn.onclick = (e) => {
                    e.stopPropagation(); 
                    moveSong(index, -1);
                };
                btnDiv.appendChild(upBtn);
            }

            if (index < currentPlaylist.length - 1) {
                const downBtn = document.createElement('button');
                downBtn.className = 'reorder-btn';
                downBtn.innerText = '▼';
                downBtn.onclick = (e) => {
                    e.stopPropagation(); 
                    moveSong(index, 1);
                };
                btnDiv.appendChild(downBtn);
            }
            div.appendChild(btnDiv);
        }

        container.appendChild(div);
    });
}

function moveSong(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= currentPlaylist.length) return;

    const temp = currentPlaylist[index];
    currentPlaylist[index] = currentPlaylist[targetIndex];
    currentPlaylist[targetIndex] = temp;

    if (currentPlaylistType === 'custom' && currentPlaylistName) {
        const playlists = JSON.parse(localStorage.getItem('myPlaylists') || '{}');
        playlists[currentPlaylistName] = currentPlaylist.map(song => song.src);
        localStorage.setItem('myPlaylists', JSON.stringify(playlists));
    }

    const container = document.getElementById('songs-container');
    container.innerHTML = '';
    renderSongs(container);
}

// 顯示分類歌單清單
async function showPlaylistList() {
    document.getElementById('listen-menu').classList.add('hidden');
    document.getElementById('playlist-selector-view').classList.remove('hidden');
    const container = document.getElementById('playlist-names-container');
    container.innerHTML = '';
    
    const playlists = JSON.parse(localStorage.getItem('myPlaylists') || '{}');
    const names = Object.keys(playlists);
    
    if(names.length === 0) {
        container.innerHTML = '<p style="color:#9fa4c4; text-align:center; padding: 20px 0;">目前還沒有建立任何分類歌單</p>';
        return;
    }
    
    names.forEach(name => {
        const div = document.createElement('div');
        div.className = 'item-row';
        div.innerHTML = `
            <div class="song-info">
                <strong>🕯️ ${name}</strong>
                <span class="song-artist-sub">共 ${playlists[name].length} 首歌曲</span>
            </div>
            <span style="color:#9fa4c4; font-size:20px;">›</span>
        `;
        div.onclick = () => showSongList('custom', name);
        container.appendChild(div);
    });
}

function backToListenMenu() {
    document.getElementById('song-list-view').classList.add('hidden');
    document.getElementById('playlist-selector-view').classList.add('hidden');
    document.getElementById('listen-menu').classList.remove('hidden');
}

function backToSongList() {
    document.getElementById('player-view').classList.add('hidden');
    document.getElementById('song-list-view').classList.remove('hidden');
}

// 6. 核心音樂播放器控制
function startPlayer(index) {
    document.getElementById('song-list-view').classList.add('hidden');
    document.getElementById('player-view').classList.remove('hidden');
    songIndex = index;
    loadSong(currentPlaylist[songIndex]);
    playSong();
}

function loadSong(song) {
    if (songMeta) {
        songMeta.classList.remove('fade-song');
        void songMeta.offsetWidth; // 觸發重繪以重新播放淡入動畫
        songMeta.classList.add('fade-song');
    }
    title.innerText = song.title;
    artist.innerText = song.artist;
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
    isPlaying = true;
    playBtn.innerText = '⏸ 暫停';
    audio.play();
    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
    }
}
function pauseSong() {
    isPlaying = false;
    playBtn.innerText = '▶ 播放';
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
    loadSong(currentPlaylist[songIndex]);
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
    loadSong(currentPlaylist[songIndex]);
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

    audio.addEventListener('timeupdate', () => {
        if (!isDraggingProgress && audio.duration) {
            progress.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
            if (currentTimeEl) currentTimeEl.innerText = formatTime(audio.currentTime);
            if (durationEl && durationEl.innerText === '0:00') {
                durationEl.innerText = formatTime(audio.duration);
            }
        }
    });

    // 支援點擊與滑動拖曳進度條 (滑鼠 + 手機觸控)
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
        } else {
            status.innerText = `❌ 錯誤: ${data.message}`;
        }
    } catch (e) {
        status.innerText = "❌ 解析失敗！請確認貼上的資料是否完整。";
    }
}

function renderPlaylistCheckboxes() {
    const container = document.getElementById('playlist-songs-checkboxes');
    if(!container) return;
    container.innerHTML = '';
    if(allSongs.length === 0) { container.innerHTML = '暫無歌曲可供選擇'; return; }
    allSongs.forEach(song => {
        const div = document.createElement('div');
        div.className = 'checkbox-item';
        div.innerHTML = `<input type="checkbox" name="playlist-song" value="${song.src}"> <label>${song.title} - ${song.artist}</label>`;
        container.appendChild(div);
    });
}

async function createPlaylist() {
    const name = document.getElementById('new-playlist-name').value;
    const status = document.getElementById('playlist-status');
    const checkboxes = document.querySelectorAll('input[name="playlist-song"]:checked');
    
    if(!name) { status.innerText = "❌ 請輸入歌單名稱！"; return; }
    if(checkboxes.length === 0) { status.innerText = "❌ 請至少勾選一首歌！"; return; }

    const selectedSongs = Array.from(checkboxes).map(cb => cb.value);

    const playlists = JSON.parse(localStorage.getItem('myPlaylists') || '{}');
    playlists[name] = selectedSongs;
    localStorage.setItem('myPlaylists', JSON.stringify(playlists));

    status.innerText = `✅ 歌單【${name}】已儲存到此裝置！`;
    document.getElementById('new-playlist-name').value = '';
    checkboxes.forEach(cb => cb.checked = false);
}

// 9. 📝 備忘錄專用核心邏輯 (手機端/電腦端皆可執行)
function renderMemo() {
    const container = document.getElementById('memo-list-container');
    if (!container) return;
    container.innerHTML = '';
    
    const memoList = JSON.parse(localStorage.getItem('myMemo') || '[]');
    if (memoList.length === 0) {
        container.innerHTML = '<p style="color:#9fa4c4; text-align:center; font-size:13.5px; margin-top:15px;">目前備忘錄空空如也</p>';
        return;
    }
    
    memoList.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'item-row';
        div.style.cursor = 'default';
        div.innerHTML = `
            <div class="song-info">
                <strong>${item.title} <span style="font-weight:400; color:#9fa4c4;">- ${item.artist}</span></strong>
                <span style="font-size:11.5px; color:#6e7396; word-break:break-all;">${item.url}</span>
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
    
    // 清空輸入
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
