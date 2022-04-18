#! /bin/bash

set -eux

mkdir -p dist/

for model_name in $(echo dtln_aec_{128,256,512}_{1,2}.tflite)
do
  curl -L https://github.com/breizhn/DTLN-aec/raw/main/pretrained_models/${model_name} -o dist/${model_name}
done
