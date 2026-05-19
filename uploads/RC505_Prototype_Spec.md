# RC-505mkII Web Prototype Specification

**목적**: 실제 Boss RC-505mkII 하드웨어의 레이아웃, 버튼 동작, 워크플로우를 최대한 충실하게 재현한 웹 프로토타입을 위한 상세 명세서.  
Claude Design(또는 유사 AI 디자인 툴)에 입력하여 고품질 인터랙티브 프로토타입을 생성하기 위한 기반 문서.

**버전**: v1.0 (2026-05-19)  
**참고 문서**: RC-505mkII Owner's Manual (공식 매뉴얼 기반)

---

## 1. 전체 컨셉 및 목표

- **하드웨어 충실 재현**: 실제 RC-505mkII의 물리적 패널 레이아웃, 버튼 색상/상태, 동작 로직을 웹에서 최대한 비슷하게 구현.
- **인터랙션 중심**: 단순 UI가 아닌, **실제 루핑 워크플로우**를 체험할 수 있게 함 (마이크 녹음 → 루프 재생 → 오버더빙).
- **시각 피드백**: LED 색상 변화 (빨강=녹음, 초록=재생, 노랑=오버더빙), 루프 진행 표시, 버튼 상태를 명확히.
- **단계적 개발**: MVP에서는 핵심 루핑 + 컨트롤 위주. FX, 리듬, 메모리 등은 점진적으로 추가.
- **기술 스택 제안**: Next.js + Tailwind + Tone.js (정확한 템포 동기화 및 오디오 처리에 최적).

---

## 2. 전체 레이아웃 (Top Panel + Track Section)

### 2.1 상단 글로벌 영역 (Top Panel 재현)
- **왼쪽**: INPUT FX 섹션
  - [INPUT FX] knob (파라미터 조절 슬라이더/노브)
  - A / B / C / D 버튼 (Effect on/off, 뱅크 전환)
  - [EDIT] 버튼

- **중앙 상단**:
  - Display 영역 (메모리 번호, 템포, 상태 아이콘 시뮬레이션)
  - [ALL START/STOP] 버튼
  - [UNDO/REDO] 버튼
  - [MENU] / [LOOP] 버튼
  - [EXIT] / [ENTER] 버튼 + ◀ ▶
  - [1]–[4] knobs (파라미터 조절)

- **오른쪽**:
  - [TAP TEMPO] 버튼
  - RHYTHM 섹션: [EDIT], [START/STOP] 버튼
  - TRACK FX 섹션: knob + A/B/C/D 버튼 + [EDIT]

### 2.2 메인 트랙 영역 (TRACK 1~5)
5개의 독립적인 **트랙 스트립**을 가로로 배치 (실제 하드웨어처럼).

각 트랙 스트립 구성 (위 → 아래):

1. **트랙 헤더**
   - 트랙 번호 (1~5) + 컬러 accent
   - [FX] 버튼 (Track FX on/off, lit when active)
   - [TRACK] 버튼 (트랙 선택/설정, lit when phrase exists)

2. **상태 표시**
   - LED indicators (REC / PLAY)
   - 현재 상태 텍스트 (EMPTY / RECORDING / PLAYING / OVERDUBBING / STOPPED)

3. **볼륨 컨트롤**
   - 수직 슬라이더 (Track slider) — 실제 하드웨어 느낌의 긴 fader 스타일

4. **메인 컨트롤 버튼**
   - 큰 원형 [►/◀] 버튼 (가장 중요)
     - **상태별 색상**:
       - Empty: 기본 (회색/검정)
       - Recording: **빨간색 링 + 펄스**
       - Playing: **초록색 링**
       - Overdubbing: **노란색/주황 링**
     - 클릭 동작:
       - Empty → Recording 시작
       - Recording 중 → Recording 종료 + Playback 시작
       - Playing 중 → Overdubbing 시작
       - Overdubbing 중 → Playback으로 복귀
   - 작은 [■] 버튼 (Stop)
     - 일반 클릭: Stop
     - 길게 누르기 (2초): Clear (트랙 초기화)

5. **Loop Indicator 영역**
   - 루프 진행 바 또는 점 애니메이션 (실제 하드웨어의 loop indicators 재현)
   - 재생 위치 시각화

6. **하단**
   - CLEAR 버튼 (별도 또는 [■] 길게 누르기와 연동)

---

## 3. 핵심 인터랙션 로직 (실제 매뉴얼 기반)

