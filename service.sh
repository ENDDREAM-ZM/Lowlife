#!/system/bin/sh

MODDIR="${0%/*}"

if [ ! -f "$MODDIR/bin/hide.sh" ]; then
    echo "Lowlife: [错误] hide.sh 缺失" > /dev/kmsg
elif [ ! -x "$MODDIR/bin/hide.sh" ]; then
    echo "Lowlife: [警告] hide.sh 无执行权限" > /dev/kmsg
    chmod 755 "$MODDIR/bin/hide.sh" 2>/dev/null
else
    echo "Lowlife: hide.sh 已就绪" > /dev/kmsg
fi

if [ ! -f "$MODDIR/bin/soft_reboot.sh" ]; then
    echo "Lowlife: [错误] soft_reboot.sh 缺失" > /dev/kmsg
elif [ ! -x "$MODDIR/bin/soft_reboot.sh" ]; then
    echo "Lowlife: [警告] soft_reboot.sh 无执行权限" > /dev/kmsg
    chmod 755 "$MODDIR/bin/soft_reboot.sh" 2>/dev/null
else
    echo "Lowlife: soft_reboot.sh 已就绪" > /dev/kmsg
fi

if [ ! -f "$MODDIR/bin/soft_reboot_plus.sh" ]; then
    echo "Lowlife: [错误] soft_reboot_plus.sh 缺失" > /dev/kmsg
elif [ ! -x "$MODDIR/bin/soft_reboot_plus.sh" ]; then
    echo "Lowlife: [警告] soft_reboot_plus.sh 无执行权限" > /dev/kmsg
    chmod 755 "$MODDIR/bin/soft_reboot_plus.sh" 2>/dev/null
else
    echo "Lowlife: soft_reboot_plus.sh 已就绪" > /dev/kmsg
fi

if [ ! -x "/data/adb/ksu/bin/ksud" ]; then
    echo "Lowlife: [错误] ksud 不可用，请检查 KernelSU 环境" > /dev/kmsg
else
    echo "Lowlife: ksud 已就绪" > /dev/kmsg
fi

echo "Lowlife: 模块加载完成" > /dev/kmsg