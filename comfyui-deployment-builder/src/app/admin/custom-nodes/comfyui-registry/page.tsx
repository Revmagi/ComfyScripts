'use client'

import { useState, useEffect, useCallback } from 'react'
import DOMPurify from 'dompurify'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from '@/components/ui/pagination'
import { 
  Search, 
  Download, 
  Eye, 
  Star, 
  Heart,
  MessageCircle,
  Shield,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Import,
  ExternalLink,
  RefreshCw,
  GitBranch,
  Package,
  Code,
  Users,
  Calendar,
  CheckCircle,
  XCircle
} from 'lucide-react'

interface ComfyUIRegistryNode {
  id: string
  name: string
  description?: string
  author?: string
  category?: string
  repository?: string
  tags?: string[]
  publisher?: {
    name: string
    avatar?: string
  }
  status?: string
  latest_version?: {
    id: string
    version: string
    description?: string
    created_at: string
    dependencies?: string[]
  }
  created_at: string
  updated_at: string
  downloads?: number
  github_stars?: number
  rating?: number
  // Enhanced fields from API transformation
  githubUrl?: string
  isSafe?: boolean
  displayName?: string
  categoryDisplay?: string
  authorDisplay?: string
  descriptionPreview?: string
  latestVersion?: any
}

interface NodeSearchFilters {
  query: string
  includeBanned: boolean
}

