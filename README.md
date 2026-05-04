# 🌌 Sidera
> **"Turn Conversation Fragments into Constellations"**
> 대화의 파편을 별자리로 잇는 3D AI 지식 시각화 서비스


**Sidera**는 단순한 텍스트 기반의 채팅을 넘어, 사용자와 AI의 대화를 **3차원 우주 공간의 별(Node)과 연결선(Edge)**으로 시각화합니다. 휘발되는 대화가 아닌, 영구히 보존되는 나만의 지식 별자리를 만들어보세요.

---

## ✨ Key Features

### 1. 🌌 3D Constellation View
- 대화의 한 턴이 하나의 별이 됩니다.
- 중요도가 높은 대화는 더 크고 밝게 빛납니다.
- **Three.js & R3F** 기반의 몰입형 우주 탐색 경험을 제공합니다.

### 2. 🧠 Semantic Linking (의미 기반 연결)
단순한 시간 순서뿐만 아니라, 의미적 연관성에 따라 별들이 자동으로 연결됩니다.
- **Temporal (점선)**: 시간의 흐름
- **Explicit (실선)**: 강한 주제적 연관성 (Cosine Similarity > 0.75)
- **Implicit (은은한 점선)**: 문맥적 연관성

### 3. 🔭 Observatory & Completion
- 대화가 마무리되면 별자리를 **'완성'**하여 아카이빙할 수 있습니다.
- AI가 **별들의 좌표와 형상을 분석**하여 그에 맞는 고유한 **신화적 이미지(Mythic Image)**를 생성하고, 이를 3D 별자리 위에 **오버레이(Overlay)**하여 시각적으로 구현합니다.
- 관측소(Observatory) 모드에서 내가 만든 지식의 은하수를 감상하세요.

### 4. ⚡️ Smart Interactions
- **Live Search**: 타이핑과 동시에 질문/답변/토픽을 검색하고 하이라이팅합니다.
- **Flight Navigation**: 별을 클릭하면 카메라가 우주를 비행하여 해당 위치로 이동합니다.

---

## 🛠 Tech Stack

### Frontend
- **Framework**: React (Vite)
- **3D Engine**: Three.js, React Three Fiber (R3F), Drei
- **Styling**: TailwindCSS, Styled-Components
- **State**: Zustand

### Backend
- **Runtime**: Node.js, Express.js
- **Database**: MongoDB (Mongoose)
- **Auth**: Passport.js (Google OAuth), JWT

### AI & Intelligence
- **LLM**: Google Gemma 3 27B IT (via Gemini API) - *Chat & Reasoning*
- **Embedding**: Gemini Embedding 001 - *Semantic Search & Linking*
- **Image Gen**: FLUX.1-schnell (via HuggingFace) - *Constellation Art*
- **GPU Engine**: Local Python Server (RTX 4090)

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB (Running locally or Atlas URI)
- Python 3.10+ (For AI Server)

### 1. Repository Setup
```bash
git clone https://github.com/Start-Sidera/Sidera.git
cd Sidera
```

### 2. Backend Setup
```bash
cd Backend
npm install
# Create .env file with:
# MONGODB_URI=...
# GOOGLE_API_KEY=...
# IMAGE_HUGGING_FACE_API=...
# JWT_SECRET=...

npm start
```

### 3. Frontend Setup
```bash
cd Frontend
npm install
npm run dev
```

### 4. AI Server (Optional for High-res Generation)
```bash
# In Root or separate folder
pip install -r requirements_ai.txt
python constellation_ai.py
```

---

## 👥 Team

| Role | Name | Orgnization| Role |
| :--- | :--- | :--- | :--- |
| **Frontend/Design** | **이준엽** | "School of Technology Management, Korea Advanced Institute of Science and Technology" | "Interactive 3D Experience & UI/UX" |
| **Backend/AI** | **박찬우** | "Dept. of Computer Science and Engineering, Korea University" | "System Architecture & Intelligence Pipeline" |

---
