import * as tf from "@tensorflow/tfjs-core";
import * as tflite from "@tensorflow/tfjs-tflite";

// DTLN-aec のモデルが一度に処理するデータの単位（サンプル数）
const BLOCK_LEN = 512; // 32ms (16khz)

// DTLN-aec のモデルの一度の適用後に得られる（再生に使える）出力データの単位（サンプル数）
const BLOCK_SHIFT = 128; // 8ms (16khz)

/**
 * {@link DtlnAec} 用のオプション
 */
interface DtlnAecOptions {
  /**
   * 使用するモデルの名前
   *
   * 学習済みのモデルとしては "dtln_aec_128"（デフォルト）、"dtln_aec_256"、"dtln_aec_512" が存在する
   */
  modelName?: string;
}

/**
 * DTLN-aec を用いた音声のエコーキャンセルを行うためのクラス
 *
 * 現在はモノラルチャンネルのみをサポートしている。
 * また、サンプリングレートは 48kHz ないし 16kHz のみに対応（前者の場合は 16kHz にダウンサンプリングされる）。
 */
class DtlnAec {
  private interpreter1: tflite.TFLiteModel;
  private interpreter2: tflite.TFLiteModel;
  private states1: Float32Array;
  private states2: Float32Array;
  private statesShape1: number[];
  private statesShape2: number[];
  private inBuffer: Float32Array;
  private inBufferLpb: Float32Array;
  private outBuffer: Float32Array;
  private inBufferEnd: number;
  private timestamp: number;

  private constructor(interpreter1: tflite.TFLiteModel, interpreter2: tflite.TFLiteModel) {
    this.interpreter1 = interpreter1;
    this.interpreter2 = interpreter2;

    if (interpreter1.inputs[1].shape === undefined) {
      throw Error("Failed to get an output shape of the DTLN aec model 1.");
    }
    this.statesShape1 = interpreter1.inputs[1].shape;

    if (interpreter2.inputs[1].shape === undefined) {
      throw Error("Failed to get an output shape of the DTLN aec model 2.");
    }
    this.statesShape2 = interpreter2.inputs[1].shape;

    this.states1 = new Float32Array(this.statesShape1.reduce((a, b) => a * b));
    this.states2 = new Float32Array(this.statesShape2.reduce((a, b) => a * b));
    this.inBuffer = new Float32Array(BLOCK_LEN);
    this.inBufferLpb = new Float32Array(BLOCK_LEN);
    this.outBuffer = new Float32Array(BLOCK_LEN);
    this.inBufferEnd = BLOCK_LEN - BLOCK_SHIFT;
    this.timestamp = 0;
  }

  /**
   * モデルをロードして {@link DtlnAec} インスタンスを生成する
   */
  static async loadModel(assetsPath: string, options: DtlnAecOptions = {}): Promise<DtlnAec> {
    if (!assetsPath.endsWith("/")) {
      assetsPath += "/";
    }
    let modelName = options.modelName;
    if (modelName == undefined) {
      modelName = "dtln_aec_128";
    }
    const interpreter1 = await tflite.loadTFLiteModel(assetsPath + modelName + "_1.tflite");
    const interpreter2 = await tflite.loadTFLiteModel(assetsPath + modelName + "_2.tflite");
    return new DtlnAec(interpreter1, interpreter2);
  }

  /**
   * スピーカに出力される（i.e., キャンセル対象となる）音声データを処理する
   *
   * 引数で与えられた音声データは参照されるのみで、中身が更新されることはない
   */
  processOutputAudioData(data: AudioData) {
    const buffer = this.getSamplesFromAudioData(data);
    this.inBufferLpb.copyWithin(0, buffer.length);
    this.inBufferLpb.set(buffer, BLOCK_LEN - buffer.length);
  }

