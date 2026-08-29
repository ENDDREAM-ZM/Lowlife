#!/system/bin/sh

MODDIR="${0%/*}"

echo "Lowlife: 普通热重启开始" > /dev/kmsg 2>/dev/null

rm -f /data/system/zygote.lock \
      /data/system/performance.lock \
      /data/system/surfaceflinger.lock 2>/dev/null

[ -d /proc/ksu ] && umount /proc/ksu 2>/dev/null

setprop ctl.restart zygote

echo "Lowlife: 普通热重启完成" > /dev/kmsg 2>/dev/null
exit 0