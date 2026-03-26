#!/usr/bin/env python3
"""
Database connection diagnostic tool.
Run this to verify your Supabase credentials are correct.

Usage:
    python3 test_db_connection.py
"""

import sys
from app.core.config import settings
from app.db.database import DATABASE_URL, engine


def main():
    print("=" * 70)
    print("SPECTRAVEIN DATABASE CONNECTION DIAGNOSTIC")
    print("=" * 70)
    print()
    
    # Print settings
    print("📋 CONFIGURATION:")
    print(f"  Environment: {settings.ENVIRONMENT}")
    print(f"  SUPABASE_DATABASE_URL set: {'Yes' if settings.SUPABASE_DATABASE_URL else 'No'}")
    print(f"  DATABASE_URL set: {'Yes' if settings.DATABASE_URL else 'No'}")
    print()
    
    # Print resolved URL (masked password for security)
    print("🔐 RESOLVED CONNECTION STRING (password masked):")
    masked_url = DATABASE_URL.replace(
        DATABASE_URL.split("@")[0].split(":")[-1],
        "****"
    ) if "@" in DATABASE_URL else DATABASE_URL
    print(f"  {masked_url}")
    print()
    
    # Try connection
    print("🔌 TESTING DATABASE CONNECTION...")
    try:
        with engine.connect() as connection:
            result = connection.execute("SELECT 1 as ping")
            row = result.fetchone()
            if row:
                print("  ✅ CONNECTION SUCCESSFUL!")
                print()
                
                # Try to query asteroids table
                print("📊 CHECKING ASTEROIDS TABLE...")
                count_result = connection.execute(
                    "SELECT COUNT(*) as count FROM asteroids"
                )
                count = count_result.fetchone()[0]
                print(f"  ✅ Table exists. Records: {count}")
                print()
                
                if count == 0:
                    print("  ⚠️  WARNING: Table is empty. Run: python3 seed_db.py")
                else:
                    # Show sample
                    sample_result = connection.execute(
                        "SELECT designation, name FROM asteroids LIMIT 3"
                    )
                    samples = sample_result.fetchall()
                    print("  📌 Sample records:")
                    for row in samples:
                        print(f"     - {row[0]}: {row[1]}")
                print()
                print("🎉 Database is healthy and ready to use!")
                return 0
            else:
                print("  ❌ Connection test query failed")
                return 1
                
    except Exception as e:
        print(f"  ❌ CONNECTION FAILED!")
        print()
        print("  ERROR DETAILS:")
        error_msg = str(e)
        
        # Parse common errors
        if "password authentication failed" in error_msg:
            print("    → PASSWORD IS INCORRECT or URL-ENCODED WRONG")
            print("    → Go to Supabase → Connection Pooling → Copy exact URI")
            print("    → If password has special chars, URL-encode them:")
            print("       @ → %40, : → %3A, / → %2F, # → %23, ? → %3F")
        elif "could not translate host name" in error_msg:
            print("    → HOST NOT FOUND (DNS issue or wrong hostname)")
            print("    → Check: aws-1-ap-southeast-1.pooler.supabase.com")
        elif "connection refused" in error_msg:
            print("    → CONNECTION REFUSED (port wrong or server not listening)")
            print("    → Supabase pooling port should be 6543 (not 5432)")
        elif "timeout" in error_msg or "timed out" in error_msg:
            print("    → CONNECTION TIMEOUT")
            print("    → Supabase/Render may be down or network blocked")
        else:
            print(f"    {error_msg}")
        
        print()
        print("  📖 NEXT STEPS:")
        print("    1. Check credentials in Supabase → Database → Connection Pooling")
        print("    2. Verify DATABASE_URL environment variable in Render")
        print("    3. Ensure special characters in password are URL-encoded")
        print("    4. Check Supabase/Render firewall/IP whitelist")
        return 1


if __name__ == "__main__":
    sys.exit(main())