  /**
   * マイクから入力された音声データにエコーキャンセル処理を適用する
   *
   * 処理結果の音声データは返り値で返される
   *
   * 入力音声からは {@link DtlnAec.processOutputAudioData()} に含まれる成分が
   * エコーとして除去されることになるが、それとは別にノイズ抑制処理も適用される
   *
   * エコーキャンセル処理によって 30ms~40ms 程度のバッファリング遅延が発生する
   */
  processInputAudioData(data: AudioData): AudioData[] {
    // 入力データの取得
    const tmpBuffer = this.getSamplesFromAudioData(data);

    // キリが良い場合にはタイムスタンプをリセット
    if (this.inBufferEnd === BLOCK_LEN - BLOCK_SHIFT) {
      this.timestamp = data.timestamp;
    }

    // BLOCK_SHIFT 単位でデータを処理する
    const processedAudioDataList = [];
    let tmpBufferOffset = 0;
    while (tmpBufferOffset < tmpBuffer.length) {
      const n = Math.min(BLOCK_LEN - this.inBufferEnd, tmpBuffer.length - tmpBufferOffset);
      this.inBuffer.set(tmpBuffer.subarray(tmpBufferOffset, tmpBufferOffset + n), this.inBufferEnd);
      tmpBufferOffset += n;
      this.inBufferEnd += n;
      if (this.inBufferEnd === BLOCK_LEN) {
        // 必要なデータがバッファに溜まったので、AEC を適用して一つ分の AudioData を生成
        const processedData = this.processInBuffer();
        processedAudioDataList.push(
          new AudioData({
            format: data.format,
            sampleRate: 16000,
            numberOfFrames: BLOCK_SHIFT,
            numberOfChannels: 1,
            timestamp: this.timestamp,
            data: processedData,
          })
        );
        this.timestamp += 8000; // 8ms

        this.inBuffer.copyWithin(0, BLOCK_SHIFT);
        this.inBufferEnd = BLOCK_LEN - BLOCK_SHIFT;
      }
    }

    return processedAudioDataList;
  }

  private getSamplesFromAudioData(data: AudioData): Float32Array {
    if (data.numberOfChannels !== 1) {
      throw Error("Stereo channel has not been supported yet.");
    }

    // 入力データの準備
    let tmpBuffer = new Float32Array(data.numberOfFrames);
    data.copyTo(tmpBuffer, { planeIndex: 0 });

    if (data.sampleRate == 16000) {
      // 何もしない
    } else if (data.sampleRate == 48000) {
      // ダウンサンプリングする
      const tmpDownsampledBuffer = new Float32Array(data.numberOfFrames / 3);
      for (const [i, v] of tmpBuffer.entries()) {
        if (i % 3 != 0) {
          continue;
        }
        tmpDownsampledBuffer[i / 3] = v;
      }
      tmpBuffer = tmpDownsampledBuffer;
    } else {
      throw Error(`Unsupported sampling rate: ${data.sampleRate}`);
    }

    return tmpBuffer;
  }

  private processInBuffer(): Float32Array {
    const outBlock = tf.tidy(() => {
      // inBuffer とinBufferLpb に対して FFT を適用して周波数成分に変換
      const inBlockFft = tf.spectral.rfft(tf.tensor1d(this.inBuffer));
      const inMag = tf.reshape(tf.abs(inBlockFft), [1, 1, -1]);

      const lpbBlockFft = tf.spectral.rfft(tf.tensor1d(this.inBufferLpb));
      const lpbMag = tf.reshape(tf.abs(lpbBlockFft), [1, 1, -1]);

      // 周波数成分に対して、一つ目のモデルで推論を実行
      const output1 = this.interpreter1.predict([
        inMag,
        tf.reshape(this.states1, this.statesShape1),
        lpbMag,
      ]) as tf.NamedTensorMap;
      const outMask = output1.Identity;
      this.states1 = Float32Array.from(output1.Identity_1.dataSync());

      // 得られたマスクを適用した上で波形に戻す
      const estimatedBlock = tf.irfft(tf.mul(inBlockFft, outMask));

      // 波形に対して、二つ目のモデルで推論を実行
      const inLpb = tf.reshape(this.inBufferLpb, [1, 1, -1]);
      const output2 = this.interpreter2.predict([
        estimatedBlock,
        tf.reshape(this.states2, this.statesShape2),
        inLpb,
      ]) as tf.NamedTensorMap;
      const outBlock = Float32Array.from(output2.Identity.dataSync());
      this.states2 = Float32Array.from(output2.Identity_1.dataSync());

      return outBlock;
    });

    // AEC 適用後の音声データを生成
    this.outBuffer.copyWithin(0, BLOCK_SHIFT);
    this.outBuffer.subarray(BLOCK_LEN - BLOCK_SHIFT).fill(0);
    for (const [i, v] of outBlock.entries()) {
      this.outBuffer[i] += v;
    }
    return this.outBuffer.slice(0, BLOCK_SHIFT);
  }
}

export { DtlnAec, DtlnAecOptions };
