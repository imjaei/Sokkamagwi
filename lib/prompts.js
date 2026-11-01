// 속까마귀 프롬프트 (서버 전용). 클라이언트는 데이터만 보내고, 프롬프트는 서버에서 만든다.
function pad(n){return (n<10?'0':'')+n}
function mbtiLine(o){var a=[];if(o.ymbti)a.push('상대 MBTI(이용자가 입력한 값): '+o.ymbti);if(o.mmbti)a.push('나의 MBTI: '+o.mmbti);return a.length?a.join(' / ')+' — 유형별 일반 경향은 참고만 하고, 실제 대화 패턴과 다르면 대화를 우선해.':''}
function styleLines(s){
  var laugh=[];
  if(s.kk>3)laugh.push('ㅋ 계열을 메시지의 '+s.kk+'%에서 씀(보통 ㅋ '+s.kRun+'개)');
  if(s.hh>3)laugh.push('ㅎ 계열을 메시지의 '+s.hh+'%에서 씀(보통 ㅎ '+s.hRun+'개)');
  if(!laugh.length)laugh.push('ㅋ/ㅎ를 거의 안 씀');
  return [
    '- 나의 메시지에 한 번 답할 때 보내는 말풍선 수: 평균 '+s.bpt+'개 (가장 흔한 건 '+s.mode+'개)',
    '- 말풍선 하나 평균 길이: '+s.len+'자',
    '- 존댓말로 끝나는 비율: '+s.polite+'%',
    '- 마침표로 끝내는 비율: '+s.period+'% / 물음표로 끝: '+s.q+'% / 물결(~) 사용: '+s.tilde+'% / 말줄임(..): '+s.ell+'%',
    '- 웃음: '+laugh.join(', '),
    '- 이모티콘만 보내는 비율: '+s.emo+'%',
    '- 나를 부르는 말: '+(s.addr.length?s.addr.join(', '):'이름을 거의 안 부름'),
    '- 자주 쓰는 문장 끝(어미): '+(s.ends.join(', ')||'-'),
    '- 자주 보내는 짧은 말 그대로: '+(s.stock.join(' / ')||'-')
  ].join('\n');
}

var BASE='너는 카카오톡 대화 패턴으로 썸·짝사랑 관계를 읽어 주는 서비스 "속까마귀"의 분석가 까비야. 아래 대화에서 "나"는 서비스 이용자, "상대"는 그 사람이야(전화번호·주소 등은 가려져 있어). 한국어 해요체로, 따뜻하지만 냉정하게, 아주 구체적으로 써. 대화에 실제로 나온 내용과 수치만 근거로 삼고, 모르는 건 단정하지 말고 "~로 보여요"처럼 추정으로 말해. 듣기 좋은 말만 하지 말고 불리한 신호도 솔직하게 짚어.';

function S(x,n){return String(x==null?'':x).slice(0,n)}
function clean(r){
  return {stats:S(r.stats,4000),excerpt:S(r.excerpt,16000),longExcerpt:S(r.longExcerpt,42000),
    style:r.style&&typeof r.style==='object'?r.style:{},spread:Array.isArray(r.spread)?r.spread.slice(0,160).map(function(x){return S(x,160)}):[],
    ymbti:/^[EI][NS][FT][JP]$/.test(r.ymbti||'')?r.ymbti:'',mmbti:/^[EI][NS][FT][JP]$/.test(r.mmbti||'')?r.mmbti:''};
}
function fixStyle(s){
  s=s||{};var n=function(v){v=+v;return isFinite(v)?v:0},arr=function(a,k,m){return Array.isArray(a)?a.slice(0,k).map(function(x){return S(x,m)}):[]};
  return {bpt:n(s.bpt),mode:n(s.mode),len:n(s.len),period:n(s.period),q:n(s.q),tilde:n(s.tilde),polite:n(s.polite),ell:n(s.ell),emo:n(s.emo),kk:n(s.kk),hh:n(s.hh),kRun:n(s.kRun),hRun:n(s.hRun),ends:arr(s.ends,10,6),stock:arr(s.stock,12,40),addr:arr(s.addr,3,12),avgReply:n(s.avgReply)};
}
export function freePrompt(raw){var r=clean(raw);r.style=fixStyle(r.style);
  var p=BASE+'\n\n[통계]\n'+r.stats+'\n\n[대화 발췌]\n'+r.excerpt+
    (mbtiLine(r)?'\n\n'+mbtiLine(r):'')+
    '\n\nJSON 하나만 답해. 형식: {'+(r.ymbti?'"mbti_note":"상대 MBTI '+r.ymbti+'의 일반적 연애·대화 경향과 실제 대화 패턴이 어디가 맞고 어디가 다른지 2문장",':'')+'"type":"상대 유형 이름, 6자 안팎, ~형으로 끝남","quote":"상대 말투를 흉내 낸 한 줄 요약, 30자 이내, 따옴표 없이","summary":"쌍방 신호에 대한 2문장 요약","care":[{"title":"상대가 중요하게 보는 것, 8자 이내","body":"근거가 되는 대화 패턴 한 문장"}]} care는 정확히 3개.';
  return p;}
