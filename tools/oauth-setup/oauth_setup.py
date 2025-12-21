#!/usr/bin/env python3
"""
OAuth Setup Tool
Guides through Google OAuth2 credential configuration for Vinyl Vault

Features:
- Opens browser to correct Google Cloud Console pages
- Provides copy-paste ready URLs and values
- Collects credentials and sets them as Cloudflare Worker secrets
"""

import subprocess
import sys
import shutil
import webbrowser
import time
import os
from pathlib import Path

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.prompt import Prompt, Confirm
    from rich.table import Table
    from rich.markdown import Markdown
    from rich import box
except ImportError:
    print("Installing dependencies...")
    subprocess.run([sys.executable, "-m", "pip", "install", "rich"], check=True)
    from rich.console import Console
    from rich.panel import Panel
    from rich.prompt import Prompt, Confirm
    from rich.table import Table
    from rich.markdown import Markdown
    from rich import box

console = Console()

# Configuration
DEFAULT_PROJECT_ID = "vinyl-vault"
WORKER_DIR = Path(__file__).parent.parent.parent / "worker"
PROD_WORKER_URL = "https://vinyl-vault-api.christophercrooker.workers.dev"
DEV_URL = "http://localhost:8787"


def get_project_id() -> str:
    """Get current GCP project ID from gcloud."""
    try:
        result = subprocess.run(
            ["gcloud", "config", "get-value", "project"],
            capture_output=True,
            text=True
        )
        return result.stdout.strip() or DEFAULT_PROJECT_ID
    except Exception:
        return DEFAULT_PROJECT_ID


def check_wrangler() -> bool:
    """Check if wrangler CLI is available."""
    return shutil.which("wrangler") is not None or shutil.which("npx") is not None


def run_wrangler_secret(name: str, value: str) -> bool:
    """Set a Cloudflare Worker secret."""
    try:
        # Change to worker directory
        original_dir = os.getcwd()
        os.chdir(WORKER_DIR)

        # Use npx wrangler if direct wrangler not available
        cmd = ["wrangler", "secret", "put", name]
        if not shutil.which("wrangler"):
            cmd = ["npx", "wrangler", "secret", "put", name]

        # Run with input
        result = subprocess.run(
            cmd,
            input=value + "\n",
            capture_output=True,
            text=True,
            env={**os.environ, "CLOUDFLARE_ACCOUNT_ID": "9afe1741eb5cf958177ce6cc0acdf6fd"}
        )

        os.chdir(original_dir)
        return result.returncode == 0
    except Exception as e:
        console.print(f"[red]Error setting secret: {e}[/red]")
        return False


def step_oauth_consent(project_id: str):
    """Guide through OAuth consent screen setup."""
    console.print("\n" + "=" * 60)
    console.print(Panel.fit(
        "[bold cyan]STEP 1: Configure OAuth Consent Screen[/bold cyan]",
        border_style="cyan"
    ))

    url = f"https://console.cloud.google.com/apis/credentials/consent?project={project_id}"

    console.print("""
[bold yellow]MANUAL STEPS REQUIRED:[/bold yellow]

The OAuth consent screen tells users which app is requesting access to their data.
You need to configure this before creating OAuth credentials.

[bold]1. Click the link below (or it will open automatically)[/bold]
""")
    console.print(f"   [link={url}]{url}[/link]\n")

    console.print("""[bold]2. If prompted to choose user type:[/bold]
   → Select [cyan]"External"[/cyan]
   → Click [cyan]"Create"[/cyan]

[bold]3. Fill in the "App information" section:[/bold]
   ┌─────────────────────────────────────────────────────────┐
   │ App name:           [green]Vinyl Vault[/green]                        │
   │ User support email: [green]<your email address>[/green]               │
   └─────────────────────────────────────────────────────────┘

[bold]4. Skip "App logo" (optional)[/bold]

[bold]5. Fill in "App domain" section (all optional, can skip)[/bold]

[bold]6. Fill in "Developer contact information":[/bold]
   ┌─────────────────────────────────────────────────────────┐
   │ Email addresses:    [green]<your email address>[/green]               │
   └─────────────────────────────────────────────────────────┘

[bold]7. Click [cyan]"Save and Continue"[/cyan][/bold]

[bold]8. On "Scopes" page:[/bold]
   → Click [cyan]"Save and Continue"[/cyan] (no changes needed)

[bold]9. On "Test users" page:[/bold]
   → Click [cyan]"+ Add Users"[/cyan]
   → Add your email address
   → Click [cyan]"Save and Continue"[/cyan]

[bold]10. On "Summary" page:[/bold]
   → Review and click [cyan]"Back to Dashboard"[/cyan]
""")

    if Confirm.ask("Open OAuth consent screen page in browser?", default=True):
        webbrowser.open(url)

    console.print("\n[yellow]Press Enter when you have completed the OAuth consent screen setup...[/yellow]")
    input()


