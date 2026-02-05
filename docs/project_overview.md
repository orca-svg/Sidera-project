# 🌌 Sidera: AI Knowledge Constellation Service

## 1. 프로젝트 개요

**Sidera**는

> “대화의 파편을 별자리로 잇다”

라는 컨셉을 가진 **3D AI 지식 시각화 웹 서비스**입니다.

사용자와 AI의 대화 내용을 단순한 텍스트 로그가 아닌, **3차원 우주 공간의 별(Node)과 연결선(Edge)**으로 시각화하여 지식의 흐름과 연관성을 직관적으로 탐색할 수 있는 새로운 경험을 제공합니다.

---

## 2. 기획 배경

기존의 LLM(거대언어모델) 채팅 인터페이스들은 다음과 같은 한계가 있었습니다:
- 선형적인 텍스트 나열로 인해 **대화의 전체 맥락**을 파악하기 어려움
- 과거의 중요한 통찰이 스크롤 위로 사라짐 (**휘발성**)
- 주제 간의 유기적인 **연결성**을 시각적으로 확인 불가능

Sidera는 이러한 한계를 넘어, **대화를 구조화된 지식의 은하수(Constellation)**로 변환하여 사용자가 자신의 사고 과정을 입체적으로 조망하고 소장할 수 있게 합니다.

---

## 3. 핵심 컨셉

### 🌌 3D 별자리 시각화 (Constellation View)
- 대화의 턴(Turn) 하나하나가 우주의 **별(Node)**이 됩니다.
- 대화의 맥락과 의미적 유사도에 따라 별들이 **선(Edge)**으로 연결됩니다.
- 중요도가 높은 대화는 더 크고 밝은 별로 표현됩니다.

### 🧠 의미 기반 연결 (Semantic Linking)
- **시간적 연결 (Temporal)**: 대화의 시간 순서를 나타내는 점선
- **명시적 연결 (Explicit)**: 주제가 강하게 연관된 노드 간의 실선 (Cosine Similarity > 0.75)
- **암시적 연결 (Implicit)**: 문맥적으로 관련된 약한 연결

### 🔭 관측소 및 완성 (Observatory & Completion)
- 대화가 마무리되면 별자리를 **'완성'**하여 영구히 보존할 수 있습니다.
- AI가 별자리의 모양을 분석하여 **성운(Nebula) 이미지**를 생성해 배경으로 깔아줍니다.
- **관측소(Observatory)** 모드에서 완성된 나만의 지식 별자리들을 갤러리처럼 감상할 수 있습니다.

---

## 4. 주요 기능 시스템

### � 인터랙티브 AI 채팅
- **실시간 스트리밍**: AI의 답변이 생성되는 과정을 실시간으로 보여줍니다.
- **자동 제목/요약**: 대화 내용을 분석하여 프로젝트 제목과 노드 요약(Topic)을 자동으로 생성합니다.
- **게스트 모드**: 로그인 없이도 브라우저 메모리상에서 가볍게 체험 가능합니다.

### � Stellar Search (이중 범위 검색)
- **실시간 검색**: 타이핑과 동시에 결과를 보여주는 소셜 검색 패턴 적용
- **Dual-Scope**: 프로젝트 제목 검색과 대화 내용(질문/답변/키워드) 검색을 동시에 지원
- **매칭 하이라이트**: 검색어가 질문(Q), 답변(A), 요약(★) 중 어디에 포함되는지 배지로 구분

### 🛰️ 동적 카메라 워킹
- **Chat 모드**: 특정 토픽 클릭 시 해당 위치로 부드럽게 스크롤
- **Constellation 모드**: 노드 클릭 시 카메라가 해당 별로 비행(Flight)하는 몰입형 연출
- **스마트 라벨**: 카메라 거리에 따라 글자 크기와 위치가 동적으로 조절되어 시야 방해 최소화

---

## 기술 스택

### 🎨 Frontend

