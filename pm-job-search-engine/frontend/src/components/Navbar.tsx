import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export const Navbar: React.FC = () => {
  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                PM
              </div>
              <span className="font-bold text-lg hidden sm:inline">Job Search</span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 text-sm">
              Dashboard
            </Link>
            <Link href="/jobs" className="text-gray-600 hover:text-gray-900 text-sm">
              Jobs
            </Link>
            <Link href="/ai-tailor" className="text-gray-600 hover:text-gray-900 text-sm hidden md:inline">
              Resume AI
            </Link>
            <Link href="/company-research" className="text-gray-600 hover:text-gray-900 text-sm hidden md:inline">
              Research
            </Link>
            <Link href="/settings" className="text-gray-600 hover:text-gray-900 text-sm">
              Settings
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-gray-600 hover:text-red-600"
            >
              <LogOut className="w-4 h-4 mr-1" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