export function personaPrompt(raw){var r=clean(raw);r.style=fixStyle(r.style);
  var p='너는 대화 분석 전문가야. 아래 카카오톡 대화의 "상대"를 AI로 재현하기 위한 "말투·관계 카드"를 만들어. 목표는 이 카드를 읽은 사람이 상대와 구분이 안 되게 카톡을 쓰는 거야. 일반론은 쓸모없어. 이 대화에서만 보이는 구체적 습관과 실제 문장을 뽑아.\n\n'+
    (mbtiLine(r)?mbtiLine(r)+'\n\n':'')+'[계산된 말투 수치]\n'+styleLines(r.style)+'\n\n[상대가 보낸 메시지 표본(시간순)]\n'+r.spread.join('\n')+'\n\n[대화 기록]\n'+r.longExcerpt+
    '\n\nJSON 하나만 답해. 형식:\n{"speech":"존댓말/반말 쓰는 방식과 섞는 패턴 1~2문장",'+
    '"vibe":"말할 때 성격과 분위기 1~2문장",'+
    '"habits":["말투 습관 6~10개. 각 항목에 실제 예문을 따옴표로 포함. 맞춤법·띄어쓰기·오타 습관, 말풍선 쪼개는 방식, 답장 시작하는 말, 맞장구 방식 등"],'+
    '"phrases":["상대가 실제로 쓴 표현을 글자 그대로 10~15개"],'+
    '"address_me":"나를 부르는 호칭과 그 빈도",'+
    '"facts":["대화로 확인되는 사실과 둘이 공유한 이야기 8~15개: 상대의 직업·일정·사는 곳(동네 수준)·가족/반려동물·취미, 나에 대해 상대가 아는 것, 잡혀 있거나 이야기된 약속, 둘만의 농담. 날짜가 있으면 M/D로"],'+
    '"reactions":{"question":"내가 질문하면","compliment":"칭찬하면","plan":"약속을 제안하면","late_night":"밤늦게 연락하면","flirt":"호감을 표현하면","busy":"바쁘거나 피곤할 때","topic_change":"화제를 바꿀 때","serious":"진지하거나 슬픈 얘기를 하거나 들을 때 (말투가 어떻게 달라지는지, 웃음을 빼는지 등 실제 예로)"},'+
    '"avoid":["상대가 거의 안 하는 말투나 행동 4~6개 (예: 긴 문단, 특정 이모지, 먼저 감정 표현 등)"],'+
    '"relationship":"지금 관계 단계와 온도, 최근 흐름 2문장",'+
    '"recent_events":["상대와 나에게 최근 있었던 큰일이나 감정적인 일(상실, 아픔, 이별, 시험, 이직, 기념일 등)과 날짜 M/D. 없으면 빈 배열"],"last_context":"가장 최근 대화가 어디서 끝났고 무슨 이야기가 진행 중이었는지, 그때 분위기 1~2문장"}';
  return p;}
