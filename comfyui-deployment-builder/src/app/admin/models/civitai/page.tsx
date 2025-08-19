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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { createCivitAIClient } from '@/lib/clients/civitai'
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
  RefreshCw
} from 'lucide-react'
import type { CivitAIModel, CivitAISearchParams } from '@/lib/clients/civitai'

interface ModelSearchFilters {
  query: string
  sort: string
  period: string
  // Model status
  earlyAccess: boolean
  onSiteGeneration: boolean
  madeOnSite: boolean
  featured: boolean
  // Model types
  checkpoint: boolean
  embedding: boolean
  hypernetwork: boolean
  aestheticGradient: boolean
  lora: boolean
  lycoris: boolean
  dora: boolean
  controlnet: boolean
  upscaler: boolean
  motion: boolean
  vae: boolean
  poses: boolean
  wildcards: boolean
  workflows: boolean
  detection: boolean
  other: boolean
  // Checkpoint type
  checkpointAll: boolean
  checkpointTrained: boolean
  checkpointMerge: boolean
  // File format
  safetensor: boolean
  pickletensor: boolean
  gguf: boolean
  diffusers: boolean
  coreML: boolean
  onnx: boolean
  // Base model
  baseModel: string
  // Modifiers
  hidden: boolean
  nsfw: boolean
  commercialUse: boolean
}

