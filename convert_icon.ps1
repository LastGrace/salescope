
Add-Type -AssemblyName System.Drawing

function Convert-PngToIco {
    param(
        [string]$InputFile,
        [string]$OutputFile
    )

    $src = [System.Drawing.Bitmap]::FromFile($InputFile)
    
    # Resize to 256x256
    $resized = new-object System.Drawing.Bitmap(256, 256)
    $graph = [System.Drawing.Graphics]::FromImage($resized)
    $graph.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graph.DrawImage($src, 0, 0, 256, 256)
    
    # Create a new icon from the resized bitmap handle
    $icon = [System.Drawing.Icon]::FromHandle($resized.GetHicon())
    
    $fileStream = [System.IO.File]::OpenWrite($OutputFile)
    $icon.Save($fileStream)
    $fileStream.Close()
    
    $src.Dispose()
    $resized.Dispose()
    $graph.Dispose()
    $icon.Dispose()
    
    Write-Host "Converted and resized $InputFile to $OutputFile (256x256)"
}

Convert-PngToIco -InputFile "d:\projects\ims\client\public\salescopepng.png" -OutputFile "d:\projects\ims\client\public\icon.ico"
