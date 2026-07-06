<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useProviderStore } from '@/stores/providers'
import { useSettingsStore } from '@/stores/settings'
import Button from '@/components/ui/button.vue'
import Badge from '@/components/ui/badge.vue'
import Input from '@/components/ui/input.vue'
import NativeSelect from '@/components/ui/native-select.vue'
import Card from '@/components/ui/card.vue'
import Dialog from '@/components/ui/dialog.vue'
import {
  ArrowLeft, Key, Plus, Trash2, Check, X,
  Loader2, Globe, Wifi, WifiOff, Terminal, ChevronDown, ChevronRight,
  Search, Settings2, BookOpen, Server,
} from 'lucide-vue-next'
import { api } from '@/api/httpClient'

const router = useRouter()
const providerStore = useProviderStore()
const settingsStore = useSettingsStore()

const searchQuery = ref('')
const selectedProvider = ref<string | null>(null)
const apiKeyInput = ref('')
const showApiKeyInput = ref<string | null>(null)
const testResults = ref<Record<string, any>>({})
const testingProviders = ref<Set<string>>(new Set())
const expandedSections = ref<Record<string, boolean>>({})
const modelSearchQuery = ref('')

const filteredProviders = computed(() => {
  if (!searchQuery.value) return providerStore.providers
  const q = searchQuery.value.toLowerCase()
  return providerStore.providers.filter(
    p => p.name.toLowerCase().includes(q) || p.displayName.toLowerCase().includes(q),
  )
})

onMounted(async () => {
  await Promise.all([
    providerStore.fetchProviders(),
    providerStore.fetchModels(true),
    settingsStore.fetchSettings(),
  ])
})

const selectedProviderDetail = computed(() => {
  return providerStore.providers.find(p => p.name === selectedProvider.value)
})

const selectedProviderModels = computed(() => {
  let list = providerStore.models.filter(m => m.provider === selectedProvider.value)
  if (modelSearchQuery.value) {
    const q = modelSearchQuery.value.toLowerCase()
    list = list.filter(m => m.id.toLowerCase().includes(q) || m.name?.toLowerCase().includes(q))
  }
  return list
})

function toggleSection(key: string) {
  expandedSections.value[key] = !expandedSections.value[key]
}

async function handleSaveApiKey(provider: string) {
  if (!apiKeyInput.value.trim()) return
  await providerStore.setApiKey(provider, apiKeyInput.value.trim())
  apiKeyInput.value = ''
  showApiKeyInput.value = null
}

async function handleRemoveApiKey(provider: string) {
  await providerStore.removeApiKey(provider)
}

async function handleTestConnection(provider: string) {
  testingProviders.value.add(provider)
  try {
    const result = await providerStore.testConnection(provider)
    testResults.value[provider] = result
  } finally {
    testingProviders.value.delete(provider)
  }
}

async function handleSetDefault(provider: string, modelId: string, level?: string) {
  await settingsStore.setDefaultModel(provider, modelId, level)
  await providerStore.fetchModels(true)
}

function isDefault(provider: string, modelId: string) {
  return settingsStore.defaultProvider === provider && settingsStore.defaultModel === modelId
}

const defaultThinkingOptions = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh']

const enabledModelsInput = ref('')

async function handleSaveEnabledModels() {
  const patterns = enabledModelsInput.value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
  await api.setEnabledModels(patterns)
}

const showCustomProviderDialog = ref(false)
const customProviderForm = ref({
  name: '',
  displayName: '',
  baseUrl: '',
  api: 'openai-completions',
  apiKey: '',
  modelId: '',
  modelName: '',
})

async function handleAddCustomProvider() {
  const form = customProviderForm.value
  if (!form.name || !form.baseUrl) return

  const models = form.modelId
    ? [{ id: form.modelId, name: form.modelName || undefined }]
    : []

  try {
    await api.addCustomProvider({
      name: form.name,
      displayName: form.displayName || undefined,
      baseUrl: form.baseUrl,
      api: form.api,
      apiKey: form.apiKey || undefined,
      models,
    })

    customProviderForm.value = { name: '', displayName: '', baseUrl: '', api: 'openai-completions', apiKey: '', modelId: '', modelName: '' }
    showCustomProviderDialog.value = false
    await providerStore.fetchProviders()
    await providerStore.fetchModels(false)
  } catch (err: any) {
    console.error('Failed to add custom provider:', err)
  }
}

