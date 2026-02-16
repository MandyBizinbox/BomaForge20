"""
BOMA Backend API Tests - Authentication and Billing
Tests for:
- Parent login with email
- Child login with username (emma.child)
- Superadmin login
- Billing subscribe endpoint in stub mode
- Family/Children CRUD
- Terms and Subjects CRUD
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from review request
PARENT_CREDS = {"email": "parent@test.com", "password": "password"}
CHILD_CREDS = {"username": "emma.child", "password": "password"}
ADMIN_CREDS = {"email": "admin@boma.app", "password": "password"}


class TestHealthCheck:
    """Basic API health check"""
    
    def test_health_endpoint(self):
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        print("✅ Health check passed")

    def test_api_root(self):
        response = requests.get(f"{BASE_URL}/api")
        assert response.status_code == 200
        data = response.json()
        assert "BOMA" in data.get("message", "")
        print("✅ API root endpoint working")


class TestAuthentication:
    """Authentication tests for all user types"""
    
    def test_parent_login_with_email(self):
        """Test parent login with email - required credential"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=PARENT_CREDS)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert "user" in data, "Response should contain user"
        assert data["user"]["role"] == "parent", f"Expected parent role, got {data['user']['role']}"
        print(f"✅ Parent login successful - User: {data['user']['email']}, Role: {data['user']['role']}")
        return data["token"]

    def test_child_login_with_username(self):
        """Test child login with username (not email) - critical bug fix verification"""
        # First try with username field
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": CHILD_CREDS["username"],
            "password": CHILD_CREDS["password"]
        })
        
        if response.status_code == 200:
            data = response.json()
            assert "token" in data, "Response should contain token"
            assert data["user"]["role"] == "child", f"Expected child role, got {data['user']['role']}"
            print(f"✅ Child login with username field successful - User: {data['user'].get('email', data['user'].get('name'))}")
            return data["token"]
        
        # Try with email field but username value (backend accepts both)
        response2 = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CHILD_CREDS["username"],
            "password": CHILD_CREDS["password"]
        })
        
        if response2.status_code == 200:
            data = response2.json()
            assert "token" in data, "Response should contain token"
            print(f"✅ Child login with email field (username value) successful - User: {data['user'].get('email', data['user'].get('name'))}")
            return data["token"]
        
        # If both failed, check if child account exists
        pytest.fail(f"Child login failed. Status 1: {response.status_code}, Status 2: {response2.status_code}. Error: {response2.text}")

    def test_superadmin_login(self):
        """Test superadmin login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "token" in data, "Response should contain token"
        assert data["user"]["role"] == "superadmin", f"Expected superadmin role, got {data['user']['role']}"
        print(f"✅ Superadmin login successful - User: {data['user']['email']}, Role: {data['user']['role']}")
        return data["token"]

    def test_login_invalid_credentials(self):
        """Test login with invalid credentials returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✅ Invalid credentials correctly return 401")

    def test_login_missing_identifier(self):
        """Test login without email or username returns 400"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "",
            "username": "",
            "password": "password"
        })
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✅ Missing identifier correctly returns 400")


class TestBillingStubMode:
    """Billing tests - stub mode verification"""
    
    @pytest.fixture
    def parent_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=PARENT_CREDS)
        if response.status_code != 200:
            pytest.skip("Parent login failed - cannot test billing")
        return response.json()["token"]

    def test_get_billing_plans(self, parent_token):
        """Test billing plans endpoint"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        response = requests.get(f"{BASE_URL}/api/billing/plans", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "plans" in data, "Response should contain plans"
        assert "chat_only" in data["plans"] or "full" in data["plans"], "Should have at least one plan"
        print(f"✅ Billing plans retrieved: {list(data['plans'].keys())}")

    def test_get_billing_status(self, parent_token):
        """Test billing status endpoint"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        response = requests.get(f"{BASE_URL}/api/billing/status", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        # Response may have subscription: null or subscription object
        print(f"✅ Billing status retrieved - Subscription: {data.get('subscription')}, Plan: {data.get('plan', 'free')}")

    def test_billing_subscribe_stub_mode(self, parent_token):
        """Test billing subscribe endpoint in stub mode - critical bug fix verification"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        response = requests.post(f"{BASE_URL}/api/billing/subscribe", 
                                 json={"plan_id": "full", "name": "Test Parent", "email": "parent@test.com"},
                                 headers=headers)
        
        # Should be 200 in stub mode (no PayFast keys)
        if response.status_code == 200:
            data = response.json()
            assert data.get("mode") in ["stub", "redirect"], f"Expected stub or redirect mode, got {data.get('mode')}"
            if data.get("mode") == "stub":
                assert "subscription_id" in data, "Stub mode should return subscription_id"
                print(f"✅ Billing subscribe in STUB mode - Subscription ID: {data.get('subscription_id')}")
            else:
                assert "redirect_url" in data, "Redirect mode should return redirect_url"
                print(f"✅ Billing subscribe in REDIRECT mode - URL: {data.get('redirect_url')[:50]}...")
        elif response.status_code == 400:
            # Might fail if no family - check error message
            error = response.json().get("detail", "")
            if "No family" in error:
                pytest.skip("User has no family - cannot test subscription")
            pytest.fail(f"Subscribe failed with 400: {error}")
        else:
            pytest.fail(f"Subscribe failed with {response.status_code}: {response.text}")


