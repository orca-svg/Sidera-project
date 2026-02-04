# Sidera 기능 로직 문서 (Feature Logic Documentation)

이 문서는 Sidera 애플리케이션의 핵심 로직과 구현 사항을 설명합니다. 특히 AI 통합, 데이터 저장, 시각화 규칙에 초점을 맞춥니다.

## 1. 프로젝트 제목 동기화 (Project Title Synchronization)

### 문제 배경
- 프론트엔드는 `title` 속성을 사용하여 제목을 표시했습니다.
- 백엔드(Mongoose 스키마)는 `name` 속성을 사용했습니다.
- 채팅 API를 통해 `title`을 업데이트하면 메모리 상에서는 반영되었으나, DB 스키마와 불일치하여 저장되지 않았고, 새로고침 시 기본값("New Project")으로 되돌아가는 문제가 있었습니다.

### 구현 로직
- **필드 정규화**: 백엔드(`chat.js`)는 이제 `Project` 컬렉션을 업데이트할 때 명시적으로 `name` 필드를 사용합니다.
- **기본 제목 감지**: 현재 제목이 다음 기본값 중 하나일 때만 AI가 생성한 제목으로 자동 변경합니다:
  - `New Project`
  - `New Conversation`
  - `새 프로젝트`
- **프론트엔드 동기화**: `chat` API 응답에 업데이트된 `projectTitle`을 포함시켜, 페이지 새로고침 없이도 왼쪽 패널의 프로젝트 목록이 즉시 업데이트되도록 했습니다.

---

## 2. 주제 요약 및 표시 (Topic Summary & Display)

### AI 생성
- 매 대화 턴마다 `aiService.js`를 통해 간결한 `topicSummary`를 생성합니다.
- **제약 사항**: 최대 5단어 이하의 명사구 형태를 선호합니다.
- **데이터 정제**: 정규식 기반의 JSON 파싱을 적용하여, AI가 생성한 텍스트에서 불필요한 인용부호나 설명 등을 제거합니다.

### UI 적용
- **오른쪽 패널 (Topic Flow)**: `node.topicSummary`를 표시하여 사용자가 대화 흐름을 쉽게 파악하게 합니다.
- **별자리 뷰 (Constellation View)**: 긴 질문 대신 요약된 `topicSummary`를 핀 라벨로 사용하여 가독성을 높였습니다.
- **왼쪽 패널 (Project List)**: 프로젝트의 `name`을 표시합니다. (첫 대화의 `shortTitle` 또는 `topicSummary`를 기반으로 생성됨)

---

## 3. 연결선 생성 로직 (Edge Generation Logic) - 의미론적 연결

"Connect" 단계에서는 3D 우주에서 노드들이 어떻게 연결될지를 결정합니다.

### A. 시간적 연결 (Temporal Edges - Backbone)
- **유형**: `temporal`
- **시각화**: **회색 점선** (Opacity 0.2)
- **로직**: 현재 노드($n$)와 직전 노드($n-1$)를 항상 연결합니다. 이는 대화의 시간적 흐름(Chronological Flow)을 나타냅니다.

