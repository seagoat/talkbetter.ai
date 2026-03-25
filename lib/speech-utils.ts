import { pinyin } from 'pinyin-pro';
import { Capacitor } from '@capacitor/core';

export interface EvaluationResult {
  char: string;
  isCorrect: boolean;
  expectedPinyin: string;
  actualPinyin?: string;
  actualChar?: string;
}

export interface DetailedEvaluationResult extends EvaluationResult {
  initialScore: number;      // Initial consonant accuracy (0-100)
  finalScore: number;       // Final vowel accuracy (0-100)
  toneScore: number;        // Tone accuracy (0-100)
  overallScore: number;     // Combined score (0-100)
  errorType: 'none' | 'substitution' | 'insertion' | 'deletion' | 'partial-match';
  suggestedPronunciation?: string;
  position?: number;         // Position in original target text
  confidence?: number;       // Confidence in the match (0-1)
}

export interface TrainingSentence {
  id: string;
  text: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  title?: string;
}

// 阿拉伯数字与中文数字的映射
const DIGIT_TO_CHINESE: Record<string, string> = {
  '0': '零', '1': '一', '2': '二', '3': '三', '4': '四',
  '5': '五', '6': '六', '7': '七', '8': '八', '9': '九',
};

/**
 * 将阿拉伯数字转换为中文数字
 */
export const convertDigitsToChinese = (text: string): string => {
  return text.replace(/[0-9]/g, digit => DIGIT_TO_CHINESE[digit] || digit);
};

/**
 * Normalizes text by removing punctuation, converting digits, for comparison
 */
export const normalizeText = (text: string) => {
  // 先转换阿拉伯数字为中文数字
  let normalized = text.replace(/[0-9]/g, digit => DIGIT_TO_CHINESE[digit] || digit);
  // 移除标点符号，保留中文字符
  normalized = normalized.replace(/[^\u4e00-\u9fa5]/g, '');
  return normalized;
};

/**
 * Create alignment matrix for dynamic programming
 */
const createAlignmentMatrix = (target: string, spoken: string): {
  matrix: number[][];
  traceback: string[][];
} => {
  const matrix = Array(spoken.length + 1).fill(null).map(() =>
    Array(target.length + 1).fill(null)
  );
  const traceback = Array(spoken.length + 1).fill(null).map(() =>
    Array(target.length + 1).fill('')
  );

  // Initialize first row and column
  for (let i = 0; i <= target.length; i++) {
    matrix[0][i] = i;
    traceback[0][i] = 'D'; // Deletion (target char not matched)
  }
  for (let j = 0; j <= spoken.length; j++) {
    matrix[j][0] = j;
    traceback[j][0] = 'I'; // Insertion (extra spoken char)
  }
  traceback[0][0] = 'E'; // End

  // Fill matrix
  for (let j = 1; j <= spoken.length; j++) {
    for (let i = 1; i <= target.length; i++) {
      // 转换数字为中文进行比较
      const targetChar = DIGIT_TO_CHINESE[target[i - 1]] || target[i - 1];
      const spokenChar = DIGIT_TO_CHINESE[spoken[j - 1]] || spoken[j - 1];
      const isCharMatch = targetChar === spokenChar;
      const pinyinSimilarity = getChinesePinyin(target[i - 1], spoken[j - 1]);

      // Substitution cost: 0 for exact match, 0.3 for similar pinyin, 1 for different
      let subCost = 1;
      if (isCharMatch) subCost = 0;
      else if (pinyinSimilarity >= 0.7) subCost = 0.3;

      const delCost = matrix[j][i - 1] + 1;     // Deletion (skip target char)
      const insCost = matrix[j - 1][i] + 1;     // Insertion (extra spoken char)
      const subCost_total = matrix[j - 1][i - 1] + subCost; // Match/Substitution

      // Choose minimum and record direction
      if (subCost_total <= delCost && subCost_total <= insCost) {
        matrix[j][i] = subCost_total;
        traceback[j][i] = isCharMatch ? 'M' : (pinyinSimilarity >= 0.7 ? 'S' : 'X'); // Match, Similar, or Substitution
      } else if (delCost <= insCost) {
        matrix[j][i] = delCost;
        traceback[j][i] = 'D'; // Deletion
      } else {
        matrix[j][i] = insCost;
        traceback[j][i] = 'I'; // Insertion
      }
    }
  }

  return { matrix, traceback };
};

