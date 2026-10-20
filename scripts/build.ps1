[CmdletBinding()]
param(
    [switch]$NoCopyRuntime
)

$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outDir = Join-Path $root 'build\app'
$frameworkRoot = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'
$compiler = Join-Path $frameworkRoot 'csc.exe'

if (!(Test-Path -LiteralPath $compiler -PathType Leaf)) {
    throw '.NET Framework 4.8 x64 compiler is unavailable.'
}

New-Item -ItemType Directory -Path $outDir -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $outDir 'runtime') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $outDir 'scripts') -Force | Out-Null

$references = @(
    'System.dll',
    'System.Core.dll',
    'System.Xaml.dll',
    'System.Runtime.Serialization.dll',
    'System.Drawing.dll',
    'System.Windows.Forms.dll'
)
foreach ($name in @('WindowsBase.dll', 'PresentationCore.dll', 'PresentationFramework.dll')) {
    $references += Join-Path $frameworkRoot ('WPF\' + $name)
}

$sources = @(Get-ChildItem -LiteralPath (Join-Path $root 'src\boot') -Filter '*.cs' | Sort-Object Name | ForEach-Object { $_.FullName })
if ($sources.Count -eq 0) { throw 'No C# sources found.' }

$arguments = @(
    '/nologo',
    '/target:winexe',
    '/platform:x64',
    '/optimize+',
    '/codepage:65001',
    ('/win32manifest:' + (Join-Path $root 'src\boot\app.manifest')),
    ('/out:' + (Join-Path $outDir 'ArknightsPRTS.exe'))
)
foreach ($reference in $references) { $arguments += '/reference:' + $reference }
$arguments += $sources

& $compiler @arguments
if ($LASTEXITCODE -ne 0) { throw 'ArknightsPRTS compilation failed.' }
Write-Host ('Built: ' + (Join-Path $outDir 'ArknightsPRTS.exe'))

Copy-Item -LiteralPath (Join-Path $root 'src\boot\app.config') -Destination (Join-Path $outDir 'ArknightsPRTS.exe.config') -Force
$copies = @(
    @('panel', 'panel'),
    @('themes', 'themes'),
    @('src\injector', 'node')
)
foreach ($copy in $copies) {
    $source = Join-Path $root $copy[0]
    $destination = Join-Path $outDir $copy[1]
    if (Test-Path -LiteralPath $destination) {
        Remove-Item -LiteralPath $destination -Recurse -Force
    }
    Copy-Item -LiteralPath $source -Destination $destination -Recurse -Force
}

$existingScripts = @('enable-loopback.ps1', 'uninstall.ps1', 'close-codex.ps1')
foreach ($name in $existingScripts) {
    $source = Join-Path $root ('scripts\' + $name)
    if (Test-Path -LiteralPath $source) {
        Copy-Item -LiteralPath $source -Destination (Join-Path $outDir ('scripts\' + $name)) -Force
    }
}

if (!$NoCopyRuntime) {
    $nodeExe = Join-Path $env:ProgramFiles 'nodejs\node.exe'
    if (Test-Path -LiteralPath $nodeExe) {
        Copy-Item -LiteralPath $nodeExe -Destination (Join-Path $outDir 'runtime\node.exe') -Force
        Write-Host 'Copied node.exe'
    }
    else {
        Write-Warning 'node.exe not found; ArknightsPRTS will use node from PATH.'
    }
}

$startBat = @'
@echo off
cd /d "%~dp0"
start "" "ArknightsPRTS.exe" %*
'@
Set-Content -LiteralPath (Join-Path $outDir '启动PRTS.bat') -Value $startBat -Encoding ASCII

$panelPs1 = @'
$root = $PSScriptRoot
$node = Join-Path $root 'runtime\node.exe'
if (!(Test-Path -LiteralPath $node)) { $node = 'node.exe' }
$cli = Join-Path $root 'node\cli.mjs'
if (!(Test-Path -LiteralPath $cli)) { throw 'node\cli.mjs not found' }
Start-Process -FilePath $node -ArgumentList @($cli, 'panel', '--headless', '--no-open') -WindowStyle Hidden
Start-Sleep -Seconds 1
Start-Process 'http://127.0.0.1:9342/'
'@
Set-Content -LiteralPath (Join-Path $outDir 'open-panel.ps1') -Value $panelPs1 -Encoding UTF8

$panelBat = @'
@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0open-panel.ps1"
'@
Set-Content -LiteralPath (Join-Path $outDir '打开PRTS控制面板.bat') -Value $panelBat -Encoding ASCII

$legacyLaunchers = @('TerraBoot.exe', 'TerraBoot.exe.config', '泰拉终端.bat', '打开控制面板.bat')
foreach ($name in $legacyLaunchers) {
    $legacyPath = Join-Path $outDir $name
    if (Test-Path -LiteralPath $legacyPath -PathType Leaf) {
        try {
            Remove-Item -LiteralPath $legacyPath -Force -ErrorAction Stop
        }
        catch {
            Write-Warning ('旧版启动文件仍在使用，请关闭旧版后删除：' + $legacyPath)
        }
    }
}

Write-Host ('Output: ' + $outDir)
Write-Host 'Run build\app\ArknightsPRTS.exe --self-test next.'
