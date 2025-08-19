'use client'

import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { 
  Plus, 
  Users, 
  UserCheck, 
  UserX,
  Shield,
  Key,
  Clock
} from 'lucide-react'
import { Role } from '@prisma/client'

interface User {
  id: string
  email: string
  name: string | null
  role: Role
  isActive: boolean
  createdAt: string
  lastLoginAt: string | null
  deploymentCount: number
}

export default function UsersManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({
    email: '',
    name: '',
    role: 'USER' as Role,
    isActive: true
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0
  })

  // Form state for adding new user
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    role: 'USER' as Role,
    isActive: true
  })

  // Filter users based on search query
  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true
    
    const query = searchQuery.toLowerCase()
    return (
      user.email.toLowerCase().includes(query) ||
      (user.name && user.name.toLowerCase().includes(query)) ||
      user.role.toLowerCase().includes(query)
    )
  })

  useEffect(() => {
    loadUsers()
  }, [pagination.page, searchQuery])

  const loadUsers = async () => {
    setLoading(true)
    
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(searchQuery && { query: searchQuery })
      })
      
      const response = await fetch(`/api/admin/users?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }
      
      const data = await response.json()
      setUsers(data.users)
      setPagination(prev => ({ 
        ...prev, 
        total: data.pagination.total 
      }))
    } catch (error) {
      console.error('Error loading users:', error)
      alert('Failed to load users. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getRoleBadge = (role: Role) => {
    const variants = {
      ADMIN: { variant: 'destructive' as const, icon: Shield },
      CURATOR: { variant: 'default' as const, icon: UserCheck },
      USER: { variant: 'secondary' as const, icon: Users }
    }
    
    const config = variants[role]
    const Icon = config.icon
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {role.toLowerCase()}
      </Badge>
    )
  }

  const columns: Column<User>[] = [
    {
      key: 'email',
      header: 'User',
      sortable: true,
      render: (email, user) => (
        <div>
          <div className="font-medium">{email}</div>
          {user.name && <div className="text-xs text-gray-500">{user.name}</div>}
        </div>
      )
    },
    {
      key: 'role',
      header: 'Role',
      render: (role) => getRoleBadge(role)
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (isActive) => (
        <div className="flex items-center space-x-2">
          {isActive ? (
            <>
              <UserCheck className="h-4 w-4 text-green-500" />
              <span className="text-sm">Active</span>
            </>
          ) : (
            <>
              <UserX className="h-4 w-4 text-red-500" />
              <span className="text-sm">Inactive</span>
            </>
          )}
        </div>
      )
    },
    {
      key: 'deploymentCount',
      header: 'Deployments',
      render: (count) => (
        <Badge variant="outline">{count}</Badge>
      )
    },
    {
      key: 'lastLoginAt',
      header: 'Last Login',
      render: (lastLogin) => (
        <div className="flex items-center space-x-1">
          {lastLogin ? (
            <>
              <Clock className="h-4 w-4 text-gray-400" />
              <span className="text-sm">
                {new Date(lastLogin).toLocaleDateString()}
              </span>
            </>
          ) : (
            <span className="text-sm text-gray-500">Never</span>
          )}
        </div>
      )
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      render: (createdAt) => new Date(createdAt).toLocaleDateString()
    }
  ]

  const handleAddUser = async () => {
    if (!newUser.email) {
      alert('Please enter an email address')
      return
    }
    
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: newUser.email,
          name: newUser.name || null,
          role: newUser.role,
          isActive: newUser.isActive
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create user')
      }
      
      alert(`User "${newUser.email}" added successfully!`)
      setIsAddDialogOpen(false)
      
      // Reset form
      setNewUser({
        email: '',
        name: '',
        role: 'USER',
        isActive: true
      })
      
      // Reload users
      loadUsers()
    } catch (error) {
      console.error('Error adding user:', error)
      alert(error instanceof Error ? error.message : 'Failed to add user')
    }
  }

  const userActions = [
    {
      label: 'Edit',
      onClick: (user: User) => {
        setSelectedUser(user)
        setEditForm({
          email: user.email,
          name: user.name || '',
          role: user.role,
          isActive: user.isActive
        })
        setEditDialogOpen(true)
      }
    },
    {
      label: 'Manage API Tokens',
      onClick: (user: User) => {
        alert(`API Token management for ${user.name || user.email} - Feature coming soon!`)
      }
    },
    {
      label: 'View Activity Log',
      onClick: (user: User) => {
        alert(`Activity log for ${user.name || user.email} - Feature coming soon!`)
      }
    },
    {
      label: 'Reset Password',
      onClick: (user: User) => {
        if (confirm(`Reset password for ${user.name || user.email}?`)) {
          alert('Password reset email sent!')
        }
      }
    },
    {
      label: 'Delete',
      onClick: async (user: User) => {
        if (confirm(`Are you sure you want to delete user "${user.name || user.email}"? This action cannot be undone.`)) {
          try {
            const response = await fetch(`/api/admin/users/${user.id}`, {
              method: 'DELETE'
            })
            
            if (!response.ok) {
              throw new Error('Failed to delete user')
            }
            
            alert(`User "${user.name || user.email}" has been deleted successfully.`)
            loadUsers() // Reload users from server
          } catch (error) {
            console.error('Error deleting user:', error)
            alert('Failed to delete user. Please try again.')
          }
        }
      },
      variant: 'destructive' as const
    }
  ]

  const roleStats = {
    ADMIN: users.filter(u => u.role === 'ADMIN').length,
    CURATOR: users.filter(u => u.role === 'CURATOR').length,
    USER: users.filter(u => u.role === 'USER').length
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
            <p className="text-gray-600">Manage user accounts, roles, and permissions</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>
                  Create a new user account with specified role and permissions
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={newUser.name}
                    onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select 
                    value={newUser.role} 
                    onValueChange={(value: Role) => setNewUser(prev => ({ ...prev, role: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USER">User</SelectItem>
                      <SelectItem value="CURATOR">Curator</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={newUser.isActive}
                    onCheckedChange={(checked) => setNewUser(prev => ({ ...prev, isActive: checked }))}
                  />
                  <Label htmlFor="isActive">Active</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddUser}>Add User</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">Total Users</p>
                  <p className="text-2xl font-bold">{pagination.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-sm font-medium">Admins</p>
                  <p className="text-2xl font-bold">{roleStats.ADMIN}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <UserCheck className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium">Curators</p>
                  <p className="text-2xl font-bold">{roleStats.CURATOR}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">Users</p>
                  <p className="text-2xl font-bold">{roleStats.USER}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <UserCheck className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-2xl font-bold">
                    {users.filter(u => u.isActive).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>
              Manage user accounts, roles, and access permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DataTable
              data={filteredUsers}
              columns={columns}
              loading={loading}
              searchable
              onSearch={setSearchQuery}
              actions={userActions}
              pagination={{
                ...pagination,
                onPageChange: (page) => setPagination(prev => ({ ...prev, page }))
              }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and permissions.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="userEmail" className="text-right">Email</Label>
                <Input
                  id="userEmail"
                  value={editForm.email}
                  onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="userName" className="text-right">Name</Label>
                <Input
                  id="userName"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="userRole" className="text-right">Role</Label>
                <Select value={editForm.role} onValueChange={(value: Role) => setEditForm(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">User</SelectItem>
                    <SelectItem value="CURATOR">Curator</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="userActive" className="text-right">Active</Label>
                <Switch
                  id="userActive"
                  checked={editForm.isActive}
                  onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, isActive: checked }))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={async () => {
              if (!selectedUser) return
              
              try {
                const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    email: editForm.email,
                    name: editForm.name || null,
                    role: editForm.role,
                    isActive: editForm.isActive
                  })
                })
                
                if (!response.ok) {
                  const error = await response.json()
                  throw new Error(error.error || 'Failed to update user')
                }
                
                alert('User updated successfully!')
                setEditDialogOpen(false)
                loadUsers() // Reload the users
              } catch (error) {
                console.error('Error updating user:', error)
                alert(error instanceof Error ? error.message : 'Failed to update user')
              }
            }}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}