/**
 * Get pinyin similarity between Chinese characters
 */
const getChinesePinyin = (char1: string, char2: string): number => {
  // 先转换数字为中文
  const c1 = DIGIT_TO_CHINESE[char1] || char1;
  const c2 = DIGIT_TO_CHINESE[char2] || char2;

  if (!/[\u4e00-\u9fa5]/.test(c1) || !/[\u4e00-\u9fa5]/.test(c2)) {
    return c1 === c2 ? 1 : 0;
  }

  const pinyin1 = pinyin(c1, { type: 'array', toneType: 'num' })[0] || '';
  const pinyin2 = pinyin(c2, { type: 'array', toneType: 'num' })[0] || '';

  return calculatePinyinSimilarity(pinyin1, pinyin2);
};

/**
 * Find optimal alignment path using traceback matrix
 */
const findOptimalAlignment = (
  traceback: string[][],
  target: string,
  spoken: string
): { alignment: Array<{target: string, spoken: string, score: number}>, score: number } => {
  const alignment: Array<{target: string, spoken: string, score: number}> = [];
  let i = target.length;
  let j = spoken.length;
  let totalScore = 0;

  while (i > 0 || j > 0) {
    const direction = traceback[j][i];

    if (direction === 'M' || direction === 'S' || direction === 'X') {
      // Match or substitution
      const isMatch = direction === 'M';
      const similarity = isMatch ? 1 : getChinesePinyin(target[i - 1], spoken[j - 1]);
      alignment.unshift({
        target: target[i - 1],
        spoken: spoken[j - 1],
        score: isMatch ? 1 : similarity
      });
      totalScore += isMatch ? 1 : similarity;
      i--;
      j--;
    } else if (direction === 'D') {
      // Deletion (target char not matched in spoken)
      alignment.unshift({
        target: target[i - 1],
        spoken: '',
        score: 0
      });
      i--;
    } else if (direction === 'I') {
      // Insertion (extra spoken char not in target)
      alignment.unshift({
        target: '',
        spoken: spoken[j - 1],
        score: 0
      });
      j--;
    } else {
      break; // Should not reach here
    }
  }

  return { alignment, score: alignment.length > 0 ? totalScore / alignment.length : 0 };
};

/**
 * Gets Pinyin for each character in the text (with tone symbols for display)
 */
export const getPinyinList = (text: string) => {
  return pinyin(text, { type: 'array', toneType: 'symbol' });
};

/**
 * Gets Pinyin with numeric tones (for internal evaluation logic)
 */
export const getPinyinListNumeric = (text: string) => {
  return pinyin(text, { type: 'array', toneType: 'num' });
};

/**
 * Calculate Levenshtein distance between two strings
 */
const levenshteinDistance = (a: string, b: string): number => {
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,        // deletion
        matrix[j - 1][i] + 1,        // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[b.length][a.length];
};

/**
 * Calculate pinyin similarity score between two pinyin strings
 */
