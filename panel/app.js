(() => {
  "use strict";

  const token = document.querySelector('meta[name="terra-token"]')?.content ?? "";
  const $ = (id) => document.getElementById(id);
  const themeGrid = $("theme-grid");
  const themeEmpty = $("theme-empty");
  const toastEl = $("toast");
  let lastRenderSignature = "";
  let toastTimer = null;
  let refreshBusy = false;
  let settingsInitialized = false;
  let logCounter = 0;

  const SERIES_LABEL = {
    arknights: "ARKNIGHTS",
    endfield: "ENDFIELD",
    custom: "CUSTOM",
  };

  function toast(message, type = "info") {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.className = `toast show${type === "error" ? " error" : ""}`;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.className = "toast";
    }, 3800);
  }

  async function api(path, { method = "GET", json = null, raw = null, headers = {} } = {}) {
    const requestHeaders = { "X-Terra-Token": token, ...headers };
    let body;
    if (json !== null) {
      requestHeaders["Content-Type"] = "application/json";
      body = JSON.stringify(json);
    } else if (raw !== null) {
      body = raw;
    }
    const response = await fetch(path, { method, headers: requestHeaders, body });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }
    if (!response.ok) {
      throw new Error(data?.error || `HTTP ${response.status}`);
    }
    return data;
  }

  function setChip(id, text, state) {
    const chip = $(id);
    if (!chip) return;
    chip.classList.remove("on", "off", "warn");
    if (state) chip.classList.add(state);
    const value = chip.querySelector("b");
    if (value) value.textContent = text;
  }

  function formatTime(value) {
    if (!value) return "--";
    try {
      return new Date(value).toLocaleTimeString("zh-CN", { hour12: false });
    } catch {
      return "--";
    }
  }

  function setText(id, value) {
    const node = $(id);
    if (node) node.textContent = value == null || value === "" ? "--" : String(value);
  }

  function renderThemes(themes, activeId) {
    const signature = JSON.stringify({
      activeId,
      themes: themes.map((theme) => [
        theme.id,
        theme.name,
        theme.previewUrl,
        theme.builtin,
        theme.available?.hero,
        theme.available?.video,
        theme.error,
      ]),
    });
    if (signature === lastRenderSignature) return;
    lastRenderSignature = signature;

    themeGrid.replaceChildren();
    themeEmpty.hidden = themes.length > 0;
    for (const theme of themes) {
      const card = document.createElement("article");
      card.className = `theme-card${theme.id === activeId ? " active" : ""}`;
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `应用主题 ${theme.name}`);

      const preview = document.createElement("div");
      preview.className = "theme-preview";
      if (theme.previewUrl) {
        const img = document.createElement("img");
        img.src = theme.previewUrl;
        img.alt = "";
        img.loading = "lazy";
        preview.appendChild(img);
      } else {
        const colors = theme.colors ?? {};
        preview.style.background = `linear-gradient(135deg, ${colors.surface ?? "#0A0F14"} 0%, #05080b 62%, ${colors.accent ?? "#F2C94C"}44 100%)`;
      }
      const tag = document.createElement("span");
      tag.className = "theme-tag";
      tag.textContent = theme.builtin
        ? (SERIES_LABEL[theme.series] ?? "TERRA")
        : "CUSTOM";
      preview.appendChild(tag);

      if (!theme.builtin) {
        const del = document.createElement("button");
        del.className = "theme-delete";
        del.type = "button";
        del.title = "删除自定义主题";
        del.textContent = "×";
        del.addEventListener("click", async (event) => {
          event.stopPropagation();
          if (!confirm(`删除自定义主题「${theme.name}」？`)) return;
          try {
            await api(`/api/themes/${encodeURIComponent(theme.id)}`, { method: "DELETE" });
            toast("已删除主题");
            await refresh(true);
          } catch (error) {
            toast(error.message, "error");
          }
        });
        preview.appendChild(del);
      }

      const body = document.createElement("div");
      body.className = "theme-body";
      const title = document.createElement("div");
      title.className = "theme-title";
      const name = document.createElement("strong");
      name.textContent = theme.name;
      const series = document.createElement("span");
      series.textContent = theme.subtitle || SERIES_LABEL[theme.series] || "";
      title.appendChild(name);
      title.appendChild(series);

      const sub = document.createElement("p");
      sub.className = "theme-sub";
      sub.textContent = theme.error
        ? `错误：${theme.error}`
        : (theme.copy?.tagline || theme.decor || "");

      const foot = document.createElement("div");
      foot.className = "theme-foot";
      const swatches = document.createElement("div");
      swatches.className = "swatches";
      for (const key of ["accent", "secondary", "surface", "text"]) {
        const swatch = document.createElement("i");
        swatch.className = "swatch";
        swatch.style.background = theme.colors?.[key] ?? "#222";
        swatches.appendChild(swatch);
      }
      const apply = document.createElement("span");
      apply.className = "apply-label";
      apply.textContent = theme.id === activeId ? "ACTIVE" : (theme.available?.hero ? "APPLY" : "NO ASSET");
      foot.appendChild(swatches);
      foot.appendChild(apply);

      body.appendChild(title);
      body.appendChild(sub);
      body.appendChild(foot);
      card.appendChild(preview);
      card.appendChild(body);

      const activate = async () => {
        if (theme.error || !theme.available?.hero) {
          toast("这套主题的素材还未就绪", "error");
          return;
        }
        try {
          toast(`正在应用「${theme.name}」...`);
          await api("/api/apply", { method: "POST", json: { id: theme.id } });
          await refresh(true);
          toast(`已切换到「${theme.name}」`);
        } catch (error) {
          toast(error.message, "error");
        }
      };
      card.addEventListener("click", activate);
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
      themeGrid.appendChild(card);
    }
  }

  function renderStatus(data) {
    const controller = data.controller ?? {};
    const status = controller.status ?? data.status ?? {};
    const port = status.port ?? data.port ?? {};
    const loopback = data.loopback ?? status.loopback ?? {};
    const state = data.state ?? {};
    const pkg = status.package ?? data.package ?? {};

    setChip("chip-codex", status.codexRunning ? "ONLINE" : "OFFLINE", status.codexRunning ? "on" : "off");
    setChip("chip-cdp", port.cdpOnline ? "ONLINE" : "OFFLINE", port.cdpOnline ? "on" : "off");
    setChip("chip-loopback", loopback.exempt ? "EXEMPT" : "ISOLATED", loopback.exempt ? "on" : "warn");
    setChip("chip-theme", controller.activeTheme?.name || state.activeTheme || "--", controller.connected ? "on" : "warn");

    setText("status-package", pkg.found ? `${pkg.version || "?"} (${pkg.pfn || ""})` : "未找到");
    setText("status-port", port.listening
      ? `${port.port} · ${port.ownerIsCodex ? "Codex" : port.owner?.name || "未知进程"}`
      : `未监听 (${controller.port ?? 9341})`);
    setText("status-target", controller.target?.url || "--");
    setText("status-applied", controller.lastAppliedAt ? formatTime(controller.lastAppliedAt) : "--");
    setText("status-error", controller.lastError || "--");
    $("status-error").classList.toggle("error", Boolean(controller.lastError));
    setText("status-time", formatTime(new Date().toISOString()));
    setText("log-file", controller.logFile || "--");

    if (!settingsInitialized) {
      settingsInitialized = true;
      $("opacity").value = String(Math.round((state.opacity ?? 0.88) * 100));
      $("opacity-value").textContent = `${$("opacity").value}%`;
      $("clarity").value = String(Math.round((state.clarity ?? 0.6) * 100));
      $("clarity-value").textContent = `${$("clarity").value}%`;
      $("appearance").value = state.appearance ?? "dark";
      $("readability").value = state.readability ?? "auto";
      $("boot-enabled").value = String(state.bootEnabled !== false);
      $("mute-boot").value = String(Boolean(state.muteBoot));
      $("handoff").value = state.handoff === "restore" ? "restore" : "maximize";
    }
  }

  async function refresh(force = false) {
    if (refreshBusy) return;
    refreshBusy = true;
    try {
      const data = await api("/api/state");
      renderStatus(data);
      renderThemes(data.themes ?? [], data.state?.activeTheme ?? null);
      if (force) await loadLogs();
      logCounter += 1;
      if (logCounter % 4 === 0) await loadLogs();
    } catch (error) {
      setChip("chip-codex", "PANEL LOST", "off");
      setChip("chip-cdp", "PANEL LOST", "off");
      if (force) toast(error.message, "error");
    } finally {
      refreshBusy = false;
    }
  }

  async function loadLogs() {
    try {
      const data = await api("/api/logs");
      const lines = data.lines ?? [];
      $("logs").textContent = lines.length ? lines.join("\n") : "(暂无日志)";
      setText("log-file", data.file || "--");
    } catch (error) {
      $("logs").textContent = `读取日志失败：${error.message}`;
    }
  }

  async function withButton(button, label, action) {
    if (!button) return;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = label;
    try {
      await action();
    } finally {
      button.disabled = false;
      button.textContent = original;
    }
  }

  function bindActions() {
    $("refresh-btn").addEventListener("click", () => refresh(true));

    $("btn-launch").addEventListener("click", (event) => withButton(event.currentTarget, "启动中...", async () => {
      try {
        const data = await api("/api/codex/launch", { method: "POST", json: { restart: false, boot: true } });
        toast(data.result?.method === "TerraBoot-boot" ? "正在播放启动动画并打开 Codex..." : "已请求启动 Codex");
        setTimeout(() => refresh(true), 2500);
      } catch (error) {
        toast(error.message, "error");
      }
    }));

    $("btn-restart").addEventListener("click", (event) => withButton(event.currentTarget, "重启中...", async () => {
      if (!confirm("会先正常关闭 Codex；如果商店版驻留托盘不退出，将强制结束 Codex GUI 进程。未发送的输入可能丢失。重启后会播放启动动画。继续？")) return;
      try {
        await api("/api/codex/launch", { method: "POST", json: { restart: true, boot: true } });
        toast("正在重启 Codex，启动动画会在 Codex 窗口内播放...");
        setTimeout(() => refresh(true), 4000);
      } catch (error) {
        toast(error.message, "error");
      }
    }));

    $("btn-restore").addEventListener("click", (event) => withButton(event.currentTarget, "还原中...", async () => {
      if (!confirm("还原 Codex 官方界面？")) return;
      try {
        await api("/api/restore", { method: "POST", json: {} });
        toast("已还原官方界面");
        await refresh(true);
      } catch (error) {
        toast(error.message, "error");
      }
    }));

    $("btn-loopback").addEventListener("click", (event) => withButton(event.currentTarget, "等待 UAC...", async () => {
      if (!confirm("会弹出一次 UAC 管理员确认，为 Codex 添加 AppContainer 回环豁免。继续？")) return;
      try {
        const data = await api("/api/loopback", { method: "POST", json: {} });
        toast(data.ok ? "回环豁免已生效" : "回环豁免没有生效", data.ok ? "info" : "error");
        await refresh(true);
      } catch (error) {
        toast(error.message, "error");
      }
    }));

    $("btn-folder").addEventListener("click", async () => {
      try {
        await api("/api/open-folder", { method: "POST", json: { custom: false } });
        toast("已打开主题文件夹");
      } catch (error) {
        toast(error.message, "error");
      }
    });

    $("btn-switcher").addEventListener("click", (event) => withButton(event.currentTarget, "显示中...", async () => {
      try {
        const data = await api("/api/switcher", { method: "POST", json: { hidden: false } });
        if (data.result?.applied) {
          toast("已显示 Codex 内主题胶囊");
          return;
        }
        const restart = confirm(
          "Codex 当前没有调试端口（可能是手动启动的），皮肤和主题胶囊都无法注入。\n\n"
          + "显示主题胶囊需要关闭并重新打开 Codex；未发送的输入可能丢失。\n\n现在重启并应用吗？",
        );
        if (!restart) {
          toast("已取消；请先点“重启并应用”再显示胶囊", "error");
          return;
        }
        await api("/api/codex/launch", { method: "POST", json: { restart: true, boot: true } });
        toast("正在重启 Codex，启动后会自动应用主题并显示胶囊...");
        setTimeout(() => refresh(true), 4000);
      } catch (error) {
        toast(error.message, "error");
      }
    }));

    $("btn-logs").addEventListener("click", loadLogs);

    const opacity = $("opacity");
    opacity.addEventListener("input", () => {
      $("opacity-value").textContent = `${opacity.value}%`;
    });
    const clarity = $("clarity");
    clarity.addEventListener("input", () => {
      $("clarity-value").textContent = `${clarity.value}%`;
    });
    let settingsTimer = null;
    const sendSettings = () => {
      if (settingsTimer) clearTimeout(settingsTimer);
      settingsTimer = setTimeout(async () => {
        try {
          await api("/api/settings", {
            method: "POST",
            json: {
              opacity: Number(opacity.value) / 100,
              clarity: Number(clarity.value) / 100,
              appearance: $("appearance").value,
              readability: $("readability").value,
              bootEnabled: $("boot-enabled").value === "true",
              muteBoot: $("mute-boot").value === "true",
              handoff: $("handoff").value,
            },
          });
        } catch (error) {
          toast(error.message, "error");
        }
      }, 450);
    };
    for (const id of ["opacity", "clarity", "appearance", "readability", "boot-enabled", "mute-boot", "handoff"]) {
      $(id).addEventListener("change", sendSettings);
    }
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("图片无法读取"));
      };
      image.src = url;
    });
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h, s, l };
  }

  function hslToRgb(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s = Math.max(0, Math.min(1, s));
    l = Math.max(0, Math.min(1, l));
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0; let g = 0; let b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255),
    };
  }

  function toHex(color) {
    const part = (value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
    return `#${part(color.r)}${part(color.g)}${part(color.b)}`.toUpperCase();
  }

  function hueDistance(a, b) {
    const distance = Math.abs(a - b) % 360;
    return distance > 180 ? 360 - distance : distance;
  }

  function luminance(color) {
    return (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255;
  }

  function mixRgb(a, b, ratio) {
    return {
      r: a.r + (b.r - a.r) * ratio,
      g: a.g + (b.g - a.g) * ratio,
      b: a.b + (b.b - a.b) * ratio,
    };
  }

  async function extractPalette(file) {
    const image = await loadImage(file);
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, 64, 64);
    const data = context.getImageData(0, 0, 64, 64).data;
    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { count: 0, r: 0, g: 0, b: 0 };
        buckets.set(key, bucket);
      }
      bucket.count += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    }
    const colors = [...buckets.values()].map((bucket) => {
      const rgb = {
        r: bucket.r / bucket.count,
        g: bucket.g / bucket.count,
        b: bucket.b / bucket.count,
      };
      return { count: bucket.count, ...rgb, ...rgbToHsl(rgb.r, rgb.g, rgb.b) };
    });
    if (!colors.length) throw new Error("图片没有可用颜色");
    const darkest = [...colors].sort((a, b) => a.l - b.l).slice(0, Math.max(1, Math.ceil(colors.length * 0.12)));
    const darkCount = darkest.reduce((sum, color) => sum + color.count, 0);
    const darkAverage = darkest.reduce(
      (acc, color) => ({
        r: acc.r + color.r * color.count,
        g: acc.g + color.g * color.count,
        b: acc.b + color.b * color.count,
      }),
      { r: 0, g: 0, b: 0 },
    );
    const surfaceRgb = mixRgb(
      { r: darkAverage.r / darkCount, g: darkAverage.g / darkCount, b: darkAverage.b / darkCount },
      { r: 10, g: 15, b: 20 },
      0.55,
    );
    const surface = toHex(surfaceRgb);
    const saturated = colors
      .filter((color) => color.s > 0.32 && color.l > 0.15 && color.l < 0.88)
      .sort((a, b) => (b.s * Math.sqrt(b.count)) - (a.s * Math.sqrt(a.count)));
    const first = saturated[0] || { h: 45, s: 0.8, l: 0.6 };
    const second = saturated.find((color) => hueDistance(color.h, first.h) > 28)
      || saturated[1]
      || { h: 190, s: 0.8, l: 0.7 };
    const normalize = (color) => toHex(hslToRgb(
      color.h,
      Math.max(0.5, Math.min(0.9, color.s)),
      Math.max(0.5, Math.min(0.72, color.l)),
    ));
    return {
      accent: normalize(first),
      secondary: normalize(second),
      surface,
      text: luminance(surfaceRgb) < 0.5 ? "#F5F2EA" : "#121518",
    };
  }

  async function resizeImage(file, surfaceColor) {
    const image = await loadImage(file);
    const canvas = document.createElement("canvas");
    canvas.width = 1920;
    canvas.height = 1080;
    const context = canvas.getContext("2d");
    context.fillStyle = surfaceColor || "#0A0F14";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("图片压缩失败"));
      }, "image/jpeg", 0.86);
    });
  }

  async function uploadRaw(blob, filename, kind) {
    return api(`/api/upload?kind=${kind}`, {
      method: "POST",
      raw: blob,
      headers: {
        "X-Filename": encodeURIComponent(filename),
        "Content-Type": blob.type || "application/octet-stream",
      },
    });
  }

  function bindCustomForm() {
    const form = $("custom-form");
    const toggle = $("custom-toggle");
    toggle.addEventListener("click", () => {
      form.hidden = !form.hidden;
      toggle.textContent = form.hidden ? "展开" : "收起";
    });

    $("custom-pick-colors").addEventListener("click", async () => {
      const file = $("custom-image").files[0];
      if (!file) {
        toast("先选择一张背景图，再取色", "error");
        return;
      }
      try {
        const palette = await extractPalette(file);
        $("custom-accent").value = palette.accent;
        $("custom-secondary").value = palette.secondary;
        $("custom-surface").value = palette.surface;
        $("custom-text").value = palette.text;
        toast(`已取色：主色 ${palette.accent} / 辅色 ${palette.secondary}`);
      } catch (error) {
        toast(error.message, "error");
      }
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submit = $("custom-submit");
      const name = $("custom-name").value.trim();
      const subtitle = $("custom-subtitle").value.trim();
      const series = $("custom-series").value;
      const decor = $("custom-decor").value;
      const colors = {
        accent: $("custom-accent").value,
        secondary: $("custom-secondary").value,
        surface: $("custom-surface").value,
        text: $("custom-text").value,
        mode: "dark",
      };
      const imageFile = $("custom-image").files[0];
      const videoFile = $("custom-video").files[0];
      if (!name) { toast("请填写主题名称", "error"); return; }
      if (!imageFile) { toast("请选择背景图", "error"); return; }

      submit.disabled = true;
      submit.textContent = "处理图片...";
      try {
        const imageBlob = await resizeImage(imageFile, colors.surface);
        submit.textContent = "上传背景...";
        const image = await uploadRaw(imageBlob, "hero.jpg", "image");
        let video = null;
        if (videoFile) {
          submit.textContent = "上传视频...";
          video = await uploadRaw(videoFile, "boot.mp4", "video");
        }
        submit.textContent = "创建主题...";
        const payload = {
          name,
          subtitle,
          series,
          decor,
          colors,
          image: { path: image.path, ext: image.ext },
          video: video ? { path: video.path, ext: video.ext } : undefined,
        };
        const data = await api("/api/themes", { method: "POST", json: payload });
        toast(`已创建「${data.theme.name}」并应用`);
        form.reset();
        $("custom-accent").value = colors.accent;
        $("custom-secondary").value = colors.secondary;
        $("custom-surface").value = colors.surface;
        $("custom-text").value = colors.text;
        await refresh(true);
      } catch (error) {
        toast(error.message, "error");
      } finally {
        submit.disabled = false;
        submit.textContent = "创建并应用";
      }
    });
  }

  bindActions();
  bindCustomForm();
  refresh(true);
  setInterval(() => refresh(false), 3000);
})();
