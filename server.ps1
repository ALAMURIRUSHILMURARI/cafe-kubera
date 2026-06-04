$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8080/")
$listener.Start()
Write-Host "Listening on http://localhost:8080/ ..."

# Helper to read database
function Get-Database {
    $dbPath = "C:\Users\RUSHIL MURARI\.gemini\antigravity\scratch\cafe-kubera\database.json"
    if (Test-Path $dbPath) {
        $content = Get-Content $dbPath -Raw
        return $content | ConvertFrom-Json
    }
    return $null
}

# Helper to write database
function Save-Database($db) {
    $dbPath = "C:\Users\RUSHIL MURARI\.gemini\antigravity\scratch\cafe-kubera\database.json"
    $json = $db | ConvertTo-Json -Depth 5
    $json | Out-File $dbPath -Encoding utf8
}

# 20-minute timeout check
function Check-Timeouts {
    $db = Get-Database
    if ($null -eq $db) { return }
    $changed = $false
    $now = [DateTime]::Now
    
    foreach ($res in $db.reservations) {
        if ($res.status -eq "pending" -or $res.status -eq "approved" -or $res.status -eq "reserved") {
            try {
                $dateTimeStr = "$($res.date) $($res.time)"
                $resDateTime = [DateTime]::ParseExact($dateTimeStr, "yyyy-MM-dd HH:mm", $null)
                
                # Check if current time is > 20 mins past start time
                if ($now -gt $resDateTime.AddMinutes(20)) {
                    $res.status = "no-show"
                    $changed = $true
                    
                    # Release the table
                    foreach ($tbl in $db.tables) {
                        if ($tbl.id -eq $res.table) {
                            $tbl.status = "available"
                            $tbl.currentReservationId = $null
                        }
                    }
                    Write-Host "Reservation $($res.id) for Table $($res.table) timed out (No-Show)."
                }
            } catch {
                # Ignore date parse issues
            }
        }
    }
    if ($changed) {
        Save-Database $db
    }
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        # Always run timeout check first
        Check-Timeouts
        
        $urlPath = $request.Url.LocalPath
        $method = $request.HttpMethod
        
        # API ROUTING
        if ($urlPath.StartsWith("/api/")) {
            $response.ContentType = "application/json"
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $response.AddHeader("Access-Control-Allow-Headers", "Content-Type")
            $response.AddHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
            
            # Handle Preflight OPTIONS
            if ($method -eq "OPTIONS") {
                $response.StatusCode = 200
                $response.Close()
                continue
            }
            
            # GET /api/tables
            if ($urlPath -eq "/api/tables" -and $method -eq "GET") {
                $db = Get-Database
                $bytes = [System.Text.Encoding]::UTF8.GetBytes(($db.tables | ConvertTo-Json -Depth 5))
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
            
            # GET /api/reservations
            elseif ($urlPath -eq "/api/reservations" -and $method -eq "GET") {
                $db = Get-Database
                $bytes = [System.Text.Encoding]::UTF8.GetBytes(($db.reservations | ConvertTo-Json -Depth 5))
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
            
            # POST /api/reservations (Book online)
            elseif ($urlPath -eq "/api/reservations" -and $method -eq "POST") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $reader.Close()
                
                $data = $body | ConvertFrom-Json
                $db = Get-Database
                
                $newResId = [Guid]::NewGuid().ToString()
                $newRes = [PSCustomObject]@{
                    id        = $newResId
                    name      = $data.name
                    email     = $data.email
                    phone     = $data.phone
                    table     = $data.table # String ID (e.g. A1)
                    date      = $data.date
                    time      = $data.time
                    status    = "pending"
                    createdAt = [DateTime]::UtcNow.ToString("o")
                }
                
                # Update table status to reserved
                $tableUpdated = $false
                foreach ($tbl in $db.tables) {
                    if ($tbl.id -eq $data.table -and $tbl.status -eq "available") {
                        $tbl.status = "reserved"
                        $tbl.currentReservationId = $newResId
                        $tableUpdated = $true
                    }
                }
                
                if ($tableUpdated) {
                    # Add to reservations list
                    $db.reservations += $newRes
                    Save-Database $db
                    
                    $response.StatusCode = 201
                    $resObj = [PSCustomObject]@{ success = $true; reservationId = $newResId }
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($resObj | ConvertTo-Json))
                } else {
                    $response.StatusCode = 400
                    $resObj = [PSCustomObject]@{ success = $false; error = "Table is not available." }
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($resObj | ConvertTo-Json))
                }
                
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
            
            # PATCH /api/reservations (Update reservation state)
            elseif ($urlPath -eq "/api/reservations" -and $method -eq "PATCH") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $reader.Close()
                
                $data = $body | ConvertFrom-Json
                $db = Get-Database
                $updated = $false
                
                foreach ($res in $db.reservations) {
                    if ($res.id -eq $data.id) {
                        $res.status = $data.status # 'reached', 'cancelled', 'left', 'no-show'
                        $updated = $true
                        
                        # Sync Table states
                        foreach ($tbl in $db.tables) {
                            if ($tbl.id -eq $res.table) {
                                if ($data.status -eq "reached") {
                                    $tbl.status = "occupied"
                                } elseif ($data.status -eq "left" -or $data.status -eq "cancelled" -or $data.status -eq "no-show") {
                                    $tbl.status = "available"
                                    $tbl.currentReservationId = $null
                                }
                            }
                        }
                    }
                }
                
                if ($updated) {
                    Save-Database $db
                    $response.StatusCode = 200
                    $resObj = [PSCustomObject]@{ success = $true }
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($resObj | ConvertTo-Json))
                } else {
                    $response.StatusCode = 404
                    $resObj = [PSCustomObject]@{ success = $false; error = "Reservation not found." }
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($resObj | ConvertTo-Json))
                }
                
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
            
            # POST /api/tables/block (Block table offline walk-in)
            elseif ($urlPath -eq "/api/tables/block" -and $method -eq "POST") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $reader.Close()
                
                $data = $body | ConvertFrom-Json
                $db = Get-Database
                $updated = $false
                
                foreach ($tbl in $db.tables) {
                    if ($tbl.id -eq $data.table -and $tbl.status -eq "available") {
                        $tbl.status = "blocked-walkin"
                        $updated = $true
                    }
                }
                
                if ($updated) {
                    Save-Database $db
                    $response.StatusCode = 200
                    $resObj = [PSCustomObject]@{ success = $true }
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($resObj | ConvertTo-Json))
                } else {
                    $response.StatusCode = 400
                    $resObj = [PSCustomObject]@{ success = $false; error = "Table is not available for blocking." }
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($resObj | ConvertTo-Json))
                }
                
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
            
            # POST /api/tables/release (Release table)
            elseif ($urlPath -eq "/api/tables/release" -and $method -eq "POST") {
                $reader = New-Object System.IO.StreamReader($request.InputStream, [System.Text.Encoding]::UTF8)
                $body = $reader.ReadToEnd()
                $reader.Close()
                
                $data = $body | ConvertFrom-Json
                $db = Get-Database
                $updated = $false
                
                foreach ($tbl in $db.tables) {
                    if ($tbl.id -eq $data.table) {
                        $tbl.status = "available"
                        $tbl.currentReservationId = $null
                        $updated = $true
                    }
                }
                
                if ($updated) {
                    Save-Database $db
                    $response.StatusCode = 200
                    $resObj = [PSCustomObject]@{ success = $true }
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($resObj | ConvertTo-Json))
                } else {
                    $response.StatusCode = 404
                    $resObj = [PSCustomObject]@{ success = $false }
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes(($resObj | ConvertTo-Json))
                }
                
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
            
            # Fallback 404 for APIs
            else {
                $response.StatusCode = 404
                $resObj = [PSCustomObject]@{ error = "API Route Not Found" }
                $bytes = [System.Text.Encoding]::UTF8.GetBytes(($resObj | ConvertTo-Json))
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
            
            $response.Close()
            continue
        }
        
        # STATIC FILES ROUTING
        if ($urlPath -eq "/") { $urlPath = "/index.html" }
        $localPath = Join-Path "C:\Users\RUSHIL MURARI\.gemini\antigravity\scratch\cafe-kubera" $urlPath.TrimStart('/')
        
        if (Test-Path $localPath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($localPath)
            $extension = [System.IO.Path]::GetExtension($localPath)
            
            switch ($extension) {
                ".html" { $contentType = "text/html; charset=utf-8" }
                ".css"  { $contentType = "text/css" }
                ".js"   { $contentType = "application/javascript" }
                default { $contentType = "application/octet-stream" }
            }
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $bytes = [System.Text.Encoding]::UTF8.GetBytes("File not found")
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        }
        $response.Close()
    }
} finally {
    $listener.Stop()
}
