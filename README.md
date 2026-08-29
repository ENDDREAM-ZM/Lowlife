# Lowlife · Console

A KernelSU module designed for temporary root environment.

---

【Module Purpose】
This module only provides basic environment hiding capabilities for regular detection scenarios.
⚠️ If you encounter detections that this module cannot bypass, you need to combine it with other solutions.

【Usage】
• 「Repair LSPosed」：
    Refresh KSU state + choose hot reboot type
• 「Reload KSU Modules」：
    Reload all module lifecycle scripts, no reboot
• 「Hot Reboot」：
    • 「Normal Hot Reboot」：
        No environment hiding after reboot
    • 「Advanced Hot Reboot」：
        Automatically apply environment hiding after reboot

【Notes】
• It is recommended to execute "Reload KSU Modules" first, then "Repair LSPosed".
• To enable environment hiding, use "Advanced Hot Reboot".
• Hiding effectiveness depends on current system state; if it fails, try re-executing.
• In temporary root environments, a cold reboot will cause root loss.

---

## Download

Visit the [Releases](https://github.com/ENDDREAM-ZM/Lowlife/releases) page to download the lates

---

## Author

ENDDREAM

---

## Disclaimer

⚠️ AI-generated content. Please contact me if any copyright infringement is found.
