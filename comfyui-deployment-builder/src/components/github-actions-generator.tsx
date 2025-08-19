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
  GitBranch,
  Play,
  Settings,
  Shield,
  Zap,
  Copy,
  Check,
  AlertTriangle,
  Github
} from 'lucide-react'

interface GitHubActionsGeneratorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deploymentConfig: any
}

interface WorkflowConfig {
  name: string
  triggers: {
    push: boolean
    pullRequest: boolean
    schedule: boolean
    scheduleExpression: string
    manual: boolean
  }
  environment: {
    node: string
    python: string
    platform: 'runpod' | 'docker' | 'local'
  }
  secrets: string[]
  steps: {
    checkout: boolean
    cache: boolean
    security: boolean
    build: boolean
    test: boolean
    deploy: boolean
    notify: boolean
  }
  notifications: {
    slack: boolean
    email: boolean
    discord: boolean
  }
  deployment: {
    environment: string
    requiresApproval: boolean
    autoMerge: boolean
  }
}

export function GitHubActionsGenerator({ open, onOpenChange, deploymentConfig }: GitHubActionsGeneratorProps) {
  const [config, setConfig] = useState<WorkflowConfig>({
    name: `Deploy ${deploymentConfig?.basic?.name || 'ComfyUI'}`,
    triggers: {
      push: true,
      pullRequest: false,
      schedule: false,
      scheduleExpression: '0 2 * * 0',
      manual: true
    },
    environment: {
      node: '18',
      python: '3.10',
      platform: deploymentConfig?.basic?.scriptType || 'docker'
    },
    secrets: ['DOCKER_USERNAME', 'DOCKER_PASSWORD', 'RUNPOD_API_KEY'],
    steps: {
      checkout: true,
      cache: true,
      security: true,
      build: true,
      test: true,
      deploy: true,
      notify: false
    },
    notifications: {
      slack: false,
      email: false,
      discord: false
    },
    deployment: {
      environment: 'production',
      requiresApproval: true,
      autoMerge: false
    }
  })

  const [generatedWorkflow, setGeneratedWorkflow] = useState('')
  const [copied, setCopied] = useState(false)

  const generateWorkflow = () => {
    const workflow = `name: ${config.name}

on:
${config.triggers.push ? '  push:\n    branches: [ main, develop ]\n' : ''}${config.triggers.pullRequest ? '  pull_request:\n    branches: [ main ]\n' : ''}${config.triggers.schedule ? `  schedule:\n    - cron: '${config.triggers.scheduleExpression}'\n` : ''}${config.triggers.manual ? '  workflow_dispatch:\n' : ''}

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: \${{ github.repository }}
  PYTHON_VERSION: ${config.environment.python}
  NODE_VERSION: ${config.environment.node}

jobs:
${config.steps.security ? `  security:
    name: Security Scan
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          scan-ref: '.'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'

` : ''}  build:
    name: Build and Test
    runs-on: ubuntu-latest
${config.deployment.requiresApproval ? `    environment: ${config.deployment.environment}\n` : ''}    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

${config.steps.cache ? `      - name: Setup Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Cache Docker layers
        uses: actions/cache@v3
        with:
          path: /tmp/.buildx-cache
          key: ${{ runner.os }}-buildx-${{ github.sha }}
          restore-keys: |
            ${{ runner.os }}-buildx-

` : ''}      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: \${{ env.REGISTRY }}
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha
            type=raw,value=latest,enable={{is_default_branch}}

${config.environment.platform === 'docker' ? `      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: \${{ steps.meta.outputs.tags }}
          labels: \${{ steps.meta.outputs.labels }}
          cache-from: type=local,src=/tmp/.buildx-cache
          cache-to: type=local,dest=/tmp/.buildx-cache-new,mode=max

      - name: Move cache
        run: |
          rm -rf /tmp/.buildx-cache
          mv /tmp/.buildx-cache-new /tmp/.buildx-cache
` : ''}
${config.steps.test ? `      - name: Run tests
        run: |
          # Add your test commands here
          echo "Running ComfyUI tests..."
          # docker run --rm \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:latest python -m pytest tests/

` : ''}${config.environment.platform === 'runpod' ? `  deploy-runpod:
    name: Deploy to RunPod
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: ${config.deployment.environment}
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: ${{ env.PYTHON_VERSION }}

      - name: Install RunPod CLI
        run: |
          pip install runpod

      - name: Deploy to RunPod
        env:
          RUNPOD_API_KEY: \${{ secrets.RUNPOD_API_KEY }}
        run: |
          # Deploy using RunPod API
          echo "Deploying to RunPod..."
          # Add your RunPod deployment commands here

` : ''}${config.steps.deploy && config.environment.platform === 'docker' ? `  deploy:
    name: Deploy Application
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: ${config.deployment.environment}
    steps:
      - name: Deploy to production
        run: |
          echo "Deploying \${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:latest"
          # Add your deployment commands here
          # kubectl set image deployment/comfyui comfyui=\${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:latest
          # docker stack deploy -c docker-compose.yml comfyui

` : ''}${config.steps.notify ? `  notify:
    name: Send Notifications
    runs-on: ubuntu-latest
    needs: [build${config.steps.deploy ? ', deploy' : ''}]
    if: always()
    steps:
${config.notifications.slack ? `      - name: Slack Notification
        uses: 8398a7/action-slack@v3
        with:
          status: \${{ job.status }}
          channel: '#deployments'
          webhook_url: \${{ secrets.SLACK_WEBHOOK }}
        if: always()

` : ''}${config.notifications.discord ? `      - name: Discord Notification
        uses: sarisia/actions-status-discord@v1
        with:
          webhook: \${{ secrets.DISCORD_WEBHOOK }}
          status: \${{ job.status }}
          title: "ComfyUI Deployment"
          description: "Deployment completed with status: \${{ job.status }}"
        if: always()

` : ''}${config.notifications.email ? `      - name: Email Notification
        uses: dawidd6/action-send-mail@v3
        with:
          server_address: smtp.gmail.com
          server_port: 587
          username: \${{ secrets.EMAIL_USERNAME }}
          password: \${{ secrets.EMAIL_PASSWORD }}
          subject: "ComfyUI Deployment \${{ job.status }}"
          body: "The deployment has completed with status: \${{ job.status }}"
          to: \${{ secrets.EMAIL_TO }}
        if: always()

` : ''}      - name: Update deployment status
        run: |
          echo "Deployment completed with status: \${{ job.status }}"
` : ''}`

    setGeneratedWorkflow(workflow)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedWorkflow)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([generatedWorkflow], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'deploy.yml'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const addSecret = () => {
    const input = document.querySelector<HTMLInputElement>('#new-secret')
    if (input?.value && !config.secrets.includes(input.value)) {
      setConfig(prev => ({
        ...prev,
        secrets: [...prev.secrets, input.value]
      }))
      input.value = ''
    }
  }

  const removeSecret = (secret: string) => {
    setConfig(prev => ({
      ...prev,
      secrets: prev.secrets.filter(s => s !== secret)
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Github className="h-5 w-5 mr-2" />
            GitHub Actions Workflow Generator
          </DialogTitle>
          <DialogDescription>
            Generate automated CI/CD workflows for your ComfyUI deployment
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuration */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Workflow Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="workflow-name">Workflow Name</Label>
                  <Input
                    id="workflow-name"
                    value={config.name}
                    onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div>
                  <Label>Triggers</Label>
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={config.triggers.push}
                        onCheckedChange={(checked) => setConfig(prev => ({
                          ...prev,
                          triggers: { ...prev.triggers, push: checked }
                        }))}
                      />
                      <Label>Push to main/develop</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={config.triggers.pullRequest}
                        onCheckedChange={(checked) => setConfig(prev => ({
                          ...prev,
                          triggers: { ...prev.triggers, pullRequest: checked }
                        }))}
                      />
                      <Label>Pull Request</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={config.triggers.manual}
                        onCheckedChange={(checked) => setConfig(prev => ({
                          ...prev,
                          triggers: { ...prev.triggers, manual: checked }
                        }))}
                      />
                      <Label>Manual Trigger</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={config.triggers.schedule}
                        onCheckedChange={(checked) => setConfig(prev => ({
                          ...prev,
                          triggers: { ...prev.triggers, schedule: checked }
                        }))}
                      />
                      <Label>Scheduled</Label>
                      {config.triggers.schedule && (
                        <Input
                          placeholder="0 2 * * 0"
                          value={config.triggers.scheduleExpression}
                          onChange={(e) => setConfig(prev => ({
                            ...prev,
                            triggers: { ...prev.triggers, scheduleExpression: e.target.value }
                          }))}
                          className="ml-2 w-32"
                        />
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Environment</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <Label className="text-xs">Node.js</Label>
                      <Select 
                        value={config.environment.node}
                        onValueChange={(value) => setConfig(prev => ({
                          ...prev,
                          environment: { ...prev.environment, node: value }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="16">Node 16</SelectItem>
                          <SelectItem value="18">Node 18</SelectItem>
                          <SelectItem value="20">Node 20</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Python</Label>
                      <Select 
                        value={config.environment.python}
                        onValueChange={(value) => setConfig(prev => ({
                          ...prev,
                          environment: { ...prev.environment, python: value }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3.8">Python 3.8</SelectItem>
                          <SelectItem value="3.9">Python 3.9</SelectItem>
                          <SelectItem value="3.10">Python 3.10</SelectItem>
                          <SelectItem value="3.11">Python 3.11</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pipeline Steps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(config.steps).map(([step, enabled]) => (
                  <div key={step} className="flex items-center space-x-2">
                    <Switch
                      checked={enabled}
                      onCheckedChange={(checked) => setConfig(prev => ({
                        ...prev,
                        steps: { ...prev.steps, [step]: checked }
                      }))}
                    />
                    <Label className="capitalize">{step.replace(/([A-Z])/g, ' $1')}</Label>
                    {step === 'security' && enabled && <Shield className="h-4 w-4 text-green-500" />}
                    {step === 'cache' && enabled && <Zap className="h-4 w-4 text-blue-500" />}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Secrets</CardTitle>
                <CardDescription>Required secrets for deployment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {config.secrets.map(secret => (
                    <Badge key={secret} variant="outline" className="px-3 py-1">
                      {secret}
                      <button 
                        onClick={() => removeSecret(secret)}
                        className="ml-2 text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <Input
                    id="new-secret"
                    placeholder="SECRET_NAME"
                    className="flex-1"
                  />
                  <Button size="sm" onClick={addSecret}>Add</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Deployment Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="environment">Environment</Label>
                  <Input
                    id="environment"
                    value={config.deployment.environment}
                    onChange={(e) => setConfig(prev => ({
                      ...prev,
                      deployment: { ...prev.deployment, environment: e.target.value }
                    }))}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={config.deployment.requiresApproval}
                    onCheckedChange={(checked) => setConfig(prev => ({
                      ...prev,
                      deployment: { ...prev.deployment, requiresApproval: checked }
                    }))}
                  />
                  <Label>Require Approval</Label>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Preview */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Generated Workflow</h3>
              <Button onClick={generateWorkflow} size="sm">
                <Play className="h-4 w-4 mr-2" />
                Generate
              </Button>
            </div>

            {generatedWorkflow && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>deploy.yml</span>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCopy}
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDownload}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs overflow-x-auto max-h-96">
                    <pre>{generatedWorkflow}</pre>
                  </div>
                </CardContent>
              </Card>
            )}

            {generatedWorkflow && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Setup Instructions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm space-y-2">
                    <p><strong>1. Create the workflow file:</strong></p>
                    <p className="ml-4 text-gray-600">Save as <code>.github/workflows/deploy.yml</code></p>
                    
                    <p><strong>2. Add required secrets:</strong></p>
                    <div className="ml-4 space-y-1">
                      {config.secrets.map(secret => (
                        <p key={secret} className="text-gray-600">• {secret}</p>
                      ))}
                    </div>
                    
                    <p><strong>3. Configure environment protection:</strong></p>
                    <p className="ml-4 text-gray-600">Go to Settings → Environments → {config.deployment.environment}</p>
                    
                    {config.deployment.requiresApproval && (
                      <>
                        <p><strong>4. Set up deployment approvers:</strong></p>
                        <p className="ml-4 text-gray-600">Add required reviewers for production deployments</p>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}