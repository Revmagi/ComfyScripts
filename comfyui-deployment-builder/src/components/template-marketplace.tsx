'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  Download,
  Star,
  User,
  Calendar,
  Tag,
  Search,
  Filter,
  Eye,
  Copy,
  Check,
  Heart,
  Share2,
  ExternalLink
} from 'lucide-react'
import { scriptGenerator, type ScriptTemplate } from '@/lib/script-generator'

interface TemplateMarketplaceProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTemplateSelect?: (template: ScriptTemplate) => void
}

interface CommunityTemplate extends ScriptTemplate {
  downloads: number
  likes: number
  rating: number
  author: {
    name: string
    avatar?: string
    verified: boolean
  }
  preview?: string
  lastUpdated: string
  compatibility: string[]
  examples?: Array<{
    name: string
    description: string
  }>
}

export function TemplateMarketplace({ open, onOpenChange, onTemplateSelect }: TemplateMarketplaceProps) {
  const [templates, setTemplates] = useState<CommunityTemplate[]>([])
  const [filteredTemplates, setFilteredTemplates] = useState<CommunityTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState('popular')
  const [selectedTemplate, setSelectedTemplate] = useState<CommunityTemplate | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadCommunityTemplates()
  }, [])

  useEffect(() => {
    filterTemplates()
  }, [templates, searchQuery, selectedCategory, sortBy])

  const loadCommunityTemplates = async () => {
    setLoading(true)
    
    // Simulate loading community templates
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    const mockTemplates: CommunityTemplate[] = [
      {
        id: 'community-production-docker',
        name: 'Production-Ready Docker',
        description: 'Production-optimized Docker setup with multi-stage builds, security hardening, and monitoring',
        type: 'DOCKER',
        template: `# Production Docker template with security and optimization...`,
        variables: {},
        isDefault: false,
        version: '2.1.0',
        tags: ['docker', 'production', 'security', 'multi-stage'],
        downloads: 2847,
        likes: 342,
        rating: 4.8,
        author: {
          name: 'devops-expert',
          verified: true
        },
        lastUpdated: '2024-01-15',
        compatibility: ['ComfyUI 1.0+', 'Docker 20.10+'],
        examples: [
          { name: 'Basic Setup', description: 'Standard production deployment' },
          { name: 'GPU Enabled', description: 'With NVIDIA GPU support' }
        ]
      },
      {
        id: 'community-k8s-deployment',
        name: 'Kubernetes Deployment',
        description: 'Complete Kubernetes manifests with Helm charts for scalable ComfyUI deployment',
        type: 'DOCKER',
        template: `# Kubernetes deployment template...`,
        variables: {},
        isDefault: false,
        version: '1.3.2',
        tags: ['kubernetes', 'helm', 'scalable', 'cloud'],
        downloads: 1923,
        likes: 278,
        rating: 4.6,
        author: {
          name: 'k8s-ninja',
          verified: true
        },
        lastUpdated: '2024-01-12',
        compatibility: ['Kubernetes 1.20+', 'Helm 3.0+'],
        examples: [
          { name: 'Single Node', description: 'Basic single-node deployment' },
          { name: 'Multi-Node', description: 'Scalable multi-node setup' }
        ]
      },
      {
        id: 'community-aws-ecs',
        name: 'AWS ECS Fargate',
        description: 'Serverless deployment on AWS ECS Fargate with auto-scaling and load balancing',
        type: 'DOCKER',
        template: `# AWS ECS Fargate template...`,
        variables: {},
        isDefault: false,
        version: '1.0.5',
        tags: ['aws', 'ecs', 'fargate', 'serverless'],
        downloads: 1456,
        likes: 189,
        rating: 4.4,
        author: {
          name: 'aws-specialist',
          verified: false
        },
        lastUpdated: '2024-01-10',
        compatibility: ['AWS ECS', 'ALB'],
        examples: [
          { name: 'Basic Fargate', description: 'Simple Fargate deployment' }
        ]
      },
      {
        id: 'community-runpod-optimized',
        name: 'RunPod GPU Optimized',
        description: 'Highly optimized RunPod template with fast startup and GPU memory management',
        type: 'RUNPOD',
        template: `# RunPod optimized template...`,
        variables: {},
        isDefault: false,
        version: '3.2.1',
        tags: ['runpod', 'gpu', 'optimized', 'fast-startup'],
        downloads: 3421,
        likes: 567,
        rating: 4.9,
        author: {
          name: 'runpod-pro',
          verified: true
        },
        lastUpdated: '2024-01-18',
        compatibility: ['RunPod', 'CUDA 11.8+'],
        examples: [
          { name: 'A100 Setup', description: 'Optimized for A100 GPUs' },
          { name: 'RTX 3090', description: 'Consumer GPU optimization' }
        ]
      },
      {
        id: 'community-local-dev',
        name: 'Local Development Pro',
        description: 'Enhanced local development setup with hot-reload, debugging, and testing',
        type: 'LOCAL',
        template: `# Local development template...`,
        variables: {},
        isDefault: false,
        version: '2.0.3',
        tags: ['local', 'development', 'debugging', 'testing'],
        downloads: 987,
        likes: 134,
        rating: 4.3,
        author: {
          name: 'dev-tools-master',
          verified: false
        },
        lastUpdated: '2024-01-14',
        compatibility: ['Python 3.8+', 'Node.js 16+'],
        examples: [
          { name: 'VS Code Setup', description: 'With VS Code integration' },
          { name: 'PyCharm Setup', description: 'JetBrains IDE integration' }
        ]
      }
    ]

    setTemplates(mockTemplates)
    setLoading(false)
  }

  const filterTemplates = () => {
    let filtered = templates

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
        template.author.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(template => {
        if (selectedCategory === 'docker') return template.type === 'DOCKER'
        if (selectedCategory === 'runpod') return template.type === 'RUNPOD'
        if (selectedCategory === 'local') return template.type === 'LOCAL'
        return template.tags.includes(selectedCategory)
      })
    }

    // Sort templates
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return b.downloads - a.downloads
        case 'liked':
          return b.likes - a.likes
        case 'rating':
          return b.rating - a.rating
        case 'recent':
          return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
        default:
          return 0
      }
    })

    setFilteredTemplates(filtered)
  }

  const handlePreview = (template: CommunityTemplate) => {
    setSelectedTemplate(template)
    setPreviewOpen(true)
  }

  const handleUseTemplate = (template: CommunityTemplate) => {
    // Add to local templates
    scriptGenerator.addTemplate(template)
    onTemplateSelect?.(template)
    onOpenChange(false)
  }

  const handleCopyTemplate = async (template: CommunityTemplate) => {
    try {
      await navigator.clipboard.writeText(template.template)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy template:', error)
    }
  }

  const getRatingStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-3 w-3 ${i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
      />
    ))
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'DOCKER':
        return 'bg-blue-100 text-blue-800'
      case 'RUNPOD':
        return 'bg-green-100 text-green-800'
      case 'LOCAL':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`
    }
    return num.toString()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Share2 className="h-5 w-5 mr-2" />
              Template Marketplace
            </DialogTitle>
            <DialogDescription>
              Discover and share deployment templates from the community
            </DialogDescription>
          </DialogHeader>

          {/* Search and Filters */}
          <div className="space-y-4">
            <div className="flex space-x-4">
              <div className="flex-1">
                <Input
                  placeholder="Search templates, authors, or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="docker">Docker</SelectItem>
                  <SelectItem value="runpod">RunPod</SelectItem>
                  <SelectItem value="local">Local</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="cloud">Cloud</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="popular">Most Downloaded</SelectItem>
                  <SelectItem value="liked">Most Liked</SelectItem>
                  <SelectItem value="rating">Highest Rated</SelectItem>
                  <SelectItem value="recent">Recently Updated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Templates Grid */}
          <div className="space-y-4">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-4 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded mb-4 w-2/3"></div>
                      <div className="h-3 bg-gray-200 rounded mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                {filteredTemplates.map(template => (
                  <Card key={template.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{template.name}</h3>
                            <p className="text-sm text-gray-600 line-clamp-2">{template.description}</p>
                          </div>
                          <Badge className={getTypeColor(template.type)}>
                            {template.type}
                          </Badge>
                        </div>

                        {/* Author and Stats */}
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center space-x-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span>{template.author.name}</span>
                            {template.author.verified && (
                              <Check className="h-3 w-3 text-blue-500" />
                            )}
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-1">
                              <Download className="h-4 w-4 text-gray-400" />
                              <span>{formatNumber(template.downloads)}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Heart className="h-4 w-4 text-gray-400" />
                              <span>{formatNumber(template.likes)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Rating */}
                        <div className="flex items-center space-x-2">
                          <div className="flex">{getRatingStars(template.rating)}</div>
                          <span className="text-sm text-gray-600">
                            {template.rating.toFixed(1)} ({formatNumber(template.downloads)} downloads)
                          </span>
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-1">
                          {template.tags.slice(0, 3).map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {template.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{template.tags.length - 3}
                            </Badge>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex space-x-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePreview(template)}
                            className="flex-1"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Preview
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleUseTemplate(template)}
                            className="flex-1"
                          >
                            Use Template
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {!loading && filteredTemplates.length === 0 && (
              <div className="text-center py-12">
                <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
                <p className="text-gray-600">Try adjusting your search or filters</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          {selectedTemplate && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{selectedTemplate.name}</span>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyTemplate(selectedTemplate)}
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(selectedTemplate.downloadUrl, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </DialogTitle>
                <DialogDescription>
                  by {selectedTemplate.author.name} • v{selectedTemplate.version}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Details</h4>
                    <div className="space-y-2 text-sm">
                      <p><strong>Type:</strong> {selectedTemplate.type}</p>
                      <p><strong>Version:</strong> {selectedTemplate.version}</p>
                      <p><strong>Last Updated:</strong> {selectedTemplate.lastUpdated}</p>
                      <p><strong>Downloads:</strong> {selectedTemplate.downloads.toLocaleString()}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Compatibility</h4>
                    <div className="space-y-1">
                      {selectedTemplate.compatibility.map(item => (
                        <Badge key={item} variant="outline" className="text-xs">
                          {item}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Template Preview</h4>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto max-h-64">
                    <pre>{selectedTemplate.template.substring(0, 500)}...</pre>
                  </div>
                </div>

                {selectedTemplate.examples && selectedTemplate.examples.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Usage Examples</h4>
                    <div className="space-y-2">
                      {selectedTemplate.examples.map((example, index) => (
                        <div key={index} className="border rounded p-3">
                          <h5 className="font-medium">{example.name}</h5>
                          <p className="text-sm text-gray-600">{example.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                  Close
                </Button>
                <Button onClick={() => {
                  handleUseTemplate(selectedTemplate)
                  setPreviewOpen(false)
                }}>
                  Use This Template
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}