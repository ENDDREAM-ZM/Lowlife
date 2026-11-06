#!/usr/bin/env bash
# 打包 KernelSU 模块 zip -> dist/Lowlife-vX.Y.zip
# 用 python3 打包，保证脚本权限位 755 被正确写入（KernelSU 安装时会校验）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
DIST="$ROOT/dist"
VERSION_NAME="$(grep -m1 '^version=' "$ROOT/module.prop" | cut -d= -f2 | tr -d 'v')"
ZIP_NAME="Lowlife-v${VERSION_NAME}.zip"

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

cp -a "$ROOT/module.prop" "$ROOT/customize.sh" "$ROOT/service.sh" "$ROOT/bin" "$ROOT/webroot" "$STAGE/"
chmod 755 "$STAGE/customize.sh" "$STAGE/service.sh" "$STAGE"/bin/*.sh
chmod 644 "$STAGE/module.prop" "$STAGE"/webroot/*

mkdir -p "$DIST"
rm -f "$DIST/$ZIP_NAME"
python3 - "$STAGE" "$DIST/$ZIP_NAME" <<'PY'
import os, sys, zipfile

stage, out = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for base, dirs, files in os.walk(stage):
        dirs.sort()
        for name in sorted(files):
            full = os.path.join(base, name)
            rel = os.path.relpath(full, stage)
            zi = zipfile.ZipInfo(rel)
            zi.external_attr = (0o100000 | (os.stat(full).st_mode & 0o777)) << 16
            zi.compress_type = zipfile.ZIP_DEFLATED
            with open(full, 'rb') as f:
                z.writestr(zi, f.read())
PY

echo "模块包完成: $DIST/$ZIP_NAME  ($(du -h "$DIST/$ZIP_NAME" | cut -f1))"
unzip -l "$DIST/$ZIP_NAME" | tail -n +4 | head -14