### B. 명시적 연결 (Explicit Edges - Strong Semantic Link)
- **유형**: `explicit`
- **시각화**: **형광 주황/청록 실선** (Cyan #00FFFF, Opacity 0.8, Glow 효과)
- **로직**:
  - `text-embedding-004` 모델에 `taskType: "SEMANTIC_SIMILARITY"` 설정을 적용하여 임베딩을 생성합니다.
  - 새로운 노드의 요약 임베딩과 과거 노드들의 임베딩 간 코사인 유사도(Cosine Similarity)를 계산합니다.
  - **임계값**: **유사도 0.75 이상** (확실한 주제 연관성).
  - *예시*: "사과" ↔ "사과 파이" (높은 유사도) → **실선**.

### C. 암시적 연결 (Implicit Edges - Contextual Link)
- **유형**: `implicit`
- **시각화**: **연한 파란색 점선** (Pale Blue #88AAFF, Opacity 0.3)
- **로직**:
  - **임계값**: **0.4 ≤ 유사도 < 0.75**.
  - 직접적인 주제 일치는 아니지만, 문맥적으로 관련된 연결을 나타냅니다.
  - *예시*: "사과" ↔ "농업" (중간 유사도) → **점선**.

### D. 오탐지 방지 (False Positive Prevention)
- **이슈**: 기존에는 전혀 다른 주제(예: "음식" vs "우주")의 유사도가 0.99로 측정되는 문제가 있었습니다.
- **해결**: 임베딩 생성 시 `taskType`을 명시하여, 단순 텍스트 패턴이 아닌 '의미적 차이'를 구분하도록 모델을 보정했습니다. 이에 따라 관련 없는 주제 간 점수가 0.70 이하로 하락하여 오탐지가 방지되었습니다.

---

## 4. 별 중요도 (Star Importance - Visual Magnitude)

각 노드는 AI가 평가한 중요도에 따라 크기가 다른 별로 시각화됩니다.

### 점수 체계 (1-5점)
- **5점 (Critical)**: 핵심 개념, 질문에 대한 직접적이고 중요한 답변. (가장 크고 밝음)
- **3점 (Normal)**: 일반적인 추가 설명이나 후속 질문.
- **1점 (Trivial)**: 단순한 잡담이나 문맥과 무관한 질문. (가장 작고 희미함)

### 계산 방식
- AI가 답변의 정보 밀도와 사용자 의도 적합성을 분석하여 `importanceScore`를 산출합니다.
- 이 점수는 `Node` 데이터에 저장되며, Three.js 렌더링 시 별의 `size` 속성에 직접 반영됩니다.

---

## 5. 뷰 이동 로직 (View Navigation Logic)

### 모드에 따른 상호작용

| 상호작용 | 채팅 모드 (`viewMode: 'chat'`) | 별자리 모드 (`viewMode: 'constellation'`) |
|----------|---------------------------------|-------------------------------------------|
| **토픽 클릭** | **채팅 스크롤 이동** | **카메라 비행 (Flight)** |
| **로직** | `setActiveNode(id)` 호출 (상태 업데이트만 수행) | `flyToNode(id)` 호출 (카메라 이동 + 모드 전환) |

### 의도
- **채팅 모드**: 사용자가 특정 대화 내용을 찾고 싶을 때, 불필요한 화면 전환 없이 해당 위치로 부드럽게 스크롤합니다.
- **별자리 모드**: 그래프를 탐색하는 몰입감을 유지하기 위해, 카메라가 해당 별(노드)로 날아가는 연출을 제공합니다.

---

## 6. 검색 기능 (Stellar Search)

### 설계 철학
현대적인 "소셜 검색(Social Search)" 패턴을 적용하여, 사용자가 입력하는 즉시 관련 결과를 보여주는 실시간 검색 경험을 제공합니다.

### 핵심 기능

#### A. 실시간 검색 (Live Search)
- **디바운싱**: 300ms 지연을 적용하여 타이핑 중 불필요한 API 호출을 방지합니다.
- **자동 트리거**: Enter 키 없이 타이핑만으로 결과가 나타납니다.
- **로딩 표시**: 검색 중 스피너 애니메이션으로 피드백을 제공합니다.

#### B. 이중 범위 검색 (Dual-Scope Search)
검색 결과가 두 개의 카테고리로 분류되어 표시됩니다:

| 카테고리 | 아이콘 | 검색 대상 |
|----------|--------|-----------|
| **Projects** | 🌌 | 프로젝트 제목 (로컬 필터링) |
| **Topics** | ⭐ | 노드의 질문, 답변, 키워드, 토픽 요약 (백엔드 검색) |

#### C. 매칭 필드 표시 (Match Type Detection)
검색 결과가 어디에서 일치했는지 시각적으로 표시합니다:

| 배지 | 색상 | 의미 |
|------|------|------|
| **Q** | 파란색 | 질문(Question)에서 일치 |
| **A** | 초록색 | 답변(Answer)에서 일치 |
| **#** | 노란색 | 키워드(Keyword)에서 일치 |
| **★** | 청록색 | 토픽 요약(Topic)에서 일치 |

- 답변에서 일치한 경우, 일치 위치 주변의 컨텍스트 스니펫을 표시합니다.
- 질문/답변 매칭 시 해당 토픽명을 브레드크럼(📍)으로 함께 표시합니다.

#### D. 키보드 탐색 (Keyboard Navigation)
| 키 | 동작 |
|----|------|
| ↑↓ | 결과 목록 탐색 |
| Enter | 선택한 항목으로 이동 |
| Esc | 검색 닫기 |

### 백엔드 검색 필드
`/nodes/search` 엔드포인트는 다음 필드들을 대소문자 구분 없이 검색합니다:
- `shortTitle`
- `topicSummary`
- `starLabel`
- `question`
- `answer`
- `keywords`
- `summary`

### 관련 파일
- `Frontend/src/hooks/useDebounce.js`: 디바운스 훅
- `Frontend/src/components/layout/MainLayout.jsx`: 검색 UI 및 로직
- `Frontend/src/store/useStore.js`: `searchNodes` 함수
- `Backend/routes/nodes.js`: 검색 API 엔드포인트

---

## 7. 별자리 완성 (Constellation Completion)

대화를 "완성"하여 읽기 전용으로 보존하고, AI 생성 이미지로 영구 기념하는 기능입니다.

### 완성 플로우

```
[사용자: "이 별자리를 완성하기" 클릭]
         ↓
[모달: 2D 미리보기 + 이름 입력]
         ↓
[Imagen 3.0 API: 성운 이미지 생성]
         ↓
[프로젝트 잠금 (status: 'completed')]
         ↓
[배경에 이미지 표시 (다른 대화에서)]
```

### A. 프로젝트 잠금 (Read-Only Lock)

| 상태 | 동작 |
|------|------|
| **채팅 입력** | 비활성화 + "이 별자리는 완성되었습니다" 메시지 |
| **백엔드** | `POST /chat` 요청 시 403 + `PROJECT_COMPLETED` 코드 반환 |
| **사이드바** | MessageSquare 아이콘 → ✦ 아이콘으로 변경 |
| **이름 변경** | Edit 버튼 숨김 (삭제만 가능) |

### B. Imagen 3.0 이미지 생성

- **엔드포인트**: `POST /api/projects/:id/complete`
- **프롬프트**: 
  ```
  A breathtaking cosmic nebula scene representing "${constellationName}", 
  dark deep space, vibrant nebula in purple blue gold, 
  connected bright stars, ethereal glow, dreamy cinematic, 
  no text no watermarks
  ```
- **Graceful Degradation**: 이미지 생성 실패 시에도 프로젝트는 정상 완료됨 (이름만 저장)

### C. 완성 모달 (EndConversationModal)

**3단계 플로우:**

| 단계 | 내용 |
|------|------|
| **input** | 2D Canvas 별자리 미리보기 + 이름 입력 |
| **generating** | 스피너 + "별자리를 완성하고 있습니다..." |
| **success** | 생성된 이미지 (또는 실패 안내) + 확인 버튼 |

**2D 미리보기 시각화:**
- 노드 색상: 중요도별 (5★=#FFD700, 4★=#00FFFF, 3★=#88AAFF, 2★=#FFF, 1★=#888)
- 엣지: 연한 파란색 선으로 연결

### D. 완료된 별자리 배경 렌더링 (3D Rendering)

기존의 정적 이미지 방식에서 벗어나, 실제 3D 데이터(노드/엣지)를 기반으로 배경 별자리를 렌더링하여 깊이감과 통일성을 제공합니다.

| 속성 | 상세 내용 |
|------|-----------|
| **렌더링 방식** | **Real-time 3D Structure** (Not Image) |
| **구성 요소** | **Stars** (MeshDistortMaterial), **Edges** (Lines), **Orbital Particles** |
| **위치 분산** | **X: ±80, Y: ±40, Z: -60 ~ -120** (광활한 우주 배경) |
| **스케일링** | 원근감(Perspective)을 위해 거리에 따라 자동 축소 |
| **표시 조건** | `viewMode === 'constellation'`일 때만 표시 (채팅 모드에서는 숨김) |
| **예외 처리** | 현재 보고 있는 프로젝트(Self)는 배경에서 제외 |

**시각적 디테일 (Visual Polish):**
- **Stars**: 중요도(1-5)에 따른 크기 및 색상 차별화 (Gold/Cyan Emissive Glow).
- **Distortion**: `MeshDistortMaterial`을 사용하여 별이 은은하게 일렁이는 효과 적용.
- **Orbital Particles**: 1등성/2등성 별 주위를 공전하는 미세한 파티클 추가 (속도/밝기 최적화로 눈부심 방지).

### E. Backend 스키마 (Project)

```javascript
status: { type: String, enum: ['active', 'completed'], default: 'active' }
completedAt: { type: Date, default: null }
constellationName: { type: String, default: null }
constellationImageUrl: { type: String, default: null }  // base64 data URI (Legacy support or fallback)
```

### F. Frontend Store 상태

```javascript
completedImages: []
// 구조:
// [{
//    projectId,
//    constellationName,
//    nodes: [{ id, position, importance, ... }],  // 3D 렌더링용 실제 데이터
//    edges: [{ source, target, type }]
// }]

// 액션
completeProject(projectId, constellationName)  // POST /projects/:id/complete
fetchCompletedImages()                          // GET /projects/completed-images (노드/엣지 데이터 포함)
```

### 관련 파일
- `Backend/models/Project.js`: 완료 관련 스키마 필드
- `Backend/services/aiService.js`: `generateConstellationImage` 함수
- `Backend/routes/projects.js`: `/completed-images`, `/:id/complete` 엔드포인트
- `Backend/routes/chat.js`: 완료된 프로젝트 잠금 체크
- `Frontend/src/store/useStore.js`: `completeProject`, `fetchCompletedImages` 액션
- `Frontend/src/components/layout/EndConversationModal.jsx`: 완성 모달 컴포넌트
- `Frontend/src/components/layout/MainLayout.jsx`: 완성 버튼, 잠금 UI
- `Frontend/src/components/canvas/Universe.jsx`: 배경 이미지 렌더링
