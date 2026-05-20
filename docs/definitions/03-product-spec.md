# 03. Product Spec

- 상태: v0.3 locked
- 작성일: 2026-05-20

## 제품 이름

가칭: Adrail

## 제품 포지셔닝

Agentic AI 광고 투명성/정산 인프라.

이 제품은 단순 광고 네트워크가 아니라, AI 서비스 답변과 광고를 시스템 레벨에서 분리하고 attention proof 기반 정산을 가능하게 하는 인프라다.

## 문제 정의

전통적 인터넷 광고는 서비스 영역과 광고 영역이 비교적 분리되어 있었다. 사용자는 콘텐츠를 보고, 광고를 보고, 둘을 어느 정도 구분할 수 있었다.

Agentic AI 시대에는 답변, 추천, 비교, 구매 대행, 의사결정 경로가 모두 하나의 대화형 서비스 안에 들어온다. 이때 광고가 답변 자체에 섞이면 사용자는 진실한 답변과 유료 추천을 구분하기 어렵다.

핵심 문제는 광고가 있다는 사실이 아니라, 광고가 서비스 답변의 형식과 섞여 투명성을 잃는 것이다.

## 해결 명제

AI 서비스 답변과 광고를 시스템 레벨에서 다시 분리한다.

- 답변은 답변으로 생성한다.
- 광고는 광고로 생성한다.
- 광고는 사용자 니즈에 맞춰 동적으로 제작하되, 항상 답변 전 분리된 Interactive Sponsored Interstitial로 표시한다.
- 광고주는 영어 자연어로 target policy를 작성한다.
- 개인정보 기반 매칭은 플랫폼 내부에서 수행하고, 광고주에게 개인정보를 전달하지 않는다.
- 광고비는 단순 노출이 아니라 attention signal이 검증될 때 testnet smart contract로 정산한다.
- settlement score는 campaign별 dynamic policy로 조정 가능하다.

## 서비스 언어

- MVP user-facing language: English
- User Chat, Advertiser Console, disclosure, ad copy, demo script는 영어로 제공한다.
- 내부 문서와 개발 기록은 한국어로 유지할 수 있다.

## 대상 사용자

### 1. AI 플랫폼

- 무료 또는 저가 AI 서비스를 광고로 수익화하려는 사업자
- 답변 신뢰성을 훼손하지 않고 광고 매출을 만들고 싶은 사업자

### 2. 광고주

- LLM/agent 환경에서 사용자의 실제 intent에 맞는 광고를 집행하고 싶은 브랜드
- 개인정보를 직접 보유하지 않고도 정교한 타겟팅을 하고 싶은 광고주
- 복잡한 JSON 대신 자연어로 타겟을 설명하고 싶은 광고주

### 3. 최종 사용자

- 광고 기반 무료 AI 서비스를 이용하는 사용자
- 답변과 광고의 경계를 명확히 알고 싶은 사용자
- 자신의 개인정보가 광고주에게 직접 전달되지 않길 원하는 사용자

## 가치 제안

- 사용자: 답변 전 광고를 명확히 인지하고, 광고 정보 사용 범위를 제어할 수 있다.
- 플랫폼: 답변 신뢰를 지키면서 광고 수익 모델을 만들 수 있다.
- 광고주: 자연어로 타겟을 정의하고, 사용자 개인정보를 직접 받지 않아도 intent-driven ad delivery를 할 수 있다.
- 생태계: Agentic AI 광고의 투명성, 정산 가능성, privacy boundary를 표준화한다.

## 차별점

- 광고를 답변 안에 숨기지 않고 답변 전 전면 인터랙티브 컴포넌트로 분리한다.
- 광고 소재가 고정 배너가 아니라 대화 맥락과 micro-interaction에 맞춰 즉석 생성된다.
- 타겟팅은 광고주가 직접 개인 데이터를 조회하는 방식이 아니라, 플랫폼 내부 matching으로 처리된다.
- context retention은 embedding 기반 RAG와 LLM 판정으로 검증한다.
- 정산은 impression이 아니라 dynamic attention proof 기반 testnet smart contract로 발생한다.

## MVP 범위

- user chat demo
- advertiser console
- advertiser campaign/ad pool 등록
- natural-language target policy authoring
- compiled target policy preview
- pre-answer interactive sponsored interstitial generation
- privacy-safe matching
- context retention scoring with embedding/RAG + LLM
- dynamic attention settlement policy
- testnet smart contract escrow settlement
- transaction status dashboard
- 최소 3개 demo ad theme

## Demo Ad Themes

- Travel and local experiences
- Productivity or SaaS tools
- Online learning or professional upskilling

## 사용자 리워드 모델

- MVP에서는 사용자에게 직접 토큰/현금 리워드를 지급하지 않는다.
- 사용자는 광고 기반 무료 AI 서비스 이용권을 받는 모델로 정의한다.
- 사용자 직접 리워드는 지갑, 세금, 어뷰징 방지, 청소년 보호 이슈가 있어 후속 phase로 둔다.

## 제외 범위

- 실제 광고 네트워크 연동
- 실제 개인정보 규제 적합성 법률 검토
- 실제 mainnet smart contract 정산
- 모든 광고 카테고리 지원
- 완전 자동 광고 심사
- 사용자 직접 토큰/현금 보상

## Open Decisions

- 없음.
