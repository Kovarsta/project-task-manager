export type ProjectMember = {
  id:      number
  role:    'ADMIN' | 'MEMBER'
  userId:  number
  joinedAt: string
  user: { id: number; name: string; email: string; createdAt: string; deactivatedAt: string | null }
  _count?: { tasks: number }
}

export type Project = {
	id: number;
	name: string;
	createdById: number;
	members?:    ProjectMember[]
	createdAt: string;
	_count: {
		tasks: number;
	};
	_myTaskCount?: number;
	_earliestDue?: string | null;
};

export type AdminProject = {
	id: number;
	name: string;
	createdById: number;
	createdBy: { id: number; name: string; email: string };
	createdAt: string;
	_count: { members: number; tasks: number };
};

export type Task = {
  id:          number
  title:       string
  description: string | null
  tags:        string[]
  status:      'TODO' | 'DOING' | 'DONE'
  priority:    'LOWEST' | 'LOW' | 'MEDIUM' | 'HIGH' | 'HIGHEST'
  dueDate:     string | null
  assignee:    { id: number; name: string; email: string } | null
  createdBy:   { id: number; name: string }
}

export type AdminUser = {
	id: number;
	name: string;
	email: string;
	isSuperAdmin: boolean;
	deactivatedAt: string | null;
	createdAt: string;
	_count: { createdProjects: number; memberships: number; createdTasks: number };
};

export type Invite = {
  id:           number
  projectId:    number
  invitedEmail: string
  status:       'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED'
  createdAt:    string
  expiresAt:    string
}