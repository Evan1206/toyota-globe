# Toyota Global 3D Globe — 設計規格書 (v3)

> 本文件由 Claude 負責「邏輯/架構設計」，實際程式碼實作交由 Codex 執行。
> 目標：一個可在瀏覽器中執行的互動式 3D 地球儀，支援滑鼠/觸控「推拉」操作（拖曳旋轉、滾輪/雙指縮放），並展示 Toyota 全球生產基地、各國市場銷售數據、各地區熱門車型。

**v2 更新重點**（針對使用者回饋：「更接近 Google Maps 的地球樣子」「據點顯示更精美」）：
1. 地球本體改為**寫實彩色衛星貼圖**（藍色大理石風格）+ **雲層** + **方向光照陰影**，取代原先的深色夜景地球
2. 所有據點改為 **Google Maps 風格圖標**：生產基地＝經典水滴 Pin，市場銷售＝圓形數據徽章（Data Badge），並加入進場動畫、hover/click 動效、脈動光環

**v3 更新重點**（針對使用者需求：「如何加入智能/AI的成分」，詳見第 13-18 節）：
1. **智能推薦/關聯分析**：點擊任一據點時，前端即時計算與其他據點的「關聯度」（共同熱門車型、成長率相近、供應鏈關係等），以 `arcsData` 連線視覺化呈現 Top 3 關聯據點，並列出推薦理由
2. **智能數據洞察 + 智能導覽**：純前端統計（z-score 異常偵測）自動產生「市場洞察卡」文字摘要，並提供依數據重要性排序、自動飛行巡覽的「智能導覽」模式
3. **AI 對話助手**：整合 Claude API（建議 `claude-haiku-4-5`）+ 新增的輕量後端代理伺服器，使用者可用自然語言詢問資料，AI 並能透過 function calling 直接操作地球儀鏡頭與標記
4. **三項功能中，僅「AI 對話助手」需要新增後端元件**；智能推薦與智能洞察皆為純前端、無新增相依套件

---

## 1. 專案目標

| 項目 | 說明 |
|---|---|
| 核心互動 | 3D 地球儀的「推拉技術」= 拖曳旋轉地球、滾輪/雙指縮放、點擊標記後相機飛行至該點 |
| 資料圖層 | (1) 全球生產基地 (2) 各國銷售/市場數據 (3) 各地區熱門車型 Top3 |
| 資料來源 | 目前為模擬/示範資料（已建立 JSON，見第 4 節），日後可替換為真實 API |
| 平台 | 網頁應用，Vite + Three.js + globe.gl |
| 視覺基準 | 地球本體外觀參考 **Google Maps / Google Earth 衛星視角**（寫實、明亮、彩色地形+雲層），據點標記參考 **Google Maps Pin / 資訊標記** 的精緻度 |

---

## 2. 技術棚架與現況

已完成（由 Claude 建立）：
- `work/toyota-globe/` 已用 `npm create vite@latest -- --template vanilla` 建立
- 相依套件已安裝：`vite`、`three`、`globe.gl` ✅（v2 待辦的 `ECONNRESET` 安裝問題已解決）
- 目錄骨架已建立：`src/data/`, `src/globe/`, `src/ui/`, `src/utils/`, `public/textures/`
- 三份模擬資料已建立：`src/data/factories.json`、`src/data/marketSales.json`、`src/data/popularModels.json`

**待 Codex 執行（v2 範圍）**：
1. 從 `node_modules/three-globe/example/img/` 複製貼圖到 `public/textures/`（見第 5 節，需挑選**彩色寫實貼圖**而非夜景貼圖）
2. 依本文件第 5~7 節實作 `src/globe/*.js`、`src/ui/*.js`、`src/main.js`、`src/style.css`、`index.html`

**待 Codex 執行（v3 新增範圍，見第 13~18 節）**：
3. 實作 `src/ai/recommendations.js`（智能推薦/關聯分析，純前端，無新增相依）
4. 實作 `src/ai/insights.js`（智能數據洞察 + 智能導覽，純前端，無新增相依）
5. **（選配）** 新增 `server/`（輕量 Node/Express 代理伺服器）+ `src/ai/chatPanel.js` + `src/ai/toolExecutor.js`（AI 對話助手）
   - 需 `npm install express cors @anthropic-ai/sdk dotenv`（於 `server/` 內）
   - 需設定 `server/.env`（`ANTHROPIC_API_KEY=...`，使用者自行提供金鑰，**切勿提交至版本控制**）

> 建議實作順序：3、4 兩項風險低、無相依，可優先完成；5 為獨立模組，待主體功能穩定且使用者備妥 API 金鑰後再進行。

---

## 3. 整體架構

```
┌─────────────────────────────────────────────────────────┐
│                        index.html                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  #globeViz  (globe.gl 渲染容器，全螢幕 canvas)        │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌──────────────┐                      ┌──────────────┐  │
│  │ 左上：標題 +    │                      │ 右側：資訊面板  │  │
│  │ 圖層切換 UI     │                      │ (點擊後滑入)   │  │
│  └──────────────┘                      └──────────────┘  │
│  ┌──────────────┐                      ┌──────────────┐  │
│  │ 左下：圖例      │                      │ 右下：操作提示  │  │
│  └──────────────┘                      └──────────────┘  │
└─────────────────────────────────────────────────────────┘

main.js
 ├─ createGlobe()        → 初始化 globe.gl 實例 + 寫實貼圖 + 雲層 + 光照 + 大氣層
 ├─ layers.js
 │   ├─ buildMarkerData()    → 合併 factories + marketSales 成單一陣列（含 __type）
 │   ├─ initMarkerLayer()    → htmlElementsData（Pin / Badge 兩種圖標）
 │   ├─ initPulseLayer()     → ringsData（高成長市場脈動光環）
 │   └─ initModelLabelLayer()→ labelsData (熱門車型標籤，可切換)
 ├─ interactions.js
 │   ├─ onMarkerClick()   → 開啟 infoPanel + pointOfView 飛行 + Pin 彈跳動畫
 │   └─ autoRotate 控制 (使用者互動時暫停)
 └─ ui/
     ├─ infoPanel.js  → 渲染右側資訊卡內容
     ├─ layerToggle.js→ 左上圖層開關 checkbox
     └─ legend.js     → 左下圖例（圖標說明）
```

---

## 4. 資料模型（已建立檔案，v2 不變）

### 4.1 `src/data/factories.json` — 全球生產基地（18 筆）

