const STORAGE_KEY = "cih.sessions.v1";
const chatLog = document.getElementById("chatLog");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const manageSessionsBtn = document.getElementById("manageSessionsBtn");
const sessionDialog = document.getElementById("sessionDialog");
const sessionList = document.getElementById("sessionList");
const createSessionBtn = document.getElementById("createSessionBtn");
const newTitleInput = document.getElementById("newTitle");
const newScriptureInput = document.getElementById("newScripture");
const newSpeakerInput = document.getElementById("newSpeaker");
const sessionTitle = document.getElementById("sessionTitle");
const sessionScripture = document.getElementById("sessionScripture");
const sessionSpeaker = document.getElementById("sessionSpeaker");

const SCRIPTURE_API_BASE = "https://bible-api.com/";
const SCRIPTURE_API_TRANSLATION = "esv";
const TRANSLATION_API_ENDPOINT = "/api/translate";

const BOOK_ALIASES = {
  acts: { canonical: "Acts", language: "en" },
  사도행전: { canonical: "Acts", language: "ko" },
  행: { canonical: "Acts", language: "ko" },
  john: { canonical: "John", language: "en" },
  요한복음: { canonical: "John", language: "ko" },
  요: { canonical: "John", language: "ko" },
};

const SAMPLE_SCRIPTURE_DB = {
  Acts: {
    chapters: {
      1: {
        8: {
          en: "But you will receive power when the Holy Spirit has come upon you, and you will be my witnesses in Jerusalem and in all Judea and Samaria, and to the end of the earth. (ESV)",
          ko: "오직 성령이 너희에게 임하시면 너희가 권능을 받고 예루살렘과 온 유대와 사마리아와 땅 끝까지 이르러 내 증인이 되리라 하시니라. (KRV)",
        },
      },
    },
  },
  John: {
    chapters: {
      3: {
        16: {
          en: "For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life. (ESV)",
          ko: "하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 이는 그를 믿는 자마다 멸망하지 않고 영생을 얻게 하려 하심이라. (KRV)",
        },
        17: {
          en: "For God did not send his Son into the world to condemn the world, but in order that the world might be saved through him. (ESV)",
          ko: "하나님이 그 아들을 세상에 보내신 것은 세상을 심판하려 하심이 아니요 그로 말미암아 세상이 구원을 받게 하려 하심이라. (KRV)",
        },
      },
    },
  },
};