export function deepPrompt(raw){var r=clean(raw);r.style=fixStyle(r.style);
  var p=BASE+'\n\n이용자는 2,900원을 내고 이 정밀 분석을 열었어. 값어치를 하도록, 이 두 사람의 대화에서만 나올 수 있는 날카롭고 구체적인 분석을 해. 뻔한 연애 조언 금지.\n\n[통계]\n'+r.stats+
    '\n\n[상대 말투 수치]\n'+styleLines(r.style)+(mbtiLine(r)?'\n\n'+mbtiLine(r):'')+'\n\n[대화 기록 (시간순, 중간 생략 있을 수 있음)]\n'+r.longExcerpt+
    '\n\nJSON 하나만 답해. 인용(quote)은 반드시 대화 기록에 있는 문장을 글자 그대로 옮기고, 날짜는 M/D 형식으로. 형식:\n{'+
    '"temperature":0~100 사이 정수(상대가 나에게 가진 호감 온도 추정),"temperature_label":"6자 안팎 한마디","verdict":"결론 3문장. 상대 마음이 어디쯤인지, 근거, 지금 가장 중요한 것",'+
    '"moments":[{"date":"M/D","quote":"상대가 한 말 그대로","context":"그 직전 내가 한 말 그대로 또는 빈 문자열","why":"왜 결정적인지 1~2문장"}] 정확히 3개 — 호감이 드러난 결정적 순간,'+
    '"cooling":[{"date":"M/D","quote":"상대가 한 말 그대로","why":"온도가 내려갔거나 선을 그은 것으로 보이는 이유"}] 0~2개 — 없으면 빈 배열,'+
    '"signals":[{"title":"관심 신호 이름","evidence":"수치나 실제 문장을 든 근거 1~2문장"}] 4개,'+
    '"reply_pattern":"상대의 답장 속도·타이밍이 의미하는 것 2~3문장 (시간대, 주제별 차이 포함)",'+
    '"style":"상대의 연애·대화 성향 2~3문장",'+
    '"secrets":[{"title":"15자 이내","body":"2~3문장"}] 정확히 3개 — 1) 상대가 나에게 유독 다르게 하는 말이나 반응 2) 답장이 늦어지는 순간의 진짜 의미 3) 상대가 기다리고 있을 가능성이 큰 것,'+
    '"send":[{"message":"내가 다음에 보내면 좋을 카톡 문장(내 평소 말투로)","why":"상대가 어떻게 반응할지와 이유"}] 정확히 3개,'+
    '"dont":[{"what":"피해야 할 말이나 행동","why":"이 상대에게 특히 안 좋은 이유"}] 2~3개,'+
    '"next_step":"다음 단계 제안 2문장. 언제, 무엇을, 어떻게 (요일·시간대까지)"'+(r.ymbti?',"mbti_tip":"'+r.ymbti+(r.mmbti?'와 '+r.mmbti+' 조합':'')+' 기준으로 실제 대화와 맞춰 본 공략 2~3문장"':'')+'}';
  return p;}
