import { pinyin } from 'pinyin-pro';
import { Capacitor } from '@capacitor/core';

export interface EvaluationResult {
  char: string;
  isCorrect: boolean;
  expectedPinyin: string;
  actualPinyin?: string;
  actualChar?: string;
}

export interface TrainingSentence {
  id: string;
  text: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: 'tongue-twister' | 'daily' | 'poem' | 'story';
  title?: string;
}

/**
 * Normalizes text by removing punctuation and extra spaces for comparison
 */
export const normalizeText = (text: string) => {
  return text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
};

/**
 * Gets Pinyin for each character in the text
 */
export const getPinyinList = (text: string) => {
  return pinyin(text, { type: 'array', toneType: 'num' });
};

/**
 * Compares the target text with the spoken text using Pinyin.
 * Returns an array of results matching the original targetText length.
 */
export const evaluatePronunciation = (
  targetText: string,
  spokenText: string
): EvaluationResult[] => {
  const cleanSpoken = normalizeText(spokenText);
  const spokenPinyin = pinyin(cleanSpoken, { type: 'array', toneType: 'num' });
  
  // Get pinyin for the entire target text to maintain alignment
  const targetPinyin = pinyin(targetText, { type: 'array', toneType: 'num' });
  const results: EvaluationResult[] = [];
  
  for (let i = 0; i < targetText.length; i++) {
    const char = targetText[i];
    const targetPy = targetPinyin[i];
    
    // If it's not a Chinese character, we don't evaluate it but keep it in the results
    const isEvaluable = /[\u4e00-\u9fa5]/.test(char);
    
    if (!isEvaluable) {
      results.push({
        char,
        isCorrect: true, // Non-evaluable characters don't block progress
        expectedPinyin: targetPy || char
      });
      continue;
    }

    // Search for the character or its pinyin in the spoken text
    let found = false;
    for (let j = 0; j < cleanSpoken.length; j++) {
      if (cleanSpoken[j] === char || (spokenPinyin[j] && targetPy && spokenPinyin[j] === targetPy)) {
        found = true;
        results.push({
          char,
          isCorrect: true,
          expectedPinyin: targetPy,
          actualPinyin: spokenPinyin[j],
          actualChar: cleanSpoken[j]
        });
        break;
      }
    }

    if (!found) {
      results.push({
        char,
        isCorrect: false,
        expectedPinyin: targetPy || char,
        actualPinyin: undefined,
        actualChar: undefined
      });
    }
  }

  return results;
};

/**
 * Enhanced text-to-speech wrapper with progress callback
 * Uses Native Capacitor Plugin for Android/iOS, fallbacks to Web Speech API for desktop.
 */
export const speakText = async (
  text: string, 
  onProgress?: (charIndex: number) => void,
  onEnd?: () => void
) => {
  console.log('speakText triggered:', text);
  
  // If running as a Native App (Android/iOS)
  if (Capacitor.isNativePlatform()) {
    try {
      const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
      
      // Start a simulated progress timer since Native TTS doesn't provide per-word callbacks
      let charIndex = 0;
      const charCount = text.length;
      // Estimate 350ms per Chinese character (adjusted for rate 0.85)
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
        lang: 'zh-CN', // Keep standard for now
        rate: 0.85,
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient',
      });

      clearInterval(timer);
      if (onProgress) onProgress(-1); // Clear highlight
      if (onEnd) onEnd();
      return;
    } catch (e: any) {
      console.error('Native TTS failed or not installed', e);
      // Fallback to web below...
    }
  }

  // Web Fallback (Desktop Browser)
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