export const calculatePinyinSimilarity = (pinyin1: string, pinyin2: string): number => {
  // Split into components: initial, final, tone
  const p1 = pinyin1.replace(/([a-z]+)([a-z]+)(\d)/, '$1|$2|$3').split('|');
  const p2 = pinyin2.replace(/([a-z]+)([a-z]+)(\d)/, '$1|$2|$3').split('|');

  // Must have same number of components
  if (p1.length !== p2.length || p1.length !== 3) return 0;

  let score = 0;
  const weights = [0.3, 0.5, 0.2]; // weights for initial, final, tone

  // Compare initial consonant
  if (p1[0] === p2[0]) score += weights[0];
  else if (getInitialSimilarity(p1[0], p2[0]) > 0.7) score += weights[0] * 0.5;

  // Compare final vowel
  if (p1[1] === p2[1]) score += weights[1];
  else if (getFinalSimilarity(p1[1], p2[1]) > 0.8) score += weights[1] * 0.6;

  // Compare tone
  if (p1[2] === p2[2]) score += weights[2];
  else if (Math.abs(parseInt(p1[2]) - parseInt(p2[2])) === 1) score += weights[2] * 0.3;

  return Math.min(1, score);
};

/**
 * Get similarity between initial consonants
 */
const getInitialSimilarity = (initial1: string, initial2: string): number => {
  // Some similar initials
  const similarPairs: Record<string, string[]> = {
    'b': ['p', 'm'],
    'p': ['b', 'm'],
    'm': ['b', 'p', 'f'],
    'f': ['h'],
    'd': ['t', 'n', 'l'],
    't': ['d', 'n', 'l'],
    'n': ['l'],
    'l': ['n', 'r'],
    'g': ['k', 'h'],
    'k': ['g', 'h'],
    'h': ['f', 'x'],
    'j': ['q', 'x'],
    'q': ['j', 'x'],
    'x': ['j', 'q', 'h'],
    'zh': ['ch', 'sh', 'z'],
    'ch': ['zh', 'sh', 'c'],
    'sh': ['zh', 'ch', 's'],
    'z': ['zh', 'c', 's'],
    'c': ['ch', 'z', 's'],
    's': ['sh', 'z', 'c']
  };

  if (initial1 === initial2) return 1;
  if (similarPairs[initial1]?.includes(initial2)) return 0.8;
  return 0;
};

/**
 * Get similarity between final vowels
 */
const getFinalSimilarity = (final1: string, final2: string): number => {
  // Some similar finals
  const similarPairs: Record<string, string[]> = {
    'a': ['o', 'e', 'ia', 'ua'],
    'o': ['a', 'e', 'uo', 'ou'],
    'e': ['a', 'o', 'ie', 'üe'],
    'i': ['ü', 'ie', 'ia'],
    'u': ['o', 'uo', 'ua'],
    'ü': ['i', 'üe'],
    'ai': ['ei', 'ui'],
    'ei': ['ai', 'ui'],
    'ui': ['ei', 'ai'],
    'ao': ['ou', 'iu'],
    'ou': ['ao', 'iu'],
    'iu': ['ou', 'ao'],
    'ie': ['üe', 'e'],
    'üe': ['ie', 'e'],
    'er': ['e']
  };

  if (final1 === final2) return 1;
  if (similarPairs[final1]?.includes(final2)) return 0.85;
  return 0;
};

/**
 * Enhanced pronunciation evaluation with detailed scoring using dynamic programming alignment
 * Returns an array of detailed evaluation results
 */
