<script setup lang="ts">
const appConfig = useAppConfig()

useHead({
  titleTemplate: (title?: string) => (title ? `${title} · ${appConfig.site.shortName}` : appConfig.site.name)
})
</script>

<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