const showCustomModelDialog = ref(false)
const customModelForm = ref({
  provider: '',
  baseUrl: '',
  api: 'openai-completions',
  modelId: '',
  modelName: '',
  contextWindow: 128000,
})

async function handleAddCustomModel() {
  const form = customModelForm.value
  if (!form.provider || !form.modelId) return

  try {
    await api.addCustomModel({
      provider: form.provider,
      baseUrl: form.baseUrl || undefined,
      api: form.api,
      models: [{
        id: form.modelId,
        name: form.modelName || undefined,
        contextWindow: form.contextWindow,
      }],
    })

    customModelForm.value = { provider: '', baseUrl: '', api: 'openai-completions', modelId: '', modelName: '', contextWindow: 128000 }
    showCustomModelDialog.value = false
    await providerStore.fetchProviders()
    await providerStore.fetchModels(false)
  } catch (err: any) {
    console.error('Failed to add custom model:', err)
  }
}

async function handleRemoveCustomModel(provider: string, modelId: string) {
  await api.removeCustomModel(provider, modelId)
  await providerStore.fetchProviders()
  await providerStore.fetchModels(false)
}

const endpointForm = ref({
  baseUrl: '',
  api: 'openai-completions',
  headers: '',
})
const endpointLoaded = ref(false)
const showEndpointForm = ref(false)

async function loadEndpoint(provider: string) {
  try {
    const ep = await api.getEndpoint(provider)
    endpointForm.value = {
      baseUrl: ep?.baseUrl || '',
      api: ep?.api || 'openai-completions',
      headers: ep?.headers ? JSON.stringify(ep.headers, null, 2) : '',
    }
  } catch {
    endpointForm.value = { baseUrl: '', api: 'openai-completions', headers: '' }
  }
  endpointLoaded.value = true
  showEndpointForm.value = true
}

async function handleSaveEndpoint(provider: string) {
  const config: any = {}
  if (endpointForm.value.baseUrl) config.baseUrl = endpointForm.value.baseUrl
  if (endpointForm.value.api) config.api = endpointForm.value.api
  if (endpointForm.value.headers) {
    try {
      config.headers = JSON.parse(endpointForm.value.headers)
    } catch {}
  }
  await api.setEndpoint(provider, config)
  showEndpointForm.value = false
}

async function handleRemoveEndpoint(provider: string) {
  await api.removeEndpoint(provider)
  endpointForm.value = { baseUrl: '', api: 'openai-completions', headers: '' }
  showEndpointForm.value = false
}

const showSettingsPanel = ref(false)
</script>