```ts
interface Factory {
  id: string;
  name: string;
  country: string;
  countryCode: string;       // ISO3
  lat: number;
  lng: number;
  established: number;
  annualCapacityUnits: number;
  mainProducts: string[];
}
```

### 4.2 `src/data/marketSales.json` — 各國市場銷售（19 筆，示範數值）

```ts
interface MarketSales {
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  salesUnits: number;
  yoyGrowthPct: number;      // 可為負數
  marketSharePct: number;
  hasFactory: boolean;
}
```

> ⚠️ 數值為**示範用途**，UI 上應標註「示範資料 (Demo Data)」。

### 4.3 `src/data/popularModels.json` — 各國熱門車型 Top3（結構不變，見原規格）

### 4.4 執行期合併（新增，於 `main.js` 處理，不修改 JSON 檔）

```js
const markers = [
  ...factories.map(d => ({ ...d, __type: 'factory', __id: `f-${d.id}` })),
  ...marketSales.map(d => ({ ...d, __type: 'market', __id: `m-${d.countryCode}` }))
];
```

`__type` 用於 `htmlElement()` 內判斷要 render Pin 還是 Badge。

---

## 5. 地球本體設定（Google Maps 風格）

| 設定 | 內容 |
|---|---|
| `globeImageUrl` | **彩色寫實貼圖**（如 `earth-blue-marble.jpg` 或同等的「白天/衛星」貼圖），呈現藍色海洋、綠棕色陸地——避免使用 `earth-night`（夜景燈光）或純夜景黑色貼圖 |
| `bumpImageUrl` | `earth-topology.png`，營造山脈/地形立體感（配合光照才會看到陰影起伏） |
| 雲層（新增） | 在地球外加一層半透明雲貼圖球體（`clouds.png`，若 `three-globe/example/img` 無此檔案，可用任意半透明白雲 PNG），半徑 = `globeRadius * 1.004`，緩慢自轉（與地球不同速度），`THREE.MeshPhongMaterial({ map, transparent: true, opacity: 0.85 })` |
| 光照（新增） | globe.gl 預設光源較平、立體感不足。透過 `globe.scene().add(...)` 補強：<br>• `AmbientLight(0xffffff, 0.55)` — 基礎環境光，避免暗面全黑<br>• `DirectionalLight(0xffffff, 1.1)`，`position.set(-1, 0.6, 1)` — 模擬太陽光，搭配 `bumpImageUrl` 產生地形明暗，類似 Google Earth 的晨昏對比 |
| 大氣層 | `showAtmosphere(true)`、`atmosphereColor('#9fd6ff')`（偏白藍，較柔和真實）、`atmosphereAltitude(0.15)` |
| 背景 | 深空黑 `#03060d`，搭配**低密度星空**（`night-sky.png` 但降低亮度/透明度，或改用 CSS `radial-gradient` + 少量星點），避免過於科幻、讓地球本體成為視覺主角 |
| 初始視角 | `pointOfView({ lat: 20, lng: 30, altitude: 2.2 })`（亞歐非交界，整體視野） |
| 自轉 | 閒置 3 秒後緩慢自動旋轉（`autoRotateSpeed = 0.25`），互動時暫停（見第 6 節） |

> 目標效果：遠看像 Google Earth 的「衛星照片地球」——海洋是飽和藍、陸地有自然色彩與雲層飄動、地形隨光源產生柔和陰影。

---

## 6. 互動「推拉」操作設計（與 v1 相同）

| 操作 | 對應行為 | 實作 |
|---|---|---|
| 滑鼠左鍵拖曳 / 單指觸控拖曳 | 旋轉地球 | OrbitControls，`enableDamping = true`, `dampingFactor = 0.1` |
| 滑鼠滾輪 / 雙指縮放 | 推近 / 拉遠 | OrbitControls，限制 `minDistance` / `maxDistance` |
| 點擊 Pin / Badge | 相機飛行至該點 + Pin 彈跳動畫 + 資訊面板滑入 | `pointOfView({lat, lng, altitude: 1.4}, 1000)` + `infoPanel.show()` + CSS class `.marker-bounce` |
| 點擊空白處 / ESC | 關閉資訊面板，恢復自動旋轉 | document click（排除面板）+ keydown |
| 閒置 ≥3 秒 | 緩慢自動旋轉 | `controls` 的 `start`/`end` 事件 + timer |

---

## 7. 據點標記設計（Google Maps 風格 Pin / Badge）— 核心新增

所有標記透過**單一 `htmlElementsData(markers)`** 圖層渲染（globe.gl 只支援一組 HTML 元素圖層），依 `__type` 分流產生不同 DOM 結構。

### 7.1 生產基地 — 經典水滴 Pin（Teardrop Marker）

外觀：與 Google Maps 預設紅色定位 Pin 相同的「圓頭水滴」造型，內含工廠圖示。

```html
<div class="marker factory-pin" data-id="f-jp-tahara">
  <svg class="pin-svg" width="30" height="40" viewBox="0 0 30 40">
    <defs>
      <linearGradient id="pinGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FF4D4D"/>
        <stop offset="100%" stop-color="#C1121F"/>
      </linearGradient>
    </defs>
    <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.7 23.3 0 15 0z" fill="url(#pinGrad)"/>
    <circle cx="15" cy="15" r="8.5" fill="#fff"/>
    <text x="15" y="20" text-anchor="middle" font-size="11">🏭</text>
  </svg>
  <div class="pin-shadow"></div>
</div>
```

CSS 重點：
```css
.marker.factory-pin {
  position: relative;
  transform: translate(-50%, -100%);
  cursor: pointer;
  filter: drop-shadow(0 3px 4px rgba(0,0,0,.45));
  transition: transform .15s ease-out;
}
.marker.factory-pin:hover { transform: translate(-50%, -100%) scale(1.18); }
.marker.factory-pin .pin-shadow {
  position: absolute; bottom: -2px; left: 50%;
  width: 12px; height: 4px; border-radius: 50%;
  background: rgba(0,0,0,.35); filter: blur(1px);
  transform: translateX(-50%);
}
```

**進場動畫**（首次載入，逐個延遲落下）：
```css
@keyframes pin-drop {
  0%   { transform: translate(-50%, -260%) scale(.4); opacity: 0; }
  60%  { transform: translate(-50%, -88%)  scale(1.12); opacity: 1; }
  100% { transform: translate(-50%, -100%) scale(1); }
}
.marker.factory-pin { animation: pin-drop .5s ease-out both; animation-delay: calc(var(--i) * 60ms); }
```
（`--i` 由 JS 在建立元素時以 `style.setProperty('--i', index)` 設定，做出依序落下效果）

