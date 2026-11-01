# 속까마귀 — 실서비스 배포 가이드

카카오 로그인, 토스페이먼츠 결제, Claude AI 분석·채팅이 실제로 동작하는 웹사이트예요.
아래 순서대로 하면 개발자가 아니어도 배포할 수 있게 정리했어요. 막히는 단계는 외주 개발자에게 이 문서를 그대로 넘기면 돼요.

## 구성

| 폴더/파일 | 하는 일 |
|---|---|
| `public/index.html` | 사이트 화면 전체 (랜딩, 업로드, 리포트, 카톡 채팅방) |
| `public/terms.html` `privacy.html` `refund.html` | 이용약관·개인정보처리방침·환불 정책 **초안** |
| `api/auth/*` | 카카오 로그인·로그아웃·회원 탈퇴 |
| `api/pay/*` | 토스페이먼츠 주문 생성·결제 승인 |
| `api/ai.js` | Claude 호출. 로그인·결제·횟수를 서버에서 확인 |
| `api/me.js` | 로그인 상태와 남은 채팅 횟수 |
| `lib/prompts.js` | AI 프롬프트 (분석, 말투 카드, 정밀 분석, 채팅) |
| `lib/server.js` | 가격·횟수·모델 설정과 공통 기능 |
| `scripts/smoke-test.js` | 외부 서비스 없이 전체 흐름 점검 (`npm run check`) |

호스팅은 **Vercel**(무료로 시작 가능), 데이터베이스는 **Upstash Redis**(Vercel 안에서 바로 연결)를 써요.
대화 내용은 서버에 저장하지 않아요. 저장하는 건 카카오 회원번호, 닉네임, 이용권, 남은 횟수, 주문 기록뿐이에요.

---

## 1단계. 준비할 계정 (모두 무료로 시작)

1. **GitHub** 계정 — 코드를 올려 두는 곳
2. **Vercel** 계정 — GitHub로 가입
3. **Anthropic Console** (console.anthropic.com) — API 키 발급, 결제 수단 등록
4. **Kakao Developers** (developers.kakao.com) — 카카오 로그인
5. **토스페이먼츠** (tosspayments.com) — 결제. 테스트 키는 가입 즉시 나와요

## 2단계. 코드 올리기

1. GitHub에서 새 저장소(Private)를 만들고, 이 폴더 전체를 올려요.
2. Vercel → Add New → Project → 그 저장소 선택 → Framework Preset은 **Other** → Deploy.
3. 배포가 끝나면 `https://프로젝트명.vercel.app` 주소가 생겨요. 도메인을 따로 샀다면 Vercel → Settings → Domains에서 연결해요.

## 3단계. 데이터베이스 연결

Vercel 프로젝트 → **Storage** → Upstash for Redis → Create → 프로젝트에 연결.
`KV_REST_API_URL`, `KV_REST_API_TOKEN` 환경변수가 자동으로 들어가요. 리전은 **Tokyo(ap-northeast-1)** 를 추천해요.

## 4단계. 카카오 로그인 설정

1. Kakao Developers → 내 애플리케이션 → 애플리케이션 추가 (앱 이름: 속까마귀, 사업자명 입력)
2. **앱 키**에서 **REST API 키** 복사
3. **플랫폼 → Web**에 사이트 도메인 등록 (예: `https://sokkamagwi.com`)
4. **카카오 로그인 → 활성화 ON**, **Redirect URI**에 `https://내도메인/api/auth/callback` 등록
5. **동의항목**에서 **닉네임**을 필수 동의로 설정
6. **보안 → Client Secret** 코드 생성 후 활성화 (권장)

## 5단계. 환경변수 넣기

Vercel → Settings → Environment Variables 에 아래를 넣고 **Redeploy** 해요. 예시는 `.env.example`에 있어요.

| 이름 | 값 |
|---|---|
| `SITE_URL` | `https://내도메인` (끝에 / 없이) |
| `SESSION_SECRET` | 아무 문자 40자 이상 (비밀번호처럼 길고 무작위로) |
| `KAKAO_REST_API_KEY` | 카카오 REST API 키 |
| `KAKAO_CLIENT_SECRET` | 카카오 Client Secret (켰다면) |
| `TOSS_CLIENT_KEY` | 토스 클라이언트 키 (`test_ck_…`로 시작해서 테스트) |
| `TOSS_SECRET_KEY` | 토스 시크릿 키 (`test_sk_…`) |
| `ANTHROPIC_API_KEY` | Anthropic API 키 |

