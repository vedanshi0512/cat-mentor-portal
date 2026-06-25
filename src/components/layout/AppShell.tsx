import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { LogOut, Settings } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

export default function AppShell({
  navItems,
  children,
  title,
}: {
  navItems: NavItem[];
  children: ReactNode;
  title: string;
}) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-ink-50 flex">
      <aside className="w-60 bg-white border-r border-ink-200 flex flex-col">
        <div className="px-5 py-5 border-b border-ink-200">
          <div className="text-ink-700 font-bold text-lg">CAT Mentor Portal</div>
          <div className="text-ink-400 text-xs mt-0.5">{title}</div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-catblue-50 text-catblue-700'
                    : 'text-ink-500 hover:bg-ink-100 hover:text-ink-700'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-ink-200 space-y-1">
          <div className="px-3 py-1.5 text-ink-400 text-sm">
            {session?.role === 'student' ? session.studentName : 'Mentor'}
          </div>
          <NavLink
            to="/setup"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors"
          >
            <Settings size={16} />
            Connection settings
          </NavLink>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors"
          >
            <LogOut size={16} />
            Switch user
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
