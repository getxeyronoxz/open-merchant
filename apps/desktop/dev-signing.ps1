# Creates the Open Merchant developer code-signing certificate and wires it
# for local electron-builder signing. No CA, no cost, no legal identity —
# the subject is the developer alias only.
#
# Usage:  powershell -File dev-signing.ps1
# Result: self-signed cert "CN=Open Merchant Developer" in CurrentUser\My,
#         exported to %LOCALAPPDATA%\open-merchant-signing\dev.pfx,
#         password stored beside it, cert trusted for THIS machine's
#         signature checks (CurrentUser\TrustedPeople).
#
# electron-builder picks it up automatically via CSC_LINK when set —
# see the usage lines at the bottom.

$ErrorActionPreference = "Stop"

$subject   = "CN=Open Merchant Developer"
$storeDir  = Join-Path $env:LOCALAPPDATA "open-merchant-signing"
New-Item -ItemType Directory -Force -Path $storeDir | Out-Null
$pfxPath   = Join-Path $storeDir "dev.pfx"
$passFile  = Join-Path $storeDir "dev.pass"

$existing = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert |
  Where-Object { $_.Subject -eq $subject }
if (-not $existing) {
  Write-Host "Creating self-signed code-signing certificate ($subject)..."
  $existing = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject $subject `
    -KeyUsage DigitalSignature `
    -FriendlyName "Open Merchant Developer" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -NotAfter (Get-Date).AddYears(5)
}

$password = if (Test-Path $passFile) {
  ConvertTo-SecureString (Get-Content $passFile) -AsPlainText -Force
} else {
  $plain = [guid]::NewGuid().ToString("N")
  Set-Content -Path $passFile -Value $plain
  ConvertTo-SecureString $plain -AsPlainText -Force
}

$existing | Where-Object { $_.HasPrivateKey } |
  Select-Object -First 1 |
  Export-PfxCertificate -FilePath $pfxPath -Password $password | Out-Null

# Trust it on this machine so signature checks verify locally. Authenticode
# chain checks require the root store, not just TrustedPeople.
foreach ($store in "TrustedPeople", "Root") {
  $trusted = Get-ChildItem "Cert:\CurrentUser\$store" |
    Where-Object { $_.Thumbprint -eq $existing[0].Thumbprint }
  if (-not $trusted) {
    $public = $existing[0] | Export-Certificate -FilePath (Join-Path $storeDir "$($existing[0].Thumbprint).cer")
    Import-Certificate -FilePath (Join-Path $storeDir "$($existing[0].Thumbprint).cer") -CertStoreLocation "Cert:\CurrentUser\$store" | Out-Null
  }
}

Write-Host ""
Write-Host "Developer signing ready (no legal name, self-signed)."
Write-Host "For a local signed build run from apps\desktop:"
Write-Host "  `$env:CSC_LINK = `"$pfxPath`"; `$env:CSC_KEY_PASSWORD = (Get-Content `"$passFile`"); pnpm exec electron-builder --win --publish never"
Write-Host "For GitHub Releases: add these as repo secrets CSC_LINK / CSC_KEY_PASSWORD."