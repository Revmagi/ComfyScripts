# ComfyUI Deployment Builder

A comprehensive web application for creating and managing automated ComfyUI installation scripts for cloud platforms like RunPod. Streamlines the configuration of custom nodes, models from CivitAI and HuggingFace, and generates production-ready deployment scripts.

## 🎯 Project Overview

The ComfyUI Deployment Builder solves the time-consuming and error-prone process of manually configuring ComfyUI environments by providing:

- **Curated Database**: Comprehensive catalog of custom nodes and models
- **Visual Builder**: Intuitive interface for creating deployment configurations  
- **Script Generation**: Automated creation of RunPod-compatible installation scripts
- **Template System**: Shareable deployment templates for common use cases

## 📋 Features

### Phase 1: Foundation (Weeks 1-8)
- ✅ User authentication and role-based access control
- ✅ Admin interface for content curation
- ✅ CivitAI API integration for model discovery
- ✅ HuggingFace repository integration
- ✅ ComfyUI Manager database synchronization
- ✅ Basic deployment builder interface

### Phase 2: Advanced Features (Weeks 9-16)
- 🔄 Enhanced deployment builder with dependency resolution
- 🔄 Script generation engine with multiple output formats
- 🔄 Template system and community sharing
- 🔄 Automated URL validation and monitoring

### Phase 3: Polish & Advanced (Weeks 17-24)
- ⏳ Performance optimization and caching
- ⏳ Advanced search with Elasticsearch
- ⏳ Public API and webhook system
- ⏳ Progressive Web App features

### Phase 4: Production & Scaling (Weeks 25-32)
- ⏳ Production deployment with PostgreSQL
- ⏳ Security hardening and compliance
- ⏳ Load testing and auto-scaling
- ⏳ Documentation and launch preparation

## 🏗️ Architecture

```
Frontend (Next.js)     Backend API (Next.js)     Database (SQLite/PostgreSQL)
├── React Components   ├── Authentication        ├── Users & Roles
├── TypeScript         ├── CRUD Operations       ├── Custom Nodes
├── shadcn/ui          ├── External API Clients  ├── Models & Metadata
└── Tailwind CSS      └── Script Generation     └── Deployments

External Integrations
├── CivitAI API (Model discovery)
├── HuggingFace API (Repository analysis)  
├── ComfyUI Manager (Node database sync)
└── GitHub API (Repository validation)
```

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, React, TypeScript, shadcn/ui, Tailwind CSS
- **Backend**: Next.js API Routes, NextAuth.js, Prisma ORM
- **Database**: SQLite (development) → PostgreSQL (production)
- **External APIs**: CivitAI, HuggingFace, GitHub, ComfyUI Manager
- **Deployment**: Vercel, Docker, GitHub Actions

## 📊 Database Schema

Key entities and relationships:

```sql
Users (authentication, roles)
├── ApiTokens (CivitAI, HuggingFace credentials)
└── Deployments (user configurations)
    ├── DeploymentNodes (selected custom nodes)
    ├── DeploymentModels (selected models)
    └── SystemPackages (apt/pip dependencies)

CustomNodes (GitHub repositories)
├── Metadata (description, author, tags)
├── Dependencies (requirements.txt, setup.py)
└── Validation (URL health, verification)

Models (CivitAI, HuggingFace)
├── Source information (ID, URL, type)
├── Download metadata (filename, size, auth)
└── Rich metadata (previews, stats, versions)
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/comfyui-deployment-builder.git
   cd comfyui-deployment-builder
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Initialize database**
   ```bash
   npx prisma generate
   npx prisma db push
   npx prisma db seed
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

Visit `http://localhost:3000` to see the application.

### Environment Variables

```env
# Database
DATABASE_URL="file:./dev.db"

# Authentication  
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# External APIs (optional for development)
CIVITAI_API_TOKEN="your-civitai-token"
HUGGINGFACE_API_TOKEN="your-hf-token"
GITHUB_API_TOKEN="your-github-token"
```

## 📁 Project Structure