export const evaluatePronunciation = (
  targetText: string,
  spokenText: string,
  options: {
    enableDetailed?: boolean;
    alignmentThreshold?: number;
    fuzzyThreshold?: number;
  } = {}
): EvaluationResult[] | DetailedEvaluationResult[] => {
  const {
    enableDetailed = true,
    alignmentThreshold = 0.6,
    fuzzyThreshold = 0.7
  } = options;

  const cleanSpoken = normalizeText(spokenText);
  const cleanTarget = normalizeText(targetText);

  // Skip if either text is empty after normalization
  if (!cleanTarget || !cleanSpoken) {
    return targetText.split('').map((char, index) => ({
      char,
      isCorrect: false,
      expectedPinyin: pinyin(char, { type: 'array', toneType: 'num' })[0] || char,
      actualPinyin: undefined,
      actualChar: undefined
    }));
  }

  // Create alignment matrix and find optimal path
  const { matrix, traceback } = createAlignmentMatrix(cleanTarget, cleanSpoken);
  const { alignment, score } = findOptimalAlignment(traceback, cleanTarget, cleanSpoken);

  // Debug: log alignment
  console.log('[Alignment] Target:', cleanTarget, 'Spoken:', cleanSpoken);
  console.log('[Alignment] Results:', alignment.map(a => `${a.target || '_'}->${a.spoken || '_'}`).join(' '));

  // Convert alignment to detailed evaluation results
  const results: DetailedEvaluationResult[] = [];

  // Create an array mapping each target position to its alignment result
  // Use -1 to indicate no match (deletion)
  const targetAlignmentMap: Array<{spoken: string, score: number} | null> = [];
  let targetIdx = 0;

  for (const align of alignment) {
    if (align.target !== '') {
      // This aligns to target character at position targetIdx
      targetAlignmentMap[targetIdx] = { spoken: align.spoken, score: align.score };
      targetIdx++;
    }
    // If target is empty (insertion), we just skip it in the target mapping
  }

  // Fill any gaps with null (shouldn't happen, but safety check)
  while (targetIdx < cleanTarget.length) {
    targetAlignmentMap[targetIdx] = null;
    targetIdx++;
  }

  // Now map back to original targetText positions
  // We need to account for non-Chinese characters in targetText
  let cleanTargetIdx = 0;

  for (let i = 0; i < targetText.length; i++) {
    const char = targetText[i];
    const isEvaluable = /[\u4e00-\u9fa5]/.test(char);

    if (!isEvaluable) {
      results.push({
        char,
        isCorrect: true,
        expectedPinyin: char,
        actualPinyin: char,
        actualChar: char,
        initialScore: 100,
        finalScore: 100,
        toneScore: 100,
        overallScore: 100,
        errorType: 'none',
        position: i,
        confidence: 1
      });
      continue;
    }

    // Get target pinyin details
    const targetPinyinFull = pinyin(char, { type: 'all', toneType: 'num' })[0];
    const targetPinyin = targetPinyinFull?.pinyin || '';
    const targetInitial = targetPinyinFull?.initial || '';
    const targetFinalBody = targetPinyinFull?.finalBody || ''; // Use finalBody (without tone)
    const targetTone = targetPinyinFull?.num?.toString() || '';

    // Check if this character has a match in alignment
    const alignResult = targetAlignmentMap[cleanTargetIdx];

    // Increment clean target index for next evaluable character
    cleanTargetIdx++;

    if (!alignResult || alignResult.spoken === '') {
      // Deletion: user didn't say this character
      results.push({
        char,
        isCorrect: false,
        expectedPinyin: targetPinyin,
        actualPinyin: undefined,
        actualChar: undefined,
        initialScore: 0,
        finalScore: 0,
        toneScore: 0,
        overallScore: 0,
        errorType: 'deletion',
        position: i,
        confidence: 1
      });
      continue;
    }

    // Found a match - evaluate it
    const spokenChar = alignResult.spoken;
    const actualPinyinFull = pinyin(spokenChar, { type: 'all', toneType: 'num' })[0];
    const actualPinyin = actualPinyinFull?.pinyin || '';
    const actualInitial = actualPinyinFull?.initial || '';
    const actualFinalBody = actualPinyinFull?.finalBody || ''; // Use finalBody (without tone)
    const actualTone = actualPinyinFull?.num?.toString() || '';

    // Calculate component scores
    const initialScore = targetInitial === actualInitial ? 100 : Math.round(getInitialSimilarity(targetInitial, actualInitial) * 100);
    const finalScore = targetFinalBody === actualFinalBody ? 100 : Math.round(getFinalSimilarity(targetFinalBody, actualFinalBody) * 100);
    const toneDiff = Math.abs(parseInt(targetTone || '0') - parseInt(actualTone || '0'));
    const toneScore = targetTone === actualTone ? 100 : (toneDiff === 1 ? 70 : (toneDiff === 2 ? 40 : 0));

    // Calculate overall score with weighted components
    // Weights: initial 30%, final 50%, tone 20%
    const overallScore = Math.round(initialScore * 0.3 + finalScore * 0.5 + toneScore * 0.2);

    // Determine error type
    let errorType: 'none' | 'substitution' | 'insertion' | 'deletion' | 'partial-match' = 'none';
    if (overallScore >= 90) {
      errorType = 'none';
    } else if (initialScore >= 80 && finalScore >= 80) {
      // Only tone is different
      errorType = 'partial-match';
    } else if (initialScore >= 50 && finalScore >= 50) {
      // Similar sound
      errorType = 'partial-match';
    } else {
      // Very different sound
      errorType = 'substitution';
    }

    const isCorrect = overallScore >= alignmentThreshold * 100;

    results.push({
      char,
      isCorrect,
      expectedPinyin: targetPinyin,
      actualPinyin,
      actualChar: spokenChar,
      initialScore,
      finalScore,
      toneScore,
      overallScore,
      errorType,
      position: i,
      confidence: Math.max(alignResult.score, 0.5),
      suggestedPronunciation: overallScore < 70 ? targetPinyin : undefined
    });
  }

  return enableDetailed ? results : results.map(r => ({
    char: r.char,
    isCorrect: r.isCorrect,
    expectedPinyin: r.expectedPinyin,
    actualPinyin: r.actualPinyin,
    actualChar: r.actualChar
  }));
};