**點擊彈跳**（`.marker-bounce`，點擊時加上 class 0.4s 後移除）：
```css
@keyframes pin-bounce {
  0%, 100% { transform: translate(-50%, -100%); }
  30% { transform: translate(-50%, -130%); }
  50% { transform: translate(-50%, -95%); }
}
.marker.factory-pin.marker-bounce { animation: pin-bounce .4s ease-out; }
```

### 7.2 市場銷售 — 圓形數據徽章（Data Badge）

外觀：類似 Google Maps 上的「群集數字標記」或天氣/數據圖層的圓形資訊點——半透明深色圓盤、外圈以成長率顏色呈現環形進度。

```html
<div class="marker market-badge" data-id="m-USA" style="--size: 46px; --ring-color: #2a9d8f">
  <div class="badge-ring">
    <div class="badge-core">
      <span class="badge-code">US</span>
    </div>
  </div>
</div>
```

CSS 重點：
```css
.marker.market-badge {
  position: relative;
  width: var(--size); height: var(--size);
  transform: translate(-50%, -50%);
  cursor: pointer;
  transition: transform .15s ease-out;
}
.marker.market-badge:hover { transform: translate(-50%, -50%) scale(1.12); }

.badge-ring {
  width: 100%; height: 100%;
  border-radius: 50%;
  background: conic-gradient(var(--ring-color) calc(var(--share) * 1%), rgba(255,255,255,.15) 0);
  display: flex; align-items: center; justify-content: center;
  padding: 3px;
  box-shadow: 0 2px 8px rgba(0,0,0,.4);
}
.badge-core {
  width: 100%; height: 100%; border-radius: 50%;
  background: rgba(15, 20, 35, .82);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: calc(var(--size) * 0.28); font-weight: 600;
}
```

對應邏輯（在 `layers.js` 建立元素時計算）：
- `--size`：依 `salesUnits` 正規化到 `28px ~ 56px`
  ```js
  size = 28 + normalize(salesUnits, minSales, maxSales) * 28
  ```
- `--ring-color`：透過 `colorScale.growthToColor(yoyGrowthPct)` 取得（紅→灰→綠）
- `--share`：`marketSharePct`（環形進度百分比，最大值建議 clamp 到 60% 避免整圈全滿失去資訊）
- `badge-code`：`countryCode` 前兩碼或自訂縮寫（如 `US`、`JP`、`CN`）

**進場動畫**：與 Pin 共用 `pin-drop`，但 `market-badge` 改用淡入+縮放（無需位移）：
```css
@keyframes badge-pop {
  0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
  70% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1); }
}
.marker.market-badge { animation: badge-pop .45s ease-out both; animation-delay: calc(var(--i) * 60ms); }
```

### 7.3 高成長市場 — 脈動光環（`ringsData`，新增）

針對 `yoyGrowthPct` 最高的 3 個市場，疊加 globe.gl 原生 `ringsData` 圖層，產生類似 Google Maps「目前位置」藍色脈動圓環效果：

```js
const topGrowth = [...marketSales].sort((a,b) => b.yoyGrowthPct - a.yoyGrowthPct).slice(0, 3);

globe
  .ringsData(topGrowth)
  .ringLat(d => d.lat)
  .ringLng(d => d.lng)
  .ringColor(d => () => growthToColor(d.yoyGrowthPct))
  .ringMaxRadius(3.5)
  .ringPropagationSpeed(2)
  .ringRepeatPeriod(1700);
```

### 7.4 Hover Tooltip（兩種標記共用）

`htmlElement` 內為每個 marker 加上自訂 tooltip（懸停 0.3s 後淡入，避免用瀏覽器原生 `title`）：
- Factory：`{name}\n主要產品：{mainProducts前2項}`
- Market：`{country}\n銷售量：{salesUnits 千分位}\nYoY：{yoyGrowthPct}%`

樣式：小型深色卡片，箭頭朝下指向標記，`position: absolute; bottom: 105%`，`opacity` 過渡。

---

## 8. UI Overlay 設計

### 8.1 版面 Wireframe（不變）

```
┌────────────────────────────────────────────────────────────┐
│ ▌TOYOTA GLOBAL 3D GLOBE        ┌─ 圖層 ────────────┐         │
│  全球生產 × 市場 × 熱門車型      │ ☑ 生產基地 Pin     │         │
│                                 │ ☑ 銷售數據 Badge   │         │
│                                 │ ☐ 熱門車型標籤      │         │
│                                 └───────────────────┘         │
│                                                                │
│                                                  ┌───────────┐│
│                                                  │ 資訊面板    ││
│              （3D 地球儀主視覺）                    │            ││
│                                                  └───────────┘│
│ ┌─ 圖例 ─────────────┐                                        │
│ │ 📍 生產基地（紅色Pin）│              拖曳旋轉．滾輪縮放．      │
│ │ ⬤ 銷售數據（圓形徽章，│              點擊標記查看詳情          │
│ │   大小=銷售量／圈=成長率）│                                    │
│ └────────────────────┘                                        │
└────────────────────────────────────────────────────────────┘
```

### 8.2 資訊面板內容（不變，見原規格 — 國家銷售卡 / 工廠詳情卡）

### 8.3 圖層切換 UI（更新）

因標記合併為單一陣列，切換邏輯改為**過濾後重設** `htmlElementsData`：

```js
function applyLayerVisibility() {
  const visible = markers.filter(d =>
    (d.__type === 'factory' && showFactories) ||
    (d.__type === 'market'  && showMarkets)
  );
  globe.htmlElementsData(visible);
}
```

`ringsData`（高成長光環）與 `showMarkets` 同步開關；`labelsData`（熱門車型）獨立開關，邏輯不變。

### 8.4 圖例（更新）
- 紅色水滴 Pin 圖示 = 生產基地
- 圓形徽章示意圖（大小=銷售量、外圈顏色=YoY成長：紅→灰→綠）
- 脈動光環說明：「成長最快的 3 個市場」
- 文字標註：「示範資料 (Demo Data)」

---

## 9. 視覺風格指南（更新）

