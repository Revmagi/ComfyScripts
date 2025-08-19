'use client'

import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { 
  Package, 
  Github, 
  CheckCircle, 
  XCircle, 
  ExternalLink,
  Plus,
  Search
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
  const [nodes, setNodes] = useState<CustomNode[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newNode, setNewNode] = useState({
    name: '',
    githubUrl: '',
    branch: 'main',
    author: '',
    description: '',
    tags: '',
    isActive: true
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0
  })

  useEffect(() => {
    loadNodes()
  }, [pagination.page, searchQuery])

  const loadNodes = async () => {
    setLoading(true)
    
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(searchQuery && { query: searchQuery })
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
          } catch (error) {
            console.error('Error deleting custom node:', error)
            alert(error instanceof Error ? error.message : 'Failed to delete custom node')
          }
        }
      },
      variant: 'destructive' as const
    }
  ]

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Custom Nodes Management</h2>
            <p className="text-gray-600">Manage ComfyUI custom nodes and extensions</p>
          </div>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Custom Node
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Package className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium">Total Nodes</p>
                  <p className="text-2xl font-bold">{pagination.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-2xl font-bold">
                    {nodes.filter(n => n.isActive).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium">Verified</p>
                  <p className="text-2xl font-bold">
                    {nodes.filter(n => n.isVerified).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
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
            <DataTable
              data={nodes}
              columns={columns}
              loading={loading}
              searchable
              onSearch={setSearchQuery}
              actions={nodeActions}
              pagination={{
                ...pagination,
                onPageChange: (page) => setPagination(prev => ({ ...prev, page }))
              }}
            />
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
                
                // Reload nodes
                loadNodes()
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
    </AdminLayout>
  )
}