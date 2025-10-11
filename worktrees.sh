#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Worktrees Manager - Multi-branch development with isolated Postgres databases
# ==============================================================================
#
# Manages up to 10 git worktrees with cloned Postgres databases and isolated
# environment configurations. Supports grouping, status tracking, and cleanup.
#
# Requirements:
#   - git, psql (required)
#   - lsof or ss (for port checking)
#   - npx/prisma (optional, for --auto-prisma)
#
# Usage:
#   ./worktrees.sh setup --branches feat/x,fix/y [--db-url <url>] [options]
#   ./worktrees.sh status [--group <label> | --branches ...]
#   ./worktrees.sh start [--group <label> | --branches ...]
#   ./worktrees.sh copy --group <label> [--copy <patterns>] [options]
#   ./worktrees.sh merge --group <label> --into <target> [options]
#   ./worktrees.sh clean [--branches ... | --group <label> | --all --yes]
# ==============================================================================

# Configuration defaults
WORKTREES_DIR="worktrees"
START_PORT_BASE=3001
AUTO_PRISMA="on"
AUTO_INSTALL="on"
PKG_MANAGER="auto"
BASE_REF="main"
FORCE=false
DRY_RUN=false
SETUP_CMD=""
GROUP_LABEL=""
COPY_OVERWRITE=false
COPY_LIST=""
NO_DB=false
REMOTE_NAME="origin"
MERGE_MODE="merge"
MERGE_TARGET=""
MERGE_PUSH=false
MERGE_CLEANUP=false
MERGE_YES=false
MERGE_MESSAGE=""

# Arrays for branch management
declare -a BRANCHES=()
declare -a SLUGS=()
declare -a PATHS=()
declare -a DBNAMES=()
declare -a PORTS=()
declare -a START_PORTS=()
declare -a COPY_PATTERNS=()

# Database connection info
DB_URL=""
DB_PROTOCOL=""
DB_USER=""
DB_PASS=""
DB_HOST=""
DB_PORT=""
DB_NAME=""
DB_PARAMS=""

# Commands
SUBCOMMAND=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ==============================================================================
# Helper Functions
# ==============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
}

die() {
    log_error "$*"
    exit 1
}