/**
 * Analyze pronunciation evaluation results to get performance statistics
 */
export const analyzePronunciationPerformance = (
  results: DetailedEvaluationResult[]
): {
  overallAccuracy: number;
  totalCharacters: number;
  correctCharacters: number;
  errorCount: number;
  errorBreakdown: {
    substitutions: number;
    insertions: number;
    deletions: number;
    partialMatches: number;
  };
  componentAverages: {
    initial: number;
    final: number;
    tone: number;
  };
  suggestionCount: number;
} => {
  const totalCharacters = results.length;
  const correctCharacters = results.filter(r => r.isCorrect).length;
  const errorCount = totalCharacters - correctCharacters;

  const errorBreakdown = {
    substitutions: results.filter(r => r.errorType === 'substitution').length,
    insertions: results.filter(r => r.errorType === 'insertion').length,
    deletions: results.filter(r => r.errorType === 'deletion').length,
    partialMatches: results.filter(r => r.errorType === 'partial-match').length,
  };

  const validScores = results.filter(r => r.overallScore > 0);
  const componentAverages = {
    initial: validScores.length > 0
      ? validScores.reduce((sum, r) => sum + r.initialScore, 0) / validScores.length
      : 0,
    final: validScores.length > 0
      ? validScores.reduce((sum, r) => sum + r.finalScore, 0) / validScores.length
      : 0,
    tone: validScores.length > 0
      ? validScores.reduce((sum, r) => sum + r.toneScore, 0) / validScores.length
      : 0,
  };

  const suggestionCount = results.filter(r => r.suggestedPronunciation).length;

  return {
    overallAccuracy: (correctCharacters / totalCharacters) * 100,
    totalCharacters,
    correctCharacters,
    errorCount,
    errorBreakdown,
    componentAverages,
    suggestionCount
  };
};

/**
 * Generate pronunciation feedback messages based on analysis
 */