### 3.1 트랙 버튼 동작 ([►/◀] 버튼)
- **Empty 트랙**:
  - 클릭 → Recording 시작 (빨강)
- **Recording 중**:
  - 클릭 → Recording 종료 → 자동 Playback 시작 (초록)
- **Playing 중**:
  - 클릭 → Overdubbing 시작 (노랑)
- **Overdubbing 중**:
  - 클릭 → Overdubbing 종료 → Playback 복귀

- **Stop**:
  - [■] 버튼 클릭 또는 큰 버튼 길게 누르기/우클릭

### 3.2 글로벌 컨트롤
- **ALL START/STOP**: 모든 트랙 동시 시작/정지
- **UNDO/REDO**: Undo/Redo 모드 활성화 (MARK BACK 기능 시뮬레이션)
- **TAP TEMPO**: 템포 탭 입력 → BPM 업데이트 (Tone.Transport 연동)
- **RHYTHM START/STOP**: 메트로놈/리듬 재생 (Tone.js로 간단 비트 구현)

### 3.3 오디오 동작 (Tone.js 권장)
- 마이크 입력 (getUserMedia)
- 녹음 → AudioBuffer 생성
- 루프 재생: `loop: true`
- 템포 동기화: Tone.Transport 사용
- 볼륨: Per-track Gain 노드 + 마스터 게인
- (MVP) 오버더빙: 상태 전환 + 시각 피드백 (실제 레이어 합성은 Phase 2)

### 3.4 시각 피드백
- 버튼 색상 + 링 애니메이션
- LED 점등/펄스
- 루프 진행 표시 (Canvas 또는 CSS 애니메이션)
- 상태 텍스트 + 아이콘 변화

---

## 4. MVP 범위 (첫 프로토타입)

**포함**
- 5개 트랙 독립 제어
- 실제 같은 큰 버튼 로직 (REC → PLAY → OVERDUB)
- 마이크 녹음 + 루프 재생
- 수직 볼륨 페이더
- ALL START/STOP, TAP TEMPO, 기본 Rhythm
- 상태 LED + 진행 표시
- 키보드 단축키 (Space: All Start/Stop, 숫자키: 트랙 선택)

**제외 (나중에 추가)**
- 상세 Input/Track FX (간단 토글만)
- 메모리 저장/불러오기 (로컬 JSON)
- 완전한 Undo/Redo + MARK BACK
- 리듬 패턴 선택
- MIDI 지원
- 정확한 퀀타이즈 / Measure 설정

---

## 5. 디자인 가이드 (Claude Design 입력용)

- **색상 팔레트**:
  - 배경: 진한 블랙 (#111111 ~ #1a1a1a)
  - Accent: Boss Red (#e63939), Green (#22c55e), Yellow/Orange (#f59e0b)
  - 버튼: 다크 그레이 + 컬러 링

- **스타일**: 하드웨어 느낌 + 현대적 웹 (과도한 스큐어모피즘 피하고, 명확한 상태 피드백)

- **반응형**: 데스크톱 중심, 태블릿에서도 사용 가능

- **폰트**: 시스템 sans-serif + 모노스페이스 (상태 표시용)

---

## 6. Claude Design에 넣을 추천 프롬프트 예시

```
Boss RC-505mkII Loop Station의 웹 프로토타입을 만들어줘.

[위의 전체 명세서 내용을 여기에 붙여넣기]

- 실제 하드웨어 사진처럼 상단 글로벌 컨트롤 + 5개 트랙 스트립 레이아웃
- 큰 원형 버튼의 상태별 색상 변화 (빨강 녹음, 초록 재생, 노랑 오버더빙)와 클릭 로직 정확히 구현
- Tone.js를 사용한 실제 오디오 루핑
- Tailwind + React/Next.js 스타일로 세련되게
- 인터랙티브하고 하드웨어 느낌 강하게
```

---

## 7. 다음 단계 제안

1. 이 명세서를 Claude Design에 입력 → UI 프로토타입 생성
2. 생성된 UI를 기반으로 Tone.js 오디오 로직 연결 (내가 코드로 도와줌)
3. 실제 테스트하면서 동작 정확도 높이기 (오버더빙 로직 등)

---

**이 문서로 충분한가요?**  
더 자세한 부분(예: 특정 버튼 동작 상세, 오버더빙 로직, FX 섹션 등)을 추가하거나, 이걸 바탕으로 Claude Design용 프롬프트를 바로 만들어 드릴까요? 

필요하면 이 파일을 더 다듬거나, HTML 프로토타입을 이 명세에 맞춰 업데이트하겠습니다.