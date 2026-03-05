import { evaluatePronunciation } from './lib/speech-utils';
const res = evaluatePronunciation('床前明月光，疑是地上霜。', '床前明月光疑是地上霜');
console.log(JSON.stringify(res, null, 2));