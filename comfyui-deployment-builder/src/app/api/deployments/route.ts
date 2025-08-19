import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const createDeploymentSchema = z.object({
  basic: z.object({
    name: z.string().min(1).max(50),
    description: z.string().optional(),
    scriptType: z.enum(['runpod', 'docker', 'local']),
    isTemplate: z.boolean(),
    isPublic: z.boolean(),
    templateCategory: z.string().optional()
  }),
  models: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    source: z.string(),
    targetPath: z.string(),
    enabled: z.boolean()
  })),
  customNodes: z.array(z.object({
    id: z.string(),
    name: z.string(),
    githubUrl: z.string(),
    author: z.string(),
    enabled: z.boolean()
  })),
  systemPackages: z.array(z.object({
    type: z.enum(['apt', 'pip']),
    name: z.string(),
    version: z.string().optional()
  })),
  environmentVars: z.record(z.string()),
  customSettings: z.object({
    pythonVersion: z.string().optional(),
    cudaVersion: z.string().optional(),
    workspacePath: z.string().optional(),
    memoryLimit: z.string().optional(),
    enableOptimization: z.boolean().optional()
  })
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    
    // Validate the request body
    const validationResult = createDeploymentSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Invalid deployment configuration',
        details: validationResult.error.errors
      }, { status: 400 })
    }

    const config = validationResult.data

    // Create deployment in database
    const deployment = await db.deployment.create({
      data: {
        name: config.basic.name,
        description: config.basic.description,
        type: config.basic.scriptType.toUpperCase() as any,
        isTemplate: config.basic.isTemplate,
        isPublic: config.basic.isPublic,
        templateCategory: config.basic.templateCategory,
        userId: session.user.id,
        configuration: JSON.stringify(config),
        metadata: JSON.stringify({
          modelsCount: config.models.filter(m => m.enabled).length,
          nodesCount: config.customNodes.filter(n => n.enabled).length,
          packagesCount: config.systemPackages.length,
          environmentVarsCount: Object.keys(config.environmentVars).length,
          createdAt: new Date().toISOString()
        }),
        status: 'DRAFT'
      }
    })

    // Create deployment model associations
    const enabledModels = config.models.filter(m => m.enabled)
    if (enabledModels.length > 0) {
      await Promise.all(
        enabledModels.map(async (model, index) => {
          // Find the model in our database
          const dbModel = await db.model.findFirst({
            where: { 
              OR: [
                { id: model.id },
                { name: model.name }
              ]
            }
          })

          if (dbModel) {
            await db.deploymentModel.create({
              data: {
                deploymentId: deployment.id,
                modelId: dbModel.id,
                targetPath: model.targetPath,
                enabled: model.enabled,
                order: index
              }
            })
          }
        })
      )
    }

    // Create deployment custom node associations
    const enabledNodes = config.customNodes.filter(n => n.enabled)
    if (enabledNodes.length > 0) {
      await Promise.all(
        enabledNodes.map(async (node, index) => {
          // Find the custom node in our database
          const dbNode = await db.customNode.findFirst({
            where: { 
              OR: [
                { id: node.id },
                { name: node.name }
              ]
            }
          })

          if (dbNode) {
            await db.deploymentCustomNode.create({
              data: {
                deploymentId: deployment.id,
                customNodeId: dbNode.id,
                enabled: node.enabled,
                order: index
              }
            })
          }
        })
      )
    }

    // Generate deployment script
    const script = generateDeploymentScript(config)

    // Update deployment with generated script
    await db.deployment.update({
      where: { id: deployment.id },
      data: {
        generatedScript: script,
        status: 'READY'
      }
    })

    return NextResponse.json({
      id: deployment.id,
      name: deployment.name,
      status: deployment.status,
      createdAt: deployment.createdAt.toISOString(),
      script: script
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating deployment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const [deployments, total] = await Promise.all([
      db.deployment.findMany({
        where: {
          userId: session.user.id
        },
        include: {
          deploymentModels: {
            include: {
              model: true
            }
          },
          deploymentCustomNodes: {
            include: {
              customNode: true
            }
          },
          _count: {
            select: {
              deploymentModels: true,
              deploymentCustomNodes: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      db.deployment.count({
        where: {
          userId: session.user.id
        }
      })
    ])

    const transformedDeployments = deployments.map(deployment => ({
      id: deployment.id,
      name: deployment.name,
      description: deployment.description,
      type: deployment.type,
      status: deployment.status,
      isTemplate: deployment.isTemplate,
      isPublic: deployment.isPublic,
      templateCategory: deployment.templateCategory,
      createdAt: deployment.createdAt.toISOString(),
      updatedAt: deployment.updatedAt.toISOString(),
      modelsCount: deployment._count.deploymentModels,
      customNodesCount: deployment._count.deploymentCustomNodes,
      configuration: deployment.configuration ? JSON.parse(deployment.configuration) : null,
      metadata: deployment.metadata ? JSON.parse(deployment.metadata) : null
    }))

    return NextResponse.json({
      deployments: transformedDeployments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Error fetching deployments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateDeploymentScript(config: any): string {
  const { basic, models, customNodes, systemPackages, environmentVars, customSettings } = config
  
  let script = ''
  
  if (basic.scriptType === 'docker') {
    script += `# Dockerfile for ${basic.name}\n`
    script += `FROM pytorch/pytorch:2.1.0-cuda12.1-cudnn8-devel\n\n`
    script += `WORKDIR /workspace\n\n`
    
    // System packages
    const aptPackages = systemPackages.filter((p: any) => p.type === 'apt')
    if (aptPackages.length > 0) {
      script += `# Install system packages\n`
      script += `RUN apt-get update && apt-get install -y \\\n`
      script += aptPackages.map((p: any) => `    ${p.name}`).join(' \\\n')
      script += ` && \\\n    rm -rf /var/lib/apt/lists/*\n\n`
    }
    
    // Install ComfyUI
    script += `# Install ComfyUI\n`
    script += `RUN git clone https://github.com/comfyanonymous/ComfyUI.git\n`
    script += `WORKDIR /workspace/ComfyUI\n\n`
    
    // Python packages
    script += `# Install Python requirements\n`
    script += `RUN pip install --no-cache-dir -r requirements.txt\n`
    
    const pipPackages = systemPackages.filter((p: any) => p.type === 'pip')
    if (pipPackages.length > 0) {
      pipPackages.forEach((p: any) => {
        script += `RUN pip install --no-cache-dir ${p.name}${p.version ? `==${p.version}` : ''}\n`
      })
    }
    script += '\n'
    
    // Custom nodes
    const enabledNodes = customNodes.filter((n: any) => n.enabled)
    if (enabledNodes.length > 0) {
      script += `# Install custom nodes\n`
      script += `WORKDIR /workspace/ComfyUI/custom_nodes\n`
      enabledNodes.forEach((node: any) => {
        script += `RUN git clone ${node.githubUrl}\n`
      })
      script += '\n'
    }
    
    // Create model directories
    script += `# Create model directories\n`
    const modelPaths = [...new Set(models.filter((m: any) => m.enabled).map((m: any) => m.targetPath))]
    modelPaths.forEach(path => {
      script += `RUN mkdir -p /workspace/ComfyUI/${path}\n`
    })
    script += '\n'
    
    // Environment variables
    if (Object.keys(environmentVars).length > 0) {
      script += `# Set environment variables\n`
      Object.entries(environmentVars).forEach(([key, value]) => {
        script += `ENV ${key}="${value}"\n`
      })
      script += '\n'
    }
    
    // Custom settings
    if (customSettings.workspacePath) {
      script += `ENV WORKSPACE_PATH="${customSettings.workspacePath}"\n`
    }
    if (customSettings.memoryLimit) {
      script += `ENV MEMORY_LIMIT="${customSettings.memoryLimit}"\n`
    }
    
    script += `WORKDIR /workspace/ComfyUI\n`
    script += `EXPOSE 8188\n`
    script += `CMD ["python", "main.py", "--listen", "--port", "8188"]\n`
    
  } else if (basic.scriptType === 'runpod') {
    script += `#!/bin/bash\n`
    script += `# RunPod setup script for ${basic.name}\n\n`
    script += `set -e\n\n`
    
    script += `echo "Setting up ComfyUI deployment: ${basic.name}"\n\n`
    
    // System packages
    const aptPackages = systemPackages.filter((p: any) => p.type === 'apt')
    if (aptPackages.length > 0) {
      script += `# Install system packages\n`
      script += `apt-get update\n`
      aptPackages.forEach((p: any) => {
        script += `apt-get install -y ${p.name}\n`
      })
      script += '\n'
    }
    
    // Install ComfyUI
    script += `# Install ComfyUI\n`
    script += `cd /workspace\n`
    script += `git clone https://github.com/comfyanonymous/ComfyUI.git\n`
    script += `cd ComfyUI\n\n`
    
    // Python packages
    script += `# Install Python requirements\n`
    script += `pip install -r requirements.txt\n`
    
    const pipPackages = systemPackages.filter((p: any) => p.type === 'pip')
    if (pipPackages.length > 0) {
      pipPackages.forEach((p: any) => {
        script += `pip install ${p.name}${p.version ? `==${p.version}` : ''}\n`
      })
    }
    script += '\n'
    
    // Custom nodes
    const enabledNodes = customNodes.filter((n: any) => n.enabled)
    if (enabledNodes.length > 0) {
      script += `# Install custom nodes\n`
      script += `cd custom_nodes\n`
      enabledNodes.forEach((node: any) => {
        script += `git clone ${node.githubUrl}\n`
      })
      script += `cd ..\n\n`
    }
    
    // Create model directories and download instructions
    script += `# Create model directories\n`
    const modelPaths = [...new Set(models.filter((m: any) => m.enabled).map((m: any) => m.targetPath))]
    modelPaths.forEach(path => {
      script += `mkdir -p ${path}\n`
    })
    script += '\n'
    
    script += `# Download models (add your model URLs)\n`
    models.filter((m: any) => m.enabled).forEach((model: any) => {
      script += `# wget -O ${model.targetPath}/${model.name} [YOUR_MODEL_URL_FOR_${model.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}]\n`
    })
    script += '\n'
    
    // Environment variables
    if (Object.keys(environmentVars).length > 0) {
      script += `# Set environment variables\n`
      Object.entries(environmentVars).forEach(([key, value]) => {
        script += `export ${key}="${value}"\n`
      })
      script += '\n'
    }
    
    script += `echo "Setup complete! Starting ComfyUI..."\n`
    script += `python main.py --listen --port 8188\n`
    
  } else { // local
    script += `#!/bin/bash\n`
    script += `# Local setup script for ${basic.name}\n\n`
    script += `set -e\n\n`
    
    script += `echo "Setting up ComfyUI deployment: ${basic.name}"\n\n`
    
    // Check for Python
    script += `# Check Python installation\n`
    script += `if ! command -v python3 &> /dev/null; then\n`
    script += `    echo "Python 3 is required but not installed. Please install Python 3.8 or later."\n`
    script += `    exit 1\n`
    script += `fi\n\n`
    
    // Create virtual environment
    script += `# Create virtual environment\n`
    script += `python3 -m venv comfyui-env\n`
    script += `source comfyui-env/bin/activate\n\n`
    
    // Install ComfyUI
    script += `# Install ComfyUI\n`
    script += `git clone https://github.com/comfyanonymous/ComfyUI.git\n`
    script += `cd ComfyUI\n\n`
    
    // Python packages
    script += `# Install Python requirements\n`
    script += `pip install -r requirements.txt\n`
    
    const pipPackages = systemPackages.filter((p: any) => p.type === 'pip')
    if (pipPackages.length > 0) {
      pipPackages.forEach((p: any) => {
        script += `pip install ${p.name}${p.version ? `==${p.version}` : ''}\n`
      })
    }
    script += '\n'
    
    // Custom nodes
    const enabledNodes = customNodes.filter((n: any) => n.enabled)
    if (enabledNodes.length > 0) {
      script += `# Install custom nodes\n`
      script += `cd custom_nodes\n`
      enabledNodes.forEach((node: any) => {
        script += `git clone ${node.githubUrl}\n`
      })
      script += `cd ..\n\n`
    }
    
    // Create model directories
    script += `# Create model directories\n`
    const modelPaths = [...new Set(models.filter((m: any) => m.enabled).map((m: any) => m.targetPath))]
    modelPaths.forEach(path => {
      script += `mkdir -p ${path}\n`
    })
    script += '\n'
    
    script += `echo "Setup complete!"\n`
    script += `echo "Please download your models to the appropriate directories:"\n`
    models.filter((m: any) => m.enabled).forEach((model: any) => {
      script += `echo "  - ${model.name} -> ${model.targetPath}/"\n`
    })
    script += '\n'
    script += `echo "To start ComfyUI, run: python main.py"\n`
  }
  
  return script
}