const BASE_DICTIONARY = [
  // Basic greetings and common phrases
  { ko: "안녕하세요", en: "hello" },
  { ko: "감사합니다", en: "thank you" },
  { ko: "아멘", en: "amen" },
  { ko: "할렐루야", en: "hallelujah" },
  
  // Core theological terms
  { ko: "하나님", en: "God" },
  { ko: "예수님", en: "Jesus" },
  { ko: "예수 그리스도", en: "Jesus Christ" },
  { ko: "성령", en: "Holy Spirit" },
  { ko: "성부", en: "God the Father" },
  { ko: "성자", en: "God the Son" },
  { ko: "삼위일체", en: "Trinity" },
  
  // Salvation and grace
  { ko: "은혜", en: "grace" },
  { ko: "구원", en: "salvation" },
  { ko: "속죄", en: "redemption" },
  { ko: "칭의", en: "justification" },
  { ko: "성화", en: "sanctification" },
  { ko: "회개", en: "repentance" },
  { ko: "믿음", en: "faith" },
  { ko: "소망", en: "hope" },
  { ko: "사랑", en: "love" },
  { ko: "복음", en: "gospel" },
  
  // Controversial/specific theological concepts
  { ko: "귀복주의", en: "prosperity gospel" },
  { ko: "번영신학", en: "prosperity theology" },
  { ko: "기복신앙", en: "prosperity faith" },
  { ko: "율법주의", en: "legalism" },
  { ko: "은사주의", en: "charismatic movement" },
  { ko: "근본주의", en: "fundamentalism" },
  { ko: "자유주의", en: "liberalism" },
  { ko: "복음주의", en: "evangelicalism" },
  
  // Worship and church practices
  { ko: "예배", en: "worship service" },
  { ko: "기도", en: "prayer" },
  { ko: "찬양", en: "praise" },
  { ko: "찬송", en: "hymn" },
  { ko: "찬송가", en: "hymnbook" },
  { ko: "경배", en: "worship" },
  { ko: "기도합시다", en: "let us pray" },
  { ko: "축도", en: "benediction" },
  { ko: "축복", en: "blessing" },
  { ko: "성찬식", en: "communion" },
  { ko: "주의 만찬", en: "Lord's Supper" },
  { ko: "세례", en: "baptism" },
  { ko: "침례", en: "baptism by immersion" },
  
  // Scripture and teaching
  { ko: "설교", en: "sermon" },
  { ko: "말씀", en: "the Word" },
  { ko: "성경", en: "Bible" },
  { ko: "성서", en: "Scripture" },
  { ko: "구약", en: "Old Testament" },
  { ko: "신약", en: "New Testament" },
  { ko: "묵상", en: "meditation" },
  { ko: "성경공부", en: "Bible study" },
  
  // Church roles and structure
  { ko: "목사", en: "pastor" },
  { ko: "장로", en: "elder" },
  { ko: "집사", en: "deacon" },
  { ko: "권사", en: "deaconess" },
  { ko: "전도사", en: "evangelist" },
  { ko: "선교사", en: "missionary" },
  { ko: "성도", en: "believer" },
  { ko: "교인", en: "church member" },
  { ko: "신자", en: "believer" },
  
  // Mission and outreach
  { ko: "선교", en: "missions" },
  { ko: "전도", en: "evangelism" },
  { ko: "복음 전파", en: "spreading the gospel" },
  { ko: "봉사", en: "service" },
  { ko: "사역", en: "ministry" },
  { ko: "섬김", en: "serving" },
  
  // Spiritual concepts
  { ko: "평강", en: "peace" },
  { ko: "평안", en: "peace" },
  { ko: "기쁨", en: "joy" },
  { ko: "감사", en: "thanksgiving" },
  { ko: "겸손", en: "humility" },
  { ko: "순종", en: "obedience" },
  { ko: "헌신", en: "dedication" },
  { ko: "영광", en: "glory" },
  { ko: "영생", en: "eternal life" },
  { ko: "천국", en: "heaven" },
  { ko: "지옥", en: "hell" },
  { ko: "부활", en: "resurrection" },
  { ko: "재림", en: "second coming" },
  { ko: "강림", en: "advent" },
  { ko: "종말", en: "end times" },
  
  // Offering and stewardship
  { ko: "십일조", en: "tithe" },
  { ko: "헌금", en: "offering" },
  { ko: "감사헌금", en: "thanksgiving offering" },
  { ko: "청지기", en: "steward" },
  { ko: "청지기 정신", en: "stewardship" },
  
  // Prayer types
  { ko: "중보기도", en: "intercession" },
  { ko: "통성기도", en: "corporate prayer" },
  { ko: "침묵기도", en: "silent prayer" },
  { ko: "간구", en: "supplication" },
  
  // Other common terms
  { ko: "사랑의 수고", en: "labor of love" },
  { ko: "영혼", en: "soul" },
  { ko: "영", en: "spirit" },
  { ko: "육체", en: "flesh" },
  { ko: "죄", en: "sin" },
  { ko: "의", en: "righteousness" },
  { ko: "거룩함", en: "holiness" },
  { ko: "언약", en: "covenant" },
  { ko: "제단", en: "altar" },
  { ko: "희생", en: "sacrifice" },
  
  // Advanced theological terms
  { ko: "성령내주", en: "indwelling of the Holy Spirit" },
  { ko: "환란", en: "tribulation" },
  { ko: "철야 예배", en: "all-night vigil" },
  { ko: "교리", en: "doctrine" },
  { ko: "소요리 문답", en: "Shorter Catechism" },
  { ko: "교대이교", en: "ancient paganism" },
  { ko: "미신", en: "superstition" },
  { ko: "서신서", en: "epistles" },
  { ko: "본질상 진노의 자녀", en: "by nature, children of wrath" },
  { ko: "성육하고 번성", en: "be fruitful and multiply" },
  { ko: "견고한 진", en: "stronghold" },
  { ko: "본질", en: "essence" },
  { ko: "징계", en: "discipline" },
  { ko: "다스리고 정복", en: "rule over and subdue" },
  
  // Worship and service terms
  { ko: "매시 매사", en: "at all times and in all things" },
  { ko: "정성을 드린다", en: "offer with sincerity" },
  { ko: "마음을 주장하다", en: "guard our hearts" },
  { ko: "불쌍히 여긴다", en: "show compassion" },
  { ko: "감격", en: "being moved with thanksgiving" },
  
  // Church organization and roles
  { ko: "사회자", en: "presider" },
  { ko: "주관하다", en: "preside" },
  { ko: "유치부", en: "preschool ministry" },
  { ko: "실무진", en: "working staff" },
  { ko: "총무단", en: "executive committee" },
  
  // General spiritual concepts
  { ko: "내적", en: "internal" },
  { ko: "무조건", en: "unconditional" },
  { ko: "의도", en: "intention" },
  { ko: "의식", en: "consciousness" },
  { ko: "비방", en: "slander" },
  { ko: "윤리", en: "ethics" },
  { ko: "도덕", en: "morality" },
  { ko: "재주", en: "talents" },
  { ko: "보장", en: "guarantee" },
  { ko: "조건", en: "condition" },
  { ko: "관리", en: "manage" },
  { ko: "단속", en: "control" },
  { ko: "다스리다", en: "rule over" },
  { ko: "형통", en: "prosperity" },
  { ko: "추방", en: "expel" },
  { ko: "소유자", en: "owner" },
  { ko: "동기", en: "motive" },
  { ko: "고민", en: "concern" },
  { ko: "진심", en: "sincere heart" },
  
  // Descriptive terms
  { ko: "놀랍다", en: "marvelous" },
  { ko: "충분하다", en: "sufficient" },
  { ko: "급하다", en: "urgent" },
  { ko: "버티다", en: "endure" },
  { ko: "마음이 아프다", en: "heartbroken" },
  { ko: "억울", en: "wronged" },
  
  // Everyday and specific terms
  { ko: "기념비", en: "monument" },
  { ko: "보식", en: "supplemental food" },
  { ko: "여유", en: "leisure" },
  { ko: "정시", en: "on schedule" },
  { ko: "끈 떨어진 연", en: "kite with a broken string" },
  { ko: "주파수", en: "frequency" },
  { ko: "걸걸한 목소리", en: "hoarse voice" },
  { ko: "유서", en: "will" },
  { ko: "교범", en: "guidebook" },
  { ko: "조경", en: "landscaping" },
  { ko: "비석", en: "gravestone" },
  { ko: "치매", en: "dementia" },
  { ko: "애국심", en: "patriotism" },
  { ko: "보고", en: "report" },
  { ko: "동문서답", en: "nonsensical answer" },
  { ko: "박예 주의자", en: "philanthropist" },
  
  // Church leadership and organization (Word Lists #1-10)
  { ko: "권사님", en: "encourager" },
  { ko: "선교국장", en: "missions director" },
  { ko: "사무총장", en: "chief executive" },
  { ko: "노회장", en: "chairman of presbytery" },
  { ko: "미주 총회장", en: "president of US general assembly" },
  { ko: "국회의원", en: "member of national assembly" },
  { ko: "회장님", en: "chairman" },
  { ko: "개혁총회", en: "reformed general assembly" },
  { ko: "장학사", en: "school inspector" },
  { ko: "후계자", en: "successor" },
  { ko: "상속자", en: "heir" },
  { ko: "장자", en: "firstborn" },
  
  // Advanced theological and doctrinal terms
  { ko: "죄를 사하다", en: "forgiveness of sins" },
  { ko: "계명", en: "commandment" },
  { ko: "계시", en: "revelation" },
  { ko: "칭의", en: "justification" },
  { ko: "성화", en: "sanctification" },
  { ko: "죄값을 치루다", en: "atonement of sin" },
  { ko: "조직신학", en: "systematic theology" },
  { ko: "성찬식", en: "holy communion service" },
  { ko: "성만찬", en: "eucharist" },
  { ko: "기념", en: "commemorate" },
  { ko: "종교개혁", en: "protestant reformation" },
  { ko: "신학", en: "theology" },
  { ko: "교파", en: "denomination" },
  { ko: "비유", en: "parable" },
  { ko: "거듭", en: "born again" },
  { ko: "거듭나다", en: "be born again" },
  { ko: "옥합", en: "alabaster jar" },
  { ko: "음부의 권세", en: "gates of hell" },
  { ko: "정사", en: "rulers" },
  { ko: "신성", en: "divinity" },
  { ko: "중대원 메시지", en: "church officer graduate school message" },
  { ko: "성명서", en: "statement" },
  { ko: "원색 복음", en: "pure gospel" },
  { ko: "계척", en: "pioneer" },
  { ko: "계혁", en: "reform" },
  
  // Worship and spiritual practices
  { ko: "안수", en: "anoint" },
  { ko: "중보기도", en: "intercessory prayer" },
  { ko: "철야기도", en: "overnight prayer" },
  { ko: "통성기도", en: "corporate prayer" },
  { ko: "임종예배", en: "deathbed worship" },
  { ko: "사모하다", en: "longing" },
  { ko: "말씀을 사모", en: "long for the word" },
  { ko: "통독", en: "reading entirety" },
  { ko: "유월절", en: "Passover" },
  { ko: "오순절", en: "Pentecost" },
  { ko: "맥추절", en: "feast of harvest of barley" },
  { ko: "수장절", en: "feast of ingathering" },
  
  // False religion and spiritual warfare
  { ko: "무당", en: "shaman" },
  { ko: "무속인", en: "shaman" },
  { ko: "점쟁이", en: "fortune teller" },
  { ko: "스님", en: "monk" },
  { ko: "극락", en: "paradise" },
  { ko: "부적", en: "charm" },
  { ko: "영부", en: "Buddhist name register" },
  { ko: "연옥", en: "purgatory" },
  { ko: "굿", en: "exorcism" },
  { ko: "점술", en: "divination" },
  { ko: "범신론", en: "pantheism" },
  { ko: "혼합주의", en: "syncretism" },
  { ko: "접신", en: "possession" },
  { ko: "사단을 쫓아내다", en: "drive out satan" },
  { ko: "신사참배", en: "submission to japanese shrine" },
  { ko: "순사", en: "japanese police" },
  
  // Biblical and theological concepts
  { ko: "무한 영광", en: "utmost glory" },
  { ko: "40주야", en: "40 weeks" },
  { ko: "톡권", en: "privilege" },
  { ko: "표적", en: "signs" },
  { ko: "정죄", en: "condemn" },
  { ko: "타락", en: "corruption" },
  { ko: "죄악", en: "crime" },
  { ko: "은총", en: "blessing" },
  { ko: "신실하신", en: "faithful" },
  { ko: "성실함", en: "faithfulness" },
  { ko: "희락", en: "joy" },
  { ko: "영감", en: "inspiration" },
  { ko: "각성", en: "awakening" },
  { ko: "부흥", en: "revival" },
  { ko: "복종", en: "submission" },
  { ko: "순종", en: "obedience" },
  { ko: "용서", en: "forgiveness" },
  { ko: "명령", en: "command" },
  { ko: "선의", en: "decree" },
  { ko: "역사성", en: "historicity" },
  
  // Spiritual attributes and character
  { ko: "나쁜 생각", en: "negative thoughts" },
  { ko: "유혹", en: "temptation" },
  { ko: "음란", en: "adultery" },
  { ko: "탐나다", en: "covet" },
  { ko: "낙심", en: "discouraged" },
  { ko: "의심", en: "doubt" },
  { ko: "질투", en: "jealous of what you have" },
  { ko: "시기", en: "jealous of what you don't have" },
  { ko: "시기하다", en: "to be jealous" },
  { ko: "부러움", en: "admiring jealousy" },
  { ko: "부럽다", en: "envy" },
  { ko: "죄책감을 가지다", en: "feel guilty" },
  { ko: "동정심", en: "sympathy" },
  { ko: "인내", en: "patience" },
  { ko: "용기", en: "courage" },
  { ko: "담대", en: "boldness" },
  { ko: "천진난만", en: "innocence" },
  { ko: "인정", en: "acknowledge" },
  { ko: "솔직", en: "honest" },
  { ko: "겸손", en: "humility" },
  { ko: "우아하다", en: "elegant" },
  { ko: "중후하다", en: "dignified" },
  { ko: "자상", en: "caring" },
  
  // Emotions and feelings
  { ko: "애통하다", en: "mourn" },
  { ko: "화나다", en: "upset" },
  { ko: "아쉽다", en: "disappointing" },
  { ko: "반했다", en: "smitten" },
  { ko: "마음이 아프다", en: "hurt feelings" },
  { ko: "보람을 느끼다", en: "feel worthwhile" },
  { ko: "감당하기 어렵다", en: "hard to bear" },
  { ko: "낙이 없다", en: "no joy" },
  { ko: "두려움", en: "fear" },
  
  // Mental health terms (Word List #6)
  { ko: "불안증", en: "anxiety disorder" },
  { ko: "공황장애", en: "panic disorder" },
  { ko: "분리불안", en: "separation anxiety" },
  { ko: "조울증", en: "bipolar disorder" },
  { ko: "자폐", en: "autism" },
  { ko: "틱", en: "tic disorder" },
  { ko: "강박증", en: "OCD" },
  { ko: "조현병", en: "schizophrenia" },
  { ko: "우울증", en: "depression" },
  { ko: "불면증", en: "insomnia" },
  { ko: "수면제", en: "sleeping pill" },
  { ko: "심리 치료", en: "psychotherapy" },
  
  // Medical terms
  { ko: "결핵", en: "tuberculosis" },
  { ko: "나병", en: "leprosy" },
  { ko: "열병", en: "severe fever" },
  { ko: "골절", en: "fracture" },
  { ko: "혈관", en: "blood vessel" },
  { ko: "중증환자", en: "severe patient" },
  { ko: "처방", en: "prescription" },
  { ko: "투병", en: "fighting disease" },
  { ko: "조직검사", en: "biopsy" },
  { ko: "수칙하다", en: "gaunt" },
  
  // Church facilities and spaces
  { ko: "요양원", en: "nursing home" },
  { ko: "양로원", en: "nursing home" },
  { ko: "고아원", en: "orphanage" },
  { ko: "수도원", en: "monastery" },
  { ko: "공동묘지", en: "cemetery" },
  { ko: "산실", en: "birthplace" },
  { ko: "처소", en: "dwelling place" },
  { ko: "오두막", en: "hut" },
  
  // Ministry and missions
  { ko: "파송", en: "commission" },
  { ko: "계척", en: "pioneering" },
  { ko: "미계척 미전도종족", en: "unreached unengaged people groups" },
  { ko: "분포지도", en: "distribution map" },
  { ko: "재생산화", en: "reproduction" },
  { ko: "격대교육", en: "grandparents education" },
  { ko: "수련회", en: "retreat" },
  { ko: "집회", en: "conference" },
  { ko: "초대", en: "invitation" },
  { ko: "후원", en: "support" },
  { ko: "부탁", en: "request" },
  { ko: "저축", en: "savings" },
  { ko: "재정", en: "finances" },
  { ko: "난민", en: "refugee" },
  { ko: "재정착", en: "resettlement" },
  { ko: "소외", en: "alienation" },
  { ko: "신학생", en: "seminary student" },
  
  // Church programs and events
  { ko: "선한 지도자 학교", en: "good leader school" },
  { ko: "발족식", en: "inauguration ceremony" },
  { ko: "자격증", en: "certificate" },
  { ko: "소개", en: "introduction" },
  
  // Language and grammar
  { ko: "헬라어", en: "Greek" },
  { ko: "명사", en: "noun" },
  { ko: "동사", en: "verb" },
  { ko: "참고", en: "reference" },
  { ko: "예화", en: "anecdote" },
  { ko: "명언", en: "quote" },
  
  // General descriptive terms
  { ko: "결정타", en: "final blow" },
  { ko: "철학", en: "philosophy" },
  { ko: "복구", en: "restore" },
  { ko: "주제", en: "subject" },
  { ko: "공식", en: "official" },
  { ko: "점화", en: "ignite" },
  { ko: "응징", en: "revenge" },
  { ko: "도발", en: "provoke" },
  { ko: "폭행", en: "assault" },
  { ko: "폭력", en: "violence" },
  { ko: "훌륭한", en: "excellent" },
  { ko: "도벽", en: "kleptomania" },
  { ko: "수여", en: "present awards" },
  { ko: "생산", en: "production" },
  { ko: "운영", en: "operate" },
  { ko: "방해", en: "interfere" },
  { ko: "배설물", en: "waste" },
  { ko: "만족", en: "satisfaction" },
  { ko: "양보", en: "yield" },
  { ko: "망설이다", en: "hesitate" },
  { ko: "구하다", en: "seek" },
  { ko: "책임", en: "responsibility" },
  { ko: "비판", en: "criticize" },
  { ko: "허망", en: "futile" },
  { ko: "칭찬", en: "compliment" },
  { ko: "감사", en: "thanksgiving" },
  { ko: "정려", en: "gratitude" },
  { ko: "거절", en: "reject" },
  { ko: "폭로", en: "expose" },
  { ko: "이룬다", en: "work out" },
  { ko: "결과", en: "consequence" },
  { ko: "가치", en: "value" },
  { ko: "기준", en: "standard" },
  { ko: "특징", en: "distinctive characteristic" },
  { ko: "든든하다", en: "reliable" },
  { ko: "잠재력", en: "potential" },
  { ko: "임제", en: "presence" },
  { ko: "대상", en: "target" },
  { ko: "한", en: "consuming passion" },
  { ko: "인성", en: "character" },
  { ko: "인품", en: "personality" },
  { ko: "성격", en: "personality" },
  { ko: "자세", en: "attitude" },
  { ko: "장점", en: "strengths" },
  { ko: "단점", en: "weaknesses" },
  { ko: "주관적", en: "subjective" },
  { ko: "객관적", en: "objective" },
  { ko: "연합", en: "joint" },
  { ko: "일정", en: "schedule" },
  
  // Specific phrases and idioms
  { ko: "옷깃만 스쳐도 인연", en: "even a brush can lead to destiny" },
  { ko: "눈치 본다", en: "gauging the mood" },
  { ko: "산전수전", en: "hardship" },
  { ko: "실감", en: "realize" },
  { ko: "구체적으로", en: "specifically" },
  { ko: "노잣돈", en: "travel money" },
  { ko: "귀찮다", en: "bothersome" },
  { ko: "불안하다", en: "anxious" },
  { ko: "물리친다", en: "defeat" },
  { ko: "작심삼일", en: "three day resolution" },
  { ko: "끊임없이", en: "endlessly" },
  { ko: "우뚝하다", en: "stern" },
  { ko: "호미해지다", en: "worn out" },
  { ko: "큰일나다", en: "big trouble" },
  { ko: "원망", en: "resentment" },
  { ko: "가슴에 점", en: "void in heart" },
  { ko: "예수님의 탄식", en: "Jesus's lament" },
  { ko: "난리가 나다", en: "uproar" },
  { ko: "지나치지 않다", en: "does not go too far" },
  { ko: "지란지교", en: "noble friendship" },
  { ko: "일맥상통", en: "in line with" },
  { ko: "굳게 잡아라", en: "hold firmly" },
  { ko: "굳게 힘있게 세워라", en: "firmly raised" },
  { ko: "도를 따르다", en: "realize the way" },
  { ko: "아깝다", en: "what a waste" },
  { ko: "그럼으로 불구하고", en: "nevertheless" },
  { ko: "범사", en: "in all things" },
  { ko: "잘됨", en: "prosperity" },
  { ko: "별세", en: "passed away with respect" },
  { ko: "객사", en: "passed away" },
  { ko: "하늘 나라에 돌아간다", en: "returned to heaven" },
  
  // Items and objects
  { ko: "관악기", en: "wind instrument" },
  { ko: "현악기", en: "string instrument" },
  { ko: "갈고리", en: "hook" },
  { ko: "목발", en: "crutches" },
  { ko: "활명수", en: "carbonated herbs drink" },
  { ko: "액자", en: "photo frame" },
  { ko: "나침반", en: "compass" },
  { ko: "추금기", en: "first record player" },
  { ko: "공동품", en: "antique" },
  { ko: "뽈", en: "swamp" },
  { ko: "반석", en: "solid foundation" },
  { ko: "흔적", en: "trace" },
  { ko: "로뎀나무", en: "broom tree" },
  
  // Historical and cultural terms
  { ko: "이차대전", en: "WWII" },
  { ko: "연합군", en: "allies" },
  { ko: "상해임시정부", en: "shanghai provisional government" },
  { ko: "호적", en: "registry" },
  { ko: "음주운전", en: "DUI" },
  { ko: "뺑손이", en: "hit and run" },
  { ko: "타주", en: "out of state" },
  { ko: "경비", en: "security" },
  { ko: "신고", en: "report complaint" },
  { ko: "행정", en: "administration" },
  { ko: "행정사", en: "administrative professional" },
  { ko: "대한행정사회", en: "korean association of administrative professionals" },
  { ko: "종합일간 신문", en: "comprehensive daily newspaper" },
  
  // Academic and intellectual terms
  { ko: "학자", en: "scholar" },
  { ko: "박사", en: "doctor" },
  { ko: "전문성", en: "expertise" },
  { ko: "착각", en: "misconception" },
  { ko: "계몽", en: "enlightenment" },
  { ko: "의론", en: "ideals" },
  { ko: "무지", en: "ignorance" },
  { ko: "지식", en: "knowledge" },
  { ko: "이성", en: "reason" },
  { ko: "잠재의식", en: "subconscious" },
  { ko: "양자컴퓨터", en: "quantum computer" },
  { ko: "책 재판", en: "publish edition" },
  
  // People and relationships
  { ko: "노숙자", en: "homeless person" },
  { ko: "평신도", en: "layperson" },
  { ko: "노인", en: "elderly person" },
  { ko: "무장", en: "armed" },
  { ko: "주역", en: "main figure" },
  { ko: "주연", en: "main character" },
  { ko: "바보", en: "ignorant" },
  { ko: "유모", en: "humor" },
  
  // Geographic and location terms
  { ko: "이북", en: "north korea" },
  { ko: "안성시 행정사회", en: "anseong city administrative society" },
  { ko: "미주 어린이 선교국", en: "children's ministry USA" },
  
  // Miscellaneous important terms
  { ko: "수요", en: "demand" },
  { ko: "성숙하다", en: "mature" },
  { ko: "편리", en: "convenient" },
  { ko: "반품", en: "return" },
  { ko: "사영", en: "death penalty" },
  { ko: "형편", en: "circumstance" },
  { ko: "기본", en: "basics" },
  { ko: "기초", en: "fundamentals" },
  { ko: "비대면", en: "contactless" },
  { ko: "소박", en: "very simple" },
  { ko: "희한한", en: "strange" },
  { ko: "거부감", en: "rejection" },
  { ko: "촌스럽다", en: "tacky" },
  { ko: "감가상각", en: "depreciation" },
  { ko: "극단적인", en: "extreme" },
  { ko: "후유증", en: "aftereffect" },
  { ko: "비참하다", en: "miserable" },
  { ko: "광병", en: "madness" },
  { ko: "단위성", en: "rightful" },
  { ko: "필연성", en: "inevitable" },
  { ko: "절대성", en: "absolute" },
  { ko: "장래의 일", en: "things to come" },
  { ko: "삶의 모습", en: "way of life" },
  { ko: "문제", en: "problem" },
  { ko: "갈등", en: "conflict" },
  { ko: "위기", en: "crisis" },
  { ko: "죄", en: "sin" },
  { ko: "회개", en: "repentance" },
  { ko: "긍휼", en: "mercy" },
  { ko: "실눈", en: "squinted" },
  { ko: "소경", en: "blind" },
  { ko: "기업", en: "inheritance" },
  { ko: "작품", en: "masterpiece" },
  { ko: "유산", en: "legacy" },
  { ko: "합창단", en: "choir" },
  { ko: "성악학", en: "vocal studies" },
  { ko: "대중음악", en: "popular music" },
  { ko: "미녀와 야술", en: "beauty and the beast" },
  { ko: "스가모니", en: "Siddhartha" },
  { ko: "약화", en: "weaken" },
  { ko: "맹새", en: "oath" },
  { ko: "전환점", en: "turning point" },
  { ko: "위로", en: "comfort" },
];