export const generatePronunciationFeedback = (
  analysis: ReturnType<typeof analyzePronunciationPerformance>
): {
  summary: string;
  suggestions: string[];
  encouragement: string;
} => {
  const suggestions: string[] = [];
  const { overallAccuracy, errorBreakdown, componentAverages } = analysis;

  // Generate suggestions based on error patterns
  if (errorBreakdown.deletions > 0) {
    suggestions.push(`注意：您漏读了 ${errorBreakdown.deletions} 个字，请确保每个字都清晰发音。`);
  }
  if (errorBreakdown.insertions > 0) {
    suggestions.push(`注意：您多读了 ${errorBreakdown.insertions} 个字，请避免添加额外的音节。`);
  }
  if (errorBreakdown.substitutions > 0) {
    suggestions.push(`注意：有 ${errorBreakdown.substitutions} 个字的发音不正确，请仔细对比拼音。`);
  }

  // Component-specific suggestions
  if (componentAverages.tone < 70) {
    suggestions.push('声调需要加强练习，可以多听标准发音并注意声调变化。');
  }
  if (componentAverages.initial < 80) {
    suggestions.push('声母发音需要改进，注意区分相似的声母如 b/p, d/t, g/k。');
  }
  if (componentAverages.final < 80) {
    suggestions.push('韵母发音需要加强，注意区分韵母的口型和舌位。');
  }

  // Generate encouragement
  let encouragement = '';
  if (overallAccuracy >= 95) {
    encouragement = '太棒了！您的发音非常标准！';
  } else if (overallAccuracy >= 85) {
    encouragement = '很好！继续保持，您已经掌握了大部分发音。';
  } else if (overallAccuracy >= 70) {
    encouragement = '不错的开始！继续练习，您会做得更好。';
  } else {
    encouragement = '加油！多听多练，您一定能进步的。';
  }

  return {
    summary: `整体准确率：${overallAccuracy.toFixed(1)}% (${analysis.correctCharacters}/${analysis.totalCharacters} 正确)`,
    suggestions,
    encouragement
  };
};

/**
 * Generate detailed comparison between target and actual pronunciation
 */
export const generatePronunciationComparison = (
  result: DetailedEvaluationResult
): {
  initial: { target: string; actual: string; isCorrect: boolean; note: string };
  final: { target: string; actual: string; isCorrect: boolean; note: string };
  tone: { target: string; actual: string; isCorrect: boolean; note: string };
} => {
  const pinyin = result.expectedPinyin;
  const actualPinyin = result.actualPinyin || '';

  // Parse pinyin components
  const targetMatch = pinyin.match(/([a-z]*)([a-z]+)(\d)/) || ['', '', '', ''];
  const actualMatch = actualPinyin.match(/([a-z]*)([a-z]+)(\d)/) || ['', '', '', ''];

  const targetInitial = targetMatch[1] || '';
  const targetFinal = targetMatch[2] || '';
  const targetTone = targetMatch[3] || '';

  const actualInitial = actualMatch[1] || '';
  const actualFinal = actualMatch[2] || '';
  const actualTone = actualMatch[3] || '';

  // Generate notes
  const toneNames: Record<string, string> = {
    '1': '一声(阴平)',
    '2': '二声(阳平)',
    '3': '三声(上声)',
    '4': '四声(去声)'
  };

  return {
    initial: {
      target: targetInitial || '(无)',
      actual: actualInitial || '(无)',
      isCorrect: targetInitial === actualInitial,
      note: targetInitial === actualInitial ? '✓ 正确' : `应读 "${targetInitial}"，实际 "${actualInitial}"`
    },
    final: {
      target: targetFinal || pinyin,
      actual: actualFinal || actualPinyin,
      isCorrect: targetFinal === actualFinal,
      note: targetFinal === actualFinal ? '✓ 正确' : `应读 "${targetFinal}"，实际 "${actualFinal}"`
    },
    tone: {
      target: toneNames[targetTone] || targetTone,
      actual: toneNames[actualTone] || actualTone,
      isCorrect: targetTone === actualTone,
      note: targetTone === actualTone ? '✓ 正确' : `应为${toneNames[targetTone]}，实际${toneNames[actualTone]}`
    }
  };
};

// Dynamic calibration: store calibration factor in localStorage
const CALIBRATION_KEY = 'talkbetter_tts_calibration';

