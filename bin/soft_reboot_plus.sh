#!/system/bin/sh

MODDIR="${0%/*}"

echo "Lowlife: 高级热重启开始" > /dev/kmsg 2>/dev/null

rm -f /data/system/zygote.lock \
      /data/system/performance.lock \
      /data/system/surfaceflinger.lock 2>/dev/null

[ -d /proc/ksu ] && umount /proc/ksu 2>/dev/null

echo "Lowlife: 开始 PID 消耗" > /dev/kmsg 2>/dev/null

target=1000
last=$$
wrapped=0
count=0

while :; do
    : &
    pid=$!
    count=$((count + 1))
    [ $((count % 100)) -eq 0 ] && wait 2>/dev/null
    [ "$pid" -lt "$last" ] && wrapped=1
    [ "$wrapped" -eq 1 ] && [ "$pid" -ge "$target" ] && break
    last=$pid
done

wait 2>/dev/null
echo "Lowlife: PID 消耗完成" > /dev/kmsg 2>/dev/null

sleep 2
setprop ctl.restart zygote

if [ -f "$MODDIR/bin/hide.sh" ]; then
    {
        sleep 8
        sh "$MODDIR/bin/hide.sh" > /dev/null 2>&1
        echo "Lowlife: 自动隐藏已执行" > /dev/kmsg 2>/dev/null
    } &
else
    echo "Lowlife: 警告 - hide.sh 不存在" > /dev/kmsg 2>/dev/null
fi

echo "Lowlife: 高级热重启完成" > /dev/kmsg 2>/dev/null
exit 0