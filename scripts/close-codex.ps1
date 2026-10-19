[CmdletBinding()]
param(
    [int]$TimeoutSeconds = 25
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

if (-not ('Terra.CloseWindows' -as [type])) {
    Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
namespace Terra {
    public static class CloseWindows {
        private delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
        [DllImport("user32.dll")] private static extern bool EnumWindows(EnumProc callback, IntPtr lParam);
        [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
        [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr hWnd);
        [DllImport("user32.dll")] private static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
        public static int Close(uint[] processIds) {
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

function Get-CodexGuiProcesses {
    $items = @()
    foreach ($process in @(Get-Process ChatGPT -ErrorAction SilentlyContinue)) {
        try {
            if ($process.Path -and $process.Path.IndexOf('OpenAI.Codex_', [StringComparison]::OrdinalIgnoreCase) -ge 0) {
                $items += $process
            }
        }
        catch {}
    }
    return $items
}

$processes = @(Get-CodexGuiProcesses)
if ($processes.Count -eq 0) {
    Write-Host 'Codex 没有运行。'
    exit 0
}

$ids = @($processes | ForEach-Object { [uint32]$_.Id })
Write-Host ('正在请求 Codex 正常退出：' + ($ids -join ', '))
foreach ($process in $processes) {
    try { [void]$process.CloseMainWindow() } catch {}
}
$posted = [Terra.CloseWindows]::Close($ids)
Write-Host ('已发送 WM_CLOSE 的窗口数：' + $posted)

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
    if (@(Get-CodexGuiProcesses).Count -eq 0) {
        Write-Host 'Codex 已退出。'
        exit 0
    }
    Start-Sleep -Milliseconds 400
}

Write-Host 'Codex 未在超时内退出；请手动关闭。'
exit 3
