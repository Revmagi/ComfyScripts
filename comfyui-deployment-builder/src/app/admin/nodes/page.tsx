'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AdminLayout } from '@/components/admin/admin-layout'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { 
  Package, 
  Github, 
  CheckCircle, 
  XCircle, 
  ExternalLink,
  Plus,
  Search,
  User,
  Settings
} from 'lucide-react'

interface CustomNode {
  id: string
  name: string
  githubUrl: string
  author: string | null
  description: string | null
  isActive: boolean
  isVerified: boolean
  tags: string[]
  createdAt: string
  lastValidated: string | null
  deploymentCount: number
}

export default function CustomNodesManagement() {
  const router = useRouter()
  const [nodes, setNodes] = useState<CustomNode[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'VERIFIED' | 'NON_VERIFIED'>('ALL')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedNode, setSelectedNode] = useState<CustomNode | null>(null)
  const [totalStats, setTotalStats] = useState<Record<string, number>>({})
  const [newNode, setNewNode] = useState({
    name: '',
    githubUrl: '',
    branch: 'main',
    author: '',
    description: '',
    tags: '',
    isActive: true
  })
  const [editForm, setEditForm] = useState({
    name: '',
    githubUrl: '',
    branch: 'main',
    author: '',
    description: '',
    tags: '',
    isActive: true,
    isVerified: false
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0
  })

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Load nodes when filters or pagination changes
  useEffect(() => {
    loadNodes()
  }, [pagination.page, pagination.limit, debouncedSearchQuery, statusFilter])

  // Load total stats on mount
  useEffect(() => {
    loadTotalStats()
  }, [])

  const loadNodes = async () => {
    setLoading(true)
    
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(debouncedSearchQuery && { query: debouncedSearchQuery }),
        ...(statusFilter === 'ACTIVE' && { isActive: 'true' }),
        ...(statusFilter === 'INACTIVE' && { isActive: 'false' }),
        ...(statusFilter === 'VERIFIED' && { isVerified: 'true' }),
        ...(statusFilter === 'NON_VERIFIED' && { isVerified: 'false' })
      })
      
      const response = await fetch(`/api/admin/nodes?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch custom nodes')
      }
      
      const data = await response.json()
      setNodes(data.nodes)
      setPagination(prev => ({ 
        ...prev, 
        total: data.pagination.total 
      }))
    } catch (error) {
      console.error('Error loading custom nodes:', error)
      alert('Failed to load custom nodes. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const loadTotalStats = async () => {
    try {
      const response = await fetch('/api/admin/nodes/stats')
      
      if (!response.ok) {
        throw new Error('Failed to fetch stats')
      }
      
      const stats = await response.json()
      setTotalStats(stats)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const columns: Column<CustomNode>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (value, item) => (
        <div>
          <div className="font-medium">{value}</div>
          {item.author && <div className="text-xs text-gray-500">by {item.author}</div>}
        </div>
      )
    },
    {
      key: 'description',
      header: 'Description',
      render: (value) => (
        <div className="max-w-xs truncate" title={value || ''}>
          {value || 'No description'}
        </div>
      )
    },
    {
      key: 'githubUrl',
      header: 'Repository',
      render: (value) => (
        <a 
          href={value} 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center text-blue-600 hover:text-blue-800"
        >
          <Github className="h-4 w-4 mr-1" />
          <ExternalLink className="h-3 w-3" />
        </a>
      )
    },
    {
      key: 'tags',
      header: 'Tags',
      render: (tags) => (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 2).map((tag: string, index: number) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {tags.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{tags.length - 2}
            </Badge>
          )}
        </div>
      )
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (isActive, item) => (
        <div className="flex items-center space-x-2">
          {isActive ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          <span className="text-sm">
            {isActive ? 'Active' : 'Inactive'}
          </span>
          {item.isVerified && (
            <Badge variant="default" className="text-xs">Verified</Badge>
          )}
        </div>
      )
    },
    {
      key: 'createdAt',
      header: 'Added',
      sortable: true,
      render: (createdAt) => new Date(createdAt).toLocaleDateString()
    }
  ]

  const nodeActions = [
    {
      label: 'View Repository',
      onClick: (node: CustomNode) => window.open(node.githubUrl, '_blank')
    },
    {
      label: 'Edit',
      onClick: (node: CustomNode) => {
        setSelectedNode(node)
        setEditForm({
          name: node.name,
          githubUrl: node.githubUrl,
          branch: 'main', // Use default since branch isn't returned in the list
          author: node.author || '',
          description: node.description || '',
          tags: node.tags.join(', '),
          isActive: node.isActive,
          isVerified: node.isVerified
        })
        setEditDialogOpen(true)
      }
    },
    {
      label: 'Delete',
      onClick: async (node: CustomNode) => {
        if (confirm(`Are you sure you want to delete "${node.name}"? This action cannot be undone.`)) {
          try {
            const response = await fetch(`/api/admin/nodes/${node.id}`, {
              method: 'DELETE'
            })
            
            if (!response.ok) {
              const error = await response.json()
              throw new Error(error.error || 'Failed to delete custom node')
            }
            
            alert(`Custom node "${node.name}" has been deleted successfully.`)
            loadNodes()
            loadTotalStats()
          } catch (error) {
            console.error('Error deleting custom node:', error)
            alert(error instanceof Error ? error.message : 'Failed to delete custom node')
          }
        }
      },
      variant: 'destructive' as const
    }
  ]

  const resetFilters = () => {
    setStatusFilter('ALL')
    setSearchQuery('')
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const hasActiveFilters = statusFilter !== 'ALL' || searchQuery !== ''

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Custom Nodes Management</h2>
            <p className="text-gray-600">Manage ComfyUI custom nodes and extensions</p>
          </div>
          <div className="flex space-x-2">
            <Button 
              variant="outline"
              onClick={() => router.push('/admin/custom-nodes/comfyui-registry')}
            >
              <Search className="h-4 w-4 mr-2" />
              Browse Registry
            </Button>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Custom Node
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <Label>Status:</Label>
                <Select value={statusFilter} onValueChange={(value: 'ALL' | 'ACTIVE' | 'INACTIVE' | 'VERIFIED' | 'NON_VERIFIED') => {
                  setStatusFilter(value)
                  setPagination(prev => ({ ...prev, page: 1 }))
                }}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="VERIFIED">Verified</SelectItem>
                    <SelectItem value="NON_VERIFIED">Non-verified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <Label>Per Page:</Label>
                <Select value={pagination.limit.toString()} onValueChange={(value) => {
                  setPagination(prev => ({ ...prev, limit: parseInt(value), page: 1 }))
                }}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Custom Node Statistics</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={resetFilters}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Package className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">Total Nodes</p>
                    <p className="text-2xl font-bold">{totalStats.TOTAL || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => {
              setStatusFilter('ACTIVE')
              setPagination(prev => ({ ...prev, page: 1 }))
            }}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium">Active</p>
                    <p className="text-2xl font-bold">{totalStats.ACTIVE || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => {
              setStatusFilter('INACTIVE')
              setPagination(prev => ({ ...prev, page: 1 }))
            }}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-sm font-medium">Inactive</p>
                    <p className="text-2xl font-bold">{totalStats.INACTIVE || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => {
              setStatusFilter('VERIFIED')
              setPagination(prev => ({ ...prev, page: 1 }))
            }}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Settings className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">Verified</p>
                    <p className="text-2xl font-bold">{totalStats.VERIFIED || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => {
              setStatusFilter('NON_VERIFIED')
              setPagination(prev => ({ ...prev, page: 1 }))
            }}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <XCircle className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="text-sm font-medium">Non-verified</p>
                    <p className="text-2xl font-bold">{totalStats.NON_VERIFIED || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle>Custom Nodes</CardTitle>
            <CardDescription>
              Manage ComfyUI custom nodes and extensions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Search className="h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search custom nodes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              <DataTable
                data={nodes}
                columns={columns}
                loading={loading}
                searchable={false}
                actions={nodeActions}
                pagination={{
                  ...pagination,
                  onPageChange: (page) => setPagination(prev => ({ ...prev, page }))
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Custom Node Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Custom Node</DialogTitle>
            <DialogDescription>
              Add a new ComfyUI custom node from GitHub repository.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={newNode.name}
                onChange={(e) => setNewNode(prev => ({ ...prev, name: e.target.value }))}
                placeholder="ComfyUI-Amazing-Node"
              />
            </div>
            <div>
              <Label htmlFor="githubUrl">GitHub URL *</Label>
              <Input
                id="githubUrl"
                value={newNode.githubUrl}
                onChange={(e) => setNewNode(prev => ({ ...prev, githubUrl: e.target.value }))}
                placeholder="https://github.com/user/repo"
              />
            </div>
            <div>
              <Label htmlFor="branch">Branch</Label>
              <Input
                id="branch"
                value={newNode.branch}
                onChange={(e) => setNewNode(prev => ({ ...prev, branch: e.target.value }))}
                placeholder="main"
              />
            </div>
            <div>
              <Label htmlFor="author">Author</Label>
              <Input
                id="author"
                value={newNode.author}
                onChange={(e) => setNewNode(prev => ({ ...prev, author: e.target.value }))}
                placeholder="GitHub username"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newNode.description}
                onChange={(e) => setNewNode(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the custom node"
              />
            </div>
            <div>
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={newNode.tags}
                onChange={(e) => setNewNode(prev => ({ ...prev, tags: e.target.value }))}
                placeholder="utility, controlnet, animation"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={newNode.isActive}
                onCheckedChange={(checked) => setNewNode(prev => ({ ...prev, isActive: checked }))}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddDialogOpen(false)
              setNewNode({
                name: '',
                githubUrl: '',
                branch: 'main',
                author: '',
                description: '',
                tags: '',
                isActive: true
              })
            }}>
              Cancel
            </Button>
            <Button onClick={async () => {
              if (!newNode.name || !newNode.githubUrl) {
                alert('Please fill in required fields (Name and GitHub URL)')
                return
              }
              
              try {
                const tagsArray = newNode.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
                
                const response = await fetch('/api/admin/nodes', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    name: newNode.name,
                    githubUrl: newNode.githubUrl,
                    branch: newNode.branch || 'main',
                    author: newNode.author || null,
                    description: newNode.description || null,
                    tags: tagsArray,
                    isActive: newNode.isActive
                  })
                })
                
                if (!response.ok) {
                  const error = await response.json()
                  throw new Error(error.error || 'Failed to create custom node')
                }
                
                alert(`Custom node "${newNode.name}" added successfully!`)
                setAddDialogOpen(false)
                
                // Reset form
                setNewNode({
                  name: '',
                  githubUrl: '',
                  branch: 'main',
                  author: '',
                  description: '',
                  tags: '',
                  isActive: true
                })
                
                // Reload nodes and stats
                loadNodes()
                loadTotalStats()
              } catch (error) {
                console.error('Error adding custom node:', error)
                alert(error instanceof Error ? error.message : 'Failed to add custom node')
              }
            }}>
              Add Node
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Custom Node Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Custom Node</DialogTitle>
            <DialogDescription>
              Update custom node information and settings.
            </DialogDescription>
          </DialogHeader>
          {selectedNode && (
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="editName">Name *</Label>
                <Input
                  id="editName"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="ComfyUI-Amazing-Node"
                />
              </div>
              <div>
                <Label htmlFor="editGithubUrl">GitHub URL *</Label>
                <Input
                  id="editGithubUrl"
                  value={editForm.githubUrl}
                  onChange={(e) => setEditForm(prev => ({ ...prev, githubUrl: e.target.value }))}
                  placeholder="https://github.com/user/repo"
                />
              </div>
              <div>
                <Label htmlFor="editBranch">Branch</Label>
                <Input
                  id="editBranch"
                  value={editForm.branch}
                  onChange={(e) => setEditForm(prev => ({ ...prev, branch: e.target.value }))}
                  placeholder="main"
                />
              </div>
              <div>
                <Label htmlFor="editAuthor">Author</Label>
                <Input
                  id="editAuthor"
                  value={editForm.author}
                  onChange={(e) => setEditForm(prev => ({ ...prev, author: e.target.value }))}
                  placeholder="GitHub username"
                />
              </div>
              <div>
                <Label htmlFor="editDescription">Description</Label>
                <Textarea
                  id="editDescription"
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the custom node"
                />
              </div>
              <div>
                <Label htmlFor="editTags">Tags (comma-separated)</Label>
                <Input
                  id="editTags"
                  value={editForm.tags}
                  onChange={(e) => setEditForm(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="utility, controlnet, animation"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="editIsActive"
                  checked={editForm.isActive}
                  onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, isActive: checked }))}
                />
                <Label htmlFor="editIsActive">Active</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="editIsVerified"
                  checked={editForm.isVerified}
                  onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, isVerified: checked }))}
                />
                <Label htmlFor="editIsVerified">Verified</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditDialogOpen(false)
              setSelectedNode(null)
            }}>
              Cancel
            </Button>
            <Button onClick={async () => {
              if (!selectedNode || !editForm.name || !editForm.githubUrl) {
                alert('Please fill in required fields (Name and GitHub URL)')
                return
              }
              
              try {
                const tagsArray = editForm.tags.split(',').map(tag => tag.trim()).filter(tag => tag)
                
                const response = await fetch(`/api/admin/nodes/${selectedNode.id}`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    name: editForm.name,
                    githubUrl: editForm.githubUrl,
                    branch: editForm.branch || 'main',
                    author: editForm.author || null,
                    description: editForm.description || null,
                    tags: tagsArray,
                    isActive: editForm.isActive,
                    isVerified: editForm.isVerified
                  })
                })
                
                if (!response.ok) {
                  const error = await response.json()
                  throw new Error(error.error || 'Failed to update custom node')
                }
                
                alert(`Custom node "${editForm.name}" updated successfully!`)
                setEditDialogOpen(false)
                setSelectedNode(null)
                
                // Reload nodes and stats
                loadNodes()
                loadTotalStats()
              } catch (error) {
                console.error('Error updating custom node:', error)
                alert(error instanceof Error ? error.message : 'Failed to update custom node')
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