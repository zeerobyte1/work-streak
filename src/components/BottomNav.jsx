import { Link, useLocation } from 'react-router-dom';
import { CheckSquare, Flame, Calendar, User } from 'lucide-react';

export default function BottomNav() {
  const location = useLocation();

  const navItems = [
    { icon: CheckSquare, label: 'Tasks', to: '/daily-tasks' },
    { icon: Flame, label: 'Habits', to: '/habits' },
    { icon: Calendar, label: 'Future', to: '/future-tasks' },
    { icon: User, label: 'Profile', to: '/profile' }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-[#232946]/95 backdrop-blur-md border-t border-[#e3e3e3] dark:border-[#353a50] shadow-lg z-50">
      <div className="max-w-sm mx-auto px-2">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center justify-center flex-1 h-full transition-all font-bold text-black dark:text-white`}
              >
                <div className={`p-2 rounded-xl transition-all ${
                  isActive
                    ? 'bg-[#e6fff6] dark:bg-[#353a50]/80 shadow'
                    : 'hover:bg-[#f0f4f8] dark:hover:bg-[#353a50]/40'
                }`}>
                  <item.icon className={`w-6 h-6 ${isActive ? 'scale-110' : ''} text-black dark:text-white`} />
                </div>
                <span className="text-xs mt-1 font-semibold tracking-wide text-black dark:text-white">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
