# Run in a normal, non-Administrator PowerShell. No elevation or policy changes.
# Applies existing migrations only; never resets or seeds an application database.
[CmdletBinding()]
param(
  [ValidateRange(1024, 65535)][int]$WebPort = 3001,
  [ValidateRange(1024, 65535)][int]$ApiPort = 4001,
  [switch]$VerifyIntegrations,
  # Verify the staging read contract before enabling real catalogue/search reads.
  [switch]$EnableTboReads
)

$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
$currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
try {
  $currentPrincipal = [Security.Principal.WindowsPrincipal]::new($currentIdentity)
  if ($currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "PostgreSQL cannot run in an Administrator terminal. Close this window, open PowerShell normally (do not select 'Run as administrator'), then run: & '$PSCommandPath'"
  }
} finally {
  $currentIdentity.Dispose()
}
$originalLocation = Get-Location
$previousReads = $env:TBO_READS_ENABLED
$previousMode = $env:HOTEL_DATA_MODE
$previousVerifyDependencies = $env:pnpm_config_verify_deps_before_run
$previousTemp = $env:TEMP
$previousTmp = $env:TMP
$processSettings = @{}
foreach ($name in @('PORT', 'HOST', 'WEB_ORIGIN', 'NEXT_PUBLIC_API_URL')) {
  $processSettings[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
$webUrl = 'http://localhost:' + $WebPort
$apiUrl = 'http://localhost:' + $ApiPort + '/api/v1'
if ($WebPort -eq $ApiPort) { throw 'Frontend and API ports must be different.' }
$script:runDirectory = $null
$script:setupStage = 'Checking local configuration'

function Write-SetupStatus {
  param([string]$Message)
  $line = (Get-Date -Format 'yyyy-MM-ddTHH:mm:sszzz') + ' ' + $Message
  Write-Host $line
  if ($script:runDirectory) {
    Add-Content -LiteralPath (Join-Path $script:runDirectory 'setup-status.log') -Value $line -Encoding UTF8
  }
}

function Set-SetupStage {
  param([string]$Name)
  $script:setupStage = $Name
  Write-SetupStatus ('START ' + $Name)
}

function Invoke-Pnpm {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)
  Set-SetupStage ('pnpm ' + ($Arguments -join ' '))
  & $script:nodeExecutable $script:pnpmEntry @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw ('Command failed: pnpm ' + ($Arguments -join ' ') + '. Setup stopped.')
  }
  Write-SetupStatus ('DONE ' + $script:setupStage)
}

function Test-LocalPort {
  param([string]$HostName, [int]$Port)
  $connection = [Net.Sockets.TcpClient]::new()
  try {
    $attempt = $connection.ConnectAsync($HostName, $Port)
    return ($attempt.Wait(1500) -and $connection.Connected)
  } catch {
    $failure = $_.Exception
    while ($failure.InnerException) { $failure = $failure.InnerException }
    if ($failure -is [Net.Sockets.SocketException] -and $failure.SocketErrorCode -eq [Net.Sockets.SocketError]::AccessDenied) {
      throw 'This terminal is denied local network access (WSAEACCES/10013). Run this launcher in a normal, non-Administrator PowerShell outside the restricted command runner. HTTP, CORS and firewall changes cannot fix a denied socket.'
    }
    return $false
  } finally {
    $connection.Dispose()
  }
}

