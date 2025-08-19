import { DeploymentType } from '@prisma/client'

export interface ScriptGenerationConfig {
  basic: {
    name: string
    description?: string
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
    downloadUrl?: string
    fileSize?: string
  }>
  customNodes: Array<{
    id: string
    name: string
    githubUrl: string
    author: string
    enabled: boolean
    installCommand?: string
    dependencies?: string[]
  }>
  systemPackages: Array<{
    type: 'apt' | 'pip' | 'conda'
    name: string
    version?: string
    preInstall?: boolean
  }>
  environmentVars: Record<string, string>
  customSettings: {
    pythonVersion?: string
    cudaVersion?: string
    workspacePath?: string
    memoryLimit?: string
    enableOptimization?: boolean
    useCache?: boolean
    multiGpu?: boolean
    enableTensorRT?: boolean
    enableXFormers?: boolean
    customCommands?: string[]
  }
  advanced?: {
    baseImage?: string
    port?: number
    exposePorts?: number[]
    volumes?: Array<{ host: string; container: string; mode?: 'ro' | 'rw' }>
    networkMode?: string
    restartPolicy?: string
    healthCheck?: {
      enabled: boolean
      command?: string
      interval?: string
      timeout?: string
      retries?: number
    }
    resourceLimits?: {
      memory?: string
      cpus?: string
      gpus?: string
    }
  }
}

export interface ScriptTemplate {
  id: string
  name: string
  description: string
  type: DeploymentType
  template: string
  variables: Record<string, any>
  isDefault: boolean
  author?: string
  version: string
  tags: string[]
}

export interface GeneratedScript {
  content: string
  filename: string
  type: string
  size: number
  additionalFiles?: Array<{
    filename: string
    content: string
    description: string
  }>
}

export class ScriptGenerator {
  private templates: Map<string, ScriptTemplate> = new Map()

  constructor() {
    this.loadDefaultTemplates()
  }

