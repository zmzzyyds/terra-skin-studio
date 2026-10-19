import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

import { fetchVersion } from "./cdp.mjs";

const execFileAsync = promisify(execFile);
const POWERSHELL = join(
  process.env.SystemRoot || "C:\\Windows",
  "System32",
  "WindowsPowerShell",
  "v1.0",
  "powershell.exe",
);

const packageCache = { value: null, at: 0 };
const portCache = new Map();
const loopbackCache = { value: null, at: 0 };

function cleanJson(text) {
  const raw = String(text ?? "").replace(/^\uFEFF/, "").trim();
  if (!raw) return null;
  const lines = raw.split(/\r?\n/).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch {}
  }
  return null;
}

async function runPowerShell(command, { timeoutMs = 20000 } = {}) {
  try {
    const result = await execFileAsync(
      POWERSHELL,
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command],
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
    );
    return { code: 0, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
  } catch (error) {
    return {
      code: typeof error.code === "number" ? error.code : 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? error.message,
    };
  }
}

export async function getPackageInfo({ force = false } = {}) {
  if (!force && packageCache.value && Date.now() - packageCache.at < 60000) {
    return packageCache.value;
  }
  const script = [
    "$p = Get-AppxPackage -Name 'OpenAI.Codex' -ErrorAction SilentlyContinue | Select-Object -First 1",
    "if ($null -eq $p) { Write-Output '{\"found\":false}' } else { Write-Output (@{ found=$true; pfn=$p.PackageFamilyName; aumid=($p.PackageFamilyName + '!App'); version=[string]$p.Version; install=[string]$p.InstallLocation } | ConvertTo-Json -Compress) }",
  ].join("; ");
  const result = await runPowerShell(script);
  const parsed = cleanJson(result.stdout);
  const value = parsed?.found
    ? {
        found: true,
        pfn: parsed.pfn,
        aumid: parsed.aumid,
        version: parsed.version,
        install: parsed.install,
        executable: join(parsed.install, "app", "ChatGPT.exe"),
      }
    : { found: false };
  packageCache.value = value;
  packageCache.at = Date.now();
  return value;
}

export async function getPortOwner(port, { force = false } = {}) {
  const key = String(port);
  const cached = portCache.get(key);
  if (!force && cached && Date.now() - cached.at < 2000) return cached.value;
  const script = [
    `$listener = Get-NetTCPConnection -LocalPort ${Number(port)} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1`,
    "if ($null -eq $listener) { Write-Output '{\"listening\":false}' } else { $p = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue; Write-Output (@{ listening=$true; pid=$listener.OwningProcess; name=($(if ($p) { $p.ProcessName } else { '' })); path=($(if ($p) { $p.Path } else { '' })) } | ConvertTo-Json -Compress) }",
  ].join("; ");
  const result = await runPowerShell(script);
  const parsed = cleanJson(result.stdout);
  const value = parsed?.listening
    ? { listening: true, pid: parsed.pid, name: parsed.name, path: parsed.path }
    : { listening: false, pid: null, name: null, path: null };
  portCache.set(key, { value, at: Date.now() });
  return value;
}

export async function getLoopbackStatus({ force = false } = {}) {
  if (!force && loopbackCache.value && Date.now() - loopbackCache.at < 30000) {
    return loopbackCache.value;
  }
  const script = [
    "$p = Get-AppxPackage -Name 'OpenAI.Codex' -ErrorAction SilentlyContinue | Select-Object -First 1",
    "if ($null -eq $p) { Write-Output '{\"found\":false,\"exempt\":false}' } else { $exe = Join-Path $env:SystemRoot 'System32\\CheckNetIsolation.exe'; $text = ((& $exe LoopbackExempt -s 2>&1 | ForEach-Object { [string]$_ }) -join \"`n\"); Write-Output (@{ found=$true; pfn=$p.PackageFamilyName; exempt=[bool]($text -match [regex]::Escape($p.PackageFamilyName)) } | ConvertTo-Json -Compress) }",
  ].join("; ");
  const result = await runPowerShell(script);
  const parsed = cleanJson(result.stdout);
  const value = {
    found: Boolean(parsed?.found),
    pfn: parsed?.pfn ?? null,
    exempt: Boolean(parsed?.exempt),
  };
  loopbackCache.value = value;
  loopbackCache.at = Date.now();
  return value;
}

