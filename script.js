const audio = document.getElementById('audio');
const playBtn = document.getElementById('play');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const title = document.getElementById('title');
const artist = document.getElementById('artist');
const progress = document.getElementById('progress');
const progressContainer = document.getElementById('progress-container');

let allSongs = [];       // 儲存總歌單
let currentPlaylist = [];   // 當前播放模式中的歌曲清單
let songIndex = 0;
let isPlaying = false;
let isLocalMode = false;   // 判斷是否為電腦本機執行

async function init() {
    await checkEnvironment();
    await loadAllSongs();
    setupAudioEvents();
}

// 1. 自動判斷環境：看能不能連到 Python 後台 API
async function checkEnvironment() {
    try {
        const res = await fetch('/api/is_local');
        const data = await res.json();
        if (data.local) isLocalMode = true;
    } catch (e) {
        isLocalMode = false; // 連不到代表在手機 GitHub Pages 上
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
    
    const container = document.getElementById('songs-container');
    container.innerHTML = '';
    
    if (type === 'all') {
        document.getElementById('list-title').innerText = "🌐 所有歌曲";
        currentPlaylist = [...allSongs];
        renderSongs(container);
    } else if (type === 'custom') {
        document.getElementById('list-title').innerText = `🗂️ 歌單：${playlistName}`;
        fetch('playlists.json?t=' + Date.now())
            .then(res => res.json())
            .then(playlists => {
                const allowedSrcs = playlists[playlistName] || [];
                currentPlaylist = allSongs.filter(s => allowedSrcs.includes(s.src));
                renderSongs(container);
            });
    }
}

function renderSongs(container) {
    if(currentPlaylist.length === 0) {
        container.innerHTML = '<p style="color:#aaa; text-align:center;">此歌單內還沒有歌曲</p>';
        return;
    }
    currentPlaylist.forEach((song, index) => {
        const div = document.createElement('div');
        div.className = 'item-row';
        div.innerHTML = `<strong>${song.title}</strong><br><span style="color:#aaa; font-size:14px;">${song.artist}</span>`;
        div.onclick = () => startPlayer(index);
        container.appendChild(div);
    });
}

// 顯示分類歌單資料夾清單
async function showPlaylistList() {
    document.getElementById('listen-menu').classList.add('hidden');
    document.getElementById('playlist-selector-view').classList.remove('hidden');
    const container = document.getElementById('playlist-names-container');
    container.innerHTML = '讀取中...';
    
    try {
        const res = await fetch('playlists.json?t=' + Date.now());
        const playlists = await res.json();
        container.innerHTML = '';
        
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
    } catch (e) {
        container.innerHTML = '<p style="color:#aaa; text-align:center;">尚未建立分類歌單檔案</p>';
    }
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

// 5. 核心音樂播放器控制
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
function nextSong() { if(currentPlaylist.length > 0) { songIndex = (songIndex + 1) % currentPlaylist.length; loadSong(currentPlaylist[songIndex]); playSong(); } }
function prevSong() { if(currentPlaylist.length > 0) { songIndex = (songIndex - 1 + currentPlaylist.length) % currentPlaylist.length; loadSong(currentPlaylist[songIndex]); playSong(); } }

nextBtn.addEventListener('click', nextSong);
prevBtn.addEventListener('click', prevSong);

function setupAudioEvents() {
    audio.addEventListener('timeupdate', () => { if (audio.duration) progress.style.width = `${(audio.currentTime / audio.duration) * 100}%`; });
    progressContainer.addEventListener('click', (e) => { if (audio.duration) audio.currentTime = (e.offsetX / progressContainer.clientWidth) * audio.duration; });
    audio.addEventListener('ended', nextSong);
}

// 6. 電腦端 API 功能：線上下載 YouTube 音樂
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

// 7. 電腦端 API 功能：建立歌單渲染與上傳
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

    try {
        const res = await fetch('/api/save_playlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, songs: selectedSongs })
        });
        const data = await res.json();
        if(res.ok) {
            status.innerText = `✅ ${data.message}`;
            document.getElementById('new-playlist-name').value = '';
            checkboxes.forEach(cb => cb.checked = false);
        } else { status.innerText = `❌ 錯誤: ${data.message}`; }
    } catch (e) { status.innerText = "❌ 無法連線到本地 Python 後台"; }
}

init();