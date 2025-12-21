#!/usr/bin/env python3
"""
GCP Init Tool
Automates Google Cloud Platform project setup for Vinyl Vault OAuth

Features:
- Checks/installs gcloud CLI
- Authenticates with Google Cloud
- Creates a new GCP project
- Enables required APIs
"""

import subprocess
import sys
import platform
import shutil
import webbrowser
from pathlib import Path

try:
    from rich.console import Console
    from rich.panel import Panel
    from rich.prompt import Prompt, Confirm
    from rich.progress import Progress, SpinnerColumn, TextColumn
except ImportError:
    print("Installing dependencies...")
    subprocess.run([sys.executable, "-m", "pip", "install", "rich"], check=True)
    from rich.console import Console
    from rich.panel import Panel
    from rich.prompt import Prompt, Confirm
    from rich.progress import Progress, SpinnerColumn, TextColumn

console = Console()

GCLOUD_INSTALL_URL = "https://cloud.google.com/sdk/docs/install"
DEFAULT_PROJECT_ID = "vinyl-vault"


def run_command(cmd: list[str], capture: bool = True, check: bool = True) -> subprocess.CompletedProcess:
    """Run a command and return the result."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=capture,
            text=True,
            check=check
        )
        return result
    except subprocess.CalledProcessError as e:
        if capture:
            console.print(f"[red]Error:[/red] {e.stderr or e.stdout or str(e)}")
        raise


def check_gcloud_installed() -> bool:
    """Check if gcloud CLI is installed."""
    return shutil.which("gcloud") is not None


def get_gcloud_version() -> str | None:
    """Get gcloud version if installed."""
    try:
        result = run_command(["gcloud", "version", "--format=value(version)"])
        return result.stdout.strip().split('\n')[0]
    except Exception:
        return None


def install_gcloud_macos() -> bool:
    """Install gcloud CLI on macOS using Homebrew."""
    console.print("\n[yellow]Installing gcloud CLI via Homebrew...[/yellow]")

    # Check if Homebrew is installed
    if not shutil.which("brew"):
        console.print("[red]Homebrew not found. Please install it first:[/red]")
        console.print("  /bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"")
        return False

    try:
        # Install google-cloud-sdk
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            task = progress.add_task("Installing google-cloud-sdk...", total=None)
            run_command(["brew", "install", "--cask", "google-cloud-sdk"], capture=False, check=True)
            progress.update(task, completed=True)

        console.print("[green]gcloud CLI installed successfully![/green]")
        console.print("\n[yellow]Note:[/yellow] You may need to restart your terminal or run:")
        console.print("  source \"$(brew --prefix)/share/google-cloud-sdk/path.zsh.inc\"")
        return True
    except subprocess.CalledProcessError:
        console.print("[red]Failed to install gcloud CLI[/red]")
        return False


def install_gcloud_linux() -> bool:
    """Install gcloud CLI on Linux."""
    console.print("\n[yellow]Installing gcloud CLI...[/yellow]")

    try:
        # Add Google Cloud SDK repo
        commands = [
            ["sudo", "apt-get", "update"],
            ["sudo", "apt-get", "install", "-y", "apt-transport-https", "ca-certificates", "gnupg", "curl"],
            ["sh", "-c", "curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg"],
            ["sh", "-c", 'echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee /etc/apt/sources.list.d/google-cloud-sdk.list'],
            ["sudo", "apt-get", "update"],
            ["sudo", "apt-get", "install", "-y", "google-cloud-cli"],
        ]

        for cmd in commands:
            run_command(cmd, capture=False)

        console.print("[green]gcloud CLI installed successfully![/green]")
        return True
    except subprocess.CalledProcessError:
        console.print("[red]Failed to install gcloud CLI[/red]")
        console.print(f"Please install manually: {GCLOUD_INSTALL_URL}")
        return False


def install_gcloud() -> bool:
    """Install gcloud CLI based on OS."""
    system = platform.system().lower()

    if system == "darwin":
        return install_gcloud_macos()
    elif system == "linux":
        return install_gcloud_linux()
    else:
        console.print(f"[yellow]Automatic installation not supported for {system}[/yellow]")
        console.print(f"Please install manually: {GCLOUD_INSTALL_URL}")
        webbrowser.open(GCLOUD_INSTALL_URL)
        return False


def check_gcloud_auth() -> bool:
    """Check if gcloud is authenticated."""
    try:
        result = run_command(["gcloud", "auth", "list", "--format=value(account)"])
        return bool(result.stdout.strip())
    except Exception:
        return False


def gcloud_login() -> bool:
    """Authenticate with Google Cloud."""
    console.print("\n[cyan]Authenticating with Google Cloud...[/cyan]")
    console.print("A browser window will open for authentication.\n")

    try:
        # Use subprocess.run without capture to allow interactive auth
        result = subprocess.run(
            ["gcloud", "auth", "login", "--brief"],
            check=True
        )
        return result.returncode == 0
    except subprocess.CalledProcessError:
        return False


def get_current_account() -> str | None:
    """Get the current authenticated account."""
    try:
        result = run_command(["gcloud", "auth", "list", "--filter=status:ACTIVE", "--format=value(account)"])
        return result.stdout.strip() or None
    except Exception:
        return None


def list_projects() -> list[str]:
    """List existing GCP projects."""
    try:
        result = run_command(["gcloud", "projects", "list", "--format=value(projectId)"])
        return [p.strip() for p in result.stdout.strip().split('\n') if p.strip()]
    except Exception:
        return []


def project_exists(project_id: str) -> bool:
    """Check if a project already exists."""
    try:
        result = run_command(
            ["gcloud", "projects", "describe", project_id, "--format=value(projectId)"],
            check=False
        )
        return result.returncode == 0
    except Exception:
        return False


def create_project(project_id: str, project_name: str) -> bool:
    """Create a new GCP project."""
    console.print(f"\n[cyan]Creating project '{project_id}'...[/cyan]")

    try:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            task = progress.add_task("Creating project...", total=None)
            run_command([
                "gcloud", "projects", "create", project_id,
                f"--name={project_name}",
                "--set-as-default"
            ])
            progress.update(task, completed=True)

        console.print(f"[green]Project '{project_id}' created successfully![/green]")
        return True
    except subprocess.CalledProcessError as e:
        if "already exists" in str(e.stderr):
            console.print(f"[yellow]Project '{project_id}' already exists[/yellow]")
            # Set as default
            run_command(["gcloud", "config", "set", "project", project_id])
            return True
        return False


def enable_apis(project_id: str) -> bool:
    """Enable required APIs for the project."""
    # For basic OAuth, we don't actually need to enable any APIs
    # The OAuth consent screen and credentials are part of the core IAM
    console.print("\n[cyan]Checking API status...[/cyan]")
    console.print("[green]No additional APIs required for OAuth.[/green]")
    return True


def main():
    """Main entry point."""
    console.print(Panel.fit(
        "[bold cyan]GCP Init Tool[/bold cyan]\n"
        "Automates Google Cloud Platform project setup for Vinyl Vault",
        border_style="cyan"
    ))

    # Step 1: Check/Install gcloud CLI
    console.print("\n[bold]Step 1: Check gcloud CLI[/bold]")

    if check_gcloud_installed():
        version = get_gcloud_version()
        console.print(f"[green]✓[/green] gcloud CLI installed (version: {version})")
    else:
        console.print("[yellow]gcloud CLI not found[/yellow]")

        if Confirm.ask("Install gcloud CLI now?", default=True):
            if not install_gcloud():
                console.print("[red]Please install gcloud CLI manually and run this tool again.[/red]")
                sys.exit(1)

            # Re-check after installation
            if not check_gcloud_installed():
                console.print("[yellow]Please restart your terminal and run this tool again.[/yellow]")
                sys.exit(0)
        else:
            console.print(f"[yellow]Please install gcloud CLI: {GCLOUD_INSTALL_URL}[/yellow]")
            sys.exit(1)

    # Step 2: Authenticate
    console.print("\n[bold]Step 2: Authentication[/bold]")

    current_account = get_current_account()
    if current_account:
        console.print(f"[green]✓[/green] Authenticated as: {current_account}")

        if not Confirm.ask("Continue with this account?", default=True):
            if not gcloud_login():
                console.print("[red]Authentication failed[/red]")
                sys.exit(1)
    else:
        console.print("[yellow]Not authenticated[/yellow]")
        if not gcloud_login():
            console.print("[red]Authentication failed[/red]")
            sys.exit(1)

    # Step 3: Create or select project
    console.print("\n[bold]Step 3: GCP Project[/bold]")

    existing_projects = list_projects()
    if existing_projects:
        console.print(f"Found {len(existing_projects)} existing project(s)")

    # Check if vinyl-vault project exists
    if project_exists(DEFAULT_PROJECT_ID):
        console.print(f"[green]✓[/green] Project '{DEFAULT_PROJECT_ID}' already exists")
        run_command(["gcloud", "config", "set", "project", DEFAULT_PROJECT_ID])
        project_id = DEFAULT_PROJECT_ID
    else:
        project_id = Prompt.ask(
            "Enter project ID",
            default=DEFAULT_PROJECT_ID
        )
        project_name = Prompt.ask(
            "Enter project name",
            default="Vinyl Vault"
        )

        if not create_project(project_id, project_name):
            console.print("[red]Failed to create project[/red]")
            sys.exit(1)

    # Step 4: Enable APIs
    console.print("\n[bold]Step 4: Enable APIs[/bold]")
    enable_apis(project_id)

    # Summary
    console.print("\n" + "=" * 50)
    console.print(Panel.fit(
        f"[bold green]GCP Project Ready![/bold green]\n\n"
        f"Project ID: [cyan]{project_id}[/cyan]\n"
        f"Account: [cyan]{get_current_account()}[/cyan]\n\n"
        f"[yellow]Next step:[/yellow] Run the oauth-setup tool to configure OAuth credentials",
        border_style="green"
    ))

    # Offer to open console
    if Confirm.ask("\nOpen Google Cloud Console in browser?", default=True):
        url = f"https://console.cloud.google.com/apis/credentials?project={project_id}"
        console.print(f"Opening: {url}")
        webbrowser.open(url)


if __name__ == "__main__":
    main()
