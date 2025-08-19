'use client'

import { useState, useEffect } from 'react'
import { AdminLayout } from '@/components/admin/admin-layout'
import { Search, Filter, AlertTriangle, Import, Download, Heart, User, Calendar, Package, ExternalLink, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'

// Extended interface for HuggingFace models with transformed data
interface HuggingFaceModel {
  id: string
  author: string
  sha: string
  lastModified: string
  private: boolean
  disabled: boolean
  gated: boolean | string
  downloads: number
  likes: number
  library_name?: string
  tags: string[]
  pipeline_tag?: string
  card_data?: {
    language?: string[]
    license?: string
    datasets?: string[]
    model_name?: string
    base_model?: string
  }
  siblings: Array<{
    rfilename: string
    size?: number
  }>
  
  // Transformed fields from API
  modelType: string
  baseModel: string | null
  primaryFile: any
  formattedFileSize: string
  license: string
  isCommercialUseAllowed: boolean
  isStableDiffusion: boolean
  requiresAuth: boolean
  createdAt: string
  downloadUrl: string | null
}

interface ModelSearchFilters {
  search: string
  author: string
  filter: string
  sort: string
  direction: string
  
  // Library filters
  transformers: boolean
  diffusers: boolean
  timm: boolean
  sentence_transformers: boolean
  
  // Task filters
  'text-generation': boolean
  'text-to-image': boolean
  'image-to-image': boolean
  'image-classification': boolean
  'automatic-speech-recognition': boolean
}

interface PaginationState {
  page: number
  limit: number
  total: number
  totalPages: number
}

const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

export default function HuggingFaceModels() {
  const [models, setModels] = useState<HuggingFaceModel[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState<HuggingFaceModel | null>(null)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [showTokenWarning, setShowTokenWarning] = useState(false)
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false)
  const [importStatus, setImportStatus] = useState<Record<string, 'idle' | 'importing' | 'success' | 'error'>>({})
  const [existingModels, setExistingModels] = useState<Record<string, any>>({})

  // Search and filter state
  const [filters, setFilters] = useState<ModelSearchFilters>({
    search: '',
    author: '',
    filter: '',
    sort: 'downloads',
    direction: 'desc',
    
    // Library filters
    transformers: false,
    diffusers: false,
    timm: false,
    sentence_transformers: false,
    
    // Task filters
    'text-generation': false,
    'text-to-image': false,
    'image-to-image': false,
    'image-classification': false,
    'automatic-speech-recognition': false
  })

  // Pagination state
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  const searchModels = async () => {
    setLoading(true)
    setShowTokenWarning(false)
    
    try {
      // Build filter string
      const filterParts: string[] = []
      
      // Add library filters
      if (filters.transformers) filterParts.push('transformers')
      if (filters.diffusers) filterParts.push('diffusers')
      if (filters.timm) filterParts.push('timm')
      if (filters.sentence_transformers) filterParts.push('sentence-transformers')
      
      // Add task filters
      if (filters['text-generation']) filterParts.push('text-generation')
      if (filters['text-to-image']) filterParts.push('text-to-image')
      if (filters['image-to-image']) filterParts.push('image-to-image')
      if (filters['image-classification']) filterParts.push('image-classification')
      if (filters['automatic-speech-recognition']) filterParts.push('automatic-speech-recognition')
      
      const searchParams = new URLSearchParams({
        limit: pagination.limit.toString(),
        page: pagination.page.toString(),
        sort: filters.sort,
        direction: filters.direction
      })
      
      if (filters.search?.trim()) {
        searchParams.append('search', filters.search.trim())
      }
      
      if (filters.author?.trim()) {
        searchParams.append('author', filters.author.trim())
      }
      
      if (filterParts.length > 0) {
        searchParams.append('filter', filterParts.join(','))
      }

      const response = await fetch(`/api/admin/models/huggingface/search?${searchParams}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Search failed')
      }

      const searchedModels = data.models || []
      setModels(searchedModels)
      
      // Check for existing models if we have results
      if (searchedModels.length > 0) {
        checkExistingModels(searchedModels.map((model: HuggingFaceModel) => model.id))
      } else {
        setExistingModels({})
      }
      
      // HuggingFace doesn't provide total counts, so we estimate based on results
      const resultsCount = searchedModels.length
      const estimatedTotal = resultsCount === pagination.limit ? pagination.limit * 10 : resultsCount // Estimate 10 pages if we got full results
      setPagination(prev => ({ 
        ...prev, 
        total: estimatedTotal,
        totalPages: resultsCount === prev.limit ? Math.max(prev.page + 5, 10) : prev.page // Show more pages if we got full results
      }))
    } catch (error) {
      console.error('Error searching HuggingFace models:', error)
      if (error instanceof Error && (error.message.includes('token') || error.message.includes('401') || error.message.includes('502'))) {
        setShowTokenWarning(true)
      }
      
      // Clear models on error
      setModels([])
      setPagination(prev => ({ 
        ...prev, 
        total: 0,
        totalPages: 0
      }))
    } finally {
      setLoading(false)
    }
  }

  const checkExistingModels = async (modelIds: string[]) => {
    try {
      const response = await fetch('/api/admin/models/check-existing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          source: 'HUGGINGFACE',
          modelIds: modelIds
        })
      })

      if (response.ok) {
        const data = await response.json()
        setExistingModels(data.existing || {})
      }
    } catch (error) {
      console.error('Error checking existing models:', error)
      // Don't show error to user as this is background functionality
    }
  }

  const handleSearch = () => {
    setModels([]) // Clear existing models
    setPagination(prev => ({ ...prev, page: 1 }))
    searchModels()
  }

  // Load trending models on component mount
  useEffect(() => {
    if (models.length === 0) {
      searchModels()
    }
  }, [])

  // Search when pagination page changes
  useEffect(() => {
    if (models.length > 0) { // Only search if we've already loaded initial data
      searchModels()
    }
  }, [pagination.page])

  // Add items per page selector
  const itemsPerPageOptions = [10, 20, 50, 100]
  
  const changeItemsPerPage = (newLimit: number) => {
    setPagination(prev => ({ 
      ...prev, 
      limit: newLimit, 
      page: 1, // Reset to first page
      totalPages: Math.ceil(prev.total / newLimit)
    }))
    // Trigger search with new limit
    setTimeout(() => searchModels(), 100)
  }

  const handleImportModel = async (model: HuggingFaceModel) => {
    setImportStatus(prev => ({ ...prev, [model.id]: 'importing' }))
    
    try {
      const response = await fetch('/api/admin/models/huggingface/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          modelId: model.id
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        if (response.status === 409) {
          // Model already imported
          setImportStatus(prev => ({ ...prev, [model.id]: 'success' }))
        } else {
          throw new Error(data.error || 'Import failed')
        }
      } else {
        setImportStatus(prev => ({ ...prev, [model.id]: 'success' }))
      }
      
      // Reset status after 3 seconds
      setTimeout(() => {
        setImportStatus(prev => ({ ...prev, [model.id]: 'idle' }))
      }, 3000)
    } catch (error) {
      console.error('Error importing model:', error)
      setImportStatus(prev => ({ ...prev, [model.id]: 'error' }))
      
      // Reset status after 5 seconds
      setTimeout(() => {
        setImportStatus(prev => ({ ...prev, [model.id]: 'idle' }))
      }, 5000)
    }
  }

  const getImportButtonText = (modelId: string) => {
    const status = importStatus[modelId] || 'idle'
    const isAlreadyImported = existingModels[modelId]
    
    if (isAlreadyImported) {
      return 'Already Imported'
    }
    
    switch (status) {
      case 'importing': return 'Importing...'
      case 'success': return 'Imported ✓'
      case 'error': return 'Failed ✗'
      default: return 'Import'
    }
  }

  const getImportButtonVariant = (modelId: string) => {
    const status = importStatus[modelId] || 'idle'
    const isAlreadyImported = existingModels[modelId]
    
    if (isAlreadyImported) {
      return 'secondary' as const
    }
    
    switch (status) {
      case 'importing': return 'outline' as const
      case 'success': return 'default' as const
      case 'error': return 'destructive' as const
      default: return 'default' as const
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">HuggingFace Models</h1>
          <p className="text-gray-600">
            Browse and import machine learning models from HuggingFace Hub
          </p>
        </div>

        {/* Search Bar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Search className="h-5 w-5 mr-2" />
              Search Models
            </CardTitle>
            <CardDescription>
              Find and import AI models from the HuggingFace Hub
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Input
                placeholder="Search models..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
              />
              <Input
                placeholder="Author (e.g., google, microsoft)..."
                value={filters.author}
                onChange={(e) => setFilters(prev => ({ ...prev, author: e.target.value }))}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-64"
              />
              <Button
                variant="outline"
                onClick={() => setFiltersDialogOpen(true)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filters
              </Button>
              <Button 
                onClick={handleSearch} 
                disabled={loading}
                className="flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                Search
              </Button>
            </div>
            
            {/* Quick Filters */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Sort by:</Label>
              <Select value={filters.sort} onValueChange={(value) => setFilters(prev => ({ ...prev, sort: value }))}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="downloads">Most Downloaded</SelectItem>
                  <SelectItem value="likes">Most Liked</SelectItem>
                  <SelectItem value="trending">Trending</SelectItem>
                  <SelectItem value="lastModified">Recently Updated</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.direction} onValueChange={(value) => setFilters(prev => ({ ...prev, direction: value }))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="desc">Descending</SelectItem>
                  <SelectItem value="asc">Ascending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="space-y-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="h-4 bg-gray-200 rounded mb-4"></div>
                    <div className="h-3 bg-gray-200 rounded mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded mb-4"></div>
                    <div className="flex space-x-2">
                      <div className="h-8 bg-gray-200 rounded flex-1"></div>
                      <div className="h-8 bg-gray-200 rounded w-20"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              {showTokenWarning && (
                <Alert className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    HuggingFace API token not configured. Please go to{' '}
                    <button 
                      onClick={() => window.open('/admin/settings', '_blank')}
                      className="text-blue-500 hover:underline"
                    >
                      Settings
                    </button>
                    {' '}to add your HuggingFace API token.
                  </AlertDescription>
                </Alert>
              )}

              {/* Controls */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex items-center gap-4">
                  <Label className="text-sm font-medium">Items per page:</Label>
                  <Select value={pagination.limit.toString()} onValueChange={(value) => changeItemsPerPage(parseInt(value))}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {itemsPerPageOptions.map(option => (
                        <SelectItem key={option} value={option.toString()}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {loading ? (
                    <span>Loading...</span>
                  ) : (
                    <span>
                      Showing {models.length} models
                      {pagination.total > 0 && ` of ${formatNumber(pagination.total)} total`}
                    </span>
                  )}
                </div>
              </div>

              {/* Models Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {models.map((model) => (
                  <Card key={model.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Model Header */}
                        <div>
                          <h3 className="font-semibold text-lg line-clamp-1">{model.id}</h3>
                          <p className="text-sm text-gray-600 flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {model.author}
                          </p>
                        </div>

                        {/* Model Info */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs">
                            <Badge variant="secondary">{model.modelType}</Badge>
                            {model.baseModel && (
                              <Badge variant="outline">{model.baseModel}</Badge>
                            )}
                            {model.requiresAuth && (
                              <Badge variant="destructive">Gated</Badge>
                            )}
                            {existingModels[model.id] && (
                              <Badge variant="default" className="bg-green-100 text-green-800">
                                Already Imported
                              </Badge>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                            <div className="flex items-center gap-1">
                              <Download className="h-3 w-3" />
                              {formatNumber(model.downloads)}
                            </div>
                            <div className="flex items-center gap-1">
                              <Heart className="h-3 w-3" />
                              {formatNumber(model.likes)}
                            </div>
                            <div className="flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              {model.library_name || 'Unknown'}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(model.lastModified).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        {/* Tags */}
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1">
                            {model.tags.slice(0, 3).map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {model.tags.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{model.tags.length - 3}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedModel(model)
                              setPreviewDialogOpen(true)
                            }}
                            className="flex-1"
                          >
                            Preview
                          </Button>
                          <Button
                            size="sm"
                            variant={getImportButtonVariant(model.id)}
                            onClick={() => handleImportModel(model)}
                            disabled={importStatus[model.id] === 'importing' || existingModels[model.id]}
                            className="flex items-center gap-1"
                          >
                            {importStatus[model.id] === 'importing' ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <Import className="h-3 w-3" />
                            )}
                            {getImportButtonText(model.id)}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Empty State */}
              {!loading && models.length === 0 && (
                <div className="text-center py-12">
                  <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No models found</h3>
                  <p className="text-gray-600 mb-4">Try adjusting your search terms or filters</p>
                  <Button onClick={() => {
                    setFilters(prev => ({ 
                      ...prev, 
                      search: '', 
                      author: '', 
                      filter: '',
                      transformers: false,
                      diffusers: false,
                      timm: false,
                      sentence_transformers: false,
                      'text-generation': false,
                      'text-to-image': false,
                      'image-to-image': false,
                      'image-classification': false,
                      'automatic-speech-recognition': false
                    }))
                    handleSearch()
                  }}>
                    Clear Filters
                  </Button>
                </div>
              )}

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex justify-center mt-8">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            if (pagination.page > 1) {
                              setPagination(prev => ({ ...prev, page: prev.page - 1 }))
                              searchModels()
                            }
                          }}
                          className={pagination.page <= 1 ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        const pageNum = i + 1
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              href="#"
                              isActive={pageNum === pagination.page}
                              onClick={(e) => {
                                e.preventDefault()
                                if (pageNum !== pagination.page) {
                                  setPagination(prev => ({ ...prev, page: pageNum }))
                                  searchModels()
                                }
                              }}
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      })}
                      
                      <PaginationItem>
                        <PaginationNext 
                          href="#"
                          onClick={(e) => {
                            e.preventDefault()
                            if (pagination.page < pagination.totalPages) {
                              setPagination(prev => ({ ...prev, page: prev.page + 1 }))
                              searchModels()
                            }
                          }}
                          className={pagination.page >= pagination.totalPages ? 'pointer-events-none opacity-50' : ''}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </div>

        {/* Model Preview Dialog */}
        <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh]">
            {selectedModel && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-xl">{selectedModel.id}</DialogTitle>
                  <DialogDescription className="text-base">
                    by {selectedModel.author} • {selectedModel.modelType}
                  </DialogDescription>
                </DialogHeader>
                
                <ScrollArea className="max-h-[calc(90vh-200px)]">
                  <div className="space-y-6 pr-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Model Information */}
                      <div className="space-y-4">
                        <Card>
                          <CardHeader>
                            <CardTitle>Model Information</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Type:</span>
                                <Badge variant="secondary">{selectedModel.modelType}</Badge>
                              </div>
                              {selectedModel.baseModel && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Base Model:</span>
                                  <span className="font-medium">{selectedModel.baseModel}</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Library:</span>
                                <span className="font-medium">{selectedModel.library_name || 'Unknown'}</span>
                              </div>
                              {selectedModel.pipeline_tag && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Task:</span>
                                  <span className="font-medium">{selectedModel.pipeline_tag}</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">File Size:</span>
                                <span className="font-medium">{selectedModel.formattedFileSize}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Updated:</span>
                                <span className="font-medium">{new Date(selectedModel.lastModified).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                        
                        <Card>
                          <CardHeader>
                            <CardTitle>Statistics & License</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Downloads:</span>
                                <span className="font-medium">{formatNumber(selectedModel.downloads)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Likes:</span>
                                <span className="font-medium">{formatNumber(selectedModel.likes)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">License:</span>
                                <span className="font-medium">{selectedModel.license}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Commercial Use:</span>
                                <span className={`font-medium ${selectedModel.isCommercialUseAllowed ? 'text-green-600' : 'text-red-600'}`}>
                                  {selectedModel.isCommercialUseAllowed ? 'Allowed' : 'Restricted'}
                                </span>
                              </div>
                              {selectedModel.requiresAuth && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Access:</span>
                                  <Badge variant="destructive">Gated Model</Badge>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                      
                      {/* Files and Tags */}
                      <div className="space-y-4">
                        {selectedModel.siblings && selectedModel.siblings.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle>Model Files ({selectedModel.siblings.length})</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2 max-h-40 overflow-y-auto">
                                {selectedModel.siblings.slice(0, 10).map((file, index) => (
                                  <div key={index} className="flex justify-between items-center text-sm">
                                    <span className="font-mono text-xs truncate">{file.rfilename}</span>
                                    <span className="text-muted-foreground">
                                      {file.size ? (file.size / 1024 / 1024).toFixed(1) + ' MB' : ''}
                                    </span>
                                  </div>
                                ))}
                                {selectedModel.siblings.length > 10 && (
                                  <div className="text-xs text-muted-foreground text-center">
                                    ... and {selectedModel.siblings.length - 10} more files
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                        
                        {/* Tags */}
                        {selectedModel.tags.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle>Tags</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="flex flex-wrap gap-1">
                                {selectedModel.tags.map(tag => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </div>
                  </div>
                </ScrollArea>
                
                <DialogFooter className="gap-2">
                  <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
                    Close
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => window.open(`https://huggingface.co/${selectedModel.id}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View on HuggingFace
                  </Button>
                  <Button onClick={() => handleImportModel(selectedModel)}>
                    <Import className="h-4 w-4 mr-2" />
                    Import Model
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Filters Dialog */}
        <Dialog open={filtersDialogOpen} onOpenChange={setFiltersDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </DialogTitle>
              <DialogDescription>
                Refine your search with detailed filters
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="libraries" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="libraries">Libraries</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
              </TabsList>
              
              <TabsContent value="libraries" className="space-y-4 mt-6">
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'transformers', label: 'Transformers' },
                    { key: 'diffusers', label: 'Diffusers' },
                    { key: 'timm', label: 'TIMM' },
                    { key: 'sentence_transformers', label: 'Sentence Transformers' }
                  ].map(({ key, label }) => (
                    <Button
                      key={key}
                      variant={filters[key as keyof ModelSearchFilters] ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilters(prev => ({ ...prev, [key]: !prev[key as keyof ModelSearchFilters] }))}
                      className="text-xs h-8"
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="tasks" className="space-y-4 mt-6">
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'text-generation', label: 'Text Generation' },
                    { key: 'text-to-image', label: 'Text to Image' },
                    { key: 'image-to-image', label: 'Image to Image' },
                    { key: 'image-classification', label: 'Image Classification' },
                    { key: 'automatic-speech-recognition', label: 'Speech Recognition' }
                  ].map(({ key, label }) => (
                    <Button
                      key={key}
                      variant={filters[key as keyof ModelSearchFilters] ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilters(prev => ({ ...prev, [key]: !prev[key as keyof ModelSearchFilters] }))}
                      className="text-xs h-8"
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setFilters(prev => ({
                  ...prev,
                  transformers: false,
                  diffusers: false,
                  timm: false,
                  sentence_transformers: false,
                  'text-generation': false,
                  'text-to-image': false,
                  'image-to-image': false,
                  'image-classification': false,
                  'automatic-speech-recognition': false
                }))
              }}>
                Clear All
              </Button>
              <Button onClick={() => {
                setFiltersDialogOpen(false)
                handleSearch()
              }}>
                Apply Filters
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  )
}