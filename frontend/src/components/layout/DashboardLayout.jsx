import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import {
  LayoutDashboard,
  Users,
  Building2,
  Target,
  Package,
  FileText,
  Receipt,
  CreditCard,
  BarChart3,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Bell,
  Search,
  Settings,
  Moon,
  Sun
} from 'lucide-react';

function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuOpen && !e.target.closest('.user-menu-container')) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [userMenuOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setSidebarOpen(false);
        setUserMenuOpen(false);
        setSearchOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['Admin', 'Sales', 'Finance'] },
    { name: 'Analytics', href: '/analytics', icon: BarChart3, roles: ['Admin', 'Sales', 'Finance'] },
    { name: 'Leads', href: '/leads', icon: Users, roles: ['Admin', 'Sales'] },
    { name: 'Contacts', href: '/contacts', icon: Users, roles: ['Admin', 'Sales'] },
    { name: 'Accounts', href: '/accounts', icon: Building2, roles: ['Admin', 'Sales'] },
    { name: 'Opportunities', href: '/opportunities', icon: Target, roles: ['Admin', 'Sales'] },
    { name: 'Products', href: '/products', icon: Package, roles: ['Admin', 'Sales', 'Finance'] },
    { name: 'Quotes', href: '/quotes', icon: FileText, roles: ['Admin', 'Sales', 'Finance'] },
    { name: 'Invoices', href: '/invoices', icon: Receipt, roles: ['Admin', 'Sales', 'Finance'] },
    { name: 'Payments', href: '/payments', icon: CreditCard, roles: ['Admin', 'Finance'] },
  ];

  const filteredNavigation = navigation.filter(item => 
    item.roles.includes(user?.role)
  );

  const sidebarWidth = sidebarCollapsed ? 'w-20' : 'w-72';
  const mainPadding = sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72';

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'dark bg-slate-950' : 'bg-slate-50'}`}>
      {/* Mobile Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-xl lg:shadow-none transition-all duration-300 ease-out ${sidebarWidth} ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200 dark:border-slate-800">
          <Link 
            to="/" 
            className={`flex items-center gap-3 group ${sidebarCollapsed ? 'justify-center w-full' : ''}`}
          >
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50 transition-shadow">
              <LayoutDashboard size={20} className="text-white" />
              <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            {!sidebarCollapsed && (
              <span className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                CRM Pro
              </span>
            )}
          </Link>
          
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
          {filteredNavigation.map((item, index) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href || 
                             (item.href !== '/' && location.pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  sidebarCollapsed ? 'justify-center' : ''
                } ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/30'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <Icon size={20} className={`flex-shrink-0 ${isActive ? '' : 'group-hover:scale-110'} transition-transform`} />
                {!sidebarCollapsed && <span>{item.name}</span>}
                
                {/* Tooltip for collapsed sidebar */}
                {sidebarCollapsed && (
                  <div className="absolute left-full ml-3 px-3 py-2 bg-slate-900 dark:bg-slate-700 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-xl">
                    {item.name}
                    <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-slate-900 dark:bg-slate-700 rotate-45" />
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Collapse Toggle (Desktop) */}
        <div className="hidden lg:block px-3 py-2 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
          >
            <ChevronDown 
              size={20} 
              className={`transition-transform duration-300 ${sidebarCollapsed ? 'rotate-[-90deg]' : 'rotate-90'}`} 
            />
            {!sidebarCollapsed && <span>Collapse</span>}
          </button>
        </div>

        {/* User Section */}
        <div className="user-menu-container relative border-t border-slate-200 dark:border-slate-800 p-3">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={`flex items-center gap-3 w-full p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
              sidebarCollapsed ? 'justify-center' : ''
            }`}
          >
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white font-semibold shadow-lg">
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
            </div>
            
            {!sidebarCollapsed && (
              <>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {user?.full_name || 'User'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {user?.role || 'Member'}
                  </p>
                </div>
                <ChevronDown 
                  size={16} 
                  className={`text-slate-400 transition-transform duration-200 ${userMenuOpen ? 'rotate-180' : ''}`} 
                />
              </>
            )}
          </button>

          {/* User Dropdown */}
          <div
            className={`absolute bottom-full left-3 right-3 mb-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden transition-all duration-200 ${
              userMenuOpen 
                ? 'opacity-100 translate-y-0 visible' 
                : 'opacity-0 translate-y-2 invisible'
            }`}
          >
            <div className="p-2">
              <Link
                to="/settings"
                className="flex items-center gap-3 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <Settings size={16} />
                Settings
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-3 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={`min-h-screen transition-all duration-300 ${mainPadding}`}>
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6">
            {/* Left Section */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Open sidebar"
              >
                <Menu size={22} />
              </button>

              {/* Search Bar */}
              <div className="hidden sm:block relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-64 lg:w-80 pl-10 pr-4 py-2 text-sm bg-slate-100 dark:bg-slate-800 border-0 rounded-xl text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
                <kbd className="hidden lg:flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-1 px-2 py-0.5 text-xs text-slate-400 bg-slate-200 dark:bg-slate-700 rounded">
                  ⌘K
                </kbd>
              </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Mobile Search Button */}
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="sm:hidden p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Search size={20} />
              </button>

              {/* Dark Mode Toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Toggle dark mode"
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              {/* Notifications */}
              <button className="relative p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <Bell size={20} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
              </button>

              {/* User Avatar (Desktop) */}
              <div className="hidden lg:flex items-center gap-3 pl-3 ml-2 border-l border-slate-200 dark:border-slate-700">
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {user?.full_name || 'User'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date().toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white font-semibold shadow-lg cursor-pointer hover:shadow-xl transition-shadow">
                  {user?.full_name?.charAt(0) || 'U'}
                </div>
              </div>
            </div>
          </div>

          {/* Mobile Search Expanded */}
          <div
            className={`sm:hidden border-t border-slate-200 dark:border-slate-800 overflow-hidden transition-all duration-300 ${
              searchOpen ? 'max-h-20 py-3 px-4' : 'max-h-0'
            }`}
          >
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-100 dark:bg-slate-800 border-0 rounded-xl text-slate-900 dark:text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8">
          <div className="animate-fadeIn">
            {children}
          </div>
        </main>
      </div>

      {/* Global Styles */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }
        
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 3px;
        }
        
        .dark .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #334155;
        }
        
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
        
        .dark .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
      `}</style>
    </div>
  );
}

export default DashboardLayout;