const KO_TO_EN = new Map(BASE_DICTIONARY.map((entry) => [entry.ko, entry.en]));
const EN_TO_KO = new Map(BASE_DICTIONARY.map((entry) => [entry.en.toLowerCase(), entry.ko]));

let sessions = loadSessions();
let activeSessionId = sessions[0]?.id ?? null;

const AUTO_SCROLL_THRESHOLD = 10;

init();

function init() {
  if (!activeSessionId && sessions.length > 0) {
    activeSessionId = sessions[0].id;
  }

  renderSessionInfo();
  renderChatLog();
  renderSessionList();
  bindEvents();

  if (!activeSessionId) {
    openSessionDialog();
  }
}

function bindEvents() {
  chatForm.addEventListener("submit", onSubmitMessage);
  manageSessionsBtn.addEventListener("click", openSessionDialog);
  sessionList.addEventListener("click", onSessionListClick);
  createSessionBtn.addEventListener("click", onCreateSession);
  chatInput.addEventListener("input", autoResizeInput);
  chatInput.addEventListener("keydown", onChatInputKeyDown);
}

function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed.map((session) => ({
      ...session,
      transcript: session.transcript ?? [],
      glossary: session.glossary ?? {},
    }));
  } catch (error) {
    console.warn("Failed to load sessions:", error);
    return [];
  }
}

