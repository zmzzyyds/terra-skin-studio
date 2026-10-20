[CmdletBinding()]
param(
    [switch]$RemoveData,
    [switch]$KeepLoopback,
    [switch]$Yes,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$dataDir = Join-Path $env:LOCALAPPDATA 'TerraStudio'
$pfn = $null
try {
    $package = Get-AppxPackage -Name 'OpenAI.Codex' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -ne $package) { $pfn = [string]$package.PackageFamilyName }
}
catch {}

Write-Host '泰拉终端卸载 / Terra Terminal uninstall'
Write-Host ('运行数据：' + $dataDir)
if (!$Yes) {
    $answer = Read-Host '继续？输入 YES'
    if ($answer -cne 'YES') {
        Write-Host '已取消。'
        exit 1
    }
}

$controllers = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
        $_.CommandLine -match 'cli\.mjs' -and $_.CommandLine -match 'panel'
    })
foreach ($controller in $controllers) {
    if ($DryRun) {
        Write-Host ('[dry-run] 停止控制器 PID ' + $controller.ProcessId)
    }
    else {
        Write-Host ('停止控制器 PID ' + $controller.ProcessId)
        Stop-Process -Id $controller.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

$readyFile = Join-Path $dataDir 'ready.json'
if (Test-Path -LiteralPath $readyFile) {
    if ($DryRun) { Write-Host '[dry-run] 删除 ready.json' }
    else { Remove-Item -LiteralPath $readyFile -Force -ErrorAction SilentlyContinue }
}

if (!$KeepLoopback -and $pfn) {
    $exe = Join-Path $env:SystemRoot 'System32\CheckNetIsolation.exe'
    if ($DryRun) {
        Write-Host ('[dry-run] 撤销回环豁免：' + $pfn)
    }
    else {
        try {
            Write-Host ('撤销回环豁免：' + $pfn)
            $process = Start-Process -FilePath $exe -ArgumentList @('LoopbackExempt', '-d', '-n=' + $pfn) -Verb RunAs -Wait -PassThru
            Write-Host ('CheckNetIsolation 退出码：' + $process.ExitCode)
        }
        catch {
            Write-Host ('撤销回环豁免失败或被取消：' + $_.Exception.Message)
        }
    }
}

if ($RemoveData) {
    if ($DryRun) {
        Write-Host ('[dry-run] 删除运行数据：' + $dataDir)
    }
    else {
        Write-Host ('删除运行数据（含自定义主题）：' + $dataDir)
        Remove-Item -LiteralPath $dataDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
else {
    Write-Host '保留运行数据（自定义主题、日志、状态）。如需删除，加 -RemoveData。'
}

Write-Host ''
Write-Host '完成。工具没有修改 Codex 安装文件。'
Write-Host '如果要恢复官方界面：彻底退出 Codex 后正常重新打开即可。'
Write-Host '如果保留了回环豁免，可稍后再运行 enable-loopback.ps1 -Remove 撤销。'
