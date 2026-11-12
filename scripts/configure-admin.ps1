$ErrorActionPreference = "Stop"

$username = Read-Host "Username admin [admin]"
if ([string]::IsNullOrWhiteSpace($username)) {
  $username = "admin"
}
$username = $username.Trim()
if ($username -notmatch '^[A-Za-z0-9._-]{1,64}$') {
  throw "Username hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda hubung (maksimal 64 karakter)."
}

$securePassword = Read-Host "Password admin baru (minimal 14 karakter)" -AsSecureString
if ($securePassword.Length -lt 14) {
  throw "Gunakan password minimal 14 karakter."
}

$origins = Read-Host "APP_ORIGINS, pisahkan dengan koma (contoh: https://domainanda.com,http://localhost:5173)"
if ([string]::IsNullOrWhiteSpace($origins)) {
  throw "Origin produksi dan lokal harus diisi."
}
$validatedOrigins = @()
foreach ($origin in $origins.Split(",")) {
  $parsedOrigin = $null
  if (-not [Uri]::TryCreate($origin.Trim(), [UriKind]::Absolute, [ref]$parsedOrigin) -or $parsedOrigin.AbsolutePath -ne "/" -or $parsedOrigin.Query -or $parsedOrigin.Fragment) {
    throw "Origin tidak valid: $origin"
  }
  $validatedOrigins += $parsedOrigin.GetLeftPart([UriPartial]::Authority)
}
$origins = ($validatedOrigins | Select-Object -Unique) -join ","

$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
$passwordChars = New-Object char[] $securePassword.Length
$passwordBytes = $null
$salt = New-Object byte[] 16
$derivedKey = $null
$sessionSecretBytes = New-Object byte[] 32
$secretFile = Join-Path ([IO.Path]::GetTempPath()) ([Guid]::NewGuid().ToString() + ".env")

try {
  [Runtime.InteropServices.Marshal]::Copy($passwordPointer, $passwordChars, 0, $passwordChars.Length)
  $passwordBytes = [Text.Encoding]::UTF8.GetBytes($passwordChars)
  $random = [Security.Cryptography.RandomNumberGenerator]::Create()
  $random.GetBytes($salt)
  $random.GetBytes($sessionSecretBytes)
  $random.Dispose()
  $pbkdf2 = [Security.Cryptography.Rfc2898DeriveBytes]::new(
    $passwordBytes,
    $salt,
    310000,
    [Security.Cryptography.HashAlgorithmName]::SHA256
  )
  $derivedKey = $pbkdf2.GetBytes(32)
  $pbkdf2.Dispose()

  $passwordHash = "pbkdf2-sha256:310000:" + [BitConverter]::ToString($salt).Replace("-", "").ToLowerInvariant() + ":" + [BitConverter]::ToString($derivedKey).Replace("-", "").ToLowerInvariant()
  if ($passwordHash -notmatch '^pbkdf2-sha256:310000:[0-9a-f]{32}:[0-9a-f]{64}$') {
    throw "Hash password admin gagal dibuat dengan format yang benar."
  }
  $sessionSecret = [Convert]::ToBase64String($sessionSecretBytes)
  $lines = @(
    "ADMIN_USERNAME=$username",
    "ADMIN_PASSWORD_HASH=$passwordHash",
    "ADMIN_SESSION_SECRET=$sessionSecret",
    "APP_ORIGINS=$origins"
  )
  [IO.File]::WriteAllLines($secretFile, $lines, [Text.UTF8Encoding]::new($false))

  $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  & icacls $secretFile /inheritance:r /grant:r "${currentUser}:(F)" | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Tidak dapat mengunci akses file secret sementara."
  }

  & supabase secrets set --env-file $secretFile
  if ($LASTEXITCODE -ne 0) {
    throw "Supabase secrets set gagal. Periksa project yang sudah di-link dan statusnya."
  }
  Write-Host "Secret login admin berhasil disetel ke Supabase."
}
finally {
  if (Test-Path -LiteralPath $secretFile) {
    Remove-Item -LiteralPath $secretFile -Force
  }
  if ($passwordPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  }
  [Array]::Clear($passwordChars, 0, $passwordChars.Length)
  if ($passwordBytes) { [Array]::Clear($passwordBytes, 0, $passwordBytes.Length) }
  if ($derivedKey) { [Array]::Clear($derivedKey, 0, $derivedKey.Length) }
  if ($pbkdf2) { $pbkdf2.Dispose() }
  [Array]::Clear($sessionSecretBytes, 0, $sessionSecretBytes.Length)
  [Array]::Clear($salt, 0, $salt.Length)
}
