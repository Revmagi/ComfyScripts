import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { ModelType, Source } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { seedType } = await request.json()

    let results = { models: 0, nodes: 0 }

    if (seedType === 'models' || seedType === 'all') {
      results.models = await seedModels()
    }

    if (seedType === 'nodes' || seedType === 'all') {
      results.nodes = await seedCustomNodes()
    }

    return NextResponse.json({
      message: 'Seed data imported successfully',
      results
    })
  } catch (error) {
    console.error('Error seeding data:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function seedModels() {
  const models = [
    // CHECKPOINT MODELS
    {
      name: "AIIM Realism",
      type: ModelType.CHECKPOINT,
      source: Source.HUGGINGFACE,
      downloadUrl: "https://huggingface.co/kingcashflow/modelcheckpoints/resolve/main/AIIM_Realism.safetensors",
      targetPath: "models/checkpoints",
      baseModel: "SDXL",
      isActive: true,
      isVerified: true
    },
    {
      name: "AIIM Realism FAST",
      type: ModelType.CHECKPOINT,
      source: Source.HUGGINGFACE,
      downloadUrl: "https://huggingface.co/kingcashflow/modelcheckpoints/resolve/main/AIIM_Realism_FAST.safetensors",
      targetPath: "models/checkpoints",
      baseModel: "SDXL",
      isActive: true,
      isVerified: true
    },
    {
      name: "UberRealistic PornMerge PonyXL",
      type: ModelType.CHECKPOINT,
      source: Source.HUGGINGFACE,
      downloadUrl: "https://huggingface.co/kingcashflow/modelcheckpoints/resolve/main/uberRealisticPornMergePonyxl_ponyxlHybridV1.safetensors",
      targetPath: "models/checkpoints",
      baseModel: "SDXL",
      isActive: true,
      isVerified: true
    },
    {
      name: "EpicRealism XL vXI aBEAST",
      type: ModelType.CHECKPOINT,
      source: Source.HUGGINGFACE,
      downloadUrl: "https://huggingface.co/AiWise/epiCRealism-XL-vXI-aBEAST/resolve/5c3950c035ce565d0358b76805de5ef2c74be919/epicrealismXL_vxiAbeast.safetensors",
      targetPath: "models/checkpoints",
      baseModel: "SDXL",
      isActive: true,
      isVerified: true
    },
    
    // VAE MODELS
    {
      name: "SDXL VAE",
      type: ModelType.VAE,
      source: Source.HUGGINGFACE,
      downloadUrl: "https://huggingface.co/stabilityai/sdxl-vae/resolve/main/diffusion_pytorch_model.safetensors",
      targetPath: "models/vae",
      baseModel: "SDXL",
      isActive: true,
      isVerified: true
    },

    // LORA MODELS
    {
      name: "Depth of Field Slider v1",
      type: ModelType.LORA,
      source: Source.HUGGINGFACE,
      downloadUrl: "https://huggingface.co/kingcashflow/LoRas/resolve/main/depth_of_field_slider_v1.safetensors",
      targetPath: "models/loras",
      baseModel: "SDXL",
      isActive: true,
      isVerified: true
    },
    {
      name: "Zoom Slider v1",
      type: ModelType.LORA,
      source: Source.HUGGINGFACE,
      downloadUrl: "https://huggingface.co/kingcashflow/LoRas/resolve/main/zoom_slider_v1.safetensors",
      targetPath: "models/loras",
      baseModel: "SDXL",
      isActive: true,
      isVerified: true
    },
    {
      name: "Add Detail",
      type: ModelType.LORA,
      source: Source.HUGGINGFACE,
      downloadUrl: "https://huggingface.co/kingcashflow/LoRas/resolve/main/add_detail.safetensors",
      targetPath: "models/loras",
      baseModel: "SDXL",
      isActive: true,
      isVerified: true
    },
    {
      name: "UnderboobXL",
      type: ModelType.LORA,
      source: Source.HUGGINGFACE,
      downloadUrl: "https://huggingface.co/kingcashflow/underboobXL/resolve/main/UnderboobXL.safetensors",
      targetPath: "models/loras",
      baseModel: "SDXL",
      isActive: true,
      isVerified: true
    },

    // CONTROLNET MODELS
    {
      name: "ControlNet OpenPose SDXL",
      type: ModelType.CONTROLNET,
      source: Source.HUGGINGFACE,
      downloadUrl: "https://huggingface.co/xinsir/controlnet-openpose-sdxl-1.0/resolve/main/diffusion_pytorch_model.safetensors",
      targetPath: "models/controlnet",
      baseModel: "SDXL",
      isActive: true,
      isVerified: true
    },
    {
      name: "ControlNet Depth SDXL",
      type: ModelType.CONTROLNET,
      source: Source.HUGGINGFACE,
      downloadUrl: "https://huggingface.co/xinsir/controlnet-depth-sdxl-1.0/resolve/main/diffusion_pytorch_model.safetensors",
      targetPath: "models/controlnet",
      baseModel: "SDXL",
      isActive: true,
      isVerified: true
    },

    // INSIGHTFACE MODELS
    {
      name: "InsWapper 128",
      type: ModelType.INSIGHTFACE,
      source: Source.HUGGINGFACE,
      downloadUrl: "https://huggingface.co/datasets/Gourieff/ReActor/resolve/main/models/inswapper_128.onnx",
      targetPath: "models/insightface",
      baseModel: null,
      isActive: true,
      isVerified: true
    },

    // ULTRALYTICS BBOX MODELS
    {
      name: "Face YOLOv8m",
      type: ModelType.ULTRALYTICS_BBOX,
      source: Source.HUGGINGFACE,
      downloadUrl: "https://huggingface.co/Bingsu/adetailer/resolve/main/face_yolov8m.pt",
      targetPath: "models/ultralytics/bbox",
      baseModel: null,
      isActive: true,
      isVerified: true
    },
    {
      name: "Hand YOLOv8n",
      type: ModelType.ULTRALYTICS_BBOX,
      source: Source.HUGGINGFACE,
      downloadUrl: "https://huggingface.co/Bingsu/adetailer/resolve/main/hand_yolov8n.pt",
      targetPath: "models/ultralytics/bbox",
      baseModel: null,
      isActive: true,
      isVerified: true
    },
    {
      name: "Face YOLOv8n v2",
      type: ModelType.ULTRALYTICS_BBOX,
      source: Source.HUGGINGFACE,
      downloadUrl: "https://huggingface.co/Bingsu/adetailer/resolve/main/face_yolov8n_v2.pt",
      targetPath: "models/ultralytics/bbox",
      baseModel: null,
      isActive: true,
      isVerified: true
    },
    {
      name: "Hand YOLOv9c",
      type: ModelType.ULTRALYTICS_BBOX,
      source: Source.HUGGINGFACE,
      downloadUrl: "https://huggingface.co/Bingsu/adetailer/resolve/main/hand_yolov9c.pt",
      targetPath: "models/ultralytics/bbox",
      baseModel: null,
      isActive: true,
      isVerified: true
    },
    {
      name: "Eyeful v2 Individual",
      type: ModelType.ULTRALYTICS_BBOX,
      source: Source.HUGGINGFACE,
      downloadUrl: "https://huggingface.co/kingcashflow/underboobXL/resolve/main/Eyeful_v2-Individual.pt",
      targetPath: "models/ultralytics/bbox",
      baseModel: null,
      isActive: true,
      isVerified: true
    },

    // ULTRALYTICS SEGMENTATION MODELS
    {
      name: "YOLOv8m Segmentation",
      type: ModelType.ULTRALYTICS_SEGM,
      source: Source.GITHUB,
      downloadUrl: "https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8m-seg.pt",
      targetPath: "models/ultralytics/segm",
      baseModel: null,
      isActive: true,
      isVerified: true
    },

    // SAM MODELS
    {
      name: "SAM ViT-B",
      type: ModelType.SAM,
      source: Source.DIRECT,
      downloadUrl: "https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth",
      targetPath: "models/sams",
      baseModel: null,
      isActive: true,
      isVerified: true
    }
  ]

  let createdCount = 0
  
  for (const modelData of models) {
    try {
      // Check if model already exists
      const existing = await db.model.findFirst({
        where: { downloadUrl: modelData.downloadUrl }
      })

      if (!existing) {
        await db.model.create({
          data: {
            ...modelData,
            metadata: JSON.stringify({})
          }
        })
        createdCount++
      }
    } catch (error) {
      console.error(`Error creating model ${modelData.name}:`, error)
    }
  }

  return createdCount
}

async function seedCustomNodes() {
  const nodes = [
    // Core Management Nodes
    {
      name: "ComfyUI Manager",
      githubUrl: "https://github.com/ltdrdata/ComfyUI-Manager",
      branch: "main",
      description: "ComfyUI extension for managing custom nodes",
      author: "ltdrdata",
      tags: ["management", "core"],
      isActive: true,
      isVerified: true
    },
    
    // Essential Utilities
    {
      name: "ComfyUI Essentials",
      githubUrl: "https://github.com/cubiq/ComfyUI_essentials",
      branch: "main",
      description: "Essential utility nodes for ComfyUI",
      author: "cubiq",
      tags: ["utilities", "essential"],
      isActive: true,
      isVerified: true
    },
    
    // Face Processing
    {
      name: "ComfyUI ReActor",
      githubUrl: "https://github.com/Gourieff/ComfyUI-ReActor",
      branch: "main",
      description: "Face swap and face restoration for ComfyUI",
      author: "Gourieff",
      tags: ["face", "swap", "restoration"],
      isActive: true,
      isVerified: true
    },
    
    // Impact Pack
    {
      name: "ComfyUI Impact Pack",
      githubUrl: "https://github.com/ltdrdata/ComfyUI-Impact-Pack",
      branch: "main",
      description: "Detection and segmentation nodes for ComfyUI",
      author: "ltdrdata",
      tags: ["detection", "segmentation", "impact"],
      isActive: true,
      isVerified: true
    },
    {
      name: "ComfyUI Impact Subpack",
      githubUrl: "https://github.com/ltdrdata/ComfyUI-Impact-Subpack",
      branch: "main",
      description: "Additional nodes for Impact Pack",
      author: "ltdrdata",
      tags: ["detection", "segmentation", "impact"],
      isActive: true,
      isVerified: true
    },
    
    // Video Processing
    {
      name: "ComfyUI VideoHelper Suite",
      githubUrl: "https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite",
      branch: "main",
      description: "Video processing and manipulation nodes",
      author: "Kosinkadink",
      tags: ["video", "animation"],
      isActive: true,
      isVerified: true
    },
    {
      name: "ComfyUI Frame Interpolation",
      githubUrl: "https://github.com/Fannovel16/ComfyUI-Frame-Interpolation",
      branch: "main",
      description: "Frame interpolation for video generation",
      author: "Fannovel16",
      tags: ["video", "interpolation"],
      isActive: true,
      isVerified: true
    },
    {
      name: "ComfyUI Wan Video Wrapper",
      githubUrl: "https://github.com/kijai/ComfyUI-WanVideoWrapper",
      branch: "main",
      description: "Video processing wrapper nodes",
      author: "kijai",
      tags: ["video", "wrapper"],
      isActive: true,
      isVerified: true
    },
    
    // Image Saving and Processing
    {
      name: "Comfy Image Saver",
      githubUrl: "https://github.com/giriss/comfy-image-saver",
      branch: "main",
      description: "Advanced image saving capabilities",
      author: "giriss",
      tags: ["save", "export"],
      isActive: true,
      isVerified: true
    },
    {
      name: "ComfyUI SaveImgPrompt",
      githubUrl: "https://github.com/mpiquero1111/ComfyUI-SaveImgPrompt",
      branch: "main",
      description: "Save images with prompt information",
      author: "mpiquero1111",
      tags: ["save", "prompt"],
      isActive: true,
      isVerified: true
    },
    
    // Tagging and Analysis
    {
      name: "ComfyUI WD14 Tagger",
      githubUrl: "https://github.com/pythongosssss/ComfyUI-WD14-Tagger",
      branch: "main",
      description: "Image tagging using WD14 models",
      author: "pythongosssss",
      tags: ["tagging", "analysis"],
      isActive: true,
      isVerified: true
    },
    
    // AI Assistants
    {
      name: "ComfyUI Copilot",
      githubUrl: "https://github.com/hylarucoder/comfyui-copilot",
      branch: "main",
      description: "AI assistant for ComfyUI workflows",
      author: "hylarucoder",
      tags: ["ai", "assistant"],
      isActive: true,
      isVerified: true
    },
    {
      name: "ComfyUI Fill ChatterBox",
      githubUrl: "https://github.com/filliptm/ComfyUI_Fill-ChatterBox",
      branch: "main",
      description: "Text-to-speech and chat capabilities",
      author: "filliptm",
      tags: ["tts", "chat"],
      isActive: true,
      isVerified: true
    },
    
    // Node Collections
    {
      name: "ComfyUI KJNodes",
      githubUrl: "https://github.com/kijai/ComfyUI-KJNodes",
      branch: "main",
      description: "Collection of utility nodes by kijai",
      author: "kijai",
      tags: ["utilities", "collection"],
      isActive: true,
      isVerified: true
    },
    {
      name: "ComfyUI Universal Styler",
      githubUrl: "https://github.com/KoreTeknology/ComfyUI-Universal-Styler",
      branch: "main",
      description: "Universal styling nodes for ComfyUI",
      author: "KoreTeknology",
      tags: ["styling", "universal"],
      isActive: true,
      isVerified: true
    },
    {
      name: "Comfy MTB",
      githubUrl: "https://github.com/melMass/comfy_mtb",
      branch: "main",
      description: "MTB's collection of ComfyUI nodes",
      author: "melMass",
      tags: ["utilities", "collection"],
      isActive: true,
      isVerified: true
    },
    {
      name: "RGThree Comfy",
      githubUrl: "https://github.com/rgthree/rgthree-comfy",
      branch: "main",
      description: "RGThree's ComfyUI node collection",
      author: "rgthree",
      tags: ["utilities", "collection"],
      isActive: true,
      isVerified: true
    },
    
    // Upscaling
    {
      name: "ComfyUI Ultimate SD Upscale",
      githubUrl: "https://github.com/ssitu/ComfyUI_UltimateSDUpscale",
      branch: "main",
      description: "Ultimate SD upscaling nodes",
      author: "ssitu",
      tags: ["upscale", "enhancement"],
      isActive: true,
      isVerified: true
    },
    
    // Image Loading
    {
      name: "ComfyUI IF AI LoadImages",
      githubUrl: "https://github.com/if-ai/ComfyUI_IF_AI_LoadImages",
      branch: "main",
      description: "Advanced image loading capabilities",
      author: "if-ai",
      tags: ["load", "images"],
      isActive: true,
      isVerified: true
    },
    
    // Custom Collections
    {
      name: "ComfyUI Comfyroll CustomNodes",
      githubUrl: "https://github.com/Suzie1/ComfyUI_Comfyroll_CustomNodes",
      branch: "main",
      description: "Comfyroll's custom node collection",
      author: "Suzie1",
      tags: ["collection", "custom"],
      isActive: true,
      isVerified: true
    },
    
    // Optimization
    {
      name: "ComfyUI Tiled Diffusion",
      githubUrl: "https://github.com/shiimizu/ComfyUI-TiledDiffusion",
      branch: "main",
      description: "Tiled diffusion for large image generation",
      author: "shiimizu",
      tags: ["optimization", "tiling"],
      isActive: true,
      isVerified: true
    },
    
    // Masking
    {
      name: "Masquerade Nodes ComfyUI",
      githubUrl: "https://github.com/BadCafeCode/masquerade-nodes-comfyui",
      branch: "main",
      description: "Advanced masking nodes for ComfyUI",
      author: "BadCafeCode",
      tags: ["masking", "editing"],
      isActive: true,
      isVerified: true
    },
    
    // Model Support
    {
      name: "ComfyUI Extra Models",
      githubUrl: "https://github.com/city96/ComfyUI_ExtraModels",
      branch: "main",
      description: "Support for additional model formats",
      author: "city96",
      tags: ["models", "support"],
      isActive: true,
      isVerified: true
    },
    {
      name: "ComfyUI GGUF",
      githubUrl: "https://github.com/city96/ComfyUI-GGUF",
      branch: "main",
      description: "GGUF model format support",
      author: "city96",
      tags: ["models", "gguf"],
      isActive: true,
      isVerified: true
    },
    
    // Face Processing
    {
      name: "ComfyUI Face Parsing",
      githubUrl: "https://github.com/Ryuukeisyou/comfyui_face_parsing",
      branch: "main",
      description: "Face parsing and segmentation",
      author: "Ryuukeisyou",
      tags: ["face", "parsing"],
      isActive: true,
      isVerified: true
    },
    {
      name: "ComfyUI Face Analysis",
      githubUrl: "https://github.com/cubiq/ComfyUI_FaceAnalysis",
      branch: "main",
      description: "Face analysis and detection",
      author: "cubiq",
      tags: ["face", "analysis"],
      isActive: true,
      isVerified: true
    },
    
    // Layer Effects
    {
      name: "ComfyUI LayerStyle",
      githubUrl: "https://github.com/chflame163/ComfyUI_LayerStyle",
      branch: "main",
      description: "Layer styling effects for ComfyUI",
      author: "chflame163",
      tags: ["layers", "effects"],
      isActive: true,
      isVerified: true
    },
    {
      name: "ComfyUI LayerStyle Advance",
      githubUrl: "https://github.com/chflame163/ComfyUI_LayerStyle_Advance",
      branch: "main",
      description: "Advanced layer styling effects",
      author: "chflame163",
      tags: ["layers", "effects", "advanced"],
      isActive: true,
      isVerified: true
    },
    
    // Workflow Enhancement
    {
      name: "CG Use Everywhere",
      githubUrl: "https://github.com/chrisgoringe/cg-use-everywhere",
      branch: "main",
      description: "Use nodes everywhere in workflows",
      author: "chrisgoringe",
      tags: ["workflow", "enhancement"],
      isActive: true,
      isVerified: true
    },
    {
      name: "ComfyUI Jake Upgrade",
      githubUrl: "https://github.com/jakechai/ComfyUI-JakeUpgrade",
      branch: "main",
      description: "Workflow upgrade and enhancement tools",
      author: "jakechai",
      tags: ["workflow", "upgrade"],
      isActive: true,
      isVerified: true
    },
    
    // IP Adapter
    {
      name: "ComfyUI IPAdapter Plus",
      githubUrl: "https://github.com/cubiq/ComfyUI_IPAdapter_plus",
      branch: "main",
      description: "Enhanced IP Adapter nodes",
      author: "cubiq",
      tags: ["ipadapter", "style"],
      isActive: true,
      isVerified: true
    },
    
    // LCM
    {
      name: "ComfyUI LCM",
      githubUrl: "https://github.com/0xbitches/ComfyUI-LCM",
      branch: "main",
      description: "Latent Consistency Model support",
      author: "0xbitches",
      tags: ["lcm", "speed"],
      isActive: true,
      isVerified: true
    },
    
    // Super Resolution
    {
      name: "ComfyUI Flowty LDSR",
      githubUrl: "https://github.com/flowtyone/ComfyUI-Flowty-LDSR",
      branch: "main",
      description: "LDSR super resolution nodes",
      author: "flowtyone",
      tags: ["upscale", "ldsr"],
      isActive: true,
      isVerified: true
    },
    
    // ControlNet Auxiliary
    {
      name: "ComfyUI ControlNet Aux",
      githubUrl: "https://github.com/Fannovel16/comfyui_controlnet_aux",
      branch: "main",
      description: "ControlNet auxiliary preprocessors",
      author: "Fannovel16",
      tags: ["controlnet", "preprocessor"],
      isActive: true,
      isVerified: true
    },
    
    // Tensor Operations
    {
      name: "ComfyUI TensorOps",
      githubUrl: "https://github.com/un-seen/comfyui-tensorops",
      branch: "main",
      description: "Tensor operation nodes",
      author: "un-seen",
      tags: ["tensor", "operations"],
      isActive: true,
      isVerified: true
    },
    
    // External Integrations
    {
      name: "ComfyUI Glif Nodes",
      githubUrl: "https://github.com/glifxyz/ComfyUI-GlifNodes",
      branch: "main",
      description: "Glif platform integration nodes",
      author: "glifxyz",
      tags: ["integration", "glif"],
      isActive: true,
      isVerified: true
    },
    
    // Post Processing
    {
      name: "ComfyUI Post Processing Nodes",
      githubUrl: "https://github.com/EllangoK/ComfyUI-post-processing-nodes",
      branch: "main",
      description: "Post-processing and enhancement nodes",
      author: "EllangoK",
      tags: ["postprocessing", "enhancement"],
      isActive: true,
      isVerified: true
    },
    
    // Art Venture
    {
      name: "ComfyUI Art Venture",
      githubUrl: "https://github.com/sipherxyz/comfyui-art-venture",
      branch: "main",
      description: "Art generation and manipulation nodes",
      author: "sipherxyz",
      tags: ["art", "generation"],
      isActive: true,
      isVerified: true
    },
    
    // Segment Anything
    {
      name: "ComfyUI Segment Anything",
      githubUrl: "https://github.com/storyicon/comfyui_segment_anything",
      branch: "main",
      description: "Segment Anything Model integration",
      author: "storyicon",
      tags: ["segmentation", "sam"],
      isActive: true,
      isVerified: true
    },
    
    // Florence2
    {
      name: "ComfyUI Florence2",
      githubUrl: "https://github.com/kijai/ComfyUI-Florence2",
      branch: "main",
      description: "Florence2 model integration",
      author: "kijai",
      tags: ["florence2", "vision"],
      isActive: true,
      isVerified: true
    },
    
    // Custom Scripts
    {
      name: "ComfyUI Custom Scripts",
      githubUrl: "https://github.com/pythongosssss/ComfyUI-Custom-Scripts",
      branch: "main",
      description: "Collection of custom scripts and utilities",
      author: "pythongosssss",
      tags: ["scripts", "utilities"],
      isActive: true,
      isVerified: true
    },
    
    // Latent Sync
    {
      name: "ComfyUI Latent Sync",
      githubUrl: "https://github.com/hay86/ComfyUI_LatentSync",
      branch: "main",
      description: "Latent space synchronization",
      author: "hay86",
      tags: ["latent", "sync"],
      isActive: true,
      isVerified: true
    },
    
    // Perturbed Attention
    {
      name: "SD Perturbed Attention",
      githubUrl: "https://github.com/pamparamm/sd-perturbed-attention",
      branch: "main",
      description: "Perturbed attention for stable diffusion",
      author: "pamparamm",
      tags: ["attention", "enhancement"],
      isActive: true,
      isVerified: true
    },
    
    // WAS Node Suite
    {
      name: "WAS Node Suite ComfyUI",
      githubUrl: "https://github.com/WASasquatch/was-node-suite-comfyui",
      branch: "main",
      description: "WAS comprehensive node suite",
      author: "WASasquatch",
      tags: ["suite", "comprehensive"],
      isActive: true,
      isVerified: true
    }
  ]

  let createdCount = 0
  
  for (const nodeData of nodes) {
    try {
      // Check if node already exists
      const existing = await db.customNode.findUnique({
        where: { githubUrl: nodeData.githubUrl }
      })

      if (!existing) {
        await db.customNode.create({
          data: {
            ...nodeData,
            tags: JSON.stringify(nodeData.tags),
            pipRequirements: JSON.stringify([]),
            jsFiles: JSON.stringify([]),
            nodeClasses: JSON.stringify([])
          }
        })
        createdCount++
      }
    } catch (error) {
      console.error(`Error creating node ${nodeData.name}:`, error)
    }
  }

  return createdCount
}