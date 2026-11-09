$ErrorActionPreference = 'Stop'

$targetRoot = Join-Path $env:USERPROFILE '.nodejs'
$extractedDir = Join-Path $targetRoot 'node-v20.18.0-win-x64'
$nodeExe = Join-Path $extractedDir 'node.exe'

if (Test-Path $nodeExe) {
    Write-Host "Node.js already exists at: $nodeExe"
} else {
    if (!(Test-Path $targetRoot)) {
        New-Item -ItemType Directory -Path $targetRoot -Force | Out-Null
    }

    $zipUrl = 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-win-x64.zip'
    $zipFile = Join-Path $env:TEMP 'node-v20.18.0-win-x64.zip'

    Write-Host "Downloading Node.js v20.18.0 LTS from $zipUrl..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
    
    $wc = New-Object System.Net.WebClient
    $wc.DownloadFile($zipUrl, $zipFile)
    
    Write-Host "Extracting archive to $targetRoot..."
    Expand-Archive -Path $zipFile -DestinationPath $targetRoot -Force
    Remove-Item -Path $zipFile -Force
}

# Update User PATH if not already present
$currentPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($currentPath -notlike "*$extractedDir*") {
    $newPath = "$extractedDir;$currentPath"
    [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
    Write-Host "Added $extractedDir to User PATH."
}

# Test execution
& $nodeExe -v
$npmCli = Join-Path $extractedDir 'npm.cmd'
& $npmCli -v
Write-Host "Node.js and npm successfully configured!"

