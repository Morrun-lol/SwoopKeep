param(
  [string]$Profile = "default",
  [string]$Region = "cn-hangzhou"
)

$configPath = Join-Path $env:USERPROFILE ".aliyun\config.json"
if (-not (Test-Path $configPath)) {
  Write-Error ("Aliyun CLI config not found: {0}. Please run: aliyun configure" -f $configPath)
  exit 1
}

$cfg = Get-Content $configPath -Raw | ConvertFrom-Json
$profiles = @($cfg.profiles)
$p = $profiles | Where-Object { $_.name -eq $Profile } | Select-Object -First 1
if (-not $p) {
  $names = ($profiles | ForEach-Object { $_.name }) -join ", "
  Write-Error ("Profile not found: {0}. Available profiles: {1}" -f $Profile, $names)
  exit 1
}

if ($p.mode -ne "AK") {
  Write-Error ("Profile {0} mode is {1}. This script supports AK mode only." -f $Profile, $p.mode)
  exit 1
}

if (-not $p.access_key_id -or -not $p.access_key_secret) {
  Write-Error ("Profile {0} missing access_key_id/access_key_secret. Please re-run: aliyun configure" -f $Profile)
  exit 1
}

$env:ALICLOUD_ACCESS_KEY = $p.access_key_id
$env:ALICLOUD_SECRET_KEY = $p.access_key_secret
$env:ALICLOUD_REGION = $Region
$env:ALICLOUD_PROFILE = $Profile

Write-Host ("AliCloud credentials loaded into current session. profile={0} region={1} (secrets not printed)" -f $Profile, $Region)