  private loadDefaultTemplates() {
    // Docker Template
    this.templates.set('docker-standard', {
      id: 'docker-standard',
      name: 'Standard Docker',
      description: 'Production-ready Docker container with optimizations',
      type: 'DOCKER',
      isDefault: true,
      version: '1.0.0',
      tags: ['docker', 'production', 'optimized'],
      template: `# ComfyUI Docker Deployment - {{name}}
# Generated on {{timestamp}}
{{#if description}}# {{description}}{{/if}}

ARG PYTHON_VERSION={{pythonVersion|default:"3.10"}}
ARG CUDA_VERSION={{cudaVersion|default:"12.1"}}
FROM pytorch/pytorch:\${PYTHON_VERSION}-cuda\${CUDA_VERSION}-cudnn8-devel

# Set working directory
WORKDIR {{workspacePath|default:"/workspace"}}

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV CUDA_VISIBLE_DEVICES=all
{{#each environmentVars}}
ENV {{@key}}="{{this}}"
{{/each}}

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    git \\
    wget \\
    curl \\
    unzip \\
    build-essential \\
    libgl1-mesa-glx \\
    libglib2.0-0 \\
    libsm6 \\
    libxext6 \\
    libxrender-dev \\
    libgomp1 \\
    {{#each systemPackages}}
    {{#if (eq type "apt")}}{{name}}{{#if version}}={{version}}{{/if}} \\{{/if}}
    {{/each}}
    && rm -rf /var/lib/apt/lists/*

# Create ComfyUI user
RUN useradd -m -u 1000 comfyui && \\
    chown -R comfyui:comfyui {{workspacePath|default:"/workspace"}}

# Switch to ComfyUI user
USER comfyui

# Install ComfyUI
RUN git clone https://github.com/comfyanonymous/ComfyUI.git
WORKDIR {{workspacePath|default:"/workspace"}}/ComfyUI

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \\
    pip install --no-cache-dir -r requirements.txt
{{#each systemPackages}}
{{#if (eq type "pip")}}
RUN pip install --no-cache-dir {{name}}{{#if version}}=={{version}}{{/if}}
{{/if}}
{{/each}}

{{#if enableXFormers}}
# Install xFormers for memory optimization
RUN pip install --no-cache-dir xformers
{{/if}}

{{#if enableTensorRT}}
# Install TensorRT for NVIDIA optimization
RUN pip install --no-cache-dir tensorrt
{{/if}}

# Create model directories
{{#each modelPaths}}
RUN mkdir -p {{this}}
{{/each}}

# Install custom nodes
{{#each customNodes}}
{{#if enabled}}
RUN cd custom_nodes && \\
    git clone {{githubUrl}} && \\
    {{#if installCommand}}{{installCommand}}{{else}}echo "Installed {{name}}"{{/if}}
{{/if}}
{{/each}}

# Download models (placeholder - replace with actual URLs)
{{#each models}}
{{#if enabled}}
# RUN wget -O "{{targetPath}}/{{name}}" "{{downloadUrl|default:"[MODEL_URL_PLACEHOLDER]"}}"
{{/if}}
{{/each}}

# Set up health check
{{#if healthCheck.enabled}}
HEALTHCHECK --interval={{healthCheck.interval|default:"30s"}} \\
           --timeout={{healthCheck.timeout|default:"10s"}} \\
           --retries={{healthCheck.retries|default:"3"}} \\
  CMD {{healthCheck.command|default:"curl -f http://localhost:8188/ || exit 1"}}
{{/if}}

# Expose port
EXPOSE {{port|default:"8188"}}
{{#each exposePorts}}
EXPOSE {{this}}
{{/each}}

# Set resource limits
{{#if resourceLimits.memory}}
LABEL memory-limit="{{resourceLimits.memory}}"
{{/if}}
{{#if resourceLimits.cpus}}
LABEL cpu-limit="{{resourceLimits.cpus}}"
{{/if}}

# Run custom commands
{{#each customCommands}}
RUN {{this}}
{{/each}}

# Start ComfyUI
CMD ["python", "main.py", "--listen", "--port", "{{port|default:"8188"}}"]`,
      variables: {}
    })

    // Docker Compose Template
    this.templates.set('docker-compose', {
      id: 'docker-compose',
      name: 'Docker Compose',
      description: 'Multi-service Docker Compose setup with database and monitoring',
      type: 'DOCKER',
      isDefault: true,
      version: '1.0.0',
      tags: ['docker-compose', 'multi-service', 'monitoring'],
      template: `# Docker Compose for {{name}}
# Generated on {{timestamp}}

version: '3.8'

services:
  comfyui:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: {{name|slugify}}-comfyui
    ports:
      - "{{port|default:"8188"}}:8188"
    volumes:
      - ./models:/workspace/ComfyUI/models
      - ./custom_nodes:/workspace/ComfyUI/custom_nodes
      - ./output:/workspace/ComfyUI/output
      - ./temp:/workspace/ComfyUI/temp
      - ./user:/workspace/ComfyUI/user
    environment:
      {{#each environmentVars}}
      - {{@key}}={{this}}
      {{/each}}
    {{#if multiGpu}}
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    {{else}}
    runtime: nvidia
    environment:
      - NVIDIA_VISIBLE_DEVICES=all
    {{/if}}
    {{#if resourceLimits}}
    deploy:
      resources:
        limits:
          {{#if resourceLimits.memory}}memory: {{resourceLimits.memory}}{{/if}}
          {{#if resourceLimits.cpus}}cpus: '{{resourceLimits.cpus}}'{{/if}}
    {{/if}}
    restart: {{restartPolicy|default:"unless-stopped"}}
    networks:
      - comfyui-network

  {{#if advanced.includeDatabase}}
  postgres:
    image: postgres:15
    container_name: {{name|slugify}}-db
    environment:
      - POSTGRES_DB=comfyui
      - POSTGRES_USER=comfyui
      - POSTGRES_PASSWORD=comfyui_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped
    networks:
      - comfyui-network
  {{/if}}

  {{#if advanced.includeRedis}}
  redis:
    image: redis:7-alpine
    container_name: {{name|slugify}}-redis
    ports:
      - "6379:6379"
    restart: unless-stopped
    networks:
      - comfyui-network
  {{/if}}

  {{#if advanced.includeMonitoring}}
  prometheus:
    image: prom/prometheus:latest
    container_name: {{name|slugify}}-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
    restart: unless-stopped
    networks:
      - comfyui-network

  grafana:
    image: grafana/grafana:latest
    container_name: {{name|slugify}}-grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
    restart: unless-stopped
    networks:
      - comfyui-network
  {{/if}}

volumes:
  {{#if advanced.includeDatabase}}postgres_data:{{/if}}
  {{#if advanced.includeMonitoring}}grafana_data:{{/if}}

networks:
  comfyui-network:
    driver: bridge`,
      variables: {}
    })

    // RunPod Template
    this.templates.set('runpod-standard', {
      id: 'runpod-standard',
      name: 'RunPod Standard',
      description: 'Optimized RunPod deployment script with fast startup',
      type: 'RUNPOD',
      isDefault: true,
      version: '1.0.0',
      tags: ['runpod', 'gpu', 'cloud'],
      template: `#!/bin/bash
# RunPod Setup Script for {{name}}
# Generated on {{timestamp}}
{{#if description}}# {{description}}{{/if}}

set -e

echo "🚀 Starting ComfyUI deployment: {{name}}"
echo "=================================================="

# Set environment variables
{{#each environmentVars}}
export {{@key}}="{{this}}"
{{/each}}

# Configuration
WORKSPACE="{{workspacePath|default:"/workspace"}}"
COMFYUI_DIR="$WORKSPACE/ComfyUI"
PYTHON_VERSION="{{pythonVersion|default:"3.10"}}"

echo "📁 Setting up workspace at $WORKSPACE"
cd $WORKSPACE

# Update system packages
echo "📦 Installing system packages..."
apt-get update -qq
{{#each systemPackages}}
{{#if (eq type "apt")}}
apt-get install -y {{name}}{{#if version}}={{version}}{{/if}}
{{/if}}
{{/each}}

# Install additional tools
apt-get install -y git wget curl unzip htop nvtop

echo "🐍 Setting up Python environment..."
{{#if useVenv}}
python$PYTHON_VERSION -m venv comfyui-env
source comfyui-env/bin/activate
{{/if}}

# Upgrade pip
pip install --upgrade pip

# Clone ComfyUI
echo "📥 Cloning ComfyUI..."
if [ ! -d "$COMFYUI_DIR" ]; then
    git clone https://github.com/comfyanonymous/ComfyUI.git
else
    echo "ComfyUI already exists, pulling latest changes..."
    cd $COMFYUI_DIR
    git pull
    cd $WORKSPACE
fi

cd $COMFYUI_DIR

# Install Python dependencies
echo "🔧 Installing Python dependencies..."
pip install --no-cache-dir -r requirements.txt

{{#each systemPackages}}
{{#if (eq type "pip")}}
echo "Installing {{name}}{{#if version}} version {{version}}{{/if}}"
pip install --no-cache-dir {{name}}{{#if version}}=={{version}}{{/if}}
{{/if}}
{{/each}}

{{#if enableXFormers}}
# Install xFormers for memory optimization
echo "⚡ Installing xFormers for memory optimization..."
pip install --no-cache-dir xformers
{{/if}}

{{#if enableTensorRT}}
# Install TensorRT for NVIDIA optimization
echo "🚄 Installing TensorRT for NVIDIA optimization..."
pip install --no-cache-dir tensorrt
{{/if}}

# Create model directories
echo "📂 Creating model directories..."
{{#each modelPaths}}
mkdir -p "{{this}}"
{{/each}}

# Install custom nodes
echo "🔌 Installing custom nodes..."
cd custom_nodes
{{#each customNodes}}
{{#if enabled}}
echo "Installing {{name}} by {{author}}"
if [ ! -d "{{name|slugify}}" ]; then
    git clone {{githubUrl}} "{{name|slugify}}"
    {{#if installCommand}}
    cd "{{name|slugify}}"
    {{installCommand}}
    cd ..
    {{/if}}
else
    echo "{{name}} already installed, skipping..."
fi
{{/if}}
{{/each}}

cd $COMFYUI_DIR

# Download models
echo "📦 Model download instructions:"
{{#each models}}
{{#if enabled}}
echo "  - Download {{name}} to {{targetPath}}/"
{{#if downloadUrl}}
echo "    URL: {{downloadUrl}}"
{{/if}}
{{/if}}
{{/each}}

{{#if models.length}}
echo ""
echo "💡 To download models automatically, replace the echo commands above with:"
echo "   wget -O 'path/to/model' 'your-model-url'"
echo ""
{{/if}}

# Set up monitoring
{{#if enableMonitoring}}
echo "📊 Setting up monitoring..."
cat > monitor.py << 'EOF'
import psutil
import GPUtil
import time
import json
from datetime import datetime

def get_system_info():
    gpus = GPUtil.getGPUs()
    return {
        'timestamp': datetime.now().isoformat(),
        'cpu_percent': psutil.cpu_percent(),
        'memory_percent': psutil.virtual_memory().percent,
        'disk_percent': psutil.disk_usage('/').percent,
        'gpu_utilization': [gpu.load * 100 for gpu in gpus],
        'gpu_memory': [gpu.memoryUtil * 100 for gpu in gpus]
    }

if __name__ == '__main__':
    while True:
        print(json.dumps(get_system_info()))
        time.sleep(30)
EOF

pip install psutil GPUtil
{{/if}}

# Create startup script
echo "🚀 Creating startup script..."
cat > start_comfyui.sh << 'EOF'
#!/bin/bash
cd {{workspacePath|default:"/workspace"}}/ComfyUI

{{#if useVenv}}
source {{workspacePath|default:"/workspace"}}/comfyui-env/bin/activate
{{/if}}

{{#each customCommands}}
{{this}}
{{/each}}

# Start ComfyUI with optimizations
python main.py \\
    --listen \\
    --port {{port|default:"8188"}} \\
    {{#if enableOptimization}}--enable-cors-header \\{{/if}}
    {{#if multiGpu}}--enable-model-parallel \\{{/if}}
    {{#if useCache}}--disable-auto-launch \\{{/if}}
    {{#if customSettings.extraArgs}}{{customSettings.extraArgs}}{{/if}}
EOF

chmod +x start_comfyui.sh

echo "✅ Setup complete!"
echo ""
echo "🎯 Next steps:"
echo "1. Download your models to the appropriate directories"
echo "2. Run: ./start_comfyui.sh"
echo "3. Access ComfyUI at http://localhost:{{port|default:"8188"}}"
echo ""
echo "📂 Workspace structure:"
echo "  $COMFYUI_DIR/models/     - Model files"
echo "  $COMFYUI_DIR/output/     - Generated images"
echo "  $COMFYUI_DIR/custom_nodes/ - Custom nodes"
echo ""
{{#if enableMonitoring}}
echo "📊 Monitoring: python monitor.py"
{{/if}}
echo "=================================================="

# Auto-start if requested
{{#if autoStart}}
echo "🚀 Auto-starting ComfyUI..."
./start_comfyui.sh
{{/if}}`,
      variables: {}
    })

    // Local Development Template
    this.templates.set('local-dev', {
      id: 'local-dev',
      name: 'Local Development',
      description: 'Local development setup with virtual environment',
      type: 'LOCAL',
      isDefault: true,
      version: '1.0.0',
      tags: ['local', 'development', 'venv'],
      template: `#!/bin/bash
# Local Development Setup for {{name}}
# Generated on {{timestamp}}
{{#if description}}# {{description}}{{/if}}

set -e

echo "🏠 Setting up local ComfyUI development environment"
echo "=================================================="

# Configuration
PROJECT_NAME="{{name|slugify}}"
WORKSPACE="{{workspacePath|default:"./comfyui-workspace"}}"
PYTHON_VERSION="{{pythonVersion|default:"3.10"}}"
VENV_NAME="{{name|slugify}}-env"

echo "📁 Creating workspace at $WORKSPACE"
mkdir -p "$WORKSPACE"
cd "$WORKSPACE"

# Check Python installation
echo "🐍 Checking Python installation..."
if ! command -v python$PYTHON_VERSION &> /dev/null; then
    echo "❌ Python $PYTHON_VERSION is not installed"
    echo "Please install Python $PYTHON_VERSION and try again"
    exit 1
fi

# Create virtual environment
echo "🔧 Creating virtual environment: $VENV_NAME"
python$PYTHON_VERSION -m venv "$VENV_NAME"

# Activate virtual environment
echo "⚡ Activating virtual environment..."
source "$VENV_NAME/bin/activate"

# Upgrade pip
pip install --upgrade pip

# Clone ComfyUI
echo "📥 Cloning ComfyUI..."
if [ ! -d "ComfyUI" ]; then
    git clone https://github.com/comfyanonymous/ComfyUI.git
else
    echo "ComfyUI already exists, pulling latest changes..."
    cd ComfyUI
    git pull
    cd ..
fi

cd ComfyUI

# Install requirements
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt

{{#each systemPackages}}
{{#if (eq type "pip")}}
echo "Installing {{name}}{{#if version}} version {{version}}{{/if}}"
pip install {{name}}{{#if version}}=={{version}}{{/if}}
{{/if}}
{{/each}}

{{#if enableXFormers}}
# Install xFormers for memory optimization
echo "⚡ Installing xFormers..."
pip install xformers
{{/if}}

# Create model directories
echo "📂 Creating model directories..."
{{#each modelPaths}}
mkdir -p "{{this}}"
{{/each}}

# Install custom nodes
echo "🔌 Installing custom nodes..."
cd custom_nodes
{{#each customNodes}}
{{#if enabled}}
echo "Installing {{name}} by {{author}}"
if [ ! -d "{{name|slugify}}" ]; then
    git clone {{githubUrl}} "{{name|slugify}}"
    {{#if installCommand}}
    cd "{{name|slugify}}"
    {{installCommand}}
    cd ..
    {{/if}}
else
    echo "{{name}} already installed"
fi
{{/if}}
{{/each}}

cd ..

# Create environment file
echo "⚙️ Creating environment configuration..."
cat > .env << 'EOF'
{{#each environmentVars}}
{{@key}}={{this}}
{{/each}}
EOF

# Create development scripts
echo "📝 Creating development scripts..."

# Start script
cat > start.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
source "../{{name|slugify}}-env/bin/activate"
{{#if environmentVars}}
source .env
{{/if}}

{{#each customCommands}}
{{this}}
{{/each}}

echo "🚀 Starting ComfyUI development server..."
python main.py --port {{port|default:"8188"}}
EOF

# Development script with auto-reload
cat > dev.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
source "../{{name|slugify}}-env/bin/activate"
{{#if environmentVars}}
source .env
{{/if}}

echo "🔄 Starting ComfyUI with development features..."
python main.py \\
    --port {{port|default:"8188"}} \\
    --enable-cors-header \\
    --auto-launch
EOF

# Testing script
cat > test.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
source "../{{name|slugify}}-env/bin/activate"

echo "🧪 Running ComfyUI tests..."
python -m pytest tests/ -v
EOF

chmod +x start.sh dev.sh test.sh

# Create requirements-dev.txt
cat > requirements-dev.txt << 'EOF'
pytest
black
flake8
mypy
jupyter
ipykernel
{{#each systemPackages}}
{{#if (eq type "pip")}}{{name}}{{#if version}}=={{version}}{{/if}}{{/if}}
{{/each}}
EOF

echo "📱 Installing development dependencies..."
pip install -r requirements-dev.txt

# Create project README
cat > README.md << 'EOF'
# {{name}}

{{#if description}}{{description}}{{/if}}

## Setup

This project was generated using ComfyUI Deployment Builder.

### Prerequisites

- Python {{pythonVersion|default:"3.10"}} or higher
- Git

### Installation

1. Clone this repository
2. Run the setup script: \`./setup.sh\`
3. Download your models to the appropriate directories

### Usage

- **Development**: \`./dev.sh\` - Starts with auto-launch and CORS
- **Production**: \`./start.sh\` - Standard startup
- **Testing**: \`./test.sh\` - Run tests

### Model Directories

{{#each modelPaths}}
- \`{{this}}/\` - {{this|capitalize}} models
{{/each}}

### Custom Nodes

{{#each customNodes}}
{{#if enabled}}
- **{{name}}** by {{author}} - {{githubUrl}}
{{/if}}
{{/each}}

### Environment Variables

{{#each environmentVars}}
- \`{{@key}}\` = {{this}}
{{/each}}

### Troubleshooting

If you encounter issues:

1. Ensure your virtual environment is activated
2. Check that all models are in the correct directories
3. Verify custom nodes are properly installed
4. Check the logs for specific error messages

EOF

echo "✅ Local development setup complete!"
echo ""
echo "🎯 Next steps:"
echo "1. Download your models to ComfyUI/models/"
echo "2. Start development server: cd ComfyUI && ./dev.sh"
echo "3. Access ComfyUI at http://localhost:{{port|default:"8188"}}"
echo ""
echo "📂 Project structure:"
echo "  $WORKSPACE/"
echo "  ├── {{name|slugify}}-env/     - Virtual environment"
echo "  └── ComfyUI/"
echo "      ├── models/              - Model files"
echo "      ├── custom_nodes/        - Custom nodes"
echo "      ├── start.sh            - Production start"
echo "      ├── dev.sh              - Development start"
echo "      └── test.sh             - Run tests"
echo ""
echo "=================================================="`,
      variables: {}
    })
  }

