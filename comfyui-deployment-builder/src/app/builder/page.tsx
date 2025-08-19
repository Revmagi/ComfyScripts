'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  ChevronLeft,
  ChevronRight,
  Check,
  Eye,
  Plus,
  X,
  AlertTriangle,
  CheckCircle,
  Info,
  Download,
  FileCode
} from 'lucide-react'
import { ScriptExportDialog } from '@/components/script-export-dialog'

// Helper Components
interface PackageAdderProps {
  onAddPackage: (pkg: { type: 'apt' | 'pip'; name: string; version?: string }) => void
}

function PackageAdder({ onAddPackage }: PackageAdderProps) {
  const [packageType, setPackageType] = useState<'apt' | 'pip'>('pip')
  const [packageName, setPackageName] = useState('')
  const [packageVersion, setPackageVersion] = useState('')

  const handleAdd = () => {
    if (!packageName.trim()) return
    
    onAddPackage({
      type: packageType,
      name: packageName.trim(),
      version: packageVersion.trim() || undefined
    })
    
    setPackageName('')
    setPackageVersion('')
  }

  return (
    <div className="border-t pt-6">
      <h4 className="font-medium mb-3">Add Custom Package</h4>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Select value={packageType} onValueChange={(value: 'apt' | 'pip') => setPackageType(value)}>
          <SelectTrigger>
            <SelectValue placeholder="Package type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pip">Python (pip)</SelectItem>
            <SelectItem value="apt">System (apt)</SelectItem>
          </SelectContent>
        </Select>
        <Input 
          placeholder="Package name" 
          value={packageName}
          onChange={(e) => setPackageName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
        />
        <div className="flex space-x-2">
          <Input 
            placeholder="Version (optional)" 
            className="flex-1" 
            value={packageVersion}
            onChange={(e) => setPackageVersion(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button size="sm" onClick={handleAdd} disabled={!packageName.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

interface EnvironmentVariableManagerProps {
  environmentVars: Record<string, string>
  onUpdateEnvironmentVars: (vars: Record<string, string>) => void
}

function EnvironmentVariableManager({ environmentVars, onUpdateEnvironmentVars }: EnvironmentVariableManagerProps) {
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')

  const handleAdd = () => {
    if (!newKey.trim() || !newValue.trim()) return
    
    onUpdateEnvironmentVars({
      ...environmentVars,
      [newKey.trim()]: newValue.trim()
    })
    
    setNewKey('')
    setNewValue('')
  }

  const handleUpdate = (key: string, value: string) => {
    onUpdateEnvironmentVars({
      ...environmentVars,
      [key]: value
    })
  }

  const handleRemove = (key: string) => {
    const { [key]: _removed, ...rest } = environmentVars
    onUpdateEnvironmentVars(rest)
  }

  return (
    <div>
      <h4 className="font-medium mb-3">Environment Variables</h4>
      <div className="space-y-3">
        {Object.entries(environmentVars).map(([key, value]) => (
          <div key={key} className="flex space-x-2">
            <Input 
              value={key} 
              placeholder="Variable name" 
              className="flex-1" 
              readOnly 
            />
            <Input 
              value={value} 
              placeholder="Variable value" 
              className="flex-1"
              onChange={(e) => handleUpdate(key, e.target.value)}
            />
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => handleRemove(key)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <div className="flex space-x-2">
          <Input 
            placeholder="Variable name" 
            className="flex-1" 
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Input 
            placeholder="Variable value" 
            className="flex-1"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button 
            size="sm"
            onClick={handleAdd}
            disabled={!newKey.trim() || !newValue.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

interface DeploymentConfig {
  basic: {
    name: string
    description: string
    scriptType: 'runpod' | 'docker' | 'local'
    isTemplate: boolean
    isPublic: boolean
    templateCategory?: string
  }
  models: Array<{
    id: string
    name: string
    type: string
    source: string
    targetPath: string
    enabled: boolean
  }>
  customNodes: Array<{
    id: string
    name: string
    githubUrl: string
    author: string
    enabled: boolean
  }>
  systemPackages: Array<{
    type: 'apt' | 'pip'
    name: string
    version?: string
  }>
  environmentVars: Record<string, string>
  customSettings: {
    pythonVersion?: string
    cudaVersion?: string
    workspacePath?: string
    memoryLimit?: string
    enableOptimization?: boolean
  }
}

interface AvailableModel {
  id: string
  name: string
  type: string
  source: string
  baseModel?: string
  fileSize?: string
  isVerified: boolean
}

interface AvailableNode {
  id: string
  name: string
  githubUrl: string
  author: string
  description?: string
  tags: string[]
  isVerified: boolean
}

interface DependencyIssue {
  type: 'conflict' | 'missing' | 'warning'
  message: string
  affectedItems: string[]
  suggestion?: string
}

const WIZARD_STEPS = [
  { id: 'basic', title: 'Basic Info', description: 'Deployment name and configuration' },
  { id: 'models', title: 'Models', description: 'Select AI models for your deployment' },
  { id: 'nodes', title: 'Custom Nodes', description: 'Choose ComfyUI custom nodes' },
  { id: 'packages', title: 'System Packages', description: 'Configure system dependencies' },
  { id: 'environment', title: 'Environment', description: 'Set environment variables and settings' },
  { id: 'review', title: 'Review', description: 'Review and create deployment' }
]

export default function DeploymentBuilder() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [config, setConfig] = useState<DeploymentConfig>({
    basic: {
      name: '',
      description: '',
      scriptType: 'runpod',
      isTemplate: false,
      isPublic: false
    },
    models: [],
    customNodes: [],
    systemPackages: [],
    environmentVars: {},
    customSettings: {}
  })

  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([])
  const [availableNodes, setAvailableNodes] = useState<AvailableNode[]>([])
  const [dependencyIssues, setDependencyIssues] = useState<DependencyIssue[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [draggedItem, setDraggedItem] = useState<{ type: 'model' | 'node'; id: string } | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [scriptExportOpen, setScriptExportOpen] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    } else if (session) {
      loadAvailableComponents()
    }
  }, [status, router, session])

  useEffect(() => {
    // Check dependencies whenever models or nodes change
    checkDependencies()
  }, [config.models, config.customNodes])

  useEffect(() => {
    // Clear validation errors when configuration changes
    if (validationErrors.length > 0) {
      setValidationErrors([])
    }
  }, [config])

  const loadAvailableComponents = async () => {
    setIsLoading(true)
    try {
      // Simulate loading available models and nodes
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setAvailableModels([
        {
          id: '1',
          name: 'SDXL Base 1.0',
          type: 'CHECKPOINT',
          source: 'HUGGINGFACE',
          baseModel: 'SDXL 1.0',
          fileSize: '6.94 GB',
          isVerified: true
        },
        {
          id: '2',
          name: 'Realistic Vision V5.1',
          type: 'CHECKPOINT',
          source: 'CIVITAI',
          baseModel: 'SD 1.5',
          fileSize: '2.13 GB',
          isVerified: true
        },
        {
          id: '3',
          name: 'ControlNet Canny',
          type: 'CONTROLNET',
          source: 'HUGGINGFACE',
          baseModel: 'SD 1.5',
          fileSize: '1.44 GB',
          isVerified: true
        },
        {
          id: '4',
          name: 'LCM LoRA SDXL',
          type: 'LORA',
          source: 'HUGGINGFACE',
          baseModel: 'SDXL 1.0',
          fileSize: '134 MB',
          isVerified: true
        }
      ])

      setAvailableNodes([
        {
          id: '1',
          name: 'ComfyUI-Manager',
          githubUrl: 'https://github.com/ltdrdata/ComfyUI-Manager',
          author: 'ltdrdata',
          description: 'ComfyUI extension for managing custom nodes',
          tags: ['management', 'utility'],
          isVerified: true
        },
        {
          id: '2',
          name: 'ComfyUI-Advanced-ControlNet',
          githubUrl: 'https://github.com/Fannovel16/comfyui_controlnet_aux',
          author: 'Fannovel16',
          description: 'Advanced ControlNet preprocessing nodes',
          tags: ['controlnet', 'preprocessing'],
          isVerified: true
        },
        {
          id: '3',
          name: 'ComfyUI-AnimateDiff-Evolved',
          githubUrl: 'https://github.com/Kosinkadink/ComfyUI-AnimateDiff-Evolved',
          author: 'Kosinkadink',
          description: 'Enhanced AnimateDiff implementation',
          tags: ['animation', 'video'],
          isVerified: false
        }
      ])
    } catch (error) {
      console.error('Failed to load components:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const checkDependencies = () => {
    const issues: DependencyIssue[] = []
    
    // Check for conflicting base models
    const baseModels = config.models
      .filter(m => m.enabled)
      .map(m => availableModels.find(am => am.id === m.id)?.baseModel)
      .filter(Boolean)
    
    const uniqueBaseModels = [...new Set(baseModels)]
    if (uniqueBaseModels.length > 1) {
      issues.push({
        type: 'warning',
        message: 'Multiple base models detected. This may cause compatibility issues.',
        affectedItems: uniqueBaseModels,
        suggestion: 'Consider using models from the same base model family.'
      })
    }

    // Check for missing ControlNet requirements
    const hasControlNet = config.models.some(m => 
      m.enabled && availableModels.find(am => am.id === m.id)?.type === 'CONTROLNET'
    )
    const hasControlNetNode = config.customNodes.some(n => 
      n.enabled && availableNodes.find(an => an.id === n.id)?.tags.includes('controlnet')
    )
    
    if (hasControlNet && !hasControlNetNode) {
      issues.push({
        type: 'missing',
        message: 'ControlNet models require ControlNet custom nodes.',
        affectedItems: ['ControlNet models'],
        suggestion: 'Add ComfyUI-Advanced-ControlNet or similar node.'
      })
    }

    // Check for system package conflicts
    const pipPackages = config.systemPackages.filter(p => p.type === 'pip')
    const conflictingPackages = pipPackages.filter(p => 
      pipPackages.some(other => other.name === p.name && other.version !== p.version)
    )
    
    if (conflictingPackages.length > 0) {
      issues.push({
        type: 'conflict',
        message: 'Conflicting package versions detected.',
        affectedItems: conflictingPackages.map(p => `${p.name}${p.version ? `@${p.version}` : ''}`),
        suggestion: 'Resolve version conflicts or remove duplicate packages.'
      })
    }

    setDependencyIssues(issues)
  }

  const handleNext = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleAddModel = (modelId: string) => {
    const model = availableModels.find(m => m.id === modelId)
    if (!model) return

    const newModel = {
      id: model.id,
      name: model.name,
      type: model.type,
      source: model.source,
      targetPath: getDefaultTargetPath(model.type),
      enabled: true
    }

    setConfig(prev => ({
      ...prev,
      models: [...prev.models, newModel]
    }))
  }

  const handleRemoveModel = (modelId: string) => {
    setConfig(prev => ({
      ...prev,
      models: prev.models.filter(m => m.id !== modelId)
    }))
  }

  const handleAddNode = (nodeId: string) => {
    const node = availableNodes.find(n => n.id === nodeId)
    if (!node) return

    const newNode = {
      id: node.id,
      name: node.name,
      githubUrl: node.githubUrl,
      author: node.author,
      enabled: true
    }

    setConfig(prev => ({
      ...prev,
      customNodes: [...prev.customNodes, newNode]
    }))
  }

  const handleRemoveNode = (nodeId: string) => {
    setConfig(prev => ({
      ...prev,
      customNodes: prev.customNodes.filter(n => n.id !== nodeId)
    }))
  }

  const getDefaultTargetPath = (type: string): string => {
    const pathMap: Record<string, string> = {
      'CHECKPOINT': 'models/checkpoints',
      'LORA': 'models/loras',
      'CONTROLNET': 'models/controlnet',
      'VAE': 'models/vae',
      'UPSCALER': 'models/upscale_models',
      'EMBEDDING': 'embeddings'
    }
    return pathMap[type] || 'models/other'
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'CHECKPOINT': 'bg-blue-100 text-blue-800',
      'LORA': 'bg-green-100 text-green-800',
      'CONTROLNET': 'bg-purple-100 text-purple-800',
      'VAE': 'bg-orange-100 text-orange-800',
      'UPSCALER': 'bg-pink-100 text-pink-800',
      'EMBEDDING': 'bg-yellow-100 text-yellow-800'
    }
    return colors[type] || 'bg-gray-100 text-gray-800'
  }

  const validateConfiguration = (): string[] => {
    const errors: string[] = []

    // Basic validation
    if (!config.basic.name.trim()) {
      errors.push('Deployment name is required')
    }

    if (config.basic.name.length > 50) {
      errors.push('Deployment name must be 50 characters or less')
    }

    if (config.basic.isTemplate && !config.basic.templateCategory) {
      errors.push('Template category is required when saving as template')
    }

    // Model validation
    const enabledModels = config.models.filter(m => m.enabled)
    if (enabledModels.length === 0) {
      errors.push('At least one model must be selected and enabled')
    }

    // Check for duplicate target paths with same type
    const pathTypeMap = new Map<string, string[]>()
    enabledModels.forEach(model => {
      const key = model.targetPath
      if (!pathTypeMap.has(key)) {
        pathTypeMap.set(key, [])
      }
      pathTypeMap.get(key)!.push(model.name)
    })

    pathTypeMap.forEach((models, path) => {
      if (models.length > 1) {
        errors.push(`Multiple models targeting same path (${path}): ${models.join(', ')}`)
      }
    })

    // System package validation
    const packageNames = config.systemPackages.map(p => p.name)
    const duplicatePackages = packageNames.filter((name, index) => packageNames.indexOf(name) !== index)
    if (duplicatePackages.length > 0) {
      errors.push(`Duplicate system packages: ${[...new Set(duplicatePackages)].join(', ')}`)
    }

    // Environment variable validation
    Object.entries(config.environmentVars).forEach(([key, value]) => {
      if (!key.trim()) {
        errors.push('Environment variable names cannot be empty')
      }
      if (key.includes(' ')) {
        errors.push(`Environment variable name "${key}" contains spaces`)
      }
      if (!value.trim()) {
        errors.push(`Environment variable "${key}" has empty value`)
      }
    })

    return errors
  }

  const handleCreateDeployment = async () => {
    const errors = validateConfiguration()
    setValidationErrors(errors)

    if (errors.length > 0) {
      return
    }

    setIsLoading(true)
    try {
      // Simulate deployment creation API call
      const response = await fetch('/api/deployments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      })

      if (!response.ok) {
        throw new Error('Failed to create deployment')
      }

      const deployment = await response.json()
      console.log('Created deployment:', deployment)
      router.push('/dashboard')
    } catch (error) {
      console.error('Failed to create deployment:', error)
      setValidationErrors(['Failed to create deployment. Please try again.'])
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  if (!session) {
    return null
  }

  const filteredModels = availableModels.filter(model => {
    const matchesSearch = model.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = !selectedFilter || selectedFilter === 'all' || model.type === selectedFilter || model.source === selectedFilter
    const notAlreadyAdded = !config.models.some(m => m.id === model.id)
    return matchesSearch && matchesFilter && notAlreadyAdded
  })

  const filteredNodes = availableNodes.filter(node => {
    const matchesSearch = node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         node.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFilter = !selectedFilter || selectedFilter === 'all' || node.tags.includes(selectedFilter.toLowerCase())
    const notAlreadyAdded = !config.customNodes.some(n => n.id === node.id)
    return matchesSearch && matchesFilter && notAlreadyAdded
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Deployment Builder</h1>
              <p className="text-gray-600">Create a new ComfyUI deployment configuration</p>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                onClick={() => setIsPreviewOpen(true)}
                disabled={!config.basic.name}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button
                variant="outline"
                onClick={() => setScriptExportOpen(true)}
                disabled={!config.basic.name}
              >
                <FileCode className="h-4 w-4 mr-2" />
                Export Script
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center py-4">
            {WIZARD_STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex items-center">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${index < currentStep ? 'bg-green-500 text-white' : 
                      index === currentStep ? 'bg-blue-500 text-white' : 
                      'bg-gray-200 text-gray-600'}
                  `}>
                    {index < currentStep ? <Check className="h-4 w-4" /> : index + 1}
                  </div>
                  <div className="ml-3">
                    <p className={`text-sm font-medium ${
                      index <= currentStep ? 'text-gray-900' : 'text-gray-500'
                    }`}>
                      {step.title}
                    </p>
                    <p className="text-xs text-gray-500">{step.description}</p>
                  </div>
                </div>
                {index < WIZARD_STEPS.length - 1 && (
                  <div className={`
                    ml-8 w-8 h-0.5 
                    ${index < currentStep ? 'bg-green-500' : 'bg-gray-200'}
                  `} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Step 0: Basic Info */}
            {currentStep === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                  <CardDescription>
                    Configure the basic settings for your deployment
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="name">Deployment Name *</Label>
                      <Input
                        id="name"
                        placeholder="My ComfyUI Deployment"
                        value={config.basic.name}
                        onChange={(e) => setConfig(prev => ({
                          ...prev,
                          basic: { ...prev.basic, name: e.target.value }
                        }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="scriptType">Deployment Type</Label>
                      <Select 
                        value={config.basic.scriptType} 
                        onValueChange={(value: 'runpod' | 'docker' | 'local') => 
                          setConfig(prev => ({
                            ...prev,
                            basic: { ...prev.basic, scriptType: value }
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="runpod">RunPod</SelectItem>
                          <SelectItem value="docker">Docker</SelectItem>
                          <SelectItem value="local">Local Setup</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe your deployment configuration..."
                      value={config.basic.description}
                      onChange={(e) => setConfig(prev => ({
                        ...prev,
                        basic: { ...prev.basic, description: e.target.value }
                      }))}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="isTemplate"
                        checked={config.basic.isTemplate}
                        onCheckedChange={(checked) => setConfig(prev => ({
                          ...prev,
                          basic: { ...prev.basic, isTemplate: checked }
                        }))}
                      />
                      <Label htmlFor="isTemplate">Save as Template</Label>
                    </div>
                    
                    {config.basic.isTemplate && (
                      <>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="isPublic"
                            checked={config.basic.isPublic}
                            onCheckedChange={(checked) => setConfig(prev => ({
                              ...prev,
                              basic: { ...prev.basic, isPublic: checked }
                            }))}
                          />
                          <Label htmlFor="isPublic">Make Template Public</Label>
                        </div>
                        
                        <div>
                          <Label htmlFor="templateCategory">Template Category</Label>
                          <Select 
                            value={config.basic.templateCategory || ''} 
                            onValueChange={(value) => setConfig(prev => ({
                              ...prev,
                              basic: { ...prev.basic, templateCategory: value }
                            }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="art">Art & Design</SelectItem>
                              <SelectItem value="photography">Photography</SelectItem>
                              <SelectItem value="animation">Animation</SelectItem>
                              <SelectItem value="utility">Utility</SelectItem>
                              <SelectItem value="experimental">Experimental</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 1: Models */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Select Models</CardTitle>
                    <CardDescription>
                      Choose AI models for your deployment
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex space-x-4 mb-6">
                      <div className="flex-1">
                        <Input
                          placeholder="Search models..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Filter by type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="CHECKPOINT">Checkpoints</SelectItem>
                          <SelectItem value="LORA">LoRAs</SelectItem>
                          <SelectItem value="CONTROLNET">ControlNet</SelectItem>
                          <SelectItem value="VAE">VAE</SelectItem>
                          <SelectItem value="CIVITAI">CivitAI</SelectItem>
                          <SelectItem value="HUGGINGFACE">HuggingFace</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredModels.map(model => (
                        <Card key={model.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h3 className="font-medium truncate">{model.name}</h3>
                                <div className="flex items-center space-x-2 mt-1">
                                  <Badge className={getTypeColor(model.type)}>
                                    {model.type}
                                  </Badge>
                                  <Badge variant="outline">{model.source}</Badge>
                                  {model.isVerified && (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                  )}
                                </div>
                                <p className="text-sm text-gray-500 mt-1">
                                  {model.baseModel} • {model.fileSize}
                                </p>
                              </div>
                              <Button 
                                size="sm" 
                                onClick={() => handleAddModel(model.id)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Selected Models */}
                {config.models.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Selected Models ({config.models.length})</CardTitle>
                      <CardDescription>Drag to reorder models</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {config.models.map((model, index) => (
                          <div 
                            key={model.id} 
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-move"
                            draggable
                            onDragStart={() => setDraggedItem({ type: 'model', id: model.id })}
                            onDragEnd={() => setDraggedItem(null)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault()
                              if (draggedItem?.type === 'model' && draggedItem.id !== model.id) {
                                const draggedIndex = config.models.findIndex(m => m.id === draggedItem.id)
                                const targetIndex = index
                                const newModels = [...config.models]
                                const [draggedModel] = newModels.splice(draggedIndex, 1)
                                newModels.splice(targetIndex, 0, draggedModel)
                                setConfig(prev => ({ ...prev, models: newModels }))
                              }
                            }}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-2 h-6 bg-gray-300 rounded cursor-grab active:cursor-grabbing"></div>
                              <Switch
                                checked={model.enabled}
                                onCheckedChange={(checked) => setConfig(prev => ({
                                  ...prev,
                                  models: prev.models.map(m => 
                                    m.id === model.id ? { ...m, enabled: checked } : m
                                  )
                                }))}
                              />
                              <div>
                                <p className="font-medium">{model.name}</p>
                                <div className="flex items-center space-x-2">
                                  <Badge className={getTypeColor(model.type)} size="sm">
                                    {model.type}
                                  </Badge>
                                  <span className="text-sm text-gray-500">{model.targetPath}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Select
                                value={model.targetPath}
                                onValueChange={(value) => setConfig(prev => ({
                                  ...prev,
                                  models: prev.models.map(m => 
                                    m.id === model.id ? { ...m, targetPath: value } : m
                                  )
                                }))}
                              >
                                <SelectTrigger className="w-48">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="models/checkpoints">models/checkpoints</SelectItem>
                                  <SelectItem value="models/loras">models/loras</SelectItem>
                                  <SelectItem value="models/controlnet">models/controlnet</SelectItem>
                                  <SelectItem value="models/vae">models/vae</SelectItem>
                                  <SelectItem value="models/upscale_models">models/upscale_models</SelectItem>
                                  <SelectItem value="embeddings">embeddings</SelectItem>
                                  <SelectItem value="models/other">models/other</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleRemoveModel(model.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Step 2: Custom Nodes */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Select Custom Nodes</CardTitle>
                    <CardDescription>
                      Choose ComfyUI custom nodes and extensions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex space-x-4 mb-6">
                      <div className="flex-1">
                        <Input
                          placeholder="Search nodes..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Filter by tag" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Tags</SelectItem>
                          <SelectItem value="management">Management</SelectItem>
                          <SelectItem value="controlnet">ControlNet</SelectItem>
                          <SelectItem value="animation">Animation</SelectItem>
                          <SelectItem value="utility">Utility</SelectItem>
                          <SelectItem value="preprocessing">Preprocessing</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      {filteredNodes.map(node => (
                        <Card key={node.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <h3 className="font-medium">{node.name}</h3>
                                  {node.isVerified && (
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                  )}
                                </div>
                                <p className="text-sm text-gray-600 mt-1">by {node.author}</p>
                                {node.description && (
                                  <p className="text-sm text-gray-500 mt-2">{node.description}</p>
                                )}
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {node.tags.map(tag => (
                                    <Badge key={tag} variant="secondary" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <Button 
                                size="sm" 
                                onClick={() => handleAddNode(node.id)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Selected Nodes */}
                {config.customNodes.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Selected Custom Nodes ({config.customNodes.length})</CardTitle>
                      <CardDescription>Drag to reorder nodes (installation order)</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {config.customNodes.map((node, index) => (
                          <div 
                            key={node.id} 
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-move"
                            draggable
                            onDragStart={() => setDraggedItem({ type: 'node', id: node.id })}
                            onDragEnd={() => setDraggedItem(null)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault()
                              if (draggedItem?.type === 'node' && draggedItem.id !== node.id) {
                                const draggedIndex = config.customNodes.findIndex(n => n.id === draggedItem.id)
                                const targetIndex = index
                                const newNodes = [...config.customNodes]
                                const [draggedNode] = newNodes.splice(draggedIndex, 1)
                                newNodes.splice(targetIndex, 0, draggedNode)
                                setConfig(prev => ({ ...prev, customNodes: newNodes }))
                              }
                            }}
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-2 h-6 bg-gray-300 rounded cursor-grab active:cursor-grabbing"></div>
                              <Switch
                                checked={node.enabled}
                                onCheckedChange={(checked) => setConfig(prev => ({
                                  ...prev,
                                  customNodes: prev.customNodes.map(n => 
                                    n.id === node.id ? { ...n, enabled: checked } : n
                                  )
                                }))}
                              />
                              <div>
                                <p className="font-medium">{node.name}</p>
                                <p className="text-sm text-gray-500">by {node.author}</p>
                              </div>
                            </div>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleRemoveNode(node.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Step 3: System Packages */}
            {currentStep === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle>System Packages</CardTitle>
                  <CardDescription>
                    Configure system dependencies and packages
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-sm text-gray-600">
                    <p>System packages are automatically determined based on your selected models and custom nodes.</p>
                    <p className="mt-2">You can add additional packages if needed:</p>
                  </div>

                  {config.systemPackages.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">Configured Packages</h4>
                      <div className="space-y-2">
                        {config.systemPackages.map((pkg, index) => (
                          <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span className="text-sm">
                              {pkg.type}: {pkg.name}{pkg.version && `@${pkg.version}`}
                            </span>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setConfig(prev => ({
                                ...prev,
                                systemPackages: prev.systemPackages.filter((_, i) => i !== index)
                              }))}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <PackageAdder
                    onAddPackage={(pkg) => setConfig(prev => ({
                      ...prev,
                      systemPackages: [...prev.systemPackages, pkg]
                    }))}
                  />
                </CardContent>
              </Card>
            )}

            {/* Step 4: Environment */}
            {currentStep === 4 && (
              <Card>
                <CardHeader>
                  <CardTitle>Environment Configuration</CardTitle>
                  <CardDescription>
                    Set environment variables and custom settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-3">Custom Settings</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="pythonVersion">Python Version</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Python version" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3.8">Python 3.8</SelectItem>
                            <SelectItem value="3.9">Python 3.9</SelectItem>
                            <SelectItem value="3.10">Python 3.10</SelectItem>
                            <SelectItem value="3.11">Python 3.11</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="cudaVersion">CUDA Version</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select CUDA version" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="11.8">CUDA 11.8</SelectItem>
                            <SelectItem value="12.0">CUDA 12.0</SelectItem>
                            <SelectItem value="12.1">CUDA 12.1</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="workspacePath">Workspace Path</Label>
                        <Input 
                          id="workspacePath"
                          placeholder="/workspace/ComfyUI"
                          value={config.customSettings.workspacePath || ''}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            customSettings: { ...prev.customSettings, workspacePath: e.target.value }
                          }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="memoryLimit">Memory Limit</Label>
                        <Input 
                          id="memoryLimit"
                          placeholder="8G"
                          value={config.customSettings.memoryLimit || ''}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            customSettings: { ...prev.customSettings, memoryLimit: e.target.value }
                          }))}
                        />
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="enableOptimization"
                          checked={config.customSettings.enableOptimization || false}
                          onCheckedChange={(checked) => setConfig(prev => ({
                            ...prev,
                            customSettings: { ...prev.customSettings, enableOptimization: checked }
                          }))}
                        />
                        <Label htmlFor="enableOptimization">Enable Performance Optimizations</Label>
                      </div>
                    </div>
                  </div>

                  <EnvironmentVariableManager
                    environmentVars={config.environmentVars}
                    onUpdateEnvironmentVars={(vars) => setConfig(prev => ({
                      ...prev,
                      environmentVars: vars
                    }))}
                  />
                </CardContent>
              </Card>
            )}

            {/* Step 5: Review */}
            {currentStep === 5 && (
              <Card>
                <CardHeader>
                  <CardTitle>Review Configuration</CardTitle>
                  <CardDescription>
                    Review your deployment configuration before creating
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-2">Basic Information</h4>
                      <div className="space-y-1 text-sm">
                        <p><span className="font-medium">Name:</span> {config.basic.name}</p>
                        <p><span className="font-medium">Type:</span> {config.basic.scriptType}</p>
                        <p><span className="font-medium">Template:</span> {config.basic.isTemplate ? 'Yes' : 'No'}</p>
                        {config.basic.description && (
                          <p><span className="font-medium">Description:</span> {config.basic.description}</p>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2">Components Summary</h4>
                      <div className="space-y-1 text-sm">
                        <p><span className="font-medium">Models:</span> {config.models.filter(m => m.enabled).length}</p>
                        <p><span className="font-medium">Custom Nodes:</span> {config.customNodes.filter(n => n.enabled).length}</p>
                        <p><span className="font-medium">System Packages:</span> {config.systemPackages.length}</p>
                        <p><span className="font-medium">Environment Variables:</span> {Object.keys(config.environmentVars).length}</p>
                      </div>
                    </div>
                  </div>

                  {config.models.filter(m => m.enabled).length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Selected Models</h4>
                      <div className="space-y-2">
                        {config.models.filter(m => m.enabled).map(model => (
                          <div key={model.id} className="flex items-center space-x-2 text-sm">
                            <Badge className={getTypeColor(model.type)} size="sm">
                              {model.type}
                            </Badge>
                            <span>{model.name}</span>
                            <span className="text-gray-500">→ {model.targetPath}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {config.customNodes.filter(n => n.enabled).length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Selected Custom Nodes</h4>
                      <div className="space-y-2">
                        {config.customNodes.filter(n => n.enabled).map(node => (
                          <div key={node.id} className="text-sm">
                            <span className="font-medium">{node.name}</span>
                            <span className="text-gray-500 ml-2">by {node.author}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(dependencyIssues.length > 0 || validationErrors.length > 0) && (
                    <div>
                      <h4 className="font-medium mb-2 text-orange-600">
                        {dependencyIssues.length > 0 && validationErrors.length > 0 
                          ? 'Issues & Validation Errors'
                          : dependencyIssues.length > 0 
                          ? 'Dependency Issues' 
                          : 'Validation Errors'
                        }
                      </h4>
                      <div className="space-y-2">
                        {validationErrors.map((error, index) => (
                          <div key={`error-${index}`} className="p-3 rounded-lg border bg-red-50 border-red-200">
                            <div className="flex items-start space-x-2">
                              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-red-700">{error}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                        {dependencyIssues.map((issue, index) => (
                          <div key={`issue-${index}`} className={`p-3 rounded-lg border ${
                            issue.type === 'conflict' ? 'bg-red-50 border-red-200' :
                            issue.type === 'missing' ? 'bg-yellow-50 border-yellow-200' :
                            'bg-blue-50 border-blue-200'
                          }`}>
                            <div className="flex items-start space-x-2">
                              {issue.type === 'conflict' && <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />}
                              {issue.type === 'missing' && <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />}
                              {issue.type === 'warning' && <Info className="h-4 w-4 text-blue-500 mt-0.5" />}
                              <div className="flex-1">
                                <p className="text-sm font-medium">{issue.message}</p>
                                {issue.suggestion && (
                                  <p className="text-xs text-gray-600 mt-1">{issue.suggestion}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Current Step Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{WIZARD_STEPS[currentStep].title}</CardTitle>
                <CardDescription>{WIZARD_STEPS[currentStep].description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {currentStep === 1 && (
                    <div>
                      <p className="text-sm text-gray-600 mb-2">Selected: {config.models.length} models</p>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline" onClick={() => router.push('/admin/models/civitai')}>
                          Browse CivitAI
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => router.push('/admin/models/huggingface')}>
                          Browse HuggingFace
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {currentStep === 2 && (
                    <div>
                      <p className="text-sm text-gray-600">Selected: {config.customNodes.length} nodes</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Dependency Status */}
            {dependencyIssues.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2 text-orange-500" />
                    Dependencies
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {dependencyIssues.map((issue, index) => (
                      <div key={index} className={`text-xs p-2 rounded ${
                        issue.type === 'conflict' ? 'bg-red-100 text-red-700' :
                        issue.type === 'missing' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {issue.message}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Progress Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Basic Info</span>
                    <span>{config.basic.name ? '✓' : '○'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Models</span>
                    <span>{config.models.length > 0 ? `✓ (${config.models.length})` : '○'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Custom Nodes</span>
                    <span>{config.customNodes.length > 0 ? `✓ (${config.customNodes.length})` : '○'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Packages</span>
                    <span>{config.systemPackages.length > 0 ? `✓ (${config.systemPackages.length})` : '○'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Environment</span>
                    <span>{Object.keys(config.environmentVars).length > 0 ? '✓' : '○'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          
          {currentStep < WIZARD_STEPS.length - 1 ? (
            <Button
              onClick={handleNext}
              disabled={currentStep === 0 && !config.basic.name}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleCreateDeployment}
              disabled={!config.basic.name || isLoading || validationErrors.length > 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? 'Creating...' : 'Create Deployment'}
              <Download className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Deployment Preview</DialogTitle>
            <DialogDescription>
              Preview your deployment configuration and generated script
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Configuration Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Configuration Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Basic Info</h4>
                    <div className="text-sm space-y-1">
                      <p><strong>Name:</strong> {config.basic.name}</p>
                      <p><strong>Type:</strong> {config.basic.scriptType}</p>
                      <p><strong>Template:</strong> {config.basic.isTemplate ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Components</h4>
                    <div className="text-sm space-y-1">
                      <p><strong>Models:</strong> {config.models.filter(m => m.enabled).length} selected</p>
                      <p><strong>Custom Nodes:</strong> {config.customNodes.filter(n => n.enabled).length} selected</p>
                      <p><strong>System Packages:</strong> {config.systemPackages.length}</p>
                      <p><strong>Environment Variables:</strong> {Object.keys(config.environmentVars).length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Script Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs font-mono overflow-x-auto">
                    <div className="space-y-1">
                      <div># {config.basic.scriptType.toUpperCase()} Deployment Script</div>
                      <div># Generated for: {config.basic.name}</div>
                      <div></div>
                      
                      {config.basic.scriptType === 'docker' && (
                        <>
                          <div>FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-devel</div>
                          <div>WORKDIR /workspace</div>
                          <div></div>
                        </>
                      )}
                      
                      <div># Install system packages</div>
                      {config.systemPackages.filter(p => p.type === 'apt').map(pkg => (
                        <div key={pkg.name}>RUN apt-get update && apt-get install -y {pkg.name}</div>
                      ))}
                      
                      <div></div>
                      <div># Install ComfyUI</div>
                      <div>RUN git clone https://github.com/comfyanonymous/ComfyUI.git</div>
                      <div>WORKDIR /workspace/ComfyUI</div>
                      
                      <div></div>
                      <div># Install Python packages</div>
                      <div>RUN pip install -r requirements.txt</div>
                      {config.systemPackages.filter(p => p.type === 'pip').map(pkg => (
                        <div key={pkg.name}>RUN pip install {pkg.name}{pkg.version ? `==${pkg.version}` : ''}</div>
                      ))}
                      
                      <div></div>
                      <div># Install custom nodes</div>
                      <div>WORKDIR /workspace/ComfyUI/custom_nodes</div>
                      {config.customNodes.filter(n => n.enabled).map(node => (
                        <div key={node.id}>RUN git clone {node.githubUrl}</div>
                      ))}
                      
                      <div></div>
                      <div># Download models</div>
                      {config.models.filter(m => m.enabled).map(model => (
                        <div key={model.id}>RUN wget -O {model.targetPath}/{model.name} [MODEL_URL]</div>
                      ))}
                      
                      {Object.keys(config.environmentVars).length > 0 && (
                        <>
                          <div></div>
                          <div># Set environment variables</div>
                          {Object.entries(config.environmentVars).map(([key, value]) => (
                            <div key={key}>ENV {key}=&quot;{value}&quot;</div>
                          ))}
                        </>
                      )}
                      
                      <div></div>
                      <div>EXPOSE 8188</div>
                      <div>CMD ["python", "main.py", "--listen"]</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Raw Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded-lg text-sm overflow-x-auto max-h-96">
                  {JSON.stringify(config, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Script Export Dialog */}
      <ScriptExportDialog
        open={scriptExportOpen}
        onOpenChange={setScriptExportOpen}
        config={config}
      />
    </div>
  )
}