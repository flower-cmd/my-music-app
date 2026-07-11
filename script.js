const audio = document.getElementById('audio');
const playBtn = document.getElementById('play');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const title = document.getElementById('title');
const artist = document.getElementById('artist');
const progress = document.getElementById('progress');
const progressContainer = document.getElementById('progress-container');

let songs = [];
let songIndex = 0;
let isPlaying = false;

// 1. 初始化讀取歌單
async function initPlayer() {
    try {
        const response = await fetch('songs.json');
        songs = await response.json();
        if (songs.length > 0) {
            loadSong(songs[songIndex]);
        }
    } catch (error) {
        title.innerText = "歌單載入失敗";
        console.error(error);
    }
}

// 2. 將歌曲資訊放入頁面
function loadSong(song) {
    title.innerText = song.title;
    artist.innerText = song.artist;
    audio.src = song.src;
}

// 3. 播放與暫停邏輯
function playSong() {
    isPlaying = true;
    playBtn.innerText = '⏸ 暫停';
    audio.play();
}

function pauseSong() {
    isPlaying = false;
    playBtn.innerText = '▶ 播放';
    audio.pause();
}

playBtn.addEventListener('click', () => {
    if (isPlaying) {
        pauseSong();
    } else {
        playSong();
    }
});

// 4. 切換歌曲邏輯
function nextSong() {
    songIndex = (songIndex + 1) % songs.length;
    loadSong(songs[songIndex]);
    playSong();
}

function prevSong() {
    songIndex = (songIndex - 1 + songs.length) % songs.length;
    loadSong(songs[songIndex]);
    playSong();
}

nextBtn.addEventListener('click', nextSong);
prevBtn.addEventListener('click', prevSong);

// 5. 更新時間與進度條
audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
        const progressPercent = (audio.currentTime / audio.duration) * 100;
        progress.style.width = `${progressPercent}%`;
    }
});

// 6. 點擊進度條可以跳轉播放時間
progressContainer.addEventListener('click', (e) => {
    const width = progressContainer.clientWidth;
    const clickX = e.offsetX;
    const duration = audio.duration;
    if (duration) {
        audio.currentTime = (clickX / width) * duration;
    }
});

// 7. 當整首歌播完時，自動播放下一首
audio.addEventListener('ended', nextSong);

// 啟動程式
initPlayer();