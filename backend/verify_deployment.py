#!/usr/bin/env python3
"""
SPECTRAVEIN Deployment Verification Script
Run this to diagnose your Render/Supabase setup.

Usage:
    python3 verify_deployment.py [--seed]
    
    --seed: Also seed the database after verifying connection
"""

import sys
import os
from pathlib import Path


def check_env_file():
    """Check if .env exists and contains DATABASE_URL."""
    print("\n" + "="*70)
    print("1️⃣  CHECKING LOCAL CONFIGURATION")
    print("="*70)
    
    env_path = Path("backend/.env")
    if not env_path.exists():
        print(f"❌ {env_path} not found")
        return False
    
    with open(env_path) as f:
        content = f.read()
    
    if "DATABASE_URL=" not in content:
        print("❌ DATABASE_URL not found in .env")
        return False
    
    # Extract and mask the URL
    for line in content.split("\n"):
        if line.startswith("DATABASE_URL="):
            url = line.replace("DATABASE_URL=", "").strip()
            # Mask password
            if "@" in url:
                parts = url.split("@")
                cred_part = parts[0]  # postgresql://user:PASSWORD
                host_part = "@".join(parts[1:])
                if ":" in cred_part:
                    user, _ = cred_part.rsplit(":", 1)
                    masked = f"{user}:***@{host_part}"
                else:
                    masked = f"{cred_part}@{host_part}"
                print(f"✅ DATABASE_URL configured: {masked}")
            else:
                print(f"✅ DATABASE_URL: {url}")
            return True
    
    return False


def check_backend_files():
    """Check if backend structure exists."""
    print("\n" + "="*70)
    print("2️⃣  CHECKING BACKEND STRUCTURE")
    print("="*70)
    
    required_files = [
        "backend/app/db/database.py",
        "backend/app/models/domain.py",
        "backend/app/api/endpoints.py",
        "backend/app/core/config.py",
        "backend/seed_db.py",
        "backend/asteroid_labeled.csv",
    ]
    
    all_ok = True
    for file_path in required_files:
        if Path(file_path).exists():
            print(f"✅ {file_path}")
        else:
            print(f"❌ {file_path} MISSING")
            all_ok = False
    
    return all_ok


def check_database_connection():
    """Try to connect to database."""
    print("\n" + "="*70)
    print("3️⃣  TESTING DATABASE CONNECTION")
    print("="*70)
    
    try:
        from app.db.database import engine
        
        with engine.connect() as connection:
            result = connection.execute("SELECT 1 as ping")
            if result.fetchone():
                print("✅ Database connection successful!")
                
                # Check asteroids table
                try:
                    count_result = connection.execute(
                        "SELECT COUNT(*) as count FROM asteroids"
                    )
                    count = count_result.fetchone()[0]
                    print(f"✅ Asteroids table found: {count} records")
                    return True
                except Exception as e:
                    if "does not exist" in str(e):
                        print("⚠️  Asteroids table does not exist (needs seeding)")
                        return True  # Connection works, just needs seed
                    else:
                        print(f"❌ Table error: {e}")
                        return False
            return False
            
    except Exception as e:
        error_msg = str(e)
        print(f"❌ Connection failed: {error_msg}")
        
        if "password authentication failed" in error_msg:
            print("    → Incorrect password in DATABASE_URL")
        elif "could not translate host name" in error_msg:
            print("    → Wrong host in DATABASE_URL")
        elif "connection refused" in error_msg:
            print("    → Wrong port or server not running")
        elif "ModuleNotFoundError" in error_msg:
            print("    → Dependencies not installed (run: uv sync)")
        
        return False


def seed_database():
    """Run seed_db.py."""
    print("\n" + "="*70)
    print("4️⃣  SEEDING DATABASE")
    print("="*70)
    
    try:
        import subprocess
        result = subprocess.run(
            [sys.executable, "backend/seed_db.py"],
            capture_output=True,
            text=True,
            timeout=60,
        )
        print(result.stdout)
        if result.stderr:
            print(result.stderr)
        return result.returncode == 0
    except Exception as e:
        print(f"❌ Seeding failed: {e}")
        return False


def print_summary(results):
    """Print final summary."""
    print("\n" + "="*70)
    print("📊 DEPLOYMENT CHECKLIST")
    print("="*70)
    
    checks = [
        ("✅ Local .env configured", results.get("env")),
        ("✅ Backend structure complete", results.get("structure")),
        ("✅ Database connection working", results.get("connection")),
    ]
    
    for check, status in checks:
        symbol = "✅" if status else "❌"
        print(f"{symbol} {check}")
    
    if all(results.values()):
        print("\n🎉 Everything looks good! Your deployment should work.")
        print("\nNext steps:")
        print("  1. Go to Render: https://dashboard.render.com/services")
        print("  2. Click your Backend Service → Environment")
        print("  3. Verify DATABASE_URL matches your Supabase connection")
        print("  4. Click Manual Deploy")
        print("  5. Test: https://YOUR-SERVICE.onrender.com/api/targets")
    else:
        print("\n⚠️  Some checks failed. Fix the issues above, then try again.")


def main():
    print("\n🚀 SPECTRAVEIN DEPLOYMENT VERIFICATION")
    
    should_seed = "--seed" in sys.argv
    
    results = {
        "env": check_env_file(),
        "structure": check_backend_files(),
        "connection": check_database_connection(),
    }
    
    if should_seed and results["connection"]:
        results["seeded"] = seed_database()
    
    print_summary(results)
    
    return 0 if all(results.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
