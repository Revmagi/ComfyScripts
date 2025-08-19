'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AdminLayout } from '@/components/admin/admin-layout'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { 
  Database, 
  Download, 
  CheckCircle, 
  XCircle, 
  ExternalLink,
  Plus,
  Upload,
  Search
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { ModelType, Source } from '@prisma/client'

interface Model {
  id: string
  name: string
  type: ModelType
  source: Source
  targetPath: string | null
  baseModel: string | null
  fileSize: string | null
  downloadUrl: string
  sourceUrl?: string // Optional Model URL field
  isActive: boolean
  isVerified: boolean
  createdAt: string
  downloadCount: number
}

export default function ModelsManagement() {
  const router = useRouter()
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<ModelType | 'ALL'>('ALL')
  const [sourceFilter, setSourceFilter] = useState<Source | 'ALL'>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)
  const [totalStats, setTotalStats] = useState<Record<string, number>>({})
  const [cardOrder, setCardOrder] = useState<string[]>([])

  // Generate cards for all model types with colors and labels
  const getModelTypeCards = () => {
    const modelTypeColors = {
      CHECKPOINT: { color: 'bg-blue-500', label: 'Checkpoints' },
      LORA: { color: 'bg-green-500', label: 'LoRAs' },
      VAE: { color: 'bg-orange-500', label: 'VAE' },
      CONTROLNET: { color: 'bg-purple-500', label: 'ControlNet' },
      UPSCALER: { color: 'bg-pink-500', label: 'Upscaler' },
      EMBEDDING: { color: 'bg-yellow-500', label: 'Embeddings' },
      HYPERNETWORK: { color: 'bg-indigo-500', label: 'Hypernetworks' },
      UNET: { color: 'bg-red-500', label: 'UNet' },
      CLIP: { color: 'bg-gray-500', label: 'CLIP' },
      T2I_ADAPTER: { color: 'bg-cyan-500', label: 'T2I Adapter' },
      IPADAPTER: { color: 'bg-teal-500', label: 'IP Adapter' },
      PREPROCESSOR: { color: 'bg-lime-500', label: 'Preprocessor' },
      ESRGAN: { color: 'bg-rose-500', label: 'ESRGAN' },
      ULTRALYTICS_BBOX: { color: 'bg-emerald-500', label: 'Ultralytics BBox' },
      ULTRALYTICS_SEGM: { color: 'bg-emerald-600', label: 'Ultralytics Segm' },
      SAM: { color: 'bg-blue-600', label: 'SAM' },
      INSIGHTFACE: { color: 'bg-violet-500', label: 'InsightFace' },
      CLIP_VISION: { color: 'bg-gray-600', label: 'CLIP Vision' },
      STYLE_MODELS: { color: 'bg-rose-600', label: 'Style Models' },
      OTHER: { color: 'bg-slate-500', label: 'Other' }
    }

    return Object.values(ModelType).map(type => ({
      id: type.toLowerCase(),
      label: modelTypeColors[type]?.label || type.replace('_', ' '),
      color: modelTypeColors[type]?.color || 'bg-gray-500',
      getValue: () => totalStats[type] || 0,
      filter: () => { 
        setTypeFilter(type)
        setPagination(prev => ({ ...prev, page: 1 }))
      }
    }))
  }

  // Define system/status cards
  const systemCards = [
    { id: 'total', label: 'Total', icon: Database, color: 'text-blue-500', getValue: () => totalStats.TOTAL || 0, filter: () => resetFilters() },
    { id: 'active', label: 'Active', icon: CheckCircle, color: 'text-green-500', getValue: () => totalStats.ACTIVE || 0, filter: () => { setStatusFilter('ACTIVE'); setPagination(prev => ({ ...prev, page: 1 })) } },
    { id: 'inactive', label: 'Inactive', icon: XCircle, color: 'text-red-500', getValue: () => (totalStats.TOTAL || 0) - (totalStats.ACTIVE || 0), filter: () => { setStatusFilter('INACTIVE'); setPagination(prev => ({ ...prev, page: 1 })) } },
    { id: 'verified', label: 'Verified', icon: CheckCircle, color: 'text-blue-500', getValue: () => totalStats.VERIFIED || 0, filter: () => { setStatusFilter('ALL'); setTypeFilter('ALL'); setSourceFilter('ALL'); setPagination(prev => ({ ...prev, page: 1 })) } }
  ]

  // Combine all cards and filter out zero counts
  const getAllCards = () => {
    const modelTypeCards = getModelTypeCards()
    const allCards = [...systemCards, ...modelTypeCards]
    
    // Only show cards with count > 0, but always show system cards
    return allCards.filter(card => 
      systemCards.includes(card) || card.getValue() > 0
    )
  }

  const [editForm, setEditForm] = useState({
    name: '',
    type: 'CHECKPOINT' as ModelType,
    source: 'DIRECT' as Source,
    baseModel: '',
    downloadUrl: '',
    sourceUrl: '', // New field for Model URL
    targetPath: '',
    fileSize: '',
    isActive: true,
    isVerified: false
  })
  const [validating, setValidating] = useState<string | null>(null)
  const [newModel, setNewModel] = useState({
    name: '',
    type: 'CHECKPOINT' as ModelType,
    source: 'DIRECT' as Source,
    baseModel: '',
    downloadUrl: '',
    targetPath: '',
    fileSize: '',
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

  // Load models when filters or pagination changes
  useEffect(() => {
    loadModels()
  }, [pagination.page, pagination.limit, debouncedSearchQuery, typeFilter, sourceFilter, statusFilter])

  // Load total stats on mount
  useEffect(() => {
    loadTotalStats()
  }, [])

  // Load card order from localStorage on mount and when stats change
  useEffect(() => {
    const currentCards = getAllCards()
    const savedOrder = localStorage.getItem('modelsCardOrder')
    
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder)
        // Filter saved order to only include cards that exist and add new cards at the end
        const existingCardIds = currentCards.map(card => card.id)
        const validSavedOrder = parsedOrder.filter((id: string) => existingCardIds.includes(id))
        const newCards = existingCardIds.filter(id => !parsedOrder.includes(id))
        setCardOrder([...validSavedOrder, ...newCards])
      } catch (error) {
        console.error('Error parsing saved card order:', error)
        setCardOrder(currentCards.map(card => card.id))
      }
    } else {
      setCardOrder(currentCards.map(card => card.id))
    }
  }, [totalStats])

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const loadModels = async () => {
    setLoading(true)
    
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(debouncedSearchQuery && { query: debouncedSearchQuery }),
        ...(typeFilter !== 'ALL' && { type: typeFilter }),
        ...(sourceFilter !== 'ALL' && { source: sourceFilter }),
        ...(statusFilter === 'ACTIVE' && { isActive: 'true' }),
        ...(statusFilter === 'INACTIVE' && { isActive: 'false' })
      })
      
      const response = await fetch(`/api/admin/models?${params}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch models')
      }
      
      const data = await response.json()
      setModels(data.models)
      setPagination(prev => ({ 
        ...prev, 
        total: data.pagination.total 
      }))
    } catch (error) {
      console.error('Error loading models:', error)
      alert('Failed to load models. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const loadTotalStats = async () => {
    try {
      // Get stats for all model types
      const response = await fetch('/api/admin/models/stats')
      
      if (!response.ok) {
        throw new Error('Failed to fetch stats')
      }
      
      const stats = await response.json()
      setTotalStats(stats)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  // Default target paths based on model type (RunPod workspace structure)
  const getDefaultTargetPath = (type: ModelType): string => {
    const pathMap = {
      CHECKPOINT: 'models/checkpoints',
      LORA: 'models/loras',
      VAE: 'models/vae',
      CONTROLNET: 'models/controlnet',
      UPSCALER: 'models/upscale_models',
      EMBEDDING: 'models/embeddings',
      HYPERNETWORK: 'models/hypernetworks',
      UNET: 'models/unet',
      CLIP: 'models/clip',
      T2I_ADAPTER: 'models/t2i_adapter',
      IPADAPTER: 'models/ipadapter',
      PREPROCESSOR: 'models/preprocessor',
      ESRGAN: 'models/upscale_models',
      ULTRALYTICS_BBOX: 'models/ultralytics/bbox',
      ULTRALYTICS_SEGM: 'models/ultralytics/segm',
      SAM: 'models/sams',
      INSIGHTFACE: 'models/insightface',
      CLIP_VISION: 'models/clip_vision',
      STYLE_MODELS: 'models/style_models',
      OTHER: 'models/other'
    }
    return pathMap[type] || 'models/other'
  }

  const getTypeBadge = (type: ModelType) => {
    const colors = {
      CHECKPOINT: 'bg-blue-100 text-blue-800',
      LORA: 'bg-green-100 text-green-800',
      CONTROLNET: 'bg-purple-100 text-purple-800',
      VAE: 'bg-orange-100 text-orange-800',
      UPSCALER: 'bg-pink-100 text-pink-800',
      EMBEDDING: 'bg-yellow-100 text-yellow-800',
      HYPERNETWORK: 'bg-indigo-100 text-indigo-800',
      UNET: 'bg-red-100 text-red-800',
      CLIP: 'bg-gray-100 text-gray-800',
      T2I_ADAPTER: 'bg-cyan-100 text-cyan-800',
      IPADAPTER: 'bg-teal-100 text-teal-800',
      PREPROCESSOR: 'bg-lime-100 text-lime-800',
      ESRGAN: 'bg-red-100 text-red-800',
      ULTRALYTICS_BBOX: 'bg-emerald-100 text-emerald-800',
      ULTRALYTICS_SEGM: 'bg-emerald-100 text-emerald-800',
      SAM: 'bg-blue-100 text-blue-800',
      INSIGHTFACE: 'bg-violet-100 text-violet-800',
      CLIP_VISION: 'bg-gray-100 text-gray-800',
      STYLE_MODELS: 'bg-rose-100 text-rose-800',
      OTHER: 'bg-slate-100 text-slate-800'
    }
    
    return (
      <Badge className={colors[type]}>
        {type.toLowerCase().replace('_', ' ')}
      </Badge>
    )
  }

  const getSourceBadge = (source: Source) => {
    const colors = {
      HUGGINGFACE: 'bg-yellow-100 text-yellow-800',
      CIVITAI: 'bg-red-100 text-red-800',
      GITHUB: 'bg-gray-100 text-gray-800',
      DIRECT: 'bg-blue-100 text-blue-800'
    }
    
    return (
      <Badge variant="outline" className={colors[source]}>
        {source.toLowerCase()}
      </Badge>
    )
  }

  const columns: Column<Model>[] = [
    {
      key: 'name',
      header: 'Model',
      sortable: true,
      render: (name, model) => (
        <div>
          <div className="font-medium">{name}</div>
          <div className="text-xs text-gray-500 flex items-center space-x-2">
            {getTypeBadge(model.type)}
            {model.baseModel && (
              <span className="text-xs text-gray-400">({model.baseModel})</span>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'source',
      header: 'Source',
      render: (source) => getSourceBadge(source)
    },
    {
      key: 'fileSize',
      header: 'Size',
      render: (size) => size || 'Unknown'
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (isActive, model) => (
        <div className="flex items-center space-x-2">
          {isActive ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          <span className="text-sm">
            {isActive ? 'Active' : 'Inactive'}
          </span>
          {model.isVerified && (
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

  const modelActions = [
    {
      label: 'View Source',
      onClick: (model: Model) => {
        // Use the sourceUrl field if available, otherwise construct based on source
        let sourceUrl = model.sourceUrl || ''
        
        if (!sourceUrl) {
          // For HuggingFace and CivitAI models, try to get the proper source URL
          if (model.source === 'HUGGINGFACE') {
            sourceUrl = `https://huggingface.co/${model.name}` // model.name is the full HF repo ID
          } else if (model.source === 'CIVITAI') {
            // For CivitAI, use sourceId which contains the model ID
            sourceUrl = `https://civitai.com/models/${model.sourceId}`
          } else {
            // Fallback to download URL for other sources
            sourceUrl = model.downloadUrl
          }
        }
        
        window.open(sourceUrl, '_blank')
      }
    },
    {
      label: 'Download',
      onClick: (model: Model) => window.open(model.downloadUrl, '_blank')
    },
    {
      label: 'Validate URL',
      onClick: async (model: Model) => {
        setValidating(model.id)
        try {
          const response = await fetch(`/api/admin/models/${model.id}`, {
            method: 'POST'
          })
          
          if (!response.ok) {
            throw new Error('Failed to validate model')
          }
          
          const result = await response.json()
          
          // Update the model in local state
          setModels(prev => prev.map(m => 
            m.id === model.id 
              ? { 
                  ...m, 
                  isVerified: result.isVerified 
                }
              : m
          ))
          
          alert(`URL validation completed for ${model.name}. Status: ${result.validationResult.message}`)
        } catch (error) {
          console.error('Error validating model:', error)
          alert(`URL validation failed for ${model.name}`)
        } finally {
          setValidating(null)
        }
      }
    },
    {
      label: 'Edit',
      onClick: (model: Model) => {
        setSelectedModel(model)
        
        // Determine the source URL based on the model source
        let sourceUrl = model.sourceUrl || ''
        if (!sourceUrl) {
          if (model.source === 'HUGGINGFACE') {
            sourceUrl = `https://huggingface.co/${model.name}`
          } else if (model.source === 'CIVITAI') {
            sourceUrl = `https://civitai.com/models/${model.sourceId}`
          }
        }
        
        setEditForm({
          name: model.name,
          type: model.type,
          source: model.source,
          baseModel: model.baseModel || '',
          downloadUrl: model.downloadUrl,
          sourceUrl: sourceUrl,
          targetPath: model.targetPath || getDefaultTargetPath(model.type),
          fileSize: model.fileSize || '',
          isActive: model.isActive,
          isVerified: model.isVerified
        })
        setEditDialogOpen(true)
      }
    },
    {
      label: 'Delete',
      onClick: async (model: Model) => {
        if (confirm(`Are you sure you want to delete "${model.name}"? This action cannot be undone.`)) {
          try {
            const response = await fetch(`/api/admin/models/${model.id}`, {
              method: 'DELETE'
            })
            
            if (!response.ok) {
              const error = await response.json()
              throw new Error(error.error || 'Failed to delete model')
            }
            
            alert(`Model "${model.name}" has been deleted successfully.`)
            loadModels() // Reload models from server
          } catch (error) {
            console.error('Error deleting model:', error)
            alert(error instanceof Error ? error.message : 'Failed to delete model')
          }
        }
      },
      variant: 'destructive' as const
    }
  ]

  const resetFilters = () => {
    setTypeFilter('ALL')
    setSourceFilter('ALL') 
    setStatusFilter('ALL')
    setSearchQuery('')
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const hasActiveFilters = typeFilter !== 'ALL' || sourceFilter !== 'ALL' || statusFilter !== 'ALL' || searchQuery !== ''

  // Handle drag end for card reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = cardOrder.indexOf(active.id as string)
      const newIndex = cardOrder.indexOf(over.id as string)
      
      const newOrder = arrayMove(cardOrder, oldIndex, newIndex)
      setCardOrder(newOrder)
      
      // Save to localStorage
      localStorage.setItem('modelsCardOrder', JSON.stringify(newOrder))
    }
  }

  // Get ordered cards based on current card order
  const getOrderedCards = () => {
    const currentCards = getAllCards()
    if (cardOrder.length === 0) return currentCards
    
    return cardOrder.map(id => currentCards.find(card => card.id === id)).filter(Boolean) as typeof currentCards
  }

  // Sortable Card Component
  const SortableCard = ({ card }: { card: ReturnType<typeof getAllCards>[0] }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: card.id })

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    }

    const IconComponent = card.icon

    const handleCardClick = (e: React.MouseEvent) => {
      // Only handle click if not dragging
      if (!isDragging) {
        card.filter()
      }
    }

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        className="touch-none"
      >
        <Card 
          className={`relative cursor-grab active:cursor-grabbing hover:bg-gray-50 transition-colors ${isDragging ? 'shadow-lg z-10' : ''}`}
          onClick={handleCardClick}
        >
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              {IconComponent ? (
                <IconComponent className={`h-5 w-5 ${card.color}`} />
              ) : (
                <div className={`w-3 h-3 ${card.color} rounded`}></div>
              )}
              <div>
                <p className="text-sm font-medium">{card.label}</p>
                <p className="text-2xl font-bold">{card.getValue()}</p>
              </div>
            </div>
            {/* Drag handle indicator */}
            <div 
              {...listeners}
              className="absolute top-2 right-2 opacity-50 hover:opacity-100 cursor-grab active:cursor-grabbing"
            >
              <div className="flex flex-col space-y-1">
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Model Management</h2>
            <p className="text-gray-600">Manage AI models and resources</p>
          </div>
          <div className="flex space-x-2">
            <Button 
              variant="outline"
              onClick={() => router.push('/admin/models/civitai')}
            >
              <Search className="h-4 w-4 mr-2" />
              Browse CivitAI
            </Button>
            <Button 
              variant="outline"
              onClick={() => router.push('/admin/models/huggingface')}
            >
              <Search className="h-4 w-4 mr-2" />
              Browse HuggingFace
            </Button>
            <Button onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Model
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <Label>Type:</Label>
                <Select value={typeFilter} onValueChange={(value: ModelType | 'ALL') => {
                  setTypeFilter(value)
                  setPagination(prev => ({ ...prev, page: 1 }))
                }}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Types</SelectItem>
                    <SelectItem value="CHECKPOINT">Checkpoint</SelectItem>
                    <SelectItem value="LORA">LoRA</SelectItem>
                    <SelectItem value="CONTROLNET">ControlNet</SelectItem>
                    <SelectItem value="VAE">VAE</SelectItem>
                    <SelectItem value="EMBEDDING">Embedding</SelectItem>
                    <SelectItem value="UPSCALER">Upscaler</SelectItem>
                    <SelectItem value="HYPERNETWORK">Hypernetwork</SelectItem>
                    <SelectItem value="UNET">UNet</SelectItem>
                    <SelectItem value="CLIP">CLIP</SelectItem>
                    <SelectItem value="T2I_ADAPTER">T2I Adapter</SelectItem>
                    <SelectItem value="IPADAPTER">IP Adapter</SelectItem>
                    <SelectItem value="PREPROCESSOR">Preprocessor</SelectItem>
                    <SelectItem value="ESRGAN">ESRGAN</SelectItem>
                    <SelectItem value="ULTRALYTICS_BBOX">Ultralytics BBox</SelectItem>
                    <SelectItem value="ULTRALYTICS_SEGM">Ultralytics Segmentation</SelectItem>
                    <SelectItem value="SAM">SAM</SelectItem>
                    <SelectItem value="INSIGHTFACE">InsightFace</SelectItem>
                    <SelectItem value="CLIP_VISION">CLIP Vision</SelectItem>
                    <SelectItem value="STYLE_MODELS">Style Models</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <Label>Source:</Label>
                <Select value={sourceFilter} onValueChange={(value: Source | 'ALL') => {
                  setSourceFilter(value)
                  setPagination(prev => ({ ...prev, page: 1 }))
                }}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Sources</SelectItem>
                    <SelectItem value="CIVITAI">CivitAI</SelectItem>
                    <SelectItem value="HUGGINGFACE">HuggingFace</SelectItem>
                    <SelectItem value="GITHUB">GitHub</SelectItem>
                    <SelectItem value="DIRECT">Direct</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <Label>Status:</Label>
                <Select value={statusFilter} onValueChange={(value: 'ALL' | 'ACTIVE' | 'INACTIVE') => {
                  setStatusFilter(value)
                  setPagination(prev => ({ ...prev, page: 1 }))
                }}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
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

        {/* Draggable Stats Cards */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Model Statistics</h3>
            <p className="text-sm text-gray-500">Drag and drop to reorder cards</p>
          </div>
          
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={cardOrder}
              strategy={rectSortingStrategy}
            >
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {getOrderedCards().map((card) => (
                  <SortableCard key={card.id} card={card} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle>Models</CardTitle>
            <CardDescription>
              Manage AI models from various sources
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Search className="h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search models..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              <DataTable
                data={models}
                columns={columns}
                loading={loading}
                searchable={false}
                actions={modelActions}
                pagination={{
                  ...pagination,
                  onPageChange: (page) => setPagination(prev => ({ ...prev, page }))
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Model Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Model</DialogTitle>
            <DialogDescription>
              Update model information and settings.
            </DialogDescription>
          </DialogHeader>
          {selectedModel && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">Name</Label>
                <Input
                  id="name"
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="source" className="text-right">Source</Label>
                <Select value={editForm.source} onValueChange={(value: Source) => setEditForm(prev => ({ ...prev, source: value }))}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CIVITAI">CivitAI</SelectItem>
                    <SelectItem value="HUGGINGFACE">HuggingFace</SelectItem>
                    <SelectItem value="GITHUB">GitHub</SelectItem>
                    <SelectItem value="DIRECT">Direct URL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">Type</Label>
                <Select value={editForm.type} onValueChange={(value: ModelType) => {
                  setEditForm(prev => ({ 
                    ...prev, 
                    type: value,
                    targetPath: getDefaultTargetPath(value)
                  }))
                }}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CHECKPOINT">Checkpoint</SelectItem>
                    <SelectItem value="LORA">LoRA</SelectItem>
                    <SelectItem value="CONTROLNET">ControlNet</SelectItem>
                    <SelectItem value="VAE">VAE</SelectItem>
                    <SelectItem value="EMBEDDING">Embedding</SelectItem>
                    <SelectItem value="UPSCALER">Upscaler</SelectItem>
                    <SelectItem value="HYPERNETWORK">Hypernetwork</SelectItem>
                    <SelectItem value="UNET">UNet</SelectItem>
                    <SelectItem value="CLIP">CLIP</SelectItem>
                    <SelectItem value="T2I_ADAPTER">T2I Adapter</SelectItem>
                    <SelectItem value="IPADAPTER">IP Adapter</SelectItem>
                    <SelectItem value="PREPROCESSOR">Preprocessor</SelectItem>
                    <SelectItem value="ESRGAN">ESRGAN</SelectItem>
                    <SelectItem value="ULTRALYTICS_BBOX">Ultralytics BBox</SelectItem>
                    <SelectItem value="ULTRALYTICS_SEGM">Ultralytics Segmentation</SelectItem>
                    <SelectItem value="SAM">SAM (Segment Anything)</SelectItem>
                    <SelectItem value="INSIGHTFACE">InsightFace</SelectItem>
                    <SelectItem value="CLIP_VISION">CLIP Vision</SelectItem>
                    <SelectItem value="STYLE_MODELS">Style Models</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="sourceUrl" className="text-right">Model URL</Label>
                <Input
                  id="sourceUrl"
                  value={editForm.sourceUrl}
                  onChange={(e) => setEditForm(prev => ({ ...prev, sourceUrl: e.target.value }))}
                  className="col-span-3"
                  placeholder="Source page URL (e.g., HuggingFace or CivitAI page)"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="downloadUrl" className="text-right">Download URL</Label>
                <Input
                  id="downloadUrl"
                  value={editForm.downloadUrl}
                  onChange={(e) => setEditForm(prev => ({ ...prev, downloadUrl: e.target.value }))}
                  className="col-span-3"
                  placeholder="Direct download URL"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="targetPath" className="text-right">Target Path</Label>
                <Input
                  id="targetPath"
                  value={editForm.targetPath}
                  onChange={(e) => setEditForm(prev => ({ ...prev, targetPath: e.target.value }))}
                  className="col-span-3"
                  placeholder="models/checkpoints"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="baseModel" className="text-right">Base Model</Label>
                <Input
                  id="baseModel"
                  value={editForm.baseModel}
                  onChange={(e) => setEditForm(prev => ({ ...prev, baseModel: e.target.value }))}
                  className="col-span-3"
                  placeholder="SD 1.5, SDXL, etc."
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="fileSize" className="text-right">File Size</Label>
                <Input
                  id="fileSize"
                  value={editForm.fileSize}
                  onChange={(e) => setEditForm(prev => ({ ...prev, fileSize: e.target.value }))}
                  className="col-span-3"
                  placeholder="e.g., 2.3 GB, 1.5 MB"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="active" className="text-right">Active</Label>
                <Switch
                  id="active"
                  checked={editForm.isActive}
                  onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, isActive: checked }))}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="verified" className="text-right">Verified</Label>
                <Switch
                  id="verified"
                  checked={editForm.isVerified}
                  onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, isVerified: checked }))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={async () => {
              if (!selectedModel) return
              
              try {
                const response = await fetch(`/api/admin/models/${selectedModel.id}`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    name: editForm.name,
                    type: editForm.type,
                    source: editForm.source,
                    downloadUrl: editForm.downloadUrl,
                    sourceUrl: editForm.sourceUrl || null,
                    targetPath: editForm.targetPath || null,
                    baseModel: editForm.baseModel || null,
                    fileSize: editForm.fileSize || null,
                    isActive: editForm.isActive,
                    isVerified: editForm.isVerified
                  })
                })
                
                if (!response.ok) {
                  const error = await response.json()
                  throw new Error(error.error || 'Failed to update model')
                }
                
                alert('Model updated successfully!')
                setEditDialogOpen(false)
                loadModels() // Reload the models
              } catch (error) {
                console.error('Error updating model:', error)
                alert(error instanceof Error ? error.message : 'Failed to update model')
              }
            }}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Model Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add New Model</DialogTitle>
            <DialogDescription>
              Add a new model to the library manually.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newName" className="text-right">Name</Label>
              <Input
                id="newName"
                value={newModel.name}
                onChange={(e) => setNewModel(prev => ({ ...prev, name: e.target.value }))}
                className="col-span-3"
                placeholder="Model name"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newSource" className="text-right">Source</Label>
              <Select value={newModel.source} onValueChange={(value: Source) => setNewModel(prev => ({ ...prev, source: value }))}>
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CIVITAI">CivitAI</SelectItem>
                  <SelectItem value="HUGGINGFACE">HuggingFace</SelectItem>
                  <SelectItem value="GITHUB">GitHub</SelectItem>
                  <SelectItem value="DIRECT">Direct URL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newType" className="text-right">Type</Label>
              <Select value={newModel.type} onValueChange={(value: ModelType) => {
                setNewModel(prev => ({ 
                  ...prev, 
                  type: value,
                  targetPath: getDefaultTargetPath(value)
                }))
              }}>
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHECKPOINT">Checkpoint</SelectItem>
                  <SelectItem value="LORA">LoRA</SelectItem>
                  <SelectItem value="CONTROLNET">ControlNet</SelectItem>
                  <SelectItem value="VAE">VAE</SelectItem>
                  <SelectItem value="EMBEDDING">Embedding</SelectItem>
                  <SelectItem value="UPSCALER">Upscaler</SelectItem>
                  <SelectItem value="HYPERNETWORK">Hypernetwork</SelectItem>
                  <SelectItem value="UNET">UNet</SelectItem>
                  <SelectItem value="CLIP">CLIP</SelectItem>
                  <SelectItem value="T2I_ADAPTER">T2I Adapter</SelectItem>
                  <SelectItem value="IPADAPTER">IP Adapter</SelectItem>
                  <SelectItem value="PREPROCESSOR">Preprocessor</SelectItem>
                  <SelectItem value="ESRGAN">ESRGAN</SelectItem>
                  <SelectItem value="ULTRALYTICS_BBOX">Ultralytics BBox</SelectItem>
                  <SelectItem value="ULTRALYTICS_SEGM">Ultralytics Segmentation</SelectItem>
                  <SelectItem value="SAM">SAM (Segment Anything)</SelectItem>
                  <SelectItem value="INSIGHTFACE">InsightFace</SelectItem>
                  <SelectItem value="CLIP_VISION">CLIP Vision</SelectItem>
                  <SelectItem value="STYLE_MODELS">Style Models</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newUrl" className="text-right">Download URL</Label>
              <Input
                id="newUrl"
                value={newModel.downloadUrl}
                onChange={(e) => setNewModel(prev => ({ ...prev, downloadUrl: e.target.value }))}
                className="col-span-3"
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newTargetPath" className="text-right">Target Path</Label>
              <Input
                id="newTargetPath"
                value={newModel.targetPath}
                onChange={(e) => setNewModel(prev => ({ ...prev, targetPath: e.target.value }))}
                className="col-span-3"
                placeholder="Auto-filled based on type"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newBaseModel" className="text-right">Base Model</Label>
              <Input
                id="newBaseModel"
                value={newModel.baseModel}
                onChange={(e) => setNewModel(prev => ({ ...prev, baseModel: e.target.value }))}
                className="col-span-3"
                placeholder="SD 1.5, SDXL, etc."
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newFileSize" className="text-right">File Size</Label>
              <Input
                id="newFileSize"
                value={newModel.fileSize}
                onChange={(e) => setNewModel(prev => ({ ...prev, fileSize: e.target.value }))}
                className="col-span-3"
                placeholder="e.g., 2.3 GB, 1.5 MB"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newActive" className="text-right">Active</Label>
              <Switch
                id="newActive"
                checked={newModel.isActive}
                onCheckedChange={(checked) => setNewModel(prev => ({ ...prev, isActive: checked }))}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="newVerified" className="text-right">Verified</Label>
              <Switch
                id="newVerified"
                checked={newModel.isVerified}
                onCheckedChange={(checked) => setNewModel(prev => ({ ...prev, isVerified: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddDialogOpen(false)
              setNewModel({
                name: '',
                type: 'CHECKPOINT' as ModelType,
                source: 'DIRECT' as Source,
                baseModel: '',
                downloadUrl: '',
                targetPath: 'models/checkpoints',
                fileSize: '',
                isActive: true,
                isVerified: false
              })
            }}>
              Cancel
            </Button>
            <Button onClick={async () => {
              if (!newModel.name || !newModel.downloadUrl) {
                alert('Please fill in required fields (Name and Download URL)')
                return
              }
              
              try {
                const response = await fetch('/api/admin/models', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    name: newModel.name,
                    type: newModel.type,
                    source: newModel.source,
                    downloadUrl: newModel.downloadUrl,
                    targetPath: newModel.targetPath || null,
                    baseModel: newModel.baseModel || null,
                    fileSize: newModel.fileSize || null,
                    isActive: newModel.isActive,
                    isVerified: newModel.isVerified
                  })
                })
                
                if (!response.ok) {
                  const error = await response.json()
                  throw new Error(error.error || 'Failed to create model')
                }
                
                alert(`Model "${newModel.name}" added successfully!`)
                setAddDialogOpen(false)
                
                // Reset form
                setNewModel({
                  name: '',
                  type: 'CHECKPOINT' as ModelType,
                  source: 'DIRECT' as Source,
                  baseModel: '',
                  downloadUrl: '',
                  targetPath: 'models/checkpoints',
                  fileSize: '',
                  isActive: true,
                  isVerified: false
                })
                
                // Reload models
                loadModels()
              } catch (error) {
                console.error('Error adding model:', error)
                alert(error instanceof Error ? error.message : 'Failed to add model')
              }
            }}>
              Add Model
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}