#Requires -Version 5.1
<#
.SYNOPSIS
Install a checksum-verified official lightjunction binary on Windows.
.DESCRIPTION
Defaults to the latest stable cli-v release and LOCALAPPDATA/Programs/lightjunction/bin.
LIGHTJUNCTION_VERSION and LIGHTJUNCTION_INSTALL_DIR supply optional defaults.
The script does not request administrator access or modify persistent PATH settings.
#>
[CmdletBinding()]
param(
    [string] $Version = $env:LIGHTJUNCTION_VERSION,
    [string] $InstallDir = $env:LIGHTJUNCTION_INSTALL_DIR
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$TemporaryDirectory = $null
$StagingDirectory = $null
$OriginalTls = [Net.ServicePointManager]::SecurityProtocol

function Get-ReleaseFile {
    param([Uri] $Uri, [string] $Destination)
    for ($Redirect = 0; $Redirect -le 5; $Redirect++) {
        if ($Uri.Scheme -cne 'https') { throw 'Refusing a non-HTTPS download or redirect.' }
        $Response = $null
        try {
            # PS 5.1 returns a response alongside a non-terminating redirect error;
            # PS 7 throws. Handle both, and validate every redirect before following it.
            $Response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 180 `
                -Headers @{ 'User-Agent' = 'lightjunction-installer' } -ErrorAction SilentlyContinue
        } catch {
            $Response = $_.Exception.Response
            if ($null -eq $Response) { throw }
        }
        if ($null -eq $Response) { throw "Download failed: $Uri" }
        $Status = [int] $Response.StatusCode
        if ($Status -eq 200) {
            # Windows PowerShell 5.1's -OutFile/-PassThru combination can write an
            # empty file. Copy the raw response bytes instead, never decoded text.
            $Stream = $Response.RawContentStream
            if ($null -eq $Stream) { throw "Download response has no byte stream: $Uri" }
            try {
                if ($Stream.CanSeek) { $Stream.Position = 0 }
                $File = [IO.File]::Open($Destination, [IO.FileMode]::Create, [IO.FileAccess]::Write)
                try { $Stream.CopyTo($File) }
                finally { $File.Dispose() }
            } finally { $Stream.Dispose() }
            return
        }
        if ($Status -notin @(301, 302, 303, 307, 308)) {
            throw "Download failed with HTTP ${Status}: $Uri"
        }
        $Location = $Response.Headers.Location
        if ($null -eq $Location) { throw "Redirect has no Location header: $Uri" }
        $Uri = [Uri]::new($Uri, [string] $Location)
    }
    throw 'Too many HTTPS redirects.'
}

function Assert-RegularDestination {
    param([string] $Path)
    $Item = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    if ($null -ne $Item -and (
        $Item.PSIsContainer -or ($Item.Attributes -band [IO.FileAttributes]::ReparsePoint)
    )) {
        throw "Refusing a directory, symbolic link, or other reparse point: $Path"
    }
}

try {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
        throw 'install.ps1 supports Windows only; use install.sh on Linux or macOS.'
    }
    if ($Version -and $Version -cnotmatch '\A(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\z') {
        throw 'Version must be MAJOR.MINOR.PATCH.'
    }
    if (-not $InstallDir) {
        if (-not $env:LOCALAPPDATA) { throw 'LOCALAPPDATA is not set; specify -InstallDir.' }
        $InstallDir = Join-Path $env:LOCALAPPDATA 'Programs/lightjunction/bin'
    }
    $InstallDir = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($InstallDir)
    $Destination = Join-Path $InstallDir 'lightjunction.exe'
    Assert-RegularDestination $Destination

    # Environment variables and process architecture can report x64 under ARM64 emulation.
    # IsWow64Process2 returns the actual host architecture on modern Windows.
    if (-not ('LightjunctionInstallerNative' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class LightjunctionInstallerNative {
    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWow64Process2(IntPtr process, out ushort guest, out ushort host);
    [DllImport("kernel32.dll")]
    private static extern IntPtr GetCurrentProcess();
    public static string Architecture() {
        try {
            ushort guest, host;
            if (!IsWow64Process2(GetCurrentProcess(), out guest, out host))
                throw new Win32Exception(Marshal.GetLastWin32Error());
            if (host == 0x8664) return "AMD64";
            if (host == 0xaa64) return "ARM64";
            return "unsupported (machine " + host.ToString("x4") + ")";
        } catch (EntryPointNotFoundException) {
            // Pre-Windows 10 systems have no ARM64/x64 emulation ambiguity.
            return Environment.GetEnvironmentVariable("PROCESSOR_ARCHITEW6432")
                ?? Environment.GetEnvironmentVariable("PROCESSOR_ARCHITECTURE");
        }
    }
}
'@
    }
    $Architecture = [LightjunctionInstallerNative]::Architecture()
    switch ($Architecture) {
        'AMD64' { $Target = 'x86_64-pc-windows-msvc' }
        'ARM64' { $Target = 'aarch64-pc-windows-msvc' }
        default { throw "Unsupported CPU architecture: $Architecture" }
    }

    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $TemporaryDirectory = Join-Path ([IO.Path]::GetTempPath()) ('lightjunction-install-' + [Guid]::NewGuid())
    $null = [IO.Directory]::CreateDirectory($TemporaryDirectory)
    if (-not $Version) {
        $LatestFile = Join-Path $TemporaryDirectory 'latest.json'
        Get-ReleaseFile 'https://api.github.com/repos/LIghtJUNction/lightjunction/releases/latest' $LatestFile
        $Latest = Get-Content -LiteralPath $LatestFile -Raw | ConvertFrom-Json
        if ($Latest.tag_name -cnotmatch '\Acli-v((0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*))\z' `
            -or $Latest.prerelease -ne $false -or $Latest.draft -ne $false) {
            throw 'Latest release is not a stable cli-v release; specify -Version.'
        }
        $Version = $Latest.tag_name.Substring(5)
    }
    $Asset = "lightjunction-v$Version-$Target.zip"
    $BaseUrl = "https://github.com/LIghtJUNction/lightjunction/releases/download/cli-v$Version"
    $Archive = Join-Path $TemporaryDirectory $Asset
    $Checksums = Join-Path $TemporaryDirectory 'SHA256SUMS'
    Get-ReleaseFile "$BaseUrl/$Asset" $Archive
    Get-ReleaseFile "$BaseUrl/SHA256SUMS" $Checksums

    $Expected = @()
    foreach ($Line in [IO.File]::ReadAllLines($Checksums)) {
        if ($Line -cnotmatch '\A[0-9a-fA-F]{64}  [A-Za-z0-9][A-Za-z0-9._-]*\z') {
            throw 'SHA256SUMS contains a malformed checksum line.'
        }
        if ($Line.Substring(66) -ceq $Asset) { $Expected += $Line.Substring(0, 64) }
    }
    if ($Expected.Count -ne 1) { throw 'SHA256SUMS must contain exactly one checksum for the archive.' }
    $Actual = (Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash
    if ($Actual -ine $Expected[0]) { throw 'SHA-256 mismatch; existing installation was not changed.' }

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $Zip = [IO.Compression.ZipFile]::OpenRead($Archive)
    try {
        $Names = @($Zip.Entries | ForEach-Object { $_.FullName })
        if ($Names.Count -ne 3 -or @($Names | Sort-Object -Unique).Count -ne 3 `
            -or @($Names | Where-Object { $_ -cnotin @('lightjunction.exe', 'LICENSE', 'README.md') }).Count) {
            throw 'Archive contains unexpected or duplicate paths.'
        }
        $Entry = $Zip.GetEntry('lightjunction.exe')
        $UnixType = ($Entry.ExternalAttributes -shr 16) -band 0xf000
        if ($Entry.Length -le 0 -or $UnixType -notin @(0, 0x8000)) {
            throw 'Archive binary is not a nonempty regular file.'
        }
        $null = [IO.Directory]::CreateDirectory($InstallDir)
        $StagingDirectory = Join-Path $InstallDir ('.lightjunction-install-' + [Guid]::NewGuid())
        $null = [IO.Directory]::CreateDirectory($StagingDirectory)
        $StagedBinary = Join-Path $StagingDirectory 'lightjunction.exe'
        $InputStream = $Entry.Open()
        try {
            $OutputStream = [IO.File]::Open($StagedBinary, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
            try { $InputStream.CopyTo($OutputStream); $OutputStream.Flush($true) }
            finally { $OutputStream.Dispose() }
        } finally { $InputStream.Dispose() }
    } finally { $Zip.Dispose() }

    Assert-RegularDestination $Destination
    if ([IO.File]::Exists($Destination)) {
        # Same-volume replacement preserves the previous binary if replacement fails.
        [IO.File]::Replace($StagedBinary, $Destination, $null)
    } else {
        [IO.File]::Move($StagedBinary, $Destination)
    }
    Write-Output "Installed lightjunction $Version to $Destination"
    if (($env:PATH -split ';') -notcontains $InstallDir) {
        Write-Output "Add $InstallDir to PATH to use lightjunction from any directory."
    }
} catch {
    Write-Error "lightjunction installer: $($_.Exception.Message)" -ErrorAction Continue
    exit 1
} finally {
    [Net.ServicePointManager]::SecurityProtocol = $OriginalTls
    if ($StagingDirectory -and [IO.Directory]::Exists($StagingDirectory)) {
        [IO.Directory]::Delete($StagingDirectory, $true)
    }
    if ($TemporaryDirectory -and [IO.Directory]::Exists($TemporaryDirectory)) {
        [IO.Directory]::Delete($TemporaryDirectory, $true)
    }
}
