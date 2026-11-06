#!/usr/bin/env bash
# 一键构建 v3.0 全部产物：模块 zip + 独立 APK
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "########## 1/2 构建 KernelSU 模块 zip ##########"
bash "$ROOT/build-module.sh"

echo
echo "########## 2/2 构建独立 APK ##########"
bash "$ROOT/apk/build.sh"

echo
echo "########## 产物 ##########"
ls -lh "$ROOT/dist"