function getCalibrationFactor(): number {
  if (typeof window === 'undefined') return 1;
  const saved = localStorage.getItem(CALIBRATION_KEY);
  if (saved) {
    const factor = parseFloat(saved);
    if (!isNaN(factor) && factor > 0.5 && factor < 2) {
      return factor;
    }
  }
  return 1;
}

function saveCalibrationFactor(factor: number): void {
  if (typeof window === 'undefined') return;
  // Smooth the calibration factor with exponential moving average
  const current = getCalibrationFactor();
  const smoothed = current * 0.7 + factor * 0.3;
  localStorage.setItem(CALIBRATION_KEY, smoothed.toFixed(3));
  console.log('[TTS] Calibration factor updated:', current.toFixed(3), '->', smoothed.toFixed(3));
}

/**
 * Enhanced text-to-speech using Edge TTS (high quality neural voice)
 * Falls back to Web Speech API if Edge TTS is not available
 */
export const speakText = async (
  text: string,
  onProgress?: (charIndex: number) => void,
  onEnd?: () => void,
  voice: string = 'xiaoxiao',
  rate: string = '-35%'
) => {
  console.log('speakText triggered:', text);

  // If running as a Native App (Android/iOS), use Capacitor TTS
  if (Capacitor.isNativePlatform()) {
    try {
      const { TextToSpeech } = await import('@capacitor-community/text-to-speech');

      let charIndex = 0;
      const charCount = text.length;
      const msPerChar = 350;

      const timer = setInterval(() => {
        if (charIndex < charCount) {
          if (onProgress) onProgress(charIndex);
          charIndex++;
        } else {
          clearInterval(timer);
        }
      }, msPerChar);

      await TextToSpeech.speak({
        text,
        lang: 'zh-CN',
        rate: 0.85,
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient',
      });

      clearInterval(timer);
      if (onProgress) onProgress(-1);
      if (onEnd) onEnd();
      return;
    } catch (e: any) {
      console.error('Native TTS failed', e);
    }
  }

  // Try Edge TTS API
  try {
    console.log('[TTS] Calling Edge TTS API for:', text.substring(0, 20) + '...');
    const response = await fetch(`/api/tts?text=${encodeURIComponent(text)}&voice=${voice}&rate=${encodeURIComponent(rate)}`);
    console.log('[TTS] API response status:', response.status);

    if (response.ok) {
      const audioBlob = await response.blob();
      console.log('[TTS] Audio blob size:', audioBlob.size, 'type:', audioBlob.type);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      // Pre-calculate positions of each Chinese character in the original text
      // This handles duplicate characters correctly
      const charPositions: number[] = [];
      for (let i = 0; i < text.length; i++) {
        if (/[\u4e00-\u9fa5]/.test(text[i])) {
          charPositions.push(i);
        }
      }
      const charCount = charPositions.length;

      // Progress tracking state
      let progressInterval: NodeJS.Timeout | null = null;
      let charIndex = 0;
      let startTime = 0;
      let estimatedDuration = 0;

      const startProgressTracking = () => {
        if (!onProgress || charCount === 0) return;

        startTime = Date.now();

        // Get calibration factor from previous runs
        const calibrationFactor = getCalibrationFactor();

        // Calculate duration multiplier based on rate
        let durationMultiplier = 1;
        if (rate.includes('%')) {
          const rateValue = parseInt(rate);
          const speedRatio = Math.max(0.5, (100 + rateValue) / 100);
          durationMultiplier = 1 / speedRatio;
        }

        // Count punctuation marks for pause adjustment
        const punctCount = (text.match(/[，。！？、；：,.!?;:]/g) || []).length;
        // Each punctuation adds ~200ms pause
        const punctPause = punctCount * 200;

        // Base: ~250ms per Chinese character at normal speed
        const baseMsPerChar = 250;
        const msPerChar = baseMsPerChar * durationMultiplier;

        // Apply calibration factor
        estimatedDuration = Math.round((charCount * msPerChar + punctPause) * calibrationFactor);

        console.log('[TTS] Tracking:', charCount, 'chars,', punctCount, 'puncts, calibrated duration:', estimatedDuration, 'ms');

        // Highlight first character immediately
        if (charPositions.length > 0) {
          onProgress(charPositions[0]);
          charIndex = 1;
        }

        progressInterval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / estimatedDuration, 1);

          // Calculate which Chinese character we should be at
          const targetCharIdx = Math.floor(progress * charCount);

          // Highlight characters up to target - use pre-calculated positions
          while (charIndex <= targetCharIdx && charIndex < charPositions.length) {
            onProgress(charPositions[charIndex]);
            charIndex++;
          }

          if (progress >= 1) {
            if (progressInterval) clearInterval(progressInterval);
          }
        }, 50);
      };

      const stopProgressTracking = () => {
        if (progressInterval) {
          clearInterval(progressInterval);
          progressInterval = null;
        }
      };

      // Start progress when audio actually starts playing
      audio.onplay = () => {
        console.log('[TTS] Audio started playing');
        startProgressTracking();
      };

      audio.oncanplaythrough = () => {
        audio.play().catch(e => {
          console.error('[TTS] Play failed:', e);
        });
      };

      audio.onended = () => {
        stopProgressTracking();
        URL.revokeObjectURL(audioUrl);

        // Dynamic calibration: compare estimated vs actual duration
        if (startTime > 0 && estimatedDuration > 0) {
          const actualDuration = Date.now() - startTime;
          const actualFactor = actualDuration / estimatedDuration;

          // Only calibrate if error is significant (> 10%)
          if (Math.abs(1 - actualFactor) > 0.1) {
            saveCalibrationFactor(actualFactor);
            console.log('[TTS] Calibration: estimated', estimatedDuration, 'ms, actual', actualDuration, 'ms, factor:', actualFactor.toFixed(3));
          }
        }

        if (onProgress) onProgress(-1);
        if (onEnd) onEnd();
      };

      audio.onerror = () => {
        stopProgressTracking();
        URL.revokeObjectURL(audioUrl);
        console.warn('Edge TTS audio failed, falling back to Web Speech');
        // Fallback to Web Speech API
        webSpeechFallback(text, onProgress, onEnd);
      };

      return;
    }
  } catch (e) {
    console.warn('Edge TTS API failed, falling back to Web Speech:', e);
  }

  // Fallback to Web Speech API
  webSpeechFallback(text, onProgress, onEnd);
};

