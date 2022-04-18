dtln-aec
========

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

[breizhn/DTLN-aec](https://github.com/breizhn/DTLN-aec) という深層学習ベースのエコーキャンセラを
JavaScript や TypeScript から利用するためのライブラリです。

## About Shiguredo's open source software

We will not respond to PRs or issues that have not been discussed on Discord. Also, Discord is only available in Japanese.

Please read https://github.com/shiguredo/oss/blob/master/README.en.md before use.

## 時雨堂のオープンソースソフトウェアについて

利用前 https://github.com/shiguredo/oss をお読みください。

## 使い方

JavaScript の場合には以下のコードのようになります:
```javascript
// モデルをロード
const assetsPath = "path/to/dist/";
const dtlnAec = new Shiguredo.DtlnAec.loadModel(assetsPath);

// キャンセル対象の音声を含む出力トラックを処理
const outputAudioTrack = ...;
const outputAudioGenerator = new MediaStreamTrackGenerator({ kind: "audio" });
const outputAudioProcessor = new MediaStreamTrackProcessor({ track: outputAudioTrack });
outputAudioProcessor.readable
    .pipeThrough(
        new TransformStream({
            transform: (data, controller) => {
                dtlnAec.processOutputAudioData(data);
                controller.enqueue(data);
            }
        }))
    .pipeTo(outputAudioGenerator.writable)
    .catch((e) => {
         console.log("Output stream transform stopped:", e);
    });

// 処理後の出力音声ストリームを取得（内容は特に変わっていない）
const outputAudioStream = new MediaStream([outputAudioGenerator]);

// エコーキャンセルの適用対象となる入力音声を処理　
navigator.mediaDevices.getUserMedia({audio: true}).then((stream) => {
    const inputAudioGenerator = new MediaStreamTrackGenerator({ kind: "audio" });
    const inputAudioProcessor = new MediaStreamTrackProcessor({ track: stream.getAudioTracks()[0] });
    inputAudioProcessor.readable
        .pipeThrough(
            new TransformStream({
                transform: (data, controller) => {
                    for (const processedData of dtlnAec.processInputAudioData(data)) {
                        controller.enqueue(processedData);
                    }
                    data.close();
              }
            }))
        .pipeTo(inputAudioGenerator.writable)
        .catch((e) => {
            console.log("Input stream transform stopped:", e);
        });

    // 処理後の入力音声ストリームを取得
    const inputAudioStream = new MediaStream([inputAudioGenerator]);
});
```

実際に動作するコードに関しては [examples/](examples/) 以下のデモファイルを参照してください。

Chromium ベースのブラウザの場合には、以下のページでデモを動作させることができます:
- [ダブルトーク時のエコーキャンセル (examples/double-talk-aec.html)](https://shiguredo.github.io/dtln-aec/examples/double-talk-aec.html)
- [自分の声をスピーカ出力した場合のハウリング抑制 (examples/howling-cancel.html)](https://shiguredo.github.io/dtln-aec/examples/howling-cancel.html)

## ライセンス

[Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)

```
Copyright 2022-2022, Takeru Ohta (Original Author)
Copyright 2022-2022, Shiguredo Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

### 深層学習モデルやランタイムのライセンス

`dist/` 以下に配置されている各種アセットファイルのライセンスについては、下記のリンク先を参照してください:
- 学習済みモデル（.tflite）:  [breizhn/DTLN-aec/LICENSE](https://github.com/breizhn/DTLN-aec/blob/main/LICENSE)
- モデルを動作させるランタイム（tfjs-lite の .js や .wasm）: [tensorflow/tfjs/LICENSE](https://github.com/tensorflow/tfjs)

### 音声ファイルのライセンス

デモページで使用している音声ファイルには [あみたろの声素材工房](https://amitaro.net/) 様の声素材を使用しています。
