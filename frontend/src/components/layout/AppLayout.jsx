import React, { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Home, CalendarDays, BookOpen, Users, ClipboardList,
  MessageCircle, Wallet, BarChart3, Settings, LogOut,
  Bell, Menu, X, GraduationCap, ChevronRight, Shield, FileText
} from 'lucide-react';

const NAV_ITEMS = [
  { path: '/today', label: 'Today', icon: Home },
  { path: '/planner', label: 'Planner', icon: CalendarDays },
  { path: '/lessons', label: 'Lessons', icon: FileText },
  { path: '/curriculum', label: 'Curriculum', icon: BookOpen },
  { path: '/children', label: 'Children', icon: Users },
  { path: '/chores', label: 'Chores', icon: ClipboardList },
  { path: '/messages', label: 'Messages', icon: MessageCircle },
  { path: '/allowance', label: 'Allowance', icon: Wallet },
  { path: '/reports', label: 'Reports', icon: BarChart3 },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const ADMIN_ITEM = { path: '/admin', label: 'Admin', icon: Shield };

export default function AppLayout() {
  const { user, family, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isChild = user?.role === 'child';
  const navItems = isChild
    ? NAV_ITEMS.filter(i => ['/today', '/lessons', '/chores', '/messages', '/allowance'].includes(i.path))
    : user?.role === 'superadmin'
    ? [...NAV_ITEMS, ADMIN_ITEM]
    : NAV_ITEMS;

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex" data-testid="app-layout">
      <div className="noise-overlay" />

      {/* Mobile menu button */}
      <button
        data-testid="mobile-menu-toggle"
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-xl bg-white shadow-md border border-[#E8D5B5]/50"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/20 z-30 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        data-testid="sidebar"
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-72 bg-white border-r border-[#E8D5B5]/50 flex flex-col transform transition-transform duration-300 ease-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="p-6 pb-4">
          <Link to="/today" className="flex items-center gap-3" data-testid="logo-link">
            <div className="w-10 h-10 rounded-2xl bg-[#2D4F3F] flex items-center justify-center">
              <GraduationCap className="text-white" size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#2D4F3F]" style={{fontFamily: 'Fraunces, serif'}}>BOMA</h1>
              <p className="text-xs text-[#2A2A2A]/50 font-medium">{family?.name || 'The Homeschool Hearth'}</p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 overflow-y-auto">
          <div className="space-y-1">
            {navItems.map(({ path, label, icon: Icon }) => {
              const active = location.pathname === path || location.pathname.startsWith(path + '/');
              return (
                <Link
                  key={path}
                  to={path}
                  data-testid={`nav-${label.toLowerCase()}`}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors duration-200 ${
                    active
                      ? 'bg-[#E8D5B5]/60 text-[#2D4F3F]'
                      : 'text-[#2A2A2A]/60 hover:bg-[#E8D5B5]/30 hover:text-[#2D4F3F]'
                  }`}
                >
                  <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                  <span>{label}</span>
                  {active && <ChevronRight size={14} className="ml-auto" />}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-[#E8D5B5]/50">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: user?.avatar_color || '#2D4F3F' }}
            >
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#2A2A2A] truncate">{user?.name}</p>
              <p className="text-xs text-[#2A2A2A]/50 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            data-testid="logout-btn"
            onClick={logout}
            className="flex items-center gap-2 text-sm text-[#2A2A2A]/50 hover:text-[#E05A6D] font-medium transition-colors duration-200 w-full px-2 py-1.5 rounded-lg hover:bg-[#E05A6D]/5"
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-[#FDFBF7]/80 backdrop-blur-xl border-b border-[#E8D5B5]/30">
          <div className="flex items-center justify-between px-6 lg:px-8 py-4">
            <div className="lg:hidden w-10" /> {/* spacer for mobile menu btn */}
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              <Link to="/notifications" data-testid="notifications-btn" className="relative p-2 rounded-xl hover:bg-[#E8D5B5]/30 transition-colors duration-200">
                <Bell size={20} className="text-[#2A2A2A]/60" />
              </Link>
            </div>
          </div>
        </header>

        <div className="px-6 lg:px-8 py-6 max-w-[1200px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