| 구분 | 상세 내용 |
| --- | --- |
| **Language** | JavaScript (ES6+) |
| **Framework** | React (Vite) |
| **3D Engine** | Three.js / React Three Fiber (R3F) |
| **Effects** | React Three Drei (Post-processing) |
| **State Management** | Zustand |
| **Styling** | TailwindCSS, Styled-Components |
| **Network** | Axios |

### ☁️ Backend

| 구분 | 상세 내용 |
| --- | --- |
| **Runtime** | Node.js |
| **Framework** | Express.js |
| **Database** | MongoDB (Mongoose) |
| **Vector Search** | In-memory Cosine Similarity (Embeddings) |
| **Authentication** | Passport.js (Google OAuth), JWT |

### 🤖 AI & ML

| 구분 | 상세 내용 |
| --- | --- |
| **LLM** | Google Gemma 3 27B IT (via Gemini API) |
| **Embedding** | Gemini Embedding 001 (text-embedding-004) |
| **Image Gen** | FLUX.1-schnell (via HuggingFace) |
| **GPU Engine** | Local Python Server (RTX 4090) - High-res Nebula Rendering |
| **Image Process** | BRIA RMBG-1.4 (Background Removal) |

---

## 🔎 API 명세 (Notion Format)

| **도메인** | **이름** | **method** | **endpoint** | **comment** |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | Google Login Trigger | `GET` | `/api/auth/google` | Google OAuth 로그인 시작 |
|  | Google Login Callback | `GET` | `/api/auth/google/callback` | Google 인증 콜백 및 JWT 발급 |
|  | Verify Token | `GET` | `/api/auth/me` | 현재 토큰 유효성 검증 및 유저 정보 반환 |
| **Chat & AI** | Chat Message | `POST` | `/api/chat` | AI와 대화 및 노드 생성 (RAG, 중요도, 좌표 계산 포함) |
|  | Get Context | `GET` | `/api/chat/context/:nodeId` | 특정 노드의 대화 맥락(이전 대화 체인) 조회 |
| **Projects** | List Projects | `GET` | `/api/projects` | 내 프로젝트 목록 조회 |
|  | Create Project | `POST` | `/api/projects` | 새 프로젝트 생성 |
|  | Get Project Detail | `GET` | `/api/projects/:id` | 프로젝트 상세 정보 및 노드/엣지 전체 조회 |
|  | Complete Project | `POST` | `/api/projects/:id/complete` | 프로젝트 완료 처리 및 별자리 신화 이미지 생성 |
|  | Auto Rename | `PATCH` | `/api/projects/:id/auto-rename` | AI가 대화 내용을 분석하여 프로젝트 이름 자동 변경 |
| **Nodes** | List Nodes | `GET` | `/api/nodes/:projectId` | 특정 프로젝트의 모든 노드 조회 |
|  | Search Nodes | `GET` | `/api/nodes/search` | 노드 검색 (키워드/내용) |
| **Edges** | Refresh Edges | `POST` | `/api/projects/:id/refresh-edges` | (Refactor) 모든 엣지를 최신 로직으로 재계산 |

---

## 📷 UI 미리보기

### 🌌 메인 별자리 화면
*(Placeholder: main_constellation_view.png)*
> 사용자의 대화가 3D 공간 상에 생성된 모습입니다. 중요도에 따라 별의 크기가 다릅니다.

### 💬 채팅-시각화 상호작용
*(Placeholder: chat_interaction.gif)*
> 채팅을 입력하면 실시간으로 별이 생성되고 연결선이 이어집니다.

### 🔭 관측소(Observatory) 뷰
*(Placeholder: observatory_view.png)*
> 완성된 프로젝트들이 나선형(Spiral) 구조로 배치된 갤러리 화면입니다.

---

## 느낀점

### 🙆🏻‍♂️ 박찬우
- websocket 그만.

### 🙋🏻‍♂️ 이준엽
- 버그 해결하기 너무 어렵다 으아ㅏ아