```
comfyui-deployment-builder/
├── app/                      # Next.js App Router
│   ├── (auth)/              # Protected routes
│   │   ├── admin/           # Admin interface
│   │   ├── dashboard/       # User dashboard  
│   │   └── builder/         # Deployment builder
│   ├── api/                 # API endpoints
│   │   ├── auth/            # Authentication
│   │   ├── civitai/         # CivitAI integration
│   │   ├── models/          # Model management
│   │   └── deployments/     # Deployment CRUD
│   ├── components/          # React components
│   │   ├── ui/              # shadcn/ui components
│   │   ├── forms/           # Form components
│   │   └── builders/        # Deployment builder UI
│   └── lib/                 # Utilities
│       ├── clients/         # API clients
│       ├── db.ts           # Database client
│       └── auth.ts         # Auth configuration
├── prisma/                  # Database schema
│   ├── schema.prisma       # Prisma schema
│   └── migrations/         # Database migrations
├── scripts/                 # Utility scripts
└── templates/              # Script generation templates
```

## 🔧 API Integration

### CivitAI Integration
```typescript
const client = new CivitAIClient({ token: process.env.CIVITAI_API_TOKEN });

// Search models
const models = await client.searchModels({
  query: "anime style",
  types: ["Checkpoint", "LORA"],
  limit: 20
});

// Get model details  
const model = await client.getModel(modelId);
```

### HuggingFace Integration
```typescript
const client = new HuggingFaceClient({ token: process.env.HUGGINGFACE_API_TOKEN });

// Search repositories
const repos = await client.searchRepositories({
  search: "stable diffusion",
  filter: "diffusers"
});

// Analyze repository
const info = await client.analyzeRepository(repoUrl);
```

### ComfyUI Manager Sync
```typescript
const manager = new ComfyUIManagerClient();

// Sync latest node database
const nodes = await manager.getNodeDatabase();
await syncToDatabase(nodes);
```

## 📜 Script Generation

Example generated RunPod script:

```bash
#!/bin/bash

# Auto-generated by ComfyUI Deployment Builder
# Configuration: My SDXL Workflow

APT_PACKAGES=(
    "git" "python3-pip" "python3-venv" "build-essential" "ffmpeg"
)

PIP_PACKAGES=(
    "torch" "torchvision" "torchaudio" "transformers>=4.28.1"
    "safetensors>=0.4.2" "diffusers" "xformers"
)

NODES=(
    "https://github.com/ltdrdata/ComfyUI-Manager"
    "https://github.com/cubiq/ComfyUI_essentials"
    "https://github.com/ltdrdata/ComfyUI-Impact-Pack"
)

CHECKPOINT_MODELS=(
    "https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors"
)

# Installation function
function provisioning_start() {
    # [Generated installation logic]
}

provisioning_start
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "CivitAI"

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## 📖 Documentation

- [Product Requirements Document](./PRD.md) - Comprehensive project overview
- [Technical Specification](./TECHNICAL_SPEC.md) - Detailed technical design
- [Database Schema](./DATABASE_SCHEMA.md) - Database design and migrations
- [API Integrations](./API_INTEGRATIONS.md) - External API specifications
- [Implementation Roadmap](./IMPLEMENTATION_ROADMAP.md) - Development timeline

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript strict mode
- Use Prettier for code formatting
- Write tests for new features
- Update documentation for API changes
- Follow conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [ComfyUI](https://github.com/comfyanonymous/ComfyUI) - The amazing node-based UI for Stable Diffusion
- [ComfyUI Manager](https://github.com/ltdrdata/ComfyUI-Manager) - Extension management system
- [CivitAI](https://civitai.com) - Community platform for AI art models
- [HuggingFace](https://huggingface.co) - Platform for machine learning models
- [RunPod](https://runpod.io) - Cloud GPU platform for AI workloads

## 📞 Support

- 📧 Email: support@comfyui-builder.com
- 💬 Discord: [Community Server](https://discord.gg/comfyui-builder)
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/comfyui-deployment-builder/issues)
- 📖 Docs: [Documentation Site](https://docs.comfyui-builder.com)

---

**Status**: 🚧 In Development | **Version**: 1.0.0-alpha | **Last Updated**: January 2025