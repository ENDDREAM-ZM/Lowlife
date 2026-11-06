const path = require('path');
const { chromium } = require('/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/playwright-core');

const HTML = 'file://' + path.resolve(__dirname, '../../webroot/index.html');
const EXE = '/root/.cache/ms-playwright/chromium-1243/chrome-linux-arm64/chrome';

// APK 模式：内置 root 桥
const APK_BRIDGE = `
window.LowlifeBridge = {
  version: () => '3.0',
  hasRoot: () => true,
  exec: (cmd) => {
    (window.__cmds = window.__cmds || []).push(cmd);
    if (cmd.indexOf('test -f') >= 0) return 'ok';
    if (cmd.indexOf('== 环境自检 ==') >= 0) return [
      '== 环境自检 ==','uid: 0','机型: 2211133C / Android 16','SEAndroid: Enforcing',
      'zygote: running','su: /system/bin/su','ksud: 已就绪','模块目录: 已部署',
      'version=v3.0','versionCode=300','hide.sh: 可执行','soft_reboot.sh: 可执行',
      'soft_reboot_plus.sh: 可执行','== 自检完成 =='
    ].join('\\n');
    return '';
  },
  deployModule: () => '已部署到 /data/adb/modules/Lowlife\\nversion=v3.0',
  toast: () => {}
};`;

// KSU WebUI 模式：只有 ksu.exec
const KSU_ONLY = `
window.ksu = {
  exec: (cmd) => {
    (window.__cmds = window.__cmds || []).push(cmd);
    if (cmd.indexOf('test -f') >= 0) return 'ok';
    return '';
  }
};`;

