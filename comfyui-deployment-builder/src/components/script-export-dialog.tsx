'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  FileText,
  Settings,
  Copy,
  Check,
  AlertCircle,
  Info,
  Play,
  Package,
  Monitor,
  Zap
} from 'lucide-react'
import { scriptGenerator, type ScriptGenerationConfig, type ScriptTemplate } from '@/lib/script-generator'
import { GitHubActionsSimple } from '@/components/github-actions-simple'
import { ScriptValidationPanel } from '@/components/script-validation-panel'
import { TemplateMarketplace } from '@/components/template-marketplace'

interface ScriptExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: ScriptGenerationConfig
}

export function ScriptExportDialog({ open, onOpenChange, config }: ScriptExportDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('docker-standard')
  const [customSettings, setCustomSettings] = useState({
    baseImage: 'pytorch/pytorch:2.1.0-cuda12.1-cudnn8-devel',
    port: 8188,
    exposePorts: [] as number[],
    enableHealthCheck: false,
    healthCheckCommand: 'curl -f http://localhost:8188/ || exit 1',
    healthCheckInterval: '30s',
    enableMonitoring: false,
    includeDatabase: false,
    includeRedis: false,
    resourceLimits: {
      memory: '',
      cpus: '',
      gpus: 'all'
    },
    volumes: [] as Array<{ host: string; container: string; mode: 'ro' | 'rw' }>,
    restartPolicy: 'unless-stopped',
    networkMode: 'bridge'
  })
  const [generatedScript, setGeneratedScript] = useState<string>('')
  const [additionalFiles, setAdditionalFiles] = useState<Array<{filename: string, content: string, description: string}>>([])
  const [copied, setCopied] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [githubActionsOpen, setGithubActionsOpen] = useState(false)
  const [marketplaceOpen, setMarketplaceOpen] = useState(false)

  const templates = scriptGenerator.getAvailableTemplates()

  const generateScript = async () => {
    setIsGenerating(true)
    try {
      // Merge config with custom settings
      const enhancedConfig: ScriptGenerationConfig = {
        ...config,
        advanced: {
          ...customSettings,
          healthCheck: {
            enabled: customSettings.enableHealthCheck,
            command: customSettings.healthCheckCommand,
            interval: customSettings.healthCheckInterval,
            timeout: '10s',
            retries: 3
          },
          resourceLimits: customSettings.resourceLimits,
          port: customSettings.port,
          exposePorts: customSettings.exposePorts,
          volumes: customSettings.volumes,
          restartPolicy: customSettings.restartPolicy,
          networkMode: customSettings.networkMode
        }
      }

      const result = scriptGenerator.generateScript(enhancedConfig, selectedTemplate)
      setGeneratedScript(result.content)
      setAdditionalFiles(result.additionalFiles || [])
    } catch (error) {
      console.error('Error generating script:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = async (content: string, filename: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(filename)
      setTimeout(() => setCopied(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDownloadAll = () => {
    if (!generatedScript) return

    const template = templates.find(t => t.id === selectedTemplate)
    const filename = template ? scriptGenerator.getFilename(config, template) : 'deployment-script.sh'

    // Create a zip-like structure with all files
    let allContent = `# ${config.basic.name} Deployment Package\n\n`
    allContent += `## Main Script: ${filename}\n\n\`\`\`\n${generatedScript}\n\`\`\`\n\n`

    additionalFiles.forEach(file => {
      allContent += `## ${file.filename}\n${file.description}\n\n\`\`\`\n${file.content}\n\`\`\`\n\n`
    })

    handleDownload(allContent, `${config.basic.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-deployment-package.md`)
  }

  const addPort = () => {
    const newPort = parseInt(document.querySelector<HTMLInputElement>('#new-port')?.value || '8080')
    if (newPort && !customSettings.exposePorts.includes(newPort)) {
      setCustomSettings(prev => ({
        ...prev,
        exposePorts: [...prev.exposePorts, newPort]
      }))
    }
  }

  const removePort = (port: number) => {
    setCustomSettings(prev => ({
      ...prev,
      exposePorts: prev.exposePorts.filter(p => p !== port)
    }))
  }

  const addVolume = () => {
    const hostPath = document.querySelector<HTMLInputElement>('#volume-host')?.value
    const containerPath = document.querySelector<HTMLInputElement>('#volume-container')?.value
    const mode = document.querySelector<HTMLSelectElement>('#volume-mode')?.value as 'ro' | 'rw'

    if (hostPath && containerPath) {
      setCustomSettings(prev => ({
        ...prev,
        volumes: [...prev.volumes, { host: hostPath, container: containerPath, mode: mode || 'rw' }]
      }))
      
      // Clear inputs
      document.querySelector<HTMLInputElement>('#volume-host')!.value = ''
      document.querySelector<HTMLInputElement>('#volume-container')!.value = ''
    }
  }

  const removeVolume = (index: number) => {
    setCustomSettings(prev => ({
      ...prev,
      volumes: prev.volumes.filter((_, i) => i !== index)
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Deployment Script</DialogTitle>
          <DialogDescription>
            Generate and customize deployment scripts for {config.basic.name}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="configure" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="configure">Configure</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="validate">Validate</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
            <TabsTrigger value="automation">CI/CD</TabsTrigger>
          </TabsList>

          {/* Configuration Tab */}
          <TabsContent value="configure" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Template Selection</CardTitle>
                <CardDescription>Choose the deployment template type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {templates.map(template => (
                    <Card 
                      key={template.id}
                      className={`cursor-pointer transition-all ${
                        selectedTemplate === template.id ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:shadow-md'
                      }`}
                      onClick={() => setSelectedTemplate(template.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start space-x-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                            {template.type === 'DOCKER' && <Package className="h-4 w-4 text-blue-600" />}
                            {template.type === 'RUNPOD' && <Zap className="h-4 w-4 text-green-600" />}
                            {template.type === 'LOCAL' && <Monitor className="h-4 w-4 text-purple-600" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm">{template.name}</h3>
                            <p className="text-xs text-gray-500 mt-1">{template.description}</p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {template.tags.slice(0, 2).map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                <div className="mt-4 pt-4 border-t">
                  <Button 
                    variant="outline" 
                    onClick={() => setMarketplaceOpen(true)}
                    className="w-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Browse Community Templates
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Advanced Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Advanced Settings</CardTitle>
                <CardDescription>Customize deployment configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="baseImage">Base Docker Image</Label>
                    <Input
                      id="baseImage"
                      value={customSettings.baseImage}
                      onChange={(e) => setCustomSettings(prev => ({ ...prev, baseImage: e.target.value }))}
                      placeholder="pytorch/pytorch:2.1.0-cuda12.1-cudnn8-devel"
                    />
                  </div>
                  <div>
                    <Label htmlFor="port">Main Port</Label>
                    <Input
                      id="port"
                      type="number"
                      value={customSettings.port}
                      onChange={(e) => setCustomSettings(prev => ({ ...prev, port: parseInt(e.target.value) }))}
                    />
                  </div>
                </div>

                {/* Additional Ports */}
                <div>
                  <Label>Additional Exposed Ports</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {customSettings.exposePorts.map(port => (
                      <Badge key={port} variant="outline" className="px-3 py-1">
                        {port}
                        <button 
                          onClick={() => removePort(port)}
                          className="ml-2 text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex space-x-2">
                    <Input
                      id="new-port"
                      type="number"
                      placeholder="8080"
                      className="flex-1"
                    />
                    <Button size="sm" onClick={addPort}>Add Port</Button>
                  </div>
                </div>

                {/* Resource Limits */}
                <div>
                  <h4 className="font-medium mb-3">Resource Limits</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="memory-limit">Memory Limit</Label>
                      <Input
                        id="memory-limit"
                        value={customSettings.resourceLimits.memory}
                        onChange={(e) => setCustomSettings(prev => ({
                          ...prev,
                          resourceLimits: { ...prev.resourceLimits, memory: e.target.value }
                        }))}
                        placeholder="8g"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cpu-limit">CPU Limit</Label>
                      <Input
                        id="cpu-limit"
                        value={customSettings.resourceLimits.cpus}
                        onChange={(e) => setCustomSettings(prev => ({
                          ...prev,
                          resourceLimits: { ...prev.resourceLimits, cpus: e.target.value }
                        }))}
                        placeholder="4.0"
                      />
                    </div>
                    <div>
                      <Label htmlFor="gpu-limit">GPU Access</Label>
                      <Select 
                        value={customSettings.resourceLimits.gpus}
                        onValueChange={(value) => setCustomSettings(prev => ({
                          ...prev,
                          resourceLimits: { ...prev.resourceLimits, gpus: value }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All GPUs</SelectItem>
                          <SelectItem value="1">1 GPU</SelectItem>
                          <SelectItem value="2">2 GPUs</SelectItem>
                          <SelectItem value="none">No GPU</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Volume Mounts */}
                <div>
                  <Label>Volume Mounts</Label>
                  <div className="space-y-2 mb-2">
                    {customSettings.volumes.map((volume, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">
                          {volume.host} → {volume.container} ({volume.mode})
                        </span>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => removeVolume(index)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-12 gap-2">
                    <Input
                      id="volume-host"
                      placeholder="Host path"
                      className="col-span-4"
                    />
                    <Input
                      id="volume-container"
                      placeholder="Container path"
                      className="col-span-4"
                    />
                    <Select defaultValue="rw">
                      <SelectTrigger id="volume-mode" className="col-span-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rw">Read/Write</SelectItem>
                        <SelectItem value="ro">Read Only</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={addVolume} className="col-span-2">
                      Add
                    </Button>
                  </div>
                </div>

                {/* Feature Toggles */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="health-check"
                        checked={customSettings.enableHealthCheck}
                        onCheckedChange={(checked) => setCustomSettings(prev => ({ ...prev, enableHealthCheck: checked }))}
                      />
                      <Label htmlFor="health-check">Enable Health Check</Label>
                    </div>
                    
                    {customSettings.enableHealthCheck && (
                      <div className="space-y-2 ml-6">
                        <Input
                          value={customSettings.healthCheckCommand}
                          onChange={(e) => setCustomSettings(prev => ({ ...prev, healthCheckCommand: e.target.value }))}
                          placeholder="Health check command"
                        />
                        <Input
                          value={customSettings.healthCheckInterval}
                          onChange={(e) => setCustomSettings(prev => ({ ...prev, healthCheckInterval: e.target.value }))}
                          placeholder="Interval (e.g., 30s)"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="monitoring"
                        checked={customSettings.enableMonitoring}
                        onCheckedChange={(checked) => setCustomSettings(prev => ({ ...prev, enableMonitoring: checked }))}
                      />
                      <Label htmlFor="monitoring">Enable Monitoring</Label>
                    </div>

                    {selectedTemplate === 'docker-compose' && (
                      <>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="database"
                            checked={customSettings.includeDatabase}
                            onCheckedChange={(checked) => setCustomSettings(prev => ({ ...prev, includeDatabase: checked }))}
                          />
                          <Label htmlFor="database">Include Database</Label>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Switch
                            id="redis"
                            checked={customSettings.includeRedis}
                            onCheckedChange={(checked) => setCustomSettings(prev => ({ ...prev, includeRedis: checked }))}
                          />
                          <Label htmlFor="redis">Include Redis</Label>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Script Preview</h3>
              <Button onClick={generateScript} disabled={isGenerating}>
                {isGenerating ? 'Generating...' : 'Generate Script'}
                <Play className="h-4 w-4 ml-2" />
              </Button>
            </div>

            {generatedScript && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Generated Script</span>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(generatedScript, 'main-script')}
                      >
                        {copied === 'main-script' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto max-h-96">
                    <pre>{generatedScript}</pre>
                  </div>
                </CardContent>
              </Card>
            )}

            {additionalFiles.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-medium">Additional Files</h4>
                {additionalFiles.map((file, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-base">
                        <span>{file.filename}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopy(file.content, file.filename)}
                        >
                          {copied === file.filename ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </CardTitle>
                      <CardDescription>{file.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto max-h-64">
                        <pre>{file.content}</pre>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Validation Tab */}
          <TabsContent value="validate" className="space-y-4">
            <ScriptValidationPanel 
              script={generatedScript} 
              config={config}
            />
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Download Options</CardTitle>
                <CardDescription>
                  Download individual files or complete deployment package
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {generatedScript ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Button
                        onClick={() => {
                          const template = templates.find(t => t.id === selectedTemplate)
                          const filename = template ? scriptGenerator.getFilename(config, template) : 'deployment-script.sh'
                          handleDownload(generatedScript, filename)
                        }}
                        className="w-full"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Main Script
                      </Button>

                      <Button
                        onClick={handleDownloadAll}
                        variant="outline"
                        className="w-full"
                      >
                        <Package className="h-4 w-4 mr-2" />
                        Download Complete Package
                      </Button>
                    </div>

                    {additionalFiles.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Individual Files</h4>
                        <div className="space-y-2">
                          {additionalFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div>
                                <span className="font-medium">{file.filename}</span>
                                <p className="text-sm text-gray-600">{file.description}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownload(file.content, file.filename)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="border-t pt-4">
                      <div className="flex items-start space-x-2 text-sm text-blue-600">
                        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium">Next Steps:</p>
                          <ul className="list-disc list-inside space-y-1 mt-1">
                            <li>Download and review the generated scripts</li>
                            <li>Customize any hardcoded values (model URLs, etc.)</li>
                            <li>Test the deployment in a safe environment</li>
                            <li>Deploy to your target platform</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Generate a script first to see download options</p>
                    <Button onClick={generateScript} className="mt-4">
                      Generate Script
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Automation Tab */}
          <TabsContent value="automation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Deployment Automation</CardTitle>
                <CardDescription>
                  Set up automated CI/CD pipelines for your ComfyUI deployment
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setGithubActionsOpen(true)}>
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-full bg-gray-900 flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-semibold">GitHub Actions</h3>
                          <p className="text-sm text-gray-600">Automated CI/CD workflows</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 mt-3">
                        Generate workflows for building, testing, and deploying your ComfyUI application
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="opacity-50">
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352z"/>
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-semibold">GitLab CI</h3>
                          <p className="text-sm text-gray-600">Coming soon</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 mt-3">
                        GitLab CI/CD pipeline templates (Available in next release)
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="opacity-50">
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-full bg-orange-600 flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-semibold">Jenkins</h3>
                          <p className="text-sm text-gray-600">Coming soon</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 mt-3">
                        Jenkins pipeline templates (Available in next release)
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="opacity-50">
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center">
                          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M11.998,2C6.477,2,2,6.477,2,11.998c0,5.522,4.477,9.999,9.998,9.999c5.522,0,10.002-4.477,10.002-9.999C22,6.477,17.52,2,11.998,2z M12,18c-0.553,0-1-0.448-1-1s0.447-1,1-1s1,0.448,1,1S12.553,18,12,18z M12.002,14c-0.553,0-1-0.448-1-1s0.447-1,1-1s1,0.448,1,1S12.555,14,12.002,14z M12.002,10c-0.553,0-1-0.448-1-1s0.447-1,1-1s1,0.448,1,1S12.555,10,12.002,10z"/>
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-semibold">Azure DevOps</h3>
                          <p className="text-sm text-gray-600">Coming soon</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 mt-3">
                        Azure DevOps pipeline templates (Available in next release)
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* GitHub Actions Generator */}
        <GitHubActionsSimple
          open={githubActionsOpen}
          onOpenChange={setGithubActionsOpen}
          deploymentConfig={config}
        />

        {/* Template Marketplace */}
        <TemplateMarketplace
          open={marketplaceOpen}
          onOpenChange={setMarketplaceOpen}
          onTemplateSelect={(template) => {
            setSelectedTemplate(template.id)
            generateScript()
          }}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}