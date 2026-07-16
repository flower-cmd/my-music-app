const audio = document.getElementById('audio');
const playBtn = document.getElementById('play');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const shuffleBtn = document.getElementById('shuffle-btn');
const title = document.getElementById('title');
const artist = document.getElementById('artist');
const progress = document.getElementById('progress');
const progressContainer = document.getElementById('progress-container');

let allSongs = [];           
let currentPlaylist = [];       
let songIndex = 0;
let isPlaying = false;
let isLocalMode = false;       

let isShuffle = false;         
let currentPlaylistType = 'all'; 
let currentPlaylistName = '';   

async function init() {
    await checkEnvironment();
    await loadAllSongs();
    setupAudioEvents();
    renderMemo(); // 👈 初始化載入備忘錄
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
        document.getElementById('list-title').innerText = "🌐 所有歌曲";
        currentPlaylist = [...allSongs];
        renderSongs(container);
    } else if (type === 'custom') {
        document.getElementById('list-title').innerText = `🗂️ 歌單：${playlistName}`;
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
        container.innerHTML = '<p style="color:#aaa; text-align:center;">此歌單內還沒有歌曲</p>';
        return;
    }
    
    currentPlaylist.forEach((song, index) => {
        const div = document.createElement('div');
        div.className = 'item-row';
        
        const infoDiv = document.createElement('div');
        infoDiv.className = 'song-info';
        infoDiv.innerHTML = `<strong>${song.title}</strong><br><span style="color:#aaa; font-size:14px;">${song.artist}</span>`;
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

function setupAudioEvents() {
    audio.addEventListener('timeupdate', () => { if (audio.duration) progress.style.width = `${(audio.currentTime / audio.duration) * 100}%`; });
    progressContainer.addEventListener('click', (e) => { if (audio.duration) audio.currentTime = (e.offsetX / progressContainer.clientWidth) * audio.duration; });
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
    status.style.color = "#ff9800"; status.innerText = "⏳ 正在線上下載並轉檔中，請稍候...";

    try {
        const res = await fetch('/api/add_song', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, title: titleVal, artist: artistVal, filename })
        });
        const data = await res.json();
        if(res.ok) {
            status.style.color = "#1db954";
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
        
        status.style.color = "#ff9800";
        status.innerText = `⏳ 正在批次下載 ${songsToDownload.length} 首歌曲，這需要一些時間，請稍候...`;
        
        const res = await fetch('/api/batch_add_songs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ songs: songsToDownload })
        });
        
        const data = await res.json();
        if (res.ok) {
            status.style.color = "#1db954";
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
        container.innerHTML = '<p style="color:#aaa; text-align:center; font-size:14px; margin-top:15px;">目前備忘錄空空如也</p>';
        return;
    }
    
    memoList.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'item-row';
        div.style.cursor = 'default';
        div.innerHTML = `
            <div class="song-info">
                <strong>${item.title}</strong> - <span style="color:#aaa;">${item.artist}</span><br>
                <span style="font-size:11px; color:#666; word-break:break-all;">${item.url}</span>
            </div>
            <button onclick="deleteMemoItem(${index})" style="background:#e0e0e0; border:none; color:#333; padding:5px 8px; border-radius:4px; cursor:pointer; font-weight:bold;">❌</button>
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