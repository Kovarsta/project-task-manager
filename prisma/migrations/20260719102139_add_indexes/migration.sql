-- CreateIndex
CREATE INDEX "ActivityLog_projectId_createdAt_idx" ON "ActivityLog"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "Project_createdById_idx" ON "Project"("createdById");

-- CreateIndex
CREATE INDEX "Project_deactivatedAt_idx" ON "Project"("deactivatedAt");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "ProjectInvite_projectId_idx" ON "ProjectInvite"("projectId");

-- CreateIndex
CREATE INDEX "ProjectInvite_status_idx" ON "ProjectInvite"("status");

-- CreateIndex
CREATE INDEX "ProjectInvite_invitedEmail_idx" ON "ProjectInvite"("invitedEmail");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- CreateIndex
CREATE INDEX "ProjectMember_role_idx" ON "ProjectMember"("role");

-- CreateIndex
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");

-- CreateIndex
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");

-- CreateIndex
CREATE INDEX "Task_createdById_idx" ON "Task"("createdById");

-- CreateIndex
CREATE INDEX "Task_projectId_status_idx" ON "Task"("projectId", "status");

-- CreateIndex
CREATE INDEX "Task_projectId_assigneeId_status_idx" ON "Task"("projectId", "assigneeId", "status");

-- CreateIndex
CREATE INDEX "TaskStatusHistory_taskId_idx" ON "TaskStatusHistory"("taskId");

-- CreateIndex
CREATE INDEX "TaskStatusHistory_changedAt_idx" ON "TaskStatusHistory"("changedAt");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_deactivatedAt_idx" ON "User"("deactivatedAt");
