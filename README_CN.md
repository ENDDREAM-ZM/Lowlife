# Lowlife

专为临时 root 环境设计的 KernelSU 辅助模块，提供基础的环境隐藏能力和 LSPosed 修复功能，以及KernelSU模块重新挂载。

---

## 模块用途

本模块仅提供基础的环境隐藏能力，用于应对常规检测场景。

⚠️ 若遇本模块无法解决的检测，需自行配合其他方案解决。

---

## 操作说明

### `修复 LSPosed`
刷新 KSU 状态 + 选择热重启类型

### `重载 KSU 模块`
重新加载所有模块生命周期脚本，不重启

### `热重启`
- **普通热重启**：热重启后不进行环境隐藏
- **高级热重启**：热重启后自动进行环境隐藏

---

## 注意事项

- 建议先进行“重载 KSU 模块”，然后“修复 LSPosed”。
- 如需隐藏基础环境，点击“高级热重启”。
- 隐藏效果依赖当前系统状态，若失效请尝试重新执行。
- 临时 root 环境下，触发冷重启后会丢失 root 权限。

---

## 下载

前往 [Releases](https://github.com/ENDDREAM-ZM/Lowlife/releases) 下载最新版本。

- [Lowlife-v1.0](https://github.com/ENDDREAM-ZM/Lowlife/releases/download/v1.0/Lowlife-v1.0.zip)
- [Lowlife-v2.0](https://github.com/ENDDREAM-ZM/Lowlife/releases/download/v2.0/Lowlife-v2.0.zip)

---

## 测试环境

- **设备**：小米 15 (dada)
- **系统版本**：OS3.0.7.0.WOCCNXM
- **KernelSU**：v3.3.0 (32601-2)

---

## 作者

ENDDREAM

---

## 免责声明

本模块由 DeepSeek 编写。所有操作均不修改任何物理分区，无危险操作，可放心食用。
