import { Outlet } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Bookmark } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';

export default function StudentLayout() {
  return (
    <AppShell
      title="Student"
      navItems={[
        { to: '/student', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
        { to: '/student/tests', label: 'Tests', icon: <ClipboardList size={16} /> },
        { to: '/student/bookmarks', label: 'Bookmarks', icon: <Bookmark size={16} /> },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}
