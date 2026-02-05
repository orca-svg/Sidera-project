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
- **별자리 완성**: 탐구가 완료된 대화는 '완성'을 통해 읽기 전용으로 보존되며, AI가 좌표를 분석해 고유한 성운(Nebula) 이미지를 생성합니다.
- **몰입형 관측소**: 완성된 지식들은 **구형(Spherical) 아카이브** 공간에 배치되어, 사용자는 자신의 지적 성장 과정을 우주를 항해하듯 탐색할 수 있습니다.

---

## 4. 주요 기능 시스템

### 💬 인터랙티브 AI 채팅 (Interactive AI Chat)
- **지능형 맥락 분석**: 사용자의 질문 의도를 분석하여 대화의 중요도를 평가하고, 이를 별의 크기와 밝기로 변환하여 시각화합니다.
- **실시간 지식 구조화**: AI 답변 생성과 동시에 새로운 지식 노드를 3D 공간에 배치하며, 이전 대화와의 연결 고리를 자동으로 탐색합니다.
- **자동 프로젝트 큐레이션**: 대화 주제를 관통하는 핵심 키워드를 추출하여 프로젝트 제목과 노드 요약(Topic)을 자동으로 생성합니다.

### 🔍 Stellar Search (이중 범위 검색)
- **지능형 실시간 검색**: 소셜 검색 패턴을 적용하여, 입력과 동시에 프로젝트와 세부 대화 내용을 즉각적으로 탐색합니다.
- **Dual-Scope 검색**: 프로젝트 제목뿐만 아니라 대화 본문, 답변 컨텍스트, AI 키워드까지 포함하는 광범위한 통합 검색을 지원합니다.
- **시각적 매칭 탐지**: 검색 결과가 질문(Q), 상세 답변(A), 또는 핵심 요약(★) 중 어디에 위치하는지 직관적인 배지로 표시하여 정보 접근성을 극대화했습니다.

### 🛰️ 동적 카메라 시스템 (Dynamic Navigation)
- **대화 흐름 추적 (Chat Mode)**: 채팅창에서 특정 토픽을 선택하면, 해당 대화가 위치한 지점으로 시야를 부드럽게 스크롤하여 맥락 파악을 돕습니다.
- **몰입형 공간 비행 (Constellation Mode)**: 3D 우주에서 별을 클릭하면 카메라가 해당 좌표로 역동적으로 비행(Flight)하며, 지식의 숲을 탐험하는 듯한 연출을 제공합니다.
- **적응형 시각 라벨**: 카메라와의 거리에 따라 핀 라벨의 크기와 상세도가 동적으로 조절되어, 광활한 우주 공간에서도 정보의 가독성을 최적으로 유지합니다.

### 🎨 몰입형 UX 디자인 (UX Philosophy)
- **입체적 우주 경험 (3D Parallax)**: 마우스 움직임에 반응하는 **패럴랙스(Parallax)** 효과를 적용하여, 심연의 우주 공간을 유영하는 듯한 깊이감 있는 시각적 경험을 제공합니다.
- **친숙한 채팅 인터페이스**: ChatGPT나 Gemini와 유사한 **보편적인 대화형 레이아웃**을 채택하여, 사용자가 별도의 학습 없이도 즉시 서비스를 이용할 수 있도록 진입 장벽을 낮췄습니다.

### 🔐 유연한 접근성 (Flexible Access)
- **하이브리드 인증 시스템**: Google OAuth를 통한 안전한 회원가입과 로그인을 지원하여 사용자의 데이터를 영구적으로 보존합니다.
- **휘발성 게스트 모드 (Guest Mode)**: 데이터가 DB에 저장되지 않고 브라우저 세션에만 존재하는 **No-Login 체험 모드**를 제공합니다. 이를 통해 사용자는 개인정보 노출 걱정 없이 서비스를 즉시 경험해볼 수 있습니다.

### 📸 순간의 기록과 공유 (Share Moments)
- **고해상도 천체 촬영**: 현재 탐색 중인 나만의 지식 별자리들을 **고해상도 PNG 이미지**로 즉시 캡처하여 저장할 수 있습니다.
- **간편한 공유**: 캡처된 이미지는 Web Share API를 통해 SNS나 메시지로 친구들과 손쉽게 공유할 수 있어, 지적 탐구의 순간을 함께 나눌 수 있습니다.

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
| **LLM** | Google Gemini 2.0 Flash (Chat & Reasoning) |
| **Embedding** | Gecko (text-embedding-004) |
| **Image Gen** | FLUX.1 (via HuggingFace) |
| **Image Process** | BRIA RMBG-1.4 (Background Removal) |

---

## 🔎 API 명세 요약

| 도메인 | 메서드 | 엔드포인트 | 설명 |
| --- | --- | --- | --- |
| **Auth** | `GET` | `/api/auth/google` | 구글 로그인 시작 |
| **Projects** | `GET` | `/api/projects` | 내 프로젝트 목록 조회 |
| | `POST` | `/api/projects/:id/complete` | 별자리 완성 및 이미지 생성 |
| **Chat** | `POST` | `/api/chat` | AI 대화 요청, 노드/엣지 생성 및 좌표 계산 |
| **Nodes** | `GET` | `/api/nodes/:projectId` | 프로젝트의 모든 노드 데이터 조회 |
| | `GET` | `/api/nodes/search` | 전체 노드 대상 키워드 검색 |
| **Completion** | `GET` | `/api/projects/completed-images` | 관측소 뷰를 위한 완성된 별자리 데이터 조회 |

---

## 📷 UI 미리보기

### 🌌 메인 별자리 화면
*(Placeholder: main_constellation_view.png)*
> 사용자의 대화가 3D 공간 상에 생성된 모습입니다. 중요도에 따라 별의 크기가 다릅니다.

### 💬 채팅-시각화 상호작용
*(Placeholder: chat_interaction.gif)*
> 사용자의 입력(Chat)이 실시간으로 **3D 노드(별)**로 변환되어 생성되며, AI가 분석한 문맥적 연관성에 따라 **연결선(Edge)**이 즉각적으로 이어지는 역동적인 시각화 과정을 보여줍니다.

### 🔭 관측소(Observatory) 뷰
*(Placeholder: observatory_view.png)*
> 사용자의 지식 자산이 **구형(Spherical) 클러스터**로 구조화되어 배치된 3D 아카이브 공간입니다. 단순히 결과물을 나열하는 갤러리를 넘어, 드넓은 우주 속에서 자신만의 지식 성단을 직접 항해하며 관측하는 듯한 심오한 공간감을 제공합니다.

---

## 느낀점

### 🙆🏻‍♂️ 박찬우
- websocket 그만.

### 🙋🏻‍♂️ 이준엽
- 버그 해결하기 너무 어렵다 으아ㅏ아
