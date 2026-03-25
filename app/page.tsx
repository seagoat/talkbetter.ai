'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Mic, Play, RotateCcw, ChevronRight, Volume2, AlertCircle, CheckCircle2, BookOpen, History, Library, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { evaluatePronunciation, speakText, getPinyinList, type DetailedEvaluationResult, type TrainingSentence } from '@/lib/speech-utils';
import { Capacitor } from '@capacitor/core';
import { getSpeechRecognitionService, onSpeechResult, onSpeechError, onSpeechStart, onSpeechEnd, clearAllCallbacks, type SpeechRecognitionService } from '@/lib/native-speech-recognition';
import { ALL_CONTENT, CATEGORIES, getContentByCategory, type ContentItem } from '@/lib/content';
import { savePracticeRecord, getPracticeHistory, deletePracticeRecord, clearPracticeHistory, formatRecordDate, formatDuration, type PracticeRecord, type CharacterResult } from '@/lib/history';

type TrainingStep =
  | 'INITIAL'
  | 'COMPUTER_READING'
  | 'WAIT_FOR_USER'
  | 'USER_READING'
  | 'EVALUATED'
  | 'FIXING_ERRORS'
  | 'REREADING_ALL'
  | 'COMPLETED';

type ViewMode = 'library' | 'practice' | 'history';

// Convert ContentItem to TrainingSentence
function contentToTraining(item: ContentItem): TrainingSentence {
  return {
    id: item.id,
    text: item.text,
    title: item.title,
    difficulty: item.difficulty,
    category: item.category,
  };
}