export default function CivitAIModels() {
  const [models, setModels] = useState<CivitAIModel[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState<CivitAIModel | null>(null)
  const [civitaiClient] = useState<any>(null)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [showTokenWarning, setShowTokenWarning] = useState(false)
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false)
  const [existingModels, setExistingModels] = useState<Record<string, any>>({})
  const [importStatus, setImportStatus] = useState<Record<string, 'idle' | 'importing' | 'success' | 'error'>>({})
  const [filters, setFilters] = useState<ModelSearchFilters>({
    query: '',
    sort: 'Highest Rated',
    period: 'AllTime', // CivitAI FAQ recommends "All Time" time range
    // Model status
    earlyAccess: true,
    onSiteGeneration: true, // CivitAI FAQ recommends enabling "On-site Generation"
    madeOnSite: false,
    featured: false,
    // Model types - prioritize CivitAI FAQ recommended "Checkpoint" and commonly used types
    checkpoint: true, // CivitAI FAQ recommends "Checkpoint" model type
    embedding: false,
    hypernetwork: false,
    aestheticGradient: false,
    lora: true, // LoRA is very commonly used
    lycoris: false,
    dora: false,
    controlnet: true, // ControlNet is commonly used
    upscaler: false,
    motion: false,
    vae: true, // VAE is commonly used
    poses: false,
    wildcards: false,
    workflows: false,
    detection: false,
    other: false,
    // Checkpoint type
    checkpointAll: true,
    checkpointTrained: false,
    checkpointMerge: false,
    // File format - all enabled by default
    safetensor: true,
    pickletensor: true,
    gguf: true,
    diffusers: true,
    coreML: true,
    onnx: true,
    // Base model
    baseModel: 'all',
    // Modifiers
    hidden: false,
    nsfw: false,
    commercialUse: false
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20, // Reduce to improve performance and memory usage
    total: 0 as number | string, // Can be number or string with "+" for "more available"
    totalPages: 0,
    hasMore: true,
    cursor: null as string | null, // CivitAI uses cursor-based pagination
    nextCursor: null as string | null
  })

  // Memory management - limit models in memory to prevent browser crashes
  const MAX_MODELS_IN_MEMORY = 100

  useEffect(() => {
    searchModels()
  }, [])

  // Cleanup effect to prevent memory leaks
  useEffect(() => {
    return () => {
      // Clear models on component unmount
      setModels([])
    }
  }, [])

  const searchModels = async () => {
    setLoading(true)
    setShowTokenWarning(false)
    
    try {
      // Build search parameters - exclude page parameter when there's a query
      const hasQuery = filters.query.trim()
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        sort: filters.sort,
        period: filters.period
      })

      // CivitAI uses cursor-based pagination
      if (hasQuery) {
        params.append('query', hasQuery)
        // For queries, never use page parameter - only cursor
        if (pagination.cursor) {
          params.append('cursor', pagination.cursor)
        }
      } else {
        // For non-query searches, use cursor if available, otherwise page number  
        if (pagination.cursor) {
          params.append('cursor', pagination.cursor)
        } else {
          params.append('page', pagination.page.toString())
        }
      }
      
      // Add model types only if at least one is selected
      const modelTypes = []
      if (filters.checkpoint) modelTypes.push('Checkpoint')
      if (filters.lora) modelTypes.push('LORA')
      if (filters.controlnet) modelTypes.push('Controlnet') // Note: lowercase 'n' for CivitAI
      if (filters.embedding) modelTypes.push('TextualInversion')
      if (filters.hypernetwork) modelTypes.push('Hypernetwork')
      if (filters.upscaler) modelTypes.push('Upscaler')
      if (filters.vae) modelTypes.push('VAE')
      if (filters.motion) modelTypes.push('MotionModule')
      if (filters.lycoris) modelTypes.push('LoCon') // CivitAI uses LoCon for LyCORIS
      if (filters.dora) modelTypes.push('DoRA')
      if (filters.aestheticGradient) modelTypes.push('AestheticGradient')
      if (filters.poses) modelTypes.push('Poses')
      if (filters.wildcards) modelTypes.push('Wildcards')
      if (filters.workflows) modelTypes.push('Workflows')
      if (filters.detection) modelTypes.push('Detection')
      if (filters.other) modelTypes.push('Other')
      
      // Only add types if any are selected
      if (modelTypes.length > 0) {
        modelTypes.forEach(type => params.append('types', type))
      }
      
      if (filters.baseModel !== 'all') params.append('baseModels', filters.baseModel)
      if (filters.nsfw) params.append('nsfw', 'true')
      if (filters.hidden) params.append('hidden', 'true')
      
      // CivitAI FAQ recommends enabling "On-site Generation" for better compatibility
      if (filters.onSiteGeneration) params.append('supportsGeneration', 'true')
      
      // CivitAI expects allowCommercialUse as array parameter
      if (filters.commercialUse) {
        params.append('allowCommercialUse', 'Sell')
        params.append('allowCommercialUse', 'RentCivit')
      }

      console.log('CivitAI Search Request:')
      console.log('- URL:', `/api/admin/models/civitai/search?${params}`)
      console.log('- Current Page:', pagination.page)
      console.log('- Limit:', pagination.limit)
      console.log('- Has Query:', hasQuery)

      const response = await fetch(`/api/admin/models/civitai/search?${params}`)
      
      if (!response.ok) {
        const error = await response.json()
        if (response.status === 401 || response.status === 502) {
          setShowTokenWarning(true)
          console.error('Token error:', error.details)
        }
        throw new Error(error.error || 'Failed to search models')
      }

      const data = await response.json()
      console.log('CivitAI API Response:')
      console.log('- Items returned:', data.items?.length || 0)
      console.log('- Metadata:', data.metadata)
      
      const searchedModels = data.items || []
      setModels(searchedModels)
      
      // Check for existing models if we have results
      if (searchedModels.length > 0) {
        checkExistingModels(searchedModels.map((model: CivitAIModel) => model.id.toString()))
      } else {
        setExistingModels({})
      }
      
      // Update pagination info using CivitAI metadata
      const metadata = data.metadata || {}
      const currentPage = metadata.currentPage || pagination.page
      const nextCursor = metadata.nextCursor
      const hasMore = !!nextCursor // CivitAI provides nextCursor when there are more results
      
      // For CivitAI cursor-based pagination, we show a more stable pagination
      // Instead of dynamic expansion, show a reasonable fixed range
      const totalPages = hasMore ? Math.max(currentPage + 3, 10) : currentPage // Show at least 10 pages when there's more data
      const estimatedTotal = hasMore ? `${currentPage * pagination.limit}+` : currentPage * pagination.limit
      
      console.log('CivitAI pagination update:', {
        currentPage,
        nextCursor,
        hasMore,
        pageSize: metadata.pageSize,
        limit: pagination.limit,
        totalPages,
        estimatedTotal
      })
      
      setPagination(prev => ({ 
        ...prev, 
        total: estimatedTotal,
        totalPages: totalPages,
        nextCursor: nextCursor,
        hasMore: hasMore
      }))
    } catch (error) {
      console.error('Error searching CivitAI models:', error)
      if (error instanceof Error && (error.message.includes('token') || error.message.includes('401') || error.message.includes('502'))) {
        setShowTokenWarning(true)
      }
      
      // Clear models on error instead of using mock data
      setModels([])
      setPagination(prev => ({ 
        ...prev, 
        total: 0,
        totalPages: 0,
        hasMore: false
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
          source: 'CIVITAI',
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
    setPagination(prev => ({ ...prev, page: 1, cursor: null, nextCursor: null, hasMore: true }))
    searchModels()
  }

  const goToPage = (page: number) => {
    if (page !== pagination.page && page >= 1 && page <= pagination.totalPages) {
      console.log(`Going to page ${page} from page ${pagination.page}`)
      console.log('Current pagination state:', pagination)
      setModels([]) // Clear current models while loading new page
      
      // For CivitAI cursor-based pagination
      if (page > pagination.page) {
        // Moving forward - use nextCursor
        setPagination(prev => ({ 
          ...prev, 
          page, 
          cursor: prev.nextCursor 
        }))
      } else {
        // Moving backward - reset to page 1 (CivitAI doesn't support backward cursor navigation)
        setPagination(prev => ({ 
          ...prev, 
          page: 1, 
          cursor: null, 
          nextCursor: null 
        }))
      }
      // The useEffect will trigger searchModels when page changes
    }
  }

  const nextPage = () => {
    if (pagination.hasMore && pagination.nextCursor) {
      console.log('Moving to next page with cursor:', pagination.nextCursor)
      setModels([]) // Clear current models
      setPagination(prev => ({
        ...prev,
        page: prev.page + 1,
        cursor: prev.nextCursor
      }))
    }
  }

  const prevPage = () => {
    if (pagination.page > 1) {
      // For CivitAI, we can't go backwards with cursors, so reset to page 1
      console.log('Moving to previous page - resetting to page 1')
      setModels([])
      setPagination(prev => ({
        ...prev,
        page: Math.max(1, prev.page - 1),
        cursor: prev.page - 1 === 1 ? null : prev.cursor,
        nextCursor: null
      }))
    }
  }

  // Trigger searchModels when page or cursor changes - but avoid infinite loops by checking if we actually need to search
  useEffect(() => {
    // Only trigger search when page/cursor changes and we're not already loading
    if (!loading) {
      searchModels()
    }
  }, [pagination.page, pagination.cursor, pagination.limit]) // Depend on page, cursor, and limit changes

  // Add items per page selector
  const itemsPerPageOptions = [10, 20, 50, 100]
  
  const changeItemsPerPage = (newLimit: number) => {
    setModels([]) // Clear current models
    setPagination(prev => ({ 
      ...prev, 
      limit: newLimit, 
      page: 1, // Reset to first page
      cursor: null, // Reset cursor for fresh search
      nextCursor: null,
      totalPages: typeof prev.total === 'number' ? Math.ceil(prev.total / newLimit) : prev.totalPages
    }))
  }

  const handleImportModel = async (model: CivitAIModel) => {
    setImportStatus(prev => ({ ...prev, [model.id]: 'importing' }))
    
    try {
      const latestVersion = model.modelVersions[0]
      const response = await fetch('/api/admin/models/civitai/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          modelId: model.id,
          versionId: latestVersion?.id
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
      console.error('Import error:', error)
      setImportStatus(prev => ({ ...prev, [model.id]: 'error' }))
      setTimeout(() => {
        setImportStatus(prev => ({ ...prev, [model.id]: 'idle' }))
      }, 3000)
    }
  }

  const getTypeColor = (type: string) => {
    const colors = {
      'Checkpoint': 'bg-blue-100 text-blue-800',
      'LORA': 'bg-green-100 text-green-800',
      'ControlNet': 'bg-purple-100 text-purple-800',
      'Embedding': 'bg-yellow-100 text-yellow-800',
      'Hypernetwork': 'bg-indigo-100 text-indigo-800'
    }
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        className={`h-3 w-3 ${i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} 
      />
    ))
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    return num.toString()
  }

  const getImportButtonState = (modelId: number) => {
    const status = importStatus[modelId] || 'idle'
    const isAlreadyImported = existingModels[modelId.toString()]
    
    if (isAlreadyImported) {
      return { text: 'Already Imported', disabled: true, variant: 'secondary' as const }
    }
    
    switch (status) {
      case 'importing':
        return { text: 'Importing...', disabled: true, variant: 'outline' as const }
      case 'success':
        return { text: 'Imported!', disabled: true, variant: 'default' as const }
      case 'error':
        return { text: 'Error', disabled: false, variant: 'destructive' as const }
      default:
        return { text: 'Import', disabled: false, variant: 'default' as const }
    }
  }

  // Clean HTML from description text
  const cleanDescription = (htmlDescription: string): string => {
    if (typeof window !== 'undefined') {
      return DOMPurify.sanitize(htmlDescription, { ALLOWED_TAGS: [] })
    }
    // Fallback for server-side rendering
    return htmlDescription.replace(/<[^>]*>/g, '')
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900">CivitAI Models</h2>
          <p className="text-gray-600">Search and import models from CivitAI</p>
        </div>

        {/* Search Bar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Search className="h-5 w-5 mr-2" />
              Search Models
            </CardTitle>
            <CardDescription>
              Find and import AI models from the CivitAI community
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Input
                placeholder="Search models..."
                value={filters.query}
                onChange={(e) => setFilters(prev => ({ ...prev, query: e.target.value }))}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1"
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
            
            {/* Quick Time Period Filter */}
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Time period:</Label>
              <div className="flex gap-1">
                {['Day', 'Week', 'Month', 'Year', 'AllTime'].map((period) => (
                  <Button
                    key={period}
                    variant={filters.period === period ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilters(prev => ({ ...prev, period }))}
                    className="text-xs"
                  >
                    {period === 'AllTime' ? 'All Time' : period}
                  </Button>
                ))}
              </div>
              <div className="flex-1" />
              <Select value={filters.sort} onValueChange={(value) => setFilters(prev => ({ ...prev, sort: value }))}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Highest Rated">Highest Rated</SelectItem>
                  <SelectItem value="Most Downloaded">Most Downloaded</SelectItem>
                  <SelectItem value="Newest">Newest</SelectItem>
                  <SelectItem value="Most Liked">Most Liked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>


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
            
            <Tabs defaultValue="status" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="status">Model status</TabsTrigger>
                <TabsTrigger value="types">Model types</TabsTrigger>
                <TabsTrigger value="format">File format</TabsTrigger>
                <TabsTrigger value="modifiers">Modifiers</TabsTrigger>
              </TabsList>
              
              <TabsContent value="status" className="space-y-4 mt-6">
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'earlyAccess', label: 'Early Access' },
                    { key: 'onSiteGeneration', label: 'On-site Generation' },
                    { key: 'madeOnSite', label: 'Made On-site' },
                    { key: 'featured', label: 'Featured' }
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
              
              <TabsContent value="types" className="space-y-4 mt-6">
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'checkpoint', label: 'Checkpoint' },
                    { key: 'lora', label: 'LoRA' },
                    { key: 'lycoris', label: 'LyCORIS' },
                    { key: 'dora', label: 'DoRA' },
                    { key: 'controlnet', label: 'ControlNet' },
                    { key: 'embedding', label: 'Embedding' },
                    { key: 'hypernetwork', label: 'Hypernetwork' },
                    { key: 'upscaler', label: 'Upscaler' },
                    { key: 'vae', label: 'VAE' },
                    { key: 'motion', label: 'Motion' },
                    { key: 'poses', label: 'Poses' },
                    { key: 'wildcards', label: 'Wildcards' },
                    { key: 'workflows', label: 'Workflows' },
                    { key: 'detection', label: 'Detection' },
                    { key: 'aestheticGradient', label: 'Aesthetic Gradient' },
                    { key: 'other', label: 'Other' }
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
              
              <TabsContent value="format" className="space-y-4 mt-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-3">File format</h4>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { key: 'safetensor', label: 'SafeTensor' },
                        { key: 'pickletensor', label: 'PickleTensor' },
                        { key: 'gguf', label: 'GGUF' },
                        { key: 'diffusers', label: 'Diffusers' },
                        { key: 'coreML', label: 'Core ML' },
                        { key: 'onnx', label: 'ONNX' }
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
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <Label className="text-sm font-medium mb-3 block">Base model</Label>
                    <Select value={filters.baseModel} onValueChange={(value) => setFilters(prev => ({ ...prev, baseModel: value }))}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="SD 1.5">SD 1.5</SelectItem>
                        <SelectItem value="SDXL 1.0">SDXL 1.0</SelectItem>
                        <SelectItem value="SD 3">SD 3</SelectItem>
                        <SelectItem value="SD 3.5">SD 3.5</SelectItem>
                        <SelectItem value="Flux.1 D">Flux.1 D</SelectItem>
                        <SelectItem value="Flux.1 S">Flux.1 S</SelectItem>
                        <SelectItem value="Pony">Pony</SelectItem>
                        <SelectItem value="NoobAI">NoobAI</SelectItem>
                        <SelectItem value="Illustrious">Illustrious</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="modifiers" className="space-y-4 mt-6">
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'hidden', label: 'Hidden' },
                    { key: 'nsfw', label: 'NSFW' },
                    { key: 'commercialUse', label: 'Commercial Use' }
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
            
            <DialogFooter className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setFilters({
                    query: filters.query, // Keep the search query
                    sort: 'Highest Rated',
                    period: 'Year',
                    earlyAccess: true,
                    onSiteGeneration: false,
                    madeOnSite: false,
                    featured: false,
                    checkpoint: true,
                    embedding: true,
                    hypernetwork: true,
                    aestheticGradient: true,
                    lora: true,
                    lycoris: true,
                    dora: true,
                    controlnet: true,
                    upscaler: true,
                    motion: true,
                    vae: true,
                    poses: true,
                    wildcards: true,
                    workflows: true,
                    detection: true,
                    other: true,
                    checkpointAll: true,
                    checkpointTrained: false,
                    checkpointMerge: false,
                    safetensor: true,
                    pickletensor: true,
                    gguf: true,
                    diffusers: true,
                    coreML: true,
                    onnx: true,
                    baseModel: 'all',
                    hidden: false,
                    nsfw: false,
                    commercialUse: false
                  })
                }}
              >
                Clear Filters
              </Button>
              <Button onClick={() => {
                setFiltersDialogOpen(false)
                handleSearch() // Trigger new search with updated filters
              }}>
                Apply Filters
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Model Preview Dialog */}
        <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh]">
            {selectedModel && (
              <>
                <DialogHeader>
                  <DialogTitle className="text-xl">{selectedModel.name}</DialogTitle>
                  <DialogDescription className="text-base">
                    by {selectedModel.creator?.username || 'Unknown'} • {selectedModel.type}
                  </DialogDescription>
                </DialogHeader>
                
                <ScrollArea className="max-h-[calc(90vh-200px)]">
                  <div className="space-y-6 pr-4">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Image Gallery */}
                      <div className="lg:col-span-1">
                        {selectedModel.modelVersions[0]?.images?.[0] && (
                          <Card>
                            <CardContent className="p-2">
                              <img 
                                src={selectedModel.modelVersions[0].images[0].url}
                                alt={selectedModel.name}
                                className="w-full rounded-lg object-cover aspect-square"
                              />
                            </CardContent>
                          </Card>
                        )}
                      </div>
                      
                      {/* Model Information */}
                      <div className="lg:col-span-2 space-y-4">
                        <Card>
                          <CardHeader>
                            <CardTitle>Description</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm leading-relaxed">{cleanDescription(selectedModel.description || '')}</p>
                          </CardContent>
                        </Card>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Card>
                            <CardHeader>
                              <CardTitle>Statistics</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Downloads:</span>
                                  <span className="font-medium">{formatNumber(selectedModel.stats.downloadCount)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Favorites:</span>
                                  <span className="font-medium">{formatNumber(selectedModel.stats.favoriteCount)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Rating:</span>
                                  <span className="font-medium">{selectedModel.stats.rating}/5</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Comments:</span>
                                  <span className="font-medium">{formatNumber(selectedModel.stats.commentCount)}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                          
                          <Card>
                            <CardHeader>
                              <CardTitle>License & Usage</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Commercial Use:</span>
                                  <span className={`font-medium ${selectedModel.allowCommercialUse.length > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {selectedModel.allowCommercialUse.length > 0 ? 'Allowed' : 'Not Allowed'}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Derivatives:</span>
                                  <span className={`font-medium ${selectedModel.allowDerivatives ? 'text-green-600' : 'text-red-600'}`}>
                                    {selectedModel.allowDerivatives ? 'Allowed' : 'Not Allowed'}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Credit Required:</span>
                                  <span className={`font-medium ${!selectedModel.allowNoCredit ? 'text-orange-600' : 'text-green-600'}`}>
                                    {!selectedModel.allowNoCredit ? 'Yes' : 'No'}
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                        
                        {/* Model Versions */}
                        {selectedModel.modelVersions.length > 0 && (
                          <Card>
                            <CardHeader>
                              <CardTitle>Available Versions ({selectedModel.modelVersions.length})</CardTitle>
                              <CardDescription>
                                Select a version to import with specific settings
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3 max-h-60 overflow-y-auto">
                                {selectedModel.modelVersions.map((version, index) => (
                                  <div key={version.id} className="border rounded-lg p-3 space-y-2">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <h5 className="font-medium text-sm">{version.name}</h5>
                                        <p className="text-xs text-muted-foreground">
                                          Created: {new Date(version.createdAt).toLocaleDateString()}
                                        </p>
                                      </div>
                                      <Badge variant={index === 0 ? "default" : "secondary"} className="text-xs">
                                        {index === 0 ? "Latest" : `v${index + 1}`}
                                      </Badge>
                                    </div>
                                    
                                    {version.description && (
                                      <p className="text-xs text-muted-foreground line-clamp-2">
                                        {cleanDescription(version.description)}
                                      </p>
                                    )}
                                    
                                    {version.files.length > 0 && (
                                      <div className="text-xs text-muted-foreground">
                                        Files: {version.files.length} • 
                                        Size: {version.files[0] ? `${(version.files[0].sizeKB / 1024 / 1024).toFixed(1)} GB` : 'Unknown'}
                                      </div>
                                    )}
                                    
                                    <div className="flex gap-2">
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="text-xs h-7"
                                        onClick={() => {
                                          // TODO: Set selected version and import specific version
                                          handleImportModel(selectedModel)
                                        }}
                                      >
                                        <Import className="h-3 w-3 mr-1" />
                                        Import This Version
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="ghost"
                                        className="text-xs h-7"
                                        onClick={() => window.open(`https://civitai.com/models/${selectedModel.id}?modelVersionId=${version.id}`, '_blank')}
                                      >
                                        View on CivitAI
                                      </Button>
                                    </div>
                                  </div>
                                ))}
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
                                  <Badge key={tag} variant="secondary" className="text-xs">
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
                    onClick={() => window.open(`https://civitai.com/models/${selectedModel.id}`, '_blank')}
                  >
                    View on CivitAI
                  </Button>
                  <Button onClick={() => handleImportModel(selectedModel)}>
                    <Import className="h-4 w-4 mr-2" />
                    Import Latest Version
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Main Content - Models Grid */}
        <div className="space-y-6">
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
                  Showing {models.length} of {pagination.total} models
                  {pagination.totalPages > 1 && ` • Page ${pagination.page} of ${pagination.totalPages}${pagination.hasMore ? '+' : ''}`}
                </span>
              )}
            </div>
          </div>

          {/* Models Grid */}
          {showTokenWarning && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                CivitAI API token is missing or invalid. Please add your API token in the settings.
              </AlertDescription>
            </Alert>
          )}

          {loading && models.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-600">Loading models...</span>
            </div>
          ) : models.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No models found. Try adjusting your filters or search terms.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {models.map(model => {
                  const latestVersion = model.modelVersions[0]
                  const thumbnail = latestVersion?.images?.[0]?.url
                  const buttonState = getImportButtonState(model.id)
                  
                  return (
                    <Card key={model.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      <div className="relative">
                        {thumbnail && (
                          <img 
                            src={thumbnail} 
                            alt={model.name}
                            className="w-full h-48 object-cover"
                          />
                        )}
                        <div className="absolute top-2 left-2 flex gap-2">
                          <Badge className={getTypeColor(model.type)}>
                            {model.type}
                          </Badge>
                          {latestVersion?.baseModel && (
                            <Badge variant="secondary">
                              {latestVersion.baseModel}
                            </Badge>
                          )}
                          {existingModels[model.id.toString()] && (
                            <Badge variant="default" className="bg-green-100 text-green-800">
                              Already Imported
                            </Badge>
                          )}
                        </div>
                        <div className="absolute top-2 right-2 flex gap-1">
                          {model.nsfw && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              NSFW
                            </Badge>
                          )}
                          {!model.allowCommercialUse.length && (
                            <Badge variant="outline" className="text-xs bg-white">
                              <Shield className="h-3 w-3 mr-1" />
                              Non-Commercial
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div>
                            <h3 className="font-semibold text-lg truncate">{model.name}</h3>
                            <p className="text-sm text-gray-600 line-clamp-2">{cleanDescription(model.description || '')}</p>
                            <p className="text-xs text-gray-500">by {model.creator?.username || 'Unknown'}</p>
                          </div>
                          
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center space-x-3">
                              <div className="flex items-center">
                                <Download className="h-3 w-3 mr-1 text-gray-400" />
                                <span>{formatNumber(model.stats.downloadCount)}</span>
                              </div>
                              <div className="flex items-center">
                                <Heart className="h-3 w-3 mr-1 text-gray-400" />
                                <span>{formatNumber(model.stats.favoriteCount)}</span>
                              </div>
                              <div className="flex items-center">
                                {getRatingStars(model.stats.rating)}
                                <span className="ml-1 text-xs">({model.stats.rating})</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              variant={buttonState.variant}
                              size="sm"
                              className="flex-1"
                              disabled={buttonState.disabled}
                              onClick={() => handleImportModel(model)}
                            >
                              <Import className="h-4 w-4 mr-2" />
                              {buttonState.text}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedModel(model)
                                setPreviewDialogOpen(true)
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(`https://civitai.com/models/${model.id}`, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex justify-center mt-8">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={prevPage}
                          className={pagination.page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                      
                      {/* Page numbers */}
                      {(() => {
                        const pages = []
                        const currentPage = pagination.page
                        const totalPages = pagination.totalPages
                        
                        // Always show first page
                        if (currentPage > 3) {
                          pages.push(
                            <PaginationItem key={1}>
                              <PaginationLink onClick={() => goToPage(1)} className="cursor-pointer">
                                1
                              </PaginationLink>
                            </PaginationItem>
                          )
                          if (currentPage > 4) {
                            pages.push(<PaginationEllipsis key="start-ellipsis" />)
                          }
                        }
                        
                        // Show pages around current page
                        for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
                          pages.push(
                            <PaginationItem key={i}>
                              <PaginationLink 
                                onClick={() => goToPage(i)}
                                isActive={currentPage === i}
                                className="cursor-pointer"
                              >
                                {i}
                              </PaginationLink>
                            </PaginationItem>
                          )
                        }
                        
                        // Always show last page
                        if (currentPage < totalPages - 2) {
                          if (currentPage < totalPages - 3) {
                            pages.push(<PaginationEllipsis key="end-ellipsis" />)
                          }
                          pages.push(
                            <PaginationItem key={totalPages}>
                              <PaginationLink onClick={() => goToPage(totalPages)} className="cursor-pointer">
                                {totalPages}
                              </PaginationLink>
                            </PaginationItem>
                          )
                        }
                        
                        return pages
                      })()}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={nextPage}
                          className={pagination.page >= pagination.totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}