function saveSessions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

async function onSubmitMessage(event) {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  if (!activeSessionId) {
    appendMessage("system", "Create or select a session before sending messages.");
    chatInput.value = "";
    scrollChatToBottom({ behavior: "smooth" });
    return;
  }

  chatInput.value = "";
  autoResizeInput();

  const scriptRequest = parseScriptureQuery(text);
  const placeholderText = scriptRequest ? "Looking up the passage…" : "Translating…";

  appendMessage("user", text);
  scrollChatToBottom({ behavior: "smooth", force: true });

  const placeholderBubble = appendMessage("assistant", placeholderText, { persist: false });
  scrollChatToBottom({ behavior: "smooth", force: true });

  try {
    const response = await processMessage(text, { scriptureRequest: scriptRequest });
    updateMessageBubble(placeholderBubble, response);
    persistMessage("assistant", response);
    scrollChatToBottom({ behavior: "smooth", force: true });
  } catch (error) {
    console.warn("Failed to process message:", error);
    const failure = `Sorry, I could not process that request. ${error.message ?? ""}`.trim();
    updateMessageBubble(placeholderBubble, failure);
    persistMessage("assistant", failure);
    scrollChatToBottom({ behavior: "smooth", force: true });
  }
}

async function processMessage(text, { scriptureRequest } = {}) {
  const session = getActiveSession();
  if (!session) return "No active session.";

  const request = scriptureRequest ?? parseScriptureQuery(text);
  if (request) {
    const response = await handleScriptureRequest(request);
    return response;
  }

  const translation = await translateText(text, session);
  return translation;
}

