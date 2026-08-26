-- CreateTable
CREATE TABLE "setting_presets" (
    "id" TEXT NOT NULL,
    "settingKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "setting_presets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "setting_presets_settingKey_favorite_idx" ON "setting_presets"("settingKey", "favorite");

-- CreateIndex
CREATE UNIQUE INDEX "setting_presets_settingKey_name_key" ON "setting_presets"("settingKey", "name");
