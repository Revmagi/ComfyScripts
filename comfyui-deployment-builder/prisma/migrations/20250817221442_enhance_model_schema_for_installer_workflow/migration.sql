-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastLoginAt" DATETIME
);

-- CreateTable
CREATE TABLE "api_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsed" DATETIME,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "api_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "custom_nodes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "githubUrl" TEXT NOT NULL,
    "branch" TEXT NOT NULL DEFAULT 'main',
    "description" TEXT,
    "author" TEXT,
    "installType" TEXT NOT NULL DEFAULT 'git',
    "pipRequirements" TEXT NOT NULL DEFAULT '[]',
    "jsFiles" TEXT NOT NULL DEFAULT '[]',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "nodeClasses" TEXT NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastValidated" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "models" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceUrl" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "filename" TEXT,
    "type" TEXT NOT NULL,
    "targetPath" TEXT,
    "category" TEXT,
    "baseModel" TEXT,
    "downloadUrl" TEXT NOT NULL,
    "fileSize" TEXT,
    "authRequired" BOOLEAN NOT NULL DEFAULT false,
    "creatorName" TEXT,
    "creatorUrl" TEXT,
    "currentVersion" TEXT,
    "versionName" TEXT,
    "allowCommercialUse" BOOLEAN NOT NULL DEFAULT false,
    "allowDerivatives" BOOLEAN NOT NULL DEFAULT false,
    "allowDifferentLicense" BOOLEAN NOT NULL DEFAULT false,
    "creditRequired" BOOLEAN NOT NULL DEFAULT true,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastValidated" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "model_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelId" TEXT NOT NULL,
    "versionId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "downloadUrl" TEXT NOT NULL,
    "filename" TEXT,
    "fileSize" TEXT,
    "fileHash" TEXT,
    "isLatest" BOOLEAN NOT NULL DEFAULT false,
    "releaseNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "releasedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "model_versions_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "models" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "deployments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT NOT NULL,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "templateCategory" TEXT,
    "generatedScript" TEXT,
    "scriptType" TEXT NOT NULL DEFAULT 'runpod',
    "environmentVars" TEXT NOT NULL DEFAULT '{}',
    "customSettings" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastGenerated" DATETIME,
    CONSTRAINT "deployments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "deployment_nodes" (
    "deploymentId" TEXT NOT NULL,
    "customNodeId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "config" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("deploymentId", "customNodeId"),
    CONSTRAINT "deployment_nodes_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "deployments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "deployment_nodes_customNodeId_fkey" FOREIGN KEY ("customNodeId") REFERENCES "custom_nodes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "deployment_models" (
    "deploymentId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "versionId" TEXT,
    "targetPath" TEXT NOT NULL,
    "customName" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("deploymentId", "modelId"),
    CONSTRAINT "deployment_models_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "deployments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "deployment_models_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "models" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "system_packages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deploymentId" TEXT NOT NULL,
    "packageType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT,
    "installUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "system_packages_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "deployments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sync_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalItems" INTEGER,
    "processedItems" INTEGER NOT NULL DEFAULT 0,
    "successItems" INTEGER NOT NULL DEFAULT 0,
    "failedItems" INTEGER NOT NULL DEFAULT 0,
    "results" TEXT NOT NULL DEFAULT '{}',
    "errorLog" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "url_validations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "lastChecked" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isValid" BOOLEAN NOT NULL,
    "statusCode" INTEGER,
    "errorMessage" TEXT,
    "modelId" TEXT,
    "customNodeId" TEXT
);

-- CreateTable
CREATE TABLE "deployment_usage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deploymentId" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scriptType" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT
);

-- CreateTable
CREATE TABLE "model_download_stats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelId" TEXT,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "lastDownload" DATETIME,
    CONSTRAINT "model_download_stats_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "models" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "custom_nodes_githubUrl_key" ON "custom_nodes"("githubUrl");

-- CreateIndex
CREATE UNIQUE INDEX "url_validations_url_key" ON "url_validations"("url");

-- CreateIndex
CREATE UNIQUE INDEX "model_download_stats_modelId_key" ON "model_download_stats"("modelId");