const results = [];
function check(name, cond, extra) {
  results.push({ name, ok: !!cond, extra: extra === undefined ? '' : String(extra) });
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (extra ? '  -> ' + extra : ''));
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });

  // ---------- 1. APK 模式（内置桥） ----------
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.addInitScript(APK_BRIDGE);
  await page.goto(HTML);
  await page.waitForSelector('#btnLsp');

  check('页面无 JS 错误', errors.length === 0, errors.join(' | '));
  check('APK 模式识别（body.in-app）', await page.evaluate(() => document.body.classList.contains('in-app')));
  check('版本标签 v3.0', (await page.textContent('#verTag')).trim() === 'v3.0', await page.textContent('#verTag'));
  check('背景图加载成功', await page.evaluate(async () => {
    const img = new Image();
    return await new Promise(r => { img.onload = () => r(img.naturalWidth > 0); img.onerror = () => r(false); img.src = 'Aemeath.png'; });
  }));

  // ---------- 2. 按钮集合：只保留模块原有的 6 个 ----------
  const btnIds = await page.evaluate(() => [...document.querySelectorAll('.btn-group button')].map(b => b.id));
  const footIds = await page.evaluate(() => [...document.querySelectorAll('.footer-actions button')].map(b => b.id));
  check('主区 6 个按钮 + 底部 2 个小按钮', btnIds.length === 6 && footIds.length === 2, btnIds.join(',') + ' | ' + footIds.join(','));
  check('部署 / 环境自检按钮存在且在 APK 内可见',
    (await page.isVisible('#btnDeploy')) && (await page.isVisible('#btnCheck')));
  check('模块原有 6 个按钮齐备',
    ['btnLsp', 'btnReload', 'btnRebootNormal', 'btnRebootAdvanced', 'btnChangelog', 'btnInfo']
      .every(id => btnIds.concat(footIds).indexOf(id) >= 0), btnIds.concat(footIds).join(','));
  const labels = await page.evaluate(() => [...document.querySelectorAll('button')]
    .map(b => b.textContent.trim()));
  check('按钮文案不含任何图标/emoji',
    labels.every(t => !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2190}-\u{21FF}]/u.test(t)),
    labels.join(' | '));
  check('等待提示文案也不带图标',
    (await page.textContent('#log')).trim() === '点击按钮执行操作…',
    await page.textContent('#log'));
  const grid = await page.evaluate(() => {
    const r = id => { const b = document.getElementById(id).getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width)]; };
    return { lsp: r('btnLsp'), reload: r('btnReload'), adv: r('btnRebootAdvanced'), normal: r('btnRebootNormal'), check: r('btnCheck'), deploy: r('btnDeploy') };
  });
  check('修复 LSPosed 独占一行（满宽）',
    grid.lsp[2] > grid.reload[2] * 1.5, 'lsp 宽 ' + grid.lsp[2] + ' vs 半宽 ' + grid.reload[2]);
  check('其余按钮每行 2 个（重载/高级同排，普通/自检同排）',
    grid.reload[1] === grid.adv[1] && grid.normal[1] === grid.check[1] && grid.reload[1] !== grid.normal[1] && grid.reload[2] === grid.adv[2],
    [grid.reload[1], grid.adv[1], grid.normal[1], grid.check[1]].join('/'));
  check('部署模块文件在 APK 内也独占一行',
    grid.deploy[2] === grid.lsp[2] && grid.deploy[1] > grid.normal[1], 'deploy 宽 ' + grid.deploy[2] + ' y ' + grid.deploy[1]);
  const footH = await page.evaluate(() => Math.round(document.getElementById('btnInfo').getBoundingClientRect().height));
  check('底部小按钮更小（32dp）', footH === 32, footH + 'px');

  // ---------- 3. MD3 视觉令牌 ----------
  const md3 = await page.evaluate(() => {
    const cs = el => getComputedStyle(el);
    const g = id => document.getElementById(id);
    const card = document.querySelector('.card');
    const box = document.querySelector('#confirmModal .modal-box');
    return {
      filledBg: cs(g('btnLsp')).backgroundColor,
      filledFg: cs(g('btnLsp')).color,
      tonalBg: cs(g('btnReload')).backgroundColor,
      tonalFg: cs(g('btnReload')).color,
      normalBg: cs(g('btnRebootNormal')).backgroundColor,
      checkBg: cs(g('btnCheck')).backgroundColor,
      deployBg: cs(g('btnDeploy')).backgroundColor,
      footBg: cs(g('btnInfo')).backgroundColor,
      footFg: cs(g('btnInfo')).color,
      footBorder: cs(g('btnInfo')).borderTopWidth,
      cardBlur: cs(card).backdropFilter || cs(card).webkitBackdropFilter,
      btnRadius: cs(g('btnLsp')).borderRadius,
      btnHeight: Math.round(g('btnLsp').getBoundingClientRect().height),
      btnFont: cs(g('btnLsp')).fontSize,
      cardRadius: cs(card).borderRadius,
      cardBg: cs(card).backgroundColor,
      dialogRadius: cs(box).borderRadius,
      dialogBg: cs(box).backgroundColor,
      chipBg: cs(g('verTag')).backgroundColor,
      logBg: cs(g('log')).backgroundColor,
      logH: Math.round(g('log').getBoundingClientRect().height),
      titleSize: cs(document.querySelector('.titles h1')).fontSize
    };
  });
  check('MD3 filled 按钮用 primary 色', md3.filledBg === 'rgb(103, 80, 164)' && md3.filledFg === 'rgb(255, 255, 255)', md3.filledBg + ' / ' + md3.filledFg);
  check('MD3 tonal 按钮用 secondary-container', md3.tonalBg === 'rgb(232, 222, 248)' && md3.tonalFg === 'rgb(29, 25, 43)', md3.tonalBg + ' / ' + md3.tonalFg);
  check('主区按钮统一为 tonal（普通热重启/自检/部署）',
    md3.normalBg === 'rgb(232, 222, 248)' && md3.checkBg === 'rgb(232, 222, 248)' && md3.deployBg === 'rgb(232, 222, 248)',
    [md3.normalBg, md3.checkBg, md3.deployBg].join(' / '));
  check('底部小按钮为透明底 + 1px 描边 + on-surface-variant',
    md3.footBg === 'rgba(0, 0, 0, 0)' && md3.footBorder === '1px' && md3.footFg === 'rgb(73, 69, 79)',
    md3.footBg + ' / ' + md3.footBorder + ' / ' + md3.footFg);
  check('卡片背景模糊已降到约一半（12px）', /blur\(12px\)/.test(md3.cardBlur), md3.cardBlur);
  check('按钮形状：全圆角 + 48dp 触摸目标', md3.btnRadius === '999px' && md3.btnHeight === 48, md3.btnRadius + ' / ' + md3.btnHeight + 'px');
  check('按钮排版：14sp label', md3.btnFont === '14px', md3.btnFont);
  check('卡片形状：16dp 圆角 + M3 surface 色', md3.cardRadius === '16px' && md3.cardBg === 'rgba(254, 247, 255, 0.88)', md3.cardRadius + ' / ' + md3.cardBg);
  check('对话框形状：28dp 圆角 + surface-container-high', md3.dialogRadius === '28px' && md3.dialogBg === 'rgb(236, 230, 240)', md3.dialogRadius + ' / ' + md3.dialogBg);
  check('版本标签为 M3 chip（secondary-container）', md3.chipBg === 'rgb(232, 222, 248)', md3.chipBg);
  check('日志区为 M3 surface-container-low 容器', md3.logBg === 'rgb(247, 242, 250)' && md3.logH === 132, md3.logBg + ' / ' + md3.logH + 'px');
  check('标题用 headline-small 22sp', md3.titleSize === '22px', md3.titleSize);

  // ---------- 4. 布局：单屏放得下、无重叠 ----------
  const layout = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('.btn-group button')].map(b => {
      const r = b.getBoundingClientRect();
      return { id: b.id, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    });
    const card = document.querySelector('.card').getBoundingClientRect();
    let overlap = 0;
    for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) {
      const a = btns[i], c = btns[j];
      if (a.x < c.x + c.w - 1 && c.x < a.x + a.w - 1 && a.y < c.y + c.h - 1 && c.y < a.y + a.h - 1) overlap++;
    }
    return { overlap, cardTop: Math.round(card.top), cardBottom: Math.round(card.bottom), vh: innerHeight, cardW: Math.round(card.width) };
  });
  check('按钮无重叠', layout.overlap === 0, 'overlap=' + layout.overlap);
  check('卡片完整落在视口内', layout.cardTop >= 0 && layout.cardBottom <= layout.vh, layout.cardTop + '~' + layout.cardBottom + ' / ' + layout.vh);

  // ---------- 5. 交互 ----------
  await page.click('#btnRebootAdvanced');
  await page.waitForSelector('#confirmModal.active');
  check('确认弹窗弹出', await page.isVisible('#confirmModal.active'));
  await page.click('#modalConfirm');
  await page.waitForTimeout(1200);
  const rebootLog = await page.textContent('#log');
  check('高级热重启进入执行流程', rebootLog.indexOf('高级热重启') >= 0, rebootLog.replace(/\n/g, ' / ').slice(0, 90));
  const cmds = await page.evaluate(() => (window.__cmds || []).join('\n'));
  check('热重启调用 soft_reboot_plus.sh', cmds.indexOf('soft_reboot_plus.sh') >= 0);

  await page.click('#btnLsp');
  await page.waitForSelector('#choiceModalLsp.active');
  check('修复 LSPosed 弹出重启方式选择', await page.isVisible('#choiceLspNormal'));
  await page.click('#choiceLspNormal');
  await page.waitForSelector('#confirmModal.active');
  await page.click('#modalConfirm');
  await page.waitForTimeout(800);
  const cmds2 = await page.evaluate(() => (window.__cmds || []).join('\n'));
  check('修复 LSPosed 刷新 ksud 三个阶段',
    cmds2.indexOf('ksud post-fs-data') >= 0 && cmds2.indexOf('ksud services') >= 0 && cmds2.indexOf('ksud boot-completed') >= 0);

  await page.click('#btnReload');
  await page.waitForSelector('#confirmModal.active');
  await page.click('#modalConfirm');
  await page.waitForFunction(() => document.querySelector('#log').textContent.indexOf('重载完成') >= 0, { timeout: 5000 });
  check('重载 KSU 模块执行完成', (await page.textContent('#log')).indexOf('KSU 模块重载完成') >= 0);

  // 环境自检
  await page.click('#btnCheck');
  await page.waitForFunction(() => document.querySelector('#log').textContent.indexOf('自检完成') >= 0, { timeout: 5000 });
  const checkLog = await page.textContent('#log');
  check('环境自检输出渲染', checkLog.indexOf('uid: 0') >= 0 && checkLog.indexOf('ksud: 已就绪') >= 0);
  check('自检命令经桥执行', (await page.evaluate(() => (window.__cmds || []).join(' '))).indexOf('环境自检') >= 0);

  // 部署模块
  await page.click('#btnDeploy');
  await page.waitForSelector('#confirmModal.active');
  check('部署确认弹窗弹出', await page.isVisible('#confirmModal.active'));
  await page.click('#modalConfirm');
  await page.waitForFunction(() => document.querySelector('#log').textContent.indexOf('部署完成') >= 0, { timeout: 5000 });
  check('部署流程走通', (await page.textContent('#log')).indexOf('已部署到 /data/adb/modules/Lowlife') >= 0);

  await page.click('#btnChangelog');
  await page.waitForSelector('#changelogModal.active');
  const clText = await page.textContent('#changelogModal .modal-message');
  check('更新日志含 v3.0 段落', clText.indexOf('v3.0') >= 0 && clText.indexOf('打包成 APK') >= 0);
  await page.click('#changelogClose');
  await page.click('#btnInfo');
  await page.waitForSelector('#infoModal.active');
  const infoText = await page.textContent('#infoModal .modal-message');
  check('使用说明包含部署与环境自检条目',
    infoText.indexOf('环境自检') >= 0 && infoText.indexOf('部署模块文件') >= 0);
  await page.click('#infoClose');

  await page.screenshot({ path: '/tmp/lowlife_apk_mode.png', fullPage: true });

  // ---------- 6. KSU WebUI 模式 ----------
  const ctx2 = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const page2 = await ctx2.newPage();
  const errors2 = [];
  page2.on('pageerror', e => errors2.push(String(e)));
  await page2.addInitScript(KSU_ONLY);
  await page2.goto(HTML);
  await page2.waitForSelector('#btnLsp');
  check('WebUI 模式无 JS 错误', errors2.length === 0, errors2.join(' | '));
  check('WebUI 模式隐藏 APK 专属的部署按钮',
    !(await page2.isVisible('#btnDeploy')) && (await page2.isVisible('#btnCheck')));
  await page2.click('#btnCheck');
  await page2.waitForFunction(() => document.querySelector('#log').textContent.indexOf('自检完成') >= 0, { timeout: 5000 });
  check('WebUI 模式自检可用', (await page2.textContent('#log')).indexOf('自检完成') >= 0);
  await page2.click('#btnReload');
  await page2.waitForSelector('#confirmModal.active');
  await page2.click('#modalConfirm');
  await page2.waitForFunction(() => document.querySelector('#log').textContent.indexOf('重载完成') >= 0, { timeout: 5000 });
  check('WebUI 模式经 ksu.exec 执行', (await page2.textContent('#log')).indexOf('重载完成') >= 0);
  const plainPad = await page2.evaluate(() => parseFloat(getComputedStyle(document.body).paddingTop));
  check('WebUI 模式不受全屏改动影响（padding 仍 16px）', plainPad === 16, 'pt=' + plainPad);
  await page2.screenshot({ path: '/tmp/lowlife_webui_mode.png', fullPage: true });

  // ---------- 7. 无 root 模式 ----------
  const ctx3 = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page3 = await ctx3.newPage();
  await page3.addInitScript("window.LowlifeBridge = { version: () => '3.0', hasRoot: () => false, insets: () => '0,0,0,0', exec: () => '__ERR__:未获取到 root 权限（请确认设备已 root 且已授权本应用）', toast: () => {} };");
  await page3.goto(HTML);
  await page3.click('#btnRebootNormal');
  await page3.waitForSelector('#confirmModal.active');
  await page3.click('#modalConfirm');
  await page3.waitForFunction(() => document.querySelector('#log').textContent.indexOf('未获取到 root') >= 0, { timeout: 5000 });
  check('无 root 时给出明确错误', (await page3.textContent('#log')).indexOf('未获取到 root 权限') >= 0);

  // ---------- 8. 全屏 / 边到边 ----------
  const INSETS_BRIDGE = "window.LowlifeBridge = { version: () => '3.0', hasRoot: () => true, insets: () => '0,24,0,34', exec: () => '', toast: () => {} };";
  const ctx5 = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3 });
  const page5 = await ctx5.newPage();
  const errors5 = [];
  page5.on('pageerror', e => errors5.push(String(e)));
  await page5.addInitScript(INSETS_BRIDGE);
  await page5.goto(HTML);
  await page5.waitForSelector('#btnLsp');

  const fx = await page5.evaluate(() => {
    const cs = getComputedStyle(document.body);
    const before = getComputedStyle(document.body, '::before');
    const after = getComputedStyle(document.body, '::after');
    const card = document.querySelector('.card').getBoundingClientRect();
    return {
      cls: document.body.className,
      pt: parseFloat(cs.paddingTop), pb: parseFloat(cs.paddingBottom),
      pl: parseFloat(cs.paddingLeft), pr: parseFloat(cs.paddingRight),
      beforeH: before.height, afterH: after.height,
      cardTop: Math.round(card.top), cardBottom: Math.round(card.bottom), vh: innerHeight
    };
  });
  check('全屏：首帧即应用安全区（上 24+16 / 下 34+16）',
    fx.pt === 40 && fx.pb === 50 && fx.pl === 16 && fx.pr === 16,
    'pt=' + fx.pt + ' pb=' + fx.pb + ' pl=' + fx.pl + ' pr=' + fx.pr);
  check('全屏：body 挂上 edge-to-edge', fx.cls.indexOf('edge-to-edge') >= 0, fx.cls);
  check('全屏：上下渐变遮罩已生成', parseFloat(fx.beforeH) > 24 && parseFloat(fx.afterH) > 34,
    '::before=' + fx.beforeH + ' ::after=' + fx.afterH);
  check('全屏：卡片整体落在安全区内', fx.cardTop >= 24 && fx.cardBottom <= fx.vh - 34,
    'card ' + fx.cardTop + '~' + fx.cardBottom + ' / vh ' + fx.vh);
  check('全屏：无 JS 错误', errors5.length === 0, errors5.join(' | '));
  await page5.screenshot({ path: '/tmp/lowlife_fullscreen.png', fullPage: true });

  const land = await page5.evaluate(() => {
    window.LowlifeInsets(48, 24, 0, 34);
    const cs = getComputedStyle(document.body);
    const card = document.querySelector('.card').getBoundingClientRect();
    return { pl: parseFloat(cs.paddingLeft), cardLeft: Math.round(card.left) };
  });
  check('横屏：左侧刘海安全区生效', land.pl >= 64 && land.cardLeft >= 48, 'pl=' + land.pl + ' cardLeft=' + land.cardLeft);

  const back = await page5.evaluate(() => {
    window.LowlifeInsets(0, 0, 0, 0);
    const cs = getComputedStyle(document.body);
    return { pt: parseFloat(cs.paddingTop), pb: parseFloat(cs.paddingBottom), cls: document.body.className };
  });
  check('安全区归零后恢复 16px 且摘掉 edge-to-edge',
    back.pt === 16 && back.pb === 16 && back.cls.indexOf('edge-to-edge') < 0,
    'pt=' + back.pt + ' pb=' + back.pb + ' cls=' + back.cls);

  const modal = await page5.evaluate(() => {
    window.LowlifeInsets(0, 24, 0, 34);
    document.querySelector('#infoModal').classList.add('active');
    const box = document.querySelector('#infoModal .modal-box').getBoundingClientRect();
    return { top: Math.round(box.top), bottom: Math.round(box.bottom), vh: innerHeight };
  });
  check('弹窗不压状态栏/导航栏', modal.top >= 24 && modal.bottom <= modal.vh - 34,
    'modal ' + modal.top + '~' + modal.bottom + ' / vh ' + modal.vh);

  await browser.close();

  const failed = results.filter(r => !r.ok);
  console.log('\n===== ' + (results.length - failed.length) + '/' + results.length + ' 项通过 =====');
  if (failed.length) { console.log('失败项: ' + failed.map(f => f.name).join(', ')); process.exit(1); }
})();