function parseScriptureQuery(raw) {
  const trimmed = raw.trim();
  const pattern = /^([\p{L}\s]+)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/u;
  const match = trimmed.match(pattern);
  if (!match) return null;

  const alias = match[1].trim().toLowerCase();
  const chapter = Number.parseInt(match[2], 10);
  const verseStart = match[3] ? Number.parseInt(match[3], 10) : null;
  const verseEnd = match[4] ? Number.parseInt(match[4], 10) : null;

  const bookInfo = BOOK_ALIASES[alias];
  if (!bookInfo) return null;

  return {
    canonical: bookInfo.canonical,
    language: bookInfo.language,
    chapter,
    verseStart,
    verseEnd,
  };
}

async function handleScriptureRequest(request) {
  if (request.language === "en") {
    try {
      const apiResult = await fetchScriptureViaApi(request);
      if (apiResult) return apiResult;
    } catch (error) {
      console.warn("Scripture API lookup failed:", error);
    }
    return handleScriptureRequestOffline(request);
  }

  // Korean queries currently fall back to the bundled dataset.
  const offline = handleScriptureRequestOffline(request);
  if (offline && /^\d/.test(offline)) {
    return offline;
  }

  try {
    const englishReference = { ...request, language: "en" };
    const englishResult = await fetchScriptureViaApi(englishReference);
    return englishResult;
  } catch (error) {
    console.warn("Korean fallback via API failed:", error);
  }

  return offline;
}