export async function enableLoopback() {
  const info = await getPackageInfo();
  if (!info.found) throw new Error("没有找到 OpenAI.Codex 商店包");
  const escaped = String(info.pfn).replaceAll("'", "''");
  const script = [
    `$pfn = '${escaped}'`,
    "$ci = Join-Path $env:SystemRoot 'System32\\CheckNetIsolation.exe'",
    "$proc = Start-Process -FilePath $ci -ArgumentList @('LoopbackExempt','-a','-n=' + $pfn) -Verb RunAs -Wait -PassThru",
    "Write-Output (@{ exitCode=$proc.ExitCode } | ConvertTo-Json -Compress)",
  ].join("; ");
  const result = await runPowerShell(script, { timeoutMs: 180000 });
  const parsed = cleanJson(result.stdout);
  const status = await getLoopbackStatus({ force: true });
  return {
    ok: status.exempt,
    exitCode: parsed?.exitCode ?? null,
    status,
    stderr: String(result.stderr ?? "").trim(),
  };
}

export function resolveBootExecutable(appRoot) {
  const candidates = [
    join(appRoot, "TerraBoot.exe"),
    join(appRoot, "build", "app", "TerraBoot.exe"),
    join(appRoot, "build", "TerraBoot.exe"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export async function launchCodex(appRoot, {
  port = 9341,
  restart = false,
  boot = false,
  theme = null,
} = {}) {
  const bootExe = resolveBootExecutable(appRoot);
  if (bootExe) {
    if (boot) {
      const { spawn } = await import("node:child_process");
      const args = ["--theme", String(theme || "si"), "--cdp-port", String(port)];
      if (restart) args.push("--restart");
      const child = spawn(bootExe, args, {
        cwd: appRoot,
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      child.unref();
      return { ok: true, method: "TerraBoot-boot", pid: child.pid ?? null };
    }
    const args = ["--launch-codex", "--cdp-port", String(port)];
    if (restart) args.push("--restart");
    const result = await execFileAsync(bootExe, args, {
      timeout: 180000,
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    }).catch((error) => ({
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? error.message,
      code: error.code,
    }));
    const parsed = cleanJson(result.stdout);
    if (!parsed) {
      if (result.code === 0 || result.code === undefined) {
        return { ok: true, method: "TerraBoot", exitCode: 0 };
      }
      throw new Error(String(result.stderr || "").trim() || "启动 Codex 失败");
    }
    if (parsed.ok !== true) {
      throw new Error(parsed.error || "启动 Codex 失败");
    }
    return { ok: true, method: "TerraBoot", ...parsed };
  }

  if (boot) throw new Error("找不到 TerraBoot.exe，无法播放启动动画");

  const fallback = join(appRoot, "scripts", "LaunchCodexCdp.ps1");
  if (!existsSync(fallback)) {
    throw new Error("找不到 TerraBoot.exe 或开发期启动脚本");
  }
  const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", fallback, "-Port", String(port)];
  if (restart) args.push("-Restart");
  const result = await execFileAsync(POWERSHELL, args, {
    timeout: 180000,
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
  }).catch((error) => ({
    stdout: error.stdout ?? "",
    stderr: error.stderr ?? error.message,
  }));
  const parsed = cleanJson(result.stdout);
  if (!parsed?.ok) {
    throw new Error(parsed?.message || parsed?.error || "启动 Codex 失败");
  }
  return { ok: true, method: "PowerShell", ...parsed };
}

export async function getStatus(port = 9341) {
  const [info, owner, loopback] = await Promise.all([
    getPackageInfo(),
    getPortOwner(port),
    getLoopbackStatus(),
  ]);
  const version = await fetchVersion(port, { timeoutMs: 1500 });
  const ownerIsCodex = Boolean(
    owner.listening && owner.path && /OpenAI\.Codex_/i.test(owner.path),
  );
  const foreignOwner = Boolean(owner.listening && !ownerIsCodex);
  return {
    package: info,
    loopback,
    port: {
      port,
      listening: owner.listening,
      owner,
      ownerIsCodex,
      foreignOwner,
      cdpOnline: Boolean(version),
      browser: version?.Browser ?? null,
      protocol: version?.["Protocol-Version"] ?? null,
    },
    codexRunning: ownerIsCodex || (info.found && Boolean(version)),
    updatedAt: new Date().toISOString(),
  };
}