export default function ComfyUIRegistryNodes() {
  const [nodes, setNodes] = useState<ComfyUIRegistryNode[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedNode, setSelectedNode] = useState<ComfyUIRegistryNode | null>(null)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [existingNodes, setExistingNodes] = useState<Record<string, any>>({})
  const [importStatus, setImportStatus] = useState<Record<string, 'idle' | 'importing' | 'success' | 'error'>>({})
  const [filters, setFilters] = useState<NodeSearchFilters>({
    query: '',
    includeBanned: false
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    hasMore: false
  })

  useEffect(() => {
    searchNodes()
  }, [])

  const searchNodes = async () => {
    setLoading(true)
    
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        include_banned: filters.includeBanned.toString()
      })

      if (filters.query.trim()) {
        params.append('query', filters.query.trim())
      }

      console.log('ComfyUI Registry Search Request:', `/api/admin/custom-nodes/comfyui-registry/search?${params}`)

      const response = await fetch(`/api/admin/custom-nodes/comfyui-registry/search?${params}`)
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to search nodes')
      }

      const data = await response.json()
      console.log('ComfyUI Registry API Response:', {
        nodesCount: data.nodes?.length || 0,
        pagination: data.pagination
      })
      
      const searchedNodes = data.nodes || []
      setNodes(searchedNodes)
      
      // Check for existing nodes if we have results
      if (searchedNodes.length > 0) {
        checkExistingNodes(searchedNodes.map((node: ComfyUIRegistryNode) => node.id))
      } else {
        setExistingNodes({})
      }
      
      // Update pagination info
      const paginationInfo = data.pagination || {}
      setPagination(prev => ({ 
        ...prev, 
        total: paginationInfo.total || 0,
        hasMore: paginationInfo.hasMore || false
      }))
    } catch (error) {
      console.error('Error searching ComfyUI Registry nodes:', error)
      setNodes([])
      setPagination(prev => ({ 
        ...prev, 
        total: 0,
        hasMore: false
      }))
    } finally {
      setLoading(false)
    }
  }

  const checkExistingNodes = async (nodeIds: string[]) => {
    try {
      const response = await fetch('/api/admin/custom-nodes/check-existing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          source: 'COMFYUI_REGISTRY',
          nodeIds: nodeIds
        })
      })

      if (response.ok) {
        const data = await response.json()
        setExistingNodes(data.existing || {})
      }
    } catch (error) {
      console.error('Error checking existing nodes:', error)
    }
  }

  const handleSearch = () => {
    setNodes([])
    setPagination(prev => ({ ...prev, page: 1 }))
    searchNodes()
  }

  const goToPage = (page: number) => {
    if (page !== pagination.page && page >= 1) {
      setNodes([])
      setPagination(prev => ({ ...prev, page }))
      searchNodes()
    }
  }

  const nextPage = () => {
    if (pagination.hasMore) {
      goToPage(pagination.page + 1)
    }
  }

  const prevPage = () => {
    if (pagination.page > 1) {
      goToPage(pagination.page - 1)
    }
  }

  const handleImportNode = async (node: ComfyUIRegistryNode) => {
    setImportStatus(prev => ({ ...prev, [node.id]: 'importing' }))
    
    try {
      const response = await fetch('/api/admin/custom-nodes/comfyui-registry/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nodeId: node.id,
          versionId: node.latest_version?.id
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        if (response.status === 409) {
          setImportStatus(prev => ({ ...prev, [node.id]: 'success' }))
          setExistingNodes(prev => ({ ...prev, [node.id]: data.nodeId }))
          return
        }
        console.error('Import failed:', {
          status: response.status,
          statusText: response.statusText,
          error: data.error,
          details: data.details
        })
        throw new Error(data.error || `Import failed (${response.status}): ${response.statusText}`)
      }
      
      setImportStatus(prev => ({ ...prev, [node.id]: 'success' }))
      setExistingNodes(prev => ({ ...prev, [node.id]: data.id }))
    } catch (error) {
      console.error('Import error:', error)
      setImportStatus(prev => ({ ...prev, [node.id]: 'error' }))
    }
  }

  const getImportButtonState = (node: ComfyUIRegistryNode) => {
    const isExisting = existingNodes[node.id]
    const status = importStatus[node.id] || 'idle'
    
    if (isExisting) {
      return { text: 'Imported', variant: 'secondary' as const, disabled: true }
    }
    
    switch (status) {
      case 'importing':
        return { text: 'Importing...', variant: 'outline' as const, disabled: true }
      case 'success':
        return { text: 'Imported', variant: 'secondary' as const, disabled: true }
      case 'error':
        return { text: 'Retry Import', variant: 'destructive' as const, disabled: false }
      default:
        return { text: 'Import', variant: 'default' as const, disabled: false }
    }
  }

  const handlePreviewNode = (node: ComfyUIRegistryNode) => {
    setSelectedNode(node)
    setPreviewDialogOpen(true)
  }

  const cleanDescription = (description: string | undefined): string => {
    if (!description) return 'No description available'
    
    try {
      return DOMPurify.sanitize(description, { 
        ALLOWED_TAGS: [], 
        ALLOWED_ATTR: [] 
      })
    } catch (error) {
      return description.replace(/<[^>]*>/g, '').substring(0, 200)
    }
  }

  const formatNumber = (num: number | undefined): string => {
    if (!num || num === 0) return '0'
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString()
    } catch {
      return 'Unknown'
    }
  }

  const totalPages = pagination.total > 0 ? Math.ceil(pagination.total / pagination.limit) : 1

  return (
    <AdminLayout>
      <div className="container mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">ComfyUI Registry</h1>
            <p className="text-gray-600 mt-2">
              Discover and import custom nodes from the ComfyUI community registry
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm">
              {pagination.total.toLocaleString()} nodes available
            </Badge>
          </div>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Search className="h-5 w-5 mr-2" />
              Search Custom Nodes
            </CardTitle>
            <CardDescription>
              Find and import custom nodes from the ComfyUI Registry. Search by exact node names or partial matches.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Input
                placeholder="Search nodes by name, author, or description..."
                value={filters.query}
                onChange={(e) => setFilters(prev => ({ ...prev, query: e.target.value }))}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Button 
                onClick={handleSearch} 
                disabled={loading}
                className="flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                Search
              </Button>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="include-banned"
                  checked={filters.includeBanned}
                  onCheckedChange={(checked) => setFilters(prev => ({ ...prev, includeBanned: checked }))}
                />
                <Label htmlFor="include-banned" className="text-sm">
                  Include banned nodes
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-4">
          {/* Results Summary */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              {loading ? (
                <span>Loading...</span>
              ) : (
                <span>
                  Showing {nodes.length} of {pagination.total.toLocaleString()} nodes
                  {totalPages > 1 && ` • Page ${pagination.page} of ${totalPages}`}
                </span>
              )}
            </div>
          </div>

          {/* Nodes Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-full"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                      <div className="flex gap-2">
                        <div className="h-8 bg-gray-200 rounded w-20"></div>
                        <div className="h-8 bg-gray-200 rounded w-16"></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : nodes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {nodes.map(node => {
                const buttonState = getImportButtonState(node)
                
                return (
                  <Card key={node.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div>
                          <div className="flex items-start justify-between">
                            <h3 className="font-semibold text-lg truncate flex-1 mr-2">
                              {node.displayName || node.name}
                            </h3>
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              {node.isSafe ? (
                                <CheckCircle className="h-3 w-3 text-green-500" />
                              ) : (
                                <XCircle className="h-3 w-3 text-red-500" />
                              )}
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                            {node.descriptionPreview || cleanDescription(node.description)}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500">
                              by {node.authorDisplay || node.publisher?.name || 'Unknown'}
                            </span>
                            {node.categoryDisplay && (
                              <>
                                <span className="text-xs text-gray-400">•</span>
                                <Badge variant="outline" className="text-xs">
                                  {node.categoryDisplay}
                                </Badge>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          {typeof node.downloads === 'number' && (
                            <div className="flex items-center gap-1">
                              <Download className="h-3 w-3" />
                              {formatNumber(node.downloads)}
                            </div>
                          )}
                          {typeof node.github_stars === 'number' && (
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3" />
                              {formatNumber(node.github_stars)}
                            </div>
                          )}
                          {node.created_at && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(node.created_at)}
                            </div>
                          )}
                        </div>

                        {/* Tags */}
                        {node.tags && node.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {node.tags.slice(0, 3).map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {node.tags.length > 3 && (
                              <span className="text-xs text-gray-500">
                                +{node.tags.length - 3} more
                              </span>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button
                            variant={buttonState.variant}
                            size="sm"
                            className="flex-1"
                            disabled={buttonState.disabled}
                            onClick={() => handleImportNode(node)}
                          >
                            <Import className="h-4 w-4 mr-2" />
                            {buttonState.text}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreviewNode(node)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {node.githubUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(node.githubUrl, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No nodes found</h3>
                <p className="text-gray-500">
                  Try adjusting your search terms or clearing filters
                </p>
              </CardContent>
            </Card>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => prevPage()}
                      className={pagination.page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  {/* Page numbers */}
                  {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                    const pageNum = Math.max(1, pagination.page - 2) + i
                    if (pageNum > totalPages) return null
                    
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          onClick={() => goToPage(pageNum)}
                          isActive={pageNum === pagination.page}
                          className="cursor-pointer"
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    )
                  })}
                  
                  {totalPages > 5 && pagination.page < totalPages - 2 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}
                  
                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => nextPage()}
                      className={!pagination.hasMore ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>

        {/* Preview Dialog */}
        <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {selectedNode?.displayName || selectedNode?.name}
                {selectedNode?.isSafe ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </DialogTitle>
              <DialogDescription>
                Custom node details and installation information
              </DialogDescription>
            </DialogHeader>
            
            {selectedNode && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Description</Label>
                  <p className="text-sm text-gray-600 mt-1">
                    {cleanDescription(selectedNode.description)}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Author</Label>
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedNode.authorDisplay || selectedNode.publisher?.name || 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Category</Label>
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedNode.categoryDisplay || 'Uncategorized'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Downloads</Label>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatNumber(selectedNode.downloads)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">GitHub Stars</Label>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatNumber(selectedNode.github_stars)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Created</Label>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatDate(selectedNode.created_at)}
                    </p>
                  </div>
                </div>

                {selectedNode.latest_version && (
                  <div>
                    <Label className="text-sm font-medium">Latest Version</Label>
                    <div className="mt-1 p-2 bg-gray-50 rounded">
                      <p className="text-sm font-medium">{selectedNode.latest_version.version}</p>
                      {selectedNode.latest_version.description && (
                        <p className="text-sm text-gray-600 mt-1">
                          {selectedNode.latest_version.description}
                        </p>
                      )}
                      {selectedNode.latest_version.dependencies && selectedNode.latest_version.dependencies.length > 0 && (
                        <div className="mt-2">
                          <Label className="text-xs font-medium">Dependencies</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {selectedNode.latest_version.dependencies.map((dep: string) => (
                              <Badge key={dep} variant="outline" className="text-xs">
                                {dep}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedNode.tags && selectedNode.tags.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Tags</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedNode.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {selectedNode.githubUrl && (
                  <div>
                    <Label className="text-sm font-medium">Repository</Label>
                    <div className="mt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(selectedNode.githubUrl, '_blank')}
                        className="flex items-center gap-2"
                      >
                        <GitBranch className="h-4 w-4" />
                        View on GitHub
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
                Close
              </Button>
              {selectedNode && (
                <Button 
                  onClick={() => {
                    handleImportNode(selectedNode)
                    setPreviewDialogOpen(false)
                  }}
                  disabled={getImportButtonState(selectedNode).disabled}
                >
                  <Import className="h-4 w-4 mr-2" />
                  {getImportButtonState(selectedNode).text}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  )
}