def step_create_credentials(project_id: str) -> tuple[str, str] | None:
    """Guide through OAuth credentials creation."""
    console.print("\n" + "=" * 60)
    console.print(Panel.fit(
        "[bold cyan]STEP 2: Create OAuth 2.0 Credentials[/bold cyan]",
        border_style="cyan"
    ))

    url = f"https://console.cloud.google.com/apis/credentials?project={project_id}"

    # Prepare the URLs to copy
    js_origins = [DEV_URL, PROD_WORKER_URL]
    redirect_uris = [
        f"{DEV_URL}/api/auth/google/callback",
        f"{PROD_WORKER_URL}/api/auth/google/callback"
    ]

    console.print("""
[bold yellow]MANUAL STEPS REQUIRED:[/bold yellow]

Now you'll create the OAuth 2.0 Client ID that your app will use.

[bold]1. Click the link below (or it will open automatically)[/bold]
""")
    console.print(f"   [link={url}]{url}[/link]\n")

    console.print("""[bold]2. Click [cyan]"+ Create Credentials"[/cyan] at the top[/bold]

[bold]3. Select [cyan]"OAuth client ID"[/cyan][/bold]

[bold]4. Choose application type:[/bold]
   → Select [cyan]"Web application"[/cyan]

[bold]5. Enter a name:[/bold]
   ┌─────────────────────────────────────────────────────────┐
   │ Name:  [green]Vinyl Vault Web[/green]                                 │
   └─────────────────────────────────────────────────────────┘

[bold]6. Add "Authorized JavaScript origins":[/bold]
   Click [cyan]"+ Add URI"[/cyan] for each of these:
""")

    # Show JS origins in a table
    table = Table(box=box.ROUNDED, show_header=False, padding=(0, 2))
    table.add_column("URI", style="green")
    for uri in js_origins:
        table.add_row(uri)
    console.print(table)

    console.print("""
[bold]7. Add "Authorized redirect URIs":[/bold]
   Click [cyan]"+ Add URI"[/cyan] for each of these:
""")

    # Show redirect URIs in a table
    table = Table(box=box.ROUNDED, show_header=False, padding=(0, 2))
    table.add_column("URI", style="green")
    for uri in redirect_uris:
        table.add_row(uri)
    console.print(table)

    console.print("""
[bold]8. Click [cyan]"Create"[/cyan][/bold]

[bold]9. A popup will show your credentials:[/bold]
   ┌─────────────────────────────────────────────────────────┐
   │ [yellow]Copy the "Client ID" and "Client Secret"[/yellow]              │
   │ You'll need to paste them in the next step              │
   └─────────────────────────────────────────────────────────┘

   [dim]Tip: Click the copy icons next to each value[/dim]
""")

    if Confirm.ask("Open credentials page in browser?", default=True):
        webbrowser.open(url)

    console.print("\n[yellow]Complete the steps above, then enter the credentials below.[/yellow]")
    console.print("[dim](You can find them later at: Credentials → OAuth 2.0 Client IDs → Click your app)[/dim]\n")

    client_id = Prompt.ask("Paste your [cyan]Client ID[/cyan]")
    if not client_id or len(client_id) < 20:
        console.print("[red]Invalid Client ID. It should be a long string ending in .apps.googleusercontent.com[/red]")
        return None

    client_secret = Prompt.ask("Paste your [cyan]Client Secret[/cyan]")
    if not client_secret or len(client_secret) < 10:
        console.print("[red]Invalid Client Secret.[/red]")
        return None

    return client_id.strip(), client_secret.strip()


