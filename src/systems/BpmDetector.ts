import { guess } from 'web-audio-beat-detector';

export interface BpmResult {
  bpm: number;
  offset: number; // Seconds until first beat
  confidence: 'high' | 'medium' | 'low';
}

export class BpmDetector {
  private static readonly MIN_BPM = 60;
  private static readonly MAX_BPM = 180;
  private static readonly DEFAULT_BPM = 90;

  /**
   * Detects BPM from an AudioBuffer
   */
  static async detect(audioBuffer: AudioBuffer): Promise<BpmResult> {
    try {
      const result = await guess(audioBuffer, {
        minTempo: BpmDetector.MIN_BPM,
        maxTempo: BpmDetector.MAX_BPM,
      });

      return {
        bpm: result.bpm,
        offset: result.offset,
        confidence: BpmDetector.calcConfidence(result.tempo, result.bpm),
      };
    } catch (error) {
      console.warn('BPM detection failed:', error);
      return {
        bpm: BpmDetector.DEFAULT_BPM,
        offset: 0,
        confidence: 'low',
      };
    }
  }

  /**
   * Calculate confidence based on how close the raw tempo is to the rounded BPM
   */
  private static calcConfidence(
    rawTempo: number,
    roundedBpm: number
  ): 'high' | 'medium' | 'low' {
    const diff = Math.abs(rawTempo - roundedBpm);
    if (diff < 0.5) return 'high';
    if (diff < 2) return 'medium';
    return 'low';
  }

  /**
   * Helper to fetch and decode audio from URL
   */
  static async getAudioBuffer(url: string): Promise<AudioBuffer> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioContext = new AudioContext();
    return await audioContext.decodeAudioData(arrayBuffer);
  }
}
