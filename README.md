# TalkBetter.ai - 汉语口语发音训练助手

TalkBetter.ai 是一款现代化的互动式汉语口语训练应用，旨在通过实时的语音识别和智能拼音评估，帮助用户纠正和提升普通话发音。

[![Web](https://img.shields.io/badge/Platform-Web-blue.svg)]()
[![Android](https://img.shields.io/badge/Platform-Android-green.svg)]()
[![Next.js](https://img.shields.io/badge/Framework-Next.js%2016-black.svg)](https://nextjs.org/)
[![Capacitor](https://img.shields.io/badge/Mobile-Capacitor-blue.svg)](https://capacitorjs.com/)

## 🚀 核心功能

- **实时发音评估**：利用 Web Speech API 和 Capacitor 原生插件，实时捕捉用户语音并将其与目标文本进行比对。
- **智能拼音纠错**：基于 `pinyin-pro` 对发音进行字符级的拼音对齐，精准识别发音错误的字词。
- **互动式反馈**：
  - **视觉引导**：正确发音显示为绿色，错误发音显示为红色并标注拼音。
  - **示范朗读**：集成文本转语音 (TTS) 功能，提供标准发音示范。
- **循序渐进的训练计划**：
  1. **听范读**：观察拼音并聆听标准发音。
  2. **初次朗读**：获取全方位的发音反馈。
  3. **针对性纠错**：复述错误的字词。
  4. **全文复述**：挑战整段文字的完美发音。
- **多平台支持**：支持浏览器访问，并可通过 Capacitor 部署为原生 Android 应用。

## 🛠️ 技术栈

- **前端框架**: [Next.js](https://nextjs.org/) (React 19)
- **样式**: [Tailwind CSS](https://tailwindcss.com/)
- **语音识别**: Web Speech API & [@capacitor-community/speech-recognition](https://github.com/capacitor-community/speech-recognition)
- **语音合成**: Web Speech API & [@capacitor-community/text-to-speech](https://github.com/capacitor-community/text-to-speech)
- **拼音处理**: [pinyin-pro](https://github.com/zh-95/pinyin-pro)
- **动画**: [Framer Motion](https://www.framer.com/motion/)
- **图标**: [Lucide React](https://lucide.dev/)
- **跨平台技术**: [Capacitor](https://capacitorjs.com/)

## 📦 安装与运行

### 环境准备

- Node.js 18+
- Android Studio (用于 Android 开发)

### 本地开发

1. 克隆仓库：
   ```bash
   git clone https://github.com/seagoat/talkbetter.ai.git
   cd talkbetter.ai
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 启动开发服务器：
   ```bash
   npm run dev
   ```

### 移动端开发 (Android)

1. 构建静态文件：
   ```bash
   npm run static
   ```

2. 同步到 Android 项目：
   ```bash
   npx cap sync
   ```

3. 打开 Android Studio 运行：
   ```bash
   npx cap open android
   ```

## 📜 脚本说明

- `npm run dev`: 启动 Next.js 开发服务器。
- `npm run build`: 构建生产版本。
- `npm run static`: 构建静态导出版本（用于移动端部署）。
- `npm run cap-sync`: 同步 Web 资源到原生平台。

## 🤝 贡献

欢迎提交 Issue 或 Pull Request 来改进 TalkBetter.ai！

## 📄 开源协议

MIT License