<template>
  <div class="flex h-screen flex-col">
    <header class="flex items-center gap-2 border-b px-4 py-2">
      <Button variant="ghost" size="sm" @click="router.push('/')">
        <ArrowLeft class="h-4 w-4 mr-1" />
        Back
      </Button>
      <span class="font-semibold">LLM Configuration</span>
      <span class="text-xs text-muted-foreground ml-auto">
        {{ providerStore.providers.length }} providers
      </span>
    </header>

    <div class="flex flex-1 overflow-hidden">
      <div class="w-80 border-r overflow-y-auto p-2 space-y-1 flex-shrink-0">
        <div class="px-2 py-1 text-xs font-medium text-muted-foreground">Providers</div>

        <div class="relative px-2 mb-2">
          <Search class="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            v-model="searchQuery"
            placeholder="Search providers..."
            class="pl-7 h-8 text-xs"
          />
        </div>

        <button
          v-for="p in filteredProviders"
          :key="p.name"
          :class="[
            'w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors',
            selectedProvider === p.name ? 'bg-accent' : '',
          ]"
          @click="selectedProvider = p.name"
        >
          <div :class="[
            'h-2 w-2 rounded-full flex-shrink-0',
            p.authStatus === 'configured' ? 'bg-green-500' : 'bg-gray-300',
          ]" />
          <div class="flex-1 text-left min-w-0">
            <div class="truncate font-medium">{{ p.displayName }}</div>
            <div class="text-xs text-muted-foreground truncate">{{ p.name }}</div>
          </div>
          <Badge :variant="p.authStatus === 'configured' ? 'default' : 'outline'" class="flex-shrink-0">
            {{ p.availableModelCount || 0 }}
          </Badge>
        </button>

        <div class="mt-4 pt-2 border-t space-y-1 px-2">
          <div class="text-xs font-medium text-muted-foreground mb-1">Actions</div>
          <Button variant="outline" size="sm" class="w-full justify-start" @click="showCustomProviderDialog = true">
            <Plus class="h-3.5 w-3.5 mr-2" />
            Add Custom Provider
          </Button>
          <Button variant="outline" size="sm" class="w-full justify-start" @click="showCustomModelDialog = true">
            <Terminal class="h-3.5 w-3.5 mr-2" />
            Add Custom Model
          </Button>
          <Button variant="outline" size="sm" class="w-full justify-start" @click="showSettingsPanel = !showSettingsPanel">
            <Settings2 class="h-3.5 w-3.5 mr-2" />
            Global Settings
          </Button>
        </div>

        <div v-if="showSettingsPanel" class="mt-2 px-2 space-y-3">
          <Card class="p-3 space-y-2">
            <div class="text-xs font-semibold">Default Thinking Level</div>
            <div class="flex gap-1 flex-wrap">
              <button
                v-for="level in defaultThinkingOptions"
                :key="level"
                :class="[
                  'px-2 py-1 text-xs rounded border transition-colors',
                  settingsStore.defaultThinkingLevel === level
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-accent border-input',
                ]"
                @click="handleSetDefault(settingsStore.defaultProvider, settingsStore.defaultModel, level)"
              >
                {{ level }}
              </button>
            </div>
            <div class="text-xs font-semibold">Enabled Models (glob)</div>
            <div class="flex gap-1">
              <Input
                v-model="enabledModelsInput"
                placeholder="e.g. claude-*,gpt-4o"
                class="flex-1 h-7 text-xs"
              />
              <Button size="sm" variant="outline" @click="handleSaveEnabledModels">Save</Button>
            </div>
            <div v-if="settingsStore.enabledModels.length" class="text-xs text-muted-foreground">
              Current: {{ settingsStore.enabledModels.join(', ') }}
            </div>
          </Card>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-6">
        <div v-if="!selectedProvider" class="flex h-full items-center justify-center text-muted-foreground">
          <div class="text-center">
            <Globe class="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Select a provider to configure</p>
          </div>
        </div>

        <template v-else-if="selectedProviderDetail">
          <div class="max-w-3xl mx-auto space-y-6">
            <div>
              <h2 class="text-xl font-bold">{{ selectedProviderDetail.displayName }}</h2>
              <p class="text-sm text-muted-foreground">{{ selectedProviderDetail.name }}</p>
            </div>

            <Card class="p-4">
              <div class="flex items-center justify-between mb-2">
                <h3 class="font-semibold flex items-center gap-2">
                  <Key class="h-4 w-4" />
                  API Key
                </h3>
                <Badge :variant="selectedProviderDetail.authStatus === 'configured' ? 'default' : 'outline'">
                  {{ selectedProviderDetail.authStatus === 'configured' ? 'Configured' : 'Not configured' }}
                </Badge>
              </div>

              <div v-if="showApiKeyInput === selectedProvider" class="flex gap-2">
                <Input
                  v-model="apiKeyInput"
                  type="password"
                  placeholder="Enter API key..."
                  class="flex-1"
                />
                <Button size="sm" @click="handleSaveApiKey(selectedProvider)">
                  <Check class="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" @click="showApiKeyInput = null">
                  <X class="h-4 w-4" />
                </Button>
              </div>

              <div v-else class="flex gap-2 flex-wrap">
                <Button size="sm" @click="showApiKeyInput = selectedProvider">
                  <Plus class="h-4 w-4 mr-1" />
                  {{ selectedProviderDetail.authStatus === 'configured' ? 'Update' : 'Add' }} API Key
                </Button>
                <Button
                  v-if="selectedProviderDetail.authStatus === 'configured'"
                  variant="outline"
                  size="sm"
                  @click="handleRemoveApiKey(selectedProvider)"
                >
                  <Trash2 class="h-4 w-4 mr-1" />
                  Remove
                </Button>
                <Button variant="outline" size="sm" :disabled="testingProviders.has(selectedProvider)" @click="handleTestConnection(selectedProvider)">
                  <Loader2 v-if="testingProviders.has(selectedProvider)" class="h-4 w-4 mr-1 animate-spin" />
                  <Wifi v-else class="h-4 w-4 mr-1" />
                  Test
                </Button>
              </div>

              <div v-if="testResults[selectedProvider]" class="mt-2 text-xs">
                <div v-if="testResults[selectedProvider].success" class="text-green-600 flex items-center gap-1">
                  <Wifi class="h-3 w-3" /> Connected ({{ testResults[selectedProvider].latencyMs }}ms)
                </div>
                <div v-else class="text-destructive flex items-center gap-1">
                  <WifiOff class="h-3 w-3" /> {{ testResults[selectedProvider].error }}
                </div>
              </div>
            </Card>

            <Card class="p-4">
              <button
                class="flex w-full items-center justify-between"
                @click="toggleSection('endpoint')"
              >
                <h3 class="font-semibold flex items-center gap-2">
                  <Server class="h-4 w-4" />
                  Endpoint Override
                </h3>
                <component :is="expandedSections['endpoint'] ? ChevronDown : ChevronRight" class="h-4 w-4" />
              </button>

              <div v-if="expandedSections['endpoint']" class="mt-3 space-y-2">
                <p class="text-xs text-muted-foreground">
                  Override the default API endpoint for this provider.
                </p>
                <div class="grid grid-cols-1 gap-2">
                  <Input v-model="endpointForm.baseUrl" placeholder="Base URL (e.g. https://api.example.com/v1)" />
                  <div class="grid grid-cols-2 gap-2">
                    <NativeSelect v-model="endpointForm.api">
                      <option value="openai-completions">OpenAI Completions</option>
                      <option value="openai-responses">OpenAI Responses</option>
                      <option value="anthropic-messages">Anthropic Messages</option>
                    </NativeSelect>
                    <Button variant="outline" size="sm" @click="loadEndpoint(selectedProvider)">
                      Load current
                    </Button>
                  </div>
                  <Input
                    v-model="endpointForm.headers"
                    placeholder='Custom headers JSON (e.g. {"X-Api-Version":"2024-01"})'
                  />
                </div>
                <div class="flex gap-2">
                  <Button size="sm" @click="handleSaveEndpoint(selectedProvider)">
                    <Check class="h-4 w-4 mr-1" /> Save
                  </Button>
                  <Button variant="outline" size="sm" @click="handleRemoveEndpoint(selectedProvider)">
                    <Trash2 class="h-4 w-4 mr-1" /> Reset
                  </Button>
                </div>
              </div>
            </Card>

            <Card class="p-4">
              <div class="flex items-center justify-between mb-2">
                <h3 class="font-semibold flex items-center gap-2">
                  <Terminal class="h-4 w-4" />
                  Models
                </h3>
                <Badge variant="secondary">{{ selectedProviderModels.length }}</Badge>
              </div>

              <div class="relative mb-2">
                <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  v-model="modelSearchQuery"
                  placeholder="Search models..."
                  class="pl-7 h-7 text-xs"
                />
              </div>

              <div v-if="selectedProviderModels.length === 0" class="text-sm text-muted-foreground py-2">
                No models found. Configure an API key to see available models.
              </div>

              <div class="space-y-1 max-h-96 overflow-y-auto">
                <div
                  v-for="model in selectedProviderModels"
                  :key="model.id"
                  class="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent/50"
                >
                  <div class="min-w-0 flex-1">
                    <div class="font-medium truncate">{{ model.name || model.id }}</div>
                    <div class="text-xs text-muted-foreground">
                      ctx: {{ (model.contextWindow / 1000).toFixed(0) }}K
                      <span v-if="model.input?.includes('image')"> · vision</span>
                      <span v-if="model.reasoning"> · reasoning</span>
                      <span v-if="model.cost"> · ${{ model.cost.input }}/${{ model.cost.output }}M</span>
                      <span v-if="model.isCustom" class="text-yellow-600 font-medium"> · custom</span>
                    </div>
                  </div>
                  <Button
                    v-if="!isDefault(model.provider, model.id)"
                    variant="ghost"
                    size="sm"
                    @click="handleSetDefault(model.provider, model.id)"
                  >
                    Set default
                  </Button>
                  <Badge v-else variant="default">Default</Badge>
                </div>
              </div>
            </Card>
          </div>
        </template>
      </div>
    </div>

    <Dialog v-model:open="showCustomProviderDialog" title="Add Custom Provider">
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-xs font-medium">Provider Name *</label>
            <Input v-model="customProviderForm.name" placeholder="e.g. my-company" />
          </div>
          <div>
            <label class="text-xs font-medium">Display Name</label>
            <Input v-model="customProviderForm.displayName" placeholder="My Company LLM" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-xs font-medium">Base URL *</label>
            <Input v-model="customProviderForm.baseUrl" placeholder="https://api.example.com/v1" />
          </div>
          <div>
            <label class="text-xs font-medium">API Protocol</label>
            <NativeSelect v-model="customProviderForm.api">
              <option value="openai-completions">OpenAI Completions</option>
              <option value="openai-responses">OpenAI Responses</option>
              <option value="anthropic-messages">Anthropic Messages</option>
            </NativeSelect>
          </div>
        </div>
        <div>
          <label class="text-xs font-medium">API Key (optional)</label>
          <Input v-model="customProviderForm.apiKey" type="password" placeholder="sk-..." />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-xs font-medium">Default Model ID</label>
            <Input v-model="customProviderForm.modelId" placeholder="my-model" />
          </div>
          <div>
            <label class="text-xs font-medium">Model Name</label>
            <Input v-model="customProviderForm.modelName" placeholder="My Custom Model" />
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" @click="showCustomProviderDialog = false">Cancel</Button>
          <Button size="sm" @click="handleAddCustomProvider" :disabled="!customProviderForm.name || !customProviderForm.baseUrl">
            <Plus class="h-4 w-4 mr-1" /> Add Provider
          </Button>
        </div>
      </div>
    </Dialog>

    <Dialog v-model:open="showCustomModelDialog" title="Add Custom Model">
      <div class="space-y-3">
        <div>
          <label class="text-xs font-medium">Provider Name *</label>
          <Input v-model="customModelForm.provider" placeholder="e.g. anthropic (or your custom provider)" />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-xs font-medium">Base URL</label>
            <Input v-model="customModelForm.baseUrl" placeholder="Optional: API endpoint" />
          </div>
          <div>
            <label class="text-xs font-medium">API Protocol</label>
            <NativeSelect v-model="customModelForm.api">
              <option value="openai-completions">OpenAI Completions</option>
              <option value="openai-responses">OpenAI Responses</option>
              <option value="anthropic-messages">Anthropic Messages</option>
            </NativeSelect>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-xs font-medium">Model ID *</label>
            <Input v-model="customModelForm.modelId" placeholder="e.g. gpt-4o-mini" />
          </div>
          <div>
            <label class="text-xs font-medium">Display Name</label>
            <Input v-model="customModelForm.modelName" placeholder="GPT-4o Mini" />
          </div>
        </div>
        <div>
          <label class="text-xs font-medium">Context Window</label>
          <Input v-model.number="customModelForm.contextWindow" type="number" placeholder="128000" />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" @click="showCustomModelDialog = false">Cancel</Button>
          <Button size="sm" @click="handleAddCustomModel" :disabled="!customModelForm.provider || !customModelForm.modelId">
            <Plus class="h-4 w-4 mr-1" /> Add Model
          </Button>
        </div>
      </div>
    </Dialog>
  </div>
</template>