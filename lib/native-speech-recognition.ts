// Speech Recognition Abstraction Layer
// Provides a unified interface for both Web Speech API and Capacitor native speech recognition

import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

export interface SpeechRecognitionResult {
  transcript: string;
  isFinal: boolean;
}

export interface SpeechRecognitionOptions {
  language: string;
  continuous: boolean;
  interimResults?: boolean;
}

export interface SpeechRecognitionService {
  start(options: SpeechRecognitionOptions): Promise<void>;
  stop(): Promise<void>;
  abort(): Promise<void>;
  isAvailable(): Promise<boolean>;
  requestPermission(): Promise<boolean>;
}

// Callback types
type ResultCallback = (result: SpeechRecognitionResult) => void;
type ErrorCallback = (error: string) => void;
type StartCallback = () => void;
type EndCallback = () => void;

// Global callbacks storage
const callbacks = {
  onResult: [] as ResultCallback[],
  onError: [] as ErrorCallback[],
  onStart: [] as StartCallback[],
  onEnd: [] as EndCallback[],
};

/**
 * Web Speech Recognition Implementation
 */
class WebSpeechRecognitionService implements SpeechRecognitionService {
  private recognition: any = null;
  private isListening = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.recognition !== null;
  }

  async requestPermission(): Promise<boolean> {
    // Web Speech API requests permission automatically when starting
    return true;
  }

  async start(options: SpeechRecognitionOptions): Promise<void> {
    if (!this.recognition) {
      throw new Error('Speech recognition not available');
    }

    // Configure recognition
    this.recognition.lang = options.language;
    this.recognition.continuous = options.continuous;
    this.recognition.interimResults = options.interimResults ?? true;

    // Set up event handlers
    this.recognition.onstart = () => {
      this.isListening = true;
      callbacks.onStart.forEach(cb => cb());
    };

    this.recognition.onend = () => {
      this.isListening = false;
      callbacks.onEnd.forEach(cb => cb());
    };

    this.recognition.onerror = (event: any) => {
      callbacks.onError.forEach(cb => cb(event.error));
    };

    this.recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        const isFinal = event.results[i].isFinal;
        callbacks.onResult.forEach(cb => cb({ transcript, isFinal }));
      }
    };

    // Start recognition
    try {
      this.recognition.start();
    } catch (e: any) {
      if (!e.message?.includes('already started')) {
        throw e;
      }
    }
  }

  async stop(): Promise<void> {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        // Ignore errors when stopping
      }
    }
  }

  async abort(): Promise<void> {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.abort();
      } catch (e) {
        // Ignore errors when aborting
      }
    }
  }
}

/**
 * Native Speech Recognition Implementation (Capacitor)
 */
class NativeSpeechRecognitionService implements SpeechRecognitionService {
  private isListening = false;
  private listeners: { [key: string]: any } = {};

  async isAvailable(): Promise<boolean> {
    try {
      const { available } = await SpeechRecognition.available();
      return available;
    } catch (e) {
      console.error('[NativeSpeech] Error checking availability:', e);
      return false;
    }
  }

  async requestPermission(): Promise<boolean> {
    try {
      const result = await SpeechRecognition.requestPermissions();
      // Check if speech recognition permission was granted
      return result.speechRecognition === 'granted';
    } catch (e) {
      console.error('[NativeSpeech] Error requesting permission:', e);
      return false;
    }
  }

  async start(options: SpeechRecognitionOptions): Promise<void> {
    try {
      // Check availability
      const available = await this.isAvailable();
      if (!available) {
        throw new Error('Speech recognition not available on this device');
      }

      // Request permission
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        throw new Error('Speech recognition permission denied');
      }

      // Remove existing listeners
      await this.removeAllListeners();

      // Set up listeners before starting
      this.listeners['partialResults'] = await SpeechRecognition.addListener('partialResults', (data: any) => {
        if (data.matches && data.matches.length > 0) {
          // Capacitor returns partial results as an array
          const transcript = data.matches.join('');
          // In Capacitor, we treat all results from partialResults as interim
          // The final result is determined when listening stops
          callbacks.onResult.forEach(cb => cb({ transcript, isFinal: false }));
        }
      });

      this.listeners['listeningState'] = await SpeechRecognition.addListener('listeningState', (data: any) => {
        if (data.status === 'stopped') {
          // When listening stops, we can consider the last result as final
          this.isListening = false;
          callbacks.onEnd.forEach(cb => cb());
        }
      });

      // Start listening
      await SpeechRecognition.start({
        language: options.language,
        partialResults: true,
        popup: false,
      });

      this.isListening = true;
      callbacks.onStart.forEach(cb => cb());

    } catch (e: any) {
      console.error('[NativeSpeech] Error starting:', e);
      callbacks.onError.forEach(cb => cb(e.message || 'Failed to start'));
      throw e;
    }
  }

  async stop(): Promise<void> {
    if (this.isListening) {
      try {
        await SpeechRecognition.stop();
        this.isListening = false;
        callbacks.onEnd.forEach(cb => cb());
      } catch (e) {
        console.error('[NativeSpeech] Error stopping:', e);
      }
    }
    await this.removeAllListeners();
  }

  async abort(): Promise<void> {
    await this.stop();
  }

  private async removeAllListeners(): Promise<void> {
    for (const [key, listener] of Object.entries(this.listeners)) {
      try {
        if (listener && listener.remove) {
          await listener.remove();
        }
      } catch (e) {
        // Ignore errors
      }
    }
    this.listeners = {};
  }
}

// Singleton instance
let serviceInstance: SpeechRecognitionService | null = null;

/**
 * Get the speech recognition service instance
 * Returns the appropriate implementation based on platform
 */
export function getSpeechRecognitionService(): SpeechRecognitionService {
  if (!serviceInstance) {
    if (Capacitor.isNativePlatform()) {
      console.log('[SpeechRecognition] Using native implementation');
      serviceInstance = new NativeSpeechRecognitionService();
    } else {
      console.log('[SpeechRecognition] Using web implementation');
      serviceInstance = new WebSpeechRecognitionService();
    }
  }
  return serviceInstance;
}

/**
 * Register callback for speech recognition results
 */
export function onSpeechResult(callback: ResultCallback): () => void {
  callbacks.onResult.push(callback);
  return () => {
    const index = callbacks.onResult.indexOf(callback);
    if (index > -1) {
      callbacks.onResult.splice(index, 1);
    }
  };
}

/**
 * Register callback for speech recognition errors
 */
export function onSpeechError(callback: ErrorCallback): () => void {
  callbacks.onError.push(callback);
  return () => {
    const index = callbacks.onError.indexOf(callback);
    if (index > -1) {
      callbacks.onError.splice(index, 1);
    }
  };
}

/**
 * Register callback for speech recognition start
 */
export function onSpeechStart(callback: StartCallback): () => void {
  callbacks.onStart.push(callback);
  return () => {
    const index = callbacks.onStart.indexOf(callback);
    if (index > -1) {
      callbacks.onStart.splice(index, 1);
    }
  };
}

/**
 * Register callback for speech recognition end
 */
export function onSpeechEnd(callback: EndCallback): () => void {
  callbacks.onEnd.push(callback);
  return () => {
    const index = callbacks.onEnd.indexOf(callback);
    if (index > -1) {
      callbacks.onEnd.splice(index, 1);
    }
  };
}

/**
 * Clear all registered callbacks
 */
export function clearAllCallbacks(): void {
  callbacks.onResult = [];
  callbacks.onError = [];
  callbacks.onStart = [];
  callbacks.onEnd = [];
}