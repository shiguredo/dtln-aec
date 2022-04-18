/// <reference types="dom-webcodecs" />
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
declare class DtlnAec {
    private interpreter1;
    private interpreter2;
    private states1;
    private states2;
    private statesShape1;
    private statesShape2;
    private inBuffer;
    private inBufferLpb;
    private outBuffer;
    private inBufferEnd;
    private timestamp;
    private constructor();
    /**
     * モデルをロードして {@link DtlnAec} インスタンスを生成する
     */
    static loadModel(assetsPath: string, options?: DtlnAecOptions): Promise<DtlnAec>;
    /**
     * スピーカに出力される（i.e., キャンセル対象となる）音声データを処理する
     *
     * 引数で与えられた音声データは参照されるのみで、中身が更新されることはない
     */
    processOutputAudioData(data: AudioData): void;
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
    processInputAudioData(data: AudioData): AudioData[];
    private getSamplesFromAudioData;
    private processInBuffer;
}
export { DtlnAec, DtlnAecOptions };