function personaText(tk){
  var p=tk.persona,out=[];
  if(p){
    out.push('말씨: '+p.speech,'성격·분위기: '+p.vibe,'호칭: '+(p.address_me||''));
    if(p.habits)out.push('말투 습관:\n- '+p.habits.join('\n- '));
    if(p.phrases)out.push('실제로 자주 쓴 표현: '+p.phrases.join(' / '));
    if(p.facts)out.push('대화로 확인된 사실·둘이 공유한 이야기:\n- '+p.facts.join('\n- '));
    if(p.reactions)out.push('상황별 반응:\n'+Object.keys(p.reactions).map(function(k){return '- '+({question:'질문받을 때',compliment:'칭찬받을 때',plan:'약속 제안받을 때',late_night:'밤늦게',flirt:'호감 표현받을 때',busy:'바쁘거나 피곤할 때',topic_change:'화제 전환 때',serious:'진지하거나 슬픈 얘기 때'}[k]||k)+': '+p.reactions[k]}).join('\n'));
    if(p.avoid)out.push('상대가 거의 안 하는 것(하지 마): '+p.avoid.join(' / '));
    if(p.recent_events&&p.recent_events.length)out.push('최근 있었던 큰일(꼭 기억해):\n- '+p.recent_events.join('\n- '));
    if(p.relationship)out.push('관계 상태: '+p.relationship);
    if(p.last_context)out.push('실제 대화가 끝난 지점: '+p.last_context);
  }else{
    out.push('말투 특징: '+tk.chips.join(', '),'자주 꺼내는 주제: '+tk.kw.join(', '));
  }
  return out.join('\n');
}
function grams(s){s=String(s).replace(/[\sㅋㅎㅠㅜ~!?.^]+/g,'');var g={};for(var i=0;i<s.length-1;i++)g[s.substr(i,2)]=1;return g}
function sim(a,b){var ka=Object.keys(a),kb=Object.keys(b);if(!ka.length||!kb.length)return 0;var n=0;ka.forEach(function(k){if(b[k])n++});return n/Math.sqrt(ka.length*kb.length)}
/* mood detection: serious / grief context overrides playful habits */
var GRIEF=/(죽었|죽어서|죽음|돌아가셨|돌아가신|하늘나라|무지개\s?다리|장례|빈소|부고|떠나보|떠나 보|보내줬|보내 줬|세상을 떠|세상 떠|안락사|사망|화장했|추모|명복)/;
var SERIOUS=/(슬프|슬퍼|슬픈|힘들|힘드|힘든|아프|아팠|아파|병원|수술|입원|울었|울고|울어|눈물|미안|사과|걱정|고민|진지|솔직히|우울|위로|괜찮아\?|괜찮아요\?|괜찮으세요|헤어지|헤어졌|이별|그만하|무서|불안|외로|상처|서운|화났|화나|실망|속상|보고싶|보고 싶|그립|마음이|생각이 많|잠이 안|못 자|정리|후회|사실은|사실 나|할 말|얘기하고 싶|진심)/;
function moodOf(tk){
  var sim=tk.log.filter(function(m){return m.w}),mine=sim.filter(function(m){return m.w==='me'}).slice(-3);
  var simTxt=sim.slice(-10).map(function(m){return m.x}).join('\n');
  var lastT=tk.tail.length?tk.tail[tk.tail.length-1].t:0;var recentReal=tk.tail.filter(function(m){return m.t>=lastT-4*864e5}).map(function(m){return m.x}).join('\n');
  var myTxt=mine.map(function(m){return m.x}).join('\n');
  var grief=GRIEF.test(simTxt)||GRIEF.test(recentReal);
  var longEarnest=mine.some(function(m){return m.x.length>=40&&!/ㅋ/.test(m.x)});
  var serious=grief||SERIOUS.test(myTxt)||longEarnest||(/[?？]/.test(myTxt)&&!/[ㅋㅎ]/.test(myTxt)&&myTxt.length>25);
  var heavyNow=GRIEF.test(simTxt)||GRIEF.test(myTxt);
  return {grief:grief,serious:serious,heavyNow:heavyNow};
}
function hasLaugh(s){return /ㅋ{2,}|ㅎ{2,}|ㅋㅋ|lol|ㅋ$/.test(s)}
function pickExamples(tk,query,mood){
  var q=grams(query);
  var scored=tk.pairs.filter(function(p){return p.m.length}).map(function(p,i){
    var mj=p.m.join(' '),yj=p.y.join(' '),s=sim(q,grams(mj));
    if(mood.serious){
      if(SERIOUS.test(mj)||GRIEF.test(mj))s+=0.5;
      if(SERIOUS.test(yj)||GRIEF.test(yj))s+=0.3;
      if(hasLaugh(yj))s-=0.6;
    }
    return {p:p,i:i,s:s,laugh:hasLaugh(yj)};
  });
  var pool=mood.serious?scored.filter(function(x){return !x.laugh}):scored;
  var top=pool.slice().sort(function(a,b){return b.s-a.s}).slice(0,14).filter(function(x){return x.s>0.05});
  var recent=pool.slice(-6),seen={},out=[];
  top.concat(recent).forEach(function(x){if(!seen[x.i]){seen[x.i]=1;out.push(x)}});
  out.sort(function(a,b){return a.i-b.i});
  if(!out.length)return '(해당하는 실제 예시가 적어. 말투 카드와 수치를 참고해.)';
  return out.slice(0,20).map(function(x){return x.p.m.map(function(m){return '나: '+m}).join('\n')+'\n'+x.p.y.map(function(y){return '상대: '+y}).join('\n')}).join('\n---\n');
}
var DOW=['일','월','화','수','목','금','토'];
function stamp(t){var d=new Date(t+9*3600e3);return (d.getUTCMonth()+1)+'/'+d.getUTCDate()+'('+DOW[d.getUTCDay()]+') '+pad(d.getUTCHours())+':'+pad(d.getUTCMinutes())}
function buildPrompt(tk){
  var mood=moodOf(tk);
  var lastMine=tk.log.filter(function(m){return m.w==='me'}).slice(-3).map(function(m){return m.x}).join(' ');
  var tail=tk.tail.slice(-200).map(function(m){return '['+stamp(m.t)+'] '+(m.w==='me'?'나':'상대')+': '+m.x}).join('\n');
  var simLog=tk.log.filter(function(m){return m.w}).slice(-40).map(function(m){return '['+stamp(m.t)+'] '+(m.w==='me'?'나':'상대')+': '+m.x}).join('\n');
  var now=new Date();
  var moodNote='';
  if(mood.serious)moodNote='\n\n[⚠ 지금 대화 분위기 경고]\n"나"의 최근 메시지는 진지하거나 감정이 담긴 이야기야.'+
    (mood.grief?' 그리고 최근 대화에 죽음·이별·상실 이야기가 있어(누가 무엇을 잃었는지 기록에서 정확히 확인해). 상실을 겪은 사람이 상대 본인이라면, 상대는 지금 슬픔 속에 있는 사람이야. 그 마음 상태 그대로 말해.':'')+
    '\n이번 답장에서는 ㅋㅋ, ㅎㅎ, 장난, 농담, 놀리기, "갑자기 진지하네" 같은 가벼운 반응, 이모티콘을 절대 쓰지 마. 평소 말투(어미, 호칭, 존댓말/반말, 띄어쓰기)는 유지하되, 이 사람이 진지한 순간에 실제로 하는 방식으로 답해.';
  return '너는 카카오톡 대화 시뮬레이터야. 아래 실제 대화 기록 속 "상대"(이용자 폰에 저장된 이름: '+tk.yname+') 본인이 되어, 이어지는 카톡에 상대가 실제로 보낼 답장을 써. 이용자("나")는 실제로 보내기 전에 상대 반응을 미리 느껴 보려고 이 시뮬레이션을 써. 이용자는 돈을 내고 이걸 써. 말투만 비슷한 흉내가 아니라, 그 사람의 마음 상태와 지금 대화의 무게까지 이해하는 "진짜 그 사람 같은" 답장이어야 해. 사람은 상황에 따라 같은 말투로도 전혀 다르게 반응해.\n\n'+
  '[상대 말투·관계 카드]\n'+personaText(tk)+'\n\n'+(mbtiLine(tk)?mbtiLine(tk)+'\n\n':'')+
  '[실제 대화에서 계산한 말투 수치 — 평소 가벼운 대화 기준의 기본값. 웃음·이모티콘 수치는 분위기가 가벼울 때만 적용]\n'+styleLines(tk.style)+'\n\n'+
  '[상대가 실제로 했던 답장 예시 — 말투 참고용. 복사하지 말고, 지금 상황과 분위기가 다르면 따라 하지 마]\n'+pickExamples(tk,lastMine,mood)+'\n\n'+
  '[실제 대화 기록 — 가장 최근 부분, 시간순]\n'+tail+'\n\n'+
  '[여기부터 지금 대화 — 위 실제 대화 바로 다음에 이어짐. 현재 시각 '+stamp(now.getTime())+']\n'+simLog+moodNote+'\n\n'+
  '[답장 쓰는 순서]\n'+
  '먼저 ###판단### 줄을 쓰고, 그 아래에 다음 네 줄을 써(이용자에게 보이지 않아):\n'+
  '분위기: "나"의 마지막 메시지(들)가 가벼운지, 진지한지, 슬픈지, 설레는지, 서운한지 한 줄\n'+
  '상대 상태: 기록상 상대가 최근 겪은 일과 지금 마음 상태 한 줄 (예: 어제 오래 키운 반려견을 떠나보내서 슬픔이 큼, 야근 후 지침 등)\n'+
  '맥락: 지금 무슨 얘기가 이어지는 중이고, 이미 오간 내용 중 놓치면 안 되는 것 한 줄\n'+
  '톤: 이 사람이라면 이 순간 어떤 톤과 길이로 답할지 한 줄\n'+
  '그다음 ###답장### 줄을 쓰고, 그 아래에 상대가 보낼 카톡 메시지만 써.'+
  (tk.showKabi===false?'':' 마지막으로 ###까비### 줄을 쓰고 그 아래에 해설 두 줄을 써.')+'\n\n'+
  '[답장 규칙]\n'+
  '1. 분위기가 최우선이야. 진지하거나 슬픈 이야기에는 진지하게, 위로가 필요하면 위로를, 고마운 마음엔 고마움을. 진지한 말에 웃거나 농담하거나 화제를 돌리면 실패야. 평소 장난이 많은 사람도 이런 순간엔 진지해져.\n'+
  '2. 상대 본인으로서 "나"의 마지막 메시지(들)에 실제로 답해. 실제 대화와 지금 대화의 앞선 내용을 모두 기억하고 이어 가. 이미 답한 걸 또 묻거나, 앞에서 한 말과 모순되면 안 돼. 최근에 있었던 큰일(상실, 아픔, 시험, 이직 등)을 잊은 것처럼 말하면 안 돼.\n'+
  '3. 둘이 공유한 사실(약속, 일정, 직장, 반려동물, 지난 얘기)을 자연스럽게 써. 기록에 없는 구체적 사실은 지어내지 마.\n'+
  '4. 말투의 형식은 따라 해: 어미, 존댓말/반말, 호칭, 띄어쓰기, 마침표 유무, 맞장구 방식. 상대가 안 쓰는 이모지나 표현은 쓰지 마. 웃음·이모티콘은 분위기에 맞을 때만.\n'+
  '5. 말풍선 수와 길이는 평소 수치를 기본으로 하되, 진지한 순간엔 사람이 그렇듯 조금 길어지거나 한 번에 이어 쓸 수 있어.\n'+
  '6. 관계 온도는 실제 기록 그대로. 실제보다 과하게 다정하거나 적극적이 되지 마. 다만 상대의 따뜻함이나 고마움이 자연스러운 순간에는 그걸 숨기지 마. "나"가 갑자기 고백하거나 무리한 말을 하면 실제 상대가 할 법한 현실적인 반응(당황, 조심스러운 대답, 시간 달라고 하기 등)을 해. 진심이 담긴 말을 비웃거나 장난으로 넘기지는 마.\n'+
  '7. 현재 요일과 시각을 반영해.\n'+
  '8. ###답장### 아래에는 메시지만. 말풍선 하나당 한 줄. 이름표, 따옴표, 설명, 괄호 지문 금지. 이모티콘을 보낼 땐 그 줄에 (이모티콘)만. AI, 시뮬레이션, 분석 같은 말 금지.'+
  (tk.showKabi===false?'':'\n9. ###까비### 아래 두 줄:\n이유: 상대가 방금 이렇게 답한 이유를 1~2문장 해요체로. 지금 분위기와 상대 상태, 실제 대화에서 보인 패턴(과거 비슷한 상황의 반응, 관계 온도'+(tk.ymbti?', '+tk.ymbti+' 경향':'')+')을 구체적 근거로. "~같아요", "~일 수 있어요"로.\n추천: 이 답장을 받은 내가 이어서 보내면 좋을 메시지 한 줄 (나의 평소 말투로, 지금 분위기에 맞게, 따옴표 없이)');
}

