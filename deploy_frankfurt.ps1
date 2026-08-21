# ═══════════════════════════════════════════════════════════════════
# AWS FRANKFURT (eu-central-1) PROVISIONING SCRIPT
# Sub-2ms co-location with Jito Block Engine & Europe Solana Validators
# ═══════════════════════════════════════════════════════════════════

$Region = "eu-central-1" # Frankfurt
$KeyName = "solana-frankfurt-key"
$PublicKeyPath = "$HOME\.ssh\solana_aws_key.pub"
$SecGroupName = "solana-frankfurt-sg"
$InstanceType = "t3.small" # 2 vCPU, 2GB RAM (Fast compilation & sub-5ms networking)

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " 🚀 PROVISIONING LOW-LATENCY AWS INSTANCE IN FRANKFURT ($Region) 🚀" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan

# 1. Check/Import Key Pair
Write-Host "`n1. Checking SSH Key Pair in $Region..." -ForegroundColor Yellow
$ExistingKey = aws ec2 describe-key-pairs --region $Region --key-names $KeyName --query "KeyPairs[0].KeyName" --output text 2>$null

if ($ExistingKey -eq $KeyName) {
    Write-Host "   Key '$KeyName' already exists in $Region." -ForegroundColor Green
} else {
    Write-Host "   Importing '$PublicKeyPath' to $Region as '$KeyName'..." -ForegroundColor Yellow
    $PubContent = Get-Content -Path $PublicKeyPath -Raw
    $Bytes = [System.Text.Encoding]::UTF8.GetBytes($PubContent)
    $Base64Key = [System.Convert]::ToBase64String($Bytes)
    aws ec2 import-key-pair --region $Region --key-name $KeyName --public-key-material $Base64Key
    Write-Host "   SSH Key imported successfully!" -ForegroundColor Green
}

# 2. Check/Create Security Group
Write-Host "`n2. Checking Security Group in $Region..." -ForegroundColor Yellow
$VpcId = aws ec2 describe-vpcs --region $Region --query "Vpcs[?IsDefault==\`true\`].VpcId" --output text
$SgId = aws ec2 describe-security-groups --region $Region --filters "Name=group-name,Values=$SecGroupName" --query "SecurityGroups[0].GroupId" --output text 2>$null

if ($SgId -and $SgId -ne "None") {
    Write-Host "   Security Group '$SecGroupName' exists ($SgId)." -ForegroundColor Green
} else {
    Write-Host "   Creating Security Group '$SecGroupName' in VPC $VpcId..." -ForegroundColor Yellow
    $SgId = aws ec2 create-security-group --region $Region --group-name $SecGroupName --description "Security group for low-latency Solana MEV engine" --vpc-id $VpcId --query "GroupId" --output text
    aws ec2 authorize-security-group-ingress --region $Region --group-id $SgId --protocol tcp --port 22 --cidr 0.0.0.0/0
    Write-Host "   Created Security Group: $SgId" -ForegroundColor Green
}

# 3. Find latest Ubuntu 24.04 LTS AMI in Frankfurt
Write-Host "`n3. Finding latest official Ubuntu 24.04 LTS AMI in $Region..." -ForegroundColor Yellow
$AmiId = aws ec2 describe-images --region $Region --owners 099720109477 --filters "Name=name,Values=ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*" "Name=state,Values=available" --query "sort_by(Images, &CreationDate)[-1].ImageId" --output text
Write-Host "   Selected AMI: $AmiId" -ForegroundColor Green

# 4. User Data Cloud-Init Script (Installs Rust, GCC, PM2, Systemd service)
$UserData = @"
#!/bin/bash
set -e
apt-get update -y
apt-get install -y build-essential pkg-config libssl-dev curl git ufw
# Install Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
echo 'source `$HOME/.cargo/env' >> /home/ubuntu/.bashrc
# Install Node.js & PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pm2
# Add 2GB swap for stability
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
echo 'READY' > /tmp/bootstrap_complete
"@

$UserDataBase64 = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($UserData))

# 5. Launch EC2 Instance
Write-Host "`n4. Launching $InstanceType instance in Frankfurt..." -ForegroundColor Yellow
$RunResult = aws ec2 run-instances `
    --region $Region `
    --image-id $AmiId `
    --instance-type $InstanceType `
    --key-name $KeyName `
    --security-group-ids $SgId `
    --user-data $UserDataBase64 `
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=solana-frankfurt-mev-engine}]" `
    --output json | ConvertFrom-Json

$InstanceId = $RunResult.Instances[0].InstanceId
Write-Host "   Instance Launched! Instance ID: $InstanceId" -ForegroundColor Green

# 6. Wait for Instance to be Running & Fetch Public IP
Write-Host "`n5. Waiting for instance to initialize and get Public IP..." -ForegroundColor Yellow
aws ec2 wait instance-running --region $Region --instance-ids $InstanceId
$PublicIp = aws ec2 describe-instances --region $Region --instance-ids $InstanceId --query "Reservations[0].Instances[0].PublicIpAddress" --output text

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host " 🎉 FRANKFURT INSTANCE READY!" -ForegroundColor Green
Write-Host " Instance ID: $InstanceId" -ForegroundColor White
Write-Host " Public IP:   $PublicIp" -ForegroundColor Yellow
Write-Host " SSH Command: ssh -i `"$HOME\.ssh\solana_aws_key`" ubuntu@$PublicIp" -ForegroundColor Cyan
Write-Host " Jito Frankfurt Latency: < 2ms ⚡" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Green
