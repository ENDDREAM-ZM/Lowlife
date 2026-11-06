#!/usr/bin/env bash
# ---------------------------------------------------------------
# Lowlife APK 构建脚本
#   输入：apk/src、apk/res、apk/AndroidManifest.xml、../webroot、../bin ...
#   输出：dist/Lowlife-vX.Y.apk
# 说明：使用 aapt(v1) + javac + d8 + zipalign + apksigner 的经典流程，
#       不依赖 Gradle，可在 arm64 Linux 上直接构建。
# ---------------------------------------------------------------
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
BUILD="$HERE/build"
DIST="$ROOT/dist"

VERSION="$(grep -m1 '^versionCode=' "$ROOT/module.prop" | cut -d= -f2)"
VERSION_NAME="$(grep -m1 '^version=' "$ROOT/module.prop" | cut -d= -f2 | tr -d 'v')"
APK_NAME="Lowlife-v${VERSION_NAME}.apk"

SDK="${ANDROID_HOME:-/root/android-sdk}"
ANDROID_JAR="$SDK/platforms/android-34/android.jar"
D8_JAR="$SDK/build-tools/34.0.0/lib/d8.jar"
APKSIGNER_JAR="$SDK/build-tools/34.0.0/lib/apksigner.jar"
# 签名密钥不入库，通过环境变量提供（见 README「自行构建」）
KS="${LOWLIFE_KS:-$HERE/keystore/lowlife.jks}"
KS_PASS="${LOWLIFE_KS_PASS:-}"
KEY_ALIAS="${LOWLIFE_KS_ALIAS:-lowlife}"

for f in "$ANDROID_JAR" "$D8_JAR" "$APKSIGNER_JAR"; do
    [ -f "$f" ] || { echo "缺少构建依赖: $f" >&2; exit 1; }
done
command -v aapt >/dev/null || { echo "缺少 aapt（apt install aapt）" >&2; exit 1; }
command -v zipalign >/dev/null || { echo "缺少 zipalign（apt install zipalign）" >&2; exit 1; }

echo "==> 清理"
rm -rf "$BUILD"
mkdir -p "$BUILD/gen" "$BUILD/classes" "$BUILD/dex" "$BUILD/assets" "$DIST"

echo "==> 同步资源到 APK assets"
cp -a "$ROOT/webroot" "$BUILD/assets/webroot"
mkdir -p "$BUILD/assets/module"
cp -a "$ROOT/module.prop" "$ROOT/service.sh" "$ROOT/customize.sh" "$ROOT/bin" "$BUILD/assets/module/"

echo "==> 生成 R.java"
aapt package -f -m \
    -J "$BUILD/gen" \
    -M "$HERE/AndroidManifest.xml" \
    -S "$HERE/res" \
    -I "$ANDROID_JAR" \
    --min-sdk-version 24 \
    --target-sdk-version 34

echo "==> 编译 Java"
find "$HERE/src" "$BUILD/gen" -name '*.java' > "$BUILD/sources.txt"
javac -nowarn -source 8 -target 8 -encoding UTF-8 \
    -bootclasspath "$ANDROID_JAR" \
    -d "$BUILD/classes" \
    @"$BUILD/sources.txt" 2>&1 | grep -v 'bootstrap class path' || true

echo "==> 生成 classes.dex"
java -cp "$D8_JAR" com.android.tools.r8.D8 \
    --release --min-api 24 --lib "$ANDROID_JAR" \
    --output "$BUILD/dex" \
    $(find "$BUILD/classes" -name '*.class')

echo "==> 打包资源"
aapt package -f \
    -M "$HERE/AndroidManifest.xml" \
    -S "$HERE/res" \
    -A "$BUILD/assets" \
    -I "$ANDROID_JAR" \
    --min-sdk-version 24 \
    --target-sdk-version 34 \
    -F "$BUILD/unsigned.apk"

echo "==> 写入 classes.dex"
( cd "$BUILD/dex" && aapt add "$BUILD/unsigned.apk" classes.dex >/dev/null )

echo "==> 对齐"
zipalign -f -p 4 "$BUILD/unsigned.apk" "$BUILD/aligned.apk"

if [ -z "$KS_PASS" ]; then
    echo "缺少密钥库密码：请先 export LOWLIFE_KS_PASS=你的密码" >&2
    exit 1
fi
if [ ! -f "$KS" ]; then
    cat >&2 <<'TIP'
找不到签名密钥库。请在你自己的机器上生成（不要提交到仓库）：

  keytool -genkeypair -keystore ~/lowlife-release.jks \
    -alias lowlife -keyalg RSA -keysize 4096 -validity 10950 \
    -storepass "$LOWLIFE_KS_PASS" -keypass "$LOWLIFE_KS_PASS" \
    -dname "CN=Lowlife, OU=ENDDREAM, O=ENDDREAM, L=CN, ST=CN, C=CN"

然后：
  export LOWLIFE_KS=~/lowlife-release.jks
  export LOWLIFE_KS_PASS=你的密码
TIP
    exit 1
fi

echo "==> 签名"
java -jar "$APKSIGNER_JAR" sign \
    --ks "$KS" --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
    --ks-key-alias "$KEY_ALIAS" \
    --v1-signing-enabled true --v2-signing-enabled true \
    --out "$DIST/$APK_NAME" "$BUILD/aligned.apk"

echo "==> 校验"
java -jar "$APKSIGNER_JAR" verify --print-certs "$DIST/$APK_NAME" | head -5
zipalign -c -p 4 "$DIST/$APK_NAME" && echo "对齐校验通过"

echo
echo "构建完成: $DIST/$APK_NAME  ($(du -h "$DIST/$APK_NAME" | cut -f1))"
