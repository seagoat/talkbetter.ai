// Text-to-Speech Abstraction Layer
// Provides a unified interface for both Edge TTS (web) and Capacitor TTS (native)

import { Capacitor } from '@capacitor/core';

export interface TTSOptions {
  text: string;
  voice?: string;
  rate?: string; // e.g., '-50%', '-35%', '-20%', '+0%'
  onProgress?: (charIndex: number) => void;
  onEnd?: () => void;
}

export interface TTSVoice {
  id: string;
  name: string;
  language: string;
}

// Chinese voice mapping for Edge TTS
const EDGE_VOICE_MAP: Record<string, string> = {
  'xiaoxiao': 'zh-CN-XiaoxiaoNeural',
  'yunxi': 'zh-CN-YunxiNeural',
  'yunjian': 'zh-CN-YunjianNeural',
  'xiaoyi': 'zh-CN-XiaoyiNeural',
  'yunxia': 'zh-CN-YunxiaNeural',
  'xiaochen': 'zh-CN-XiaochenNeural',
};

/**
 * Parse rate string to numeric value
 * '-50%' -> 0.5, '-35%' -> 0.65, '-20%' -> 0.8, '+0%' -> 1.0
 */
function parseRate(rate: string): number {
  const match = rate.match(/([+-]?\d+)%/);
  if (match) {
    const percent = parseInt(match[1]);
    // Clamp to valid range: -50% to +100%
    const clampedPercent = Math.max(-50, Math.min(100, percent));
    return (100 + clampedPercent) / 100;
  }
  return 0.85; // Default rate
}

/**
 * Web TTS Implementation using Edge TTS via API route
 */
async function webSpeak(options: TTSOptions): Promise<void> {
  const { text, voice = 'xiaoxiao', rate = '-35%', onProgress, onEnd } = options;

  try {
    console.log('[WebTTS] Calling Edge TTS API for:', text.substring(0, 20) + '...');
    const response = await fetch(`/api/tts?text=${encodeURIComponent(text)}&voice=${voice}&rate=${encodeURIComponent(rate)}`);
    console.log('[WebTTS] API response status:', response.status);

    if (response.ok) {
      const audioBlob = await response.blob();
      console.log('[WebTTS] Audio blob size:', audioBlob.size, 'type:', audioBlob.type);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      // Pre-calculate positions of each Chinese character in the original text
      const charPositions: number[] = [];
      for (let i = 0; i < text.length; i++) {
        if (/[\u4e00-\u9fa5]/.test(text[i])) {
          charPositions.push(i);
        }
      }
      const charCount = charPositions.length;

      // Progress tracking state
      let progressInterval: ReturnType<typeof setInterval> | null = null;
      let charIndex = 0;
      let startTime = 0;
      let estimatedDuration = 0;

      // Get calibration factor from localStorage
      const calibrationFactor = getCalibrationFactor();

      const startProgressTracking = () => {
        if (!onProgress || charCount === 0) return;

        startTime = Date.now();

        // Calculate duration multiplier based on rate
        let durationMultiplier = 1;
        if (rate.includes('%')) {
          const rateValue = parseInt(rate);
          const speedRatio = Math.max(0.5, (100 + rateValue) / 100);
          durationMultiplier = 1 / speedRatio;
        }

        // Count punctuation marks for pause adjustment
        const punctCount = (text.match(/[，。！？、；：,.!?;:]/g) || []).length;
        const punctPause = punctCount * 200;

        const baseMsPerChar = 250;
        const msPerChar = baseMsPerChar * durationMultiplier;
        estimatedDuration = Math.round((charCount * msPerChar + punctPause) * calibrationFactor);

        console.log('[WebTTS] Tracking:', charCount, 'chars,', punctCount, 'puncts, calibrated duration:', estimatedDuration, 'ms');

        // Highlight first character immediately
        if (charPositions.length > 0) {
          onProgress(charPositions[0]);
          charIndex = 1;
        }

        progressInterval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / estimatedDuration, 1);
          const targetCharIdx = Math.floor(progress * charCount);

          while (charIndex <= targetCharIdx && charIndex < charPositions.length) {
            onProgress(charPositions[charIndex]);
            charIndex++;
          }

          if (progress >= 1 && progressInterval) {
            clearInterval(progressInterval);
          }
        }, 50);
      };

      const stopProgressTracking = () => {
        if (progressInterval) {
          clearInterval(progressInterval);
          progressInterval = null;
        }
      };

      audio.onplay = () => {
        console.log('[WebTTS] Audio started playing');
        startProgressTracking();
      };

      audio.oncanplaythrough = () => {
        audio.play().catch(e => {
          console.error('[WebTTS] Play failed:', e);
        });
      };

      audio.onended = () => {
        stopProgressTracking();
        URL.revokeObjectURL(audioUrl);

        // Dynamic calibration
        if (startTime > 0 && estimatedDuration > 0) {
          const actualDuration = Date.now() - startTime;
          const actualFactor = actualDuration / estimatedDuration;
          if (Math.abs(1 - actualFactor) > 0.1) {
            saveCalibrationFactor(actualFactor);
            console.log('[WebTTS] Calibration: estimated', estimatedDuration, 'ms, actual', actualDuration, 'ms');
          }
        }

        if (onProgress) onProgress(-1);
        if (onEnd) onEnd();
      };

      audio.onerror = () => {
        stopProgressTracking();
        URL.revokeObjectURL(audioUrl);
        console.warn('[WebTTS] Audio failed, falling back to Web Speech');
        webSpeechFallback(text, onProgress, onEnd);
      };

      return;
    }
  } catch (e) {
    console.warn('[WebTTS] API failed, falling back to Web Speech:', e);
  }

  // Fallback to Web Speech API
  webSpeechFallback(text, onProgress, onEnd);
}