| 項目 | 數值 |
|---|---|
| 背景 | 深空黑 `#03060d`，低密度星點 |
| 地球本體 | 彩色寫實貼圖 + 雲層 + 方向光陰影（見第5節） |
| 生產基地 Pin | 漸層 `linear-gradient(180deg, #FF4D4D, #C1121F)`（Toyota 紅），白色圓心 + 工廠圖示，`drop-shadow` |
| 市場數據 Badge | 深玻璃底 `rgba(15,20,35,.82)` + 成長色環（紅 `#e63946` → 灰 `#adb5bd` → 綠 `#2a9d8f`） |
| 脈動光環 | 與 Badge 外圈同色，半透明 |
| UI 面板 | 玻璃擬態：`rgba(15,20,35,0.7)`、`backdrop-filter: blur(10px)`、白字、`border: 1px solid rgba(255,255,255,.1)` |
| 字體 | `"Noto Sans TC", system-ui, sans-serif`（支援中文） |

車型類別配色（資訊面板標籤，不變）：

| Category | Color |
|---|---|
| Sedan | `#4361ee` |
| SUV | `#2a9d8f` |
| Pickup | `#e76f51` |
| Hatchback | `#f4a261` |
| Crossover | `#06d6a0` |
| MPV | `#8d99ae` |

---

## 10. 檔案結構（目標，不變）

```
toyota-globe/
├── index.html
├── package.json
├── vite.config.js
├── public/
│   └── textures/
│       ├── earth-blue-marble.jpg   (或同等彩色寫實貼圖)
│       ├── earth-topology.png
│       ├── earth-clouds.png        (新增：雲層)
│       └── night-sky.png           (降低亮度使用)
└── src/
    ├── main.js
    ├── style.css
    ├── globe/
    │   ├── createGlobe.js   (含光照/雲層設定)
    │   ├── layers.js        (含 Pin/Badge 產生邏輯)
    │   └── interactions.js
    ├── data/
    │   ├── factories.json        ✅ 已建立
    │   ├── marketSales.json      ✅ 已建立
    │   └── popularModels.json    ✅ 已建立
    ├── ui/
    │   ├── infoPanel.js
    │   ├── layerToggle.js
    │   └── legend.js
    └── utils/
        └── colorScale.js
```

---

## 11. 實作步驟清單（給 Codex，v2）

1. **修復相依套件安裝**：重新執行 `npm install three globe.gl`
2. **複製貼圖資源**：從 `node_modules/three-globe/example/img/` 挑選**彩色寫實**地球貼圖（如含 "blue-marble"、"day" 字樣者）、`earth-topology.png`、雲層貼圖（如有 `clouds.png`）至 `public/textures/`。若無雲層貼圖，可另尋一張透明背景白雲 PNG
3. **`src/utils/colorScale.js`**：`growthToColor(pct)`、`normalize(value, min, max)`
4. **`src/globe/createGlobe.js`**：
   - 初始化 globe.gl，套用第 5 節貼圖設定
   - 加入雲層 mesh（獨立旋轉動畫）
   - 加入 `AmbientLight` + `DirectionalLight` 補強地形陰影
   - 設定大氣層、背景星空（降低密度/亮度）、初始 `pointOfView`
   - `enableDamping`、`minDistance`/`maxDistance`
5. **`src/globe/layers.js`**：
   - 合併 `factories` + `marketSales` 為 `markers`（含 `__type`、`__id`、`--i` index）
   - 實作 `htmlElement()`：依 `__type` 產生 7.1 Pin 或 7.2 Badge 的 DOM
   - 實作 `ringsData`（7.3，高成長前3市場）
   - 實作 `labelsData`（熱門車型，不變）
6. **`src/globe/interactions.js`**：
   - click → `pointOfView` 飛行 + `.marker-bounce` class + `infoPanel.show()`
   - hover → 自訂 tooltip 顯示/隱藏
   - 自動旋轉（閒置偵測）
7. **`src/ui/*.js`**：`infoPanel`、`layerToggle`（8.3 過濾邏輯）、`legend`（8.4）
8. **`src/style.css`**：第 7、9 節所有樣式（Pin/Badge/動畫/tooltip/面板）
9. **`src/main.js`**：整合所有模組、載入 JSON、初始化
10. **`index.html`**：`<div id="globeViz"></div>` + UI overlay 容器
11. **測試重點**：
    - 地球呈彩色寫實外觀，雲層緩慢飄動，地形隨光源有明暗
    - Pin / Badge 進場動畫依序播放，hover 放大 + tooltip，click 彈跳 + 飛行 + 面板
    - 高成長市場可見脈動光環
    - 圖層切換、RWD 正常

---

## 12. 未來擴充建議（不變）

- 真實 API 取代示範資料
- 搜尋國家自動飛行
- 時間軸滑桿（歷年銷售動畫）
- 行動裝置 bottom sheet 版面
- 工廠 Pin 改用 Toyota 官方廠徽 SVG

---

## 13. 智能功能總覽（v3 新增）

針對「如何加入智能/AI 成分」，本規格新增三項智能功能，整合進現有架構：

| # | 功能 | 觸發方式 | 運算位置 | 是否需後端 | 視覺呈現 |
|---|---|---|---|---|---|
| 14 | 智能推薦/關聯分析 | 點擊任一據點 | 前端（即時計算） | ❌ | `arcsData` 連線 + 推薦側欄 |
| 15 | 智能數據洞察 + 智能導覽 | 載入時自動產生／點擊「智能導覽」按鈕 | 前端（統計） | ❌ | 洞察卡片 + 自動飛行序列 |
| 16 | AI 對話助手 | 點擊聊天按鈕、輸入文字 | 前端 UI + 後端代理（Claude API） | ✅ | 浮動聊天面板 + AI 操控鏡頭/標記 |

### 13.1 架構更新示意

```
main.js
 ├─ ...（v2 既有模組：createGlobe / layers / interactions / ui）
 └─ ai/                              ← 新增
     ├─ recommendations.js → computeSimilarity() + 渲染 arcsData（第14節）
     ├─ insights.js          → generateInsights() + buildSmartTour()（第15節）
     ├─ chatPanel.js          → 聊天 UI + /api/chat 串接（第16節）
     └─ toolExecutor.js       → 執行 Claude 回傳的 tool_use，操控 globe 實例（第16節）

server/                              ← 新增，唯一後端元件，只服務 AI 對話助手
 └─ index.js → POST /api/chat（持有 ANTHROPIC_API_KEY，轉發 Claude API)
```

14、15 為純前端功能，與既有 `markers` 陣列、`growthToColor()`、`pointOfView()` 等共用資料與工具；16 需新增後端代理。三者皆**獨立可關閉**——任何一項缺失或失敗都不影響地球儀基本展示與既有 v2 功能。

---

## 14. 智能推薦/關聯分析設計（v3 新增）

### 14.1 目標