  generateScript(config: ScriptGenerationConfig, templateId?: string): GeneratedScript {
    const template = templateId 
      ? this.templates.get(templateId)
      : this.getDefaultTemplate(config.basic.scriptType)

    if (!template) {
      throw new Error(`Template not found: ${templateId || config.basic.scriptType}`)
    }

    // Prepare template variables
    const variables = this.prepareVariables(config)
    
    // Generate script content
    const content = this.processTemplate(template.template, variables)
    
    // Generate additional files if needed
    const additionalFiles = this.generateAdditionalFiles(config, template)

    return {
      content,
      filename: this.getFilename(config, template),
      type: template.type,
      size: content.length,
      additionalFiles
    }
  }

  private getDefaultTemplate(scriptType: string): ScriptTemplate | undefined {
    const typeMap: Record<string, string> = {
      'docker': 'docker-standard',
      'runpod': 'runpod-standard',
      'local': 'local-dev'
    }
    return this.templates.get(typeMap[scriptType] || 'docker-standard')
  }

  private prepareVariables(config: ScriptGenerationConfig): Record<string, any> {
    const modelPaths = [...new Set(
      config.models.filter(m => m.enabled).map(m => m.targetPath)
    )]

    return {
      ...config,
      ...config.basic,
      ...config.customSettings,
      modelPaths,
      timestamp: new Date().toISOString(),
      port: config.advanced?.port || 8188,
      exposePorts: config.advanced?.exposePorts || [],
      volumes: config.advanced?.volumes || [],
      healthCheck: config.advanced?.healthCheck || { enabled: false },
      resourceLimits: config.advanced?.resourceLimits || {},
      restartPolicy: config.advanced?.restartPolicy || 'unless-stopped'
    }
  }

