param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("en-IN", "en-US", "hi-IN", "kn-IN", "ja-JP")]
    [string]$CultureName,
    [double]$MinConfidence = 0.35
)

$ErrorActionPreference = "Stop"
$engine = $null

function Write-Result($Result) {
    $json = ConvertTo-Json -InputObject $Result -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    [Console]::Out.WriteLine([Convert]::ToBase64String($bytes))
}

try {
    Add-Type -AssemblyName System.Speech
    $recognizerInfo = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers() |
        Where-Object { $_.Culture.Name -eq $CultureName } |
        Select-Object -First 1
    $actualCulture = $CultureName

    if ($null -eq $recognizerInfo -and $CultureName -eq "en-IN") {
        $recognizerInfo = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers() |
            Where-Object { $_.Culture.Name -eq "en-US" } |
            Select-Object -First 1
        if ($null -ne $recognizerInfo) { $actualCulture = "en-US" }
    }

    if ($null -eq $recognizerInfo) {
        Write-Result @{ ok = $false; code = "RECOGNIZER_NOT_INSTALLED"; cultureName = $CultureName }
        exit 0
    }

    $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine -ArgumentList $recognizerInfo
    $engine.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
    $engine.InitialSilenceTimeout = [TimeSpan]::FromSeconds(8)
    $engine.EndSilenceTimeout = [TimeSpan]::FromMilliseconds(900)
    $engine.EndSilenceTimeoutAmbiguous = [TimeSpan]::FromMilliseconds(1200)
    $engine.SetInputToDefaultAudioDevice()
    $result = $engine.Recognize([TimeSpan]::FromSeconds(20))

    if ($null -eq $result -or [string]::IsNullOrWhiteSpace($result.Text)) {
        Write-Result @{ ok = $false; code = "NO_SPEECH" }
        exit 0
    }

    $confidence = [double]$result.Confidence
    if ($confidence -lt $MinConfidence) {
        Write-Result @{
            ok = $false
            code = "LOW_CONFIDENCE"
            confidence = $confidence
            cultureName = $actualCulture
        }
        exit 0
    }

    Write-Result @{
        ok = $true
        code = "OK"
        text = $result.Text.Trim()
        confidence = $confidence
        lowConfidence = ($confidence -lt 0.50)
        cultureName = $actualCulture
    }
} catch [System.UnauthorizedAccessException] {
    Write-Result @{ ok = $false; code = "MICROPHONE_PERMISSION_DENIED" }
} catch [System.InvalidOperationException] {
    Write-Result @{ ok = $false; code = "MICROPHONE_UNAVAILABLE" }
} catch {
    Write-Result @{ ok = $false; code = "RECOGNITION_FAILED" }
} finally {
    if ($null -ne $engine) { $engine.Dispose() }
}