使用者點擊任一據點（工廠 Pin 或市場 Badge）時，除既有的 `infoPanel` 飛行展示外，額外即時計算「與此據點最相關的其他據點」，並以連線（`arcsData`）視覺化呈現，讓使用者發現資料間的隱藏關聯（例如：哪些市場熱門車型偏好相似、哪個工廠在供應哪個市場）。

### 14.2 相似度評分規則

對被點擊的據點 `source`，與所有其他據點 `target` 逐一計算分數，依雙方 `__type` 組合套用不同規則：

#### (a) market ↔ market

| 評分項目 | 規則 | 權重上限 |
|---|---|---|
| 熱門車型類別重疊 | 比較 `popularModels[country]` 的 `category` 集合，交集數量 × 15 | 45（3類全中） |
| 成長率相近 | `25 - |ΔyoyGrowthPct| × 4`，差距 ≥ 6.25% 則為 0 | 25 |
| 市場規模相近 | `20 - |Δlog10(salesUnits)| × 30` | 20 |
| 「有/無工廠」狀態相同 | 相同則 +10 | 10 |

#### (b) factory ↔ factory

| 評分項目 | 規則 | 權重上限 |
|---|---|---|
| 共同生產車型 | `mainProducts` 交集數量 × 20 | 不限（通常 ≤ 60） |
| 同一國家 | +15 | 15 |

#### (c) factory ↔ market（供應鏈關係，跨型別最具意義）

| 評分項目 | 規則 | 權重上限 |
|---|---|---|
| 工廠產品 ∈ 該市場熱門車型 | 每個吻合車型 +25 | 不限 |
| 同一國家（本地產銷） | +30 | 30 |

### 14.3 參考實作（`src/ai/recommendations.js`）

```js
export function computeSimilarity(source, target, { popularModels }) {
  if (source.__id === target.__id) return null;
  let score = 0;
  const reasons = [];

  if (source.__type === 'market' && target.__type === 'market') {
    const a = new Set((popularModels[source.country] || []).map(m => m.category));
    const b = new Set((popularModels[target.country] || []).map(m => m.category));
    const overlap = [...a].filter(c => b.has(c));
    if (overlap.length) { score += overlap.length * 15; reasons.push(`熱門車型類別相同：${overlap.join('、')}`); }

    const gDiff = Math.abs(source.yoyGrowthPct - target.yoyGrowthPct);
    if (gDiff < 6.25) { score += 25 - gDiff * 4; reasons.push(`成長率表現相近（差 ${gDiff.toFixed(1)}%）`); }

    const sDiff = Math.abs(Math.log10(source.salesUnits) - Math.log10(target.salesUnits));
    if (sDiff < 0.67) { score += 20 - sDiff * 30; reasons.push('市場規模量級相近'); }

    if (source.hasFactory === target.hasFactory) score += 10;
  }

  if (source.__type === 'factory' && target.__type === 'factory') {
    const overlap = source.mainProducts.filter(p => target.mainProducts.includes(p));
    if (overlap.length) { score += overlap.length * 20; reasons.push(`共同生產車型：${overlap.join('、')}`); }
    if (source.countryCode === target.countryCode) { score += 15; reasons.push('位於同一國家'); }
  }

  if (source.__type !== target.__type) {
    const factory = source.__type === 'factory' ? source : target;
    const market = source.__type === 'market' ? source : target;
    const popModels = (popularModels[market.country] || []).map(m => m.model);
    const overlap = factory.mainProducts.filter(fp => popModels.some(pm => pm.includes(fp) || fp.includes(pm)));
    if (overlap.length) { score += overlap.length * 25; reasons.push(`工廠產品供應當地熱門車型：${overlap.join('、')}`); }
    if (factory.countryCode === market.countryCode) { score += 30; reasons.push('本地生產、本地銷售'); }
  }

  return score > 0 ? { target, score, reasons } : null;
}

export function getTopRecommendations(source, allMarkers, popularModels, topN = 3) {
  return allMarkers
    .map(t => computeSimilarity(source, t, { popularModels }))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}
```

### 14.4 視覺化（`arcsData`）

點擊據點後，除既有飛行/面板邏輯，額外呼叫：

```js
const recs = getTopRecommendations(clickedMarker, markers, popularModels);

globe
  .arcsData(recs.map(r => ({
    startLat: clickedMarker.lat, startLng: clickedMarker.lng,
    endLat: r.target.lat, endLng: r.target.lng,
    color: arcColorFor(r),
  })))
  .arcColor('color')
  .arcDashLength(0.4)
  .arcDashGap(0.15)
  .arcDashAnimateTime(1800)
  .arcStroke(0.55)
  .arcAltitudeAutoScale(0.3);
```

`arcColorFor(r)`：依分數區間給予不同顏色/透明度（例如分數 > 60 用 Toyota 紅 `#EB0A1E`，否則用白色半透明 `rgba(255,255,255,.5)`），讓使用者一眼看出關聯強度。

點擊空白處或點擊新據點時，先 `globe.arcsData([])` 清除舊連線。

### 14.5 推薦側欄 UI

於 `infoPanel` 下方新增「🔗 相關據點」區塊，列出 Top 3：

```html
<div class="related-panel">
  <h4>🔗 相關據點</h4>
  <div class="related-item" data-target-id="m-IND">
    <span class="related-name">🇮🇳 印度</span>
    <span class="related-reason">熱門車型類別相同：SUV、Crossover</span>
  </div>
  <!-- ...最多 3 項 -->
</div>
```

點擊 `.related-item` → `pointOfView()` 飛向該據點並觸發其 `infoPanel`，形成可瀏覽的關聯鏈。

---

## 15. 智能數據洞察設計（v3 新增）

### 15.1 目標

不依賴外部 AI，純粹以**統計規則**從 `marketSales.json` 自動產生「這份資料中值得注意的現象」文字洞察，並提供「智能導覽」：依資料重要性排序、自動飛行巡覽各據點並顯示對應洞察文字（類似 Google Earth 的 Voyager 導覽）。

### 15.2 異常/亮點偵測（z-score）

對所有 19 個市場的 `yoyGrowthPct` 計算平均值 `mean` 與標準差 `std`：

```js
// src/ai/insights.js
export function zScores(marketSales) {
  const values = marketSales.map(m => m.yoyGrowthPct);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  return { mean, std, scored: marketSales.map(m => ({ ...m, z: (m.yoyGrowthPct - mean) / std })) };
}
```

分類規則：

