-- Keep the existing trigram indexes (created via raw SQL in earlier migrations).
-- Prisma does not track them, so it would otherwise emit DROP INDEX here.

-- CreateIndex
CREATE INDEX "Project_createdById_createdAt_idx" ON "Project"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "Project_tags_idx" ON "Project" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "ProjectInvite_projectId_createdAt_idx" ON "ProjectInvite"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectInvite_projectId_invitedEmail_status_idx" ON "ProjectInvite"("projectId", "invitedEmail", "status");

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_role_joinedAt_idx" ON "ProjectMember"("projectId", "role", "joinedAt");

-- CreateIndex
CREATE INDEX "Task_projectId_createdAt_idx" ON "Task"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Task_tags_idx" ON "Task" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "User_name_idx" ON "User"("name");

-- Trigram GIN indexes for ILIKE '%term%' search on user email and project fields
CREATE INDEX IF NOT EXISTS "idx_user_email_trgm" ON "User" USING GIN ("email" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_project_name_trgm" ON "Project" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_project_description_trgm" ON "Project" USING GIN ("description" gin_trgm_ops);
