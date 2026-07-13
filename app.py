from flask import Flask, request, jsonify, send_from_directory
import json
import os
import subprocess

# 建立網頁伺服器，並將靜態檔案根目錄設在當前資料夾
app = Flask(__name__, static_folder='.')

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

# 讓前端網頁辨識目前是「電腦本地執行」還是「手機雲端執行」
@app.route('/api/is_local', methods=['GET'])
def is_local():
    return jsonify({"local": True})

# 處理前端網頁傳過來的 YouTube 下載請求
@app.route('/api/add_song', methods=['POST'])
def add_song():
    data = request.json
    url = data.get('url')
    title = data.get('title')
    artist = data.get('artist')
    filename = data.get('filename')
    
    mp3_name = f"{filename}.mp3"
    output_path = os.path.join("songs", mp3_name)
    
    try:
        # 呼叫 yt-dlp 進行下載與轉檔
        cmd = ["yt-dlp", "-x", "--audio-format", "mp3", "--audio-quality", "128K", "-o", output_path, url]
        subprocess.run(cmd, check=True)
        
        # 自動更新 songs.json
        json_path = "songs.json"
        playlist = []
        if os.path.exists(json_path):
            with open(json_path, "r", encoding="utf-8") as f:
                playlist = json.load(f)
        
        playlist.append({"title": title, "artist": artist, "src": f"songs/{mp3_name}"})
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(playlist, f, ensure_ascii=False, indent=2)
            
        return jsonify({"status": "success", "message": f"成功下載並新增《{title}》"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# 處理前端網頁建立歌單的請求
@app.route('/api/save_playlist', methods=['POST'])
def save_playlist():
    data = request.json
    name = data.get('name')
    song_srcs = data.get('songs')
    
    try:
        json_path = "playlists.json"
        playlists = {}
        if os.path.exists(json_path):
            with open(json_path, "r", encoding="utf-8") as f:
                playlists = json.load(f)
                
        playlists[name] = song_srcs
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(playlists, f, ensure_ascii=False, indent=2)
            
        return jsonify({"status": "success", "message": f"歌單【{name}】儲存成功"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    print("\n==================================================")
    print("🎵 私人音樂盒後台已成功啟動！")
    print("👉 請在瀏覽器打開網址: http://127.0.0.1:5000")
    print("==================================================\n")
    app.run(debug=True, port=5000)