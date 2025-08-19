-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_custom_nodes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "githubUrl" TEXT NOT NULL,
    "branch" TEXT NOT NULL DEFAULT 'main',
    "description" TEXT,
    "author" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "registryId" TEXT,
    "registryUrl" TEXT,
    "category" TEXT,
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
INSERT INTO "new_custom_nodes" ("author", "branch", "createdAt", "description", "githubUrl", "id", "installType", "isActive", "isVerified", "jsFiles", "lastValidated", "name", "nodeClasses", "pipRequirements", "tags", "updatedAt") SELECT "author", "branch", "createdAt", "description", "githubUrl", "id", "installType", "isActive", "isVerified", "jsFiles", "lastValidated", "name", "nodeClasses", "pipRequirements", "tags", "updatedAt" FROM "custom_nodes";
DROP TABLE "custom_nodes";
ALTER TABLE "new_custom_nodes" RENAME TO "custom_nodes";
CREATE UNIQUE INDEX "custom_nodes_githubUrl_key" ON "custom_nodes"("githubUrl");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
