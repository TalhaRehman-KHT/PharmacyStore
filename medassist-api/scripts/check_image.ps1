# Build the production image and check it (Windows PowerShell 5.1+). Run inside medassist-api/:
#   powershell -ExecutionPolicy Bypass -File scripts\check_image.ps1 [-WithRerank]
# Uses a FAKE test env only (no real keys), so /health must be 200 and /ready must be 503
# (the fake database cannot be reached: the container fails closed instead of claiming ready).
param(
    [string]$Image = "medassist-api:check",
    [int]$Port = 18000,
    [switch]$WithRerank  # build with WITH_RERANK=true and check the baked FlashRank model
)
$ErrorActionPreference = "Stop"
$name = "medassist-api-check"
$failed = 0

function Result([string]$label, [bool]$ok, [string]$detail = "") {
    if ($ok) { Write-Host "PASS  $label $detail" } else { Write-Host "FAIL  $label $detail"; $script:failed++ }
}

function Status([string]$url) {
    try { return (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10).StatusCode }
    catch { if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode } return 0 }
}

Write-Host "== build $Image"
$rerankArg = if ($WithRerank) { "true" } else { "false" }
docker build --build-arg "WITH_RERANK=$rerankArg" -t $Image .
if ($LASTEXITCODE -ne 0) { throw "docker build failed" }

$size = docker image inspect $Image --format "{{.Size}}"
Write-Host ("== image size: {0:N0} MB" -f ([int64]$size / 1MB))
Write-Host "== top 5 layers"
docker history $Image --format "{{.Size}}`t{{.CreatedBy}}" | ForEach-Object {
    $parts = $_ -split "`t", 2
    $text = $parts[1]
    if ($text.Length -gt 90) { $text = $text.Substring(0, 90) + "..." }
    [pscustomobject]@{ Size = $parts[0]; Step = $text }
} | Sort-Object { $s = $_.Size; if ($s -match "^([\d.]+)(kB|MB|GB|B)$") {
        [double]$matches[1] * @{ B = 1; kB = 1e3; MB = 1e6; GB = 1e9 }[$matches[2]] } else { 0 } } -Descending |
    Select-Object -First 5 | Format-Table -AutoSize | Out-String | Write-Host

Write-Host "== static checks"
$uid = (docker run --rm --entrypoint id $Image -u).Trim()
Result "runs as non-root" ($uid -ne "0") "(uid $uid)"

$envFiles = docker run --rm --entrypoint sh $Image -c "find / -xdev -name '.env' -not -path '/proc/*' 2>/dev/null"
Result ".env not in image" ([string]::IsNullOrWhiteSpace(($envFiles -join ""))) ($envFiles -join " ")

$unwanted = docker run --rm --entrypoint sh $Image -c "ls -d /srv/scripts /srv/prompts /srv/.local /srv/tests /srv/sql 2>/dev/null"
Result "no scripts/prompts/tests in /srv" ([string]::IsNullOrWhiteSpace(($unwanted -join ""))) ($unwanted -join " ")

$rerank = (docker run --rm --entrypoint sh $Image -c "python -c 'import flashrank' 2>/dev/null && echo yes; ls /srv/data/flashrank 2>/dev/null") -join " "
$rerank = $rerank.Trim()
if ($WithRerank) {
    Result "flashrank installed + model baked" ($rerank -match "^yes\s+\S") ($rerank -replace "\s+", " ")
} else {
    Result "no flashrank, no /srv/data" ([string]::IsNullOrWhiteSpace($rerank)) $rerank
}

# Secret-shaped values (Groq gsk_, Google AIza, JWT eyJ, Stripe sk_) or KEY=value assignments in any layer command.
# GPG_KEY is the base image's public Python release-signing fingerprint, not a secret.
$history = ((docker history --no-trunc $Image --format "{{.CreatedBy}}") -join "`n") -replace "GPG_KEY=[0-9A-F]+", ""
$secretPattern = "gsk_[A-Za-z0-9]{10,}|AIza[0-9A-Za-z_-]{20,}|eyJ[A-Za-z0-9_-]{20,}|sk_(live|test)_[A-Za-z0-9]{10,}|(KEY|SECRET|TOKEN|PASSWORD|DATABASE_URL)=[^ ]+"
Result "docker history has no secret values" (-not ($history -match $secretPattern))

Write-Host "== run with a fake test env on port $Port"
docker rm -f $name 2>$null | Out-Null
# An env file (not -e) because Windows PowerShell 5.1 strips the quotes inside the CORS JSON list.
$envFile = Join-Path ([System.IO.Path]::GetTempPath()) "medassist-check.env"
@(
    "APP_ENV=prod",
    'CORS_ORIGINS=["https://example.com"]',
    "SUPABASE_URL=https://check.invalid",
    "SUPABASE_SERVICE_KEY=fake-service-key",
    "GROQ_API_KEY=fake-groq-key",
    "GEMINI_API_KEY=fake-gemini-key",
    "RERANK_ENABLED=$rerankArg"
) | Set-Content -Path $envFile -Encoding ascii
docker run -d --name $name -p "${Port}:8000" --env-file $envFile $Image | Out-Null
if ($LASTEXITCODE -ne 0) { throw "docker run failed" }

try {
    $health = 0
    for ($i = 0; $i -lt 30 -and $health -ne 200; $i++) {
        Start-Sleep -Seconds 1
        $health = Status "http://127.0.0.1:$Port/health"
    }
    Result "/health 200" ($health -eq 200) "(got $health)"
    $ready = Status "http://127.0.0.1:$Port/ready"
    Result "/ready 503 with the fake database" ($ready -eq 503) "(got $ready)"

    # Docker's own HEALTHCHECK (first probe after the 30 s interval; skip waiting if it is still starting)
    Start-Sleep -Seconds 2
    $state = docker inspect $name --format "{{.State.Health.Status}}"
    Result "HEALTHCHECK defined" ($state -in @("starting", "healthy")) "(state $state)"
}
finally {
    Write-Host "== stop and remove"
    docker rm -f $name | Out-Null
    Remove-Item $envFile -ErrorAction SilentlyContinue
}

if ($failed -gt 0) { Write-Host "$failed check(s) FAILED"; exit 1 }
Write-Host "ALL PASS"