| 條件 | 標籤 | Emoji |
|---|---|---|
| `z >= 1.2` | 高速增長市場 | 🚀 |
| `z <= -1.2` | 成長趨緩，需關注 | ⚠️ |
| `marketSharePct >= 30` | 市場領導地位 | 👑 |
| 其餘 | 穩定表現（不特別產生卡片） | — |

> 以目前 19 筆示範資料試算：`mean ≈ 4.4`、`std ≈ 3.6`。印度（+12.5%, z≈2.2）會標記 🚀；中國（-2.3%, z≈-1.85）、土耳其（-1.5%, z≈-1.6）會標記 ⚠️；日本（45%）、泰國（33%）、印尼（32%）、沙烏地阿拉伯（35%）會標記 👑。此結果可作為 Codex 實作後的驗收基準。

### 15.3 洞察文字模板

```js
const TEMPLATES = {
  highGrowth: (m) => `🚀 ${m.country} 年增 ${m.yoyGrowthPct.toFixed(1)}%，是 Toyota 成長最快的市場之一`,
  decline:    (m) => `⚠️ ${m.country} 年增 ${m.yoyGrowthPct.toFixed(1)}%，較整體市場平均表現疲弱，為觀察重點`,
  leader:     (m) => `👑 ${m.country} 市佔率達 ${m.marketSharePct}%，為 Toyota 最具優勢的市場之一`,
};

export function generateInsights(marketSales) {
  const { scored } = zScores(marketSales);
  const insights = [];
  scored.forEach(m => {
    if (m.z >= 1.2) insights.push({ id: `m-${m.countryCode}`, type: 'highGrowth', text: TEMPLATES.highGrowth(m), priority: m.z });
    if (m.z <= -1.2) insights.push({ id: `m-${m.countryCode}`, type: 'decline', text: TEMPLATES.decline(m), priority: -m.z });
    if (m.marketSharePct >= 30) insights.push({ id: `m-${m.countryCode}`, type: 'leader', text: TEMPLATES.leader(m), priority: m.marketSharePct / 30 });
  });
  return insights.sort((a, b) => b.priority - a.priority);
}
```

（以上文字模板皆為繁體中文，Codex 實作時請保留中文內容，不要翻譯成英文）

### 15.4 洞察卡片 UI

頁面載入完成（標記進場動畫播完）後，於右下角彈出「📊 數據洞察」浮動卡片組（可收合），依序淡入顯示 `generateInsights()` 結果（建議顯示前 4-5 條）：

```html
<div class="insight-card" data-target-id="m-IND">
  <p>🚀 印度 年增 12.5%，是 Toyota 成長最快的市場之一</p>
  <button class="insight-fly-btn">前往 →</button>
</div>
```

點擊卡片或「前往」按鈕 → `pointOfView()` 飛向對應據點並開啟 `infoPanel`。

### 15.5 智能導覽（Smart Auto Tour）

#### 重要性評分

```js
export function significanceScore(m, { mean, std }) {
  const zGrowth = Math.abs((m.yoyGrowthPct - mean) / std);
  const shareScore = m.marketSharePct / 45;          // 正規化（45% 為現有資料最大市佔）
  const salesScore = Math.log10(m.salesUnits) / 6.4; // 正規化（log10(2,330,000) ≈ 6.37）
  return zGrowth * 2 + shareScore + salesScore;
}

export function buildSmartTour(marketSales) {
  const { mean, std, scored } = zScores(marketSales);
  return scored
    .map(m => ({ m, score: significanceScore(m, { mean, std }) }))
    .sort((a, b) => b.score - a.score)
    .map(({ m }) => ({
      id: `m-${m.countryCode}`,
      lat: m.lat, lng: m.lng,
      narration: generateInsights([m])[0]?.text
        ?? `${m.country}：銷售 ${m.salesUnits.toLocaleString()} 輛，市佔 ${m.marketSharePct}%`,
    }));
}
```

#### 播放控制

UI：左下角新增「🧭 智能導覽」按鈕。點擊後：

1. `globe.controls().autoRotate = false`
2. 依 `buildSmartTour()` 順序，逐一 `pointOfView({lat, lng, altitude: 1.6}, 1200)`，每站停留 3.5 秒並顯示字幕（`narration`）
3. 字幕 UI：畫面下方置中半透明字幕條，淡入淡出切換
4. 提供「⏸ 暫停 / ▶ 播放 / ⏭ 下一站 / ✕ 結束」控制列
5. 結束或使用者手動拖曳地球時 → 中斷導覽，恢復原本互動模式

```js
async function playTour(tour, globe) {
  for (const stop of tour) {
    if (tourCancelled) break;
    globe.pointOfView({ lat: stop.lat, lng: stop.lng, altitude: 1.6 }, 1200);
    showSubtitle(stop.narration);
    await wait(3500);
  }
  hideSubtitle();
}
```

第 14 節（智能推薦）與第 15 節（智能洞察/導覽）共用 `markers`、`growthToColor`、`pointOfView` 等既有工具，皆為**純前端、無新增相依套件**。

---

## 16. AI 對話助手設計（v3 新增，Claude API + 後端代理）

### 16.1 為什麼需要後端代理

本專案目前為**純前端 Vite 靜態應用**（無伺服器）。Claude API 金鑰（`ANTHROPIC_API_KEY`）**絕不可寫入前端程式碼，也不可使用 `VITE_` 開頭的環境變數**（Vite 會將 `VITE_*` 變數打包進前端 bundle，等同公開金鑰）。

因此 AI 對話助手是**唯一需要新增後端元件**的功能：新增一個極輕量的 Node.js 代理伺服器（`server/`），由它持有金鑰並代為呼叫 Claude API；前端只與這個代理溝通，絕不直接呼叫 `api.anthropic.com`。

```
瀏覽器 (chatPanel.js)
   │  POST /api/chat   { messages: [...] }
   ▼
代理伺服器 (server/index.js, Node + Express)
   │  client.messages.create({ ... 內含 ANTHROPIC_API_KEY ... })
   ▼
Claude API (api.anthropic.com)
```

### 16.2 模型選擇

| 模型 | Model ID | 輸入/輸出單價（每 MTok） | Context | 適用情境 |
|---|---|---|---|---|
| **Claude Haiku 4.5**（建議） | `claude-haiku-4-5` | $1 / $5 | 200K | 本專案首選：輕量問答 + 少量工具呼叫，回應快、成本低，足以處理「飛到日本」「哪個市場成長最快」等指令 |
| Claude Sonnet 4.6（升級選項） | `claude-sonnet-4-6` | $3 / $15 | 1M | 若需更細緻的多市場比較分析、更自然的中文對話品質，可升級 |

