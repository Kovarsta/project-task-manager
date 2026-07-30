-- Trigram index for user name search (used by member search ILIKE queries)
CREATE INDEX IF NOT EXISTS "idx_user_name_trgm" ON "User" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Task_projectId_status_createdAt_idx" ON "Task"("projectId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Task_projectId_dueDate_status_idx" ON "Task"("projectId", "dueDate", "status");

-- CreateIndex
CREATE INDEX "Task_assigneeId_status_projectId_idx" ON "Task"("assigneeId", "status", "projectId");
