[CmdletBinding()]
param(
    [ValidateRange(1024, 65535)][int]$Port = 9341,
    [switch]$Restart,
    [switch]$NoWait,
    [switch]$SkipLoopbackCheck
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

function Write-Result($value) {
    Write-Output ($value | ConvertTo-Json -Compress)
}

function Get-CodexApp {
    $package = Get-AppxPackage -Name 'OpenAI.Codex' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $package) { throw '没有找到 OpenAI.Codex 商店包。' }
    $pfn = [string]$package.PackageFamilyName
    $aumid = $pfn + '!App'
    $exe = Join-Path $package.InstallLocation 'app\ChatGPT.exe'
    return [pscustomobject]@{
        Package = $package
        Pfn = $pfn
        Aumid = $aumid
        Executable = $exe
        InstallLocation = [string]$package.InstallLocation
    }
}

function Get-LoopbackExempt([string]$Pfn) {
    $exe = Join-Path $env:SystemRoot 'System32\CheckNetIsolation.exe'
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $text = ((& $exe LoopbackExempt -s 2>&1 | ForEach-Object { [string]$_ }) -join "`n")
    }
    finally {
        $ErrorActionPreference = $previous
    }
    return [bool]($text -match [regex]::Escape($Pfn))
}

function Get-PortOwner([int]$Port) {
    $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $listener) { return $null }
    $process = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
    if ($null -eq $process) { return $null }
    return [pscustomobject]@{
        Id = $listener.OwningProcess
        Name = $process.ProcessName
        Path = $process.Path
    }
}

function Test-CodexOwner($Owner, $App) {
    if ($null -eq $Owner) { return $false }
    if ($Owner.Path -and $Owner.Path.IndexOf('OpenAI.Codex_', [StringComparison]::OrdinalIgnoreCase) -ge 0) { return $true }
    return $false
}

function Get-CodexGuiProcesses($App) {
    $items = @()
    foreach ($item in @(Get-CimInstance Win32_Process -Filter "Name='ChatGPT.exe'" -ErrorAction SilentlyContinue)) {
        if ([string]$item.ExecutablePath -and [string]$item.ExecutablePath.IndexOf('OpenAI.Codex_', [StringComparison]::OrdinalIgnoreCase) -ge 0) {
            $items += $item
        }
    }
    return $items
}

function Close-CodexGracefully($App) {
    if (-not ('Terra.SpikeWindowClose' -as [type])) {
        Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
namespace Terra {
    public static class SpikeWindowClose {
        private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
        [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
        [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
        [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr hWnd);
        [DllImport("user32.dll")] private static extern bool PostMessage(IntPtr hWnd, uint message, IntPtr wParam, IntPtr lParam);
        public static int CloseVisibleWindows(uint[] processIds) {
            HashSet<uint> wanted = new HashSet<uint>(processIds);
            int count = 0;
            EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
                uint pid;
                GetWindowThreadProcessId(hWnd, out pid);
                if (wanted.Contains(pid) && IsWindowVisible(hWnd)) {
                    PostMessage(hWnd, 0x0010, IntPtr.Zero, IntPtr.Zero);
                    count++;
                }
                return true;
            }, IntPtr.Zero);
            return count;
        }
    }
}
"@
    }
    $processes = Get-CodexGuiProcesses $App
    $ids = @($processes | ForEach-Object { [uint32]$_.ProcessId })
    if ($ids.Count -eq 0) { return 0 }
    foreach ($id in $ids) {
        $process = Get-Process -Id $id -ErrorAction SilentlyContinue
        if ($null -ne $process) {
            try { [void]$process.CloseMainWindow() } catch {}
        }
    }
    $posted = [Terra.SpikeWindowClose]::CloseVisibleWindows($ids)
    Write-Host ('已请求 Codex 正常退出（窗口消息 ' + $posted + ' 个）。')
    $deadline = (Get-Date).AddSeconds(25)
    while ((Get-Date) -lt $deadline) {
        if (@(Get-CodexGuiProcesses $App).Count -eq 0) { return 0 }
        Start-Sleep -Milliseconds 400
    }
    throw 'Codex 没有在 25 秒内退出。请手动关闭 Codex 后重试；本工具不会强制结束进程。'
}