/**
 * Web Speech API fallback
 */
const webSpeechFallback = (
  text: string,
  onProgress?: (charIndex: number) => void,
  onEnd?: () => void
) => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.8;

    const voices = window.speechSynthesis.getVoices();
    const zhVoice = voices.find(v => v.lang.includes('zh') && !v.name.includes('Hong Kong') && !v.name.includes('Taiwan'));
    if (zhVoice) utterance.voice = zhVoice;

    let timer: NodeJS.Timeout | null = null;
    let currentIndex = 0;

    if (onProgress) {
      utterance.onboundary = (event) => {
        if (event.name === 'word') {
          if (timer) clearInterval(timer);
          currentIndex = event.charIndex;
          onProgress(currentIndex);

          timer = setInterval(() => {
            currentIndex++;
            if (currentIndex < text.length && /[\u4e00-\u9fa5]/.test(text[currentIndex])) {
              onProgress(currentIndex);
            } else {
              if (timer) clearInterval(timer);
            }
          }, 250);
        }
      };
    }

    utterance.onend = () => {
      if (timer) clearInterval(timer);
      if (onEnd) onEnd();
    };

    utterance.onerror = () => {
      if (timer) clearInterval(timer);
      if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utterance);
  } else {
    console.warn('Text-to-speech not supported.');
    if (onEnd) onEnd();
  }
};

