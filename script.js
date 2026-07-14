const audio = document.getElementById('audio');
const playBtn = document.getElementById('play');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const shuffleBtn = document.getElementById('shuffle-btn'); // 👈 新增隨機按鈕
const title = document.getElementById('title');
const artist = document.getElementById('artist');
const progress = document.getElementById('progress');
const progressContainer = document.getElementById('progress-container');

let allSongs = [];           // 儲存總歌單
let currentPlaylist = [];       // 當前播放模式中的歌曲清單
let songIndex = 0;
let isPlaying = false;
let isLocalMode = false;       // 判斷是否為電腦本機執行

// 隨機播放與歌單移動所需的變數
let isShuffle = false;         // 👈 紀錄隨機播放是否開啟
let currentPlaylistType = 'all'; // 👈 紀錄目前看的是 'all' 還是 'custom'
let currentPlaylistName = '';   // 👈 紀錄目前打開的自訂歌單名稱 (例如 '中文')

async function init() {
    await checkEnvironment();
    await loadAllSongs();
    setupAudioEvents();
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
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    event.target.classList.add('active');
    
    if(tabId === 'playlist-tab') {
        renderPlaylistCheckboxes();
    }
}

// 4. 聽歌子頁面切換控制
function showSongList(type, playlistName = '') {
    document.getElementById('listen-menu').classList.add('hidden');
    document.getElementById('playlist-selector-view').classList.add('hidden');
    document.getElementById('song-list-view').classList.remove('hidden');
    
    currentPlaylistType = type;       // 👈 紀錄當前類型
    currentPlaylistName = playlistName; // 👈 紀錄歌單名稱
    
    const container = document.getElementById('songs-container');
    container.innerHTML = '';
    
    if (type === 'all') {
        document.getElementById('list-title').innerText = "🌐 所有歌曲";
        currentPlaylist = [...allSongs];
        renderSongs(container);
    } else if (type === 'custom') {
        document.getElementById('list-title').innerText = `🗂️ 歌單：${playlistName}`;
        const playlists = JSON.parse(localStorage.getItem('myPlaylists') || '{}');
        const allowedSrcs = playlists[playlistName] || [];
        
        // 👈 核心修改：依照使用者儲存的順序來排列歌曲
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
        container.innerHTML = '<p style="color:#aaa; text-align:center;">此歌單內還沒有歌曲</p>';
        return;
    }
    
    currentPlaylist.forEach((song, index) => {
        const div = document.createElement('div');
        div.className = 'item-row';
        
        // 左側歌曲資訊 (點擊這裡才播放)
        const infoDiv = document.createElement('div');
        infoDiv.className = 'song-info';
        infoDiv.innerHTML = `<strong>${song.title}</strong><br><span style="color:#aaa; font-size:14px;">${song.artist}</span>`;
        infoDiv.onclick = () => startPlayer(index);
        div.appendChild(infoDiv);

        // 👈 新增：如果是在自訂歌單，右側顯示「上移 / 下移」按鈕
        if (currentPlaylistType === 'custom') {
            const btnDiv = document.createElement('div');
            btnDiv.className = 'reorder-btns';
            
            // 上移按鈕 (第一首歌不顯示)
            if (index > 0) {
                const upBtn = document.createElement('button');
                upBtn.className = 'reorder-btn';
                upBtn.innerText = '▲';
                upBtn.onclick = (e) => {
                    e.stopPropagation(); // 👈 防止觸發播放音樂
                    moveSong(index, -1);
                };
                btnDiv.appendChild(upBtn);
            }

            // 下移按鈕 (最後一首歌不顯示)
            if (index < currentPlaylist.length - 1) {
                const downBtn = document.createElement('button');
                downBtn.className = 'reorder-btn';
                downBtn.innerText = '▼';
                downBtn.onclick = (e) => {
                    e.stopPropagation(); // 👈 防止觸發播放音樂
                    moveSong(index, 1);
                };
                btnDiv.appendChild(downBtn);
            }
            div.appendChild(btnDiv);
        }

        container.appendChild(div);
    });
}