def step_set_secrets(client_id: str, client_secret: str) -> bool:
    """Set the OAuth credentials as Cloudflare Worker secrets."""
    console.print("\n" + "=" * 60)
    console.print(Panel.fit(
        "[bold cyan]STEP 3: Set Cloudflare Worker Secrets[/bold cyan]",
        border_style="cyan"
    ))

    if not WORKER_DIR.exists():
        console.print(f"[red]Worker directory not found: {WORKER_DIR}[/red]")
        console.print("\n[yellow]Run these commands manually:[/yellow]")
        console.print(f"  cd {WORKER_DIR}")
        console.print(f"  wrangler secret put GOOGLE_CLIENT_ID")
        console.print(f"  wrangler secret put GOOGLE_CLIENT_SECRET")
        return False

    console.print(f"[dim]Worker directory: {WORKER_DIR}[/dim]\n")

    success = True

    # Set GOOGLE_CLIENT_ID
    console.print("Setting [cyan]GOOGLE_CLIENT_ID[/cyan]... ", end="")
    if run_wrangler_secret("GOOGLE_CLIENT_ID", client_id):
        console.print("[green]✓[/green]")
    else:
        console.print("[red]✗[/red]")
        success = False

    # Set GOOGLE_CLIENT_SECRET
    console.print("Setting [cyan]GOOGLE_CLIENT_SECRET[/cyan]... ", end="")
    if run_wrangler_secret("GOOGLE_CLIENT_SECRET", client_secret):
        console.print("[green]✓[/green]")
    else:
        console.print("[red]✗[/red]")
        success = False

    if not success:
        console.print("\n[yellow]Some secrets failed to set. Run manually:[/yellow]")
        console.print(f"  cd {WORKER_DIR}")
        console.print(f"  wrangler secret put GOOGLE_CLIENT_ID")
        console.print(f"  # Paste: {client_id[:20]}...")
        console.print(f"  wrangler secret put GOOGLE_CLIENT_SECRET")
        console.print(f"  # Paste: {client_secret[:5]}...")

    return success


def step_verify():
    """Provide verification instructions."""
    console.print("\n" + "=" * 60)
    console.print(Panel.fit(
        "[bold cyan]STEP 4: Verify Setup[/bold cyan]",
        border_style="cyan"
    ))

    test_url = f"{PROD_WORKER_URL}/api/auth/google"

    console.print("""
[bold yellow]TEST YOUR OAUTH SETUP:[/bold yellow]

[bold]1. Open this URL in your browser:[/bold]
""")
    console.print(f"   [link={test_url}]{test_url}[/link]\n")

    console.print("""[bold]2. Expected behavior:[/bold]
   → You should be redirected to Google's sign-in page
   → After signing in, you'll be redirected back with a token
   → If you see "Google OAuth not configured", the secrets weren't set

[bold]3. Common issues:[/bold]

   [red]"redirect_uri_mismatch" error:[/red]
   → The redirect URI in Google Console doesn't match exactly
   → Check for trailing slashes, http vs https
   → Make sure you added BOTH localhost and production URLs

   [red]"access_denied" error:[/red]
   → You're not added as a test user
   → Go to OAuth consent screen → Test users → Add your email

   [red]"Google OAuth not configured" error:[/red]
   → The secrets weren't set correctly
   → Re-run: wrangler secret put GOOGLE_CLIENT_ID
""")

    if Confirm.ask("Open test URL in browser?", default=True):
        webbrowser.open(test_url)


def main():
    """Main entry point."""
    console.print(Panel.fit(
        "[bold cyan]OAuth Setup Tool[/bold cyan]\n"
        "Configure Google OAuth2 credentials for Vinyl Vault",
        border_style="cyan"
    ))

    # Get project ID
    project_id = get_project_id()
    console.print(f"\nUsing GCP project: [cyan]{project_id}[/cyan]")

    if not Confirm.ask("Is this the correct project?", default=True):
        project_id = Prompt.ask("Enter the correct project ID")

    # Check wrangler
    if not check_wrangler():
        console.print("[yellow]Warning: wrangler CLI not found. You'll need to set secrets manually.[/yellow]")

    # Step 1: OAuth Consent Screen
    step_oauth_consent(project_id)

    # Step 2: Create Credentials
    credentials = step_create_credentials(project_id)
    if not credentials:
        console.print("[red]Failed to get credentials. Exiting.[/red]")
        sys.exit(1)

    client_id, client_secret = credentials

    # Step 3: Set Secrets
    step_set_secrets(client_id, client_secret)

    # Step 4: Verify
    step_verify()

    # Summary
    console.print("\n" + "=" * 60)
    console.print(Panel.fit(
        "[bold green]OAuth Setup Complete![/bold green]\n\n"
        f"Client ID: [cyan]{client_id[:30]}...[/cyan]\n"
        f"Project: [cyan]{project_id}[/cyan]\n\n"
        "Your Vinyl Vault app is now configured for Google Sign-In!",
        border_style="green"
    ))


if __name__ == "__main__":
    main()
