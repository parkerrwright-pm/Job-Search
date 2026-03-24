import React from 'react';
import { format } from 'date-fns';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash, Edit, Star } from 'lucide-react';

interface JobCardProps {
  job: any;
  onViewDetails: (jobId: string) => void;
  onEdit: (job: any) => void;
  onDelete: (jobId: string) => void;
  isDragging?: boolean;
}

export const JobCard: React.FC<JobCardProps> = ({
  job,
  onViewDetails,
  onEdit,
  onDelete,
  isDragging = false,
}) => {

  const stageColors: Record<string, string> = {
    SAVED: 'bg-gray-100 text-gray-800',
    APPLIED: 'bg-blue-100 text-blue-800',
    PHONE_SCREEN: 'bg-teal-100 text-teal-800',
    RECRUITER_SCREEN: 'bg-cyan-100 text-cyan-800',
    HIRING_MANAGER: 'bg-purple-100 text-purple-800',
    TAKE_HOME: 'bg-amber-100 text-amber-800',
    PANEL: 'bg-indigo-100 text-indigo-800',
    FINAL: 'bg-yellow-100 text-yellow-800',
    OFFER: 'bg-green-100 text-green-800',
    NEGOTIATION: 'bg-lime-100 text-lime-800',
    ACCEPTED: 'bg-emerald-100 text-emerald-800',
    REJECTED: 'bg-red-100 text-red-800',
    WITHDRAWN: 'bg-orange-100 text-orange-800',
    ARCHIVED: 'bg-slate-100 text-slate-800',
  };

  const priorityColors: Record<string, string> = {
    HIGH: 'text-red-600',
    MEDIUM: 'text-yellow-600',
    LOW: 'text-gray-600',
  };

  const renderStars = (rating: number | null | undefined) => {
    const r = rating || 0;
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={`w-3.5 h-3.5 ${i <= r ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
        {r > 0 && <span className="text-xs text-gray-500 ml-1">{r}/5</span>}
      </div>
    );
  };

  return (
    <Card
      className={`cursor-grab active:cursor-grabbing transition ${
        isDragging ? 'opacity-50' : 'opacity-100'
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-base">{job.title}</CardTitle>
            <p className="text-sm text-gray-600 mt-1">{job.company}</p>
          </div>
          <Badge className={stageColors[job.stage] || 'bg-gray-100'}>
            {job.stage.replace(/_/g, ' ')}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {job.salary && (
          <p className="text-sm font-semibold text-green-700">{job.salary}</p>
        )}

        {job.location && (
          <p className="text-sm text-gray-600">📍 {job.location}</p>
        )}

        {job.recruiter && (
          <p className="text-sm text-gray-600">
            👤 <strong>Recruiter:</strong> {job.recruiter}
          </p>
        )}

        {job.followUpDate && (
          <p className="text-sm text-gray-600">
            📅 <strong>Follow-up:</strong> {format(new Date(job.followUpDate), 'MMM dd')}
          </p>
        )}

        {job.notes && (
          <p className="text-sm text-gray-600 line-clamp-2">
            <strong>Notes:</strong> {job.notes}
          </p>
        )}

        {/* Alignment Rating */}
        <div className="pt-1">
          {renderStars(job.alignmentRating)}
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onEdit(job)}
          >
            <Edit className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(job.id)}
            className="text-red-600 hover:text-red-800"
          >
            <Trash className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default JobCard;