선택 항목: `MODEL_CHAT`, `MODEL_DEEP`, `MODEL_FAST`(AI 모델), `PAID_DAYS`(이용권 기간, 기본 30일), `ANALYSES_PER_DAY`, `DEEP_PER_DAY`(하루 호출 한도).

## 6단계. 테스트

1. 사이트 접속 → 카카오로 시작 → 로그인되는지 확인
2. "예시 대화로 체험하기" → 리포트와 채팅이 되는지 확인
3. 속마음 열기 → 토스 **테스트 결제창**에서 결제 → 정밀 분석이 열리는지 확인 (테스트 키라 실제 돈은 안 나가요)
4. 토스 개발자센터 → 테스트 결제 내역에서 확인

## 7단계. 실제 돈 받기 (라이브 전환)

1. **사업자등록** (기존 사업자로 운영해도 돼요) + **통신판매업 신고** (정부24, 구청)
2. 사이트 하단 `[상호명]` 등 사업자 정보 채우기 → `public/index.html`에서 `class="biz"` 부분
3. 약관·개인정보처리방침·환불 정책의 `[대괄호]`를 채우고 **법률 검토** 받기
4. 토스페이먼츠 **전자결제 계약 신청** → 심사 통과 후 라이브 키(`live_ck_`, `live_sk_`)로 환경변수 교체
5. 카카오페이로도 받으려면 토스페이먼츠에 간편결제(카카오페이) 추가 계약을 신청해요. 결제창에서 바로 카카오페이를 띄우고 싶으면 `public/index.html`의 `requestPayment`에 `card:{flowMode:'DIRECT',easyPay:'KAKAOPAY'}`를 넣어요 (코드명은 토스 문서의 기관 코드 표에서 확인).

---

## 운영하면서 알아 둘 것

- **AI 비용**: 채팅과 정밀 분석은 가장 똑똑한 모델(`claude-opus-5-5`)을 써요. 품질은 가장 좋지만 비용도 가장 커요. 2,900원으로 30일간 하루 15번이면, 많이 쓰는 이용자는 비용이 매출보다 클 수 있어요. 출시 전에 Anthropic 가격표로 1회 채팅 비용을 계산해 보고, 필요하면 `MODEL_CHAT`을 `claude-sonnet-5-5`로 바꾸거나 `PAID_DAYS`·하루 횟수를 조정하세요. Anthropic Console에서 **월 사용 한도**를 꼭 걸어 두세요.
- **가격·횟수 바꾸기**: `lib/server.js` 맨 위 `CONFIG`. 화면 문구(2,900원, 15번, 30일)도 `public/index.html`에서 같이 바꿔요.
- **로그 확인**: Vercel → Logs. 오류는 `ai`, `confirm`, `kakao callback` 이름으로 찍혀요.
- **정밀 분석이 오래 걸릴 때**: 최대 5분까지 기다리도록 설정했어요(`vercel.json`). Vercel 요금제에 따라 최대 시간이 다를 수 있어요.

## 꼭 확인할 법·정책 이슈

- **대화 상대방의 개인정보**: 이용자가 올리는 대화에는 상대방 메시지가 들어 있어요. 서버에 저장하지 않게 만들었지만, AI 처리 자체가 제3자 정보 처리예요. 개인정보처리방침의 국외 이전(미국, Anthropic) 고지와 함께 변호사 검토를 받으세요.
- **실존 인물 AI 시뮬레이션**: "그 사람 AI"는 실제 사람의 말투를 흉내 내요. 화면에 "실제 상대가 아니에요"를 계속 표시하고, 약관에 악용 금지(사칭·스토킹·제3자 공유)를 넣어 뒀어요. 출시 전에 Anthropic 이용 정책(Usage Policy)에도 맞는지 확인하세요.
- **만 14세 미만 가입 제한**, **청약철회 제한 고지**(결제창 아래 문구), **사업자 정보 표시**는 토스 심사에서도 확인하는 항목이에요.

## 로컬에서 점검하기 (개발자용)

```bash
npm run check        # 외부 서비스 없이 로그인·결제·AI 흐름 점검
npx vercel dev       # 로컬 실행 (환경변수는 .env.local)
```