  private processTemplate(template: string, variables: Record<string, any>): string {
    // Simple handlebars-like template processing
    let processed = template

    // Replace simple variables {{variable}}
    processed = processed.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, key) => {
      const value = this.getNestedValue(variables, key)
      return value !== undefined ? String(value) : match
    })

    // Replace variables with defaults {{variable|default:"value"}}
    processed = processed.replace(/\{\{(\w+(?:\.\w+)*)\|default:"([^"]*)"\}\}/g, (match, key, defaultValue) => {
      const value = this.getNestedValue(variables, key)
      return value !== undefined ? String(value) : defaultValue
    })

    // Process conditionals {{#if condition}}...{{/if}}
    processed = processed.replace(/\{\{#if\s+(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, key, content) => {
      const value = this.getNestedValue(variables, key)
      return this.isTruthy(value) ? content : ''
    })

    // Process each loops {{#each array}}...{{/each}}
    processed = processed.replace(/\{\{#each\s+(\w+(?:\.\w+)*)\}\}([\s\S]*?)\{\{\/each\}\}/g, (match, key, content) => {
      const array = this.getNestedValue(variables, key)
      if (!Array.isArray(array)) return ''
      
      return array.map((item, index) => {
        let itemContent = content
        // Replace {{this}} with current item
        itemContent = itemContent.replace(/\{\{this\}\}/g, String(item))
        // Replace {{@key}} and {{@index}}
        itemContent = itemContent.replace(/\{\{@key\}\}/g, typeof item === 'object' ? Object.keys(item)[0] : String(index))
        itemContent = itemContent.replace(/\{\{@index\}\}/g, String(index))
        
        // Replace item properties
        if (typeof item === 'object') {
          Object.keys(item).forEach(prop => {
            const regex = new RegExp(`\\{\\{${prop}\\}\\}`, 'g')
            itemContent = itemContent.replace(regex, String(item[prop]))
          })
        }
        
        return itemContent
      }).join('')
    })

    // Process helper functions
    processed = processed.replace(/\{\{(\w+)\|(\w+)\}\}/g, (match, value, helper) => {
      const val = this.getNestedValue(variables, value)
      return this.applyHelper(val, helper)
    })

    return processed
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  private isTruthy(value: any): boolean {
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'object' && value !== null) return Object.keys(value).length > 0
    return Boolean(value)
  }

  private applyHelper(value: any, helper: string): string {
    switch (helper) {
      case 'slugify':
        return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').trim('-')
      case 'capitalize':
        return String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1)
      case 'upper':
        return String(value || '').toUpperCase()
      case 'lower':
        return String(value || '').toLowerCase()
      default:
        return String(value || '')
    }
  }

  private generateAdditionalFiles(config: ScriptGenerationConfig, template: ScriptTemplate): Array<{filename: string, content: string, description: string}> {
    const files: Array<{filename: string, content: string, description: string}> = []

    if (template.id === 'docker-compose') {
      // Generate Dockerfile
      const dockerTemplate = this.templates.get('docker-standard')
      if (dockerTemplate) {
        const variables = this.prepareVariables(config)
        files.push({
          filename: 'Dockerfile',
          content: this.processTemplate(dockerTemplate.template, variables),
          description: 'Docker container definition'
        })
      }

      // Generate monitoring config if enabled
      if (config.advanced?.healthCheck?.enabled) {
        files.push({
          filename: 'monitoring/prometheus.yml',
          content: this.generatePrometheusConfig(config),
          description: 'Prometheus monitoring configuration'
        })
      }
    }

    if (config.basic.scriptType === 'local') {
      // Generate requirements.txt
      const pipPackages = config.systemPackages.filter(p => p.type === 'pip')
      if (pipPackages.length > 0) {
        files.push({
          filename: 'requirements.txt',
          content: pipPackages.map(p => `${p.name}${p.version ? `==${p.version}` : ''}`).join('\n'),
          description: 'Python package requirements'
        })
      }
    }

    return files
  }

  private generatePrometheusConfig(config: ScriptGenerationConfig): string {
    return `global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'comfyui'
    static_configs:
      - targets: ['comfyui:${config.advanced?.port || 8188}']
  
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']`
  }

  getFilename(config: ScriptGenerationConfig, template: ScriptTemplate): string {
    const baseName = config.basic.name.toLowerCase().replace(/[^a-z0-9]/g, '-')
    
    switch (template.id) {
      case 'docker-standard':
        return 'Dockerfile'
      case 'docker-compose':
        return 'docker-compose.yml'
      case 'runpod-standard':
        return `${baseName}-runpod-setup.sh`
      case 'local-dev':
        return `${baseName}-local-setup.sh`
      default:
        return `${baseName}-deployment.sh`
    }
  }

  getAvailableTemplates(): ScriptTemplate[] {
    return Array.from(this.templates.values())
  }

  getTemplate(id: string): ScriptTemplate | undefined {
    return this.templates.get(id)
  }

  addTemplate(template: ScriptTemplate): void {
    this.templates.set(template.id, template)
  }

  validateTemplate(template: string, variables: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    try {
      this.processTemplate(template, variables)
    } catch (error) {
      errors.push(`Template processing error: ${error}`)
    }

    // Check for required variables
    const requiredVars = ['name', 'timestamp']
    requiredVars.forEach(varName => {
      if (!variables[varName]) {
        errors.push(`Missing required variable: ${varName}`)
      }
    })

    return {
      valid: errors.length === 0,
      errors
    }
  }
}

export const scriptGenerator = new ScriptGenerator()