export function cleanTalk(t){
  t=t||{};
  var str=function(x,n){return S(x,n)};
  var tm=function(x){x=+x;return isFinite(x)?x:Date.now()};
  var persona=(t.persona&&typeof t.persona==='object'&&JSON.stringify(t.persona).length<=16000)?t.persona:null;
  return {yname:str(t.yname,16)||'상대',ymbti:/^[EI][NS][FT][JP]$/.test(t.ymbti||'')?t.ymbti:'',mmbti:/^[EI][NS][FT][JP]$/.test(t.mmbti||'')?t.mmbti:'',
    showKabi:t.showKabi!==false,persona:persona,style:fixStyle(t.style),
    chips:Array.isArray(t.chips)?t.chips.slice(0,10).map(function(x){return str(x,30)}):[],
    kw:Array.isArray(t.kw)?t.kw.slice(0,8).map(function(x){return str(x,12)}):[],
    pairs:(Array.isArray(t.pairs)?t.pairs.slice(-600):[]).map(function(p){return {m:(p.m||[]).slice(0,8).map(function(x){return str(x,160)}),y:(p.y||[]).slice(0,8).map(function(x){return str(x,160)})}}),
    tail:(Array.isArray(t.tail)?t.tail.slice(-200):[]).map(function(m){return {w:m.w==='me'?'me':'you',x:str(m.x,300),t:tm(m.t)}}),
    log:(Array.isArray(t.log)?t.log:[]).filter(function(m){return m&&m.w}).slice(-40).map(function(m){return {w:m.w==='me'?'me':'you',x:str(m.x,300),t:tm(m.t)}})};
}
export {buildPrompt as chatPrompt, moodOf};
