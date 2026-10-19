[CmdletBinding()]
param(
    [switch]$Add,
    [switch]$Remove,
    [switch]$Status
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-CodexPackageFamilyName {
    $package = Get-AppxPackage -Name 'OpenAI.Codex' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $package) {
        throw '没有找到 OpenAI.Codex 商店包。'
    }
    return [string]$package.PackageFamilyName
}

function Get-LoopbackExemptText {
    $exe = Join-Path $env:SystemRoot 'System32\CheckNetIsolation.exe'
    if (!(Test-Path -LiteralPath $exe -PathType Leaf)) {
        throw '找不到 CheckNetIsolation.exe。'
    }
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        return ((& $exe LoopbackExempt -s 2>&1 | ForEach-Object { [string]$_ }) -join "`n")
    }
    finally {
        $ErrorActionPreference = $previous
    }
}

function Test-LoopbackExempt([string]$PackageFamilyName) {
    $text = Get-LoopbackExemptText
    if ([string]::IsNullOrWhiteSpace($text)) { return $false }
    return [bool]($text -match [regex]::Escape($PackageFamilyName))
}

$pfn = Get-CodexPackageFamilyName

if ($Status.IsPresent -and !$Add.IsPresent -and !$Remove.IsPresent) {
    $exempt = Test-LoopbackExempt $pfn
    Write-Host ('Package Family Name: ' + $pfn)
    Write-Host ('Loopback exempt: ' + $exempt)
    if ($exempt) { exit 0 } else { exit 1 }
}

if (!(Test-IsAdmin)) {
    $action = if ($Remove.IsPresent) { '-Remove' } else { '-Add' }
    Write-Host '需要一次管理员权限来修改 AppContainer 回环豁免。'
    $arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $PSCommandPath + '" ' + $action
    try {
        Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $arguments | Out-Null
        Write-Host '已请求提权。请在 UAC 窗口确认，然后重新运行本命令以查看状态。'
        exit 2
    }
    catch {
        throw ('无法请求管理员权限：' + $_.Exception.Message)
    }
}

$checkNetIsolation = Join-Path $env:SystemRoot 'System32\CheckNetIsolation.exe'
if ($Remove.IsPresent) {
    & $checkNetIsolation LoopbackExempt -d -n=$pfn | Out-Host
    Write-Host ('已撤销回环豁免：' + $pfn)
    exit 0
}

& $checkNetIsolation LoopbackExempt -a -n=$pfn | Out-Host
$exempt = Test-LoopbackExempt $pfn
Write-Host ('Package Family Name: ' + $pfn)
Write-Host ('Loopback exempt: ' + $exempt)
if (!$exempt) {
    throw '回环豁免写入失败。'
}
exit 0
