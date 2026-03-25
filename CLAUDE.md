# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TalkBetter.ai is a Mandarin pronunciation training web application with cross-platform mobile support. Built with Next.js 16 and React 19, it uses real-time speech recognition to help users improve their Mandarin pronunciation through interactive exercises.

## Key Commands

### Development
- `npm run dev` - Start Next.js development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run static` - Build static export (for Capacitor mobile deployment)

### Mobile Development (Capacitor Android)
- `npm run cap-add-android` - Add Android platform to Capacitor project
- `npm run cap-sync` - Sync web build to native Android project
- `npm run cap-open-android` - Open Android Studio with the project

## Architecture

### Core Components
- **Main Page**: `app/page.tsx` - Contains all UI and state management for the training interface
- **Speech Utilities**: `lib/speech-utils.ts` - Handles pronunciation evaluation, text-to-speech, and pinyin conversion

### Training Flow
The app follows a multi-step training process:
1. **INITIAL** - Display text and instructions
2. **COMPUTER_READING** - TTS reads the text with character highlighting
3. **WAIT_FOR_USER** - Prompt user to read
4. **USER_READING** - Capture and evaluate user speech
5. **EVALUATED** - Show evaluation results
6. **FIXING_ERRORS** - User repeats incorrectly pronounced characters
7. **REREADING_ALL** - User reads entire text again after corrections
8. **COMPLETED** - Training complete for this exercise

### Speech Recognition Handling
- Uses Web Speech API for browsers
- Falls back to Capacitor's speech recognition plugin on Android
- Handles permission requests for microphone access
- Provides real-time interim results and evaluation feedback

### Key Features
- **Real-time Pronunciation Evaluation**: Compares user speech with target text using pinyin matching
- **Character-Level Feedback**: Shows correct/incorrect pronunciation per character with color coding
- **Progressive Training**: Users must fix errors before proceeding
- **Cross-Platform**: Works in browsers and as a native Android app

### Dependencies
- `pinyin-pro`: Converts Chinese characters to pinyin for pronunciation evaluation
- `@capacitor-community/speech-recognition`: Native speech recognition on mobile
- `@capacitor-community/text-to-speech`: Native TTS with character highlighting
- `framer-motion`: UI animations
- `tailwind-merge`: Combines Tailwind CSS classes safely

### Path Aliases
- `@/*` refers to the project root (configured in `tsconfig.json`)

### Important Implementation Notes
- The app uses a single-page approach with complex state management in the main component
- Speech recognition is initialized once and reused throughout the session
- Platform detection (`Capacitor.isNativePlatform()`) determines which speech API to use
- Debug logging is available in development mode for troubleshooting speech recognition issues