// 👈 新增：移動歌曲位置與存檔邏輯
function moveSong(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= currentPlaylist.length) return;

    // 1. 在記憶體陣列中交換兩首歌的位置
    const temp = currentPlaylist[index];
    currentPlaylist[index] = currentPlaylist[targetIndex];
    currentPlaylist[targetIndex] = temp;

    // 2. 如果是自訂歌單，將新順序更新存入 LocalStorage
    if (currentPlaylistType === 'custom' && currentPlaylistName) {
        const playlists = JSON.parse(localStorage.getItem('myPlaylists') || '{}');
        playlists[currentPlaylistName] = currentPlaylist.map(song => song.src);
        localStorage.setItem('myPlaylists', JSON.stringify(playlists));
    }

    // 3. 重新渲染畫面清單
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
        container.innerHTML = '<p style="color:#aaa; text-align:center;">目前還沒有建立任何分類歌單</p>';
        return;
    }
    
    names.forEach(name => {
        const div = document.createElement('div');
        div.className = 'item-row';
        div.innerText = `📁 ${name} (${playlists[name].length} 首)`;
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
    title.innerText = song.title;
    artist.innerText = song.artist;
    audio.src = song.src;
}

function playSong() { isPlaying = true; playBtn.innerText = '⏸ 暫停'; audio.play(); }
function pauseSong() { isPlaying = false; playBtn.innerText = '▶ 播放'; audio.pause(); }

playBtn.addEventListener('click', () => { if (isPlaying) { pauseSong(); } else { playSong(); } });

// 👈 核心修改：下一首邏輯（支援隨機播放）
function nextSong() {
    if (currentPlaylist.length === 0) return;

    if (isShuffle) {
        // 如果開啟隨機播放，且歌單大於 1 首歌，就選一首非當前的隨機歌曲
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
        // 順序播放下一首
        songIndex = (songIndex + 1) % currentPlaylist.length;
    }
    loadSong(currentPlaylist[songIndex]);
    playSong();
}

// 👈 核心修改：上一首邏輯（支援隨機播放）
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
        // 順序播放上一首
        songIndex = (songIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
    }
    loadSong(currentPlaylist[songIndex]);
    playSong();
}

nextBtn.addEventListener('click', nextSong);
prevBtn.addEventListener('click', prevSong);

// 👈 新增：綁定隨機播放按鈕點擊事件
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

function setupAudioEvents() {
    audio.addEventListener('timeupdate', () => { if (audio.duration) progress.style.width = `${(audio.currentTime / audio.duration) * 100}%`; });
    progressContainer.addEventListener('click', (e) => { if (audio.duration) audio.currentTime = (e.offsetX / progressContainer.clientWidth) * audio.duration; });
    audio.addEventListener('ended', nextSong); // 歌曲播完會自動觸發 nextSong
}

// 7. 電腦端 API 功能
async function downloadYouTubeSong() {
    const url = document.getElementById('yt-url').value;
    const titleVal = document.getElementById('song-title').value;
    const artistVal = document.getElementById('song-artist').value;
    const filename = document.getElementById('song-filename').value;
    const status = document.getElementById('add-status');

    if(!url || !titleVal || !artistVal || !filename) { status.innerText = "❌ 請填寫所有欄位！"; return; }
    status.style.color = "#1db954"; status.innerText = "⏳ 正在線上下載並轉檔中，請稍候...";

    try {
        const res = await fetch('/api/add_song', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, title: titleVal, artist: artistVal, filename })
        });
        const data = await res.json();
        if(res.ok) {
            status.innerText = `✅ ${data.message}`;
            await loadAllSongs();
            document.getElementById('yt-url').value = ''; document.getElementById('song-title').value = ''; document.getElementById('song-artist').value = ''; document.getElementById('song-filename').value = '';
        } else {
            status.innerText = `❌ 錯誤: ${data.message}`;
        }
    } catch (e) { status.innerText = "❌ 無法連線到本地 Python 後台"; }
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

init();