function handleScriptureRequestOffline(request) {
  const dbEntry = SAMPLE_SCRIPTURE_DB[request.canonical];
  if (!dbEntry) {
    return `No scripture data found for ${request.canonical}.`;
  }

  const chapterData = dbEntry.chapters[request.chapter];
  if (!chapterData) {
    return `${request.canonical} ${request.chapter} is not available in the local sample data yet.`;
  }

  const targetLanguage = request.language === "ko" ? "ko" : "en";

  if (!request.verseStart) {
    return formatEntireChapter(request, chapterData, targetLanguage);
  }

  const start = request.verseStart;
  const end = request.verseEnd ?? request.verseStart;
  const verses = [];

  for (let verse = start; verse <= end; verse += 1) {
    const verseData = chapterData[verse];
    if (!verseData) continue;
    const text = verseData[targetLanguage] ?? verseData.en;
    verses.push(`${verse}. ${text}`);
  }

  if (verses.length === 0) {
    return `No verses matched ${request.canonical} ${request.chapter}:${request.verseStart}${request.verseEnd ? "-" + request.verseEnd : ""} in the local sample.`;
  }

  return verses.join("\n");
}

function formatEntireChapter(request, chapterData, targetLanguage) {
  const verses = Object.keys(chapterData)
    .map((key) => Number.parseInt(key, 10))
    .sort((a, b) => a - b)
    .map((verseNumber) => {
      const verseData = chapterData[verseNumber];
      const text = verseData[targetLanguage] ?? verseData.en;
      return `${verseNumber}. ${text}`;
    });

  if (verses.length === 0) {
    return `${request.canonical} ${request.chapter} is empty in the sample dataset.`;
  }

  return verses.join("\n");
}

async function fetchScriptureViaApi(request) {
  const reference = formatReferenceForApi(request);
  const url = `${SCRIPTURE_API_BASE}${encodeURIComponent(reference)}?translation=${SCRIPTURE_API_TRANSLATION}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Scripture API responded with status ${response.status}.`);
  }
  const payload = await response.json();
  if (!payload || !Array.isArray(payload.verses) || payload.verses.length === 0) {
    throw new Error("Passage not found in API response.");
  }

  return formatVersesFromApi(payload.verses);
}

function formatReferenceForApi(request) {
  const chapterSegment = request.chapter ? `${request.canonical} ${request.chapter}` : request.canonical;
  if (!request.verseStart) {
    return chapterSegment;
  }
  if (request.verseEnd && request.verseEnd !== request.verseStart) {
    return `${chapterSegment}:${request.verseStart}-${request.verseEnd}`;
  }
  return `${chapterSegment}:${request.verseStart}`;
}

