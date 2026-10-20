<script setup lang="ts">
definePageMeta({ titulo: 'Ranking de representantes', permissao: 'dashboard.view' });
useHead({ title: 'Ranking de representantes — MetaBI' });
</script>

<template>
  <DashboardRankingPagina dim="gestores" />
</template>
