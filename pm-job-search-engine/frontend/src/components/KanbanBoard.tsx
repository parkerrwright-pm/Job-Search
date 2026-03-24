import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { JobCard } from './JobCard';
import { toast } from 'sonner';

interface KanbanBoardProps {
  jobs: any;
  onJobsUpdate: (jobs: any) => void;
  onViewDetails: (jobId: string) => void;
  onEdit: (job: any) => void;
  onDelete: (jobId: string) => void;
  isLoading?: boolean;
}

const STAGES = [
  'SAVED',
  'APPLIED',
  'PHONE_SCREEN',
  'RECRUITER_SCREEN',
  'HIRING_MANAGER',
  'TAKE_HOME',
  'PANEL',
  'FINAL',
  'OFFER',
  'NEGOTIATION',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
  'ARCHIVED',
];

const STAGE_LABELS: Record<string, string> = {
  SAVED: '💾 Saved',
  APPLIED: '📤 Applied',
  PHONE_SCREEN: '📱 Phone Screen',
  RECRUITER_SCREEN: '📞 Recruiter Screen',
  HIRING_MANAGER: '👔 Hiring Manager',
  TAKE_HOME: '📝 Take-Home',
  PANEL: '👥 Panel',
  FINAL: '⭐ Final',
  OFFER: '🎉 Offer',
  NEGOTIATION: '🤝 Negotiation',
  ACCEPTED: '✅ Accepted',
  REJECTED: '❌ Rejected',
  WITHDRAWN: '🚪 Withdrawn',
  ARCHIVED: '📦 Archived',
};

const STAGE_COLORS: Record<string, string> = {
  SAVED: 'bg-gray-50 border-gray-200',
  APPLIED: 'bg-blue-50 border-blue-200',
  PHONE_SCREEN: 'bg-teal-50 border-teal-200',
  RECRUITER_SCREEN: 'bg-cyan-50 border-cyan-200',
  HIRING_MANAGER: 'bg-purple-50 border-purple-200',
  TAKE_HOME: 'bg-amber-50 border-amber-200',
  PANEL: 'bg-indigo-50 border-indigo-200',
  FINAL: 'bg-yellow-50 border-yellow-200',
  OFFER: 'bg-green-50 border-green-200',
  NEGOTIATION: 'bg-lime-50 border-lime-200',
  ACCEPTED: 'bg-emerald-50 border-emerald-200',
  REJECTED: 'bg-red-50 border-red-200',
  WITHDRAWN: 'bg-orange-50 border-orange-200',
  ARCHIVED: 'bg-slate-50 border-slate-200',
};

const STAGE_HEADER_COLORS: Record<string, string> = {
  SAVED: 'bg-gray-200',
  APPLIED: 'bg-blue-200',
  PHONE_SCREEN: 'bg-teal-200',
  RECRUITER_SCREEN: 'bg-cyan-200',
  HIRING_MANAGER: 'bg-purple-200',
  TAKE_HOME: 'bg-amber-200',
  PANEL: 'bg-indigo-200',
  FINAL: 'bg-yellow-200',
  OFFER: 'bg-green-200',
  NEGOTIATION: 'bg-lime-200',
  ACCEPTED: 'bg-emerald-200',
  REJECTED: 'bg-red-200',
  WITHDRAWN: 'bg-orange-200',
  ARCHIVED: 'bg-slate-200',
};

// Draggable job card wrapper
function DraggableJobCard({
  job,
  onViewDetails,
  onEdit,
  onDelete,
}: {
  job: any;
  onViewDetails: (jobId: string) => void;
  onEdit: (job: any) => void;
  onDelete: (jobId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: job.id,
    data: { job, stage: job.stage },
  });

  const style: React.CSSProperties = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 'auto',
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <JobCard
        job={job}
        onViewDetails={onViewDetails}
        onEdit={onEdit}
        onDelete={onDelete}
        isDragging={isDragging}
      />
    </div>
  );
}