usage() {
    cat <<EOF
Usage: $0 <command> [options]

Commands:
  setup     Create worktrees with cloned databases (or without --no-db)
  status    Show status of worktrees and databases
  start     Print start commands for each worktree
  copy      Refresh copied assets for a group
  merge     Merge branches into a target branch
  clean     Remove worktrees and drop databases

Setup Options:
  --branches <list>       Comma-separated branch names (required, max 10)
  --db-url <url>         PostgreSQL connection URL (required unless --no-db)
  --base <ref>           Base ref for worktrees (default: main)
  --group <label>        Group label for this run (default: timestamp)
  --worktrees-dir <dir>  Directory for worktrees (default: worktrees)
  --start-port-base <N>  Starting port number (default: 3001)
  --start-ports <list>   Explicit port mapping (comma-separated)
  --auto-prisma on|off   Auto-run Prisma commands (default: on)
  --auto-install on|off  Auto-install dependencies (default: on)
  --pkg-manager <mgr>    Package manager: auto|npm|yarn|pnpm|bun (default: auto)
  --copy <patterns>      Comma-separated glob patterns to copy (gitignored assets)
  --copy-list <file>     File with patterns to copy (newline-separated, # comments)
  --copy-overwrite       Overwrite existing files when copying (default: skip)
  --setup-cmd "<cmd>"    Custom setup command per worktree
  --no-db                Skip database cloning and env mutation
  --force                Force recreate existing branches/DBs
  --dry-run              Show what would be done without doing it

Status/Start Options:
  --group <label>        Target specific group
  --branches <list>      Target specific branches

Copy Options:
  --group <label>        Target group (required)
  --copy <patterns>      Patterns to copy (optional, uses manifest if omitted)
  --copy-list <file>     File with patterns to copy
  --copy-overwrite       Overwrite existing files
  --dry-run              Show what would be copied

Merge Options:
  --group <label>        Source group (or use --branches)
  --branches <list>      Branches to merge (alternative to --group)
  --into <target>        Target branch (default: group's base_ref)
  --mode <mode>          Merge mode: merge|ff-only|squash|rebase (default: merge)
  --message "<msg>"      Custom merge commit message
  --push                 Push target branch to remote after merge
  --remote <name>        Remote name for push (default: origin)
  --cleanup              Remove merged worktrees and databases (requires --group)
  --yes                  Skip confirmation prompts
  --dry-run              Show merge plan without executing

Clean Options:
  --group <label>        Target specific group
  --branches <list>      Target specific branches
  --all --yes            Remove all worktrees (requires --yes)

Examples:
  # Setup with database
  $0 setup --branches feat/redesign,fix/auth --db-url postgresql://localhost/mydb

  # Setup without database (static site, etc.)
  $0 setup --branches feat/x,feat/y --no-db

  # Setup with copied assets and auto-install
  $0 setup --branches feat/x --db-url postgresql://localhost/mydb \\
    --copy 'node_modules/.cache,*.local' --auto-install on

  # Refresh copied assets for a group
  $0 copy --group my-group --copy 'dist/**'

  # Merge branches with auto-cleanup
  $0 merge --group my-group --into main --push --cleanup --yes

  # Check status
  $0 status --group my-group

  # Clean everything
  $0 clean --all --yes

EOF
    exit 1
}

# Convert branch name to filesystem-safe slug
slugify_branch() {
    local branch="$1"
    echo "$branch" | sed -e 's/[^a-zA-Z0-9_-]/_/g' -e 's/__*/_/g' -e 's/^_//' -e 's/_$//'
}

# Generate 8-char hash for truncated names
hash_string() {
    echo -n "$1" | sha256sum | cut -c1-8
}

# Parse PostgreSQL URL into components
parse_db_url() {
    local url="$1"

    # Extract protocol
    if [[ "$url" =~ ^(postgres|postgresql):// ]]; then
        DB_PROTOCOL="${BASH_REMATCH[1]}"
        url="${url#*://}"
    else
        die "Invalid database URL format. Must start with postgresql:// or postgres://"
    fi

    # Extract auth if present
    if [[ "$url" =~ ^([^@]+)@ ]]; then
        local auth="${BASH_REMATCH[1]}"
        url="${url#*@}"
        if [[ "$auth" =~ ^([^:]+):(.+)$ ]]; then
            DB_USER="${BASH_REMATCH[1]}"
            DB_PASS="${BASH_REMATCH[2]}"
        else
            DB_USER="$auth"
            DB_PASS=""
        fi
    fi

    # Extract host, port, database, and params
    if [[ "$url" =~ ^([^/:]+)(:([0-9]+))?/([^?]+)(\?(.+))?$ ]]; then
        DB_HOST="${BASH_REMATCH[1]}"
        DB_PORT="${BASH_REMATCH[3]:-5432}"
        DB_NAME="${BASH_REMATCH[4]}"
        DB_PARAMS="${BASH_REMATCH[6]}"
    elif [[ "$url" =~ ^/([^?]+)(\?(.+))?$ ]]; then
        # Socket connection (no host)
        DB_HOST=""
        DB_PORT="5432"
        DB_NAME="${BASH_REMATCH[1]}"
        DB_PARAMS="${BASH_REMATCH[3]}"
    else
        die "Could not parse database URL"
    fi
}

# Check if database host is local
ensure_local_db_host() {
    local host="$DB_HOST"

    if [[ -z "$host" ]] || [[ "$host" == "localhost" ]] || [[ "$host" == "127.0.0.1" ]] || [[ "$host" == "::1" ]]; then
        return 0
    fi

    die "Database host '$host' is not local. Only localhost/127.0.0.1/::1 or Unix socket connections are allowed."
}

# Build admin PostgreSQL URL (connects to 'postgres' database)
build_admin_url() {
    local url="${DB_PROTOCOL}://"
    if [[ -n "$DB_USER" ]]; then
        url+="$DB_USER"
        if [[ -n "$DB_PASS" ]]; then
            url+=":$DB_PASS"
        fi
        url+="@"
    fi
    if [[ -n "$DB_HOST" ]]; then
        url+="$DB_HOST"
        if [[ -n "$DB_PORT" ]]; then
            url+=":$DB_PORT"
        fi
    fi
    url+="/postgres"
    if [[ -n "$DB_PARAMS" ]]; then
        url+="?$DB_PARAMS"
    fi
    echo "$url"
}

# Build database URL for specific database name
build_db_url() {
    local dbname="$1"
    local url="${DB_PROTOCOL}://"
    if [[ -n "$DB_USER" ]]; then
        url+="$DB_USER"
        if [[ -n "$DB_PASS" ]]; then
            url+=":$DB_PASS"
        fi
        url+="@"
    fi
    if [[ -n "$DB_HOST" ]]; then
        url+="$DB_HOST"
        if [[ -n "$DB_PORT" ]]; then
            url+=":$DB_PORT"
        fi
    fi
    url+="/$dbname"
    if [[ -n "$DB_PARAMS" ]]; then
        url+="?$DB_PARAMS"
    fi
    echo "$url"
}

# Terminate active connections to a database
terminate_connections() {
    local dbname="$1"
    local admin_url
    admin_url=$(build_admin_url)

    log_info "Terminating active connections to database '$dbname'..."
    psql "$admin_url" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$dbname' AND pid <> pg_backend_pid();" &>/dev/null || true
}

# Drop database if it exists
drop_db_if_exists() {
    local dbname="$1"
    local admin_url
    admin_url=$(build_admin_url)

    if $DRY_RUN; then
        log_info "[DRY RUN] Would drop database '$dbname'"
        return 0
    fi

    log_info "Dropping database '$dbname' if exists..."
    terminate_connections "$dbname"
    psql "$admin_url" -c "DROP DATABASE IF EXISTS \"$dbname\";" &>/dev/null
}

# Create database from template
create_db_from_template() {
    local src_db="$1"
    local dest_db="$2"
    local admin_url
    admin_url=$(build_admin_url)

    if $DRY_RUN; then
        log_info "[DRY RUN] Would create database '$dest_db' from template '$src_db'"
        return 0
    fi

    log_info "Creating database '$dest_db' from template '$src_db'..."

    # Terminate connections to source database
    terminate_connections "$src_db"

    # Create database from template
    if ! psql "$admin_url" -c "CREATE DATABASE \"$dest_db\" TEMPLATE \"$src_db\";" 2>/dev/null; then
        log_error "Failed to create database from template."
        log_error "Ensure you have superuser/owner permissions and no active connections to '$src_db'."
        return 1
    fi

    log_success "Database '$dest_db' created successfully"
}

# Check if database exists
db_exists() {
    local dbname="$1"
    local admin_url
    admin_url=$(build_admin_url)

    psql "$admin_url" -tAc "SELECT 1 FROM pg_database WHERE datname = '$dbname';" 2>/dev/null | grep -q 1
}

# Test database connectivity
test_db_connectivity() {
    local dbname="$1"
    local db_url
    db_url=$(build_db_url "$dbname")

    psql "$db_url" -c "SELECT 1;" &>/dev/null
}

# Check if port is available
is_port_free() {
    local port="$1"

    # Try lsof first (macOS, Linux)
    if command -v lsof &>/dev/null; then
        ! lsof -Pi ":$port" -sTCP:LISTEN -t &>/dev/null
        return $?
    fi

    # Try ss (Linux)
    if command -v ss &>/dev/null; then
        ! ss -ltn | grep -q ":$port "
        return $?
    fi

    # Try netstat (fallback)
    if command -v netstat &>/dev/null; then
        ! netstat -ltn 2>/dev/null | grep -q ":$port "
        return $?
    fi

    # Try nc as last resort
    if command -v nc &>/dev/null; then
        ! nc -z localhost "$port" &>/dev/null
        return $?
    fi

    log_warn "No port checking tool available (lsof, ss, netstat, nc). Assuming port $port is free."
    return 0
}

# Assign ports to branches
assign_ports() {
    local num_branches="${#BRANCHES[@]}"

    # If explicit ports provided, use them
    if [[ ${#START_PORTS[@]} -gt 0 ]]; then
        if [[ ${#START_PORTS[@]} -ne $num_branches ]]; then
            die "Number of --start-ports (${#START_PORTS[@]}) must match number of branches ($num_branches)"
        fi
        PORTS=("${START_PORTS[@]}")

        # Warn about conflicts
        for port in "${PORTS[@]}"; do
            if ! is_port_free "$port"; then
                log_warn "Port $port appears to be in use"
            fi
        done
        return 0
    fi

    # Auto-assign ports starting from base
    local port=$START_PORT_BASE
    for ((i=0; i<num_branches; i++)); do
        while ! is_port_free "$port"; do
            log_warn "Port $port is in use, trying next..."
            ((port++))
        done
        PORTS+=("$port")
        ((port++))
    done
}

# Generate database name with truncation if needed
generate_db_name() {
    local base_db="$1"
    local slug="$2"
    local full_name="${base_db}__${slug}"

    # PostgreSQL database name limit is 63 chars
    if [[ ${#full_name} -le 63 ]]; then
        echo "$full_name"
    else
        # Truncate and append hash
        local hash
        hash=$(hash_string "$full_name")
        local max_len=$((63 - 9)) # Reserve 9 chars for _<hash>
        local truncated="${full_name:0:$max_len}"
        echo "${truncated}_${hash}"
    fi
}

# Copy and update environment files
copy_and_set_env() {
    local worktree_path="$1"
    local new_db_url="$2"

    if $DRY_RUN; then
        log_info "[DRY RUN] Would copy and update env files in $worktree_path"
        return 0
    fi

    # Copy .env
    if [[ -f .env ]]; then
        log_info "Copying and updating .env..."
        cp .env "$worktree_path/.env"

        # Update DATABASE_URL
        if grep -q "^DATABASE_URL=" "$worktree_path/.env"; then
            sed -i.bak "s|^DATABASE_URL=.*|DATABASE_URL=\"$new_db_url\"|" "$worktree_path/.env"
            rm -f "$worktree_path/.env.bak"
        else
            echo "DATABASE_URL=\"$new_db_url\"" >> "$worktree_path/.env"
        fi
    fi

    # Copy .env.local
    if [[ -f .env.local ]]; then
        log_info "Copying and updating .env.local..."
        cp .env.local "$worktree_path/.env.local"

        # Update DATABASE_URL
        if grep -q "^DATABASE_URL=" "$worktree_path/.env.local"; then
            sed -i.bak "s|^DATABASE_URL=.*|DATABASE_URL=\"$new_db_url\"|" "$worktree_path/.env.local"
            rm -f "$worktree_path/.env.local.bak"
        else
            echo "DATABASE_URL=\"$new_db_url\"" >> "$worktree_path/.env.local"
        fi
    fi
}

# Run setup hooks in worktree
run_setup_hooks() {
    local worktree_path="$1"

    if $DRY_RUN; then
        log_info "[DRY RUN] Would run setup hooks in $worktree_path"
        return 0
    fi

    cd "$worktree_path"

    # Auto Prisma
    if [[ "$AUTO_PRISMA" == "on" ]]; then
        if [[ -f "prisma/schema.prisma" ]] && command -v npx &>/dev/null; then
            log_info "Running Prisma generate..."
            npx prisma generate || log_warn "Prisma generate failed"
        fi
    fi

    # Custom setup command
    if [[ -n "$SETUP_CMD" ]]; then
        log_info "Running custom setup command: $SETUP_CMD"
        eval "$SETUP_CMD" || log_warn "Custom setup command failed"
    fi

    cd - &>/dev/null
}

# Read copy patterns from file
read_copy_list_file() {
    local file="$1"

    if [[ ! -f "$file" ]]; then
        die "Copy list file not found: $file"
    fi

    local count=0
    while IFS= read -r line; do
        # Skip empty lines and comments
        [[ -z "$line" ]] && continue
        [[ "$line" =~ ^[[:space:]]*# ]] && continue

        # Trim whitespace
        line=$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
        [[ -z "$line" ]] && continue

        COPY_PATTERNS+=("$line")
        ((count++))
    done < "$file"

    if [[ $count -eq 0 ]]; then
        log_warn "Copy list file '$file' contains no valid patterns (empty lines and comments ignored)"
    else
        log_info "Loaded $count pattern(s) from $file"
    fi
}

# Validate and sanitize copy pattern
validate_copy_pattern() {
    local pattern="$1"

    # Reject absolute paths
    if [[ "$pattern" == /* ]]; then
        log_error "Copy pattern cannot be absolute path: $pattern"
        return 1
    fi

    # Reject .. traversal
    if [[ "$pattern" == *../* ]] || [[ "$pattern" == ../* ]] || [[ "$pattern" == *.. ]]; then
        log_error "Copy pattern cannot contain '..': $pattern"
        return 1
    fi

    return 0
}

# Copy extra assets to worktree
copy_extra_assets() {
    local worktree_path="$1"

    if [[ ${#COPY_PATTERNS[@]} -eq 0 ]]; then
        return 0
    fi

    if $DRY_RUN; then
        log_info "[DRY RUN] Would copy ${#COPY_PATTERNS[@]} pattern(s) to $worktree_path"
        for pattern in "${COPY_PATTERNS[@]}"; do
            log_info "  - $pattern"
        done
        return 0
    fi

    log_info "Copying ${#COPY_PATTERNS[@]} pattern(s) to $worktree_path..."

    # Enable extended globbing
    shopt -s nullglob dotglob 2>/dev/null
    shopt -s globstar 2>/dev/null || log_warn "globstar not supported, ** patterns may not work"

    local copied=0
    local failed=0
    local skipped=0

    for pattern in "${COPY_PATTERNS[@]}"; do
        # Validate pattern
        if ! validate_copy_pattern "$pattern"; then
            ((failed++))
            continue
        fi

        # For ** patterns, copy the base directory instead of individual files
        # This avoids issues with large file expansions and is more efficient
        if [[ "$pattern" == *"/**" ]]; then
            base_path="${pattern%/**}"
            if [[ ! -e "$base_path" ]]; then
                log_warn "Base path does not exist: $base_path"
                continue
            fi

            local dest="$worktree_path/$base_path"
            if [[ -e "$dest" ]] && ! $COPY_OVERWRITE; then
                log_info "Skipping $base_path (already exists, use --copy-overwrite to replace)"
                ((skipped++))
                continue
            fi

            log_info "Copying directory: $base_path"
            if command -v rsync &>/dev/null; then
                if rsync -a "$base_path/" "$worktree_path/$base_path/" &>/dev/null; then
                    ((copied++))
                    log_success "Copied $base_path"
                else
                    log_warn "Failed to copy: $base_path"
                    ((failed++))
                fi
            else
                mkdir -p "$(dirname "$dest")"
                if cp -a "$base_path" "$(dirname "$dest")/" 2>/dev/null; then
                    ((copied++))
                    log_success "Copied $base_path"
                else
                    log_warn "Failed to copy: $base_path"
                    ((failed++))
                fi
            fi
            continue
        fi

        # For non-** patterns, expand glob normally
        log_info "Expanding pattern: $pattern"
        matches=($pattern)
        log_info "Matched ${#matches[@]} file(s)"

        if [[ ${#matches[@]} -eq 0 ]]; then
            log_warn "Pattern matched nothing: $pattern"
            continue
        fi

        # Try rsync first (preserves structure with--relative)
        if command -v rsync &>/dev/null; then
            # Get repo path once for symlink checking
            repo_path=$(pwd)

            for ((file_count=0; file_count<${#matches[@]}; file_count++)); do
                src="${matches[$file_count]}"
                # Skip if source doesn't exist or is a broken symlink
                if [[ ! -e "$src" ]] && [[ ! -L "$src" ]]; then
                    continue
                fi

                # Check for symlinks pointing outside repo (security)
                if [[ -L "$src" ]]; then
                    local target
                    target=$(readlink -f "$src" 2>/dev/null || readlink "$src")
                    if [[ "$target" == /* ]] && [[ ! "$target" =~ ^${repo_path} ]]; then
                        log_warn "Skipping symlink pointing outside repo: $src -> $target"
                        ((skipped++))
                        continue
                    fi
                fi

                local dest="$worktree_path/$src"

                # Check if destination exists and overwrite flag
                if [[ -e "$dest" ]] && ! $COPY_OVERWRITE; then
                    ((skipped++))
                    continue
                fi

                # Use rsync to preserve directory structure
                if rsync -a --relative "$src" "$worktree_path/" &>/dev/null; then
                    ((copied++))
                else
                    log_warn "Failed to copy: $src"
                    ((failed++))
                fi
            done
        else
            # Fallback to cp with manual directory creation
            log_warn "rsync not found, using cp (may not preserve all attributes)"

            for src in "${matches[@]}"; do
                # Skip if source doesn't exist
                if [[ ! -e "$src" ]] && [[ ! -L "$src" ]]; then
                    continue
                fi

                local dest="$worktree_path/$src"

                # Check if destination exists and overwrite flag
                if [[ -e "$dest" ]] && ! $COPY_OVERWRITE; then
                    ((skipped++))
                    continue
                fi

                # Create parent directory
                mkdir -p "$(dirname "$dest")"

                # Copy file or directory
                if cp -a "$src" "$dest" 2>/dev/null; then
                    ((copied++))
                else
                    log_warn "Failed to copy: $src"
                    ((failed++))
                fi
            done
        fi
    done

    # Restore glob settings
    shopt -u nullglob dotglob globstar 2>/dev/null

    if [[ $copied -gt 0 ]]; then
        log_success "Copied $copied file(s)/dir(s)"
    fi

    if [[ $skipped -gt 0 ]]; then
        log_info "$skipped file(s) skipped (already exist, use --copy-overwrite to replace)"
    fi

    if [[ $failed -gt 0 ]]; then
        log_warn "$failed pattern(s)/file(s) failed to copy"
        return 1
    fi

    return 0
}

# Auto-install dependencies
auto_install_deps() {
    local worktree_path="$1"

    if [[ "$AUTO_INSTALL" != "on" ]]; then
        return 0
    fi

    # Only proceed if package.json exists at worktree root
    if [[ ! -f "$worktree_path/package.json" ]]; then
        return 0
    fi

    if $DRY_RUN; then
        log_info "[DRY RUN] Would auto-install dependencies in $worktree_path"
        return 0
    fi

    log_info "Auto-installing dependencies..."

    cd "$worktree_path"

    local pkg_mgr="$PKG_MANAGER"
    local install_cmd=""

    # Auto-detect package manager if set to auto
    if [[ "$pkg_mgr" == "auto" ]]; then
        # Check for pnpm
        if [[ -f "pnpm-lock.yaml" ]]; then
            pkg_mgr="pnpm"
        # Check for Yarn (detect version)
        elif [[ -f "yarn.lock" ]]; then
            if [[ -f ".yarnrc.yml" ]] || grep -q '"yarnPath"' package.json 2>/dev/null; then
                pkg_mgr="yarn2"
            else
                pkg_mgr="yarn"
            fi
        # Check for bun
        elif [[ -f "bun.lockb" ]]; then
            pkg_mgr="bun"
        # Check for npm
        elif [[ -f "package-lock.json" ]]; then
            pkg_mgr="npm"
        else
            # Default to npm install (no lockfile)
            pkg_mgr="npm-no-lock"
        fi
    fi

    # Build install command based on detected/specified manager
    case "$pkg_mgr" in
        pnpm)
            if command -v pnpm &>/dev/null; then
                install_cmd="pnpm install --frozen-lockfile"
            else
                log_warn "pnpm not found in PATH, skipping dependency install"
                cd - &>/dev/null
                return 0
            fi
            ;;
        yarn2)
            if command -v yarn &>/dev/null; then
                install_cmd="yarn install --immutable"
            else
                log_warn "yarn not found in PATH, skipping dependency install"
                cd - &>/dev/null
                return 0
            fi
            ;;
        yarn)
            if command -v yarn &>/dev/null; then
                install_cmd="yarn install --frozen-lockfile"
            else
                log_warn "yarn not found in PATH, skipping dependency install"
                cd - &>/dev/null
                return 0
            fi
            ;;
        bun)
            if command -v bun &>/dev/null; then
                install_cmd="bun install"
            else
                log_warn "bun not found in PATH, skipping dependency install"
                cd - &>/dev/null
                return 0
            fi
            ;;
        npm)
            if command -v npm &>/dev/null; then
                install_cmd="npm ci"
            else
                log_warn "npm not found in PATH, skipping dependency install"
                cd - &>/dev/null
                return 0
            fi
            ;;
        npm-no-lock)
            if command -v npm &>/dev/null; then
                install_cmd="npm install"
            else
                log_warn "npm not found in PATH, skipping dependency install"
                cd - &>/dev/null
                return 0
            fi
            ;;
        *)
            log_warn "Unknown package manager: $pkg_mgr, skipping dependency install"
            cd - &>/dev/null
            return 0
            ;;
    esac

    log_info "Running: $install_cmd"
    if eval "$install_cmd"; then
        log_success "Dependencies installed successfully"
    else
        log_warn "Dependency install failed (non-critical, continuing...)"
    fi

    cd - &>/dev/null
}

# Ensure working tree is clean
ensure_clean_tree() {
    local worktree_path="$1"

    cd "$worktree_path"

    if [[ -n "$(git status --porcelain)" ]]; then
        log_error "Working tree has uncommitted changes: $worktree_path"
        log_error "Commit or stash them before merging"
        cd - &>/dev/null
        return 1
    fi

    cd - &>/dev/null
    return 0
}

# Create temporary merge worktree
create_temp_worktree() {
    local target_branch="$1"
    local slug
    slug=$(slugify_branch "$target_branch")
    local temp_path="$WORKTREES_DIR/.merge/$slug"

    # Remove existing temp worktree if present
    if [[ -d "$temp_path" ]]; then
        log_info "Removing existing temporary merge worktree..."
        git worktree remove "$temp_path" --force 2>/dev/null || rm -rf "$temp_path"
    fi

    # Create parent directory
    mkdir -p "$WORKTREES_DIR/.merge"

    # Create worktree
    if ! git worktree add "$temp_path" "$target_branch" &>/dev/null; then
        log_error "Failed to create temporary worktree for branch '$target_branch'"
        return 1
    fi

    echo "$temp_path"
}

# Remove temporary merge worktree
remove_temp_worktree() {
    local temp_path="$1"

    if [[ -d "$temp_path" ]]; then
        log_info "Cleaning up temporary merge worktree..."
        git worktree remove "$temp_path" --force 2>/dev/null || rm -rf "$temp_path"
    fi
}

# Write group manifest
write_group_manifest() {
    local group_dir="$WORKTREES_DIR/.groups"
    mkdir -p "$group_dir"

    local manifest_file="$group_dir/${GROUP_LABEL}.json"

    if $DRY_RUN; then
        log_info "[DRY RUN] Would write manifest to $manifest_file"
        return 0
    fi

    local json="{"
    json+="\"group\":\"$GROUP_LABEL\","
    json+="\"created\":\"$(date -Iseconds)\","
    json+="\"base_ref\":\"$BASE_REF\","
    json+="\"db_url\":\"$DB_URL\","
    json+="\"no_db\":$NO_DB,"
    json+="\"features\":{"
    json+="\"auto_install\":\"$AUTO_INSTALL\","
    json+="\"pkg_manager\":\"$PKG_MANAGER\","
    json+="\"copy_patterns\":["

    for i in "${!COPY_PATTERNS[@]}"; do
        [[ $i -gt 0 ]] && json+=","
        # Escape quotes in pattern
        local escaped_pattern="${COPY_PATTERNS[$i]//\"/\\\"}"
        json+="\"$escaped_pattern\""
    done

    json+="]"
    json+="},"
    json+="\"branches\":["

    for i in "${!BRANCHES[@]}"; do
        [[ $i -gt 0 ]] && json+=","
        json+="{"
        json+="\"branch\":\"${BRANCHES[$i]}\","
        json+="\"slug\":\"${SLUGS[$i]}\","
        json+="\"path\":\"${PATHS[$i]}\","
        json+="\"db_name\":\"${DBNAMES[$i]}\","
        json+="\"port\":${PORTS[$i]}"
        json+="}"
    done

    json+="]}"

    echo "$json" > "$manifest_file"
    log_success "Manifest written to $manifest_file"
}

# Read group manifest
read_group_manifest() {
    local group_label="$1"
    local manifest_file="$WORKTREES_DIR/.groups/${group_label}.json"

    if [[ ! -f "$manifest_file" ]]; then
        die "Group '$group_label' not found. Manifest file does not exist: $manifest_file"
    fi

    # Parse JSON (basic parsing, assumes well-formed JSON)
    local json
    json=$(cat "$manifest_file")

    # Extract db_url
    DB_URL=$(echo "$json" | grep -o '"db_url":"[^"]*"' | cut -d'"' -f4)

    # Extract no_db flag
    NO_DB=$(echo "$json" | grep -o '"no_db":[^,}]*' | cut -d':' -f2)
    [[ "$NO_DB" == "true" ]] && NO_DB=true || NO_DB=false

    # Extract features (optional, for copy subcommand)
    # Extract copy_patterns from features
    local patterns_json
    patterns_json=$(echo "$json" | grep -o '"copy_patterns":\[[^]]*\]' | sed 's/"copy_patterns":\[//' | sed 's/\]$//')
    if [[ -n "$patterns_json" ]]; then
        # Split by comma and unquote
        while IFS= read -r pattern; do
            pattern=$(echo "$pattern" | sed 's/^"//' | sed 's/"$//' | sed 's/\\"/"/g')
            [[ -n "$pattern" ]] && COPY_PATTERNS+=("$pattern")
        done < <(echo "$patterns_json" | grep -o '"[^"]*"')
    fi

    # Extract branches array - this is a simplified parser
    # In production, consider using jq for robust JSON parsing
    local branches_json
    branches_json=$(echo "$json" | grep -o '"branches":\[.*\]' | sed 's/"branches":\[//' | sed 's/\]$//')

    # Parse each branch object
    while IFS= read -r branch_obj; do
        [[ -z "$branch_obj" ]] && continue

        local branch slug path db_name port
        branch=$(echo "$branch_obj" | grep -o '"branch":"[^"]*"' | cut -d'"' -f4)
        slug=$(echo "$branch_obj" | grep -o '"slug":"[^"]*"' | cut -d'"' -f4)
        path=$(echo "$branch_obj" | grep -o '"path":"[^"]*"' | cut -d'"' -f4)
        db_name=$(echo "$branch_obj" | grep -o '"db_name":"[^"]*"' | cut -d'"' -f4)
        port=$(echo "$branch_obj" | grep -o '"port":[0-9]*' | cut -d':' -f2)

        BRANCHES+=("$branch")
        SLUGS+=("$slug")
        PATHS+=("$path")
        DBNAMES+=("$db_name")
        PORTS+=("$port")
    done < <(echo "$branches_json" | grep -o '{[^}]*}')
}

# ==============================================================================
# Subcommand: setup
# ==============================================================================

cmd_setup() {
    # Validate required options
    [[ ${#BRANCHES[@]} -eq 0 ]] && die "Missing required option: --branches"

    # --db-url is required unless --no-db is specified
    if ! $NO_DB && [[ -z "$DB_URL" ]]; then
        die "Missing required option: --db-url (or use --no-db for projects without database)"
    fi

    # Validate branch count
    [[ ${#BRANCHES[@]} -gt 10 ]] && die "Too many branches (${#BRANCHES[@]}). Maximum is 10."

    # Parse and validate database URL (skip if --no-db)
    if ! $NO_DB; then
        parse_db_url "$DB_URL"
        ensure_local_db_host
    fi

    # Check for clean working tree (allow untracked files)
    if [[ -n "$(git status --porcelain | grep -v '^??')" ]]; then
        die "Working tree has uncommitted changes. Commit or stash them first."
    fi

    # Set group label if not provided
    if [[ -z "$GROUP_LABEL" ]]; then
        GROUP_LABEL="wt-$(date +%Y%m%d-%H%M%S)"
    fi

    # Create worktrees directory
    mkdir -p "$WORKTREES_DIR"

    # Generate slugs and paths
    for branch in "${BRANCHES[@]}"; do
        local slug
        slug=$(slugify_branch "$branch")
        SLUGS+=("$slug")
        PATHS+=("$WORKTREES_DIR/$slug")

        if ! $NO_DB; then
            local db_name
            db_name=$(generate_db_name "$DB_NAME" "$slug")
            DBNAMES+=("$db_name")
        else
            DBNAMES+=("")
        fi
    done

    # Check for database name truncation (skip if --no-db)
    if ! $NO_DB; then
        for i in "${!BRANCHES[@]}"; do
            local full_name="${DB_NAME}__${SLUGS[$i]}"
            if [[ "$full_name" != "${DBNAMES[$i]}" ]]; then
                log_warn "Database name truncated: ${BRANCHES[$i]} -> ${DBNAMES[$i]}"
            fi
        done
    fi

    # Assign ports
    assign_ports

    log_info "Setting up ${#BRANCHES[@]} worktree(s) in group '$GROUP_LABEL'..."

    # Fetch latest changes
    if ! $DRY_RUN; then
        log_info "Fetching latest changes..."
        git fetch --all --prune
    fi

    # Process each branch
    for i in "${!BRANCHES[@]}"; do
        local branch="${BRANCHES[$i]}"
        local slug="${SLUGS[$i]}"
        local path="${PATHS[$i]}"
        local db_name="${DBNAMES[$i]}"
        local port="${PORTS[$i]}"

        log_info "[$((i+1))/${#BRANCHES[@]}] Processing branch '$branch'..."

        # Remove existing worktree if force mode
        if $FORCE && [[ -d "$path" ]]; then
            if $DRY_RUN; then
                log_info "[DRY RUN] Would remove existing worktree at $path"
            else
                log_info "Removing existing worktree..."
                git worktree remove "$path" --force 2>/dev/null || rm -rf "$path"
            fi
        fi

        # Create worktree
        if $DRY_RUN; then
            log_info "[DRY RUN] Would create worktree: git worktree add -B \"$branch\" \"$path\" \"$BASE_REF\""
        else
            if ! git worktree add -B "$branch" "$path" "$BASE_REF" 2>/dev/null; then
                log_error "Failed to create worktree for branch '$branch'"
                continue
            fi
            log_success "Worktree created at $path"
        fi

        # Drop existing database if force mode (skip if --no-db)
        if ! $NO_DB && $FORCE; then
            drop_db_if_exists "$db_name"
        fi

        # Create database from template (skip if --no-db)
        if ! $NO_DB; then
            if ! create_db_from_template "$DB_NAME" "$db_name"; then
                log_error "Failed to create database for branch '$branch'"
                continue
            fi
        fi

        # Copy and update env files (skip DB mutation if --no-db)
        if ! $NO_DB; then
            local new_db_url
            new_db_url=$(build_db_url "$db_name")
            copy_and_set_env "$path" "$new_db_url"
        else
            # Copy env files without DB mutation
            if [[ -f .env ]]; then
                log_info "Copying .env (without DB mutation)..."
                cp .env "$path/.env"
            fi
            if [[ -f .env.local ]]; then
                log_info "Copying .env.local (without DB mutation)..."
                cp .env.local "$path/.env.local"
            fi
        fi

        # Copy extra assets (NEW)
        copy_extra_assets "$path"

        # Auto-install dependencies (NEW)
        auto_install_deps "$path"

        # Run setup hooks
        run_setup_hooks "$path"

        if ! $NO_DB; then
            log_success "Branch '$branch' setup complete (port: $port, db: $db_name)"
        else
            log_success "Branch '$branch' setup complete (port: $port)"
        fi
    done

    # Write group manifest
    write_group_manifest

    # Print summary
    echo ""
    log_success "Setup complete! Group: $GROUP_LABEL"
    echo ""
    echo "Start commands:"
    for i in "${!BRANCHES[@]}"; do
        echo "  cd ${PATHS[$i]} && PORT=${PORTS[$i]} npm run dev"
    done
    echo ""
    echo "To check status: $0 status --group $GROUP_LABEL"
    echo "To clean up: $0 clean --group $GROUP_LABEL"
}

# ==============================================================================
# Subcommand: status
# ==============================================================================

cmd_status() {
    # Load from group if specified
    if [[ -n "$GROUP_LABEL" ]]; then
        read_group_manifest "$GROUP_LABEL"
        if ! $NO_DB; then
            parse_db_url "$DB_URL"
        fi
    elif [[ ${#BRANCHES[@]} -eq 0 ]]; then
        die "Must specify either --group or --branches"
    else
        # Parse branches manually (need to reconstruct paths/dbnames)
        die "Status with --branches requires group metadata. Use --group instead."
    fi

    echo ""
    echo "Status for group: $GROUP_LABEL"
    echo "========================================"

    for i in "${!BRANCHES[@]}"; do
        local branch="${BRANCHES[$i]}"
        local path="${PATHS[$i]}"
        local db_name="${DBNAMES[$i]}"
        local port="${PORTS[$i]}"

        echo ""
        echo "Branch: $branch"
        echo "  Path: $path"

        # Check if worktree exists
        if [[ -d "$path" ]]; then
            cd "$path"
            local commit
            commit=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
            echo "  Commit: $commit"
            cd - &>/dev/null
        else
            echo "  Commit: (worktree not found)"
        fi

        # Check env files
        local env_status="-"
        local env_local_status="-"
        [[ -f "$path/.env" ]] && env_status="✓"
        [[ -f "$path/.env.local" ]] && env_local_status="✓"
        echo "  Env files: .env[$env_status] .env.local[$env_local_status]"

        # Check database (skip if --no-db)
        if ! $NO_DB; then
            if db_exists "$db_name"; then
                if test_db_connectivity "$db_name"; then
                    echo "  Database: ✓ $db_name (connected)"
                else
                    echo "  Database: ! $db_name (exists but cannot connect)"
                fi
            else
                echo "  Database: ✗ $db_name (not found)"
            fi
        else
            echo "  Database: (--no-db mode)"
        fi

        echo "  Port: $port"
    done

    echo ""
}

# ==============================================================================
# Subcommand: start
# ==============================================================================

cmd_start() {
    # Load from group if specified
    if [[ -n "$GROUP_LABEL" ]]; then
        read_group_manifest "$GROUP_LABEL"
    elif [[ ${#BRANCHES[@]} -eq 0 ]]; then
        die "Must specify either --group or --branches"
    fi

    echo ""
    echo "Start commands for group: $GROUP_LABEL"
    echo "========================================"
    echo ""

    for i in "${!BRANCHES[@]}"; do
        echo "cd ${PATHS[$i]} && PORT=${PORTS[$i]} npm run dev"
    done

    echo ""
}

# ==============================================================================
# Subcommand: copy
# ==============================================================================

cmd_copy() {
    # Require --group
    if [[ -z "$GROUP_LABEL" ]]; then
        die "Copy command requires --group to identify worktrees"
    fi

    # Load group manifest
    read_group_manifest "$GROUP_LABEL"

    # If no patterns specified via CLI, use manifest patterns
    # (Patterns from CLI via --copy or --copy-list override manifest)
    local explicit_patterns=false
    # This will be set by argument parsing if --copy or --copy-list was used

    if [[ ${#COPY_PATTERNS[@]} -eq 0 ]]; then
        log_warn "No copy patterns specified and none found in manifest"
        log_info "Use --copy <patterns> or --copy-list <file> to specify patterns"
        return 0
    fi

    log_info "Refreshing ${#COPY_PATTERNS[@]} pattern(s) for group '$GROUP_LABEL'..."

    local total_copied=0
    local total_failed=0

    for i in "${!BRANCHES[@]}"; do
        local branch="${BRANCHES[$i]}"
        local path="${PATHS[$i]}"

        if [[ ! -d "$path" ]]; then
            log_warn "Worktree not found, skipping: $path"
            continue
        fi

        log_info "Copying to: $path"

        if copy_extra_assets "$path"; then
            ((total_copied++))
        else
            ((total_failed++))
        fi
    done

    echo ""
    if [[ $total_copied -gt 0 ]]; then
        log_success "Copy complete: $total_copied worktree(s) updated"
    fi

    if [[ $total_failed -gt 0 ]]; then
        log_warn "$total_failed worktree(s) had copy failures"
        return 1
    fi
}

# ==============================================================================
# Subcommand: merge
# ==============================================================================

cmd_merge() {
    # Load from group or branches
    if [[ -n "$GROUP_LABEL" ]]; then
        read_group_manifest "$GROUP_LABEL"
        if ! $NO_DB; then
            parse_db_url "$DB_URL"
        fi

        # Use group's base_ref as default target if not specified
        if [[ -z "$MERGE_TARGET" ]]; then
            MERGE_TARGET="$BASE_REF"
        fi
    elif [[ ${#BRANCHES[@]} -eq 0 ]]; then
        die "Must specify either --group or --branches"
    else
        # Must specify --into when using --branches
        if [[ -z "$MERGE_TARGET" ]]; then
            die "Must specify --into <target> when using --branches"
        fi
    fi

    # Require --into
    if [[ -z "$MERGE_TARGET" ]]; then
        die "Must specify --into <target>"
    fi

    # Validate cleanup requires group
    if $MERGE_CLEANUP && [[ -z "$GROUP_LABEL" ]]; then
        die "--cleanup requires --group (need manifest to locate databases)"
    fi

    # Confirmation prompt unless --yes
    if ! $MERGE_YES && ! $DRY_RUN; then
        echo ""
        echo "Merge Plan:"
        echo "  Target branch: $MERGE_TARGET"
        echo "  Mode: $MERGE_MODE"
        echo "  Branches to merge: ${BRANCHES[*]}"
        if $MERGE_PUSH; then
            echo "  Push to remote: $REMOTE_NAME"
        fi
        if $MERGE_CLEANUP; then
            echo "  Cleanup after merge: yes"
        fi
        echo ""
        read -p "Proceed with merge? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Merge cancelled"
            return 0
        fi
    fi

    if $DRY_RUN; then
        log_info "[DRY RUN] Merge plan:"
        log_info "  Target: $MERGE_TARGET"
        log_info "  Mode: $MERGE_MODE"
        log_info "  Branches: ${BRANCHES[*]}"
        $MERGE_PUSH && log_info "  Would push to: $REMOTE_NAME/$MERGE_TARGET"
        $MERGE_CLEANUP && log_info "  Would cleanup: ${#BRANCHES[@]} worktree(s)"
        return 0
    fi

    # Fetch latest
    log_info "Fetching latest changes..."
    git fetch --all --prune

    # Create temporary worktree for target branch
    log_info "Creating temporary merge worktree for '$MERGE_TARGET'..."
    local temp_path
    temp_path=$(create_temp_worktree "$MERGE_TARGET")

    if [[ -z "$temp_path" ]]; then
        die "Failed to create temporary worktree"
    fi

    # Ensure clean
    if ! ensure_clean_tree "$temp_path"; then
        remove_temp_worktree "$temp_path"
        die "Temporary worktree is not clean"
    fi

    # Try to fast-forward target to remote if exists
    cd "$temp_path"
    if git rev-parse "$REMOTE_NAME/$MERGE_TARGET" &>/dev/null; then
        log_info "Fast-forwarding '$MERGE_TARGET' to '$REMOTE_NAME/$MERGE_TARGET'..."
        git merge --ff-only "$REMOTE_NAME/$MERGE_TARGET" 2>/dev/null || log_warn "Could not fast-forward (diverged or up-to-date)"
    fi
    cd - &>/dev/null

    # Track successfully merged branches
    local -a merged_branches=()

    # Merge each branch
    for i in "${!BRANCHES[@]}"; do
        local branch="${BRANCHES[$i]}"
        local path="${PATHS[$i]}"

        log_info "[$((i+1))/${#BRANCHES[@]}] Merging '$branch' into '$MERGE_TARGET'..."

        cd "$temp_path"

        local merge_success=false

        case "$MERGE_MODE" in
            merge)
                local msg="Merge branch '$branch' into '$MERGE_TARGET' (via worktrees.sh)"
                if [[ -n "$MERGE_MESSAGE" ]]; then
                    msg="$MERGE_MESSAGE"
                fi

                if git merge --no-ff -m "$msg" "$branch" 2>/dev/null; then
                    merge_success=true
                fi
                ;;

            ff-only)
                if git merge --ff-only "$branch" 2>/dev/null; then
                    merge_success=true
                fi
                ;;

            squash)
                if git merge --squash "$branch" 2>/dev/null; then
                    local msg="chore(merge): $branch -> $MERGE_TARGET [squash]"
                    if [[ -n "$MERGE_MESSAGE" ]]; then
                        msg="$MERGE_MESSAGE"
                    fi

                    if git commit -m "$msg" 2>/dev/null; then
                        merge_success=true
                    fi
                fi
                ;;

            rebase)
                # Rebase branch onto target, then ff-only merge
                log_info "Rebasing '$branch' onto '$MERGE_TARGET'..."

                # Switch to branch in its own worktree if available
                if [[ -d "$path" ]]; then
                    cd "$path"
                    if ! ensure_clean_tree "$path"; then
                        log_error "Worktree has uncommitted changes: $path"
                        cd "$temp_path"
                        continue
                    fi

                    if git rebase "$MERGE_TARGET" 2>/dev/null; then
                        cd "$temp_path"
                        if git merge --ff-only "$branch" 2>/dev/null; then
                            merge_success=true
                        else
                            log_error "Fast-forward merge failed after rebase"
                        fi
                    else
                        log_error "Rebase failed, conflicts need manual resolution"
                        log_info "To resolve:"
                        log_info "  cd $path"
                        log_info "  # Fix conflicts, then: git add . && git rebase --continue"
                        log_info "  # Or abort: git rebase --abort"
                        cd "$temp_path"
                    fi
                else
                    log_error "Worktree not found for rebase: $path"
                fi
                ;;

            *)
                log_error "Unknown merge mode: $MERGE_MODE"
                ;;
        esac

        if $merge_success; then
            log_success "Successfully merged '$branch'"
            merged_branches+=("$branch")
        else
            log_error "Merge conflict or failure for '$branch'"
            log_error "Temporary merge worktree: $temp_path"
            log_info "To resolve conflicts:"
            log_info "  cd $temp_path"
            log_info "  # Fix conflicts, then:"
            log_info "  git add ."
            log_info "  git commit"
            log_info "  # Or abort:"
            log_info "  git merge --abort"
            log_info ""
            log_info "After resolving, re-run merge command to continue with remaining branches"
            cd - &>/dev/null
            return 1
        fi

        cd - &>/dev/null
    done

    # Push if requested
    if $MERGE_PUSH; then
        log_info "Pushing '$MERGE_TARGET' to '$REMOTE_NAME'..."
        cd "$temp_path"

        if git push "$REMOTE_NAME" "$MERGE_TARGET"; then
            log_success "Pushed to $REMOTE_NAME/$MERGE_TARGET"
        else
            log_error "Push failed"
            log_warn "Temporary merge worktree preserved at: $temp_path"
            log_info "You can manually push: cd $temp_path && git push $REMOTE_NAME $MERGE_TARGET"
            cd - &>/dev/null
            return 1
        fi

        cd - &>/dev/null
    fi

    # Cleanup if requested
    if $MERGE_CLEANUP; then
        log_info "Cleaning up merged worktrees and databases..."

        for i in "${!BRANCHES[@]}"; do
            local branch="${BRANCHES[$i]}"
            local path="${PATHS[$i]}"
            local db_name="${DBNAMES[$i]}"

            # Check if this branch was successfully merged
            local was_merged=false
            for merged in "${merged_branches[@]}"; do
                if [[ "$merged" == "$branch" ]]; then
                    was_merged=true
                    break
                fi
            done

            if ! $was_merged; then
                log_info "Skipping cleanup for unmerged branch: $branch"
                continue
            fi

            log_info "Cleaning up: $branch"

            # Remove worktree
            if [[ -d "$path" ]]; then
                git worktree remove "$path" --force 2>/dev/null || rm -rf "$path"
                log_success "Worktree removed: $path"
            fi

            # Drop database (skip if --no-db)
            if ! $NO_DB && [[ -n "$db_name" ]]; then
                if db_exists "$db_name"; then
                    drop_db_if_exists "$db_name"
                    log_success "Database dropped: $db_name"
                fi
            fi
        done

        # Remove group manifest if all branches were cleaned
        if [[ ${#merged_branches[@]} -eq ${#BRANCHES[@]} ]]; then
            local manifest_file="$WORKTREES_DIR/.groups/${GROUP_LABEL}.json"
            if [[ -f "$manifest_file" ]]; then
                rm "$manifest_file"
                log_success "Group manifest removed"
            fi
        fi
    fi

    # Remove temporary merge worktree
    remove_temp_worktree "$temp_path"

    echo ""
    log_success "Merge complete: ${#merged_branches[@]}/${#BRANCHES[@]} branch(es) merged into '$MERGE_TARGET'"
}

# ==============================================================================
# Subcommand: clean
# ==============================================================================

cmd_clean() {
    local clean_all=false
    local confirmed=false

    # Check for --all flag
    for arg in "$@"; do
        [[ "$arg" == "--all" ]] && clean_all=true
        [[ "$arg" == "--yes" ]] && confirmed=true
    done

    # Clean all worktrees
    if $clean_all; then
        if ! $confirmed; then
            die "Cleaning all worktrees requires --yes flag for confirmation"
        fi

        log_warn "Cleaning ALL worktrees in $WORKTREES_DIR..."

        if $DRY_RUN; then
            log_info "[DRY RUN] Would remove all worktrees in $WORKTREES_DIR"
            log_info "[DRY RUN] Would drop all cloned databases"
            return 0
        fi

        # Collect all databases from group manifests before deleting them
        local -a all_databases=()
        local -a all_db_urls=()

        if [[ -d "$WORKTREES_DIR/.groups" ]]; then
            for manifest_file in "$WORKTREES_DIR/.groups"/*.json; do
                [[ -f "$manifest_file" ]] || continue

                local json
                json=$(cat "$manifest_file")

                # Extract db_url for this group
                local group_db_url
                group_db_url=$(echo "$json" | grep -o '"db_url":"[^"]*"' | cut -d'"' -f4)

                # Extract database names from branches
                local branches_json
                branches_json=$(echo "$json" | grep -o '"branches":\[.*\]' | sed 's/"branches":\[//' | sed 's/\]$//')

                while IFS= read -r branch_obj; do
                    [[ -z "$branch_obj" ]] && continue

                    local db_name
                    db_name=$(echo "$branch_obj" | grep -o '"db_name":"[^"]*"' | cut -d'"' -f4)

                    if [[ -n "$db_name" ]]; then
                        all_databases+=("$db_name")
                        all_db_urls+=("$group_db_url")
                    fi
                done < <(echo "$branches_json" | grep -o '{[^}]*}')
            done
        fi

        # Drop all collected databases
        if [[ ${#all_databases[@]} -gt 0 ]]; then
            log_info "Dropping ${#all_databases[@]} cloned database(s)..."

            for i in "${!all_databases[@]}"; do
                local db_name="${all_databases[$i]}"
                local db_url="${all_db_urls[$i]}"

                # Parse the db_url to get connection info
                DB_URL="$db_url"
                parse_db_url "$DB_URL"

                if db_exists "$db_name"; then
                    drop_db_if_exists "$db_name"
                    log_success "Database dropped: $db_name"
                fi
            done
        fi

        # Remove all worktrees
        if [[ -d "$WORKTREES_DIR" ]]; then
            for path in "$WORKTREES_DIR"/*; do
                [[ -d "$path" ]] || continue
                [[ "$(basename "$path")" == ".groups" ]] && continue

                log_info "Removing worktree: $path"
                git worktree remove "$path" --force 2>/dev/null || rm -rf "$path"
            done

            # Remove groups directory
            rm -rf "$WORKTREES_DIR/.groups"

            log_success "All worktrees and databases removed"
        fi

        return 0
    fi

    # Load from group or branches
    if [[ -n "$GROUP_LABEL" ]]; then
        read_group_manifest "$GROUP_LABEL"
        if ! $NO_DB; then
            parse_db_url "$DB_URL"
        fi
    elif [[ ${#BRANCHES[@]} -eq 0 ]]; then
        die "Must specify --group, --branches, or --all --yes"
    else
        # When using --branches without --group, generate paths and dbnames
        for branch in "${BRANCHES[@]}"; do
            local slug
            slug=$(slugify_branch "$branch")
            SLUGS+=("$slug")
            PATHS+=("$WORKTREES_DIR/$slug")

            # DB name not known without manifest, leave empty
            DBNAMES+=("")
        done
    fi

    log_info "Cleaning ${#BRANCHES[@]} worktree(s)..."

    for i in "${!BRANCHES[@]}"; do
        local branch="${BRANCHES[$i]}"
        local path="${PATHS[$i]}"
        local db_name="${DBNAMES[$i]}"

        log_info "Cleaning branch '$branch'..."

        # Remove worktree
        if [[ -d "$path" ]]; then
            if $DRY_RUN; then
                log_info "[DRY RUN] Would remove worktree: $path"
            else
                git worktree remove "$path" --force 2>/dev/null || rm -rf "$path"
                log_success "Worktree removed: $path"
            fi
        fi

        # Drop database (skip if --no-db or empty db_name)
        if ! $NO_DB && [[ -n "$db_name" ]]; then
            if db_exists "$db_name"; then
                drop_db_if_exists "$db_name"
                log_success "Database dropped: $db_name"
            fi
        fi
    done

    # Remove group manifest
    if [[ -n "$GROUP_LABEL" ]]; then
        local manifest_file="$WORKTREES_DIR/.groups/${GROUP_LABEL}.json"
        if [[ -f "$manifest_file" ]]; then
            if $DRY_RUN; then
                log_info "[DRY RUN] Would remove manifest: $manifest_file"
            else
                rm "$manifest_file"
                log_success "Manifest removed"
            fi
        fi
    fi

    log_success "Clean complete"
}

# ==============================================================================
# Main CLI Parser
# ==============================================================================

main() {
    [[ $# -eq 0 ]] && usage

    # Check for help flags first
    for arg in "$@"; do
        if [[ "$arg" == "-h" || "$arg" == "--help" ]]; then
            usage
        fi
    done

    SUBCOMMAND="$1"
    shift

    # Store flags for clean command
    local CLEAN_ALL=false
    local CLEAN_YES=false

    # Parse common options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --branches)
                IFS=',' read -ra BRANCHES <<< "$2"
                shift 2
                ;;
            --db-url)
                DB_URL="$2"
                shift 2
                ;;
            --base)
                BASE_REF="$2"
                shift 2
                ;;
            --group)
                GROUP_LABEL="$2"
                shift 2
                ;;
            --worktrees-dir)
                WORKTREES_DIR="$2"
                shift 2
                ;;
            --start-port-base)
                START_PORT_BASE="$2"
                shift 2
                ;;
            --start-ports)
                IFS=',' read -ra START_PORTS <<< "$2"
                shift 2
                ;;
            --auto-prisma)
                AUTO_PRISMA="$2"
                shift 2
                ;;
            --setup-cmd)
                SETUP_CMD="$2"
                shift 2
                ;;
            --auto-install)
                AUTO_INSTALL="$2"
                shift 2
                ;;
            --pkg-manager)
                PKG_MANAGER="$2"
                shift 2
                ;;
            --copy)
                IFS=',' read -ra patterns <<< "$2"
                COPY_PATTERNS+=("${patterns[@]}")
                shift 2
                ;;
            --copy-list)
                COPY_LIST="$2"
                read_copy_list_file "$COPY_LIST"
                shift 2
                ;;
            --copy-overwrite)
                COPY_OVERWRITE=true
                shift
                ;;
            --no-db)
                NO_DB=true
                shift
                ;;
            --into)
                MERGE_TARGET="$2"
                shift 2
                ;;
            --mode)
                MERGE_MODE="$2"
                shift 2
                ;;
            --message)
                MERGE_MESSAGE="$2"
                shift 2
                ;;
            --push)
                MERGE_PUSH=true
                shift
                ;;
            --remote)
                REMOTE_NAME="$2"
                shift 2
                ;;
            --cleanup)
                MERGE_CLEANUP=true
                shift
                ;;
            --force)
                FORCE=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --all)
                CLEAN_ALL=true
                shift
                ;;
            --yes)
                CLEAN_YES=true
                MERGE_YES=true
                shift
                ;;
            -h|--help)
                usage
                ;;
            *)
                die "Unknown option: $1"
                ;;
        esac
    done

    # Execute subcommand
    case "$SUBCOMMAND" in
        setup)
            cmd_setup
            ;;
        status)
            cmd_status
            ;;
        start)
            cmd_start
            ;;
        copy)
            cmd_copy
            ;;
        merge)
            cmd_merge
            ;;
        clean)
            # Pass --all and --yes flags to clean
            local clean_args=()
            $CLEAN_ALL && clean_args+=(--all)
            $CLEAN_YES && clean_args+=(--yes)
            cmd_clean "${clean_args[@]}"
            ;;
        *)
            die "Unknown command: $SUBCOMMAND"
            ;;
    esac
}

main "$@"
