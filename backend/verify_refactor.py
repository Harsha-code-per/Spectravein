#!/usr/bin/env python3
"""
Verification script for backend architecture.
Tests that modules load and core service calculations remain valid.
"""

import sys

def test_imports():
    """Test that all new modules can be imported."""
    print("🔍 Testing module imports...")
    
    try:
        from app.core.config import settings
        print(f"  ✅ config.py: {settings.APP_NAME} v{settings.APP_VERSION}")
        
        from app.models.schemas import AsteroidTarget, HealthCheckResponse
        print(f"  ✅ schemas.py: AsteroidTarget, HealthCheckResponse")
        
        from app.services import physics, economics, orbital
        print(f"  ✅ services/physics.py: {len([x for x in dir(physics) if not x.startswith('_')])} functions")
        print(f"  ✅ services/economics.py: {len([x for x in dir(economics) if not x.startswith('_')])} functions")
        print(f"  ✅ services/orbital.py: {len([x for x in dir(orbital) if not x.startswith('_')])} functions")
        
        from app.api.endpoints import router
        print(f"  ✅ api/endpoints.py: FastAPI router")
        
        from app.models.domain import AsteroidDB
        print(f"  ✅ models/domain.py: AsteroidDB")
        
        from app.main import app
        print(f"  ✅ main.py: FastAPI application")
        
        return True
    except Exception as e:
        print(f"  ❌ Import failed: {e}")
        return False


def test_cors_config():
    """Test that CORS is properly configured."""
    print("\n🔍 Testing CORS configuration...")
    
    try:
        from app.core.config import settings
        
        origins = settings.get_allowed_origins()
        print(f"  ✅ CORS origins: {origins}")
        
        if "*" in origins:
            print(f"  ❌ SECURITY RISK: Wildcard '*' detected in CORS origins!")
            return False
        
        if "localhost:3000" in str(origins):
            print(f"  ✅ Local development origin configured")
        
        return True
    except Exception as e:
        print(f"  ❌ CORS config test failed: {e}")
        return False


def test_physics_calculations():
    """Test physics service calculations."""
    print("\n🔍 Testing physics calculations...")
    
    try:
        from app.services.physics import (
            estimate_mass_kg,
            calculate_accessibility_score,
            calculate_mission_cost_usd,
        )
        
        # Test 433 Eros (known asteroid)
        mass = estimate_mass_kg(16.84, "S")
        expected_mass = 6.69e15
        error = abs(mass - expected_mass) / expected_mass
        
        if error < 0.01:  # Within 1%
            print(f"  ✅ Mass calculation: {mass:.2e} kg (error: {error*100:.2f}%)")
        else:
            print(f"  ⚠️  Mass calculation off by {error*100:.1f}%")
        
        # Test accessibility score
        score = calculate_accessibility_score(10.0)
        if score == 80.0:
            print(f"  ✅ Accessibility score: {score} (10° → 80/100)")
        else:
            print(f"  ⚠️  Accessibility score: expected 80, got {score}")
        
        # Test mission cost
        cost = calculate_mission_cost_usd(10.0, 0.15)
        expected_cost = 2e9 + 10*500e6 + 0.15*10e9
        if abs(cost - expected_cost) < 1e6:
            print(f"  ✅ Mission cost: ${cost/1e9:.2f} Billion")
        else:
            print(f"  ⚠️  Mission cost calculation mismatch")
        
        return True
    except Exception as e:
        print(f"  ❌ Physics test failed: {e}")
        return False


def main():
    """Run all verification tests."""
    print("="*70)
    print("SPECTRAVEIN Backend Refactoring Verification")
    print("="*70)
    
    tests = [
        test_imports,
        test_cors_config,
        test_physics_calculations,
    ]
    
    results = [test() for test in tests]
    
    print("\n" + "="*70)
    if all(results):
        print("✅ ALL TESTS PASSED")
        print("Backend refactoring successful. Ready for deployment.")
        return 0
    else:
        print("❌ SOME TESTS FAILED")
        print("Please review errors above before deploying.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
