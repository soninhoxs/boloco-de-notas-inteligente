import { AI_PROVIDERS, getModelLabel } from '@/services/ai-providers'
import { SettingsSelect } from '@/components/ui/settings-select'
import type { AiProvider } from '@/types/settings'
import { cn } from '@/lib/utils'

interface AiModelPickerProps {
  provider: AiProvider
  model: string
  onProviderChange: (provider: AiProvider) => void
  onModelChange: (model: string) => void
  className?: string
}

export function AiModelPicker({
  provider,
  model,
  onProviderChange,
  onModelChange,
  className,
}: AiModelPickerProps) {
  const providerOptions = (
    Object.entries(AI_PROVIDERS) as [AiProvider, (typeof AI_PROVIDERS)[AiProvider]][]
  ).map(([key, item]) => ({
    value: key,
    label: item.label.replace(' (grátis)', '').replace(' (pago)', ''),
  }))

  const modelOptions = AI_PROVIDERS[provider].models.map((id) => ({
    value: id,
    label: getModelLabel(id),
  }))

  return (
    <div className={cn('flex min-w-0 items-center gap-1.5', className)}>
      <SettingsSelect
        size="compact"
        ariaLabel="Provedor de IA"
        value={provider}
        onChange={(value) => onProviderChange(value as AiProvider)}
        options={providerOptions}
        className="min-w-[4.5rem] flex-1 sm:min-w-[5.5rem] sm:flex-none"
      />
      <SettingsSelect
        size="compact"
        ariaLabel="Modelo de IA"
        value={model}
        onChange={onModelChange}
        options={modelOptions}
        className="min-w-[5.5rem] flex-1 sm:min-w-[6.5rem] sm:flex-none"
      />
    </div>
  )
}

interface AiSettingsPatch {
  aiProvider?: AiProvider
  aiModel?: string
}

interface AiModelPickerWithDefaultsProps {
  provider: AiProvider
  model: string
  onUpdate: (patch: AiSettingsPatch) => void
  className?: string
}

export function AiModelPickerWithDefaults({
  provider,
  model,
  onUpdate,
  className,
}: AiModelPickerWithDefaultsProps) {
  return (
    <AiModelPicker
      className={className}
      provider={provider}
      model={model}
      onProviderChange={(nextProvider) =>
        onUpdate({
          aiProvider: nextProvider,
          aiModel: AI_PROVIDERS[nextProvider].defaultModel,
        })
      }
      onModelChange={(nextModel) => onUpdate({ aiModel: nextModel })}
    />
  )
}
