import { Outlet } from 'react-router-dom';
import { ClipboardList, BarChart3, Users } from 'lucide-react';
import AppShell from '@/components/layout/AppShell';

export default function MentorLayout() {
  return (
    <AppShell
      title="Mentor"
      navItems={[
        { to: '/mentor/tests', label: 'Tests', icon: <ClipboardList size={16} /> },
        { to: '/mentor/analytics', label: 'Analytics', icon: <BarChart3 size={16} /> },
        { to: '/mentor/students', label: 'Students', icon: <Users size={16} /> },
      ]}
    >
      <Outlet />
    </AppShell>
  );
}