function formatVersesFromApi(verses) {
  return verses
    .map((verse) => {
      const chapter = verse.chapter ?? "";
      const number = verse.verse ?? "";
      const cleaned = typeof verse.text === "string" ? verse.text.replace(/\s+/g, " ").trim() : "";
      const label = chapter ? `${chapter}:${number}` : `${number}`;
      return `${label}. ${cleaned}`;
    })
    .join("\n");
}

async function translateText(input, session) {
  const trimmed = input.trim();
  if (trimmed.length === 0) return "";
  const isKorean = containsHangul(trimmed);

  const local = translateLocally(trimmed, session, isKorean);
  if (local.status === "direct") {
    return local.text;
  }

  let remoteError = null;

  if (TRANSLATION_API_ENDPOINT) {
    try {
      const remote = await translateViaApi(trimmed, isKorean ? "ko" : "en");
      storeGlossaryEntry(session, trimmed, remote, isKorean ? "ko" : "en");
      return remote;
    } catch (error) {
      console.warn("Remote translation failed:", error);
      remoteError = error;
    }
  }

  if (local.status === "partial") {
    return local.text;
  }

  if (remoteError) {
    const message = remoteError.message ? ` ${remoteError.message}` : "";
    return `Translation service is unavailable.${message}`;
  }

  return local.text || "No translation available.";
}

function translateLocally(trimmed, session, isKorean) {
  const phraseHit = lookupPhrase(trimmed, isKorean ? "ko" : "en", session);
  if (phraseHit) {
    storeGlossaryEntry(session, trimmed, phraseHit.translated, isKorean ? "ko" : "en");
    return { status: "direct", text: phraseHit.translated };
  }

  const tokens = tokenize(trimmed);
  if (tokens.length === 0) {
    return { status: "direct", text: "" };
  }

  const translatedTokens = [];
  const missingTokens = [];

  tokens.forEach((token) => {
    const lookup = lookupToken(token, isKorean, session);
    if (lookup.found) {
      translatedTokens.push(lookup.value);
    } else {
      translatedTokens.push(token.original);
      if (token.strip) {
        missingTokens.push(token.strip);
      }
    }
  });

  if (missingTokens.length === tokens.length) {
    const first = missingTokens[0];
    const suggestions = first ? suggestSimilar(first, isKorean ? "ko" : "en") : [];
    if (suggestions.length > 0) {
      const suggestionLines = suggestions.map(
        (entry) => `${entry.source} → ${entry.target}`
      );
      return {
        status: "suggestions",
        text: `No direct match. Similar terms:\n${suggestionLines.join("\n")}`,
      };
    }
    return {
      status: "none",
      text: "No translation available in the local dictionary.",
    };
  }

  const result = rebuildText(tokens, translatedTokens);

  tokens.forEach((token, index) => {
    if (translatedTokens[index] && translatedTokens[index] !== token.original) {
      storeGlossaryEntry(session, token.strip, translatedTokens[index], isKorean ? "ko" : "en");
    }
  });

  return {
    status: missingTokens.length === 0 ? "direct" : "partial",
    text: result,
  };
}

async function translateViaApi(text, sourceLang) {
  const response = await fetch(TRANSLATION_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      sourceLang,
    }),
  });
  if (!response.ok) {
    throw new Error(`Translation API responded with status ${response.status}.`);
  }
  const payload = await response.json();
  const candidate =
    payload?.translatedText ??
    payload?.translated_text ??
    payload?.translation ??
    "";
  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate.trim();
  }
  throw new Error("Translation API returned an unexpected payload.");
}

function lookupPhrase(phrase, sourceLang, session) {
  const normalized = normalizeToken(phrase, sourceLang === "ko");
  const fromGlossary = session.glossary[normalized];
  if (fromGlossary) {
    return { translated: fromGlossary };
  }

  if (sourceLang === "ko") {
    const hit = KO_TO_EN.get(phrase);
    if (hit) return { translated: hit };
  } else {
    const hit = EN_TO_KO.get(phrase.toLowerCase());
    if (hit) return { translated: hit };
  }

  return null;
}

function lookupToken(token, isKoreanSource, session) {
  const normalized = normalizeToken(token.strip, isKoreanSource);
  if (!normalized) {
    return { found: false, value: token.original };
  }

  const glossaryHit = session.glossary[normalized];
  if (glossaryHit) {
    return { found: true, value: applyCase(glossaryHit, token.original) };
  }

  if (isKoreanSource) {
    const dictionaryHit = KO_TO_EN.get(token.strip);
    if (dictionaryHit) {
      return { found: true, value: applyCase(dictionaryHit, token.original) };
    }
  } else {
    const dictionaryHit = EN_TO_KO.get(token.strip.toLowerCase());
    if (dictionaryHit) {
      return { found: true, value: dictionaryHit };
    }
  }

  return { found: false, value: token.original };
}

function tokenize(text) {
  const regex = /[\p{L}’']+|\d+|[^\s\p{L}\d]+/gu;
  const matches = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    const original = match[0];
    const strip = original.replace(/^[^\p{L}\d]+|[^\p{L}\d]+$/gu, "");
    matches.push({
      original,
      strip,
    });
  }
  return matches;
}

function rebuildText(tokens, translatedTokens) {
  let cursor = 0;
  return tokens
    .map((token, index) => {
      const translated = translatedTokens[index];
      const nextIndex = cursor + token.original.length;
      cursor = nextIndex;
      return translated ?? token.original;
    })
    .join(" ");
}

function storeGlossaryEntry(session, source, target, sourceLang) {
  const normalized = normalizeToken(source, sourceLang === "ko");
  if (!normalized) return;
  session.glossary[normalized] = target;
  saveSessions();
}

function normalizeToken(token, isKoreanSource) {
  if (!token) return "";
  return isKoreanSource ? token : token.toLowerCase();
}