// Droppable column wrapper
function DroppableColumn({
  stage,
  children,
  isOver,
}: {
  stage: string;
  children: React.ReactNode;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: stage });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[120px] rounded-lg p-2 transition-colors duration-200 ${
        isOver ? 'bg-blue-100/50 ring-2 ring-blue-400 ring-inset' : ''
      }`}
    >
      {children}
    </div>
  );
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  jobs,
  onJobsUpdate,
  onViewDetails,
  onEdit,
  onDelete,
  isLoading = false,
}) => {
  const [activeJob, setActiveJob] = useState<any>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor)
  );

  const findJobById = (id: string): { job: any; stage: string } | null => {
    for (const stage of STAGES) {
      const stageJobs = jobs[stage] || [];
      const job = stageJobs.find((j: any) => j.id === id);
      if (job) return { job, stage };
    }
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const found = findJobById(active.id as string);
    if (found) setActiveJob(found.job);
  };

  const handleDragOver = (event: any) => {
    const { over } = event;
    if (over) {
      // over.id is either a stage ID (column) or a job ID (card within column)
      if (STAGES.includes(over.id as string)) {
        setOverColumn(over.id as string);
      } else {
        // Hovered over a card — find which column it's in
        const found = findJobById(over.id as string);
        setOverColumn(found?.stage || null);
      }
    } else {
      setOverColumn(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveJob(null);
    setOverColumn(null);

    if (!over) return;

    const activeId = active.id as string;
    let targetStage: string;

    if (STAGES.includes(over.id as string)) {
      targetStage = over.id as string;
    } else {
      const found = findJobById(over.id as string);
      if (!found) return;
      targetStage = found.stage;
    }

    const source = findJobById(activeId);
    if (!source || source.stage === targetStage) return;

    // Optimistic update
    const updatedJobs = { ...jobs };
    const sourceJobs = [...(updatedJobs[source.stage] || [])];
    const targetJobs = [...(updatedJobs[targetStage] || [])];

    const jobIndex = sourceJobs.findIndex((j: any) => j.id === activeId);
    if (jobIndex === -1) return;

    const [movedJob] = sourceJobs.splice(jobIndex, 1);
    const updatedJob = { ...movedJob, stage: targetStage };
    targetJobs.push(updatedJob);

    updatedJobs[source.stage] = sourceJobs;
    updatedJobs[targetStage] = targetJobs;
    onJobsUpdate(updatedJobs);

    // Persist to backend
    try {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const response = await fetch(`${apiUrl}/api/jobs/${activeId}/stage`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stage: targetStage }),
      });

      if (!response.ok) {
        throw new Error('Failed to update stage');
      }

      toast.success(
        `Moved to ${STAGE_LABELS[targetStage]?.replace(/^[^\w]*/, '') || targetStage}`
      );
    } catch {
      // Rollback on error
      onJobsUpdate(jobs);
      toast.error('Failed to move job. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-96 flex items-center justify-center">
        <p className="text-lg text-gray-600">Loading jobs...</p>
      </div>
    );
  }

  const totalJobs = STAGES.reduce((sum, stage) => sum + (jobs[stage]?.length || 0), 0);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="mb-3 flex items-center gap-4 text-sm text-gray-500">
        <span>{totalJobs} job{totalJobs !== 1 ? 's' : ''} tracked</span>
        <span className="text-xs">Drag cards between columns to update status</span>
      </div>

      <div className="w-full overflow-x-auto pb-4">
        <div className="flex gap-3 min-w-max">
          {STAGES.map((stage) => {
            const stageJobs = jobs[stage] || [];
            const isOverThis = overColumn === stage;

            return (
              <div
                key={stage}
                className={`flex-shrink-0 w-72 rounded-lg border ${STAGE_COLORS[stage]} flex flex-col`}
              >
                <div className={`px-3 py-2 rounded-t-lg ${STAGE_HEADER_COLORS[stage]}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold truncate">
                      {STAGE_LABELS[stage]}
                    </span>
                    <span className="ml-2 text-xs bg-white/70 px-2 py-0.5 rounded-full font-medium">
                      {stageJobs.length}
                    </span>
                  </div>
                </div>

                <DroppableColumn stage={stage} isOver={isOverThis}>
                  <div className="space-y-2">
                    {stageJobs.length === 0 ? (
                      <div className="h-24 flex items-center justify-center text-gray-400">
                        <p className="text-xs">Drop jobs here</p>
                      </div>
                    ) : (
                      stageJobs.map((job: any) => (
                        <DraggableJobCard
                          key={job.id}
                          job={job}
                          onViewDetails={onViewDetails}
                          onEdit={onEdit}
                          onDelete={onDelete}
                        />
                      ))
                    )}
                  </div>
                </DroppableColumn>
              </div>
            );
          })}
        </div>
      </div>

      <DragOverlay>
        {activeJob ? (
          <div className="w-72 opacity-90 rotate-2 shadow-xl">
            <JobCard
              job={activeJob}
              onViewDetails={() => {}}
              onEdit={() => {}}
              onDelete={() => {}}
              isDragging
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default KanbanBoard;
