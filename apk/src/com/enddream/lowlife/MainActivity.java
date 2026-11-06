package com.enddream.lowlife;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.DisplayCutout;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.concurrent.TimeUnit;

/**
 * 躺平青年 · 控制台（独立 APK 版）
 *
 * 模块的全部能力（环境隐藏 / 热重启 / KSU 重载）由 bin/*.sh 提供，
 * 本 APK 负责：内置模块文件、以 root 身份调用脚本、提供与 KSU WebUI 一致的界面。
 */
public class MainActivity extends Activity {

    static final String VERSION = "3.0";
    private static final String MODULE_DIR = "/data/adb/modules/Lowlife";

    /** 常见 su 位置，按优先级探测；最后一个是依赖 PATH 的兜底。 */
    private static final String[] SU_CANDIDATES = {
            "/data/adb/ksu/bin/su",
            "/system/bin/su",
            "/system/xbin/su",
            "/debug_ramdisk/su",
            "/sbin/su",
            "su"
    };

    private WebView web;
    private static String suCache;
    private final Handler ui = new Handler(Looper.getMainLooper());

    /** 当前安全区（CSS px）：left, top, right, bottom */
    private final int[] insets = new int[]{0, 0, 0, 0};
    private boolean insetsReady = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setupEdgeToEdge();

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(false);

