export type ProjectMember = {
  id:   number
  role: 'ADMIN' | 'MEMBER'
  user: { id: number; name: string; email: string }
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

export type Invite = {
  id:           number
  projectId:    number
  invitedEmail: string
  status:       'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED'
  createdAt:    string
  expiresAt:    string
}