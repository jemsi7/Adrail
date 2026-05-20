# 00. When To Done

- 상태: v0.5 locked
- 작성일: 2026-05-20
- 프로젝트: Adrail

## 한 줄 완료 정의

사용자는 영어 UI에서 AI 서비스 답변 전에 노출되는 인터랙티브 전면 광고를 명확히 광고로 인식할 수 있고, 광고주는 영어 자연어로 target policy를 작성하며, 플랫폼은 사용자 개인정보를 광고주에게 직접 전달하지 않은 채 검증 가능한 attention signal이 발생했을 때 testnet smart contract로 광고 정산 이벤트를 생성할 수 있다.

## Locked Decisions

- 제품 포지셔닝: AI 광고 투명성/정산 인프라.
- 서비스 언어: 영어.
- 광고 배치: 답변 전 전면광고를 사용한다.
- 광고 형식: 단순 이미지/배너가 아니라 LLM 실시간성을 살린 Interactive Sponsored Interstitial로 구성한다.
- 타겟 정책 입력: 광고주는 영어 자연어로 target policy를 작성한다.
- 타겟 정책 실행: 플랫폼이 자연어 target brief를 내부 policy AST, embedding query, policy hash로 컴파일해 매칭과 감사를 수행한다.
- AI Provider: OpenRouter.
- OpenRouter live path: API key는 `.env`의 `OPENROUTER_API_KEY`로만 주입하며, Answer Agent, target policy compiler, Interactive Ad Agent가 OpenRouter structured output 경로를 사용한다.
- Context retention: embedding 기반 RAG와 LLM 판정을 적극 활용한다.
- Settlement score: 캠페인별로 동적 조정 가능한 weight/threshold를 사용한다.
- 정산 방식: MVP부터 testnet smart contract escrow를 사용한다. 로컬 DB는 인덱스와 데모 캐시로만 사용한다.
- 데모 범위: User Chat과 Advertiser Console을 별도 화면(route)으로 분리해 포함한다.
- User Chat UX: ChatGPT식 미니멀 대화 UI를 기준으로 하며, 사용자가 질문하면 답변 전에 `Sponsored` 광고 메시지가 먼저 뜨고 그 아래에 서비스 답변이 이어진다.
- 데모 광고 테마: 기본 bundled seed preset은 고정 유형이 아니며, custom preset을 추가해 더 확장 가능해야 한다.
- 사용자 리워드: 직접 토큰/현금 리워드는 MVP에서 제외하고, 광고 기반 무료 서비스 이용권 모델로 둔다.

## 정량 완료 조건

- 사용자 플로우 4개가 영어 데모에서 통과한다.
  - Personal Intelligence 형성: 사용자가 3턴 이상 영어로 대화하고, 시스템이 내부 프로필/관심 벡터를 갱신한다.
  - 광고주 캠페인 등록: 광고주가 Console에서 영어 자연어 target policy, ad pool, 필수 노출 특징, escrow budget을 등록한다.
  - 전면 광고 노출: 광고주가 업로드한 ad pool 중 하나가 대화 맥락에 맞게 선택되고, 답변 전에 Interactive Sponsored Interstitial로 렌더링된다.
  - 정산: dwell, real-time interaction, context retention, deep-link 중 하나 이상의 attention signal이 발생하고 testnet settlement transaction이 생성된다.
- 데모에는 최소 3개 광고 seed preset이 포함되고, 광고주 Console에서 custom preset을 추가할 수 있다.
  - Travel and local experiences
  - Productivity or SaaS tools
  - Online learning or professional upskilling
- 현재 bundled seed는 6개로 확장되어 Finance operations, Home energy, Creator tools도 포함한다.
- 광고 유형은 위 seed로 제한되지 않는다.
  - bundled seed는 기본 preset으로만 취급한다.
  - custom preset도 동일한 natural-language policy compile, policy guard, interstitial generation, settlement demo 경로를 통과한다.
- OpenRouter live-ready 조건을 만족한다.
  - API key가 없는 상태에서는 deterministic fixture fallback으로 전체 데모가 동작한다.
  - API key를 `.env`의 `OPENROUTER_API_KEY`로 추가하면 OpenRouter `/chat/completions` structured output 경로가 policy compile, service answer, sponsored interstitial copy에 연결된다.
  - User Chat의 sponsored ad/interstitial은 완성된 structured output으로 한 번에 렌더링하고, service answer는 광고 CTA/dismiss/not relevant 이후 `/api/live-answer` SSE stream으로 점진 표시한다.
  - API key가 있는 상태의 User Chat은 preset selector를 숨기고 live LLM 경로만 사용한다. OpenRouter provider failure는 deterministic fixture로 대체하지 않고 live error로 노출한다.
  - 브라우저 화면, session storage, client header로 OpenRouter API key를 입력하거나 전달할 수 없어야 한다.
  - live LLM 출력은 schema validation과 policy guard를 통과해야 화면에 반영된다.
