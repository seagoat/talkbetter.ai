import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// Available Chinese voices for Edge TTS
const CHINESE_VOICES: Record<string, string> = {
  'xiaoxiao': 'zh-CN-XiaoxiaoNeural',
  'yunxi': 'zh-CN-YunxiNeural',
  'yunjian': 'zh-CN-YunjianNeural',
  'xiaoyi': 'zh-CN-XiaoyiNeural',
  'yunxia': 'zh-CN-YunxiaNeural',
  'xiaochen': 'zh-CN-XiaochenNeural',
};

const CACHE_DIR = path.join(process.cwd(), '.tts-cache');

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const text = searchParams.get('text');
  const voice = searchParams.get('voice') || 'xiaoxiao';
  const rate = searchParams.get('rate') || '-35%';

  if (!text) {
    return NextResponse.json({ error: 'Text is required' }, { status: 400 });
  }

  try {
    const voiceName = CHINESE_VOICES[voice] || CHINESE_VOICES['xiaoxiao'];
    const cacheKey = Buffer.from(`${text}-${voiceName}-${rate}`).toString('base64').replace(/[\/+=]/g, '_');
    const cachePath = path.join(CACHE_DIR, `${cacheKey}.mp3`);

    // Check if cached file exists
    if (fs.existsSync(cachePath)) {
      console.log('TTS Cache hit:', cachePath);
      const audioBuffer = fs.readFileSync(cachePath);
      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // Create Python script to generate audio
    const scriptContent = `
import edge_tts
import asyncio

async def main():
    communicate = edge_tts.Communicate(${JSON.stringify(text)}, "${voiceName}", rate="${rate}")
    await communicate.save("${cachePath.replace(/\\/g, '/')}")

asyncio.run(main())
`;

    const scriptPath = path.join(CACHE_DIR, `tts_script_${Date.now()}.py`);
    fs.writeFileSync(scriptPath, scriptContent);

    console.log('Running TTS script:', scriptPath);
    console.log('Text:', text);
    console.log('Voice:', voiceName);
    console.log('Rate:', rate);

    const { stdout, stderr } = await execAsync(`python "${scriptPath}"`, {
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 10
    });

    if (stderr && !stderr.includes('UserWarning')) {
      console.log('TTS stderr:', stderr);
    }

    // Clean up script
    try {
      fs.unlinkSync(scriptPath);
    } catch (e) {}

    if (!fs.existsSync(cachePath)) {
      throw new Error('Failed to generate audio file');
    }

    console.log('TTS file created:', cachePath, 'Size:', fs.statSync(cachePath).size);

    const audioBuffer = fs.readFileSync(cachePath);

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error: any) {
    console.error('TTS Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate speech', details: error.message },
      { status: 500 }
    );
  }
}