/**
 * Web Speech API fallback
 */
function webSpeechFallback(
  text: string,
  onProgress?: (charIndex: number) => void,
  onEnd?: () => void
): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.8;

    const voices = window.speechSynthesis.getVoices();
    const zhVoice = voices.find(v => v.lang.includes('zh') && !v.name.includes('Hong Kong') && !v.name.includes('Taiwan'));
    if (zhVoice) utterance.voice = zhVoice;

    let timer: ReturnType<typeof setInterval> | null = null;
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
    console.warn('[WebSpeech] Text-to-speech not supported.');
    if (onEnd) onEnd();
  }
}

/**
 * Native TTS Implementation using Capacitor TTS
 */
async function nativeSpeak(options: TTSOptions): Promise<void> {
  const { text, rate = '-35%', onProgress, onEnd } = options;

  try {
    const { TextToSpeech } = await import('@capacitor-community/text-to-speech');

    // Calculate estimated duration for progress tracking
    const charCount = text.replace(/[^\u4e00-\u9fa5]/g, '').length;
    const rateValue = parseRate(rate);
    const punctCount = (text.match(/[，。！？、；：,.!?;:]/g) || []).length;
    const punctPause = punctCount * 200;
    const baseMsPerChar = 250;
    const estimatedDuration = Math.round((charCount * baseMsPerChar + punctPause) / rateValue);

    console.log('[NativeTTS] Speaking:', charCount, 'chars, rate:', rateValue);

    // Progress tracking
    let progressInterval: ReturnType<typeof setInterval> | null = null;
    let startTime = 0;

    if (onProgress && charCount > 0) {
      startTime = Date.now();

      // Find Chinese character positions
      const charPositions: number[] = [];
      for (let i = 0; i < text.length; i++) {
        if (/[\u4e00-\u9fa5]/.test(text[i])) {
          charPositions.push(i);
        }
      }

      // Highlight first character immediately
      if (charPositions.length > 0) {
        onProgress(charPositions[0]);
      }

      let charIndex = 1;
      progressInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / estimatedDuration, 1);
        const targetCharIdx = Math.floor(progress * charCount);

        while (charIndex <= targetCharIdx && charIndex < charPositions.length) {
          onProgress(charPositions[charIndex]);
          charIndex++;
        }

        if (progress >= 1 && progressInterval) {
          clearInterval(progressInterval);
        }
      }, 50);
    }

    // Speak using native TTS
    await TextToSpeech.speak({
      text,
      lang: 'zh-CN',
      rate: rateValue,
      pitch: 1.0,
      volume: 1.0,
      category: 'ambient',
    });

    // Clean up
    if (progressInterval) {
      clearInterval(progressInterval);
    }

    if (onProgress) onProgress(-1);
    if (onEnd) onEnd();

  } catch (e: any) {
    console.error('[NativeTTS] Error:', e);
    // Fallback to web implementation
    webSpeechFallback(text, onProgress, onEnd);
  }
}

// Calibration storage
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
  const current = getCalibrationFactor();
  const smoothed = current * 0.7 + factor * 0.3;
  localStorage.setItem(CALIBRATION_KEY, smoothed.toFixed(3));
  console.log('[TTS] Calibration factor updated:', current.toFixed(3), '->', smoothed.toFixed(3));
}

/**
 * Main speak function - chooses appropriate implementation based on platform
 */
export async function speak(options: TTSOptions): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    console.log('[TTS] Using native implementation');
    return nativeSpeak(options);
  } else {
    console.log('[TTS] Using web implementation');
    return webSpeak(options);
  }
}

/**
 * Stop any ongoing TTS
 */
export async function stopSpeaking(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
      await TextToSpeech.stop();
    } catch (e) {
      // Ignore errors
    }
  }

  // Stop web speech synthesis
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Get available voices (platform-specific)
 */
export async function getAvailableVoices(): Promise<TTSVoice[]> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
      const { voices } = await TextToSpeech.getSupportedVoices();

      // Filter for Chinese voices
      const chineseVoices = (voices || [])
        .filter((v: any) => v.language?.includes('zh'))
        .map((v: any) => ({
          id: v.identifier || v.name,
          name: v.name,
          language: v.language,
        }));

      // If no Chinese voices found, return default
      if (chineseVoices.length === 0) {
        return [{ id: 'default', name: '默认中文语音', language: 'zh-CN' }];
      }

      return chineseVoices;
    } catch (e) {
      console.warn('[NativeTTS] Could not get voices:', e);
      return [{ id: 'default', name: '默认中文语音', language: 'zh-CN' }];
    }
  } else {
    // Return Edge TTS voice options for web
    return Object.entries(EDGE_VOICE_MAP).map(([id, name]) => ({
      id,
      name: name.replace('zh-CN-', '').replace('Neural', ''),
      language: 'zh-CN',
    }));
  }
}