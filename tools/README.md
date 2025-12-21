# Vinyl Vault Setup Tools

Automation tools for setting up Google OAuth2 authentication.

## Tools

### 1. gcp-init

Initializes Google Cloud Platform project for OAuth.

**What it automates:**
- Installs gcloud CLI (if needed)
- Authenticates with Google Cloud
- Creates a new GCP project
- Sets project as default

**Manual steps it guides you through:**
- None (fully automated)

**Usage:**
```bash
cd tools/gcp-init
source .venv/bin/activate
python gcp_init.py
```

---

### 2. oauth-setup

Configures Google OAuth2 credentials and sets Worker secrets.

**What it automates:**
- Opens browser to correct Google Cloud Console pages
- Provides exact copy-paste values for redirect URIs
- Sets GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET as Worker secrets

**Manual steps it guides you through:**
1. OAuth Consent Screen configuration (in browser)
2. OAuth 2.0 Client ID creation (in browser)
3. Copying the Client ID and Client Secret

**Usage:**
```bash
cd tools/oauth-setup
source .venv/bin/activate
python oauth_setup.py
```

---

## Complete Setup Workflow

Run the tools in order:

```bash
# Step 1: Set up GCP project
cd tools/gcp-init
source .venv/bin/activate
python gcp_init.py
deactivate

# Step 2: Configure OAuth credentials
cd ../oauth-setup
source .venv/bin/activate
python oauth_setup.py
deactivate
```

## Requirements

- Python 3.10+
- uv (Python package manager)
- Node.js (for wrangler CLI)

## Rebuilding Virtual Environments

If you need to rebuild the virtual environments:

```bash
# gcp-init
cd tools/gcp-init
rm -rf .venv
uv venv .venv
uv pip install -e .

# oauth-setup
cd tools/oauth-setup
rm -rf .venv
uv venv .venv
uv pip install -e .
```
