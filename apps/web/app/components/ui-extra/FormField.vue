<script setup lang="ts">
/**
 * Campo de texto dentro de um <UForm>: o erro vem do schema pelo `name` e é anunciado
 * com role="alert" (o UFormField puro não anuncia). Campos type="password" ganham o botão
 * de mostrar/ocultar a senha.
 */
defineOptions({ inheritAttrs: false });
defineProps<{ name: string; label: string; dica?: string }>();
const model = defineModel<string>();

const attrs = useAttrs();
const ehSenha = computed(() => attrs.type === 'password');
const mostrar = ref(false);
const tipo = computed(() => (ehSenha.value && mostrar.value ? 'text' : (attrs.type as string | undefined)));
</script>

<template>
  <UFormField :name="name" :label="label" :description="dica" :ui="{ error: 'text-sm' }">
    <template v-if="$slots.acao" #hint><slot name="acao" /></template>
    <UInput
      v-model="model"
      v-bind="$attrs"
      :type="tipo"
      size="lg"
      class="w-full"
      :ui="{ base: 'h-10', trailing: 'pe-1' }"
    >
      <template v-if="ehSenha" #trailing>
        <UButton
          color="neutral"
          variant="link"
          size="sm"
          :icon="mostrar ? 'i-lucide-eye-off' : 'i-lucide-eye'"
          :aria-label="mostrar ? 'Ocultar senha' : 'Mostrar senha'"
          :aria-pressed="mostrar"
          @click="mostrar = !mostrar"
        />
      </template>
    </UInput>
    <template #error="{ error }">
      <span v-if="error" role="alert">{{ error }}</span>
    </template>
  </UFormField>
</template>
