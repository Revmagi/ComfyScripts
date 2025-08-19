'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

interface GitHubActionsSimpleProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  deploymentConfig: any
}

export function GitHubActionsSimple({ open, onOpenChange, deploymentConfig }: GitHubActionsSimpleProps) {
  const [workflowName, setWorkflowName] = useState(`Deploy ${deploymentConfig?.basic?.name || 'ComfyUI'}`)
  const [copied, setCopied] = useState(false)

  const generateBasicWorkflow = () => {
    const lines = [
      `name: ${workflowName}`,
      '',
      'on:',
      '  push:',
      '    branches: [ main ]',
      '  workflow_dispatch:',
      '',
      'env:',
      '  REGISTRY: ghcr.io',
      '  IMAGE_NAME: ${{ github.repository }}',
      '',
      'jobs:',
      '  build:',
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - name: Checkout',
      '        uses: actions/checkout@v4',
      '',
      '      - name: Set up Docker Buildx',
      '        uses: docker/setup-buildx-action@v3',
      '',
      '      - name: Log in to Container Registry',
      '        uses: docker/login-action@v3',
      '        with:',
      '          registry: ${{ env.REGISTRY }}',
      '          username: ${{ github.actor }}',
      '          password: ${{ secrets.GITHUB_TOKEN }}',
      '',
      '      - name: Build and push',
      '        uses: docker/build-push-action@v5',
      '        with:',
      '          context: .',
      '          push: true',
      '          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest'
    ]
    
    return lines.join('\n')
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generateBasicWorkflow())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleDownload = () => {
    const blob = new Blob([generateBasicWorkflow()], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'deploy.yml'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Github className="h-5 w-5 mr-2" />
            GitHub Actions Workflow
          </DialogTitle>
          <DialogDescription>
            Generate a basic CI/CD workflow for your ComfyUI deployment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <Label htmlFor="workflow-name">Workflow Name</Label>
            <Input
              id="workflow-name"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Generated Workflow</span>
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
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto max-h-96">
                <pre>{generateBasicWorkflow()}</pre>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Setup Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm space-y-2">
                <p><strong>1. Save the workflow:</strong></p>
                <p className="ml-4 text-gray-600">Create <code>.github/workflows/deploy.yml</code> in your repository</p>
                
                <p><strong>2. Ensure you have a Dockerfile:</strong></p>
                <p className="ml-4 text-gray-600">The workflow will build and push a Docker image</p>
                
                <p><strong>3. Commit and push:</strong></p>
                <p className="ml-4 text-gray-600">The workflow will run automatically on pushes to main branch</p>
              </div>
            </CardContent>
          </Card>
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