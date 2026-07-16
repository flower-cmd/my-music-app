from flask import Flask, request, jsonify, send_from_directory
import json
import os
import subprocess

app = Flask(__name__, static_folder='.')

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/api/is_local', methods=['GET'])
def is_local():
    return jsonify({"local": True})

# 1. 單首下載
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
        cmd = ["yt-dlp", "-x", "--audio-format", "mp3", "--audio-quality", "128K", "-o", output_path, url]
        subprocess.run(cmd, check=True)
        
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

# 2. 新增：批次下載
@app.route('/api/batch_add_songs', methods=['POST'])
def batch_add_songs():
    data = request.json
    songs_to_download = data.get('songs', [])
    
    success_count = 0
    failed_songs = []
    
    # 讀取舊歌單
    json_path = "songs.json"
    playlist = []
    if os.path.exists(json_path):
        with open(json_path, "r", encoding="utf-8") as f:
            playlist = json.load(f)
            
    print(f"\n⚡ 啟動批次下載任務，共 {len(songs_to_download)} 首歌曲...")
            
    for index, song in enumerate(songs_to_download, 1):
        url = song.get('url')
        title = song.get('title')
        artist = song.get('artist')
        filename = song.get('filename')
        
        mp3_name = f"{filename}.mp3"
        output_path = os.path.join("songs", mp3_name)
        
        print(f"[{index}/{len(songs_to_download)}] 正在下載《{title}》...")
        
        try:
            cmd = ["yt-dlp", "-x", "--audio-format", "mp3", "--audio-quality", "128K", "-o", output_path, url]
            subprocess.run(cmd, check=True)
            
            # 沒報錯代表下載成功，加入暫時陣列
            playlist.append({"title": title, "artist": artist, "src": f"songs/{mp3_name}"})
            success_count += 1
            print(f"➜ 成功下載《{title}》！")
        except Exception as e:
            failed_songs.append(title)
            print(f"➜ 失敗《{title}》！原因: {e}")
            
    # 批次結束後一次寫入 songs.json 檔案
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(playlist, f, ensure_ascii=False, indent=2)
        
    return jsonify({
        "status": "success",
        "message": f"批次下載完成！成功下載 {success_count} 首，失敗 {len(failed_songs)} 首。",
        "failed": failed_songs
    })

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