function containsHangul(text) {
  return /[\u3131-\u318E\uAC00-\uD7A3]/.test(text);
}

function applyCase(source, reference) {
  if (reference === reference.toUpperCase()) {
    return source.toUpperCase();
  }
  if (reference[0] === reference[0]?.toUpperCase()) {
    return source.charAt(0).toUpperCase() + source.slice(1);
  }
  return source;
}

function suggestSimilar(token, language) {
  const dictionary = language === "ko" ? BASE_DICTIONARY.map((entry) => entry.ko) : BASE_DICTIONARY.map((entry) => entry.en);
  const targetDictionary =
    language === "ko"
      ? BASE_DICTIONARY.map((entry) => ({ source: entry.ko, target: entry.en }))
      : BASE_DICTIONARY.map((entry) => ({ source: entry.en, target: entry.ko }));

  const scored = dictionary.map((entry, idx) => ({
    score: levenshteinDistance(token, entry),
    entry: targetDictionary[idx],
  }));

  return scored
    .sort((a, b) => a.score - b.score)
    .slice(0, 10)
    .filter((candidate) => candidate.score < Math.max(token.length, 4))
    .map((candidate) => candidate.entry);
}

function levenshteinDistance(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function onSessionListClick(event) {
  const item = event.target.closest("[data-session-id]");
  if (!item) return;
  const sessionId = item.dataset.sessionId;
  setActiveSession(sessionId);
  if (typeof sessionDialog.close === "function") {
    sessionDialog.close();
  }
}

function setActiveSession(sessionId) {
  activeSessionId = sessionId;
  renderSessionInfo();
  renderChatLog();
  renderSessionList();
  saveSessions();
}

function renderSessionInfo() {
  const session = getActiveSession();
  if (!session) {
    sessionTitle.textContent = "No session selected";
    sessionScripture.textContent = "";
    sessionSpeaker.textContent = "";
    return;
  }

  sessionTitle.textContent = session.title;
  sessionScripture.textContent = session.scripture ? `• ${session.scripture}` : "";
  sessionSpeaker.textContent = session.speaker ? `• ${session.speaker}` : "";
}

function renderChatLog() {
  chatLog.innerHTML = "";
  const session = getActiveSession();
  if (!session) return;
  session.transcript.forEach((entry) => {
    appendMessage(entry.role, entry.text, { persist: false });
  });
  scrollChatToBottom({ behavior: "auto", force: true });
}

function appendMessage(role, text, { persist = true } = {}) {
  const template = document.getElementById("chatBubbleTemplate");
  const bubble = template.content.firstElementChild.cloneNode(true);
  bubble.classList.add(role);
  const meta = bubble.querySelector(".chat-meta");
  const body = bubble.querySelector(".chat-text");
  if (meta) meta.textContent = roleLabel(role);
  if (body) body.textContent = text;
  chatLog.appendChild(bubble);
  if (persist) {
    persistMessage(role, text);
  }
  return bubble;
}

function updateMessageBubble(bubble, text) {
  if (!bubble) return;
  const body = bubble.querySelector(".chat-text");
  if (body) {
    body.textContent = text;
  }
}

function persistMessage(role, text) {
  const session = getActiveSession();
  if (!session) return;
  session.transcript.push({ role, text, timestamp: Date.now() });
  saveSessions();
}

function roleLabel(role) {
  switch (role) {
    case "user":
      return "You";
    case "assistant":
      return "Helper";
    case "system":
      return "System";
    default:
      return role;
  }
}

function getActiveSession() {
  return sessions.find((session) => session.id === activeSessionId) ?? null;
}

function renderSessionList() {
  sessionList.innerHTML = "";
  if (sessions.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No sessions yet. Create one below.";
    sessionList.appendChild(empty);
    return;
  }

  sessions
    .slice()
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
    .forEach((session) => {
      const item = document.createElement("div");
      item.className = "session-item";
      if (session.id === activeSessionId) {
        item.classList.add("active");
      }
      item.dataset.sessionId = session.id;

      const meta = document.createElement("div");
      meta.className = "session-meta";
      const titleSpan = document.createElement("span");
      titleSpan.textContent = session.title;
      const subtitleSpan = document.createElement("span");
      subtitleSpan.className = "muted";
      const scripture = session.scripture ? session.scripture : "No scripture noted";
      const speaker = session.speaker ? `• ${session.speaker}` : "";
      subtitleSpan.textContent = `${scripture} ${speaker}`.trim();
      meta.appendChild(titleSpan);
      meta.appendChild(subtitleSpan);

      item.appendChild(meta);
      sessionList.appendChild(item);
    });
}

function onCreateSession(event) {
  event.preventDefault();
  const title = newTitleInput.value.trim();
  if (!title) return;

  const scripture = newScriptureInput.value.trim();
  const speaker = newSpeakerInput.value.trim();

  const newSession = {
    id: crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`,
    title,
    scripture,
    speaker,
    transcript: [],
    glossary: {},
    createdAt: Date.now(),
  };

  sessions.push(newSession);
  setActiveSession(newSession.id);
  newTitleInput.value = "";
  newScriptureInput.value = "";
  newSpeakerInput.value = "";
  renderSessionList();
  if (typeof sessionDialog.close === "function") {
    sessionDialog.close();
  }
}

function openSessionDialog() {
  renderSessionList();
  if (typeof sessionDialog.showModal === "function") {
    sessionDialog.showModal();
  }
}

function scrollChatToBottom({ behavior = "auto", force = false } = {}) {
  if (!chatLog) return;
  
  // Always scroll for new messages - remove threshold check
  setTimeout(() => {
    chatLog.scrollTo({
      top: chatLog.scrollHeight,
      behavior: "smooth",
    });
  }, 50);
  
  // Also try immediate scroll as backup
  chatLog.scrollTop = chatLog.scrollHeight;
}

function autoResizeInput() {
  chatInput.style.height = "auto";
  chatInput.style.height = `${Math.min(chatInput.scrollHeight, 200)}px`;
}

function onChatInputKeyDown(event) {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
}