- 광고와 서비스 답변의 경계가 UI와 데이터 구조 양쪽에서 분리된다.
  - 서비스 답변 모델은 advertiser targeting data와 campaign bid를 입력으로 받지 않는다.
  - 광고 생성기는 답변 텍스트를 수정할 수 없다.
  - 모든 광고 컴포넌트는 `Sponsored` 라벨과 campaign disclosure를 가진다.
- User Chat 화면은 미니멀 채팅 경험으로 동작한다.
  - 첫 화면은 단일 conversation thread와 하단 composer 중심으로 구성한다.
  - User Chat 첫 viewport에는 advertiser/settlement/debug console이 섞이지 않는다.
  - 사용자가 질문을 제출하면 user bubble 다음에 sponsored ad bubble/card가 먼저 나오고, CTA/dismiss/not relevant/timeout 중 하나가 발생한 뒤 service answer bubble이 나온다.
  - live mode에서 service answer bubble은 `Answer streaming` 상태로 시작해 완료 후 proof chip을 표시한다.
  - testnet proof, policy hash, privacy detail은 필요한 경우 drawer 또는 compact proof chip으로 열어본다.
- Interactive Sponsored Interstitial이 LLM 실시간성을 보여준다.
  - 광고는 사용자의 현재 니즈에 맞춰 headline, graphic layout, CTA 중 최소 1개를 즉석 생성한다.
  - 광고 안의 micro-interaction 1개 이상이 사용자 입력 또는 선택에 따라 실시간으로 업데이트된다.
  - 광고 interaction은 service answer의 사실 판단을 바꾸지 않는다.
- 개인정보 보호 조건을 만족한다.
  - 광고주에게 raw transcript, user profile, direct identifier가 노출되지 않는다.
  - 광고주는 campaign-level aggregate metric만 본다.
  - 자연어 target policy는 민감정보 타겟팅 검사를 통과해야 활성화된다.
  - settlement proof에는 user id 대신 campaign-scoped pseudonymous id 또는 익명 proof만 포함된다.
- testnet smart contract 조건을 만족한다.
  - campaign escrow deposit transaction을 생성한다.
  - campaign별 dynamic settlement policy hash를 저장하거나 참조한다.
  - attention proof를 받아 payout 또는 claimable settlement transaction을 생성한다.
  - demo dashboard에서 transaction hash와 settlement status를 확인할 수 있다.
- attention signal 산정 로직이 단독 테스트 가능하다.
  - dwell threshold 테스트
  - real-time interaction event 테스트
  - embedding/RAG 기반 context retention 테스트
  - LLM adjudication fixture 테스트
  - deep-link event verification 테스트
  - dynamic settlement policy 테스트

## 정성 완료 조건

- 신규 사용자가 5초 안에 “지금 보는 것은 답변 전 광고이고, 이후 서비스 답변이 제공된다”를 구분할 수 있다.
- 신규 사용자가 5초 안에 별도 설명 없이 “채팅 서비스 화면이며, 광고가 답변 전에 먼저 노출된다”를 이해할 수 있다.
- 광고주는 영어 자연어로 원하는 타겟을 설명할 수 있고, 시스템이 어떤 policy로 컴파일했는지 검토할 수 있다.
- 광고주는 “누구에게 노출되었는지”가 아니라 “어떤 타겟 정책이 어떤 attention outcome을 만들었는지”를 이해할 수 있다.
- 데모 심사자가 개인정보가 광고주에게 전달되지 않는 이유를 아키텍처 다이어그램만 보고 설명할 수 있다.
- 광고가 답변의 결론을 오염시키지 않는다는 제품 원칙이 화면, API, 로그 구조에 일관되게 반영된다.
- 전면광고가 답변 접근을 무기한 차단하지 않고, 광고임을 숨기지 않으며, 사용자가 dismiss/not relevant를 선택할 수 있다.

## 완료로 보지 않는 상태

- 광고 문구가 답변 본문 안에 자연스럽게 섞여 있으나 `Sponsored` 라벨만 붙은 상태.
- 광고주가 타겟 조건을 만들기 위해 사용자의 raw profile이나 대화 기록을 조회할 수 있는 상태.
- 자연어 target policy가 민감정보 검수 없이 그대로 매칭에 사용되는 상태.
- attention signal 없이 단순 impression만으로 정산되는 상태.
- smart contract를 언급하지만 testnet transaction, contract interface, 검증 가능한 settlement event schema가 없는 상태.
- 전면광고가 정적 이미지일 뿐 LLM 기반 실시간 interaction을 보여주지 못하는 상태.
- User Chat과 Advertiser Console이 같은 패널 안에 섞여 별도 화면으로 인식되지 않는 상태.
- 광고 테마가 bundled seed에 하드코딩되어 custom demo preset을 추가할 수 없는 상태.
- OpenRouter API key를 넣어도 fixture만 동작하거나, key가 있는 상태에서 provider failure를 deterministic fixture로 조용히 대체하거나, live LLM 출력이 schema/guard 없이 UI에 반영되는 상태.

## Open Decisions

- 없음.