        web.setBackgroundColor(0xFF0D0D12);
        web.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                // 页面（重新）加载后 CSS 变量被重置，重新回填一次安全区
                pushInsets();
            }
        });
        web.addJavascriptInterface(new Bridge(), "LowlifeBridge");

        setContentView(web);
        web.loadUrl("file:///android_asset/webroot/index.html");

        // 部分机型不会主动派发 insets，主动请求一次
        getWindow().getDecorView().post(new Runnable() {
            @Override
            public void run() {
                getWindow().getDecorView().requestApplyInsets();
            }
        });
    }

    // ------------------------------------------------- 全屏 / 边到边适配

    /**
     * 让内容绘制到状态栏与导航栏之下（edge-to-edge）：
     * 系统栏透明、刘海区域可用，安全区通过 CSS 变量回填给页面自行避让。
     */
    @SuppressWarnings("deprecation")
    private void setupEdgeToEdge() {
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        w.setStatusBarColor(Color.TRANSPARENT);
        w.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = w.getAttributes();
            lp.layoutInDisplayCutoutMode =
                    WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            w.setAttributes(lp);
        }
        if (Build.VERSION.SDK_INT >= 29) {
            // 关掉系统给导航栏加的灰色蒙层，颜色交给页面自己控制
            w.setNavigationBarDividerColor(Color.TRANSPARENT);
            w.setNavigationBarContrastEnforced(false);
        }

        final View decor = w.getDecorView();
        if (Build.VERSION.SDK_INT >= 30) {
            w.setDecorFitsSystemWindows(false);
            decor.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
                @Override
                public WindowInsets onApplyWindowInsets(View v, WindowInsets in) {
                    android.graphics.Insets bars = in.getInsets(WindowInsets.Type.systemBars());
                    android.graphics.Insets cut = in.getInsets(WindowInsets.Type.displayCutout());
                    applyInsetsPx(
                            Math.max(bars.left, cut.left),
                            Math.max(bars.top, cut.top),
                            Math.max(bars.right, cut.right),
                            Math.max(bars.bottom, cut.bottom));
                    return WindowInsets.CONSUMED;
                }
            });
        } else {
            decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
            decor.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
                @Override
                public WindowInsets onApplyWindowInsets(View v, WindowInsets in) {
                    int l = in.getSystemWindowInsetLeft();
                    int t = in.getSystemWindowInsetTop();
                    int r = in.getSystemWindowInsetRight();
                    int b = in.getSystemWindowInsetBottom();
                    if (Build.VERSION.SDK_INT >= 28) {
                        DisplayCutout c = in.getDisplayCutout();
                        if (c != null) {
                            l = Math.max(l, c.getSafeInsetLeft());
                            t = Math.max(t, c.getSafeInsetTop());
                            r = Math.max(r, c.getSafeInsetRight());
                            b = Math.max(b, c.getSafeInsetBottom());
                        }
                    }
                    applyInsetsPx(l, t, r, b);
                    return in;
                }
            });
        }
    }

    private void applyInsetsPx(int lPx, int tPx, int rPx, int bPx) {
        float d = getResources().getDisplayMetrics().density;
        if (d <= 0) {
            d = 1f;
        }
        int l = Math.round(lPx / d), t = Math.round(tPx / d);
        int r = Math.round(rPx / d), b = Math.round(bPx / d);
        if (insetsReady && l == insets[0] && t == insets[1] && r == insets[2] && b == insets[3]) {
            return;
        }
        insets[0] = l;
        insets[1] = t;
        insets[2] = r;
        insets[3] = b;
        insetsReady = true;
        pushInsets();
    }

    /** 把安全区写进页面的 CSS 变量（--inset-*），页面据此避让系统栏。 */
    private void pushInsets() {
        final WebView v = web;
        if (v == null) {
            return;
        }
        final String js = "(function(){var f=window.LowlifeInsets;if(typeof f==='function'){f("
                + insets[0] + "," + insets[1] + "," + insets[2] + "," + insets[3] + ");}})();";
        v.post(new Runnable() {
            @Override
            public void run() {
                try {
                    v.evaluateJavascript(js, null);
                } catch (Throwable ignore) {
                    // 页面还没就绪时忽略，onPageFinished 会再推一次
                }
            }
        });
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && web != null && web.canGoBack()) {
            web.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    // ------------------------------------------------------------------ root

    /** 探测可用的 root shell，结果缓存；返回 null 表示没有 root。 */
    private static synchronized String suBin() {
        if (suCache != null) {
            return suCache.isEmpty() ? null : suCache;
        }
        for (String candidate : SU_CANDIDATES) {
            try {
                Process p = new ProcessBuilder(candidate, "-c", "id -u")
                        .redirectErrorStream(true).start();
                ByteArrayOutputStream buf = new ByteArrayOutputStream();
                Thread reader = startReader(p, buf);
                boolean done = waitFor(p, 5000);
                if (!done) {
                    p.destroy();
                    continue;
                }
                joinQuietly(reader);
                if ("0".equals(buf.toString().trim())) {
                    suCache = candidate;
                    return candidate;
                }
            } catch (Exception ignored) {
                // 继续尝试下一个
            }
        }
        suCache = "";
        return null;
    }

    /** 以 root 执行一段 sh 命令，返回合并后的输出。 */
    private static String sh(String cmd, int timeoutSeconds) {
        String su = suBin();
        if (su == null) {
            return "__ERR__:未获取到 root 权限（请确认设备已 root 且已授权本应用）";
        }
        try {
            Process p = new ProcessBuilder(su, "-c", cmd)
                    .redirectErrorStream(true).start();
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            Thread reader = startReader(p, buf);
            boolean done = waitFor(p, timeoutSeconds * 1000L);
            if (!done) {
                p.destroy();
                joinQuietly(reader);
                return buf.toString() + "\n__ERR__:命令执行超时";
            }
            joinQuietly(reader);
            return buf.toString();
        } catch (Exception e) {
            return "__ERR__:命令执行失败 " + e.getMessage();
        }
    }

    /** 后台读取进程输出，避免管道写满导致阻塞。 */
    private static Thread startReader(final Process p, final ByteArrayOutputStream buf) {
        Thread t = new Thread(new Runnable() {
            @Override
            public void run() {
                byte[] b = new byte[8192];
                int n;
                try {
                    InputStream in = p.getInputStream();
                    while ((n = in.read(b)) > 0) {
                        buf.write(b, 0, n);
                    }
                } catch (IOException ignored) {
                }
            }
        });
        t.setDaemon(true);
        t.start();
        return t;
    }

    /** Process.waitFor(long, TimeUnit) 需要 API 26，这里用轮询兼容低版本。 */
    private static boolean waitFor(Process p, long millis) {
        long deadline = System.currentTimeMillis() + millis;
        while (System.currentTimeMillis() < deadline) {
            try {
                p.exitValue();
                return true;
            } catch (IllegalThreadStateException stillRunning) {
                // 继续等
            }
            try {
                Thread.sleep(40);
            } catch (InterruptedException e) {
                return false;
            }
        }
        return false;
    }

    private static void joinQuietly(Thread t) {
        try {
            t.join(2000);
        } catch (InterruptedException ignored) {
        }
    }

    // --------------------------------------------------------------- 模块部署

    private String doDeploy() {
        // 安全护栏：只允许写 /data/adb/modules/ 下的模块目录，
        // 绝不触碰 /system、/vendor、/product 等系统分区（临时 root 下改分区会变砖）
        if (!MODULE_DIR.startsWith("/data/adb/modules/")) {
            return "__ERR__:目标路径不在 /data/adb/modules 下，已拒绝执行";
        }
        if (suBin() == null) {
            return "__ERR__:未获取到 root 权限（请确认设备已 root 且已授权本应用）";
        }
        File payload = new File(getCacheDir(), "payload");
        try {
            deleteTree(payload);
            copyAssetDir("module", payload);
            // WebUI 复用 APK 内的同一套前端资源，避免 APK 里存两份
            copyAssetDir("webroot", new File(payload, "webroot"));
        } catch (IOException e) {
            return "__ERR__:释放内置模块文件失败 " + e.getMessage();
        }

        String p = payload.getAbsolutePath();
        String cmd = "rm -rf " + MODULE_DIR + "; "
                + "mkdir -p " + MODULE_DIR + " && "
                + "cp -af " + p + "/. " + MODULE_DIR + "/ && "
                + "chown -R 0:0 " + MODULE_DIR + " && "
                + "chmod 755 " + MODULE_DIR + " " + MODULE_DIR + "/bin && "
                + "chmod 755 " + MODULE_DIR + "/bin/*.sh " + MODULE_DIR + "/service.sh "
                + MODULE_DIR + "/customize.sh && "
                + "chmod 644 " + MODULE_DIR + "/module.prop && "
                + "restorecon -R " + MODULE_DIR + " 2>/dev/null; "
                + "echo \"已部署到 " + MODULE_DIR + "\"; "
                + "grep -E '^version=' " + MODULE_DIR + "/module.prop 2>/dev/null";

        return sh(cmd, 60);
    }

    private void copyAssetDir(String assetPath, File dest) throws IOException {
        String[] children = getAssets().list(assetPath);
        if (children == null || children.length == 0) {
            // 是文件
            if (!dest.getParentFile().exists() && !dest.getParentFile().mkdirs()) {
                throw new IOException("无法创建目录 " + dest.getParent());
            }
            InputStream in = getAssets().open(assetPath);
            OutputStream out = new FileOutputStream(dest);
            try {
                byte[] b = new byte[8192];
                int n;
                while ((n = in.read(b)) > 0) {
                    out.write(b, 0, n);
                }
            } finally {
                try {
                    in.close();
                } catch (IOException ignored) {
                }
                out.close();
            }
            return;
        }
        if (!dest.exists() && !dest.mkdirs()) {
            throw new IOException("无法创建目录 " + dest);
        }
        for (String child : children) {
            copyAssetDir(assetPath + "/" + child, new File(dest, child));
        }
    }

    private static void deleteTree(File f) {
        if (f == null || !f.exists()) {
            return;
        }
        File[] kids = f.listFiles();
        if (kids != null) {
            for (File k : kids) {
                deleteTree(k);
            }
        }
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }

    // ------------------------------------------------------------------ 桥接

    /** 暴露给 WebView 的 JS 桥，方法在桥线程执行，可安全阻塞。 */
    public class Bridge {

        @JavascriptInterface
        public String version() {
            return VERSION;
        }

        @JavascriptInterface
        public boolean hasRoot() {
            return suBin() != null;
        }

        @JavascriptInterface
        public String deployModule() {
            return doDeploy();
        }

        /** 安全区（CSS px）：left,top,right,bottom，供页面首帧就摆正布局 */
        @JavascriptInterface
        public String insets() {
            return insets[0] + "," + insets[1] + "," + insets[2] + "," + insets[3];
        }

        @JavascriptInterface
        public String exec(String cmd) {
            if (cmd == null) {
                return "__ERR__:空命令";
            }
            return sh(cmd, 30);
        }


        @JavascriptInterface
        public void toast(String msg) {
            final String text = msg == null ? "" : msg;
            ui.post(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(MainActivity.this, text, Toast.LENGTH_SHORT).show();
                }
            });
        }
    }
}
