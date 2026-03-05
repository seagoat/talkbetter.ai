'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Mic, Play, RotateCcw, ChevronRight, Volume2, AlertCircle, CheckCircle2, BookOpen } from 'lucide-react';
import { clsx } from 'clsx';
import { evaluatePronunciation, speakText, getPinyinList, type EvaluationResult, type TrainingSentence } from '@/lib/speech-utils';
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition as CapSpeechRecognition } from '@capacitor-community/speech-recognition';

type TrainingStep = 
  | 'INITIAL'             // Show text
  | 'COMPUTER_READING'    // PC reading
  | 'WAIT_FOR_USER'       // Prompt user to read
  | 'USER_READING'        // User is reading
  | 'EVALUATED'           // Show errors
  | 'FIXING_ERRORS'       // User repeating errors
  | 'REREADING_ALL'       // Re-read entire text after fixing errors
  | 'COMPLETED';          // Success

const SAMPLE_SENTENCES: TrainingSentence[] = [
  { id: '1', text: '床前明月光，疑是地上霜。', title: '静夜思', difficulty: 'easy', category: 'poem' },
  { id: '2', text: '举头望明月，低头思故乡。', title: '静夜思', difficulty: 'easy', category: 'poem' },
  { id: '3', text: '吃葡萄不吐葡萄皮，不吃葡萄倒吐葡萄皮。', difficulty: 'medium', category: 'tongue-twister' },
  { id: '4', text: '从前有座山，山里有座庙，庙里有个老和尚讲故事。', title: '讲故事', difficulty: 'easy', category: 'story' },
  { id: '5', text: '春眠不觉晓，处处闻啼鸟。', title: '春晓', difficulty: 'easy', category: 'poem' },
];

