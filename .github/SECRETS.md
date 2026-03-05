# GitHub Secrets Configuration

## Required Secrets for TripSalama Deployment

### Critical Secrets (Required)

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `SSH_PRIVATE_KEY` | SSH private key for VPS access | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `DB_PASSWORD` | MySQL database password for production | Strong password (16+ chars) |

### Android Build Secrets

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `KEYSTORE_BASE64` | Base64-encoded Android keystore file | `base64 -i release.keystore` |
| `KEYSTORE_PASSWORD` | Keystore password | Strong password |
| `KEY_ALIAS` | Key alias in keystore | `tripsalama-release` |
| `KEY_PASSWORD` | Key password | Strong password |

### Email/Notification Secrets

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `SMTP_USERNAME` | SMTP server username | `noreply@tripsalama.com` |
| `SMTP_PASSWORD` | SMTP server password | App-specific password |

### Optional Deployment Secrets

| Secret Name | Description | Used By |
|-------------|-------------|---------|
| `STAGING_DEPLOY_KEY` | SSH key for staging server | `ci.yml` staging deploy |
| `STAGING_HOST` | Staging server hostname | `ci.yml` staging deploy |
| `INFOMANIAK_FTP_HOST` | Infomaniak FTP hostname | `ci.yml` production deploy |
| `INFOMANIAK_FTP_USER` | Infomaniak FTP username | `ci.yml` production deploy |
| `INFOMANIAK_FTP_PASSWORD` | Infomaniak FTP password | `ci.yml` production deploy |

## How to Add Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret**
4. Enter the secret name and value
5. Click **Add secret**

## Security Best Practices

- Never commit secrets to the repository
- Use strong, unique passwords (16+ characters)
- Rotate secrets periodically
- Use environment-specific secrets when possible
- Enable branch protection to prevent unauthorized access

## Generating Strong Passwords

```bash
# Generate a 32-character random password
openssl rand -base64 32

# Generate a 16-character alphanumeric password
openssl rand -hex 16
```

## Converting Keystore to Base64

```bash
# Encode keystore file
base64 -i android/app/release.keystore > keystore.txt

# Copy the content of keystore.txt to KEYSTORE_BASE64 secret
```
