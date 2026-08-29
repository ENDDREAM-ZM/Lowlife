#!/system/bin/sh
MODDIR="${0%/*}"

set_prop() {
    local cur="$(resetprop "$1" 2>/dev/null)"
    [ -z "$cur" ] || [ "$cur" = "$2" ] || resetprop -n "$1" "$2"
}

for f in kptr_restrict dmesg_restrict perf_event_paranoid; do
    echo 2 > "/proc/sys/kernel/$f" 2>/dev/null
done
echo 0 > /proc/sys/fs/suid_dumpable 2>/dev/null
echo 0 > /proc/sys/kernel/core_pattern 2>/dev/null

resetprop -w sys.boot_completed 0
set_prop "ro.debuggable" "0"
set_prop "ro.secure" "1"
set_prop "ro.build.type" "user"
set_prop "ro.build.tags" "release-keys"
set_prop "ro.is_ever_orange" "0"
set_prop "ro.boot.realmebootstate" "green"
set_prop "ro.boot.realme.lockstate" "1"
set_prop "init.svc.adbd" "stopped"
resetprop -w sys.boot_completed 1

setenforce 1

for proc in magisk magiskd su ksu ksud kernelsu ksuhelper lspd zygiskd; do
    for pid in $(pidof "$proc" 2>/dev/null); do
        chmod 000 "/proc/$pid" 2>/dev/null
        [ -d "/proc/$pid/task" ] && chmod 000 /proc/$pid/task/* 2>/dev/null
    done
done

for path in /proc/ksu /proc/kallsyms /proc/modules /sys/kernel/debug /sys/kernel/debug/tracing; do
    chmod 000 "$path" 2>/dev/null
done
chmod 440 /proc/cmdline /proc/net/unix 2>/dev/null

[ -f /sys/fs/selinux/enforce ] && chmod 640 /sys/fs/selinux/enforce 2>/dev/null
[ -f /sys/fs/selinux/policy ] && chmod 440 /sys/fs/selinux/policy 2>/dev/null

echo 1 > /proc/sys/kernel/randomize_va_space 2>/dev/null
echo 0 > /proc/sys/vm/oom_dump_tasks 2>/dev/null

echo "Lowlife: 环境隐藏完成" > /dev/kmsg 2>/dev/null