class TestFamilyAndChildren:
    """Family and Children CRUD operations"""
    
    @pytest.fixture
    def parent_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=PARENT_CREDS)
        if response.status_code != 200:
            pytest.skip("Parent login failed")
        return response.json()["token"]

    def test_get_family(self, parent_token):
        """Test get current family"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        response = requests.get(f"{BASE_URL}/api/families/current", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        family = data.get("family")
        print(f"✅ Family retrieved: {family.get('name', 'Unknown') if family else 'No family'}")

    def test_list_children(self, parent_token):
        """Test list children in family"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        response = requests.get(f"{BASE_URL}/api/children", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "children" in data, "Response should contain children array"
        print(f"✅ Children list retrieved: {len(data['children'])} children")
        for child in data['children'][:3]:  # Show first 3
            print(f"   - {child.get('name', 'Unknown')} (ID: {child.get('id', 'N/A')[:8]}...)")


class TestTermsAndSubjects:
    """Academic Terms and Subjects CRUD"""
    
    @pytest.fixture
    def parent_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=PARENT_CREDS)
        if response.status_code != 200:
            pytest.skip("Parent login failed")
        return response.json()["token"]

    def test_list_terms(self, parent_token):
        """Test list academic terms"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        response = requests.get(f"{BASE_URL}/api/curriculum/terms", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "terms" in data, "Response should contain terms array"
        print(f"✅ Terms list retrieved: {len(data['terms'])} terms")

    def test_list_subjects(self, parent_token):
        """Test list subjects"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        response = requests.get(f"{BASE_URL}/api/curriculum/subjects", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "subjects" in data, "Response should contain subjects array"
        print(f"✅ Subjects list retrieved: {len(data['subjects'])} subjects")


class TestTodayDashboard:
    """Today dashboard API tests"""
    
    @pytest.fixture
    def parent_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=PARENT_CREDS)
        if response.status_code != 200:
            pytest.skip("Parent login failed")
        return response.json()["token"]

    def test_today_dashboard(self, parent_token):
        """Test today dashboard API"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        response = requests.get(f"{BASE_URL}/api/curriculum/today", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "lessons" in data, "Response should contain lessons"
        assert "chores" in data, "Response should contain chores"
        print(f"✅ Today dashboard: {len(data['lessons'])} lessons, {len(data['chores'])} chores")


class TestWeeklyPlanner:
    """Weekly planner API tests"""
    
    @pytest.fixture
    def parent_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=PARENT_CREDS)
        if response.status_code != 200:
            pytest.skip("Parent login failed")
        return response.json()["token"]

    def test_weekly_lessons(self, parent_token):
        """Test weekly lessons API"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        # Get current week's Monday
        from datetime import datetime, timedelta
        today = datetime.now()
        monday = today - timedelta(days=today.weekday())
        week_start = monday.strftime("%Y-%m-%d")
        
        response = requests.get(f"{BASE_URL}/api/curriculum/lessons", 
                               params={"week_start": week_start},
                               headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "lessons" in data, "Response should contain lessons"
        print(f"✅ Weekly planner: {len(data['lessons'])} lessons for week starting {week_start}")


class TestMeEndpoint:
    """Current user endpoint tests"""
    
    def test_me_endpoint_parent(self):
        """Test /auth/me for parent"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=PARENT_CREDS)
        if login_resp.status_code != 200:
            pytest.skip("Parent login failed")
        token = login_resp.json()["token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("role") == "parent"
        print(f"✅ Me endpoint (parent): {data.get('email')}, role={data.get('role')}")

    def test_me_endpoint_superadmin(self):
        """Test /auth/me for superadmin"""
        login_resp = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN_CREDS)
        if login_resp.status_code != 200:
            pytest.skip("Admin login failed")
        token = login_resp.json()["token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("role") == "superadmin"
        print(f"✅ Me endpoint (superadmin): {data.get('email')}, role={data.get('role')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
