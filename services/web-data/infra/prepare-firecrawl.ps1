param([Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference='Stop'
$lock=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'firecrawl.lock.json') -Raw | ConvertFrom-Json
if(Test-Path -LiteralPath $Destination){throw 'Use a new empty destination; existing directories are preserved.'}
git clone --no-checkout $lock.repository $Destination
if($LASTEXITCODE -ne 0){throw 'Upstream clone failed.'}
git -C $Destination checkout --detach $lock.commit
if($LASTEXITCODE -ne 0){throw 'Pinned checkout failed.'}
$actual=(git -C $Destination rev-parse HEAD).Trim()
if($actual -ne $lock.commit){throw 'Upstream pin mismatch.'}
Write-Output "Prepared pinned upstream $actual. Do not expose its unauthenticated API. Browser release remains gated by DEPLOYMENT.md."
