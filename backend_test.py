import requests
import sys
import json
from datetime import datetime, timedelta
import os

class BomaAPITester:
    def __init__(self):
        # Use environment variable for base URL
        try:
            with open('/app/frontend/.env', 'r') as f:
                for line in f:
                    if line.startswith('REACT_APP_BACKEND_URL='):
                        self.base_url = line.split('=')[1].strip() + '/api'
                        break
                else:
                    self.base_url = "https://lesson-planner-52.preview.emergentagent.com/api"
        except FileNotFoundError:
            self.base_url = "https://lesson-planner-52.preview.emergentagent.com/api"
        
        print(f"🔧 Testing backend at: {self.base_url}")
        
        self.token = None
        self.family_id = None
        self.child_id = None
        self.subject_id = None
        self.term_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.errors = []

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                error_msg = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_detail = response.json()
                    error_msg += f" - {error_detail}"
                except:
                    error_msg += f" - {response.text[:200]}"
                print(f"❌ Failed - {error_msg}")
                self.errors.append(f"{name}: {error_msg}")
                return False, {}

        except Exception as e:
            error_msg = f"Error: {str(e)}"
            print(f"❌ Failed - {error_msg}")
            self.errors.append(f"{name}: {error_msg}")
            return False, {}

    def test_health(self):
        """Test health endpoint"""
        return self.run_test("Health Check", "GET", "health", 200)

    def test_login_existing_user(self):
        """Test login with existing test user"""
        success, response = self.run_test(
            "Login Existing User",
            "POST", 
            "auth/login",
            200,
            data={"email": "parent@test.com", "password": "test123"}
        )
        if success and 'token' in response:
            self.token = response['token']
            self.family_id = response.get('user', {}).get('family_id')
            print(f"🔑 Got token and family_id: {self.family_id}")
        return success

    def test_auth_me(self):
        """Test get current user"""
        return self.run_test("Get Current User", "GET", "auth/me", 200)

    def test_get_current_family(self):
        """Test get current family"""
        success, response = self.run_test("Get Current Family", "GET", "families/current", 200)
        if success:
            children = response.get('children', [])
            if children:
                self.child_id = children[0]['id']
                print(f"👶 Got child_id: {self.child_id}")
        return success

    def test_list_children(self):
        """Test list children"""
        return self.run_test("List Children", "GET", "children", 200)

    def test_create_term(self):
        """Test create academic term"""
        today = datetime.now()
        start_date = today.strftime("%Y-%m-%d")
        end_date = (today + timedelta(days=90)).strftime("%Y-%m-%d")
        
        success, response = self.run_test(
            "Create Term",
            "POST",
            "curriculum/terms",
            200,
            data={
                "name": "Test Term",
                "start_date": start_date,
                "end_date": end_date
            }
        )
        if success:
            self.term_id = response.get('term', {}).get('id')
            print(f"📚 Got term_id: {self.term_id}")
        return success

    def test_create_subject(self):
        """Test create subject"""
        success, response = self.run_test(
            "Create Subject",
            "POST",
            "curriculum/subjects",
            200,
            data={
                "name": "Mathematics",
                "color": "#4F9DCE",
                "description": "Math lessons for testing"
            }
        )
        if success:
            self.subject_id = response.get('subject', {}).get('id')
            print(f"📖 Got subject_id: {self.subject_id}")
        return success

    def test_generate_lessons(self):
        """Test lesson generation"""
        if not all([self.child_id, self.subject_id, self.term_id]):
            print("⚠️  Skipping lesson generation - missing child/subject/term IDs")
            return False
            
        return self.run_test(
            "Generate Lessons",
            "POST",
            "curriculum/lessons/generate",
            200,
            data={
                "child_id": self.child_id,
                "subject_id": self.subject_id,
                "term_id": self.term_id,
                "title_prefix": "Test Lesson",
                "count": 5
            }
        )

    def test_today_dashboard(self):
        """Test today dashboard endpoint"""
        return self.run_test("Today Dashboard", "GET", "curriculum/today", 200)

    def test_list_lessons(self):
        """Test list lessons"""
        params = {}
        if self.child_id:
            params['child_id'] = self.child_id
        return self.run_test("List Lessons", "GET", "curriculum/lessons", 200, params=params)

    def test_create_chore_template(self):
        """Test create chore template"""
        return self.run_test(
            "Create Chore Template",
            "POST",
            "chores/templates",
            200,
            data={
                "name": "Test Chore",
                "description": "Test chore for testing",
                "category": "cleaning",
                "points": 5,
                "frequency": "daily"
            }
        )

    def test_list_chore_templates(self):
        """Test list chore templates"""
        return self.run_test("List Chore Templates", "GET", "chores/templates", 200)

    def test_list_wallets(self):
        """Test list allowance wallets"""
        return self.run_test("List Wallets", "GET", "allowance/wallets", 200)

    def test_create_conversation(self):
        """Test create conversation"""
        return self.run_test(
            "Create Conversation",
            "POST",
            "messages/conversations",
            200,
            data={
                "name": "Test Chat",
                "type": "family",
                "participant_ids": []
            }
        )

    def test_list_conversations(self):
        """Test list conversations"""
        return self.run_test("List Conversations", "GET", "messages/conversations", 200)

    def test_list_notifications(self):
        """Test list notifications"""
        return self.run_test("List Notifications", "GET", "notifications", 200)

    def test_school_reports(self):
        """Test school reports"""
        if not self.child_id:
            print("⚠️  Skipping school reports - no child_id")
            return False
        return self.run_test("School Reports", "GET", f"reports/school/{self.child_id}", 200)

    def test_register_new_user(self):
        """Test user registration"""
        timestamp = int(datetime.now().timestamp())
        return self.run_test(
            "Register New User", 
            "POST",
            "auth/register",
            200,
            data={
                "email": f"test{timestamp}@example.com",
                "password": "test123456",
                "name": f"Test User {timestamp}",
                "role": "parent"
            }
        )

    # NEW FEATURES TESTING
    
    def test_admin_login(self):
        """Test SuperAdmin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST", 
            "auth/login",
            200,
            data={"email": "admin@boma.app", "password": "admin123"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            print(f"🔑 Got admin token")
        return success

    def test_admin_dashboard(self):
        """Test admin dashboard endpoint"""
        # Store current token, use admin token
        parent_token = self.token
        self.token = getattr(self, 'admin_token', None)
        if not self.token:
            print("⚠️  Skipping admin dashboard - no admin token")
            self.token = parent_token
            return False
        
        success = self.run_test("Admin Dashboard", "GET", "admin/dashboard", 200)[0]
        self.token = parent_token  # restore parent token
        return success

    def test_admin_settings(self):
        """Test admin settings GET/PUT"""
        parent_token = self.token
        self.token = getattr(self, 'admin_token', None)
        if not self.token:
            print("⚠️  Skipping admin settings - no admin token")
            self.token = parent_token
            return False
            
        # Test GET settings
        success1 = self.run_test("Admin Get Settings", "GET", "admin/settings", 200)[0]
        
        # Test PUT settings
        success2 = self.run_test(
            "Admin Update Settings",
            "PUT", 
            "admin/settings", 
            200,
            data={
                "payfast_merchant_id": "test_merchant",
                "resend_api_key": "test_key"
            }
        )[0]
        
        self.token = parent_token
        return success1 and success2

    def test_billing_plans(self):
        """Test billing plans endpoint"""
        return self.run_test("Billing Plans", "GET", "billing/plans", 200)

    def test_billing_status(self):
        """Test billing status endpoint"""
        return self.run_test("Billing Status", "GET", "billing/status", 200)

    def test_billing_subscribe_stub(self):
        """Test billing subscribe in stub mode"""
        return self.run_test(
            "Billing Subscribe (Stub)",
            "POST",
            "billing/subscribe",
            200,
            data={
                "plan_id": "full",
                "name": "Test User",
                "email": "parent@test.com"
            }
        )

    def test_streaks_api(self):
        """Test family streaks endpoint"""
        return self.run_test("Family Streaks", "GET", "streaks", 200)

    def test_email_send(self):
        """Test email send endpoint (stub mode)"""
        return self.run_test(
            "Email Send (Stub)",
            "POST",
            "email/send",
            200,
            data={
                "recipient_email": "test@example.com",
                "subject": "Test Email",
                "html_content": "<p>Test email content</p>"
            }
        )

    def test_create_child_account(self):
        """Test child account creation"""
        if not self.child_id:
            print("⚠️  Skipping child account creation - no child_id")
            return False
            
        return self.run_test(
            "Create Child Account",
            "POST",
            "auth/child-account",
            200,
            data={
                "child_id": self.child_id,
                "username": "emma.child",
                "password": "pass1234"
            }
        )

    def test_child_login(self):
        """Test child login"""
        return self.run_test(
            "Child Login",
            "POST",
            "auth/login",
            200,
            data={"email": "emma.child", "password": "pass1234"}
        )

def main():
    print("🏠 Starting BOMA API Test Suite")
    print("=" * 50)
    
    tester = BomaAPITester()
    
    # Run core API tests in sequence
    tests = [
        ("Health Check", tester.test_health),
        ("Login Existing User", tester.test_login_existing_user),
        ("Get Current User", tester.test_auth_me),
        ("Get Current Family", tester.test_get_current_family),
        ("List Children", tester.test_list_children),
        ("Create Term", tester.test_create_term),
        ("Create Subject", tester.test_create_subject),
        ("Generate Lessons", tester.test_generate_lessons),
        ("Today Dashboard", tester.test_today_dashboard),
        ("List Lessons", tester.test_list_lessons),
        ("Create Chore Template", tester.test_create_chore_template),
        ("List Chore Templates", tester.test_list_chore_templates),
        ("List Wallets", tester.test_list_wallets),
        ("Create Conversation", tester.test_create_conversation),
        ("List Conversations", tester.test_list_conversations),
        ("List Notifications", tester.test_list_notifications),
        ("School Reports", tester.test_school_reports),
        ("Register New User", tester.test_register_new_user),
        # NEW FEATURES
        ("Admin Login", tester.test_admin_login),
        ("Admin Dashboard", tester.test_admin_dashboard),
        ("Admin Settings", tester.test_admin_settings),
        ("Billing Plans", tester.test_billing_plans),
        ("Billing Status", tester.test_billing_status),
        ("Billing Subscribe (Stub)", tester.test_billing_subscribe_stub),
        ("Family Streaks", tester.test_streaks_api),
        ("Email Send (Stub)", tester.test_email_send),
        ("Create Child Account", tester.test_create_child_account),
        ("Child Login", tester.test_child_login),
    ]
    
    for test_name, test_func in tests:
        try:
            test_func()
        except Exception as e:
            print(f"❌ {test_name} crashed: {str(e)}")
            tester.errors.append(f"{test_name}: Crashed - {str(e)}")
    
    # Print results
    print("\n" + "=" * 50)
    print("📊 TEST RESULTS")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    
    if tester.errors:
        print(f"\n❌ ERRORS ({len(tester.errors)}):")
        for error in tester.errors:
            print(f"  • {error}")
    
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"\n🎯 Success Rate: {success_rate:.1f}%")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())