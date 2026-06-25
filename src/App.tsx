import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { RequireSetup, RequireRole } from '@/components/common/RouteGuards';

import RootRedirect from '@/pages/RootRedirect';
import SetupPage from '@/pages/auth/SetupPage';
import LoginPage from '@/pages/auth/LoginPage';

import MentorLayout from '@/pages/mentor/MentorLayout';
import TestListPage from '@/pages/mentor/TestListPage';
import TestBuilderPage from '@/pages/mentor/TestBuilderPage';
import MentorAnalyticsPage from '@/pages/mentor/MentorAnalyticsPage';
import ManageStudentsPage from '@/pages/mentor/ManageStudentsPage';

import StudentLayout from '@/pages/student/StudentLayout';
import StudentDashboardPage from '@/pages/student/StudentDashboardPage';
import StudentTestListPage from '@/pages/student/StudentTestListPage';
import TestAttemptPage from '@/pages/student/TestAttemptPage';
import PostTestAnalysisPage from '@/pages/student/PostTestAnalysisPage';
import BookmarksPage from '@/pages/student/BookmarksPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/cat-mentor-portal">
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route
            path="/login"
            element={
              <RequireSetup>
                <LoginPage />
              </RequireSetup>
            }
          />

          {/* Mentor routes — wrapped in shell */}
          <Route
            path="/mentor"
            element={
              <RequireRole role="mentor">
                <MentorLayout />
              </RequireRole>
            }
          >
            <Route index element={<Navigate to="tests" replace />} />
            <Route path="tests" element={<TestListPage />} />
            <Route path="tests/new" element={<TestBuilderPage />} />
            <Route path="tests/:testId/edit" element={<TestBuilderPage />} />
            <Route path="analytics" element={<MentorAnalyticsPage />} />
            <Route path="students" element={<ManageStudentsPage />} />
          </Route>

          {/* Student routes — wrapped in shell, except the live test attempt screen */}
          <Route
            path="/student"
            element={
              <RequireRole role="student">
                <StudentLayout />
              </RequireRole>
            }
          >
            <Route index element={<StudentDashboardPage />} />
            <Route path="tests" element={<StudentTestListPage />} />
            <Route path="attempts/:attemptId" element={<PostTestAnalysisPage />} />
            <Route path="bookmarks" element={<BookmarksPage />} />
          </Route>

          {/* Full-screen test runner, no sidebar */}
          <Route
            path="/student/tests/:testId/attempt"
            element={
              <RequireRole role="student">
                <TestAttemptPage />
              </RequireRole>
            }
          />

          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