> 建議將模型字串放在 `server/.env` 的 `CLAUDE_MODEL` 環境變數，預設 `claude-haiku-4-5`，方便日後切換而不需改程式碼。

### 16.3 系統提示與資料注入（RAG-lite + Prompt Caching）

本專案資料量小（三份 JSON 合計約 50KB），**不需要向量資料庫**——直接將完整資料序列化注入 system prompt，並用 **prompt caching** 降低重複呼叫的成本。

```js
// server/systemPrompt.js
import factories from '../src/data/factories.json' assert { type: 'json' };
import marketSales from '../src/data/marketSales.json' assert { type: 'json' };
import popularModels from '../src/data/popularModels.json' assert { type: 'json' };

export const SYSTEM_BLOCKS = [
  {
    type: 'text',
    text: `你是 Toyota 全球 3D 地球儀的 AI 助手。使用者會用中文或英文詢問關於 Toyota 全球生產基地、各國市場銷售、熱門車型的問題。
回答時請使用提供的資料（皆為示範數據），並在合適時機呼叫工具操作地球儀（飛到地點、標記重點、顯示比較面板等）。
回答請簡潔、使用繁體中文，必要時可使用表格或條列。`,
  },
  {
    type: 'text',
    text: `[資料集 - 示範資料]\n生產基地:\n${JSON.stringify(factories)}\n\n市場銷售:\n${JSON.stringify(marketSales)}\n\n熱門車型:\n${JSON.stringify(popularModels)}`,
    cache_control: { type: 'ephemeral' },
  },
];
```

- 第二個 block（資料集）標記 `cache_control: { type: 'ephemeral' }`：~50KB JSON ≈ 12,000-15,000 tokens，遠超過 Haiku 4.5 的最小可快取前綴（1,024 tokens），可有效快取。
- 同一組 `tools` + `system` 在每次請求中必須維持**完全相同**（含 cache_control 位置）才能命中快取——故工具定義也應抽成常數模組（見 16.4），不要動態增減。
- 可透過 response 的 `usage.cache_read_input_tokens` 確認快取命中狀況。

### 16.4 工具定義（操控地球儀，於前端執行）

以下工具供 Claude 呼叫，**實際執行邏輯在前端**（`src/ai/toolExecutor.js`），後端僅原樣轉發 `tool_use` 區塊：

```js
// server/tools.js（前後端共用此定義：後端傳給 Claude，前端依 name 對應執行函式）
export const GLOBE_TOOLS = [
  {
    name: 'fly_to_location',
    description: '將地球儀鏡頭飛行至指定座標，用於聚焦某個國家/工廠。',
    input_schema: {
      type: 'object',
      properties: {
        lat: { type: 'number', description: '緯度' },
        lng: { type: 'number', description: '經度' },
        altitude: { type: 'number', description: '相機高度，建議 1.2~2.2，數字越小越靠近', default: 1.5 },
        label: { type: 'string', description: '此地點的簡短說明，會顯示在 UI 上' },
      },
      required: ['lat', 'lng'],
    },
  },
  {
    name: 'highlight_markers',
    description: '在地球儀上標記一個或多個據點（脈動光環效果），並開啟第一個據點的資訊面板。',
    input_schema: {
      type: 'object',
      properties: {
        marker_ids: {
          type: 'array',
          items: { type: 'string' },
          description: "據點 ID，格式為 'f-<factoryId>' 或 'm-<countryCode>'，例如 'f-jp-tahara'、'm-USA'",
        },
      },
      required: ['marker_ids'],
    },
  },
  {
    name: 'show_comparison',
    description: '顯示兩個或多個市場的並排比較面板（銷售量、成長率、市佔率）。',
    input_schema: {
      type: 'object',
      properties: {
        country_codes: { type: 'array', items: { type: 'string' }, minItems: 2, description: "國家代碼陣列，例如 ['USA', 'CHN']" },
      },
      required: ['country_codes'],
    },
  },
  {
    name: 'start_smart_tour',
    description: '啟動智能導覽，依指定的據點 ID 順序自動飛行巡覽（重用第 15 節的導覽機制，可傳入子集或自訂順序）。',
    input_schema: {
      type: 'object',
      properties: {
        marker_ids: { type: 'array', items: { type: 'string' } },
      },
      required: ['marker_ids'],
    },
  },
];
```

`marker_ids` 採用第 4.4 節定義的 `__id` 格式（`f-${factoryId}` / `m-${countryCode}`），讓 Claude 可直接參照系統提示中資料集裡的 `id` / `countryCode` 自行組裝。

### 16.5 對話流程（前後端協作的 Agentic Loop）

工具的「執行」（操作 Three.js 場景）只能在瀏覽器完成，但 Claude API 呼叫只能在後端完成（金鑰安全）。因此採用**前後端各跑半個迴圈**的設計，後端維持無狀態（不儲存對話記錄，每次由前端帶上完整 `messages`）：

```
1. 使用者輸入訊息
   → 前端 messages.push({ role: 'user', content: '...' })
   → POST /api/chat { messages }

2. 後端：client.messages.create({ model, system: SYSTEM_BLOCKS, tools: GLOBE_TOOLS, messages })

3a. 若 stop_reason === 'tool_use'：
    → 後端原樣回傳 { stopReason: 'tool_use', content: response.content } 給前端
    → 前端：
        - messages.push({ role: 'assistant', content: response.content })  // 保留 tool_use 區塊
        - 對每個 tool_use 區塊呼叫 toolExecutor[name](input)，取得執行結果文字（如「已飛行至日本」）
        - messages.push({ role: 'user', content: [ {type:'tool_result', tool_use_id, content: '...'}, ... ] })
        - 再次 POST /api/chat { messages }（回到步驟 2）

3b. 若 stop_reason === 'end_turn'：
    → 後端將文字回應回傳給前端（16.6）
    → 前端：messages.push({ role: 'assistant', content: [...] })，並在聊天面板顯示
```

此設計下，`system` 與 `tools` 在每一輪請求都完全相同 → prompt cache 持續命中；只有 `messages` 隨對話增長。

### 16.6 後端代理伺服器（`server/index.js`）

```js
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM_BLOCKS } from './systemPrompt.js';
import { GLOBE_TOOLS } from './tools.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5';

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_BLOCKS,
    tools: GLOBE_TOOLS,
    messages,
  });

  res.json({ stopReason: response.stop_reason, content: response.content });
});

app.listen(process.env.PORT || 3001);
```

