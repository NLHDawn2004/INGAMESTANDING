# API Documentation - FF Debugger Tools

## 📌 Server URL

```
http://localhost:3000
```

---

## 🌐 Endpoints

### 1. **GET `/`** - Serve UI Dashboard
Phục vụ giao diện web chính (index.html)

**Request:**
```
GET http://localhost:3000
```

**Response:**
```html
< HTML Dashboard >
```

---

### 2. **GET `/api/health`** - Server Health Check
Kiểm tra server có hoạt động không

**Request:**
```bash
curl http://localhost:3000/api/health
```

**Response (200):**
```json
{
  "status": "ok",
  "message": "Server đang chạy",
  "timestamp": "2026-03-21T10:30:45.123Z"
}
```

---

### 3. **GET `/api/match-stats`** - Get Single Match Stats
Lấy thông tin chi tiết của 1 trận đấu từ Free Fire API

**Request:**
```bash
curl "http://localhost:3000/api/match-stats?matchId=341223341200011"
```

**Query Parameters:**
| Tham số | Kiểu | Mô tả | Bắt buộc |
|---------|------|-------|----------|
| matchId | string | ID của trận đấu | ✅ Có |

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "match_info": [
      {
        "match_id": "341223341200011",
        "mode": 1,
        "match_name": "FF Championship 2026",
        "form": 3,
        "number_of_team": 16,
        "number_of_player": 80,
        "match_results": [...],
        "grenade_stats": {
          "grenade_use": 125,
          "grenade_kills": 45,
          "grenade_damage": 1200,
          "icewall_use": 89,
          "icewall_destroyed_times": 12,
          "medkit_use": 340
        }
      }
    ],
    "team_stats": [
      {
        "match_id": "341223341200011",
        "team_stats": [
          {
            "match_rank": 1,
            "team_id": 1001,
            "team_name": "PDL Jaguars",
            "kills": 45,
            "booyah": true,
            "damage": 1850,
            "total_score": 2500,
            "survival_score": 1200,
            "killing_score": 1300,
            "player_data": [...]
          }
        ]
      }
    ]
  }
}
```

**Response (400):**
```json
{
  "status": "error",
  "message": "MatchID là bắt buộc"
}
```

---

### 4. **GET `/api/match-stats/batch`** - Get Multiple Match Stats
Lấy thông tin chi tiết của nhiều trận đấu (tối đa 8 trận)

**Request:**
```bash
curl "http://localhost:3000/api/match-stats/batch?matchIds=341223341200011,341223341200012,341223341200013"
```

**Query Parameters:**
| Tham số | Kiểu | Mô tả | Bắt buộc |
|---------|------|-------|----------|
| matchIds | string | Danh sách ID trận đấu, cách nhau bằng dấu phẩy | ✅ Có |

**Lưu ý:**
- Tối đa 8 trận đấu trong 1 request
- Nếu vượt quá sẽ nhận lỗi

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "match_info": [...],
    "team_stats": [...]
  }
}
```

**Response (400):**
```json
{
  "status": "error",
  "message": "Không được nhập quá 8 trận đấu!"
}
```

---

## 📱 Frontend Integration

### Cấu hình API trong `app.js`:

```javascript
const API_BASE_URL = window.location.origin;  // http://localhost:3000
const API_ENDPOINTS = {
  MATCH_STATS: `${API_BASE_URL}/api/match-stats`,
  MATCH_STATS_BATCH: `${API_BASE_URL}/api/match-stats/batch`,
  HEALTH: `${API_BASE_URL}/api/health`
};
```

### Ví dụ gọi API:

#### 1. Get Single Match Stats
```javascript
const matchId = "341223341200011";
const response = await fetch(`http://localhost:3000/api/match-stats?matchId=${matchId}`);
const data = await response.json();
console.log(data);
```

#### 2. Get Batch Match Stats
```javascript
const matchIds = ["341223341200011", "341223341200012"];
const response = await fetch(`http://localhost:3000/api/match-stats/batch?matchIds=${matchIds.join(',')}`);
const data = await response.json();
console.log(data);
```

#### 3. Check Server Health
```javascript
const response = await fetch('http://localhost:3000/api/health');
const data = await response.json();
console.log(data.status); // "ok"
```

---

## 🚀 Chạy Server

```bash
# Build TypeScript
npm run build

# Chạy development
npm run dev

# Chạy production
npm start
```

Server sẽ khởi động tại:
- 🌐 Giao diện: `http://localhost:3000`
- 📊 API Match Stats: `http://localhost:3000/api/match-stats?matchId=<id>`
- ✅ Health Check: `http://localhost:3000/api/health`

---

## 📊 Response Types

### MatchStatsAPIResponse

```typescript
interface MatchStatsAPIResponse {
  code: number;
  status: string;
  msg: string;
  data: MatchStatsResponse;
}

interface MatchStatsResponse {
  match_info: MatchInfo[];
  team_stats: TeamStatsByMatch[];
}

interface MatchInfo {
  match_id: string;
  mode: number;
  match_name: string;
  form: number;
  number_of_team: number;
  number_of_player: number;
  match_results: any[];
  grenade_stats: GrenadeStats;
}

interface TeamStatsByMatch {
  match_id: string;
  team_stats: TeamStats[];
}

interface TeamStats {
  match_rank: number;
  team_id: number;
  team_name: string;
  kills: number;
  booyah: boolean;
  damage: number;
  total_score: number;
  survival_score: number;
  killing_score: number;
  player_data: PlayerStats[];
  // ... thêm fields khác
}

interface PlayerStats {
  match_rank: number;
  player_id: number;
  player_name: string;
  team_name: string;
  kills: number;
  damage: number;
  // ... thêm fields khác
}
```

---

## 🔒 CORS Settings

Server đã được cấu hình hỗ trợ CORS cho tất cả origins:

```javascript
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
```

---

## 📝 Error Handling

Tất cả lỗi sẽ trả về format:

```json
{
  "status": "error",
  "message": "Mô tả lỗi"
}
```

**HTTP Status Codes:**
- `200` - Thành công
- `400` - Bad Request (thiếu tham số, quá giới hạn, v.v.)
- `500` - Server Error

---

## 🧪 Testing

### Test với cURL:

```bash
# Health check
curl http://localhost:3000/api/health

# Get single match stats
curl "http://localhost:3000/api/match-stats?matchId=341223341200011"

# Get batch match stats
curl "http://localhost:3000/api/match-stats/batch?matchIds=341223341200011,341223341200012"
```

### Test với Postman:

1. **GET** `http://localhost:3000/api/match-stats`
   - Param: `matchId` = `341223341200011`

2. **GET** `http://localhost:3000/api/match-stats/batch`
   - Param: `matchIds` = `341223341200011,341223341200012`

---

## 📌 Notes

- API chỉ hỗ trợ `GET` requests cho `/api/match-stats` và `/api/match-stats/batch`
- Frontend data (matches, players) được lưu ở **localStorage client-side**
- Backend không lưu trữ dữ liệu match/player, chỉ proxy đến Free Fire API
- Để thay đổi port, sửa giá trị `port` trong `src/index.ts`

---

**Phiên bản API**: 1.0  
**Cập nhật cuối**: March 2026