export default function Home() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [step, setStep] = useState<TrainingStep>('INITIAL');
  const [isRecording, setIsRecording] = useState(false);
  const [spokenText, setSpokenText] = useState('');
  const spokenTextRef = useRef('');
  useEffect(() => { spokenTextRef.current = spokenText; }, [spokenText]);

  const [evaluation, setEvaluation] = useState<EvaluationResult[] | null>(null);
  const [readingIndex, setReadingIndex] = useState(-1); // For highlighting PC reading
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [debugError, setDebugError] = useState<string>('');
  const [interimSpoken, setInterimSpoken] = useState('');
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setDebugLog(prev => [new Date().toLocaleTimeString() + ': ' + msg, ...prev].slice(0, 5));
  };

  const recognitionRef = useRef<any>(null);
  const currentSentence = SAMPLE_SENTENCES[currentIndex];

  const targetPinyinList = useMemo(() => {
    return getPinyinList(currentSentence.text);
  }, [currentSentence.text]);

  // Initialize recognition instance ONLY ONCE
  useEffect(() => {
    if (typeof window !== 'undefined' && !recognitionRef.current) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognitionRef.current = recognition;
      }
    }
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
    };
  }, []);

  // Bind dynamic event handlers that have access to the latest state
  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    recognition.onstart = () => {
      setIsRecording(true);
      setDebugError('');
    };
    
    recognition.onend = () => {
      setIsRecording(false);
    };
    
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      addLog('!!! 识别报错: ' + event.error);
      setIsRecording(false);
      let friendlyMsg = '无法识别声音。';
      if (event.error === 'not-allowed') friendlyMsg = '请点击允许麦克风访问。';
      if (event.error === 'network') friendlyMsg = '网络连接不稳定，请重试。';
      setFeedbackMessage(friendlyMsg);
      setDebugError(`系统错误代码: ${event.error}`);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        setSpokenText(prev => prev + finalTranscript);
      }
      setInterimSpoken(interimTranscript);

      // Use the fresh `spokenText` from closure + new transcripts
      const currentTotalSpoken = spokenText + finalTranscript + interimTranscript;
      const matchResults = evaluatePronunciation(currentSentence.text, currentTotalSpoken);
      
      setEvaluation(prev => {
        if (!prev || step === 'REREADING_ALL') return matchResults;
        return matchResults.map((res, idx) => {
          if (prev[idx] && prev[idx].isCorrect) return prev[idx];
          return res;
        });
      });
    };
  }, [spokenText, step, currentSentence.text]); // Refresh handlers when these states change

  const handleNext = () => {
    if (currentIndex < SAMPLE_SENTENCES.length - 1) {
      setCurrentIndex(prev => prev + 1);
      resetState();
    } else {
      setStep('COMPLETED');
      setFeedbackMessage('🎊 恭喜！您已完成所有训练！');
    }
  };

  const resetState = () => {
    setStep('INITIAL');
    setEvaluation(null);
    setSpokenText('');
    setInterimSpoken('');
    setFeedbackMessage('');
    setReadingIndex(-1);
  };

  const handleStartComputerRead = () => {
    setStep('COMPUTER_READING');
    speakText(
      currentSentence.text, 
      (idx) => setReadingIndex(idx),
      () => {
        setReadingIndex(-1);
        setStep('WAIT_FOR_USER');
        setFeedbackMessage('请开始朗读这段文字');
      }
    );
  };

  const handleStartUserRead = async () => {
    if (isRecording) return;
    addLog('--- 启动流程开始 ---');
    
    // Check/Request Permissions for Native App
    if (Capacitor.isNativePlatform()) {
      try {
        addLog('1. 正在检查权限...');
        const status = await CapSpeechRecognition.checkPermissions();
        addLog('权限详情: ' + JSON.stringify(status));
        
        const isGranted = status.speechRecognition === 'granted';
        
        if (!isGranted) {
          addLog('2. 权限不足，正在申请...');
          const newStatus = await CapSpeechRecognition.requestPermissions();
          addLog('申请结果: ' + JSON.stringify(newStatus));
          if (newStatus.speechRecognition !== 'granted') {
            setFeedbackMessage('请开启麦克风权限');
            return;
          }
        }

        addLog('3. 检查可用性...');
        const availRes = await CapSpeechRecognition.available();
        addLog('可用性: ' + availRes.available);
        
        if (!availRes.available) {
          setFeedbackMessage('当前设备不支持语音识别，请安装 Google 应用或检查系统设置');
          setIsRecording(false);
          return;
        }
        
        try {
          const langRes = await CapSpeechRecognition.getSupportedLanguages();
          addLog('支持语言: ' + langRes.languages.slice(0, 5).join(','));
          if (!langRes.languages.includes('zh-CN')) {
             addLog('警告: 系统可能不支持 zh-CN');
          }
        } catch(e) {
          addLog('获取语言失败(可忽略)');
        }

        setIsRecording(true); 
        if (step !== 'FIXING_ERRORS' && step !== 'REREADING_ALL') {
          setSpokenText('');
          setInterimSpoken('');
          setEvaluation(null);
          setStep('USER_READING');
        }

        addLog('4. 准备 Web 识别引擎...');
        
        // --- NEW: Trigger WebView/Browser Permission ---
        try {
          addLog('正在尝试唤起麦克风弹窗...');
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop()); // Immediately stop it
          addLog('成功获取录音流授权');
        } catch (e: any) {
          addLog('! 无法获取录音授权: ' + e.message);
          setFeedbackMessage('请允许麦克风权限以开始练习');
          setIsRecording(false);
          return;
        }

        // Ensure web recognition is ready
        if (!recognitionRef.current) {
          const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
          if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.lang = 'zh-CN';
            recognition.continuous = true;
            recognition.interimResults = true;
            recognitionRef.current = recognition;
          }
        }

        // Common result handler for fallback
        const handleRecognitionData = (data: any) => {
          const matches = data.matches || data.value || data.results || [];
          if (matches.length > 0) {
            const transcript = matches[0];
            setInterimSpoken(transcript);
            
            const matchResults = evaluatePronunciation(currentSentence.text, spokenTextRef.current + transcript);
            setEvaluation(prev => {
              if (!prev || step === 'REREADING_ALL') return matchResults;
              return matchResults.map((res, idx) => (prev[idx] && prev[idx].isCorrect) ? prev[idx] : res);
            });
          }
        };

        addLog('5. 启动 Web 引擎 (静默模式)...');
        try {
          recognitionRef.current?.start();
          setIsRecording(true);
          addLog('--- Web 引擎启动命令已发出 ---');
        } catch (e: any) {
          addLog('Web 引擎启动失败，尝试原生兜底: ' + e.message);
          
          await CapSpeechRecognition.addListener('partialResults', handleRecognitionData);
          await CapSpeechRecognition.start({
            language: 'zh-CN',
            maxResults: 2,
            partialResults: true,
            popup: false, 
          });
          setIsRecording(true);
        }
      } catch (e: any) {
        setIsRecording(false);
      }
    } else {
      // WEB START (Fallback)
      try {
        recognitionRef.current?.start();
      } catch(e) {
        console.warn("Recognition already started or failed to start", e);
      }
    }
  };

  const handleStopUserRead = async () => {
    // 1. Immediately reset recording state in UI
    setIsRecording(false);
    addLog('正在停止录音...');

    // Stop Native Engine if it's running
    if (Capacitor.isNativePlatform()) {
      try {
        await CapSpeechRecognition.stop();
        addLog('原生引擎已发出 Stop 命令');
      } catch (e: any) {
        // Safe to ignore if native was never started
      }
    }

    // Stop Web Engine if it's running
    try {
      recognitionRef.current?.stop();
      addLog('Web 引擎已发出 Stop 命令');
    } catch (e: any) {
      // Safe to ignore
    }

    // Use timeout to allow the last set of results to arrive
    setTimeout(async () => {
      setSpokenText(prev => prev + interimSpoken);
      setInterimSpoken('');
      
      if (Capacitor.isNativePlatform()) {
        try {
          await CapSpeechRecognition.removeAllListeners();
        } catch(e) {}
      }
      
      addLog('停止流程完成');
    }, 400);

    setIsRecording(false);
  };

  const evaluationRef = useRef<EvaluationResult[] | null>(null);
  useEffect(() => { evaluationRef.current = evaluation; }, [evaluation]);

  const stepRef = useRef<TrainingStep>(step);
  useEffect(() => { stepRef.current = step; }, [step]);

  const processFinalEvaluation = () => {
    const currentEval = evaluationRef.current;
    const currentStep = stepRef.current;

    if (!currentEval) return;
    
    const allCorrect = currentEval.every(r => r.isCorrect);
    
    if (allCorrect) {
      if (currentStep === 'REREADING_ALL') {
        setStep('COMPLETED');
        setFeedbackMessage('🎉 太棒了！完美发音，顺利通过！');
      } else if (currentStep === 'EVALUATED' || currentStep === 'FIXING_ERRORS' || currentStep === 'USER_READING') {
        // Give it a brief moment so the user sees the final green highlight
        setTimeout(() => {
          setStep('REREADING_ALL');
          setFeedbackMessage('很好，现在请重新完整朗读一遍。');
          setSpokenText('');
          setInterimSpoken('');
          setEvaluation(currentSentence.text.split('').map((char, idx) => ({
             char,
             isCorrect: false,
             expectedPinyin: targetPinyinList[idx],
          })));
        }, 1500);
      }
    } else {
      if (currentStep === 'USER_READING' || currentStep === 'REREADING_ALL') {
        setStep('FIXING_ERRORS');
        setFeedbackMessage('发现发音错误，请针对红色部分进行复述。');
      }
    }
  };

  useEffect(() => {
    // Only process the final evaluation state transition when recording actually stops
    if (!isRecording && (step === 'USER_READING' || step === 'REREADING_ALL' || step === 'FIXING_ERRORS')) {
       // Add a tiny delay to ensure React state has settled before transitioning
       const timer = setTimeout(processFinalEvaluation, 300);
       return () => clearTimeout(timer);
    }
  }, [isRecording]); // Deliberately only depending on isRecording to trigger the check

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4">
      <header className="w-full max-w-2xl mb-8 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <span className="bg-blue-600 text-white p-1 rounded-lg">Talk</span> Better
        </h1>
        <div className="text-sm text-slate-500">
          进度: {currentIndex + 1} / {SAMPLE_SENTENCES.length}
        </div>
      </header>

      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        <div className="p-8 md:p-12">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="text-xs font-medium text-blue-600 tracking-wider uppercase mb-1">
                {currentSentence.category === 'poem' ? '唐诗鉴赏' : currentSentence.category === 'story' ? '小故事' : '日常练习'}
              </div>
              <h3 className="text-xl font-bold text-slate-800">{currentSentence.title || '朗读练习'}</h3>
            </div>
            <div className={clsx(
              "px-3 py-1 rounded-full text-xs font-semibold",
              currentSentence.difficulty === 'easy' ? "bg-green-100 text-green-700" : 
              currentSentence.difficulty === 'medium' ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"
            )}>
              {currentSentence.difficulty.toUpperCase()}
            </div>
          </div>
          
          <div className="mb-10 flex flex-wrap gap-x-4 gap-y-8 justify-center min-h-[160px]">
            {currentSentence.text.split('').map((char, idx) => {
              if (/[^\u4e00-\u9fa5]/.test(char)) return <span key={idx} className="self-end text-2xl text-slate-400 mx-1">{char}</span>;
              
              const evalRes = evaluation ? evaluation[idx] : null; 
              const isCurrentReading = readingIndex === idx;
              const isCorrect = evalRes?.isCorrect;
              const isError = evalRes && !evalRes.isCorrect && (step === 'FIXING_ERRORS' || step === 'REREADING_ALL' || step === 'COMPLETED');
              
              return (
                <div 
                  key={idx} 
                  className={clsx(
                    "flex flex-col items-center transition-all duration-200 p-2 rounded-xl cursor-pointer hover:bg-slate-50",
                    isCurrentReading && "bg-blue-50 scale-110",
                    isError && "bg-red-50",
                    isCorrect && (step === 'USER_READING' || step === 'REREADING_ALL') && "bg-green-50"
                  )}
                  onClick={() => speakText(char)}
                >
                  <span className={clsx(
                    "text-xs mb-1 font-mono text-slate-400",
                    isError && "text-red-500 font-bold"
                  )}>
                    {targetPinyinList[idx]}
                  </span>
                  <span className={clsx(
                    "text-4xl font-bold transition-colors",
                    isCurrentReading ? "text-blue-600" : "text-slate-800",
                    isError ? "text-red-500 border-b-2 border-red-500" : (isCorrect ? "text-green-600" : "")
                  )}>
                    {char}
                  </span>
                  {isError && (
                    <div className="mt-2 text-[10px] text-red-400 flex items-center gap-1">
                      <Volume2 className="w-3 h-3" /> 点击听
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="h-12 mb-8 flex justify-center items-center text-center">
            {feedbackMessage && (
              <div className={clsx(
                "inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-medium animate-in fade-in slide-in-from-bottom-2",
                feedbackMessage.includes('🎉') ? "bg-green-100 text-green-700 shadow-sm" : 
                feedbackMessage.includes('发现') ? "bg-red-100 text-red-700 shadow-sm" : "bg-blue-100 text-blue-700 shadow-sm"
              )}>
                {feedbackMessage.includes('🎉') ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                {feedbackMessage}
              </div>
            )}
          </div>

          {(step === 'USER_READING' || step === 'REREADING_ALL' || step === 'FIXING_ERRORS') && (
            <div className="mb-8 p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase mb-2">
                <Mic className="w-3 h-3" /> {isRecording ? '正在聆听...' : '准备就绪'}
              </div>
              <p className="text-slate-600 min-h-[1.5rem]">
                {spokenText}<span className="text-blue-400">{interimSpoken}</span>
              </p>
            </div>
          )}

          {/* DEBUG PANEL */}
          {evaluation && (
            <div className="mb-8 p-4 bg-slate-900 rounded-2xl border border-slate-800 overflow-x-auto">
              <div className="text-xs font-bold text-slate-400 uppercase mb-2 flex justify-between">
                <span>Debug: 评估数据明细</span>
                <span>步骤: {step}</span>
              </div>
              <table className="w-full text-left text-xs text-slate-300 font-mono">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="pb-2">字符</th>
                    <th className="pb-2">状态</th>
                    <th className="pb-2">目标拼音</th>
                    <th className="pb-2">实际识别字</th>
                    <th className="pb-2">实际拼音</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluation.map((res, i) => (
                    <tr key={i} className={res.isCorrect ? "text-green-400" : "text-red-400"}>
                      <td className="py-1">{res.char}</td>
                      <td className="py-1">{res.isCorrect ? '✅' : '❌'}</td>
                      <td className="py-1">{res.expectedPinyin}</td>
                      <td className="py-1">{res.actualChar || '-'}</td>
                      <td className="py-1">{res.actualPinyin || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center justify-center gap-8">
              {(step === 'INITIAL' || step === 'COMPUTER_READING' || step === 'WAIT_FOR_USER') && (
                <button 
                  onClick={handleStartComputerRead}
                  disabled={step === 'COMPUTER_READING'}
                  className={clsx(
                    "flex flex-col items-center gap-2 group",
                    step === 'COMPUTER_READING' ? "opacity-50" : "opacity-100"
                  )}
                >
                  <div className="p-6 rounded-3xl bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-md group-hover:shadow-blue-200 active:scale-95">
                    <Volume2 className={clsx("w-8 h-8", step === 'COMPUTER_READING' && "animate-bounce")} />
                  </div>
                  <span className="text-xs font-bold text-slate-400">听示范</span>
                </button>
              )}

              {(step === 'WAIT_FOR_USER' || step === 'USER_READING' || step === 'REREADING_ALL' || step === 'FIXING_ERRORS') && (
                <button
                  onClick={isRecording ? handleStopUserRead : handleStartUserRead}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className={clsx(
                    "p-8 rounded-full shadow-lg transition-all active:scale-95 border-8",
                    isRecording 
                      ? "bg-red-500 text-white border-red-200 scale-110 shadow-red-200" 
                      : "bg-blue-600 text-white border-blue-100 shadow-blue-200 hover:bg-blue-700"
                  )}>
                    <Mic className={clsx("w-10 h-10", isRecording && "animate-pulse")} />
                  </div>
                  <span className="text-xs font-bold text-slate-400">{isRecording ? '停止' : '开始朗读'}</span>
                </button>
              )}

              {(step === 'COMPLETED') && (
                <button 
                  onClick={handleNext}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div className="p-6 rounded-3xl bg-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-md group-hover:shadow-indigo-200 active:scale-95">
                    <ChevronRight className="w-8 h-8" />
                  </div>
                  <span className="text-xs font-bold text-slate-400">下一篇</span>
                </button>
              )}
            </div>
            
            <button 
              onClick={resetState}
              className="text-slate-400 hover:text-slate-600 flex items-center gap-1 text-sm font-medium"
            >
              <RotateCcw className="w-4 h-4" /> 重新开始
            </button>
          </div>
        </div>
      </div>

      {/* DEBUG LOG PANEL */}
      {debugLog.length > 0 && (
        <div className="mt-4 w-full max-w-2xl bg-black/80 text-white p-4 rounded-xl text-[10px] font-mono">
          <div className="flex justify-between items-center mb-2 border-b border-white/20 pb-1">
            <span>Runtime Logs (Android Debug)</span>
            <button onClick={() => { setIsRecording(false); addLog('UI 状态强制重置'); }} className="bg-red-500 px-2 rounded">Force UI Reset</button>
          </div>
          {debugLog.map((log, i) => <div key={i}>{log}</div>)}
        </div>
      )}

      <div className="mt-12 max-w-2xl w-full">
        <h4 className="text-slate-800 font-bold mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-600" /> 训练计划
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { step: 1, title: '听范读', desc: '点击喇叭图标听标准发音，观察拼音。' },
            { step: 2, title: '初次朗读', desc: '尝试完整朗读整段文字，获取发音反馈。' },
            { step: 3, title: '针对纠错', desc: '点击红色的错字听正确发音，并复述纠正。' },
            { step: 4, title: '全文复述', desc: '所有错误纠正后，重新挑战整段文字。' },
          ].map((s) => (
            <div key={s.step} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex gap-4">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 font-bold text-sm">
                {s.step}
              </div>
              <div>
                <div className="font-bold text-slate-700 text-sm">{s.title}</div>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