> **串流（選配，建議第二階段加上）**：將 `client.messages.create` 改為 `client.messages.stream()`，於 `end_turn` 分支改用 SSE（`res.setHeader('Content-Type', 'text/event-stream')`）逐步轉發 `stream.on('text', chunk => res.write(...))`，前端以 `fetch` + `ReadableStream` 接收，達到逐字顯示效果。**MVP 階段可先用上方非串流版本**，待功能穩定後再升級。

### 16.7 開發環境串接（`vite.config.js`）

開發時 Vite dev server（預設 5173）與代理伺服器（3001）為不同 port，需設定 proxy：

```js
// vite.config.js
export default {
  server: {
    proxy: { '/api': 'http://localhost:3001' },
  },
};
```

### 16.8 環境變數與安全性

```
server/.env.example
  ANTHROPIC_API_KEY=sk-ant-xxxxx     # 使用者自行於 console.anthropic.com 取得
  CLAUDE_MODEL=claude-haiku-4-5      # 可選，預設值如左
  PORT=3001
```

- `.env` 加入 `.gitignore`，僅提交 `.env.example`
- 前端程式碼（`src/ai/chatPanel.js`）**只呼叫 `/api/chat`**，永不持有或傳遞 API 金鑰
- 若日後部署到 Vercel/Netlify 等平台，`server/index.js` 可改寫為對應的 serverless function（如 `api/chat.js`），環境變數於平台後台設定，行為不變

### 16.9 前端聊天面板 UI（`src/ai/chatPanel.js`）

- 右下角浮動圓形按鈕（Toyota 紅 `#EB0A1E`，圖示 💬），點擊展開聊天面板（玻璃擬態樣式，與既有 UI 風格一致）
- 面板內容：訊息列表（使用者/助手氣泡）+ 輸入框 + 「建議問題」快捷按鈕：
  - 「帶我去日本的工廠」
  - 「哪個市場成長最快？」
  - 「比較美國和中國的市場數據」
  - 「幫我做一個智能導覽」
- 工具執行時顯示輕量系統提示氣泡（如「📍 正在飛往日本...」「🔍 已標記美國、中國」），對應 `toolExecutor` 的執行結果
- 面板可收合；收合時不影響地球儀互動

### 16.10 `toolExecutor.js` 對應表

| 工具名稱 | 對應前端動作 | 回傳給 Claude 的 `tool_result` 內容 |
|---|---|---|
| `fly_to_location` | `globe.pointOfView({lat, lng, altitude}, 1200)` | `"已將鏡頭移動至 {label}"` |
| `highlight_markers` | 對應 marker 加上 `.marker-bounce` + 觸發暫時脈動光環 + 開啟第一個的 `infoPanel` | `"已標記 {marker_ids}"` |
| `show_comparison` | 開啟比較面板（新 UI，仿 `infoPanel` 樣式，需 Codex 設計） | `"已顯示 {country_codes} 的比較面板"` |
| `start_smart_tour` | 重用第 15.5 節 `playTour()`，但以傳入的 `marker_ids` 子集排序 | `"已開始導覽，共 {n} 站"` |

每個工具執行函式皆應做**輸入容錯**（如 `marker_ids` 中含未知 ID 時略過並在結果文字中註明），避免因 LLM 產生略有偏差的參數而導致前端報錯。

---

## 17. 檔案結構更新（v3 增量）

在第 10 節既有結構基礎上新增：

```
toyota-globe/
├── server/                      ← 新增（AI 對話助手專用後端，選配）
│   ├── index.js                 → /api/chat 端點（16.6）
│   ├── systemPrompt.js          → 組裝 system blocks，含 cache_control（16.3）
│   ├── tools.js                 → GLOBE_TOOLS 定義（16.4）
│   ├── package.json             → 獨立或併入根目錄 package.json 皆可
│   ├── .env.example
│   └── .env                     → (gitignore，不提交)
├── vite.config.js               → 新增 /api proxy 設定（16.7）
└── src/
    └── ai/                       ← 新增
        ├── recommendations.js   → 第 14 節
        ├── insights.js          → 第 15 節
        ├── chatPanel.js          → 第 16.9 節
        └── toolExecutor.js       → 第 16.10 節
```

---

## 18. 實作步驟清單（v3 增量，給 Codex）

> 建議順序：先完成 14（推薦）、15（洞察/導覽）— 純前端、無相依風險；16（AI 助手）為獨立選配模組，可在主體完成後再進行，且需使用者提供 `ANTHROPIC_API_KEY`。

1. **`src/ai/recommendations.js`**：實作 14.3 的 `computeSimilarity()` / `getTopRecommendations()`
2. **整合至 `interactions.js`**：點擊據點時呼叫 `getTopRecommendations()`，更新 `arcsData`（14.4）並渲染「🔗 相關據點」側欄（14.5）；點擊空白處清除 `arcsData`
3. **`src/ai/insights.js`**：實作 15.2-15.3 `zScores()` / `generateInsights()`，以及 15.5 `significanceScore()` / `buildSmartTour()`
4. **洞察卡片 UI**：載入完成後於右下角顯示 `generateInsights()` 結果卡片（15.4），點擊可飛行至對應據點
5. **智能導覽控制**：左下角新增「🧭 智能導覽」按鈕 + 播放控制列 + 字幕條（15.5）
6. **（選配）AI 對話助手後端**：
   - 建立 `server/` 目錄，`npm install express cors @anthropic-ai/sdk dotenv`
   - 實作 `systemPrompt.js`（16.3）、`tools.js`（16.4）、`index.js`（16.6）
   - 設定 `.env`（需使用者提供金鑰）、`vite.config.js` proxy（16.7）
7. **（選配）AI 對話助手前端**：
   - `src/ai/chatPanel.js`（16.9）：浮動按鈕 + 聊天面板 UI + fetch `/api/chat`
   - `src/ai/toolExecutor.js`（16.10）：實作 16.5 步驟 3a 的工具執行迴圈
8. **測試重點**：
   - 點擊任一據點 → 出現 1-3 條連線飛向相關據點，側欄顯示推薦理由
   - 頁面載入後右下角出現洞察卡片，內容與 19 國資料的統計結果一致（如印度標 🚀，對照 15.2 試算結果）
   - 「智能導覽」可正常播放/暫停/結束，鏡頭依重要性排序飛行
   - （若實作 AI 助手）輸入「帶我去德國」等指令，AI 能正確呼叫 `fly_to_location` 並使鏡頭飛行；確認瀏覽器 devtools 網路面板中**看不到** `ANTHROPIC_API_KEY`