export default function Home() {
  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>('library');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [contentList, setContentList] = useState<ContentItem[]>(ALL_CONTENT);

  // Practice state
  const [currentContent, setCurrentContent] = useState<ContentItem | null>(null);
  const [step, setStep] = useState<TrainingStep>('INITIAL');
  const [isRecording, setIsRecording] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const spokenTextRef = useRef('');
  useEffect(() => { spokenTextRef.current = spokenText; }, [spokenText]);
  const [interimSpoken, setInterimSpoken] = useState('');
  const interimSpokenRef = useRef('');
  useEffect(() => { interimSpokenRef.current = interimSpoken; }, [interimSpoken]);

  const [evaluation, setEvaluation] = useState<DetailedEvaluationResult[] | null>(null);
  const evaluationRef = useRef<DetailedEvaluationResult[] | null>(null);
  useEffect(() => { evaluationRef.current = evaluation; }, [evaluation]);

  const [readingIndex, setReadingIndex] = useState(-1);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [debugError, setDebugError] = useState<string>('');
  const [debugLog, setDebugLog] = useState<string[]>([]);

  // Practice timing
  const practiceStartTimeRef = useRef<number>(0);

  // History
  const [historyRecords, setHistoryRecords] = useState<PracticeRecord[]>([]);
  const [showHistoryDetail, setShowHistoryDetail] = useState<PracticeRecord | null>(null);

  // Recording
  const [userRecording, setUserRecording] = useState<string | null>(null);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0); // 录音总时长（秒）
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // TTS Loading state
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsLoadingText, setTtsLoadingText] = useState('正在生成语音...');

  // Voice selection
  const [selectedVoice, setSelectedVoiceState] = useState<string>(() => {
    // 从 localStorage 读取上次选择的音色
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('talkbetter_selected_voice');
      return saved || 'xiaoxiao';
    }
    return 'xiaoxiao';
  });
  const VOICE_OPTIONS = [
    { id: 'xiaoxiao', name: '晓晓', gender: 'female', description: '女性，温暖自然' },
    { id: 'yunxi', name: '云希', gender: 'male', description: '男性，年轻活力' },
    { id: 'yunjian', name: '云健', gender: 'male', description: '男性，专业沉稳' },
    { id: 'xiaoyi', name: '晓伊', gender: 'female', description: '女性，活泼开朗' },
  ];

  // Speed selection (语速)
  const [selectedSpeed, setSelectedSpeedState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('talkbetter_selected_speed');
      return saved || '-35%';
    }
    return '-35%';
  });
  const SPEED_OPTIONS = [
    { id: '-50%', name: '很慢', description: '适合初学者' },
    { id: '-35%', name: '较慢', description: '适合练习' },
    { id: '-20%', name: '稍慢', description: '接近正常' },
    { id: '+0%', name: '正常', description: '标准语速' },
  ];

  // 包装函数：设置音色并保存到 localStorage
  const setSelectedVoice = (voice: string) => {
    setSelectedVoiceState(voice);
    localStorage.setItem('talkbetter_selected_voice', voice);
  };

  // 包装函数：设置语速并保存到 localStorage
  const setSelectedSpeed = (speed: string) => {
    setSelectedSpeedState(speed);
    localStorage.setItem('talkbetter_selected_speed', speed);
  };

  const addLog = (msg: string) => {
    setDebugLog(prev => [new Date().toLocaleTimeString() + ': ' + msg, ...prev].slice(0, 5));
  };

  const recognitionServiceRef = useRef<SpeechRecognitionService | null>(null);
  const autoStopTimerRef = useRef<NodeJS.Timeout | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSpeechTimeRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const charTimestampsRef = useRef<Map<number, { start: number; end: number }>>(new Map());
  const stepRef = useRef<TrainingStep>(step);

  // Derived values
  const currentSentence = useMemo(() => currentContent ? contentToTraining(currentContent) : null, [currentContent]);
  const currentSentenceRef = useRef(currentSentence);
  useEffect(() => { currentSentenceRef.current = currentSentence; }, [currentSentence]);
  useEffect(() => { stepRef.current = step; }, [step]);

  const targetPinyinList = useMemo(() => currentSentence ? getPinyinList(currentSentence.text) : [], [currentSentence]);

  // Load history on mount
  useEffect(() => {
    setHistoryRecords(getPracticeHistory());
  }, []);

  // Update content list when category changes
  useEffect(() => {
    setContentList(selectedCategory ? getContentByCategory(selectedCategory) : ALL_CONTENT);
  }, [selectedCategory]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initRecognition = async () => {
      const service = getSpeechRecognitionService();
      recognitionServiceRef.current = service;

      const available = await service.isAvailable();
      if (!available) {
        addLog('警告: 设备不支持语音识别');
        return;
      }

      // Request permission on native platforms
      if (Capacitor.isNativePlatform()) {
        const granted = await service.requestPermission();
        if (!granted) {
          addLog('警告: 未获得麦克风权限');
          return;
        }
      }
    };

    initRecognition();

    // Set up event handlers using callbacks
    const unsubStart = onSpeechStart(() => {
      setIsRecording(true);
      setDebugError('');
      addLog('事件: Recognition Started');
    });

    const unsubEnd = onSpeechEnd(() => {
      setIsRecording(false);
      addLog('事件: Recognition Ended');
    });

    const unsubError = onSpeechError((error) => {
      console.error('Speech recognition error', error);
      addLog('!!! 识别报错: ' + error);
      setIsRecording(false);
      let friendlyMsg = '无法识别声音。';
      if (error === 'not-allowed' || error === 'Permission denied') friendlyMsg = '请点击允许麦克风访问。';
      if (error === 'network') friendlyMsg = '网络连接不稳定，请重试。';
      setFeedbackMessage(friendlyMsg);
      setDebugError(`系统错误代码: ${error}`);
    });

    const unsubResult = onSpeechResult((result) => {
      const { transcript, isFinal } = result;
      let newSpokenText = spokenTextRef.current;

      if (isFinal) {
        newSpokenText += transcript;
        setSpokenText(newSpokenText);
      } else {
        setInterimSpoken(transcript);
      }

      // 只在最终结果时更新评估，避免临时结果导致的跳变
      // 同时合并最终结果和临时结果用于计算
      const currentTotalSpoken = newSpokenText + (isFinal ? '' : transcript);

      // 只有当有最终结果时才更新评估
      if (isFinal) {
        const matchResults = evaluatePronunciation(currentSentenceRef.current?.text || '', currentTotalSpoken, { enableDetailed: true }) as DetailedEvaluationResult[];
        setEvaluation(prev => {
          if (!prev || stepRef.current === 'REREADING_ALL') return matchResults;
          return matchResults.map((res, idx) => (prev[idx]?.isCorrect) ? prev[idx] : res);
        });
      }

      // 计算字数时也转换数字
      const targetCharCount = (currentSentenceRef.current?.text || '').replace(/[^\u4e00-\u9fa5]/g, '').length;
      const spokenCharCount = currentTotalSpoken.replace(/[^\u4e00-\u9fa50-9]/g, '').length;

      // 更新最后说话时间（用于静音检测）
      lastSpeechTimeRef.current = Date.now();

      // 清除之前的自动停止定时器
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);

      // 条件1: 已读完所有字符
      if (spokenCharCount >= targetCharCount) {
        autoStopTimerRef.current = setTimeout(() => {
          addLog('自动检测：用户已完成朗读');
          setIsRecording(false);
        }, 1200);
      }

      // 条件2: 静音检测 - 2秒内没有新的语音输入，且已朗读超过一半
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (spokenCharCount >= targetCharCount * 0.5) {
        silenceTimerRef.current = setTimeout(() => {
          const silenceDuration = Date.now() - lastSpeechTimeRef.current;
          if (silenceDuration >= 2000) {
            addLog('自动检测：用户已停止说话（静音超过2秒）');
            setIsRecording(false);
          }
        }, 2000);
      }
    });

    return () => {
      unsubStart();
      unsubEnd();
      unsubError();
      unsubResult();
      clearAllCallbacks();
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      recognitionServiceRef.current?.abort();
    };
  }, []);

  // Save practice record
  const saveCurrentPractice = () => {
    const evalToSave = evaluationRef.current;
    if (!currentContent || !evalToSave) {
      console.log('Cannot save: no content or evaluation', { currentContent, evalToSave });
      return;
    }
    const correctCount = evalToSave.filter(r => r.isCorrect).length;
    const totalCount = evalToSave.filter(r => /[\u4e00-\u9fa5]/.test(r.char)).length;
    const overallScore = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

    const charResults: CharacterResult[] = evalToSave
      .filter(r => /[\u4e00-\u9fa5]/.test(r.char))
      .map(r => ({ char: r.char, expectedPinyin: r.expectedPinyin, actualPinyin: r.actualPinyin || null, isCorrect: r.isCorrect, initialScore: r.initialScore, finalScore: r.finalScore, toneScore: r.toneScore }));

    const duration = practiceStartTimeRef.current > 0 ? Date.now() - practiceStartTimeRef.current : 0;

    console.log('Saving practice record:', { contentTitle: currentContent.title, overallScore, correctCount, totalCount, voice: selectedVoice });

    savePracticeRecord({
      contentId: currentContent.id, contentTitle: currentContent.title, contentText: currentContent.text, category: currentContent.category,
      results: charResults, overallScore, correctCount, totalCount, duration, voice: selectedVoice,
    });
    setHistoryRecords(getPracticeHistory());
  };

  const handleSelectContent = (item: ContentItem) => {
    setCurrentContent(item);
    resetState();
    setViewMode('practice');
    practiceStartTimeRef.current = 0;

    // 预加载TTS音频到缓存
    preloadTTS(item.text, selectedVoice, selectedSpeed);
  };

  // 预加载TTS音频（后台静默请求，填充缓存，不需要timing数据）
  const preloadTTS = async (text: string, voice: string, speed: string) => {
    try {
      console.log('预加载TTS音频...');
      const response = await fetch(`/api/tts?text=${encodeURIComponent(text)}&voice=${voice}&rate=${encodeURIComponent(speed)}`);
      if (response.ok) {
        console.log('TTS音频预加载完成');
      }
    } catch (e) {
      console.log('TTS预加载失败（不影响使用）:', e);
    }
  };

  const handleNext = () => {
    saveCurrentPractice();
    const currentIdx = contentList.findIndex(c => c.id === currentContent?.id);
    if (currentIdx >= 0 && currentIdx < contentList.length - 1) {
      setCurrentContent(contentList[currentIdx + 1]);
      resetState();
    } else {
      setStep('COMPLETED');
      setFeedbackMessage('🎊 恭喜！您已完成本组训练！');
    }
  };

  const resetState = () => {
    setStep('INITIAL');
    setEvaluation(null);
    setSpokenText('');
    setInterimSpoken('');
    setFeedbackMessage('');
    setReadingIndex(-1);
    setUserRecording(null);
  };

  const handleStartComputerRead = async () => {
    if (!currentSentence) return;
    setStep('COMPUTER_READING');
    setTtsLoadingText('正在生成语音...');
    setTtsLoading(true);
    try {
      await speakText(currentSentence.text, (idx) => setReadingIndex(idx), () => { setReadingIndex(-1); setStep('WAIT_FOR_USER'); setFeedbackMessage('请开始朗读这段文字'); }, selectedVoice, selectedSpeed);
    } finally {
      setTtsLoading(false);
    }
  };

  // 点击单个字播放
  const handleCharClick = async (char: string) => {
    if (ttsLoading) return; // 防止重复点击
    setTtsLoadingText(`正在生成"${char}"的发音...`);
    setTtsLoading(true);
    try {
      await speakText(char, undefined, undefined, selectedVoice, selectedSpeed);
    } finally {
      setTtsLoading(false);
    }
  };

  const handleStartUserRead = async () => {
    if (isRecording || !currentSentence) return;
    addLog('--- 启动流程开始 ---');
    if (step !== 'FIXING_ERRORS' && step !== 'REREADING_ALL') {
      practiceStartTimeRef.current = Date.now();
      setSpokenText('');
      setInterimSpoken('');
      setEvaluation(null);
      setStep('USER_READING');
      setUserRecording(null);
    }

    let audioStream: MediaStream | null = null;
    try {
      addLog('正在唤起麦克风弹窗...');
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      addLog('成功获取录音流授权');
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(audioStream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setUserRecording(url);
        // 计算录音时长
        const duration = (Date.now() - recordingStartTimeRef.current) / 1000;
        setRecordingDuration(duration);
        addLog(`录音已保存，时长: ${duration.toFixed(1)}秒`);
        audioStream?.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.start();
      addLog('MediaRecorder 已启动');
      recordingStartTimeRef.current = Date.now();
      charTimestampsRef.current.clear();
    } catch (e: any) {
      addLog('! 无法获取录音授权: ' + e.message);
      setFeedbackMessage('请允许麦克风权限以开始练习');
      setIsRecording(false);
      return;
    }

    try {
      await recognitionServiceRef.current?.start({
        language: 'zh-CN',
        continuous: true,
        interimResults: true,
      });
      setIsRecording(true);
    } catch (e: any) {
      addLog('识别引擎启动报错: ' + e.message);
      if (!e.message?.includes('already started')) setFeedbackMessage('识别引擎启动失败，请刷新页面重试');
    }
  };

  const handleStopUserRead = async () => {
    if (autoStopTimerRef.current) { clearTimeout(autoStopTimerRef.current); autoStopTimerRef.current = null; }
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    setIsRecording(false);
    addLog('正在停止录音...');
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') { mediaRecorderRef.current.stop(); addLog('MediaRecorder 已停止'); }
    try { await recognitionServiceRef.current?.stop(); addLog('语音识别已停止'); } catch (e) {}

    // 等待识别结果处理完成后，计算最终评估
    setTimeout(() => {
      // 合并最终文本
      const finalSpokenText = spokenTextRef.current + interimSpokenRef.current;
      setSpokenText(finalSpokenText);
      setInterimSpoken('');

      // 计算最终评估
      if (currentSentenceRef.current && finalSpokenText) {
        const matchResults = evaluatePronunciation(
          currentSentenceRef.current.text,
          finalSpokenText,
          { enableDetailed: true }
        ) as DetailedEvaluationResult[];
        setEvaluation(matchResults);
        evaluationRef.current = matchResults;
        addLog('最终评估完成，识别文本: ' + finalSpokenText);

        // 手动触发后续处理（因为 isRecording 已经是 false 了，useEffect 不会再次触发）
        const allCorrect = matchResults.every(r => r.isCorrect);
        const currentStep = stepRef.current;

        if (['USER_READING', 'REREADING_ALL'].includes(currentStep)) {
          saveCurrentPractice();
        }

        if (allCorrect) {
          if (currentStep === 'REREADING_ALL') {
            setStep('COMPLETED');
            setFeedbackMessage('🎉 太棒了！完美发音，顺利通过！');
          } else if (currentStep === 'USER_READING') {
            setTimeout(() => {
              setStep('REREADING_ALL');
              setFeedbackMessage('很好，现在请重新完整朗读一遍。');
              setSpokenText('');
              setInterimSpoken('');
              if (currentSentenceRef.current) {
                setEvaluation(currentSentenceRef.current.text.split('').map((char, idx) => ({
                  char,
                  isCorrect: false,
                  expectedPinyin: targetPinyinList[idx],
                  initialScore: 0,
                  finalScore: 0,
                  toneScore: 0,
                  overallScore: 0,
                  errorType: 'none' as const,
                  position: idx,
                  confidence: 0,
                  actualPinyin: '',
                  actualChar: ''
                })));
              }
            }, 1500);
          }
        } else if (['USER_READING', 'REREADING_ALL'].includes(currentStep)) {
          setStep('FIXING_ERRORS');
          setFeedbackMessage('发现发音错误，请针对红色部分进行复述。');
        }
      }

      addLog('停止流程完成');
    }, 600);
  };

  const playUserRecording = (charPosition?: number) => {
    if (!userRecording || !currentSentence) return;
    if (audioRef.current) audioRef.current.pause();

    const audio = new Audio(userRecording);
    audioRef.current = audio;

    // 计算中文字符的位置列表（记录每个中文字符在原文中的位置）
    const chineseCharPositions: number[] = [];
    for (let i = 0; i < currentSentence.text.length; i++) {
      if (/[\u4e00-\u9fa5]/.test(currentSentence.text[i])) {
        chineseCharPositions.push(i);
      }
    }

    audio.onloadedmetadata = () => {
      const totalDuration = audio.duration;

      if (charPosition !== undefined) {
        // 找到这个字符是第几个中文字符
        const charIndex = chineseCharPositions.indexOf(charPosition);
        if (charIndex >= 0) {
          const charCount = chineseCharPositions.length;
          // 按比例计算时间
          const timePerChar = totalDuration / charCount;
          const startTime = Math.max(0, charIndex * timePerChar - 0.1);
          const endTime = Math.min(totalDuration, (charIndex + 1) * timePerChar + 0.2);

          audio.currentTime = startTime;
          audio.onplay = () => setIsPlayingRecording(true);

          // 在指定时间后停止
          const playDuration = (endTime - startTime) * 1000;
          const stopTimer = setTimeout(() => {
            if (audioRef.current === audio) {
              audio.pause();
              setIsPlayingRecording(false);
            }
          }, playDuration);

          // 清理定时器的引用
          audio.onended = () => {
            clearTimeout(stopTimer);
            setIsPlayingRecording(false);
          };
        } else {
          // 找不到位置，播放全部
          audio.onplay = () => setIsPlayingRecording(true);
          audio.onended = () => setIsPlayingRecording(false);
        }
      } else {
        // 播放全部
        audio.onplay = () => setIsPlayingRecording(true);
        audio.onended = () => setIsPlayingRecording(false);
      }

      audio.play().catch(e => {
        console.error('播放失败:', e);
        setIsPlayingRecording(false);
      });
    };

    audio.onerror = () => setIsPlayingRecording(false);
  };

  const stopPlayingRecording = () => {
    if (audioRef.current) audioRef.current.pause();
    setIsPlayingRecording(false);
  };

  const processFinalEvaluation = () => {
    const currentEval = evaluationRef.current;
    const currentStep = stepRef.current;
    if (!currentEval) return;

    const allCorrect = currentEval.every(r => r.isCorrect);

    // Save practice record after first reading or re-reading
    if (['USER_READING', 'REREADING_ALL'].includes(currentStep)) {
      saveCurrentPractice();
    }

    if (allCorrect) {
      if (currentStep === 'REREADING_ALL') {
        setStep('COMPLETED');
        setFeedbackMessage('🎉 太棒了！完美发音，顺利通过！');
      } else if (['EVALUATED', 'FIXING_ERRORS', 'USER_READING'].includes(currentStep)) {
        setTimeout(() => {
          setStep('REREADING_ALL');
          setFeedbackMessage('很好，现在请重新完整朗读一遍。');
          setSpokenText('');
          setInterimSpoken('');
          if (currentSentence) {
            setEvaluation(currentSentence.text.split('').map((char, idx) => ({ char, isCorrect: false, expectedPinyin: targetPinyinList[idx], initialScore: 0, finalScore: 0, toneScore: 0, overallScore: 0, errorType: 'none' as const, position: idx, confidence: 0, actualPinyin: '', actualChar: '' })));
          }
        }, 1500);
      }
    } else if (['USER_READING', 'REREADING_ALL'].includes(currentStep)) {
      setStep('FIXING_ERRORS');
      setFeedbackMessage('发现发音错误，请针对红色部分进行复述。');
    }
  };

  useEffect(() => {
    if (!isRecording && ['USER_READING', 'REREADING_ALL', 'FIXING_ERRORS'].includes(step)) {
      const timer = setTimeout(processFinalEvaluation, 300);
      return () => clearTimeout(timer);
    }
  }, [isRecording]);

  // Render character display
  const renderCharacterDisplay = () => {
    if (!currentSentence) return null;
    return (
      <div className="mb-10 flex flex-wrap gap-x-4 gap-y-8 justify-center min-h-[160px]">
        {currentSentence.text.split('').map((char, idx) => {
          if (/[^\u4e00-\u9fa5]/.test(char)) return <span key={idx} className="self-end text-2xl text-slate-400 mx-1">{char}</span>;
          const evalRes = evaluation ? evaluation[idx] : null;
          const isCurrentReading = readingIndex === idx;
          const isCorrect = evalRes?.isCorrect;
          const isError = evalRes && !evalRes.isCorrect && ['FIXING_ERRORS', 'REREADING_ALL', 'COMPLETED'].includes(step);
          return (
            <div key={idx} className={clsx("flex flex-col items-center transition-all duration-200 p-2 rounded-xl cursor-pointer hover:bg-slate-50", isCurrentReading && "bg-blue-50 scale-110", isError && "bg-red-50", isCorrect && ['USER_READING', 'REREADING_ALL'].includes(step) && "bg-green-50")} onClick={() => handleCharClick(char)}>
              <span className={clsx("text-xs mb-1 font-mono text-slate-400", isError && "text-red-500 font-bold")}>{targetPinyinList[idx]}</span>
              <span className={clsx("text-4xl font-bold transition-colors", isCurrentReading ? "text-blue-600" : "text-slate-800", isError ? "text-red-500 border-b-2 border-red-500" : (isCorrect ? "text-green-600" : ""))}>{char}</span>
              {isError && <div className="mt-2 text-[10px] text-red-400 flex items-center gap-1"><Volume2 className="w-3 h-3" /> 点击听</div>}
            </div>
          );
        })}
      </div>
    );
  };

  // Render evaluation panel
  const renderEvaluationPanel = () => {
    if (!evaluation || !['EVALUATED', 'FIXING_ERRORS', 'REREADING_ALL', 'COMPLETED'].includes(step)) return null;
    const correctCount = evaluation.filter(r => r.isCorrect).length;
    const totalCount = evaluation.filter(r => /[\u4e00-\u9fa5]/.test(r.char)).length;
    const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

    return (
      <div className="mt-8 p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border border-slate-200">
        <div className="text-sm font-bold text-slate-600 mb-3 flex justify-between items-center">
          <span>📊 发音分析报告</span>
          <div className="flex items-center gap-3">
            {userRecording && <button onClick={isPlayingRecording ? stopPlayingRecording : () => playUserRecording()} className="flex items-center gap-1 px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition-colors">{isPlayingRecording ? <><span className="animate-pulse">⏹</span> 停止</> : <><Volume2 className="w-3 h-3" /> 听全部录音</>}</button>}
            <span className="text-xs text-slate-400">准确率: {accuracy}%</span>
          </div>
        </div>
        <div className="space-y-2">
          {evaluation.filter(r => /[\u4e00-\u9fa5]/.test(r.char)).map((res, i) => (
            <div key={i} className={clsx("p-3 rounded-xl transition-all", res.isCorrect ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200")}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className={clsx("text-2xl font-bold", res.isCorrect ? "text-green-600" : "text-red-600")}>{res.char}</span>
                  <div className="text-xs text-slate-500">
                    <div>目标: <span className="font-mono font-bold">{res.expectedPinyin}</span></div>
                    {res.actualPinyin && <div>实际: <span className={clsx("font-mono font-bold", res.isCorrect ? "text-green-600" : "text-red-600")}>{res.actualPinyin}</span></div>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* 听正确发音 */}
                  <button
                    onClick={() => handleCharClick(res.char)}
                    disabled={ttsLoading}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors disabled:opacity-50"
                    title="听标准发音"
                  >
                    <Volume2 className="w-3 h-3" /> 标准
                  </button>
                  {/* 听自己发音 - 播放该字对应的录音片段 */}
                  {userRecording && (
                    <button
                      onClick={() => playUserRecording(res.position)}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition-colors"
                      title="听自己读这个字的录音"
                    >
                      <Mic className="w-3 h-3" /> 我的
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs">
                  <span className={clsx("text-lg font-bold", res.isCorrect ? "text-green-600" : "text-red-600")}>{res.overallScore || 0}分</span>
                  {res.errorType && res.errorType !== 'none' && <span className="text-red-500 ml-2">{res.errorType === 'deletion' ? '漏读' : res.errorType === 'substitution' ? '错读' : '部分匹配'}</span>}
                </div>
              </div>
              <div className="flex gap-2 text-xs">
                <div className="flex-1">
                  <div className="flex justify-between text-slate-500 mb-1">
                    <span>声母</span>
                    <span className={(res.initialScore ?? 0) >= 90 ? "text-green-600" : "text-red-600"}>{res.initialScore ?? 0}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className={clsx("h-full rounded-full transition-all", (res.initialScore ?? 0) >= 90 ? "bg-green-500" : "bg-red-500")} style={{ width: `${res.initialScore ?? 0}%` }} />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-slate-500 mb-1">
                    <span>韵母</span>
                    <span className={(res.finalScore ?? 0) >= 90 ? "text-green-600" : "text-red-600"}>{res.finalScore ?? 0}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className={clsx("h-full rounded-full transition-all", (res.finalScore ?? 0) >= 90 ? "bg-green-500" : "bg-red-500")} style={{ width: `${res.finalScore ?? 0}%` }} />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-slate-500 mb-1">
                    <span>声调</span>
                    <span className={(res.toneScore ?? 0) >= 90 ? "text-green-600" : "text-red-600"}>{res.toneScore ?? 0}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className={clsx("h-full rounded-full transition-all", (res.toneScore ?? 0) >= 90 ? "bg-green-500" : "bg-red-500")} style={{ width: `${res.toneScore ?? 0}%` }} />
                  </div>
                </div>
              </div>
              {!res.isCorrect && <div className="mt-2 p-2 bg-white/50 rounded-lg text-xs">💡 正确发音: <span className="font-mono font-bold text-blue-600">{res.expectedPinyin}</span></div>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render practice view
  const renderPracticeView = () => {
    if (!currentSentence) return null;
    return (
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 flex flex-col" style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>
        {/* 顶部信息栏 */}
        <div className="p-6 border-b border-slate-100 shrink-0">
          <div className="flex justify-between items-start">
            <div>
              <button onClick={() => setViewMode('library')} className="text-xs text-blue-600 hover:underline mb-1">← 返回内容库</button>
              <div className="text-xs font-medium text-blue-600 tracking-wider uppercase mb-1">{CATEGORIES.find(c => c.id === currentSentence.category)?.name || currentSentence.category}</div>
              <h3 className="text-xl font-bold text-slate-800">{currentSentence.title || '朗读练习'}</h3>
            </div>
            <div className={clsx("px-3 py-1 rounded-full text-xs font-semibold", currentSentence.difficulty === 'easy' ? "bg-green-100 text-green-700" : currentSentence.difficulty === 'medium' ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700")}>{currentSentence.difficulty.toUpperCase()}</div>
          </div>
        </div>

        {/* 中间内容区域 - 可滚动 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* 文字显示 */}
          <div className="mb-6 flex flex-wrap gap-x-3 gap-y-6 justify-center">
            {currentSentence.text.split('').map((char, idx) => {
              if (/[^\u4e00-\u9fa5]/.test(char)) return <span key={idx} className="self-end text-xl text-slate-400 mx-0.5">{char}</span>;
              const evalRes = evaluation ? evaluation[idx] : null;
              const isCurrentReading = readingIndex === idx;
              const isCorrect = evalRes?.isCorrect;
              const isError = evalRes && !evalRes.isCorrect && ['FIXING_ERRORS', 'REREADING_ALL', 'COMPLETED'].includes(step);
              return (
                <div key={idx} className={clsx("flex flex-col items-center transition-all duration-200 p-2 rounded-xl cursor-pointer hover:bg-slate-50", isCurrentReading && "bg-blue-50 scale-110", isError && "bg-red-50", isCorrect && ['USER_READING', 'REREADING_ALL'].includes(step) && "bg-green-50")} onClick={() => handleCharClick(char)}>
                  <span className={clsx("text-xs mb-1 font-mono text-slate-400", isError && "text-red-500 font-bold")}>{targetPinyinList[idx]}</span>
                  <span className={clsx("text-3xl font-bold transition-colors", isCurrentReading ? "text-blue-600" : "text-slate-800", isError ? "text-red-500 border-b-2 border-red-500" : (isCorrect ? "text-green-600" : ""))}>{char}</span>
                </div>
              );
            })}
          </div>

          {/* 提示信息 */}
          {feedbackMessage && (
            <div className={clsx("mb-6 flex justify-center", feedbackMessage.includes('🎉') ? "text-green-700" : feedbackMessage.includes('发现') ? "text-red-700" : "text-blue-700")}>
              <div className={clsx("inline-flex items-center gap-2 px-5 py-2 rounded-2xl text-sm font-medium", feedbackMessage.includes('🎉') ? "bg-green-100" : feedbackMessage.includes('发现') ? "bg-red-100" : "bg-blue-100")}>
                {feedbackMessage.includes('🎉') ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {feedbackMessage}
              </div>
            </div>
          )}

          {/* 识别状态 */}
          {['USER_READING', 'REREADING_ALL', 'FIXING_ERRORS'].includes(step) && (
            <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase mb-2"><Mic className="w-3 h-3" /> {isRecording ? '正在聆听...' : '准备就绪'}</div>
              <p className="text-slate-600 min-h-[1.5rem]">{spokenText}<span className="text-blue-400">{interimSpoken}</span></p>
            </div>
          )}

          {/* 评估面板 */}
          {renderEvaluationPanel()}
        </div>

        {/* 底部按钮区域 - 固定 */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0">
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center justify-center gap-6">
              {['INITIAL', 'COMPUTER_READING', 'WAIT_FOR_USER'].includes(step) && (
                <button onClick={handleStartComputerRead} disabled={step === 'COMPUTER_READING' || ttsLoading} className={clsx("flex flex-col items-center gap-2 group", (step === 'COMPUTER_READING' || ttsLoading) && "opacity-50 cursor-not-allowed")}>
                  <div className="p-5 rounded-2xl bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-md">
                    <Volume2 className={clsx("w-7 h-7", step === 'COMPUTER_READING' && "animate-bounce")} />
                  </div>
                  <span className="text-xs font-bold text-slate-400">听示范</span>
                </button>
              )}
              {['WAIT_FOR_USER', 'USER_READING', 'REREADING_ALL', 'FIXING_ERRORS'].includes(step) && (
                <button onClick={isRecording ? handleStopUserRead : handleStartUserRead} className="flex flex-col items-center gap-2 group">
                  <div className={clsx("p-6 rounded-full shadow-lg transition-all border-6", isRecording ? "bg-red-500 text-white border-red-200 scale-110" : "bg-blue-600 text-white border-blue-100 hover:bg-blue-700")}><Mic className={clsx("w-8 h-8", isRecording && "animate-pulse")} /></div>
                  <span className="text-xs font-bold text-slate-400">{isRecording ? '停止' : '开始朗读'}</span>
                </button>
              )}
              {step === 'COMPLETED' && (
                <button onClick={handleNext} className="flex flex-col items-center gap-2 group">
                  <div className="p-5 rounded-2xl bg-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-md"><ChevronRight className="w-7 h-7" /></div>
                  <span className="text-xs font-bold text-slate-400">下一篇</span>
                </button>
              )}
            </div>
            <button onClick={resetState} className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-sm font-medium"><RotateCcw className="w-4 h-4" /> 重新开始</button>
          </div>
        </div>
      </div>
    );
  };

  // Render library view
  const renderLibraryView = () => (
    <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
      <div className="p-6">
        <div className="flex flex-wrap gap-2 mb-6">
          <button onClick={() => setSelectedCategory(null)} className={clsx("px-4 py-2 rounded-full text-sm font-medium transition-all", !selectedCategory ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>全部 ({ALL_CONTENT.length})</button>
          {CATEGORIES.map(cat => {
            const count = getContentByCategory(cat.id).length;
            return <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={clsx("px-4 py-2 rounded-full text-sm font-medium transition-all", selectedCategory === cat.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>{cat.icon} {cat.name} ({count})</button>;
          })}
        </div>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {contentList.map(item => (
            <div key={item.id} onClick={() => handleSelectContent(item)} className="p-4 rounded-2xl border border-slate-100 hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer transition-all group">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-bold text-slate-800 group-hover:text-blue-600">{item.title}{item.author && <span className="font-normal text-slate-400 ml-2">- {item.author}</span>}</h4>
                  {item.subcategory && <span className="text-xs text-slate-400">{item.subcategory}</span>}
                </div>
                <div className={clsx("px-2 py-1 rounded-full text-xs font-semibold", item.difficulty === 'easy' ? "bg-green-100 text-green-700" : item.difficulty === 'medium' ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700")}>{item.difficulty === 'easy' ? '简单' : item.difficulty === 'medium' ? '中等' : '困难'}</div>
              </div>
              <p className="text-slate-600 text-sm line-clamp-2">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // Render history view
  const renderHistoryView = () => (
    <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-slate-800">练习历史</h3>
          {historyRecords.length > 0 && <button onClick={() => { if (confirm('确定要清空所有历史记录吗？')) { clearPracticeHistory(); setHistoryRecords([]); } }} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"><Trash2 className="w-3 h-3" /> 清空历史</button>}
        </div>
        {historyRecords.length === 0 ? (
          <div className="text-center py-12 text-slate-400"><History className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>暂无练习记录</p><p className="text-sm mt-2">完成朗读练习后会自动记录在这里</p></div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {historyRecords.map(record => (
              <div key={record.id} className="p-4 rounded-2xl border border-slate-100 hover:border-blue-300 transition-all">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="font-bold text-slate-800">{record.contentTitle}</h4>
                    <div className="text-xs text-slate-400">
                      {formatRecordDate(record.timestamp)}
                      {record.duration > 0 && ` · ${formatDuration(record.duration)}`}
                      {record.voice && ` · 音色: ${VOICE_OPTIONS.find(v => v.id === record.voice)?.name || record.voice}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={clsx("px-3 py-1 rounded-full text-sm font-bold", record.overallScore >= 90 ? "bg-green-100 text-green-700" : record.overallScore >= 60 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700")}>{record.overallScore}%</div>
                    <button onClick={() => setShowHistoryDetail(record)} className="text-blue-600 hover:text-blue-800 text-sm">详情</button>
                  </div>
                </div>
                <p className="text-slate-600 text-sm line-clamp-1">{record.contentText}</p>
                <div className="mt-2 flex items-center gap-4 text-xs text-slate-400"><span>正确 {record.correctCount}/{record.totalCount}</span></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Render history detail modal
  const renderHistoryDetailModal = () => {
    if (!showHistoryDetail) return null;
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 relative max-h-[80vh] overflow-y-auto">
          <button onClick={() => setShowHistoryDetail(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-2xl">×</button>
          <h3 className="text-lg font-bold text-slate-800 mb-2">{showHistoryDetail.contentTitle}</h3>
          <p className="text-slate-600 text-sm mb-4">{showHistoryDetail.contentText}</p>
          <div className="flex items-center gap-4 mb-4 text-sm">
            <span className="text-slate-400">{formatRecordDate(showHistoryDetail.timestamp)}</span>
            <span className={clsx("px-2 py-1 rounded-full font-bold", showHistoryDetail.overallScore >= 90 ? "bg-green-100 text-green-700" : showHistoryDetail.overallScore >= 60 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700")}>{showHistoryDetail.overallScore}%</span>
            {showHistoryDetail.voice && <span className="text-slate-500">音色: {VOICE_OPTIONS.find(v => v.id === showHistoryDetail.voice)?.name || showHistoryDetail.voice}</span>}
          </div>
          <div className="space-y-2">
            {showHistoryDetail.results.map((res, i) => (
              <div key={i} className={clsx("p-3 rounded-xl", res.isCorrect ? "bg-green-50" : "bg-red-50")}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={clsx("text-2xl font-bold", res.isCorrect ? "text-green-600" : "text-red-600")}>{res.char}</span>
                    <div className="text-xs text-slate-500"><div>目标: {res.expectedPinyin}</div>{res.actualPinyin && <div>实际: {res.actualPinyin}</div>}</div>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className={res.initialScore >= 90 ? "text-green-600" : "text-red-600"}>声母{res.initialScore}%</span>
                    <span className={res.finalScore >= 90 ? "text-green-600" : "text-red-600"}>韵母{res.finalScore}%</span>
                    <span className={res.toneScore >= 90 ? "text-green-600" : "text-red-600"}>声调{res.toneScore}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <button onClick={() => { const content = ALL_CONTENT.find(c => c.id === showHistoryDetail.contentId); if (content) { handleSelectContent(content); setShowHistoryDetail(null); } }} className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium">重新练习</button>
            <button onClick={() => { deletePracticeRecord(showHistoryDetail.id); setHistoryRecords(getPracticeHistory()); setShowHistoryDetail(null); }} className="py-3 px-4 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-colors"><Trash2 className="w-5 h-5" /></button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4">
      <header className="w-full max-w-2xl mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><span className="bg-blue-600 text-white p-1 rounded-lg">Talk</span> Better</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">音色:</span>
            <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {VOICE_OPTIONS.map(voice => <option key={voice.id} value={voice.id}>{voice.name} ({voice.gender === 'female' ? '女' : '男'})</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">语速:</span>
            <select value={selectedSpeed} onChange={(e) => setSelectedSpeed(e.target.value)} className="text-sm border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {SPEED_OPTIONS.map(speed => <option key={speed.id} value={speed.id}>{speed.name}</option>)}
            </select>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="w-full max-w-2xl mb-6 flex gap-2">
        <button onClick={() => setViewMode('library')} className={clsx("flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2", viewMode === 'library' ? "bg-blue-600 text-white shadow-lg" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200")}><Library className="w-4 h-4" /> 内容库</button>
        <button onClick={() => setViewMode('practice')} disabled={!currentContent} className={clsx("flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2", viewMode === 'practice' ? "bg-blue-600 text-white shadow-lg" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200", !currentContent && "opacity-50 cursor-not-allowed")}><Mic className="w-4 h-4" /> 练习</button>
        <button onClick={() => setViewMode('history')} className={clsx("flex-1 py-3 px-4 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2", viewMode === 'history' ? "bg-blue-600 text-white shadow-lg" : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200")}><History className="w-4 h-4" /> 历史{historyRecords.length > 0 && <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{historyRecords.length > 99 ? '99+' : historyRecords.length}</span>}</button>
      </div>

      {viewMode === 'library' && renderLibraryView()}
      {viewMode === 'practice' && renderPracticeView()}
      {viewMode === 'history' && renderHistoryView()}
      {renderHistoryDetailModal()}

      {/* TTS Loading Modal */}
      {ttsLoading && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 min-w-[200px]">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-600 font-medium">{ttsLoadingText}</p>
          </div>
        </div>
      )}

      {/* Training Plan */}
      <div className="mt-12 max-w-2xl w-full">
        <h4 className="text-slate-800 font-bold mb-4 flex items-center gap-2"><BookOpen className="w-5 h-5 text-blue-600" /> 训练计划</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { step: 1, title: '听范读', desc: '点击喇叭图标听标准发音，观察拼音。' },
            { step: 2, title: '初次朗读', desc: '尝试完整朗读整段文字，获取发音反馈。' },
            { step: 3, title: '针对纠错', desc: '点击红色的错字听正确发音，并复述纠正。' },
            { step: 4, title: '全文复述', desc: '所有错误纠正后，重新挑战整段文字。' },
          ].map((s) => (
            <div key={s.step} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex gap-4">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 font-bold text-sm">{s.step}</div>
              <div><div className="font-bold text-slate-700 text-sm">{s.title}</div><p className="text-slate-500 text-xs mt-1 leading-relaxed">{s.desc}</p></div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}