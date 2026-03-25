// Practice history management

export interface PracticeRecord {
  id: string;
  timestamp: number;
  contentId: string;
  contentTitle: string;
  contentText: string;
  category: string;
  results: CharacterResult[];
  overallScore: number;
  correctCount: number;
  totalCount: number;
  duration: number; // milliseconds
  voice: string;
}

export interface CharacterResult {
  char: string;
  expectedPinyin: string;
  actualPinyin: string | null;
  isCorrect: boolean;
  initialScore: number;
  finalScore: number;
  toneScore: number;
}

const STORAGE_KEY = 'talkbetter_practice_history';
const MAX_RECORDS = 100;

export function savePracticeRecord(record: Omit<PracticeRecord, 'id' | 'timestamp'>): PracticeRecord {
  if (typeof window === 'undefined') {
    throw new Error('Cannot save practice record on server side');
  }

  console.log('savePracticeRecord called with:', record);

  const history = getPracticeHistory();
  const newRecord: PracticeRecord = {
    ...record,
    id: `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
  };

  console.log('New record created:', newRecord);

  // Add to beginning of history
  history.unshift(newRecord);

  // Limit history size
  if (history.length > MAX_RECORDS) {
    history.pop();
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  console.log('Saved to localStorage, total records:', history.length);
  return newRecord;
}

export function getPracticeHistory(): PracticeRecord[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function getPracticeRecordById(id: string): PracticeRecord | null {
  const history = getPracticeHistory();
  return history.find(record => record.id === id) || null;
}

export function deletePracticeRecord(id: string): void {
  if (typeof window === 'undefined') return;

  const history = getPracticeHistory();
  const filtered = history.filter(record => record.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function clearPracticeHistory(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export function getPracticeStats(): {
  totalSessions: number;
  totalCharacters: number;
  correctCharacters: number;
  averageScore: number;
  recentSessions: number;
} {
  const history = getPracticeHistory();

  if (history.length === 0) {
    return {
      totalSessions: 0,
      totalCharacters: 0,
      correctCharacters: 0,
      averageScore: 0,
      recentSessions: 0,
    };
  }

  const totalCharacters = history.reduce((sum, r) => sum + r.totalCount, 0);
  const correctCharacters = history.reduce((sum, r) => sum + r.correctCount, 0);

  // Sessions in last 7 days
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentSessions = history.filter(r => r.timestamp > weekAgo).length;

  return {
    totalSessions: history.length,
    totalCharacters,
    correctCharacters,
    averageScore: Math.round((correctCharacters / totalCharacters) * 100) || 0,
    recentSessions,
  };
}

export function getHistoryByCategory(category: string): PracticeRecord[] {
  return getPracticeHistory().filter(record => record.category === category);
}

export function getHistoryByDateRange(start: Date, end: Date): PracticeRecord[] {
  const startTime = start.getTime();
  const endTime = end.getTime();
  return getPracticeHistory().filter(
    record => record.timestamp >= startTime && record.timestamp <= endTime
  );
}

// Format date for display
export function formatRecordDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - timestamp;

  // Less than 1 minute
  if (diff < 60 * 1000) {
    return '刚刚';
  }

  // Less than 1 hour
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes}分钟前`;
  }

  // Less than 24 hours
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours}小时前`;
  }

  // Less than 7 days
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return `${days}天前`;
  }

  // Otherwise show date
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format duration for display
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}秒`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}分${remainingSeconds}秒`;
}