function Start-CodexWithCdp($App, [int]$Port) {
    $arguments = '--remote-debugging-address=127.0.0.1 --remote-debugging-port=' + $Port
    if (-not ('Terra.SpikeActivation' -as [type])) {
        Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
namespace Terra {
    [ComImport, Guid("2e941141-7f97-4756-ba1d-9decde894a3d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IApplicationActivationManager {
        [PreserveSig] int ActivateApplication([In, MarshalAs(UnmanagedType.LPWStr)] string appUserModelId, [In, MarshalAs(UnmanagedType.LPWStr)] string arguments, [In] int options, [Out] out uint processId);
        [PreserveSig] int ActivateForFile([In, MarshalAs(UnmanagedType.LPWStr)] string appUserModelId, [In] IntPtr itemArray, [In, MarshalAs(UnmanagedType.LPWStr)] string verb, [Out] out uint processId);
        [PreserveSig] int ActivateForProtocol([In, MarshalAs(UnmanagedType.LPWStr)] string appUserModelId, [In] IntPtr itemArray, [Out] out uint processId);
    }
    [ComImport, Guid("45BA127D-10A8-46EA-8AB7-56EA9078943C")]
    public class ApplicationActivationManager { }
    public static class SpikeActivation {
        public static uint Launch(string aumid, string arguments) {
            IApplicationActivationManager manager = (IApplicationActivationManager)new ApplicationActivationManager();
            uint processId;
            int hr = manager.ActivateApplication(aumid, arguments, 2, out processId);
            if (hr != 0) { Marshal.ThrowExceptionForHR(hr); }
            return processId;
        }
    }
}
"@
    }
    try {
        $activated = [Terra.SpikeActivation]::Launch($App.Aumid, $arguments)
        return [pscustomobject]@{ Pid = $activated; Method = 'activation' }
    }
    catch {
        Write-Host ('系统激活失败：' + $_.Exception.Message)
        if (!(Test-Path -LiteralPath $App.Executable -PathType Leaf)) { throw }
        Write-Host '改用包内可执行文件直接启动。'
        $process = Start-Process -FilePath $App.Executable -ArgumentList $arguments -PassThru
        return [pscustomobject]@{ Pid = $process.Id; Method = 'exe' }
    }
}

function Wait-ForPort([int]$Port, [int]$Seconds) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri ('http://127.0.0.1:' + $Port + '/json/version') -TimeoutSec 2
            if ($response.StatusCode -eq 200) { return $true }
        }
        catch {}
        Start-Sleep -Milliseconds 500
    }
    return $false
}

try {
    $app = Get-CodexApp
    Write-Host ('Codex: ' + $app.Aumid)
    $loopback = if ($SkipLoopbackCheck) { $null } else { Get-LoopbackExempt $app.Pfn }
    if ($loopback -eq $false) {
        Write-Result ([pscustomobject]@{
            ok = $false
            error = 'loopback-isolated'
            message = '请先运行 scripts\enable-loopback.ps1（一次管理员权限），再重试。'
            pfn = $app.Pfn
        })
        exit 4
    }

    $owner = Get-PortOwner $Port
    if ($null -ne $owner) {
        if (Test-CodexOwner $owner $app) {
            Write-Host ('调试端口已就绪：' + $Port + '，PID ' + $owner.Id)
            Write-Result ([pscustomobject]@{
                ok = $true
                already = $true
                port = $Port
                portOpen = $true
                ownerPid = $owner.Id
                aumid = $app.Aumid
                pfn = $app.Pfn
                loopback = $loopback
            })
            exit 0
        }
        throw ('端口 ' + $Port + ' 被其他进程占用：' + $owner.Name + ' (' + $owner.Path + ')')
    }

    $running = @(Get-CodexGuiProcesses $app)
    if ($running.Count -gt 0) {
        if (!$Restart) {
            Write-Result ([pscustomobject]@{
                ok = $false
                error = 'running-without-cdp'
                message = 'Codex 正在运行但没有调试端口。加 -Restart 才会正常重启它。'
                aumid = $app.Aumid
                pfn = $app.Pfn
                loopback = $loopback
            })
            exit 3
        }
        Write-Host 'Codex 正在运行，准备正常退出并带调试参数重启……'
        Close-CodexGracefully $app | Out-Null
    }

    $started = Start-CodexWithCdp $app $Port
    Write-Host ('已请求启动 Codex，PID ' + $started.Pid + '，方式 ' + $started.Method)

    $portOpen = $false
    if (!$NoWait) {
        $portOpen = Wait-ForPort $Port 60
    }

    $debugFlag = $false
    foreach ($item in @(Get-CimInstance Win32_Process -Filter "Name='ChatGPT.exe'" -ErrorAction SilentlyContinue)) {
        $line = [string]$item.CommandLine
        if ($line -and $line -match '--remote-debugging-port') { $debugFlag = $true; break }
    }

    Write-Result ([pscustomobject]@{
        ok = ($portOpen -or $NoWait)
        portOpen = $portOpen
        debugFlag = $debugFlag
        port = $Port
        activatedPid = $started.Pid
        method = $started.Method
        aumid = $app.Aumid
        pfn = $app.Pfn
        loopback = $loopback
    })
    if (!$portOpen -and !$NoWait) { exit 5 }
    exit 0
}
catch {
    Write-Result ([pscustomobject]@{
        ok = $false
        error = 'launch-failed'
        message = $_.Exception.Message
    })
    exit 1
}
