import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DashboardStatsProps {
  stats: any;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ stats }) => {
  const chartData = Object.entries(stats.jobsByStage || {}).map(([stage, count]) => ({
    name: stage.replace(/_/g, ' '),
    jobs: count,
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            Total Jobs
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats.totalJobs || 0}</div>
          <p className="text-sm text-gray-500 mt-1">in your pipeline</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            This Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{stats.thisWeekApplications || 0}</div>
          <p className="text-sm text-gray-500 mt-1">applications sent</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            Follow-ups Due
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-yellow-600">
            {stats.followUpsNeeded || 0}
          </div>
          <p className="text-sm text-gray-500 mt-1">pending actions</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            Interviews
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-blue-600">
            {stats.upcomingInterviews || 0}
          </div>
          <p className="text-sm text-gray-500 mt-1">to prepare for</p>
        </CardContent>
      </Card>
    </div>
  );
};

export const StageChart: React.FC<DashboardStatsProps> = ({ stats }) => {
  const chartData = Object.entries(stats.jobsByStage || {}).map(([stage, count]) => ({
    stage: stage.replace(/_/g, ' '),
    count: count as number,
  }));

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Jobs by Stage</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="stage" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
