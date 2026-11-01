/**
 * INFORA — Strict Scope & Topic Filter (Bagian 9)
 * Checks whether user prompts are strictly within the SMK Informatika educational domain.
 * Any out-of-scope query receives the EXACT fixed refusal sentence.
 */

export const EXACT_REFUSAL_MESSAGE = 
  'Maaf, INFORA hanya melayani pertanyaan seputar pembelajaran Informatika dan materi pendidikan yang tersedia.';

// Allowed domains for SMK Informatika curriculum
const ALLOWED_KEYWORDS = [
  'informatika', 'komputer', 'pemrograman', 'program', 'coding', 'koding', 'algoritma',
  'pseudocode', 'flowchart', 'variabel', 'percabangan', 'perulangan', 'fungsi', 'array',
  'objek', 'debugging', 'python', 'javascript', 'java', 'c++', 'html', 'css', 'dom',
  'jaringan', 'lan', 'wan', 'man', 'topologi', 'ip address', 'ip', 'subnetting', 'cidr',
  'netmask', 'dns', 'dhcp', 'routing', 'router', 'switch', 'vlan', 'firewall', 'osi',
  'tcp', 'udp', 'http', 'https', 'basis data', 'database', 'sql', 'erd', 'mysql',
  'postgresql', 'relasi', 'normalisasi', 'query', 'select', 'insert', 'update', 'delete',
  'sistem operasi', 'linux', 'windows', 'kernel', 'virtualisasi', 'hardware', 'perangkat keras',
  'software', 'perangkat lunak', 'keamanan', 'cyber', 'phishing', 'malware', 'enkripsi',
  'ai', 'machine learning', 'artificial intelligence', 'data', 'analisis data', 'iot',
  'sensor', 'arduino', 'raspberry', 'git', 'github', 'version control', 'kuis', 'soal',
  'latihan', 'pembahasan', 'belajar', 'materi', 'tutor', 'kelas', 'smk', 'kurikulum'
];

// Disallowed topics: gossip, dating, personal venting, entertainment, astrology, casual chit-chat
const STRICTLY_PROHIBITED_PATTERNS = [
  /\b(pacar|jodoh|cinta|selingkuh|putus cinta|kencan|nembak cewek|nembak cowok)\b/i,
  /\b(curhat|galau|patah hati|kesepian)\b/i,
  /\b(gosip|artis|selebriti|sinetron|drakor|film|bioskop|lagu pop|lagu)\b/i,
  /\b(ramalan|zodiak|horoskop|shio|dukun|santet)\b/i,
  /\b(judi|slot|togel|taruhan)\b/i,
  /\b(resep masakan|cara memasak|baju lebaran|skincare|makeup)\b/i,
  /\b(politik praktis|pilpres|pemilu|kampanye partai)\b/i
];

// Adversarial prompt injection patterns
const ADVERSARIAL_INJECTION_PATTERNS = [
  /\b(abaikan\s+(semua\s+)?(instruksi|aturan|prompt|perintah|batasan)[a-z]*)\b/i,
  /\b(ignore\s+(all\s+)?(instructions|rules|prompts|limits)[a-z]*)\b/i,
  /\b(you are now|pretend you are|act as a general|jailbreak|dan mode)\b/i,
  /\b(bocorkan\s+(prompt|secret|api key|kredensial|instruksi rahasia)[a-z]*)\b/i,
  /\b(reveal\s+(system prompt|internal prompt|secret|key))\b/i
];

export interface ScopeCheckResult {
  allowed: boolean;
  reason?: string;
  normalizedText: string;
}

export function evaluateTopicScope(rawInput: string): ScopeCheckResult {
  if (!rawInput || typeof rawInput !== 'string') {
    return { allowed: false, reason: 'empty_input', normalizedText: '' };
  }

  const normalized = rawInput.trim();

  // Length limits
  if (normalized.length < 2) {
    return { allowed: false, reason: 'too_short', normalizedText: normalized };
  }
  if (normalized.length > 2500) {
    return { allowed: false, reason: 'too_long', normalizedText: normalized };
  }

  const lower = normalized.toLowerCase();

  // 1. Check prompt injection attacks
  for (const pattern of ADVERSARIAL_INJECTION_PATTERNS) {
    if (pattern.test(lower)) {
      return { allowed: false, reason: 'prompt_injection', normalizedText: normalized };
    }
  }

  // 2. Check prohibited topics
  for (const pattern of STRICTLY_PROHIBITED_PATTERNS) {
    if (pattern.test(lower)) {
      return { allowed: false, reason: 'prohibited_topic', normalizedText: normalized };
    }
  }

  // 3. Educational greetings and polite introductory phrases are permitted to transition into learning
  const isGreeting = /^(halo|hai|selamat (pagi|siang|sore|malam)|assalamu'?alaikum|ping|tes|p)\b/i.test(lower);
  if (isGreeting && lower.split(/\s+/).length <= 4) {
    return { allowed: true, reason: 'greeting', normalizedText: normalized };
  }

  // 4. Check for presence of educational informatika intent
  const containsInformatikaKeyword = ALLOWED_KEYWORDS.some(kw => lower.includes(kw));

  // If question is a general query with question words (apa, bagaimana, jelaskan, kenapa, fungsi)
  const isQuestion = /^(apa|apakah|bagaimana|jelaskan|sebutkan|mengapa|kenapa|tampilkan|buatkan|contoh|hitung|tuliskan)\b/i.test(lower);

  if (containsInformatikaKeyword) {
    return { allowed: true, reason: 'in_scope_keyword', normalizedText: normalized };
  }

  // Unknown subjects are not rejected here. Retrieval and available teacher
  // materials must decide whether the question is answerable. This prevents
  // a static keyword list from hiding newly uploaded subjects.
  if (!containsInformatikaKeyword && !isGreeting) {
    return { allowed: true, reason: 'relevance_validated_by_retrieval', normalizedText: normalized };
  }

  return { allowed: true, normalizedText: normalized };
}
