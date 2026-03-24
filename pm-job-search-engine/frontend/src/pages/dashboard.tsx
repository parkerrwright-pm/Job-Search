import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Navbar from '@/components/Navbar';
import { DashboardStats, StageChart } from '@/components/DashboardStats';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        console.warn('No auth token found, redirecting to login');
        router.push('/login');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      console.log('Fetching dashboard from:', `${apiUrl}/api/dashboard/overview`);
      
      const response = await fetch(`${apiUrl}/api/dashboard/overview`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Dashboard response status:', response.status);

      if (!response.ok) {
        let errorMessage = `Failed to fetch stats: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          const text = await response.text();
          console.error('Response text:', text);
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log('Dashboard data:', data);
      setStats(data);
    } catch (error: any) {
      console.error('Dashboard error:', error);
      toast.error(error.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-gray-600 mb-2">Loading dashboard...</p>
            <div className="inline-block">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome!</h2>
            <p className="text-gray-600 mb-4">You haven't added any jobs yet.</p>
            <p className="text-sm text-gray-500 mb-6">Start by adding your first job to track your applications.</p>
            <Button onClick={fetchStats} className="bg-blue-600 text-white hover:bg-blue-700">
              Load Dashboard Data
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStats}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <DashboardStats stats={stats} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <StageChart stats={stats} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full justify-start" variant="outline">
                ➕ Add New Job
              </Button>
              <Button className="w-full justify-start" variant="outline">
                🧠 Tailor Resume
              </Button>
              <Button className="w-full justify-start" variant="outline">
                🔍 Research Company
              </Button>
              <Button className="w-full justify-start" variant="outline">
                🎤 Interview Prep
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
