-- Enable pg_trgm extension for trigram-based text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram index for task title search (used by ILIKE '%term%' queries)
CREATE INDEX "idx_task_title_trgm" ON "Task" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "ProjectInvite_invitedById_idx" ON "ProjectInvite"("invitedById");

-- CreateIndex
CREATE INDEX "Task_projectId_completedAt_idx" ON "Task"("projectId", "completedAt");

-- CreateIndex
CREATE INDEX "Task_completedAt_idx" ON "Task"("completedAt");

-- CreateIndex
CREATE INDEX "TaskStatusHistory_changedById_idx" ON "TaskStatusHistory"("changedById");
