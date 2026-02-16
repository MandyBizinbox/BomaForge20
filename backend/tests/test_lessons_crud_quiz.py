"""
BOMA Backend API Tests - Lessons CRUD and Quiz Functionality
Tests for:
- Lessons List with filters
- Create new lesson
- Get lesson detail
- Update lesson (title, description, instructions, content)
- Update lesson quiz
- Submit quiz answers (child)
- Delete lesson
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
PARENT_CREDS = {"email": "parent@test.com", "password": "password"}
CHILD_CREDS = {"username": "emma.child", "password": "password"}

# Test lesson ID provided
TEST_LESSON_ID = "cf6c9da1-1732-4950-9c28-b0b4ebe7a2a1"


class TestLessonsList:
    """Test lessons list endpoint with various filters"""
    
    @pytest.fixture
    def parent_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=PARENT_CREDS)
        if response.status_code != 200:
            pytest.skip("Parent login failed")
        return response.json()["token"]

    def test_list_all_lessons(self, parent_token):
        """Test listing all lessons"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        response = requests.get(f"{BASE_URL}/api/curriculum/lessons", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "lessons" in data, "Response should contain lessons array"
        print(f"✅ Lessons list: {len(data['lessons'])} lessons found")
        return data["lessons"]

    def test_filter_lessons_by_child(self, parent_token):
        """Test filtering lessons by child_id"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        # First get children
        children_resp = requests.get(f"{BASE_URL}/api/children", headers=headers)
        if children_resp.status_code == 200 and children_resp.json().get("children"):
            child_id = children_resp.json()["children"][0]["id"]
            response = requests.get(f"{BASE_URL}/api/curriculum/lessons", 
                                    params={"child_id": child_id}, headers=headers)
            assert response.status_code == 200
            data = response.json()
            print(f"✅ Filtered by child: {len(data['lessons'])} lessons")
        else:
            pytest.skip("No children found to filter by")

    def test_filter_lessons_by_subject(self, parent_token):
        """Test filtering lessons by subject_id"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        # First get subjects
        subjects_resp = requests.get(f"{BASE_URL}/api/curriculum/subjects", headers=headers)
        if subjects_resp.status_code == 200 and subjects_resp.json().get("subjects"):
            subject_id = subjects_resp.json()["subjects"][0]["id"]
            response = requests.get(f"{BASE_URL}/api/curriculum/lessons", 
                                    params={"subject_id": subject_id}, headers=headers)
            assert response.status_code == 200
            data = response.json()
            print(f"✅ Filtered by subject: {len(data['lessons'])} lessons")
        else:
            pytest.skip("No subjects found to filter by")

    def test_filter_lessons_by_date(self, parent_token):
        """Test filtering lessons by date"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(f"{BASE_URL}/api/curriculum/lessons", 
                                params={"date": today}, headers=headers)
        assert response.status_code == 200
        data = response.json()
        print(f"✅ Filtered by date ({today}): {len(data['lessons'])} lessons")


class TestLessonsCRUD:
    """Test lesson Create, Read, Update, Delete operations"""
    
    @pytest.fixture
    def parent_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=PARENT_CREDS)
        if response.status_code != 200:
            pytest.skip("Parent login failed")
        return response.json()["token"]

    @pytest.fixture
    def test_data(self, parent_token):
        """Get child_id and subject_id for creating lessons"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        children = requests.get(f"{BASE_URL}/api/children", headers=headers).json().get("children", [])
        subjects = requests.get(f"{BASE_URL}/api/curriculum/subjects", headers=headers).json().get("subjects", [])
        
        if not children or not subjects:
            pytest.skip("No children or subjects found")
        
        return {
            "child_id": children[0]["id"],
            "subject_id": subjects[0]["id"],
            "child_name": children[0].get("name", "Unknown"),
            "subject_name": subjects[0].get("name", "Unknown")
        }

    def test_create_lesson(self, parent_token, test_data):
        """Test creating a new lesson with full content"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        unique_id = str(uuid.uuid4())[:8]
        
        payload = {
            "child_id": test_data["child_id"],
            "subject_id": test_data["subject_id"],
            "title": f"TEST_Lesson_{unique_id}",
            "description": "Test lesson description",
            "instructions": "Test parent instructions for child",
            "content": "<h2>Test Content</h2><p>This is <strong>rich text</strong> content.</p>",
            "planned_date": datetime.now().strftime("%Y-%m-%d")
        }
        
        response = requests.post(f"{BASE_URL}/api/curriculum/lessons", json=payload, headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "lesson" in data, "Response should contain lesson"
        lesson = data["lesson"]
        
        # Data assertions
        assert lesson["title"] == payload["title"], "Title should match"
        assert lesson["description"] == payload["description"], "Description should match"
        assert lesson["instructions"] == payload["instructions"], "Instructions should match"
        assert lesson["content"] == payload["content"], "Content should match"
        assert lesson["child_id"] == payload["child_id"], "Child ID should match"
        assert lesson["subject_id"] == payload["subject_id"], "Subject ID should match"
        assert "id" in lesson, "Lesson should have an ID"
        assert lesson["status"] == "pending", "New lesson should be pending"
        
        print(f"✅ Created lesson: {lesson['title']} (ID: {lesson['id'][:8]}...)")
        return lesson["id"]

    def test_get_lesson_detail(self, parent_token):
        """Test getting lesson detail including quiz and submissions"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        response = requests.get(f"{BASE_URL}/api/curriculum/lessons/{TEST_LESSON_ID}", headers=headers)
        
        if response.status_code == 404:
            pytest.skip(f"Test lesson {TEST_LESSON_ID} not found - may have been deleted")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "lesson" in data, "Response should contain lesson"
        lesson = data["lesson"]
        
        # Verify structure
        assert "id" in lesson, "Lesson should have id"
        assert "title" in lesson, "Lesson should have title"
        assert "submissions" in lesson, "Lesson should have submissions array"
        
        print(f"✅ Got lesson detail: {lesson['title']}")
        print(f"   - Has quiz: {bool(lesson.get('quiz'))}, Questions: {len(lesson.get('quiz', []))}")
        print(f"   - Submissions: {len(lesson.get('submissions', []))}")
        return lesson

    def test_update_lesson_content(self, parent_token, test_data):
        """Test updating lesson title, description, instructions, content"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        unique_id = str(uuid.uuid4())[:8]
        
        # First create a lesson
        create_payload = {
            "child_id": test_data["child_id"],
            "subject_id": test_data["subject_id"],
            "title": f"TEST_Update_{unique_id}",
            "planned_date": datetime.now().strftime("%Y-%m-%d")
        }
        create_resp = requests.post(f"{BASE_URL}/api/curriculum/lessons", json=create_payload, headers=headers)
        assert create_resp.status_code == 200, f"Failed to create test lesson: {create_resp.text}"
        lesson_id = create_resp.json()["lesson"]["id"]
        
        # Now update it
        update_payload = {
            "title": f"TEST_Updated_Title_{unique_id}",
            "description": "Updated description text",
            "instructions": "Updated parent instructions with detailed steps",
            "content": "<h1>Updated Heading</h1><p>Updated <em>italic</em> and <strong>bold</strong> content.</p>"
        }
        
        response = requests.put(f"{BASE_URL}/api/curriculum/lessons/{lesson_id}", json=update_payload, headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        lesson = data["lesson"]
        
        # Verify updates
        assert lesson["title"] == update_payload["title"], "Title should be updated"
        assert lesson["description"] == update_payload["description"], "Description should be updated"
        assert lesson["instructions"] == update_payload["instructions"], "Instructions should be updated"
        assert lesson["content"] == update_payload["content"], "Content should be updated"
        
        # Verify with GET
        get_resp = requests.get(f"{BASE_URL}/api/curriculum/lessons/{lesson_id}", headers=headers)
        assert get_resp.status_code == 200
        fetched = get_resp.json()["lesson"]
        assert fetched["title"] == update_payload["title"], "Title should persist after GET"
        
        print(f"✅ Updated lesson: {lesson['title']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/curriculum/lessons/{lesson_id}", headers=headers)
        print(f"   - Cleaned up test lesson")

    def test_update_lesson_status(self, parent_token, test_data):
        """Test updating lesson status (pending -> done -> pending)"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        unique_id = str(uuid.uuid4())[:8]
        
        # Create a lesson
        create_payload = {
            "child_id": test_data["child_id"],
            "subject_id": test_data["subject_id"],
            "title": f"TEST_Status_{unique_id}",
            "planned_date": datetime.now().strftime("%Y-%m-%d")
        }
        create_resp = requests.post(f"{BASE_URL}/api/curriculum/lessons", json=create_payload, headers=headers)
        lesson_id = create_resp.json()["lesson"]["id"]
        
        # Mark as done
        response = requests.put(f"{BASE_URL}/api/curriculum/lessons/{lesson_id}", 
                                json={"status": "done"}, headers=headers)
        assert response.status_code == 200
        assert response.json()["lesson"]["status"] == "done", "Status should be done"
        assert response.json()["lesson"]["completed_at"] is not None, "Should have completed_at timestamp"
        
        # Mark back to pending
        response = requests.put(f"{BASE_URL}/api/curriculum/lessons/{lesson_id}", 
                                json={"status": "pending"}, headers=headers)
        assert response.status_code == 200
        assert response.json()["lesson"]["status"] == "pending", "Status should be pending"
        assert response.json()["lesson"]["completed_at"] is None, "completed_at should be cleared"
        
        print(f"✅ Status toggle works: pending -> done -> pending")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/curriculum/lessons/{lesson_id}", headers=headers)

    def test_delete_lesson(self, parent_token, test_data):
        """Test deleting a lesson"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        unique_id = str(uuid.uuid4())[:8]
        
        # Create a lesson to delete
        create_payload = {
            "child_id": test_data["child_id"],
            "subject_id": test_data["subject_id"],
            "title": f"TEST_Delete_{unique_id}",
            "planned_date": datetime.now().strftime("%Y-%m-%d")
        }
        create_resp = requests.post(f"{BASE_URL}/api/curriculum/lessons", json=create_payload, headers=headers)
        lesson_id = create_resp.json()["lesson"]["id"]
        
        # Delete it
        response = requests.delete(f"{BASE_URL}/api/curriculum/lessons/{lesson_id}", headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify deletion
        get_resp = requests.get(f"{BASE_URL}/api/curriculum/lessons/{lesson_id}", headers=headers)
        assert get_resp.status_code == 404, "Deleted lesson should return 404"
        
        print(f"✅ Lesson deleted and verified")


class TestQuizCRUD:
    """Test Quiz creation and management by parent"""
    
    @pytest.fixture
    def parent_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=PARENT_CREDS)
        if response.status_code != 200:
            pytest.skip("Parent login failed")
        return response.json()["token"]

    @pytest.fixture
    def test_data(self, parent_token):
        """Get child_id and subject_id for creating lessons"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        children = requests.get(f"{BASE_URL}/api/children", headers=headers).json().get("children", [])
        subjects = requests.get(f"{BASE_URL}/api/curriculum/subjects", headers=headers).json().get("subjects", [])
        
        if not children or not subjects:
            pytest.skip("No children or subjects found")
        
        return {
            "child_id": children[0]["id"],
            "subject_id": subjects[0]["id"]
        }

    def test_create_lesson_with_quiz(self, parent_token, test_data):
        """Test creating a lesson with quiz questions included"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        unique_id = str(uuid.uuid4())[:8]
        
        quiz_questions = [
            {
                "id": f"q1_{unique_id}",
                "question": "What is 2 + 2?",
                "type": "radio",
                "options": ["3", "4", "5", "6"],
                "correct_answer": "4"
            },
            {
                "id": f"q2_{unique_id}",
                "question": "What is the capital of France?",
                "type": "text",
                "correct_answer": "Paris"
            }
        ]
        
        payload = {
            "child_id": test_data["child_id"],
            "subject_id": test_data["subject_id"],
            "title": f"TEST_Quiz_Lesson_{unique_id}",
            "planned_date": datetime.now().strftime("%Y-%m-%d"),
            "quiz": quiz_questions
        }
        
        response = requests.post(f"{BASE_URL}/api/curriculum/lessons", json=payload, headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        lesson = response.json()["lesson"]
        assert lesson.get("quiz") is not None, "Lesson should have quiz"
        assert len(lesson["quiz"]) == 2, "Should have 2 quiz questions"
        assert lesson["quiz"][0]["type"] == "radio", "First question should be radio"
        assert lesson["quiz"][1]["type"] == "text", "Second question should be text"
        
        print(f"✅ Created lesson with quiz: {lesson['title']}")
        print(f"   - Quiz questions: {len(lesson['quiz'])}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/curriculum/lessons/{lesson['id']}", headers=headers)
        return lesson

    def test_update_lesson_quiz(self, parent_token, test_data):
        """Test updating quiz questions on an existing lesson"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        unique_id = str(uuid.uuid4())[:8]
        
        # Create lesson without quiz
        create_payload = {
            "child_id": test_data["child_id"],
            "subject_id": test_data["subject_id"],
            "title": f"TEST_AddQuiz_{unique_id}",
            "planned_date": datetime.now().strftime("%Y-%m-%d")
        }
        create_resp = requests.post(f"{BASE_URL}/api/curriculum/lessons", json=create_payload, headers=headers)
        lesson_id = create_resp.json()["lesson"]["id"]
        
        # Add quiz questions via PUT
        quiz_questions = [
            {
                "id": f"q1_{unique_id}",
                "question": "What color is the sky?",
                "type": "radio",
                "options": ["Red", "Blue", "Green", "Yellow"],
                "correct_answer": "Blue"
            },
            {
                "id": f"q2_{unique_id}",
                "question": "What sound does a dog make?",
                "type": "text",
                "correct_answer": "Bark"
            },
            {
                "id": f"q3_{unique_id}",
                "question": "Is water wet?",
                "type": "radio",
                "options": ["Yes", "No"],
                "correct_answer": "Yes"
            }
        ]
        
        response = requests.put(f"{BASE_URL}/api/curriculum/lessons/{lesson_id}/quiz", 
                                json={"quiz": quiz_questions}, headers=headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        lesson = response.json()["lesson"]
        assert len(lesson["quiz"]) == 3, "Should have 3 quiz questions"
        
        # Verify with GET
        get_resp = requests.get(f"{BASE_URL}/api/curriculum/lessons/{lesson_id}", headers=headers)
        fetched = get_resp.json()["lesson"]
        assert len(fetched["quiz"]) == 3, "Quiz should persist after GET"
        
        print(f"✅ Added quiz to existing lesson: {len(fetched['quiz'])} questions")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/curriculum/lessons/{lesson_id}", headers=headers)


class TestQuizSubmission:
    """Test quiz submission and auto-grading for children"""
    
    @pytest.fixture
    def parent_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=PARENT_CREDS)
        if response.status_code != 200:
            pytest.skip("Parent login failed")
        return response.json()["token"]

    @pytest.fixture
    def child_token(self):
        # Try with username field first
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": CHILD_CREDS["username"],
            "password": CHILD_CREDS["password"]
        })
        if response.status_code == 200:
            return response.json()["token"]
        
        # Try with email field
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": CHILD_CREDS["username"],
            "password": CHILD_CREDS["password"]
        })
        if response.status_code != 200:
            pytest.skip("Child login failed")
        return response.json()["token"]

    @pytest.fixture
    def test_data(self, parent_token):
        """Get child_id and subject_id"""
        headers = {"Authorization": f"Bearer {parent_token}"}
        children = requests.get(f"{BASE_URL}/api/children", headers=headers).json().get("children", [])
        subjects = requests.get(f"{BASE_URL}/api/curriculum/subjects", headers=headers).json().get("subjects", [])
        
        if not children or not subjects:
            pytest.skip("No children or subjects found")
        
        return {
            "child_id": children[0]["id"],
            "subject_id": subjects[0]["id"]
        }

    def test_submit_quiz_correct_answers(self, parent_token, child_token, test_data):
        """Test child submitting quiz with correct answers"""
        parent_headers = {"Authorization": f"Bearer {parent_token}"}
        child_headers = {"Authorization": f"Bearer {child_token}"}
        unique_id = str(uuid.uuid4())[:8]
        
        # Create lesson with quiz as parent
        quiz_questions = [
            {
                "id": f"q1_{unique_id}",
                "question": "What is 1 + 1?",
                "type": "radio",
                "options": ["1", "2", "3"],
                "correct_answer": "2"
            },
            {
                "id": f"q2_{unique_id}",
                "question": "Spell 'CAT'",
                "type": "text",
                "correct_answer": "CAT"
            }
        ]
        
        create_payload = {
            "child_id": test_data["child_id"],
            "subject_id": test_data["subject_id"],
            "title": f"TEST_QuizSubmit_{unique_id}",
            "planned_date": datetime.now().strftime("%Y-%m-%d"),
            "quiz": quiz_questions
        }
        create_resp = requests.post(f"{BASE_URL}/api/curriculum/lessons", json=create_payload, headers=parent_headers)
        lesson_id = create_resp.json()["lesson"]["id"]
        
        # Submit quiz as child with correct answers
        submit_payload = {
            "answers": {
                f"q1_{unique_id}": "2",
                f"q2_{unique_id}": "CAT"
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/curriculum/lessons/{lesson_id}/submit-quiz", 
                                 json=submit_payload, headers=child_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        submission = response.json()["submission"]
        assert submission["score"] == 2, f"Expected score 2, got {submission['score']}"
        assert submission["total"] == 2, f"Expected total 2, got {submission['total']}"
        assert submission["percentage"] == 100.0, f"Expected 100%, got {submission['percentage']}%"
        
        # Verify results
        for result in submission["results"]:
            assert result["is_correct"] == True, f"Answer to '{result['question']}' should be correct"
        
        print(f"✅ Quiz submitted with 100% score: {submission['score']}/{submission['total']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/curriculum/lessons/{lesson_id}", headers=parent_headers)

    def test_submit_quiz_partial_answers(self, parent_token, child_token, test_data):
        """Test child submitting quiz with some wrong answers"""
        parent_headers = {"Authorization": f"Bearer {parent_token}"}
        child_headers = {"Authorization": f"Bearer {child_token}"}
        unique_id = str(uuid.uuid4())[:8]
        
        quiz_questions = [
            {
                "id": f"q1_{unique_id}",
                "question": "What is 5 + 5?",
                "type": "radio",
                "options": ["5", "10", "15"],
                "correct_answer": "10"
            },
            {
                "id": f"q2_{unique_id}",
                "question": "Spell 'DOG'",
                "type": "text",
                "correct_answer": "DOG"
            }
        ]
        
        create_payload = {
            "child_id": test_data["child_id"],
            "subject_id": test_data["subject_id"],
            "title": f"TEST_PartialQuiz_{unique_id}",
            "planned_date": datetime.now().strftime("%Y-%m-%d"),
            "quiz": quiz_questions
        }
        create_resp = requests.post(f"{BASE_URL}/api/curriculum/lessons", json=create_payload, headers=parent_headers)
        lesson_id = create_resp.json()["lesson"]["id"]
        
        # Submit with 1 correct, 1 wrong
        submit_payload = {
            "answers": {
                f"q1_{unique_id}": "5",  # Wrong
                f"q2_{unique_id}": "DOG"  # Correct
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/curriculum/lessons/{lesson_id}/submit-quiz", 
                                 json=submit_payload, headers=child_headers)
        assert response.status_code == 200
        
        submission = response.json()["submission"]
        assert submission["score"] == 1, f"Expected score 1, got {submission['score']}"
        assert submission["percentage"] == 50.0, f"Expected 50%, got {submission['percentage']}%"
        
        print(f"✅ Quiz submitted with 50% score: {submission['score']}/{submission['total']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/curriculum/lessons/{lesson_id}", headers=parent_headers)

    def test_submit_quiz_case_insensitive(self, parent_token, child_token, test_data):
        """Test that text answers are case-insensitive"""
        parent_headers = {"Authorization": f"Bearer {parent_token}"}
        child_headers = {"Authorization": f"Bearer {child_token}"}
        unique_id = str(uuid.uuid4())[:8]
        
        quiz_questions = [
            {
                "id": f"q1_{unique_id}",
                "question": "What is the capital of England?",
                "type": "text",
                "correct_answer": "London"
            }
        ]
        
        create_payload = {
            "child_id": test_data["child_id"],
            "subject_id": test_data["subject_id"],
            "title": f"TEST_CaseInsensitive_{unique_id}",
            "planned_date": datetime.now().strftime("%Y-%m-%d"),
            "quiz": quiz_questions
        }
        create_resp = requests.post(f"{BASE_URL}/api/curriculum/lessons", json=create_payload, headers=parent_headers)
        lesson_id = create_resp.json()["lesson"]["id"]
        
        # Submit with lowercase answer
        submit_payload = {
            "answers": {
                f"q1_{unique_id}": "london"  # lowercase
            }
        }
        
        response = requests.post(f"{BASE_URL}/api/curriculum/lessons/{lesson_id}/submit-quiz", 
                                 json=submit_payload, headers=child_headers)
        assert response.status_code == 200
        
        submission = response.json()["submission"]
        assert submission["score"] == 1, "Case-insensitive answer should be correct"
        
        print(f"✅ Case-insensitive matching works: 'london' matched 'London'")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/curriculum/lessons/{lesson_id}", headers=parent_headers)

    def test_quiz_submission_persists(self, parent_token, child_token, test_data):
        """Test that quiz submission is saved and can be retrieved"""
        parent_headers = {"Authorization": f"Bearer {parent_token}"}
        child_headers = {"Authorization": f"Bearer {child_token}"}
        unique_id = str(uuid.uuid4())[:8]
        
        quiz_questions = [
            {
                "id": f"q1_{unique_id}",
                "question": "Test question",
                "type": "radio",
                "options": ["A", "B"],
                "correct_answer": "A"
            }
        ]
        
        create_payload = {
            "child_id": test_data["child_id"],
            "subject_id": test_data["subject_id"],
            "title": f"TEST_PersistSubmission_{unique_id}",
            "planned_date": datetime.now().strftime("%Y-%m-%d"),
            "quiz": quiz_questions
        }
        create_resp = requests.post(f"{BASE_URL}/api/curriculum/lessons", json=create_payload, headers=parent_headers)
        lesson_id = create_resp.json()["lesson"]["id"]
        
        # Submit quiz
        submit_payload = {"answers": {f"q1_{unique_id}": "A"}}
        requests.post(f"{BASE_URL}/api/curriculum/lessons/{lesson_id}/submit-quiz", 
                      json=submit_payload, headers=child_headers)
        
        # Verify submission is in lesson detail
        get_resp = requests.get(f"{BASE_URL}/api/curriculum/lessons/{lesson_id}", headers=parent_headers)
        lesson = get_resp.json()["lesson"]
        
        assert len(lesson["submissions"]) > 0, "Submission should be saved"
        assert lesson["submissions"][0]["score"] == 1, "Submission score should be correct"
        
        print(f"✅ Quiz submission persisted in lesson detail")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/curriculum/lessons/{lesson_id}", headers=parent_headers)


class TestLessonPermissions:
    """Test lesson access permissions"""
    
    @pytest.fixture
    def parent_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json=PARENT_CREDS)
        if response.status_code != 200:
            pytest.skip("Parent login failed")
        return response.json()["token"]

    @pytest.fixture
    def child_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": CHILD_CREDS["username"],
            "password": CHILD_CREDS["password"]
        })
        if response.status_code != 200:
            response = requests.post(f"{BASE_URL}/api/auth/login", json={
                "email": CHILD_CREDS["username"],
                "password": CHILD_CREDS["password"]
            })
        if response.status_code != 200:
            pytest.skip("Child login failed")
        return response.json()["token"]

    def test_child_cannot_create_lesson(self, child_token):
        """Test that children cannot create lessons"""
        headers = {"Authorization": f"Bearer {child_token}"}
        payload = {
            "child_id": "some-id",
            "subject_id": "some-id",
            "title": "Child Created Lesson",
            "planned_date": datetime.now().strftime("%Y-%m-%d")
        }
        response = requests.post(f"{BASE_URL}/api/curriculum/lessons", json=payload, headers=headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"✅ Child correctly denied lesson creation")

    def test_child_cannot_delete_lesson(self, parent_token, child_token):
        """Test that children cannot delete lessons"""
        parent_headers = {"Authorization": f"Bearer {parent_token}"}
        child_headers = {"Authorization": f"Bearer {child_token}"}
        
        # Get existing lessons
        lessons_resp = requests.get(f"{BASE_URL}/api/curriculum/lessons", headers=parent_headers)
        lessons = lessons_resp.json().get("lessons", [])
        
        if not lessons:
            pytest.skip("No lessons to test delete permission")
        
        lesson_id = lessons[0]["id"]
        response = requests.delete(f"{BASE_URL}/api/curriculum/lessons/{lesson_id}", headers=child_headers)
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"✅ Child correctly denied lesson deletion")

    def test_child_can_view_lesson(self, parent_token, child_token):
        """Test that children can view their assigned lessons"""
        parent_headers = {"Authorization": f"Bearer {parent_token}"}
        child_headers = {"Authorization": f"Bearer {child_token}"}
        
        # Get existing lessons
        lessons_resp = requests.get(f"{BASE_URL}/api/curriculum/lessons", headers=parent_headers)
        lessons = lessons_resp.json().get("lessons", [])
        
        if not lessons:
            pytest.skip("No lessons to test view permission")
        
        lesson_id = lessons[0]["id"]
        response = requests.get(f"{BASE_URL}/api/curriculum/lessons/{lesson_id}", headers=child_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"✅ Child can view assigned lesson")

    def test_child_can_update_status(self, parent_token, child_token):
        """Test that children can update lesson status"""
        parent_headers = {"Authorization": f"Bearer {parent_token}"}
        child_headers = {"Authorization": f"Bearer {child_token}"}
        
        # Get existing lessons
        lessons_resp = requests.get(f"{BASE_URL}/api/curriculum/lessons", headers=parent_headers)
        lessons = lessons_resp.json().get("lessons", [])
        
        if not lessons:
            pytest.skip("No lessons to test status update")
        
        lesson_id = lessons[0]["id"]
        original_status = lessons[0]["status"]
        new_status = "done" if original_status == "pending" else "pending"
        
        response = requests.put(f"{BASE_URL}/api/curriculum/lessons/{lesson_id}", 
                                json={"status": new_status}, headers=child_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Restore original status
        requests.put(f"{BASE_URL}/api/curriculum/lessons/{lesson_id}", 
                     json={"status": original_status}, headers=parent_headers)
        print(f"✅ Child can update lesson status")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
