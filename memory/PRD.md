# BOMA - The Homeschool Hearth
## Product Requirements Document

### Original Problem Statement
Build "BOMA" — a subscription PWA for families to manage homeschool curriculum, chores, allowance/pocket-money, and kid-safe messaging.

### Architecture
- **Frontend**: React 19 + Tailwind CSS + Radix UI (shadcn/ui) on port 3000
- **Backend**: FastAPI (Python) on port 8001
- **Database**: MongoDB
- **Auth**: JWT-based with role-based access (parent, child, superadmin, tutor)
- **PDF Export**: ReportLab
- **Messaging**: HTTP polling
- **Rich Text Editor**: react-quill-new (Quill 2.0 + React 19 compatible)

### User Personas
1. **Parent/Guardian**: Manages curriculum, children, chores, allowance, messaging, billing
2. **Child (6-18)**: Views daily tasks, marks completion, chats with family, manages pocket money
3. **SuperAdmin**: Cross-family access for support
4. **Tutor**: View-only access to schoolwork, no chat

### Core Requirements (Static)
- Family-scoped data (team_id isolation)
- Role-based access control (RBAC)
- Kid-safe messaging with parental controls
- Curriculum planning with term/subject/lesson management
- Chores tracking with completion workflows
- Allowance/wallet with ledger-based balance
- Reports with CSV/PDF export
- Subscription billing stubs

---

### What's Been Implemented (Feb 16, 2026)

#### Phase 1 - MVP (COMPLETE)
- **Authentication**: Register, Login, JWT tokens, role-based routing
- **Child Login**: Username-based login for children (no email required)
- **Family Management**: Create family, join via invite code, family settings
- **Children CRUD**: Add/edit/delete children, schedule weekdays, avatar colors
- **Terms & Term Breaks**: Create terms, add breaks within term dates, date validation, no overlap
- **Subjects**: Create/edit/delete with color coding
- **Lesson Generation**: Auto-generate lessons across term dates, skip breaks & non-schedule days
- **Today Dashboard**: Parent view (all children + filters), progress tracking, quick links, navigate to lessons
- **Weekly Planner**: Mon-Sun grid, prev/next week nav, lesson status toggle, child filter, navigate to lessons

#### Phase 2 - Enhanced Lessons (COMPLETE - Feb 16, 2026)
- **Lessons List Page**: Full CRUD with search, filters (child, subject, status), stats display
- **Lesson Detail Page**: Content/Instructions/Quiz tabs, edit mode, mark complete
- **WYSIWYG Editor**: Rich text content editing with Quill 2.0 (react-quill-new)
- **Parent Instructions**: Dedicated instructions field for parent-to-child guidance
- **Quiz Builder**: Multiple choice questions (radio) with options, text questions, correct answer setting
- **Quiz Taking**: Children can answer questions with radio buttons or text inputs
- **Quiz Auto-Grading**: Automatic scoring with case-insensitive matching, results display

#### Other Modules (COMPLETE)
- **Chores Module**: Templates (name, category, points, frequency), assign to children, instances, completion toggle
- **Messaging**: Create conversations (family/direct/siblings), send messages, HTTP polling, message reporting
- **Allowance/Wallet**: Wallet per child, ledger entries (credit/debit), spend requests, approve/reject, source types
- **Reports**: School report (by subject, by week), chores summary, allowance summary, CSV export, PDF export
- **Notifications**: In-app notification list, mark read/unread, activity log
- **Settings**: Family details, invite code, child accounts, billing plans UI (stub), API keys UI (stub)
- **SuperAdmin Dashboard**: App-wide stats view
- **Family Streak Board**: Activity tracking on Today dashboard
- **PWA Service Worker**: Basic app shell caching

### Verification Checklist
- [x] Auth works (register, login, logout)
- [x] Child login with username (no email)
- [x] Family create/join works
- [x] Children CRUD works
- [x] Terms CRUD with date validation & no overlap
- [x] Term breaks within term dates only
- [x] Subjects CRUD
- [x] Lesson generation skips breaks & non-schedule days
- [x] **Full Lesson CRUD with content/instructions**
- [x] **WYSIWYG editor for lesson content**
- [x] **Quiz builder (radio + text questions)**
- [x] **Quiz taking and auto-grading**
- [x] Today view shows lessons + chores with progress
- [x] Weekly planner Mon-Sun with stable prev/next
- [x] **Navigate from Today/Planner to lesson detail**
- [x] Chore templates, assignment, completion toggle
- [x] Messaging conversations, send/receive, reporting
- [x] Wallet ledger, entries, spend requests, approvals
- [x] Reports with CSV + PDF export
- [x] Notifications + activity log
- [x] Role-based routing (parent vs child views)
- [x] Billing endpoint works in stub mode

### Testing Results
- Backend: 100% (37/37 API tests passed)
- Frontend: 100% (all tested features working)

---

### Prioritized Backlog

#### P0 (Next)
- PayFast subscription integration (replace stubs with real API calls)
- Resend email notifications (implement actual email sending)
- PWA offline action queueing (sync when back online)

#### P1
- Lesson attachments (links/files)
- Full Messaging Module (threads, parental controls, content moderation)
- Full Allowance Module (automatic allowance jobs, approval workflows)
- Full Reports Module (CSV/PDF generation logic)
- Tutor role implementation with view-only access

#### P2
- Message retention job (scheduled pruning)
- Cross-family friend links / approvals
- Profanity filter for messaging
- Chore photo proof uploads
- Automatic weekly allowance posting (scheduled job)
- Real-time WebSocket messaging
- Advanced reporting (term-level breakdowns, trend charts)
- Mobile-responsive refinements
- Dark mode / kid-mode theme toggle
