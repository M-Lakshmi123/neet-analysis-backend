Add-Type -AssemblyName System.Drawing

$srcDir = 'E:\2026\Acadamic 2026-2027\sr_photos\SR\SR'
$outputJson = Join-Path $PSScriptRoot 'optimized_photos_temp.json'
$maxDim = 600

$allFiles = Get-ChildItem -Path $srcDir -Recurse -File | Where-Object { $_.Extension -match '\.(jpe?g|png)$' }
Write-Host "Found $($allFiles.Count) photos to process..."

$results = [System.Collections.Generic.List[PSCustomObject]]::new()
$sw = [System.Diagnostics.Stopwatch]::StartNew()

$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]85)

$count = 0
foreach ($f in $allFiles) {
    $count++
    try {
        $img = [System.Drawing.Image]::FromFile($f.FullName)
        $origW = $img.Width
        $origH = $img.Height
        
        $scale = 1.0
        if ($origW -gt $maxDim -or $origH -gt $maxDim) {
            if ($origW -gt $origH) {
                $scale = [double]$maxDim / $origW
            } else {
                $scale = [double]$maxDim / $origH
            }
        }
        
        $newW = [int]($origW * $scale)
        $newH = [int]($origH * $scale)
        
        $newBmp = New-Object System.Drawing.Bitmap($newW, $newH)
        $g = [System.Drawing.Graphics]::FromImage($newBmp)
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $g.DrawImage($img, 0, 0, $newW, $newH)
        
        $ms = New-Object System.IO.MemoryStream
        $newBmp.Save($ms, $encoder, $encoderParams)
        
        $bytes = $ms.ToArray()
        $base64 = [Convert]::ToBase64String($bytes)
        $dataUrl = "data:image/jpeg;base64," + $base64
        
        $g.Dispose()
        $newBmp.Dispose()
        $img.Dispose()
        $ms.Dispose()
        
        $results.Add([PSCustomObject]@{
            photoBase = [System.IO.Path]::GetFileNameWithoutExtension($f.Name).Trim()
            fileName = $f.Name
            relPath = $f.FullName.Substring($srcDir.Length).TrimStart('\', '/')
            dataUrl = $dataUrl
            sizeKB = [math]::Round($bytes.Length / 1024, 1)
        })
        
        if ($count % 50 -eq 0 -or $count -eq $allFiles.Count) {
            Write-Host "Processed $count / $($allFiles.Count) photos..."
        }
    } catch {
        Write-Warning "Error processing $($f.FullName): $_"
    }
}

$sw.Stop()
Write-Host "Processed $($results.Count) photos in $($sw.ElapsedMilliseconds) ms."

$json = $results | ConvertTo-Json -Depth 3 -Compress
[System.IO.File]::WriteAllText($outputJson, $json, [System.Text.Encoding]::UTF8)
Write-Host "Exported to $outputJson (file size: $([math]::Round((Get-Item $outputJson).Length / 1024 / 1024, 2)) MB)"