function Start-AppProcess {
  param([string]$Name, [string[]]$Arguments)
  $process = Start-Process -FilePath $script:nodeExecutable `
    -ArgumentList (@('"' + $script:pnpmEntry + '"') + $Arguments) `
    -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $script:runDirectory ($Name + '.out.log')) `
    -RedirectStandardError (Join-Path $script:runDirectory ($Name + '.err.log'))
  Write-Host ($Name + ' launched (PID ' + $process.Id + '). Logs: ' + $script:runDirectory)
  return $process
}

try {
  Set-Location -LiteralPath $projectRoot
  foreach ($required in @('.env', 'apps/web/.env.local', 'node_modules')) {
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot $required))) {
      throw ('Missing ' + $required + '. Complete repository setup before running this launcher.')
    }
  }
  $script:nodeExecutable = (Get-Command node.exe -ErrorAction Stop).Source
  $script:pnpmEntry = Join-Path (Split-Path $script:nodeExecutable) 'node_modules/corepack/dist/pnpm.js'
  if (-not (Test-Path -LiteralPath $script:pnpmEntry)) {
    throw 'This launcher requires the existing Node.js/Corepack installation.'
  }
  $script:runDirectory = Join-Path $projectRoot ('test-results/local-run-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
  New-Item -ItemType Directory -Path $script:runDirectory -Force | Out-Null
  Set-SetupStage 'Checking local configuration'
  $env:TEMP = $script:runDirectory
  $env:TMP = $script:runDirectory
  $env:pnpm_config_verify_deps_before_run = 'false'
  $env:HOTEL_DATA_MODE = 'live'
  $env:PORT = [string]$ApiPort
  $env:HOST = '127.0.0.1'
  $env:WEB_ORIGIN = $webUrl
  $env:NEXT_PUBLIC_API_URL = $apiUrl

  # Print only non-secret connection coordinates; credentials stay in .env/process env.
  $configurationCheck = @'
try {
  const db = new URL(process.env.DATABASE_URL);
  const testDb = new URL(process.env.TEST_DATABASE_URL);
  const redis = new URL(process.env.REDIS_URL);
  const local = url => ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (process.env.NODE_ENV === 'production' || !local(db) || !local(testDb) || !local(redis)) throw new Error();
  if (!['postgres:', 'postgresql:'].includes(db.protocol) || !['postgres:', 'postgresql:'].includes(testDb.protocol) || !['redis:', 'rediss:'].includes(redis.protocol)) throw new Error();
  if (db.pathname === testDb.pathname || !/(?:^|[_-])test(?:$|[_-])/i.test(testDb.pathname.slice(1))) throw new Error();
  console.log(JSON.stringify({dbHost:db.hostname,dbPort:Number(db.port||5432),redisHost:redis.hostname,redisPort:Number(redis.port||6379),readsEnabled:process.env.TBO_READS_ENABLED==='true'}));
} catch {
  console.error('Local setup requires valid loopback database/Redis URLs and a distinct test database.');
  process.exitCode = 1;
}
'@
  $coordinates = $configurationCheck | & $script:nodeExecutable --env-file=.env
  if ($LASTEXITCODE -ne 0) { throw 'Environment checks failed; no migration was attempted.' }
  $settings = $coordinates | ConvertFrom-Json
  $env:TBO_READS_ENABLED = 'false'

  Set-SetupStage 'Checking PostgreSQL and Redis'
  $databaseReady = Test-LocalPort $settings.dbHost $settings.dbPort
  $redisReady = Test-LocalPort $settings.redisHost $settings.redisPort
  $nativePostgres = Join-Path $projectRoot '.local/postgres/start.ps1'
  $useNativePostgres = (Test-Path -LiteralPath $nativePostgres) -and $settings.dbPort -eq 54329
  if (-not $databaseReady -and $useNativePostgres) {
    Set-SetupStage 'Starting workspace PostgreSQL'
    & $nativePostgres
    # The helper throws on failure; an earlier pg_ctl status can leave a stale
    # LASTEXITCODE after successful startup. Check the actual socket instead.
    $databaseReady = Test-LocalPort $settings.dbHost $settings.dbPort
  }
  if (-not $redisReady -or -not $databaseReady) {
    Set-SetupStage 'Starting Docker dependencies'
    if ($settings.dbPort -ne 54329 -or $settings.redisPort -ne 63799) {
      throw 'Custom dependency ports must already be running; this launcher only starts the repository defaults.'
    }
    $dockerExecutable = (Get-Command docker.exe -ErrorAction Stop).Source
    # Windows PowerShell 5.1 turns native stderr into a terminating error under
    # Stop, even when redirected. An offline daemon is an expected probe result.
    $probeErrorPreference = $ErrorActionPreference
    try {
      $ErrorActionPreference = 'Continue'
      & $dockerExecutable info --format '{{.ServerVersion}}' *> $null
      $dockerInfoExitCode = $LASTEXITCODE
    } finally {
      $ErrorActionPreference = $probeErrorPreference
    }
    if ($dockerInfoExitCode -ne 0) {
      & $dockerExecutable desktop start --timeout 60
      if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop could not start. Inspect Docker Desktop before retrying.' }
    }
    $services = @()
    if (-not $redisReady) { $services += 'redis' }
    if (-not $databaseReady -and -not $useNativePostgres) { $services += 'postgres' }
    if ($services.Count -gt 0) {
      & $dockerExecutable compose -f docker/compose.yaml up -d --wait @services
      if ($LASTEXITCODE -ne 0) { throw 'A required local dependency could not start.' }
    }
  }
  if (-not (Test-LocalPort $settings.dbHost $settings.dbPort) -or -not (Test-LocalPort $settings.redisHost $settings.redisPort)) {
    throw 'PostgreSQL or Redis is unreachable. Check local network access; no migration was attempted.'
  }
  Set-SetupStage 'Checking application ports'
  if (Test-LocalPort '127.0.0.1' $ApiPort) {
    throw ('API port ' + $ApiPort + ' is already in use. Choose another -ApiPort; this launcher never stops unidentified processes.')
  }
  if (Test-LocalPort '127.0.0.1' $WebPort) {
    throw ('Frontend port ' + $WebPort + ' is already in use. Choose another -WebPort; an existing frontend may target a different API.')
  }

  # Windows locks Prisma's engine DLL while another API is using it. Reuse the
  # generated client only when its complete schema and version match this checkout.
  $clientCheck = @'
const { createRequire } = require('node:module');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
try {
  const apiRequire = createRequire(resolve('apps/api/package.json'));
  const clientRequire = createRequire(apiRequire.resolve('@prisma/client'));
  const source = readFileSync('apps/api/prisma/schema.prisma', 'utf8').replace(/\r\n/g, '\n');
  const generated = readFileSync(clientRequire.resolve('.prisma/client/schema.prisma'), 'utf8').replace(/\r\n/g, '\n');
  const versionMatches = apiRequire('@prisma/client').Prisma.prismaVersion.client === apiRequire('@prisma/client/package.json').version;
  process.stdout.write(source === generated && versionMatches ? 'current' : 'generate');
} catch { process.stdout.write('generate'); }
'@
  $clientState = $clientCheck | & $script:nodeExecutable -
  if ($LASTEXITCODE -ne 0) { throw 'Could not check the generated database client.' }
  if ($clientState -eq 'current') {
    Write-SetupStatus 'Reusing generated Prisma client; schema and version match.'
  } else {
    Invoke-Pnpm -Arguments @('db:generate')
  }
  Invoke-Pnpm -Arguments @('--filter', '@hotel/contracts', 'build')
  Invoke-Pnpm -Arguments @('--filter', '@hotel/api', 'build')
  Invoke-Pnpm -Arguments @('db:deploy')
  if ($VerifyIntegrations) {
    Invoke-Pnpm -Arguments @('--filter', '@hotel/api', 'db:test:deploy')
    Invoke-Pnpm -Arguments @('test:integration')
  }
  if ($VerifyIntegrations -or $EnableTboReads) {
    Invoke-Pnpm -Arguments @('--filter', '@hotel/api', 'tbo:verify')
  }

  # A schema smoke test does not certify the account's pricing agreement.
  # An explicit read-only launch can enable reads only after verification succeeds.
  # This does not persist a gate change or enable supplier booking/payment operations.
  $readsEnabled = $settings.readsEnabled -or $EnableTboReads
  $env:TBO_READS_ENABLED = [string]$readsEnabled.ToString().ToLowerInvariant()
  if ($readsEnabled -and ($VerifyIntegrations -or $EnableTboReads)) {
    Invoke-Pnpm -Arguments @('--filter', '@hotel/api', 'catalog:sync')
  } else {
    Write-Host 'Preserving the configured supplier read gate. Use -EnableTboReads to verify and launch real hotel search.'
  }
  Set-SetupStage 'Starting the API and frontend'
  $apiProcess = Start-AppProcess 'api' @('--filter', '@hotel/api', 'start')
  $webProcess = $null
  $webProcess = Start-AppProcess 'web' @('--filter', '@hotel/web', 'exec', 'next', 'dev', '--port', [string]$WebPort, '--hostname', '127.0.0.1', '--webpack')

  Set-SetupStage 'Waiting for application readiness'
  $ready = $false
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    try {
      $apiResponse = Invoke-WebRequest -Uri ($apiUrl + '/health/ready') -UseBasicParsing -TimeoutSec 5
      $webResponse = Invoke-WebRequest -Uri ($webUrl + '/') -UseBasicParsing -TimeoutSec 10
      if ($apiResponse.StatusCode -eq 200 -and $webResponse.StatusCode -eq 200 -and $webResponse.Content -match 'name="application-name"\s+content="Best Holiday Packages"') { $ready = $true; break }
    } catch {
      $apiProcess.Refresh()
      if ($apiProcess.HasExited) { throw ('API exited. Inspect logs in ' + $script:runDirectory) }
      if ($webProcess) {
        $webProcess.Refresh()
        if ($webProcess.HasExited) { throw ('Frontend exited. Inspect logs in ' + $script:runDirectory) }
      }
    }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw ('App readiness was not confirmed. Inspect logs in ' + $script:runDirectory) }
  Write-SetupStatus 'DONE Application readiness confirmed'
  Write-Host ('App ready at ' + $webUrl + '. API: ' + $apiUrl)
  if (-not $readsEnabled) { Write-Host 'Live hotel search is disabled. Relaunch with -EnableTboReads to verify the account and load real hotels.' }
} catch {
  # Record only the known stage, never raw command output or exception content.
  Write-SetupStatus ('FAILED ' + $script:setupStage + '. See the terminal error for details.')
  throw
} finally {
  $env:TBO_READS_ENABLED = $previousReads
  $env:HOTEL_DATA_MODE = $previousMode
  $env:pnpm_config_verify_deps_before_run = $previousVerifyDependencies
  $env:TEMP = $previousTemp
  $env:TMP = $previousTmp
  foreach ($name in $processSettings.Keys) {
    [Environment]::SetEnvironmentVariable($name, $processSettings[$name], 'Process')
  }
  Set-Location -LiteralPath $originalLocation
}
